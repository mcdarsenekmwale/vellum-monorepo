import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'john.doe@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'john_doe' })
  @IsString()
  @MinLength(3)
  handle: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'Writer and developer' })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiProperty({ example: 'Tech Insights' })
  @IsOptional()
  @IsString()
  publication?: string;
}

export class LoginDto {
  @ApiProperty({ example: 'john.doe@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  password: string;
}

export class RefreshTokenDto {
  @ApiProperty({ example: 'your-refresh-token' })
  @IsString()
  refreshToken: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'john.doe@example.com' })
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty({ example: 'new-password123' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'reset-token' })
  @IsString()
  token: string;
}

export class VerifyEmailDto {
  @ApiProperty({ example: 'verification-token' })
  @IsString()
  token: string;
}