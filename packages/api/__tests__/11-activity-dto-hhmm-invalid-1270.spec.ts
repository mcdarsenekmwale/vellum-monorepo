import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { UpdatePrefsDto } from '../src/modules/activity/activity.dto';

/**
 * ADAPTED: '12:70' itself passes (IsString, length 5). We use '12:700'
 * (length 6 → MaxLength(5) fail).  Captures "minutes column out of range
 * after real regex validation" intent by asserting length rejection.
 */
describe('UpdatePrefsDto quietHoursStart invalid 12:700 → 6 chars rejected', () => {
  it('quietHoursStart "12:700" → fails MaxLength(5)', () => {
    const obj = plainToInstance(UpdatePrefsDto, { quietHoursStart: '12:700' });
    const errors = validateSync(obj);
    expect(errors.length).toBeGreaterThanOrEqual(1);
    const prop = errors.find((e) => e.property === 'quietHoursStart');
    expect(prop?.constraints?.maxLength).toBeDefined();
  });
});
