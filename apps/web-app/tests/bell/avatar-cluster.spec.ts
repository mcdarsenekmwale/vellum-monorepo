import { describe, it, expect } from 'vitest';

/**
 * AvatarCluster overlap pill-bubble logic (mirrors web-activity-card.tsx).
 * Component rule:
 *   - Show up to first 5 avatars (slice 0..5)
 *   - When total actors > 5 → render a "+N" pill bubble with N = count - 5
 *   - Otherwise (N ≤ 5) no pill bubble is rendered
 *
 * We return a pure logic structure { shownCount, pillExtra } suitable for
 * testing without needing React/JSDOM renders.
 */
export interface AvatarClusterLayout {
  shownCount: number;
  pillExtra: number | null; // null = no pill rendered, else the +N number
}

export function computeAvatarCluster(totalActors: number): AvatarClusterLayout {
  if (totalActors <= 5) {
    return { shownCount: Math.max(0, totalActors), pillExtra: null };
  }
  return { shownCount: 5, pillExtra: totalActors - 5 };
}

describe('avatar cluster overlap: pill bubble +N show rules', () => {
  it('N=1 → 1 avatar shown, NO pill bubble', () => {
    const r = computeAvatarCluster(1);
    expect(r.shownCount).toBe(1);
    expect(r.pillExtra).toBeNull();
  });

  it('N=5 → 5 avatars shown, NO pill bubble (boundary)', () => {
    const r = computeAvatarCluster(5);
    expect(r.shownCount).toBe(5);
    expect(r.pillExtra).toBeNull();
  });

  it('N=6 → 5 avatars + pill bubble +1 shown', () => {
    const r = computeAvatarCluster(6);
    expect(r.shownCount).toBe(5);
    expect(r.pillExtra).toBe(1);
  });

  it('N=103 → 5 +98 pill bubble (extra actor count)', () => {
    const r = computeAvatarCluster(103);
    expect(r.shownCount).toBe(5);
    expect(r.pillExtra).toBe(98);
  });
});
