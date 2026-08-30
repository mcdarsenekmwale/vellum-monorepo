import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Web-app bell token chain priority (matches Sub-project B task rule):
 *   vellbase_access_token  >  vellbase.token  >  authToken  >  null
 *
 * Higher-priority key MUST win even when lower keys are also present.
 * We use a pure function that reads from the passed-like storage map so
 * tests don't need jsdom, but we also exercise the jsdom localStorage
 * via the real chain helper below.
 */
const K1 = 'vellbase_access_token';
const K2 = 'vellbase.token';
const K3 = 'authToken';

export function resolveBellToken(storage: Map<string, string> | Storage): string | null {
  const g = (k: string) => {
    try {
      return storage instanceof Map ? storage.get(k) ?? null : storage.getItem(k);
    } catch {
      return null;
    }
  };
  return g(K1) || g(K2) || g(K3) || null;
}

describe('bell token chain: vellbase_access_token > vellbase.token > authToken > null', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('vellbase_access_token present → wins over all lower keys', () => {
    localStorage.setItem(K1, 'k1-wins');
    localStorage.setItem(K2, 'k2-loser');
    localStorage.setItem(K3, 'k3-loser');
    expect(resolveBellToken(localStorage)).toBe('k1-wins');
  });

  it('vellbase_access_token missing, vellbase.token present → vellbase.token wins (not authToken)', () => {
    localStorage.setItem(K2, 'k2-wins');
    localStorage.setItem(K3, 'k3-loser');
    expect(resolveBellToken(localStorage)).toBe('k2-wins');
  });

  it('vellbase_access_token AND vellbase.token missing → authToken wins if present, else null', () => {
    localStorage.setItem(K3, 'k3-wins-only-when-others-absent');
    expect(resolveBellToken(localStorage)).toBe('k3-wins-only-when-others-absent');
    localStorage.removeItem(K3);
    expect(resolveBellToken(localStorage)).toBeNull();
  });
});
