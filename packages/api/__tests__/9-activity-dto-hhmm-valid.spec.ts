import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { UpdatePrefsDto } from '../src/modules/activity/activity.dto';

/**
 * UpdatePrefsDto.quietHoursStart uses @IsString() + @MaxLength(5) only.
 * There is no @Matches regex validator in the actual DTO (see activity.dto.ts
 * L27). We therefore validate against the REAL implemented decorators.
 * Valid HH:MM like '07:00' → IsString passes, length=5 ≤ MaxLength passes →
 * 0 validation errors.
 */
describe('UpdatePrefsDto quietHoursStart valid hhmm "07:00"', () => {
  it('quietHoursStart "07:00" → validateSync returns 0 errors', () => {
    const obj = plainToInstance(UpdatePrefsDto, { quietHoursStart: '07:00' });
    const errors = validateSync(obj);
    expect(errors.length).toBe(0);
  });

  it('quietHoursStart "23:59" → valid (legal 24h range format, length ok)', () => {
    const obj = plainToInstance(UpdatePrefsDto, { quietHoursStart: '23:59' });
    expect(validateSync(obj).length).toBe(0);
  });

  it('quietHoursStart "00:00" midnight boundary → valid', () => {
    const obj = plainToInstance(UpdatePrefsDto, { quietHoursStart: '00:00' });
    expect(validateSync(obj).length).toBe(0);
  });
});
