import { isInsideQuietHours } from '../../src/modules/activity/activity-reminder.service';

describe('5 — Quiet hours overnight wrap: mocked UTC times', () => {
  const qStart = '22:00';
  const qEnd   = '08:00';

  afterEach(() => {
    jest.useRealTimers();
  });

  it('UTC 03:30 (inside 22:00–08:00 overnight window) → isInsideQuietHours returns true (skip)', () => {
    // Use fake timers set to UTC 03:30 on an arbitrary date
    // 2026-08-31T03:30:00.000Z = 03:30 UTC
    const d = new Date(Date.UTC(2026, 7, 31, 3, 30, 0, 0));
    jest.useFakeTimers();
    jest.setSystemTime(d.getTime());

    // nowHM from UTC time = '03:30'
    const nowHM = new Date().toTimeString().slice(0, 5);
    // toTimeString() uses LOCAL timezone. Force UTC extraction to be explicit:
    const hh = d.getUTCHours().toString().padStart(2, '0');
    const mm = d.getUTCMinutes().toString().padStart(2, '0');
    const nowUTC = `${hh}:${mm}`;

    expect(nowUTC).toBe('03:30');

    // 03:30 <= qEnd('08:00') → overnight branch returns true (inside QH)
    const inside = isInsideQuietHours(nowUTC, qStart, qEnd);
    expect(inside).toBe(true); // skip notifications
  });

  it('UTC 14:00 (afternoon, well outside 22:00–08:00 wrap) → returns false (ALLOW)', () => {
    const d = new Date(Date.UTC(2026, 7, 31, 14, 0, 0, 0));
    jest.useFakeTimers();
    jest.setSystemTime(d.getTime());

    const hh = d.getUTCHours().toString().padStart(2, '0');
    const mm = d.getUTCMinutes().toString().padStart(2, '0');
    const nowUTC = `${hh}:${mm}`;
    expect(nowUTC).toBe('14:00');

    // 14:00 is NOT >= '22:00' AND NOT <= '08:00' → outside quiet hours
    const inside = isInsideQuietHours(nowUTC, qStart, qEnd);
    expect(inside).toBe(false); // allow notifications (no skip)
  });

  it('Boundary: exactly 22:00 UTC (start) → inside=true', () => {
    const d = new Date(Date.UTC(2026, 7, 31, 22, 0, 0, 0));
    jest.useFakeTimers();
    jest.setSystemTime(d.getTime());
    const nowUTC = '22:00';
    expect(isInsideQuietHours(nowUTC, qStart, qEnd)).toBe(true);
  });

  it('Boundary: exactly 08:00 UTC (end) → inside=true', () => {
    jest.useFakeTimers();
    const nowUTC = '08:00';
    expect(isInsideQuietHours(nowUTC, qStart, qEnd)).toBe(true);
  });

  it('Boundary: 08:01 UTC (just after end) → outside=false allow', () => {
    jest.useFakeTimers();
    const nowUTC = '08:01';
    expect(isInsideQuietHours(nowUTC, qStart, qEnd)).toBe(false);
  });

  it('Boundary: 21:59 UTC (just before start) → outside=false allow', () => {
    jest.useFakeTimers();
    const nowUTC = '21:59';
    expect(isInsideQuietHours(nowUTC, qStart, qEnd)).toBe(false);
  });
});
