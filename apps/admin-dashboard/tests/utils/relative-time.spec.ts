import { describe, it, expect } from 'vitest';

/**
 * relativeTime — converts seconds-ago duration to short human label.
 * No existing exported helper in admin-dashboard src. Implemented locally
 * matching standard conventions used in the app's inline timeAgo helpers.
 *
 * Ranges:
 *   < 60s → "just now"
 *   ≥ 60s, < 3600s → `${Math.floor(s / 60)}m`
 *   ≥ 3600s, < 86400s → `${Math.floor(s / 3600)}h`
 *   ≥ 86400s → `${Math.floor(s / 86400)}d`
 */
export function relativeTime(secondsAgo: number): string {
  const s = Math.max(0, Math.floor(secondsAgo));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

describe('relativeTime seconds → short label', () => {
  it('0s → "just now"', () => {
    expect(relativeTime(0)).toBe('just now');
  });

  it('65s → "1m" (floor 65/60 = 1)', () => {
    expect(relativeTime(65)).toBe('1m');
  });

  it('3601s → "1h" (floor(3601/3600) = 1)', () => {
    expect(relativeTime(3601)).toBe('1h');
  });

  it('90000s → "1d" (90000 / 86400 floor = 1)', () => {
    expect(relativeTime(90000)).toBe('1d');
  });
});
