import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { UpdatePrefsDto } from '../src/modules/activity/activity.dto';

/**
 * DTO decorator for activityReminderEveryMinutes:
 *   @IsOptional() @IsInt() @Min(0) @Max(1440 * 30)
 * Therefore negative values fail with @Min(0) constraint.
 */
describe('UpdatePrefsDto activityReminderEveryMinutes @Min(0)', () => {
  it('value -15 → @Min(0) validation fails (1+ errors)', () => {
    const obj = plainToInstance(UpdatePrefsDto, { activityReminderEveryMinutes: -15 });
    const errors = validateSync(obj);
    expect(errors.length).toBeGreaterThanOrEqual(1);
    const cadenceErr = errors.find((e) => e.property === 'activityReminderEveryMinutes');
    expect(cadenceErr).toBeDefined();
    expect(cadenceErr!.constraints?.min).toBeDefined();
  });

  it('value 0 → ok (legal @Min(0) boundary)', () => {
    const obj = plainToInstance(UpdatePrefsDto, { activityReminderEveryMinutes: 0 });
    const errors = validateSync(obj);
    expect(errors.length).toBe(0);
  });

  it('value 15 → ok (normal cadence)', () => {
    const obj = plainToInstance(UpdatePrefsDto, { activityReminderEveryMinutes: 15 });
    expect(validateSync(obj).length).toBe(0);
  });

  it('value 43201 = Max(43200) + 1 → fails @Max', () => {
    const obj = plainToInstance(UpdatePrefsDto, { activityReminderEveryMinutes: 43201 });
    const errors = validateSync(obj);
    expect(errors.length).toBeGreaterThanOrEqual(1);
    const cadenceErr = errors.find((e) => e.property === 'activityReminderEveryMinutes');
    expect(cadenceErr?.constraints?.max).toBeDefined();
  });
});
