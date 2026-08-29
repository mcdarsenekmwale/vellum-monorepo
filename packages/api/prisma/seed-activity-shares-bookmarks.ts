import { PrismaClient, NotificationKind } from '@prisma/client';
import * as crypto from 'crypto';
import { upsertGroupFromNotification } from './seed-activity-likes';

/**
 * Seed ~200+ rows:
 * - BOOKMARK clusters: 4–12 bookmarks per target (collapses per target grouping key).
 * - SHARE clusters: 3–10 shares per target (collapses per target grouping key).
 * Creates actual Bookmark rows + Notification rows. SHARE has no backing table (pure notification).
 */
export async function runSeedActivitySharesBookmarks(prisma: PrismaClient): Promise<number> {
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
    })
  ).sort((a, b) => creatorIdsSorted.indexOf(a.id) - creatorIdsSorted.indexOf(b.id)).slice(0, 12);

  if (creators.length === 0) {
    console.warn('[seed-activity-shares-bookmarks] No creators found; skipping.');
    return 0;
  }

  const creatorIdList = creators.map((c) => c.id);
  const actors = await prisma.user.findMany({
    where: { id: { notIn: creatorIdList } },
    take: 35,
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (actors.length < 5) {
    console.warn('[seed-activity-shares-bookmarks] Not enough actors; skipping.');
    return 0;
  }

  let insertCount = 0;

  for (const creator of creators) {
    const articles = await prisma.article.findMany({
      where: { authorId: creator.id, isPublished: true },
      take: 4,
      orderBy: { createdAt: 'desc' },
      select: { slug: true },
    });
    const highlights = await prisma.highlight.findMany({
      where: { authorId: creator.id, isPublished: true },
      take: 3,
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });

    const bookTargets: Array<{ slug?: string; hId?: string }> = [];
    articles.slice(0, 3).forEach((a) => bookTargets.push({ slug: a.slug }));
    highlights.slice(0, 2).forEach((h) => bookTargets.push({ hId: h.id }));

    const shareTargets: Array<{ slug?: string; hId?: string }> = [];
    articles.forEach((a) => shareTargets.push({ slug: a.slug }));
    highlights.forEach((h) => shareTargets.push({ hId: h.id }));

    /* ─── BOOKMARK clusters ─── */
    for (const t of bookTargets) {
      const clusterSize = 8 + crypto.randomInt(9); // 8-16
      const usedActors = new Set<string>();
      for (let i = 0; i < clusterSize; i++) {
        let actor = actors[crypto.randomInt(actors.length)];
        let g = 0;
        while (usedActors.has(actor.id) && usedActors.size < actors.length && g < 10) {
          actor = actors[crypto.randomInt(actors.length)];
          g++;
        }
        usedActors.add(actor.id);
        const d = new Date(Date.now() - (6 + crypto.randomInt(96)) * 3_600_000);

        try {
          if (t.slug) {
            await prisma.bookmark.create({
              data: { userId: actor.id, articleSlug: t.slug, createdAt: d },
            });
          } else if (t.hId) {
            await prisma.bookmark.create({
              data: { userId: actor.id, highlightId: t.hId, createdAt: d },
            });
          }
        } catch {
          /* unique constraint or FK miss */
        }

        try {
          const notif = await prisma.notification.create({
            data: {
              userId: creator.id,
              actorId: actor.id,
              kind: NotificationKind.BOOKMARK,
              articleSlug: t.slug ?? null,
              highlightId: t.hId ?? null,
              commentId: null,
              createdAt: d,
              updatedAt: d,
            },
          });
          // Groups collapse per (kind, article|highlight) target → ≤ (12 × 5 targets) = 60 groups
          await upsertGroupFromNotification(prisma, notif);
          insertCount++;
        } catch {
          /* noop */
        }
      }
    }

    /* ─── SHARE clusters ─── */
    for (const t of shareTargets) {
      const clusterSize = 6 + crypto.randomInt(8); // 6-13
      const usedActors = new Set<string>();
      for (let i = 0; i < clusterSize; i++) {
        let actor = actors[crypto.randomInt(actors.length)];
        let g = 0;
        while (usedActors.has(actor.id) && usedActors.size < actors.length && g < 10) {
          actor = actors[crypto.randomInt(actors.length)];
          g++;
        }
        usedActors.add(actor.id);
        const d = new Date(Date.now() - (3 + crypto.randomInt(96)) * 3_600_000);

        try {
          const notif = await prisma.notification.create({
            data: {
              userId: creator.id,
              actorId: actor.id,
              kind: NotificationKind.SHARE,
              articleSlug: t.slug ?? null,
              highlightId: t.hId ?? null,
              commentId: null,
              createdAt: d,
              updatedAt: d,
            },
          });
          // SHARE groups collapse per target → ≤12×7=84 groups
          await upsertGroupFromNotification(prisma, notif);
          insertCount++;
        } catch {
          /* noop */
        }
      }
    }
  }

  console.log(
    `[seed-activity-shares-bookmarks] +${insertCount} BOOKMARK+SHARE notifications in ${
      Date.now() - t0
    }ms`,
  );
  return insertCount;
}
