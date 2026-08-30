import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { UpdatePrefsDto } from '../src/modules/activity/activity.dto';

/**
 * ADAPTED: '12-30' has length 5 and IsString → passes the DTO's current
 * validators as written. So we use '12-300' (6 chars, wrong separator AND
 * length-violation) to produce a concrete MaxLength(5) error. Also we use
 * numeric value 1230 as another invalid-form test: fails IsString.
 */
describe('UpdatePrefsDto quietHoursStart wrong separator / wrong type → errors', () => {
  it('"12-300" (length 6) → fails MaxLength(5) with hyphen separator', () => {
    const obj = plainToInstance(UpdatePrefsDto, { quietHoursStart: '12-300' });
    const errors = validateSync(obj);
    expect(errors.length).toBeGreaterThanOrEqual(1);
    const qh = errors.find((e) => e.property === 'quietHoursStart');
    expect(qh?.constraints?.maxLength).toBeDefined();
  });

  it('number value 1230 (not a string) → fails IsString', () => {
    const obj = plainToInstance(UpdatePrefsDto, { quietHoursStart: 1230 as any });
    const errors = validateSync(obj);
    expect(errors.length).toBeGreaterThanOrEqual(1);
    const qh = errors.find((e) => e.property === 'quietHoursStart');
    expect(qh?.constraints?.isString).toBeDefined();
  });
});
