import { Controller, Post, Body, Get, UseGuards, Request, HttpCode, HttpStatus, Res, Inject, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RegisterDto, LoginDto, RefreshTokenDto, ForgotPasswordDto, ResetPasswordDto, VerifyEmailDto } from './dto/auth.dto';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../shared/prisma/prisma.service';

@ApiTags('Auth')
@Controller('api/auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  private getCookieOptions(isRefresh = false) {
    const nodeEnv = this.configService.get('NODE_ENV', 'development');
    const isProd = nodeEnv === 'production';
    return {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? ('strict' as const) : ('lax' as const),
      maxAge: isRefresh
        ? 7 * 24 * 60 * 60 * 1000
        : parseInt(this.configService.get('JWT_ACCESS_TOKEN_EXPIRES_IN', '15m').replace('m', '')) * 60 * 1000,
      path: '/',
    };
  }

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 409, description: 'Email or handle already exists' })
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.register(dto);
    res.cookie('access_token', result.accessToken, this.getCookieOptions(false));
    res.cookie('refresh_token', result.refreshToken, this.getCookieOptions(true));
    return result;
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login user' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto);
    res.cookie('access_token', result.accessToken, this.getCookieOptions(false));
    res.cookie('refresh_token', result.refreshToken, this.getCookieOptions(true));
    return result;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Token refreshed' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refresh(@Body() dto: RefreshTokenDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.refreshToken(dto);
    res.cookie('access_token', result.accessToken, this.getCookieOptions(false));
    if (result.refreshToken) {
      res.cookie('refresh_token', result.refreshToken, this.getCookieOptions(true));
    }
    return result;
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout user' })
  @ApiResponse({ status: 200, description: 'Logout successful' })
  async logout(@Request() req: any, @Res({ passthrough: true }) res: Response) {
    await this.authService.logout(req.user.id);
    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/' });
    return { message: 'Logged out successfully' };
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset' })
  @ApiResponse({ status: 200, description: 'Reset link sent' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password' })
  @ApiResponse({ status: 200, description: 'Password reset successful' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email address' })
  @ApiResponse({ status: 200, description: 'Email verified' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current user' })
  @ApiResponse({ status: 200, description: 'User data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMe(@Request() req: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: req.user.id },
      include: { settings: true },
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    const { passwordHash, settings, ...profile } = user;

    return {
      ...profile,
      emailNotifications: settings?.emailNotifications ?? true,
    };
  }
}
