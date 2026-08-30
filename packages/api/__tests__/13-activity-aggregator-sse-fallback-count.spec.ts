import { ActivityAggregatorService } from '../src/modules/activity/activity-aggregator.service';
import { NotificationKind } from '@prisma/client';

/**
 * Double emit pattern: upsertGroup emits TWO events per successful call
 *   1) sse.activity.created.<userId>
 *   2) sse.activity.unread.<userId>
 * Plus markRead emits unread again. Total call count across two operations
 * must be >= 2 (upsert alone) and >= 3 with markRead.
 */
describe('ActivityAggregatorService SSE emit fallback count ≥ 2 per call', () => {
  function makeEnv() {
    const prisma: any = {
      notificationPreferences: {
        findFirst: jest.fn().mockResolvedValue({ groupLikes: true, groupComments: true, groupFollows: true }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ handle: 'carol', name: 'Carol' }),
      },
      $executeRawUnsafe: jest.fn().mockResolvedValue(1),
      activityItem: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        count: jest.fn().mockResolvedValue(1),
      },
    };
    const events: { emit: (...a: any[]) => boolean } = { emit: () => true };
    const emitSpy = jest.spyOn(events, 'emit').mockImplementation(() => true);
    const agg = new ActivityAggregatorService(prisma, events as any);
    return { agg, emitSpy };
  }

  it('one upsertGroup call → ≥ 2 emits (created + unread fallback count)', async () => {
    const { agg, emitSpy } = makeEnv();
    await agg.upsertGroup({
      notificationId: 'n1',
      userId: 'u-user-aaaa-bbbb-cccc-dddddddddddd',
      actorId: 'a-actor-aaaa-bbbb-cccc-dddddddddddd',
      kind: NotificationKind.COMMENT,
      articleSlug: 'article-slug',
    });
    expect(emitSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('two sequential upsertGroup calls → total emit count ≥ 4 (4 individual + 2 fallback unread per ops)', async () => {
    const { agg, emitSpy } = makeEnv();
    const userId = 'u-user-1111-2222-3333-444444444444';
    await agg.upsertGroup({
      notificationId: 'n1',
      userId,
      actorId: 'a-actor-1111-2222-3333-444444444444',
      kind: NotificationKind.LIKE,
      articleSlug: 'x',
    });
    const afterUpsert1 = emitSpy.mock.calls.length;
    expect(afterUpsert1).toBeGreaterThanOrEqual(2);

    await agg.upsertGroup({
      notificationId: 'n2',
      userId,
      actorId: 'a-actor-9999-8888-7777-666666666666',
      kind: NotificationKind.COMMENT,
      articleSlug: 'y',
    });
    const afterUpsert2 = emitSpy.mock.calls.length;
    // Second upsertGroup adds at minimum 2 more (created + unread fallback)
    expect(afterUpsert2 - afterUpsert1).toBeGreaterThanOrEqual(2);
    expect(afterUpsert2).toBeGreaterThanOrEqual(4);
  });
});
