import { ApiKeyGuard } from '../src/modules/auth/api-key.guard';

/**
 * ApiKeyGuard.canActivate(req) — pure unit, NO Nest DI.
 * Env var name: ACTIVITY_WEBHOOK_API_KEY (api-key.guard.ts L15).
 * When env var is empty / unset → guard returns false (safe-by-default).
 */
describe('ApiKeyGuard when ACTIVITY_WEBHOOK_API_KEY env var is missing/empty', () => {
  const orig = process.env.ACTIVITY_WEBHOOK_API_KEY;

  function ctxMock(req: Partial<{ headers: any; query: any }>) {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: req.headers ?? {},
          query: req.query ?? {},
        }),
      }),
    } as any;
  }

  afterEach(() => {
    if (orig === undefined) delete process.env.ACTIVITY_WEBHOOK_API_KEY;
    else process.env.ACTIVITY_WEBHOOK_API_KEY = orig;
  });

  it('undefined env var → canActivate returns false (reject all)', () => {
    delete process.env.ACTIVITY_WEBHOOK_API_KEY;
    const g = new ApiKeyGuard();
    const res = g.canActivate(
      ctxMock({
        headers: { 'x-vell-webhook-key': 'anything-should-fail' },
        query: {},
      }),
    );
    expect(res).toBe(false);
  });

  it('empty string env var "" → canActivate returns false (length check)', () => {
    process.env.ACTIVITY_WEBHOOK_API_KEY = '';
    const g = new ApiKeyGuard();
    const res = g.canActivate(
      ctxMock({
        headers: { 'x-vell-webhook-key': '' },
        query: { key: '' },
      }),
    );
    expect(res).toBe(false);
  });

  it('no header no query key → returns false (no crash)', () => {
    delete process.env.ACTIVITY_WEBHOOK_API_KEY;
    const g = new ApiKeyGuard();
    expect(g.canActivate(ctxMock({}))).toBe(false);
  });
});
