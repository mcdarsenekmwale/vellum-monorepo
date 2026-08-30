import { ActivityAggregatorService } from '../src/modules/activity/activity-aggregator.service';
import { NotificationKind } from '@prisma/client';

/**
 * EventEmitter2 spy Jest pattern: jest.spyOn(emitter, 'emit').mockImplementation(() => true).
 * We use a plain { emit: () => true } object since the aggregator only calls .emit().
 */
describe('ActivityAggregatorService sse.activity.created event on upsertGroup', () => {
  function makeEnv() {
    const prisma: any = {
      notificationPreferences: {
        findFirst: jest.fn().mockResolvedValue({ groupLikes: true, groupComments: true, groupFollows: true }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ handle: 'bob', name: 'Bob' }),
      },
      $executeRawUnsafe: jest.fn().mockResolvedValue(1),
      activityItem: { count: jest.fn().mockResolvedValue(3) },
    };
    const events: { emit: (...a: any[]) => boolean } = { emit: () => true };
    const emitSpy = jest.spyOn(events, 'emit').mockImplementation(() => true);
    const agg = new ActivityAggregatorService(prisma, events as any);
    return { prisma, events, emitSpy, agg };
  }

  it('upsertGroup emits event name starting with "sse.activity.created." + userId', async () => {
    const { agg, emitSpy } = makeEnv();
    const userId = 'u-1000-0000-0000-0000-000000000001';
    await agg.upsertGroup({
      notificationId: 'n1',
      userId,
      actorId: 'a-2000-0000-0000-0000-000000000002',
      kind: NotificationKind.LIKE,
      articleSlug: 'post-1',
    });

    expect(emitSpy).toHaveBeenCalled();
    const createdCalls = emitSpy.mock.calls.filter(
      (c) => typeof c[0] === 'string' && c[0].startsWith('sse.activity.created.'),
    );
    expect(createdCalls.length).toBeGreaterThanOrEqual(1);
    const evName = createdCalls[0][0] as string;
    expect(evName).toBe('sse.activity.created.' + userId);
  });

  it('upsertGroup sse.created payload includes { userId, kind, id: groupingKey } shape', async () => {
    const { agg, emitSpy } = makeEnv();
    const userId = 'u-1000-0000-0000-0000-000000000001';
    await agg.upsertGroup({
      notificationId: 'n1',
      userId,
      actorId: 'a-2000-0000-0000-0000-000000000002',
      kind: NotificationKind.FOLLOW,
    });

    const createdCall = emitSpy.mock.calls.find(
      (c) => typeof c[0] === 'string' && c[0].startsWith('sse.activity.created.'),
    );
    expect(createdCall).toBeDefined();
    const payload = createdCall![1] as Record<string, any>;
    expect(payload.userId).toBe(userId);
    expect(payload.kind).toBe(NotificationKind.FOLLOW);
    expect(typeof payload.id).toBe('string');
  });
});
