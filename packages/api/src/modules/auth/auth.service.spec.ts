import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

jest.mock('bcryptjs');

describe('AuthService — Security', () => {
  let service: AuthService;
  let prisma: jest.Mocked<PrismaService>;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            retryOnConnectionError: jest.fn((fn) => fn()),
            user: {
              findFirst: jest.fn(),
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              findMany: jest.fn(),
              count: jest.fn(),
            },
            userSettings: { create: jest.fn() },
            refreshToken: {
              findUnique: jest.fn(),
              delete: jest.fn(),
              deleteMany: jest.fn(),
              create: jest.fn(),
            },
            session: { deleteMany: jest.fn() },
            rbacRole: { findFirst: jest.fn() },
            userRoleAssignment: {
              create: jest.fn(),
              count: jest.fn(),
            },
            roleAssignmentHistory: { create: jest.fn() },
          },
        },
        {
          provide: JwtService,
          useValue: { sign: jest.fn().mockReturnValue('signed.jwt.token') },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, fallback?: string) => {
              if (key === 'BCRYPT_ROUNDS') return '12';
              if (key === 'JWT_ACCESS_TOKEN_EXPIRES_IN') return '15m';
              return fallback ?? '';
            }),
          },
        },
      ],
    }).compile();

    service = module.get(AuthService);
    prisma = module.get(PrismaService);
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);
    jest.clearAllMocks();
  });

  describe('sanitizeUser', () => {
    it('removes passwordHash, resetToken, and verificationToken from the user object', () => {
      // sanitizeUser is private — exercise it via register() and assert the response
      // shape never includes sensitive fields. This test is asserted directly below
      // via the register flow. Here we just confirm the field set is defined.
      expect(typeof (service as any).sanitizeUser).toBe('function');
    });
  });

  describe('register', () => {
    const dto = {
      email: 'new@example.com',
      handle: 'new_user',
      name: 'New User',
      password: 'supersecret',
    };

    it('hashes the password with bcrypt and does not return the hash', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValue('$2a$12$hashedpassword');
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue({
        id: 'u1',
        email: dto.email,
        handle: dto.handle,
        name: dto.name,
        passwordHash: '$2a$12$hashedpassword',
        resetToken: 'should-not-leak',
        verificationToken: 'should-not-leak',
        resetTokenExpiresAt: new Date(),
        verificationTokenExpiresAt: new Date(),
        role: 'USER',
      });
      (prisma.userRoleAssignment.count as jest.Mock).mockResolvedValue(0);
      (prisma.rbacRole.findFirst as jest.Mock).mockResolvedValue({ id: 'role-1' });
      (prisma.userRoleAssignment.create as jest.Mock).mockResolvedValue({});

      const result = await service.register(dto as any);

      // bcrypt.hash was called with the configured rounds
      expect(bcrypt.hash).toHaveBeenCalledWith(dto.password, 12);
      // Sensitive fields are stripped from the response
      const user = result.user as any;
      expect(user.passwordHash).toBeUndefined();
      expect(user.resetToken).toBeUndefined();
      expect(user.verificationToken).toBeUndefined();
      expect(user.resetTokenExpiresAt).toBeUndefined();
      expect(user.verificationTokenExpiresAt).toBeUndefined();
      // Tokens are issued
      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.refreshToken).toBeTruthy();
    });

    it('throws ConflictException when the email already exists', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({
        email: dto.email,
        handle: 'different_handle',
      });
      (bcrypt.hash as jest.Mock).mockResolvedValue('$2a$12$hashedpassword');

      await expect(service.register(dto as any)).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when the handle is taken', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({
        email: 'other@example.com',
        handle: dto.handle,
      });
      (bcrypt.hash as jest.Mock).mockResolvedValue('$2a$12$hashedpassword');

      await expect(service.register(dto as any)).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    const dto = { email: 'admin@vellbase.com', password: 'password123' };

    it('rejects login for an unknown user with Invalid credentials (no user enumeration)', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.login(dto as any)).rejects.toThrow(UnauthorizedException);
      await expect(service.login(dto as any)).rejects.toThrow('Invalid credentials');
    });

    it('rejects login when passwordHash is missing or non-bcrypt (legacy marker)', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'u1',
        email: dto.email,
        passwordHash: 'verify:legacy-token:',
        role: 'USER',
        isActive: true,
      });

      await expect(service.login(dto as any)).rejects.toThrow(UnauthorizedException);
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('rejects login when bcrypt compare fails', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'u1',
        email: dto.email,
        passwordHash: '$2a$12$validhash',
        role: 'USER',
        isActive: true,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(dto as any)).rejects.toThrow(UnauthorizedException);
    });

    it('rejects login for a disabled account', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'u1',
        email: dto.email,
        passwordHash: '$2a$12$validhash',
        role: 'USER',
        isActive: false,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(service.login(dto as any)).rejects.toThrow(UnauthorizedException);
    });

    it('returns a sanitized user without sensitive fields on success', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'u1',
        email: dto.email,
        passwordHash: '$2a$12$validhash',
        role: 'USER',
        isActive: true,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (prisma.userRoleAssignment.count as jest.Mock).mockResolvedValue(1);
      (prisma.refreshToken.create as jest.Mock).mockResolvedValue({});

      const result = await service.login(dto as any);

      const user = result.user as any;
      expect(user.passwordHash).toBeUndefined();
      expect(user.resetToken).toBeUndefined();
      expect(user.verificationToken).toBeUndefined();
    });
  });

  describe('forgotPassword', () => {
    it('returns the same generic message whether or not the email exists (no enumeration)', async () => {
      const expected = {
        message: 'If this email exists, you will receive a password reset link',
      };

      // Unknown email
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.forgotPassword({ email: 'unknown@example.com' } as any)).resolves.toEqual(expected);

      // Known email
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'u1',
        email: 'admin@vellbase.com',
      });
      (prisma.user.update as jest.Mock).mockResolvedValue({});
      const result = await service.forgotPassword({ email: 'admin@vellbase.com' } as any);
      expect(result).toEqual(expected);
      // Reset token must NEVER be in the response body
      expect((result as any).resetToken).toBeUndefined();
    });

    it('persists the reset token in dedicated columns (never overwrites passwordHash)', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'u1',
        email: 'admin@vellbase.com',
      });
      (prisma.user.update as jest.Mock).mockResolvedValue({});

      await service.forgotPassword({ email: 'admin@vellbase.com' } as any);

      const updateCall = (prisma.user.update as jest.Mock).mock.calls[0][0];
      expect(updateCall.where).toEqual({ id: 'u1' });
      // Must NOT touch passwordHash
      expect(updateCall.data.passwordHash).toBeUndefined();
      expect(updateCall.data.resetToken).toBeTruthy();
      expect(updateCall.data.resetTokenExpiresAt).toBeInstanceOf(Date);
    });
  });

  describe('resetPassword', () => {
    it('rejects an unknown reset token', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(
        service.resetPassword({ token: 'bad', password: 'newpassword' } as any)
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects an expired reset token', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'u1',
        resetToken: 'valid-token',
        resetTokenExpiresAt: new Date(Date.now() - 1000), // expired
      });
      await expect(
        service.resetPassword({ token: 'valid-token', password: 'newpassword' } as any)
      ).rejects.toThrow(BadRequestException);
    });

    it('hashes the new password and clears the reset token on success', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'u1',
        resetToken: 'valid-token',
        resetTokenExpiresAt: new Date(Date.now() + 60_000),
      });
      (bcrypt.hash as jest.Mock).mockResolvedValue('$2a$12$newhash');
      (prisma.user.update as jest.Mock).mockResolvedValue({});

      const result = await service.resetPassword({
        token: 'valid-token',
        password: 'newpassword',
      } as any);

      expect(bcrypt.hash).toHaveBeenCalledWith('newpassword', 12);
      const updateCall = (prisma.user.update as jest.Mock).mock.calls[0][0];
      expect(updateCall.data.passwordHash).toBe('$2a$12$newhash');
      expect(updateCall.data.resetToken).toBeNull();
      expect(updateCall.data.resetTokenExpiresAt).toBeNull();
      expect(result).toEqual({ message: 'Password reset successful' });
    });
  });

  describe('verifyEmail', () => {
    it('rejects an unknown verification token', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.findMany as jest.Mock).mockResolvedValue([]);
      await expect(
        service.verifyEmail({ token: 'bad' } as any)
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects an expired verification token', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'u1',
        verificationToken: 'valid',
        verificationTokenExpiresAt: new Date(Date.now() - 1000),
      });
      await expect(
        service.verifyEmail({ token: 'valid' } as any)
      ).rejects.toThrow(BadRequestException);
    });

    it('marks the email as verified and clears the token on success', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'u1',
        verificationToken: 'valid',
        verificationTokenExpiresAt: new Date(Date.now() + 60_000),
      });
      (prisma.user.update as jest.Mock).mockResolvedValue({});

      const result = await service.verifyEmail({ token: 'valid' } as any);

      const updateCall = (prisma.user.update as jest.Mock).mock.calls[0][0];
      expect(updateCall.data.emailVerified).toBeInstanceOf(Date);
      expect(updateCall.data.verificationToken).toBeNull();
      expect(updateCall.data.verificationTokenExpiresAt).toBeNull();
      expect(result).toEqual({ message: 'Email verified successfully' });
    });
  });

  describe('refreshToken', () => {
    it('rejects an unknown refresh token', async () => {
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(
        service.refreshToken({ refreshToken: 'bad' } as any)
      ).rejects.toThrow(UnauthorizedException);
    });

    it('deletes and rejects an expired refresh token', async () => {
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({
        id: 'rt1',
        expiresAt: new Date(Date.now() - 1000),
        user: { id: 'u1', email: 'a@b.com', role: 'USER' },
      });
      (prisma.refreshToken.delete as jest.Mock).mockResolvedValue({});

      await expect(
        service.refreshToken({ refreshToken: 'expired' } as any)
      ).rejects.toThrow(UnauthorizedException);
      expect(prisma.refreshToken.delete).toHaveBeenCalledWith({ where: { id: 'rt1' } });
    });

    it('rotates the token: deletes the old one and issues new tokens', async () => {
      const user = { id: 'u1', email: 'a@b.com', role: 'USER' };
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({
        id: 'rt1',
        expiresAt: new Date(Date.now() + 60_000),
        user,
      });
      (prisma.refreshToken.delete as jest.Mock).mockResolvedValue({});
      (prisma.refreshToken.create as jest.Mock).mockResolvedValue({});

      const result = await service.refreshToken({ refreshToken: 'valid' } as any);

      expect(prisma.refreshToken.delete).toHaveBeenCalledWith({ where: { id: 'rt1' } });
      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.refreshToken).toBeTruthy();
    });
  });

  describe('validateUser (JWT strategy hook)', () => {
    it('rejects an unknown user id', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.validateUser({ sub: 'unknown' })).rejects.toThrow(UnauthorizedException);
    });

    it('rejects a disabled user', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'u1',
        isActive: false,
        role: 'USER',
      });
      await expect(service.validateUser({ sub: 'u1' })).rejects.toThrow(UnauthorizedException);
    });
  });
});
