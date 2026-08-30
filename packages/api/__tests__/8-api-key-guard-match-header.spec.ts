import { ApiKeyGuard } from '../src/modules/auth/api-key.guard';

/**
 * Header name = x-vell-webhook-key (lowercase x, api-key.guard.ts L14).
 * Also accepts query param ?key as fallback (L14).
 * Env var name: ACTIVITY_WEBHOOK_API_KEY set to 'secretA'.
 */
describe('ApiKeyGuard header match (env ACTIVITY_WEBHOOK_API_KEY=secretA)', () => {
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

  beforeEach(() => {
    process.env.ACTIVITY_WEBHOOK_API_KEY = 'secretA';
  });
  afterEach(() => {
    delete process.env.ACTIVITY_WEBHOOK_API_KEY;
  });

  it('header x-vell-webhook-key = secretA → canActivate true', () => {
    const g = new ApiKeyGuard();
    const res = g.canActivate(
      ctxMock({ headers: { 'x-vell-webhook-key': 'secretA' }, query: {} }),
    );
    expect(res).toBe(true);
  });

  it('header x-vell-webhook-key = bad → canActivate false', () => {
    const g = new ApiKeyGuard();
    const res = g.canActivate(
      ctxMock({ headers: { 'x-vell-webhook-key': 'bad' }, query: {} }),
    );
    expect(res).toBe(false);
  });

  it('fallback query ?key=secretA → true (alternative to header)', () => {
    const g = new ApiKeyGuard();
    const res = g.canActivate(ctxMock({ headers: {}, query: { key: 'secretA' } }));
    expect(res).toBe(true);
  });

  it('no header no query → false', () => {
    const g = new ApiKeyGuard();
    expect(g.canActivate(ctxMock({}))).toBe(false);
  });
});
