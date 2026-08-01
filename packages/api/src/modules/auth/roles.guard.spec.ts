import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from './roles.decorator';

describe('RolesGuard — Security', () => {
  let guard: RolesGuard;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        RolesGuard,
        { provide: Reflector, useValue: { getAllAndOverride: jest.fn() } },
      ],
    }).compile();
    guard = module.get(RolesGuard);
    reflector = module.get(Reflector);
  });

  function makeContext(user: any, handler: any = jest.fn(), classRef: any = jest.fn()): ExecutionContext {
    return {
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
      getHandler: () => handler,
      getClass: () => classRef,
    } as any;
  }

  it('allows access when no roles are required (open endpoint)', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    expect(guard.canActivate(makeContext({ role: Role.USER }))).toBe(true);
  });

  it('throws ForbiddenException when the request has no authenticated user', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.USER]);
    expect(() => guard.canActivate(makeContext(undefined))).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when user.role is missing', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.USER]);
    expect(() => guard.canActivate(makeContext({ id: 'u1' }))).toThrow(ForbiddenException);
  });

  it('allows access when the user has the exact required role', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.USER]);
    expect(guard.canActivate(makeContext({ role: Role.USER }))).toBe(true);
  });

  it('allows access when the user has a higher role than required (role hierarchy)', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.USER]);
    expect(guard.canActivate(makeContext({ role: Role.ADMIN }))).toBe(true);
    expect(guard.canActivate(makeContext({ role: Role.MODERATOR }))).toBe(true);
    expect(guard.canActivate(makeContext({ role: Role.CREATOR }))).toBe(true);
  });

  it('denies access when the user has a lower role than required', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);
    expect(() => guard.canActivate(makeContext({ role: Role.USER }))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(makeContext({ role: Role.MODERATOR }))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(makeContext({ role: Role.CREATOR }))).toThrow(ForbiddenException);
  });

  it('allows ADMIN to access MODERATOR-only routes', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.MODERATOR]);
    expect(guard.canActivate(makeContext({ role: Role.ADMIN }))).toBe(true);
  });

  it('does not leak the user role or required roles to the client', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);
    let caught: any;
    try {
      guard.canActivate(makeContext({ role: Role.USER }));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ForbiddenException);
    const msg = caught.message as string;
    expect(msg).toContain('Insufficient permissions');
    // The message must NOT echo back role values (no reconnaissance aid)
    expect(msg).not.toContain('USER');
    expect(msg).not.toContain('ADMIN');
    expect(msg).not.toContain('your role');
    expect(msg).not.toContain('Required role');
  });
});
