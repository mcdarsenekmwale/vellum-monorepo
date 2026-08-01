import { ExecutionContext } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AdminGuard } from './admin.guard';

describe('AdminGuard — Security', () => {
  let guard: AdminGuard;

  beforeEach(() => {
    guard = new AdminGuard();
  });

  function makeContext(user: any): ExecutionContext {
    return {
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    } as any;
  }

  it('allows access when the user has the ADMIN role', () => {
    expect(guard.canActivate(makeContext({ role: Role.ADMIN }))).toBe(true);
  });

  it('denies access for MODERATOR', () => {
    expect(guard.canActivate(makeContext({ role: Role.MODERATOR }))).toBe(false);
  });

  it('denies access for CREATOR', () => {
    expect(guard.canActivate(makeContext({ role: Role.CREATOR }))).toBe(false);
  });

  it('denies access for USER', () => {
    expect(guard.canActivate(makeContext({ role: Role.USER }))).toBe(false);
  });

  it('denies access for GUEST', () => {
    expect(guard.canActivate(makeContext({ role: Role.GUEST }))).toBe(false);
  });

  it('denies access when there is no authenticated user', () => {
    expect(guard.canActivate(makeContext(undefined))).toBe(false);
  });

  it('denies access when the user object has no role property', () => {
    expect(guard.canActivate(makeContext({ id: 'u1' }))).toBe(false);
  });

  it('denies access when the role is a string but not exactly "ADMIN"', () => {
    // Defense against string comparison pitfalls — must be exact role enum match
    expect(guard.canActivate(makeContext({ role: 'admin' }))).toBe(false); // lowercase
    expect(guard.canActivate(makeContext({ role: 'Administrator' }))).toBe(false);
  });
});
