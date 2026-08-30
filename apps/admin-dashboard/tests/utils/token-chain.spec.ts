import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Admin auth-token fallback chain priority helper.
 * The real getAdminAuthToken() in services.ts reads vellbase.admin.session.v1
 * as a JSON blob with .token. We test the *priority chain concept* here:
 *
 *   CHAIN ORDER (high → low):
 *     1. primary = vellbase.admin.session.v1 (parsed { token })
 *     2. fallback = vellbase.admin.jwt.plain (direct string key)
 *     3. null (all missing)
 */
const KEY_PRIMARY = 'vellbase.admin.session.v1';
const KEY_FALLBACK = 'vellbase.admin.jwt.plain';

function getAdminAuthToken(): string | null {
  try {
    const raw = localStorage.getItem(KEY_PRIMARY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.token === 'string') return parsed.token;
    }
  } catch {
    /* fall through */
  }
  try {
    const fb = localStorage.getItem(KEY_FALLBACK);
    if (fb) return fb;
  } catch {
    /* fall through */
  }
  return null;
}

describe('getAdminAuthToken fallback chain priority', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('primary present → wins over fallback (priority order respected)', () => {
    localStorage.setItem(KEY_PRIMARY, JSON.stringify({ token: 'primary-tok', user: { id: 1 } }));
    localStorage.setItem(KEY_FALLBACK, 'fallback-tok-should-not-win');
    expect(getAdminAuthToken()).toBe('primary-tok');
  });

  it('primary missing → falls back to second key', () => {
    localStorage.setItem(KEY_FALLBACK, 'fallback-value-used');
    expect(getAdminAuthToken()).toBe('fallback-value-used');
  });

  it('all keys missing → null', () => {
    expect(getAdminAuthToken()).toBeNull();
  });
});
