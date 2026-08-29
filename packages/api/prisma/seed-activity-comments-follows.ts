import { PrismaClient, NotificationKind, Comment } from '@prisma/client';
import * as crypto from 'crypto';
import { upsertGroupFromNotification } from './seed-activity-likes';

/**
 * Seed ~400 rows: COMMENT notifications (12 discussions with multi-actor threads)
 * + FOLLOW storms (batches of fans following creators, collapsed via time bucket key).
 * - COMMENT groups collapse per (userId, articleSlug-comment-thread grouping key).
 * - FOLLOW groups collapse via 6h bucket per user (buildGroupingKey helper).
 */
export async function runSeedActivityCommentsFollows(prisma: PrismaClient): Promise<number> {
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
    console.warn('[seed-activity-comments-follows] No creators found; skipping.');
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
    console.warn('[seed-activity-comments-follows] Not enough actors; skipping.');
    return 0;
  }

  let insertCount = 0;

  /* ─── Part A: COMMENT notifications + create actual Comment rows (for thread grouping) ─── */
  const COMMENT_BODIES = [
    'This was an excellent read, thanks for writing!',
    "Strongly disagree with point #3 — here's why…",
    "Tried this approach last week and it's working great for me.",
    'Any chance you can expand on the section about caching?',
    'Just shared this with my team — very relevant to our work.',
    'The analogy in paragraph 2 really clicked for me.',
    'Been looking for a write-up like this for months. Bookmarked!',
    'Found a typo in the third code block, but otherwise solid.',
    'Huge fan of the format — short, punchy sections.',
    "Follow-up: does this still hold if you're on Postgres 15 vs 16?",
  ];

  for (const creator of creators) {
    const articles = await prisma.article.findMany({
      where: { authorId: creator.id, isPublished: true },
      take: 3,
      orderBy: { createdAt: 'desc' },
      select: { slug: true },
    });
    if (articles.length === 0) continue;

    for (const art of articles) {
      // 10–14 top-level comments per article from distinct actors
      const topLevelCount = 10 + crypto.randomInt(5); // 10-14
      const usedActors = new Set<string>();
      const parentComments: Comment[] = [];

      for (let i = 0; i < topLevelCount; i++) {
        let actor = actors[crypto.randomInt(actors.length)];
        let g = 0;
        while (usedActors.has(actor.id) && usedActors.size < actors.length && g < 10) {
          actor = actors[crypto.randomInt(actors.length)];
          g++;
        }
        usedActors.add(actor.id);

        const d = new Date(Date.now() - (2 + crypto.randomInt(72)) * 3_600_000);
        const body = COMMENT_BODIES[crypto.randomInt(COMMENT_BODIES.length)];
        let comment: Comment;
        try {
          comment = await prisma.comment.create({
            data: {
              articleSlug: art.slug,
              authorId: actor.id,
              body,
              createdAt: d,
              updatedAt: d,
            },
          });
        } catch {
          continue;
        }
        parentComments.push(comment);

        try {
          const notif = await prisma.notification.create({
            data: {
              userId: creator.id,
              actorId: actor.id,
              kind: NotificationKind.COMMENT,
              articleSlug: art.slug,
              highlightId: null,
              commentId: comment.id,
              body,
              createdAt: d,
              updatedAt: d,
            },
          });
          await upsertGroupFromNotification(prisma, notif);
          insertCount++;
        } catch {
          /* dupe or FK fail */
        }
      }

      // For 60% of parent comments: 3–5 REPLY notifications from OTHER actors.
      for (const parent of parentComments.slice(0, Math.max(1, Math.floor(parentComments.length * 0.6)))) {
        const replyCount = 3 + crypto.randomInt(3); // 3-5
        const replyActors = actors.filter((a) => a.id !== parent.authorId);
        for (let r = 0; r < replyCount && replyActors.length > 0; r++) {
          const actor = replyActors[crypto.randomInt(replyActors.length)];
          const d = new Date((parent.createdAt?.getTime() ?? Date.now()) + (5 + crypto.randomInt(360)) * 60_000);
          const body =
            COMMENT_BODIES[(crypto.randomInt(COMMENT_BODIES.length) + 3) % COMMENT_BODIES.length];
          let reply: Comment;
          try {
            reply = await prisma.comment.create({
              data: {
                articleSlug: parent.articleSlug,
                authorId: actor.id,
                parentId: parent.id,
                body: `Re: ${body}`,
                createdAt: d,
                updatedAt: d,
              },
            });
          } catch {
            continue;
          }
          try {
            const notif = await prisma.notification.create({
              data: {
                userId: parent.authorId,
                actorId: actor.id,
                kind: NotificationKind.REPLY,
                articleSlug: parent.articleSlug,
                highlightId: null,
                commentId: reply.id,
                body: reply.body,
                createdAt: d,
                updatedAt: d,
              },
            });
            // Grouping key uses reply.commentId (mirrors T2 service) → per-thread collapse
            // when commentId is the same. Since each reply has unique id, grouping is per
            // unique reply. Acceptable — most of our ratio compression comes from LIKEs.
            await upsertGroupFromNotification(prisma, notif);
            insertCount++;
          } catch {
            /* noop */
          }
        }
      }
    }
  }

  /* ─── Part B: FOLLOW storms — batches of actors following creators (collapses via 6h bucket) ─── */
  for (const creator of creators) {
    const stormSize = 15 + crypto.randomInt(11); // 15-25 follows per creator
    const usedActors = new Set<string>();
    for (let i = 0; i < stormSize; i++) {
      let actor = actors[crypto.randomInt(actors.length)];
      let g = 0;
      while (usedActors.has(actor.id) && usedActors.size < actors.length && g < 10) {
        actor = actors[crypto.randomInt(actors.length)];
        g++;
      }
      usedActors.add(actor.id);
      const d = new Date(Date.now() - (1 + crypto.randomInt(48)) * 3_600_000);
      try {
        await prisma.follow.create({
          data: { followerId: actor.id, followingId: creator.id, createdAt: d },
        });
      } catch {
        /* unique (followerId,followingId) may exist */
      }
      try {
        const notif = await prisma.notification.create({
          data: {
            userId: creator.id,
            actorId: actor.id,
            kind: NotificationKind.FOLLOW,
            articleSlug: null,
            highlightId: null,
            commentId: null,
            createdAt: d,
            updatedAt: d,
          },
        });
        // buildGroupingKey default collapses FOLLOW into 6h buckets
        await upsertGroupFromNotification(prisma, notif);
        insertCount++;
      } catch {
        /* noop */
      }
    }
  }

  console.log(
    `[seed-activity-comments-follows] +${insertCount} notifications (COMMENT+REPLY+FOLLOW) in ${
      Date.now() - t0
    }ms`,
  );
  return insertCount;
}
