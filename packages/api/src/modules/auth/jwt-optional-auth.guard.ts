import { Injectable, ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

/**
 * A variant of JwtAuthGuard that never throws 401 Unauthorized.
 * If a valid JWT is present (Authorization header or cookie), req.user
 * is populated exactly like JwtAuthGuard. If there is no JWT or the
 * token is malformed/expired, the request still proceeds with req.user
 * being undefined. Read-only public endpoints that enrich their
 * response with per-user state (liked, followed, etc.) can safely use
 * this guard.
 */
@Injectable()
export class OptionalJwtAuthGuard extends JwtAuthGuard {
  handleRequest<TUser = any>(err: any, user: any, info: any, context: ExecutionContext, status?: any): TUser {
    // Swallow errors; return user if present, otherwise undefined.
    if (err || !user) return undefined as TUser;
    return user;
  }
}
