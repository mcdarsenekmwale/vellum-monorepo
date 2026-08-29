import { PrismaClient, NotificationKind, Comment } from '@prisma/client';
import * as crypto from 'crypto';
import { upsertGroupFromNotification } from './seed-activity-likes';

/**
 * Seed ~300 rows:
 * - MENTION notifications: actors @mention creator-user inside comments (real Comment rows created).
 * - Deep REPLY chains: 3-level replies → notification to each ancestor's author.
 * Groups collapse via comment-thread groupingKey.
 */
export async function runSeedActivityMentionsReplies(prisma: PrismaClient): Promise<number> {
  const t0 = Date.now();

  // Pull existing creators dynamically — users with the most published articles.
  const topAuthors = await prisma.article.groupBy({
    by: ['authorId'],
    where: { isPublished: true },
    _count: { authorId: true },
    orderBy: { _count: { authorId: 'desc' } },
    take: 20,
  });
  const creatorIdsSorted = topAuthors.map((r) => r.authorId);
  const creators = (
    await prisma.user.findMany({
      where: { id: { in: creatorIdsSorted } },
      select: { id: true, handle: true },
    })
  ).sort((a, b) => creatorIdsSorted.indexOf(a.id) - creatorIdsSorted.indexOf(b.id)).slice(0, 10);

  if (creators.length === 0) {
    console.warn('[seed-activity-mentions-replies] No creators found; skipping.');
    return 0;
  }

  const creatorIdList = creators.map((c) => c.id);
  const actors = await prisma.user.findMany({
    where: { id: { notIn: creatorIdList } },
    take: 30,
    orderBy: { createdAt: 'asc' },
    select: { id: true, handle: true },
  });
  if (actors.length < 6) {
    console.warn('[seed-activity-mentions-replies] Not enough actors; skipping.');
    return 0;
  }

  let insertCount = 0;

  const MENTION_SNIPPETS = [
    'This aligns with what @handle wrote recently — totally agree.',
    'Wondering if @handle could weigh in here on the X/Y angle.',
    'cc @handle — thought you might appreciate this framing.',
    "As @handle pointed out last month, it's really about tradeoffs.",
    '@handle would love this breakdown — passing it along.',
  ];

  /* ─── Part A: MENTION notifications — 150+ rows ─── */
  for (const creator of creators) {
    const articles = await prisma.article.findMany({
      where: { authorId: creator.id, isPublished: true },
      take: 4,
      orderBy: { createdAt: 'desc' },
      select: { slug: true },
    });
    if (articles.length === 0) continue;

    for (const art of articles) {
      // 5–8 mentions per article from different actors
      const mentionCount = 5 + crypto.randomInt(4); // 5-8
      const usedActors = new Set<string>();
      for (let m = 0; m < mentionCount; m++) {
        let actor = actors[crypto.randomInt(actors.length)];
        let g = 0;
        while (usedActors.has(actor.id) && usedActors.size < actors.length && g < 10) {
          actor = actors[crypto.randomInt(actors.length)];
          g++;
        }
        usedActors.add(actor.id);

        const mentionHandle = creator.handle ?? 'user';
        const body = MENTION_SNIPPETS[crypto.randomInt(MENTION_SNIPPETS.length)].replace(
          '@handle',
          `@${mentionHandle}`,
        );
        const d = new Date(Date.now() - (2 + crypto.randomInt(72)) * 3_600_000);

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
        try {
          const notif = await prisma.notification.create({
            data: {
              userId: creator.id, // mentioned user = content creator
              actorId: actor.id, // who wrote the @mention
              kind: NotificationKind.MENTION,
              articleSlug: art.slug,
              highlightId: null,
              commentId: comment.id,
              body,
              createdAt: d,
              updatedAt: d,
            },
          });
          // Grouping: MENTION uses comment-thread:$commentId (unique per comment, no collapse).
          // Acceptable — LIKE storms provide heavy ratio reduction.
          await upsertGroupFromNotification(prisma, notif);
          insertCount++;
        } catch {
          /* noop */
        }
      }
    }
  }

  /* ─── Part B: Deep REPLY chains — ~150 rows ─── */
  // For each creator/article plant: seed a "chain comment", then actors reply in a 3-level chain.
  for (const creator of creators) {
    const articles = await prisma.article.findMany({
      where: { authorId: creator.id, isPublished: true },
      take: 2,
      orderBy: { createdAt: 'desc' },
      select: { slug: true },
    });
    for (const art of articles) {
      // Create L0 (level-0) comment from an actor — targets creator
      const anchor = actors[crypto.randomInt(actors.length)];
      const base = new Date(Date.now() - 48 * 3_600_000);
      let level0: Comment;
      try {
        level0 = await prisma.comment.create({
          data: {
            articleSlug: art.slug,
            authorId: anchor.id,
            body: '🔥 Sparking a chain — thoughts?',
            createdAt: base,
            updatedAt: base,
          },
        });
      } catch {
        continue;
      }
      // Notify creator of L0 COMMENT
      try {
        const n = await prisma.notification.create({
          data: {
            userId: creator.id,
            actorId: anchor.id,
            kind: NotificationKind.COMMENT,
            articleSlug: art.slug,
            commentId: level0.id,
            body: level0.body,
            createdAt: base,
            updatedAt: base,
          },
        });
        await upsertGroupFromNotification(prisma, n);
        insertCount++;
      } catch {
        /* noop */
      }

      // Level-1 replies (6–8 actors) → REPLY to anchor
      const l1Replies: Comment[] = [];
      const l1Count = 6 + crypto.randomInt(3);
      for (let r = 0; r < l1Count; r++) {
        const actor = actors[crypto.randomInt(actors.length)];
        const d = new Date(base.getTime() + (30 + crypto.randomInt(600)) * 60_000);
        try {
          const reply = await prisma.comment.create({
            data: {
              articleSlug: art.slug,
              authorId: actor.id,
              parentId: level0.id,
              body: `Chain reply L1 #${r + 1}: great point to start the thread — lots to unpack here.`,
              createdAt: d,
              updatedAt: d,
            },
          });
          l1Replies.push(reply);
          const notif = await prisma.notification.create({
            data: {
              userId: anchor.id, // reply to L0 author
              actorId: actor.id,
              kind: NotificationKind.REPLY,
              articleSlug: art.slug,
              commentId: reply.id,
              body: reply.body,
              createdAt: d,
              updatedAt: d,
            },
          });
          await upsertGroupFromNotification(prisma, notif);
          insertCount++;
        } catch {
          /* noop */
        }
      }

      // Level-2 replies to each L1 reply — ping the L1 author and also mention creator
      for (const l1 of l1Replies) {
        const l2Count = 3 + crypto.randomInt(3); // 3-5
        for (let rr = 0; rr < l2Count; rr++) {
          const actor = actors[crypto.randomInt(actors.length)];
          const d = new Date(
            (l1.createdAt?.getTime() ?? Date.now()) + (15 + crypto.randomInt(180)) * 60_000,
          );
          try {
            const l2 = await prisma.comment.create({
              data: {
                articleSlug: art.slug,
                authorId: actor.id,
                parentId: l1.id,
                body: `L2 reply following up — and @${creator.handle ?? 'user'} what do you think?`,
                createdAt: d,
                updatedAt: d,
              },
            });
            // REPLY notification to L1 author
            const replyNotif = await prisma.notification.create({
              data: {
                userId: l1.authorId,
                actorId: actor.id,
                kind: NotificationKind.REPLY,
                articleSlug: art.slug,
                commentId: l2.id,
                body: l2.body,
                createdAt: d,
                updatedAt: d,
              },
            });
            await upsertGroupFromNotification(prisma, replyNotif);
            insertCount++;
            // MENTION notification to creator
            const mentionNotif = await prisma.notification.create({
              data: {
                userId: creator.id,
                actorId: actor.id,
                kind: NotificationKind.MENTION,
                articleSlug: art.slug,
                commentId: l2.id,
                body: l2.body,
                createdAt: d,
                updatedAt: d,
              },
            });
            await upsertGroupFromNotification(prisma, mentionNotif);
            insertCount++;
          } catch {
            /* noop */
          }
        }
      }
    }
  }

  console.log(
    `[seed-activity-mentions-replies] +${insertCount} MENTION+REPLY notifications in ${
      Date.now() - t0
    }ms`,
  );
  return insertCount;
}
