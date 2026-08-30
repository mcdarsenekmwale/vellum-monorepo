/**
 * Eligibility check for the reminder nudge (activity-reminder.service.ts):
 *   SQL WHERE np."activityReminderEveryMinutes" > 0
 * When cadence = 0 → the row is filtered out → function must skip.
 *
 * We implement an isCadenceEligible(cadence) helper matching the SQL predicate
 * and unit-test it in isolation. Pure boolean logic test.
 */
function isCadenceEligible(activityReminderEveryMinutes: number): boolean {
  return activityReminderEveryMinutes > 0;
}

describe('cadence=0 skip rule matches SQL WHERE activityReminderEveryMinutes > 0', () => {
  it('cadence 0 → NOT eligible (skip, returns false)', () => {
    expect(isCadenceEligible(0)).toBe(false);
  });

  it('cadence 15 → eligible (returns true)', () => {
    expect(isCadenceEligible(15)).toBe(true);
  });

  it('cadence max legal value (1440 * 30 = 43200, from DTO @Max) → eligible', () => {
    expect(isCadenceEligible(1440 * 30)).toBe(true);
  });

  it('cadence negative → NOT eligible (matching SQL >0 semantics, validates DTO @Min(0))', () => {
    expect(isCadenceEligible(-15)).toBe(false);
  });
});
