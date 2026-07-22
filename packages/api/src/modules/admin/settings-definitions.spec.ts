import {
  SETTINGS_DEFINITIONS,
  SETTINGS_BY_CATEGORY,
  SETTINGS_VERSION,
  getSettingsForCategory,
  getSettingByKey,
  validateSettingValue,
  type SettingCategory,
} from './settings-definitions';

describe('settings-definitions', () => {
  /* ─── Static structure ─── */

  describe('SETTINGS_DEFINITIONS', () => {
    it('exports a non-empty array of definitions', () => {
      expect(Array.isArray(SETTINGS_DEFINITIONS)).toBe(true);
      expect(SETTINGS_DEFINITIONS.length).toBeGreaterThan(0);
    });

    it('every definition has a unique key', () => {
      const keys = SETTINGS_DEFINITIONS.map((d) => d.key);
      expect(new Set(keys).size).toBe(keys.length);
    });

    it('every definition has required fields with correct types', () => {
      for (const def of SETTINGS_DEFINITIONS) {
        expect(typeof def.key).toBe('string');
        expect(def.key.length).toBeGreaterThan(0);
        expect(typeof def.value).toBe('string');
        expect(typeof def.category).toBe('string');
        expect(typeof def.description).toBe('string');
        expect(['text', 'number', 'boolean', 'textarea', 'url', 'email', 'json']).toContain(def.type);
      }
    });

    it('every definition has a recognised category', () => {
      const validCategories: SettingCategory[] = [
        'general', 'branding', 'appearance', 'auth', 'security',
        'uploads', 'notifications', 'email', 'api', 'integrations',
        'localization', 'backups', 'ai',
      ];
      for (const def of SETTINGS_DEFINITIONS) {
        expect(validCategories).toContain(def.category);
      }
    });

    it('numeric-typed defaults are numeric strings', () => {
      for (const def of SETTINGS_DEFINITIONS.filter((d) => d.type === 'number')) {
        expect(Number.isFinite(Number(def.value))).toBe(true);
      }
    });

    it('boolean-typed defaults are "true" or "false"', () => {
      for (const def of SETTINGS_DEFINITIONS.filter((d) => d.type === 'boolean')) {
        expect(['true', 'false']).toContain(def.value);
      }
    });

    it('every definition with a pattern validates its own default value', () => {
      for (const def of SETTINGS_DEFINITIONS) {
        if (def.validation?.pattern) {
          const regex = new RegExp(def.validation.pattern);
          // Empty values are allowed to skip pattern checks for optionals
          if (def.value !== '') {
            expect(regex.test(def.value)).toBe(true);
          }
        }
      }
    });

    it('every definition with min/max bounds its own default value (numeric)', () => {
      for (const def of SETTINGS_DEFINITIONS.filter((d) => d.type === 'number')) {
        const numeric = Number(def.value);
        if (def.validation?.min !== undefined) {
          expect(numeric).toBeGreaterThanOrEqual(def.validation.min);
        }
        if (def.validation?.max !== undefined) {
          expect(numeric).toBeLessThanOrEqual(def.validation.max);
        }
      }
    });
  });

  describe('SETTINGS_VERSION', () => {
    it('is a positive integer', () => {
      expect(Number.isInteger(SETTINGS_VERSION)).toBe(true);
      expect(SETTINGS_VERSION).toBeGreaterThan(0);
    });
  });

  describe('SETTINGS_BY_CATEGORY', () => {
    it('contains an entry for every defined category', () => {
      const categories = new Set(SETTINGS_DEFINITIONS.map((d) => d.category));
      for (const category of categories) {
        expect(SETTINGS_BY_CATEGORY).toHaveProperty(category);
      }
    });

    it('partitions all definitions without dropping any', () => {
      const total = Object.values(SETTINGS_BY_CATEGORY).reduce(
        (sum, list) => sum + list.length,
        0,
      );
      expect(total).toBe(SETTINGS_DEFINITIONS.length);
    });
  });

  /* ─── getSettingsForCategory ─── */

  describe('getSettingsForCategory', () => {
    it('returns the definitions for a known category', () => {
      const result = getSettingsForCategory('general');
      expect(result.length).toBeGreaterThan(0);
      for (const def of result) {
        expect(def.category).toBe('general');
      }
    });

    it('returns the same reference as SETTINGS_BY_CATEGORY', () => {
      expect(getSettingsForCategory('security')).toBe(SETTINGS_BY_CATEGORY.security);
    });

    it('returns an empty array for an unknown category', () => {
      // Cast to bypass the typed argument; the function should still be defensive.
      expect(getSettingsForCategory('unknown' as SettingCategory)).toEqual([]);
    });
  });

  /* ─── getSettingByKey ─── */

  describe('getSettingByKey', () => {
    it('returns the matching definition for a known key', () => {
      const first = SETTINGS_DEFINITIONS[0];
      const result = getSettingByKey(first.key);
      expect(result).not.toBeNull();
      expect(result?.key).toBe(first.key);
    });

    it('returns null for an unknown key', () => {
      expect(getSettingByKey('does.not.exist')).toBeNull();
    });

    it('returns null for an empty key', () => {
      expect(getSettingByKey('')).toBeNull();
    });
  });

  /* ─── validateSettingValue ─── */

  describe('validateSettingValue', () => {
    it('rejects an unknown setting key', () => {
      const result = validateSettingValue('not.a.real.key', 'anything');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unknown setting key');
    });

    describe('required rule', () => {
      it('rejects empty values for required settings', () => {
        const result = validateSettingValue('workspace.name', '');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('required');
      });

      it('rejects whitespace-only values for required settings', () => {
        const result = validateSettingValue('workspace.name', '   ');
        expect(result.valid).toBe(false);
      });

      it('accepts non-empty values for required settings', () => {
        const result = validateSettingValue('workspace.name', 'My Workspace');
        expect(result.valid).toBe(true);
      });
    });

    describe('boolean type', () => {
      it('accepts "true"', () => {
        expect(validateSettingValue('maintenance.mode', 'true').valid).toBe(true);
      });

      it('accepts "false"', () => {
        expect(validateSettingValue('maintenance.mode', 'false').valid).toBe(true);
      });

      it('accepts "TRUE" case-insensitively', () => {
        expect(validateSettingValue('maintenance.mode', 'TRUE').valid).toBe(true);
      });

      it('rejects arbitrary text', () => {
        const result = validateSettingValue('maintenance.mode', 'yes');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('boolean');
      });
    });

    describe('number type', () => {
      it('accepts valid integers within bounds', () => {
        expect(validateSettingValue('auth.session_timeout', '3600').valid).toBe(true);
      });

      it('accepts valid decimals within bounds', () => {
        expect(validateSettingValue('ai.confidence_threshold', '0.5').valid).toBe(true);
      });

      it('rejects non-numeric strings', () => {
        const result = validateSettingValue('auth.session_timeout', 'abc');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('valid number');
      });

      it('rejects values below the minimum', () => {
        const result = validateSettingValue('auth.session_timeout', '1');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('greater than or equal to');
      });

      it('rejects values above the maximum', () => {
        const result = validateSettingValue('auth.session_timeout', '99999999');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('less than or equal to');
      });
    });

    describe('string length rules', () => {
      it('rejects strings shorter than min', () => {
        const result = validateSettingValue('workspace.name', '');
        expect(result.valid).toBe(false);
      });

      it('rejects strings longer than max', () => {
        const result = validateSettingValue('workspace.name', 'x'.repeat(101));
        expect(result.valid).toBe(false);
        expect(result.error).toContain('at most');
      });

      it('accepts strings within bounds', () => {
        const result = validateSettingValue('workspace.name', 'Vellum');
        expect(result.valid).toBe(true);
      });
    });

    describe('pattern rules', () => {
      it('accepts values matching the pattern', () => {
        expect(validateSettingValue('branding.primary_color', '#6366f1').valid).toBe(true);
        expect(validateSettingValue('branding.primary_color', '#fff').valid).toBe(true);
      });

      it('rejects values that do not match the pattern', () => {
        const result = validateSettingValue('branding.primary_color', 'blue');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('does not match');
      });

      it('accepts a valid language code', () => {
        expect(validateSettingValue('workspace.language', 'en').valid).toBe(true);
        expect(validateSettingValue('workspace.language', 'en-US').valid).toBe(true);
      });

      it('rejects an invalid language code', () => {
        expect(validateSettingValue('workspace.language', 'english').valid).toBe(false);
      });
    });

    describe('optional (no required rule) settings', () => {
      it('accepts empty values when not required', () => {
        const result = validateSettingValue('branding.logo_url', '');
        expect(result.valid).toBe(true);
      });
    });
  });
});
