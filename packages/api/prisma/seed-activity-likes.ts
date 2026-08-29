import { PrismaClient, NotificationKind } from '@prisma/client';
import * as crypto from 'crypto';

/**
 * Seed like-storms across articles/highlights.
 * Target ~800 LIKE notifications distributed across ~12 creators × ~8 content targets
 * each, with 5–18 actor fans per target → groups collapse into ≤96 ActivityItem rows.
 * Deterministic-ish (uses crypto.randomInt; repeat runs grow counts non-idempotently
 * because Notification PK is UUID; groups merge via ON CONFLICT).
 */
export async function runSeedActivityLikes(prisma: PrismaClient): Promise<number> {
  const t0 = Date.now();

  // Pull existing creators dynamically — users with the most published content.
  const topAuthors = await prisma.article.groupBy({
    by: ['authorId'],
    where: { isPublished: true },
    _count: { authorId: true },
    orderBy: { _count: { authorId: 'desc' } },
    take: 20,
  });
  const authorScore = new Map<string, number>();
  for (const r of topAuthors) authorScore.set(r.authorId, (authorScore.get(r.authorId) ?? 0) + r._count.authorId);
  const topHL = await prisma.highlight.groupBy({
    by: ['authorId'],
    where: { isPublished: true },
    _count: { authorId: true },
    orderBy: { _count: { authorId: 'desc' } },
    take: 20,
  });
  for (const r of topHL) authorScore.set(r.authorId, (authorScore.get(r.authorId) ?? 0) + r._count.authorId);
  const creatorIdsSorted = [...authorScore.entries()].sort((a, b) => b[1] - a[1]).map((e) => e[0]);
  const creators = (
    await prisma.user.findMany({
      where: { id: { in: creatorIdsSorted.slice(0, 20) } },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    })
  ).sort((a, b) => creatorIdsSorted.indexOf(a.id) - creatorIdsSorted.indexOf(b.id)).slice(0, 12);

  if (creators.length === 0) {
    console.warn('[seed-activity-likes] No creators with content found; skipping.');
    return 0;
  }

  const creatorIdList = creators.map((c) => c.id);
  // Pull actor fans (non-creators, different slice of existing users).
  const actors = await prisma.user.findMany({
    where: { id: { notIn: creatorIdList } },
    take: 35,
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (actors.length === 0) {
    console.warn('[seed-activity-likes] No actor fans found; skipping.');
    return 0;
  }

  const FRIDAY_BURST_WEIGHT = 0.55; // 55% of likes land in Fri 15:00–18:00 UTC window
  let insertCount = 0;

  for (const creator of creators) {
    const articles = await prisma.article.findMany({
      where: { authorId: creator.id, isPublished: true },
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: { slug: true },
    });
    const highlights = await prisma.highlight.findMany({
      where: { authorId: creator.id, isPublished: true },
      take: 3,
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    const targets: Array<{ slug?: string; hId?: string }> = [];
    articles.forEach((a) => targets.push({ slug: a.slug }));
    highlights.forEach((h) => targets.push({ hId: h.id }));

    for (const t of targets) {
      // 12-24 distinct fans per content target (guarantees group collapse per target, pushes total LIKEs to ≥800).
      const burstSize = 12 + crypto.randomInt(13);
      const usedActors = new Set<string>();
      for (let i = 0; i < burstSize; i++) {
        let actor = actors[crypto.randomInt(actors.length)];
        let guard = 0;
        while (usedActors.has(actor.id) && usedActors.size < actors.length && guard < 10) {
          actor = actors[crypto.randomInt(actors.length)];
          guard++;
        }
        usedActors.add(actor.id);

        const d = weightedFridayDate(FRIDAY_BURST_WEIGHT);
        try {
          const created = await prisma.notification.create({
            data: {
              userId: creator.id,
              actorId: actor.id,
              kind: NotificationKind.LIKE,
              articleSlug: t.slug ?? null,
              highlightId: t.hId ?? null,
              commentId: null,
              createdAt: d,
              updatedAt: d,
              body: null,
            },
          });
          await upsertGroupFromNotification(prisma, created);
          insertCount++;
        } catch (_) {
          /* skip dupes or missing FKs */
        }
      }
    }
  }

  console.log(
    `[seed-activity-likes] +${insertCount} LIKE notifications in ${Date.now() - t0}ms (creators=${
      creators.length
    }, actors=${actors.length})`,
  );
  return insertCount;
}

/* ---------- helpers ---------- */

/** Weighted random date: ~weight% land in recent-Fri 15:00–18:00 UTC, rest 1–72h ago. */
function weightedFridayDate(weight: number): Date {
  const r = Math.random();
  if (r < weight) {
    // find the most recent Friday 15:00 UTC or next one if it hasn't happened
    const now = new Date();
    const day = now.getUTCDay(); // 0=Sun..5=Fri..6=Sat
    // Days since last Friday
    const diff = (day + 2) % 7; // day=5 (Fri) → 0; day=0 (Sun) → 2
    const fri = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diff, 15, 0, 0));
    if (fri.getTime() > now.getTime()) fri.setUTCDate(fri.getUTCDate() - 7);
    // Within 15:00–18:00 UTC → 0–3h offset + 0–59m
    const offMs = crypto.randomInt(3 * 60 + 1) * 60_000 + crypto.randomInt(60) * 1000;
    return new Date(fri.getTime() + offMs);
  }
  const hoursAgo = 1 + crypto.randomInt(72);
  return new Date(Date.now() - hoursAgo * 3_600_000 - crypto.randomInt(3_600_000));
}

/* Inline aggregation helper — mirrors ActivityAggregatorService.upsertGroup write path
 * using Prisma ORM (avoids $executeRawUnsafe identifier-mangling quirks). */
export async function upsertGroupFromNotification(
  prisma: PrismaClient,
  n: {
    id: string;
    userId: string;
    actorId?: string | null;
    kind: NotificationKind;
    articleSlug?: string | null;
    highlightId?: string | null;
    commentId?: string | null;
    body?: string | null;
    createdAt?: Date;
  },
  overrideGroupingKey?: string,
): Promise<void> {
  const MAX_ACTORIDS = 50;
  const kind = n.kind;
  const articleSlug = n.articleSlug ?? null;
  const highlightId = n.highlightId ?? null;
  const commentId = n.commentId ?? null;

  const groupingKey =
    overrideGroupingKey ?? buildGroupingKey(kind, { articleSlug, highlightId, commentId });

  const who = 'A user';
  const previewText =
    n?.body ?? defaultPreview(kind, who, { articleSlug, highlightId, commentId });
  const finalActorIds: string[] = n.actorId ? [n.actorId] : [];
  const linkHref = computeLink(articleSlug, highlightId);

  try {
    // Determine final actorIds for UPDATE: preserve existing + append new ones only if absent and under cap.
    const existing = await prisma.activityItem.findUnique({
      where: { userId_groupingKey: { userId: n.userId, groupingKey } },
      select: { actorIds: true, count: true, read: true },
    });
    let mergedActorIds: string[] = finalActorIds;
    let count = 1;
    if (existing) {
      const prev = existing.actorIds ?? [];
      const overlap = finalActorIds.filter((id) => prev.includes(id));
      if (prev.length < MAX_ACTORIDS) {
        mergedActorIds = [...prev, ...finalActorIds.filter((id) => !prev.includes(id))];
      } else {
        mergedActorIds = prev;
      }
      // Use overlap indicator to decide whether to bump count or not —
      // service always bumps count +1 on conflict, so we mirror that.
      count = existing.count + 1;
      void overlap;
    }
    await prisma.activityItem.upsert({
      where: { userId_groupingKey: { userId: n.userId, groupingKey } },
      create: {
        id: crypto.randomUUID(),
        userId: n.userId,
        kind,
        groupingKey,
        actorIds: mergedActorIds,
        count,
        previewText,
        articleSlug,
        highlightId,
        commentId,
        linkHref,
        latestActivityAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        read: false,
      },
      update: {
        actorIds: mergedActorIds,
        count,
        previewText,
        linkHref,
        latestActivityAt: new Date(),
        updatedAt: new Date(),
        // If the existing row was marked read, flipping back to unread on new activity
        read: existing?.read ? false : undefined,
        readAt: existing?.read ? null : undefined,
      },
    });
  } catch (_e: any) {
    // Non-fatal for seed — swallow schema/migration issues.
  }
}

export function buildGroupingKey(
  kind: NotificationKind,
  row: { articleSlug?: string | null; highlightId?: string | null; commentId?: string | null },
): string {
  switch (kind) {
    case NotificationKind.LIKE:
    case NotificationKind.BOOKMARK:
    case NotificationKind.SHARE:
      if (row.articleSlug) return `${kind}:article:${row.articleSlug}`;
      if (row.highlightId) return `${kind}:highlight:${row.highlightId}`;
      if (row.commentId) return `${kind}:comment:${row.commentId}`;
      return `${kind}:misc`;
    case NotificationKind.COMMENT:
    case NotificationKind.REPLY:
    case NotificationKind.MENTION:
      // Seed grouping: collapse to ARTICLE-level group so multiple comment-thread
      // rows merge per (creator, article). Matches ~groupComments=true preference
      // semantics — service would use same grouping if commentId was thread root.
      if (row.articleSlug) return `${kind}:article:${row.articleSlug}`;
      if (row.highlightId) return `${kind}:highlight:${row.highlightId}`;
      return `${kind}:unknown:fixed`;
    case NotificationKind.FOLLOW:
      // Single follow-group per user so any FOLLOW storms collapse into 1 ActivityItem/user.
      return `${kind}:actor:all`;
    default:
      return `${kind}:${Date.now()}`;
  }
}

export function defaultPreview(
  kind: NotificationKind,
  who: string,
  target: { articleSlug?: string | null; highlightId?: string | null; commentId?: string | null },
): string {
  switch (kind) {
    case NotificationKind.LIKE:
      return `${who} liked your ${target.articleSlug ? 'post' : target.highlightId ? 'highlight' : 'content'}.`;
    case NotificationKind.COMMENT:
      return `${who} commented on your ${target.articleSlug ? 'post' : 'highlight'}.`;
    case NotificationKind.REPLY:
      return `${who} replied to your comment.`;
    case NotificationKind.FOLLOW:
      return `${who} followed you.`;
    case NotificationKind.MENTION:
      return `${who} mentioned you in a ${target.commentId ? 'comment' : 'post'}.`;
    case NotificationKind.BOOKMARK:
      return `${who} bookmarked your ${target.articleSlug ? 'post' : target.highlightId ? 'highlight' : 'content'}.`;
    case NotificationKind.SHARE:
      return `${who} shared your ${target.articleSlug ? 'post' : 'highlight'}.`;
    default:
      return `${who}: system activity.`;
  }
}

export function computeLink(articleSlug: string | null, highlightId: string | null): string | null {
  if (articleSlug) return `/article/${articleSlug}`;
  if (highlightId) return `/h/${highlightId}`;
  return null;
}
