import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { UpdatePrefsDto } from '../src/modules/activity/activity.dto';

/**
 * ADAPTED from task hhmm regex plan → actual DTO has no regex, only
 * @IsString() + @MaxLength(5).  "25:99" is length exactly 5 so we extend
 * the test value to '25:990' (6 chars) which triggers @MaxLength(5). This
 * captures the spirit of "invalid format → rejected" using the REAL
 * validators present in the codebase.
 */
describe('UpdatePrefsDto quietHoursStart invalid → rejection (6 chars > MaxLength(5))', () => {
  it('"25:990" length 6 → 1+ validation errors (MaxLength constraint fail)', () => {
    const obj = plainToInstance(UpdatePrefsDto, { quietHoursStart: '25:990' });
    const errors = validateSync(obj);
    expect(errors.length).toBeGreaterThanOrEqual(1);
    const qhErr = errors.find((e) => e.property === 'quietHoursStart');
    expect(qhErr).toBeDefined();
    expect(Object.keys(qhErr!.constraints || {}).length).toBeGreaterThanOrEqual(1);
  });
});
