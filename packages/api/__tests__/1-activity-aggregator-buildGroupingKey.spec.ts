import { ActivityAggregatorService } from '../src/modules/activity/activity-aggregator.service';
import { NotificationKind } from '@prisma/client';

/**
 * buildGroupingKey is declared public — no (agg as any) cast required.
 * Constructor param names: prisma + events — we pass null mocks, only test pure method.
 */
function makeAggregator(): ActivityAggregatorService {
  return new ActivityAggregatorService(null as any, null as any);
}

describe('ActivityAggregatorService.buildGroupingKey', () => {
  const agg = makeAggregator();

  it('LIKE stable key per article slug — same slug => same key across calls', () => {
    const k1 = agg.buildGroupingKey(NotificationKind.LIKE, { articleSlug: 'hello-world', highlightId: null, commentId: null });
    const k2 = agg.buildGroupingKey(NotificationKind.LIKE, { articleSlug: 'hello-world', highlightId: null, commentId: null });
    expect(k1).toBe(k2);
    expect(k1).toContain('LIKE:article:hello-world');
  });

  it('COMMENT collapses per article-level (articleSlug) into one group', () => {
    const k = agg.buildGroupingKey(NotificationKind.COMMENT, { articleSlug: 'how-to-code', highlightId: null, commentId: null });
    expect(k).toContain('COMMENT:article:how-to-code');
    // No comment thread suffix means article-level grouping
    expect(k).not.toContain('comment-thread');
  });

  it('FOLLOW is grouped under actor:batch namespace per-user aggregator', () => {
    const k = agg.buildGroupingKey(NotificationKind.FOLLOW, { articleSlug: null, highlightId: null, commentId: null });
    expect(k).toMatch(/^FOLLOW:actor:batch-\d+$/);
  });

  it('SHARE includes article slug in the grouping key', () => {
    const k = agg.buildGroupingKey(NotificationKind.SHARE, { articleSlug: 'slug-a', highlightId: null, commentId: null });
    expect(k).toBe('SHARE:article:slug-a');
    const kb = agg.buildGroupingKey(NotificationKind.SHARE, { articleSlug: 'slug-b', highlightId: null, commentId: null });
    expect(kb).toBe('SHARE:article:slug-b');
    expect(k).not.toBe(kb);
  });
});
