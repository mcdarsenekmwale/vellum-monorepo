import { Injectable, UnauthorizedException, BadRequestException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { RegisterDto, LoginDto, RefreshTokenDto, ForgotPasswordDto, ResetPasswordDto, VerifyEmailDto } from './dto/auth.dto';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const LEGACY_ROLE_TO_RBAC_KEY: Record<string, string> = {
  ADMIN: 'super_admin',
  MODERATOR: 'moderator',
  CREATOR: 'author',
  USER: 'registered_user',
  GUEST: 'guest',
};

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  // ─── RBAC Sync helpers (avoid circular module dep on RbacModule) ──────────

  private async ensureRbacRole(roleKey: string): Promise<string | null> {
    const role = await this.prisma.rbacRole.findFirst({
      where: { key: roleKey, deletedAt: null, isActive: true },
      select: { id: true },
    });
    return role?.id ?? null;
  }

  private async syncLegacyRoleToRbac(userId: string, legacyRole: string) {
    const count = await this.prisma.userRoleAssignment.count({ where: { userId } });
    if (count > 0) return; // already has RBAC roles, keep as-is
    const rbacKey = LEGACY_ROLE_TO_RBAC_KEY[legacyRole] ?? 'registered_user';
    const roleId = await this.ensureRbacRole(rbacKey);
    if (!roleId) return;
    try {
      await this.prisma.userRoleAssignment.create({
        data: { userId, roleId, isPrimary: true },
      });
      await this.prisma.roleAssignmentHistory.create({
        data: { userId, roleId, action: 'assigned', reason: 'legacy role migration' },
      });
    } catch {
      // unique constraint race - ignore
    }
  }

  private async ensureRegisteredRole(userId: string) {
    const count = await this.prisma.userRoleAssignment.count({ where: { userId } });
    if (count > 0) return;
    const roleId = await this.ensureRbacRole('registered_user');
    if (!roleId) return;
    try {
      await this.prisma.userRoleAssignment.create({
        data: { userId, roleId, isPrimary: true },
      });
      await this.prisma.roleAssignmentHistory.create({
        data: { userId, roleId, action: 'assigned', reason: 'auto on register' },
      });
    } catch {
      // unique constraint race - ignore
    }
  }

  // ─── Auth flows ───────────────────────────────────────────────────────────

  async register(dto: RegisterDto) {
    try {
      const existingUser = await this.prisma.retryOnConnectionError(() =>
        this.prisma.user.findFirst({
          where: {
            OR: [
              { email: dto.email },
              { handle: dto.handle },
            ],
          },
        })
      );

      if (existingUser) {
        if (existingUser.email === dto.email) {
          throw new ConflictException('Email already exists');
        }
        throw new ConflictException('Handle already taken');
      }

      const passwordHash = await bcrypt.hash(dto.password, parseInt(this.configService.get('BCRYPT_ROUNDS', '12')));

      const verificationToken = uuidv4();
      const verificationTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const user = await this.prisma.retryOnConnectionError(() =>
        this.prisma.user.create({
          data: {
            email: dto.email,
            handle: dto.handle,
            name: dto.name,
            passwordHash,
            bio: dto.bio,
            publication: dto.publication,
            verificationToken,
            verificationTokenExpiresAt,
          },
        })
      );

      await this.prisma.retryOnConnectionError(() =>
        this.prisma.userSettings.create({
          data: {
            userId: user.id,
          },
        })
      );

      // Auto-assign registered_user RBAC role
      await this.ensureRegisteredRole(user.id);

      const tokens = await this.generateTokens(user);

      return {
        user: this.sanitizeUser(user),
        ...tokens,
      };
    } catch (error) {
      throw error;
    }
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.retryOnConnectionError(() =>
      this.prisma.user.findUnique({
        where: { email: dto.email },
      })
    );

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Guard: don't accept bcrypt compare against non-hash markers from legacy flows
    if (!user.passwordHash || !user.passwordHash.startsWith('$2')) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is disabled');
    }

    // Auto-migrate legacy role → RBAC on first login if no RBAC assignments
    await this.syncLegacyRoleToRbac(user.id, user.role);

    const tokens = await this.generateTokens(user);

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  async refreshToken(dto: RefreshTokenDto) {
    const refreshToken = await this.prisma.refreshToken.findUnique({
      where: { token: dto.refreshToken },
      include: { user: true },
    });

    if (!refreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (refreshToken.expiresAt < new Date()) {
      await this.prisma.refreshToken.delete({ where: { id: refreshToken.id } });
      throw new UnauthorizedException('Refresh token expired');
    }

    await this.prisma.refreshToken.delete({ where: { id: refreshToken.id } });

    const tokens = await this.generateTokens(refreshToken.user);

    return tokens;
  }

  async logout(userId: string) {
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
    await this.prisma.session.deleteMany({ where: { userId } });
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      return { message: 'If this email exists, you will receive a password reset link' };
    }

    const resetToken = uuidv4();
    const resetTokenExpiresAt = new Date(Date.now() + 3600 * 1000);

    // Use DEDICATED reset token columns. DO NOT overwrite passwordHash!
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpiresAt,
      },
    });

    return { message: 'If this email exists, you will receive a password reset link' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { resetToken: dto.token },
    });

    if (!user || !user.resetTokenExpiresAt || user.resetTokenExpiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(dto.password, parseInt(this.configService.get('BCRYPT_ROUNDS', '12')));

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetToken: null,
        resetTokenExpiresAt: null,
      },
    });

    return { message: 'Password reset successful' };
  }

  async verifyEmail(dto: VerifyEmailDto) {
    // 1) Prefer dedicated verificationToken column
    let user = await this.prisma.user.findUnique({
      where: { verificationToken: dto.token },
    });

    // 2) Backward compat: legacy flows stored verify marker inside passwordHash
    if (!user) {
      const all = await this.prisma.user.findMany({ where: { emailVerified: null } });
      user = all.find((u) => u.passwordHash?.includes(`verify:${dto.token}:`)) ?? null;
    }

    if (!user) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    if (user.verificationTokenExpiresAt && user.verificationTokenExpiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: new Date(),
        verificationToken: null,
        verificationTokenExpiresAt: null,
      },
    });

    return { message: 'Email verified successfully' };
  }

  async generateTokens(user: any) {
    const payload = { sub: user.id, email: user.email, role: user.role };

    const accessToken = this.jwtService.sign(payload);

    const refreshToken = uuidv4();
    const refreshTokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: refreshTokenExpires,
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: parseInt(this.configService.get('JWT_ACCESS_TOKEN_EXPIRES_IN', '15m').replace('m', '')) * 60,
    };
  }

  async validateUser(payload: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException();
    }

    // Defense in depth: ensure RBAC roles on every authenticated access
    try {
      await this.syncLegacyRoleToRbac(user.id, user.role);
    } catch {
      // ignore transient errors during validation
    }

    return user;
  }

  private sanitizeUser(user: any) {
    const { passwordHash, resetToken, resetTokenExpiresAt, verificationToken, verificationTokenExpiresAt, ...sanitized } = user;
    return sanitized;
  }
}
