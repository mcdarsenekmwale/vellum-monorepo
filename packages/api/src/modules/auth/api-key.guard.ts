import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';

/**
 * Guards webhook-inbound endpoints with a static header key.
 * When env ACTIVITY_WEBHOOK_API_KEY is empty → rejects all calls (safe-by-default).
 * Admin simulator bypasses this guard by calling aggregator service directly through
 * a separate unguarded internal endpoint or admin-scope route guarded by AdminGuard instead.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const header = (req.headers['x-vell-webhook-key'] as string) || (req.query.key as string);
    const expected = process.env.ACTIVITY_WEBHOOK_API_KEY;
    if (!expected || expected.length === 0) return false;
    return !!header && header === expected;
  }
}
