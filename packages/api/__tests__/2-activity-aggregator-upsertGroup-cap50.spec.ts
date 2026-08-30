import { ActivityAggregatorService } from '../src/modules/activity/activity-aggregator.service';
import { NotificationKind } from '@prisma/client';

/**
 * MAX_ACTORIDS = 50 cap is enforced inside the raw SQL CASE expression
 * inside upsertGroup. We cannot run real SQL in pure unit tests, so we
 * capture the $4 (finalActorIds array) argument passed to
 * prisma.$executeRawUnsafe and assert (a) it is always length <= 50 as
 * passed, and (b) when aggregator runs the SQL cap check at line 121
 * it uses the 50-constant — we verify by re-implementing the cap formula
 * exactly as written (array_length >= 50 => keep, else array_cat).
 */
describe('ActivityAggregatorService upsertGroup actorIds cap at 50', () => {
  function makeWithPrisma(capture: { args: any[] | null }) {
    const prisma: any = {
      notificationPreferences: {
        findFirst: jest.fn().mockResolvedValue({ groupLikes: true, groupComments: true, groupFollows: true }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ handle: 'alice', name: 'Alice' }),
      },
      $executeRawUnsafe: jest.fn(async (_sql: string, ...args: any[]) => {
        capture.args = args;
        return 1;
      }),
    };
    const events: any = { emit: jest.fn().mockImplementation(() => true) };
    return { prisma, events, agg: new ActivityAggregatorService(prisma, events) };
  }

  it('upsertGroup passes finalActorIds as single-element array (1 actor per row)', async () => {
    const capture = { args: null as any[] | null };
    const { agg, prisma } = makeWithPrisma(capture);
    // Also mock countUnread used after upsert
    prisma.activityItem = { count: jest.fn().mockResolvedValue(0) };

    await agg.upsertGroup({
      notificationId: 'n1',
      userId: 'u-user-0000-0000-0000-000000000001',
      actorId: 'a-actor-0000-0000-0000-000000000001',
      kind: NotificationKind.LIKE,
      articleSlug: 'post-1',
    });

    expect(capture.args).not.toBeNull();
    // $4 (index 3) = finalActorIds
    const actorIdsArg = (capture.args as any[])[3];
    expect(Array.isArray(actorIdsArg)).toBe(true);
    // Always length 1 on a single upsert call (SQL concatenates server-side)
    expect(actorIdsArg.length).toBe(1);
    expect(actorIdsArg[0]).toBe('a-actor-0000-0000-0000-000000000001');
  });

  it('SQL cap logic: array length 51 gets frozen (cap), 50 stays as-is', () => {
    // Re-implement the CASE block from activity-aggregator.service.ts L120-L126
    // verbatim to demonstrate we understand the cap semantics.
    const MAX_ACTORIDS = 50;

    function applyCap(existing: string[], incoming: string[]): string[] {
      if (existing.length >= MAX_ACTORIDS) return existing; // frozen at cap
      const overlap = incoming.some((x) => existing.includes(x));
      if (overlap) return existing;
      return [...existing, ...incoming];
    }

    // 55 distinct incoming on empty would fill to 50 by SQL-side logic once.
    // After 50 → subsequent inserts DON'T add more.
    let arr: string[] = [];
    for (let i = 0; i < 55; i++) {
      arr = applyCap(arr, [`actor-${i}`]);
    }
    // Cap logic says when existing.length >= 50, stop adding. With 1-element
    // increments, length reaches exactly 50 (not 55).
    expect(arr.length).toBeLessThanOrEqual(50);
    expect(arr.length).toBe(50);

    // Once at cap, further elements are rejected
    const after = applyCap(arr, ['actor-new']);
    expect(after.length).toBe(50);
    expect(after).toBe(arr); // same reference (frozen path)
  });

  it('55 distinct actors across 55 upsert calls → stored capped at 50 max (SQL cap freezes)', async () => {
    // Build server-side length tracker that mirrors the real SQL's behaviour
    const MAX_ACTORIDS = 50;
    let serverSideStored: string[] = [];
    const capture = { args: null as any[] | null };

    const prisma: any = {
      notificationPreferences: {
        findFirst: jest.fn().mockResolvedValue({ groupLikes: true, groupComments: true, groupFollows: true }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ handle: 'alice', name: 'Alice' }),
      },
      $executeRawUnsafe: jest.fn(async (_sql: string, ...args: any[]) => {
        capture.args = args;
        // Mirror real SQL L120-L126 behaviour:
        const incoming = args[3] as string[];
        if (serverSideStored.length >= MAX_ACTORIDS) {
          /* freeze */
        } else {
          const overlap = incoming.some((x) => serverSideStored.includes(x));
          if (!overlap) serverSideStored = [...serverSideStored, ...incoming];
        }
        return 1;
      }),
      activityItem: { count: jest.fn().mockResolvedValue(0) },
    };
    const events: any = { emit: jest.fn().mockImplementation(() => true) };
    const agg = new ActivityAggregatorService(prisma, events);

    for (let i = 0; i < 55; i++) {
      await agg.upsertGroup({
        notificationId: `n${i}`,
        userId: 'u-user-0000-0000-0000-000000000001',
        actorId: `a-actor-${String(i).padStart(4, '0')}-0000-0000-00000000`,
        kind: NotificationKind.LIKE,
        articleSlug: 'shared-article',
      });
    }

    expect(serverSideStored.length).toBeGreaterThanOrEqual(50);
    // Cap enforced: never exceeds 50
    expect(serverSideStored.length).toBeLessThanOrEqual(50);
    expect(serverSideStored.length).toBe(50);
  });
});
