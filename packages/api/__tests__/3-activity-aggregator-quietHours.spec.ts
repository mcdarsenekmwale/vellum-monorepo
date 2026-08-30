/**
 * The reminder service (activity-reminder.service.ts L36-L42) implements
 * quiet hours inline. There is no exported helper, so we extract the exact
 * algorithm here as a pure function for isolated unit testing.
 *
 * Algorithm from ActivityReminderService.runNudge:
 *   if (quietHoursStart < quietHoursEnd) {  // normal range e.g. 07:00–22:00
 *     nowHM inside [start, end] → SKIP
 *   } else {  // overnight wrap e.g. 22:00–07:00
 *     nowHM <= end OR nowHM >= start → SKIP
 *   }
 * "Inside quiet hours" => we return true; nudge is SKIPPED.
 */
function isInsideQuietHours(nowHM: string, quietHoursStart: string, quietHoursEnd: string): boolean {
  if (quietHoursStart < quietHoursEnd) {
    return nowHM >= quietHoursStart && nowHM <= quietHoursEnd;
  } else {
    return nowHM <= quietHoursEnd || nowHM >= quietHoursStart;
  }
}

describe('isInsideQuietHours pure function (mirrors activity-reminder.service L36-L42)', () => {
  it('normal overnight range 22:00-07:00: 02:00 is inside quiet hours (skip)', () => {
    expect(isInsideQuietHours('02:00', '22:00', '07:00')).toBe(true);
  });

  it('normal overnight range 22:00-07:00: 08:00 is outside (eligible for nudge)', () => {
    expect(isInsideQuietHours('08:00', '22:00', '07:00')).toBe(false);
  });

  it('daytime range 07:00-22:00: 13:00 is inside (skip)', () => {
    expect(isInsideQuietHours('13:00', '07:00', '22:00')).toBe(true);
  });

  it('boundary 00:00 edge with overnight 22:00-07:00 → inside', () => {
    expect(isInsideQuietHours('00:00', '22:00', '07:00')).toBe(true);
  });

  it('boundary 23:59 edge with overnight 22:00-07:00 → inside (>= start)', () => {
    expect(isInsideQuietHours('23:59', '22:00', '07:00')).toBe(true);
  });

  it('boundary: exactly equal to quietHoursStart daytime 07:00 → inside', () => {
    expect(isInsideQuietHours('07:00', '07:00', '22:00')).toBe(true);
  });

  it('boundary: exactly equal to quietHoursEnd daytime 22:00 → inside', () => {
    expect(isInsideQuietHours('22:00', '07:00', '22:00')).toBe(true);
  });
});
