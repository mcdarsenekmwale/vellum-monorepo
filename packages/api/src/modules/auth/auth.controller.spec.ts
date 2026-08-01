import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { Role } from '@prisma/client';

describe('AuthController — Cookie Security (CSRF/XSS)', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;
  let configService: jest.Mocked<ConfigService>;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            register: jest.fn(),
            login: jest.fn(),
            refreshToken: jest.fn(),
            logout: jest.fn(),
            forgotPassword: jest.fn(),
            resetPassword: jest.fn(),
            verifyEmail: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: { user: { findUnique: jest.fn() } },
        },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    controller = module.get(AuthController);
    authService = module.get(AuthService);
    configService = module.get(ConfigService);
    prisma = module.get(PrismaService);
  });

  function makeResponse(): Response {
    return {
      cookie: jest.fn(),
      clearCookie: jest.fn(),
    } as unknown as Response;
  }

  describe('getCookieOptions — production', () => {
    beforeEach(() => {
      configService.get.mockImplementation((key: string, fallback?: any) => {
        if (key === 'NODE_ENV') return 'production';
        if (key === 'JWT_ACCESS_TOKEN_EXPIRES_IN') return '15m';
        return fallback;
      });
    });

    it('sets httpOnly=true to prevent JavaScript access (XSS token theft)', async () => {
      authService.login.mockResolvedValue({
        user: { id: 'u1' } as any,
        accessToken: 'at',
        refreshToken: 'rt',
        expiresIn: 900,
      });
      const res = makeResponse();
      await controller.login({ email: 'a@b.com', password: 'p' } as any, res);

      const accessCookie = (res.cookie as jest.Mock).mock.calls.find(
        (c) => c[0] === 'access_token'
      );
      expect(accessCookie[1]).toBe('at');
      expect(accessCookie[2].httpOnly).toBe(true);

      const refreshCookie = (res.cookie as jest.Mock).mock.calls.find(
        (c) => c[0] === 'refresh_token'
      );
      expect(refreshCookie[2].httpOnly).toBe(true);
    });

    it('sets secure=true in production (HTTPS-only cookies)', async () => {
      authService.login.mockResolvedValue({
        user: { id: 'u1' } as any,
        accessToken: 'at',
        refreshToken: 'rt',
        expiresIn: 900,
      });
      const res = makeResponse();
      await controller.login({ email: 'a@b.com', password: 'p' } as any, res);

      const accessCookie = (res.cookie as jest.Mock).mock.calls.find(
        (c) => c[0] === 'access_token'
      );
      expect(accessCookie[2].secure).toBe(true);
    });

    it('sets sameSite=strict in production (CSRF protection)', async () => {
      authService.login.mockResolvedValue({
        user: { id: 'u1' } as any,
        accessToken: 'at',
        refreshToken: 'rt',
        expiresIn: 900,
      });
      const res = makeResponse();
      await controller.login({ email: 'a@b.com', password: 'p' } as any, res);

      const accessCookie = (res.cookie as jest.Mock).mock.calls.find(
        (c) => c[0] === 'access_token'
      );
      expect(accessCookie[2].sameSite).toBe('strict');
    });

    it('sets a longer maxAge for refresh tokens than access tokens', async () => {
      authService.login.mockResolvedValue({
        user: { id: 'u1' } as any,
        accessToken: 'at',
        refreshToken: 'rt',
        expiresIn: 900,
      });
      const res = makeResponse();
      await controller.login({ email: 'a@b.com', password: 'p' } as any, res);

      const accessCookie = (res.cookie as jest.Mock).mock.calls.find(
        (c) => c[0] === 'access_token'
      );
      const refreshCookie = (res.cookie as jest.Mock).mock.calls.find(
        (c) => c[0] === 'refresh_token'
      );
      expect(refreshCookie[2].maxAge).toBeGreaterThan(accessCookie[2].maxAge);
      // Refresh = 7 days, access = 15 minutes
      expect(refreshCookie[2].maxAge).toBe(7 * 24 * 60 * 60 * 1000);
    });
  });

  describe('getCookieOptions — development', () => {
    beforeEach(() => {
      configService.get.mockImplementation((key: string, fallback?: any) => {
        if (key === 'NODE_ENV') return 'development';
        if (key === 'JWT_ACCESS_TOKEN_EXPIRES_IN') return '15m';
        return fallback;
      });
    });

    it('allows lax sameSite in development for cross-origin dev servers', async () => {
      authService.login.mockResolvedValue({
        user: { id: 'u1' } as any,
        accessToken: 'at',
        refreshToken: 'rt',
        expiresIn: 900,
      });
      const res = makeResponse();
      await controller.login({ email: 'a@b.com', password: 'p' } as any, res);

      const accessCookie = (res.cookie as jest.Mock).mock.calls.find(
        (c) => c[0] === 'access_token'
      );
      expect(accessCookie[2].sameSite).toBe('lax');
      expect(accessCookie[2].secure).toBe(false);
      expect(accessCookie[2].httpOnly).toBe(true); // still httpOnly in dev
    });
  });

  describe('logout clears both cookies', () => {
    it('clears access_token and refresh_token cookies on logout', async () => {
      authService.logout.mockResolvedValue(undefined);
      const res = makeResponse();
      await controller.logout({ user: { id: 'u1' } } as any, res);

      const clearedNames = (res.clearCookie as jest.Mock).mock.calls.map((c) => c[0]);
      expect(clearedNames).toContain('access_token');
      expect(clearedNames).toContain('refresh_token');
    });
  });

  describe('getMe — sensitive field handling', () => {
    it('never returns passwordHash, resetToken, or verificationToken from /me', async () => {
      configService.get.mockReturnValue('development');
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        handle: 'handle',
        name: 'Name',
        avatar: null,
        bio: null,
        website: null,
        location: null,
        publication: null,
        role: Role.USER,
        isActive: true,
        emailVerified: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        settings: { emailNotifications: true },
      });

      const result = await controller.getMe({ user: { id: 'u1' } } as any);

      expect(result.emailNotifications).toBe(true);
      expect((result as any).passwordHash).toBeUndefined();
      expect((result as any).resetToken).toBeUndefined();
      expect((result as any).verificationToken).toBeUndefined();
    });
  });
});
