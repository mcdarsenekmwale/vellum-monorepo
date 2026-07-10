import { Injectable, UnauthorizedException, BadRequestException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { RegisterDto, LoginDto, RefreshTokenDto, ForgotPasswordDto, ResetPasswordDto, VerifyEmailDto } from './dto/auth.dto';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    try {
      console.log('Register called with:', dto.email, dto.handle);
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
      console.log('Existing user check:', existingUser ? 'found' : 'not found');

      if (existingUser) {
        if (existingUser.email === dto.email) {
          throw new ConflictException('Email already exists');
        }
        throw new ConflictException('Handle already taken');
      }

      const passwordHash = await bcrypt.hash(dto.password, parseInt(this.configService.get('BCRYPT_ROUNDS', '12')));
      console.log('Password hashed');

      const user = await this.prisma.retryOnConnectionError(() =>
        this.prisma.user.create({
          data: {
            email: dto.email,
            handle: dto.handle,
            name: dto.name,
            passwordHash,
            bio: dto.bio,
            publication: dto.publication,
          },
        })
      );
      console.log('User created:', user.id);

      await this.prisma.retryOnConnectionError(() =>
        this.prisma.userSettings.create({
          data: {
            userId: user.id,
          },
        })
      );
      console.log('User settings created');

      const tokens = await this.generateTokens(user);
      console.log('Tokens generated');

      return {
        user: this.sanitizeUser(user),
        ...tokens,
      };
    } catch (error) {
      console.error('Register error:', error);
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

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is disabled');
    }

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
    const resetTokenExpires = new Date(Date.now() + 3600000);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: `reset:${resetToken}:${resetTokenExpires.getTime()}`,
      },
    });

    return { message: 'If this email exists, you will receive a password reset link' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const users = await this.prisma.user.findMany();
    const user = users.find(u => {
      const parts = u.passwordHash.split(':');
      if (parts[0] === 'reset' && parts[1] === dto.token) {
        const expires = parseInt(parts[2]);
        return expires > Date.now();
      }
      return false;
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(dto.password, parseInt(this.configService.get('BCRYPT_ROUNDS', '12')));

    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    return { message: 'Password reset successful' };
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const users = await this.prisma.user.findMany();
    const user = users.find(u => {
      if (!u.emailVerified && u.passwordHash.includes(`verify:${dto.token}:`)) {
        return true;
      }
      return false;
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: new Date() },
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

    return user;
  }

  private sanitizeUser(user: any) {
    const { passwordHash, ...sanitized } = user;
    return sanitized;
  }
}