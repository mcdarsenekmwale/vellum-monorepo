import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, MinLength } from 'class-validator';

export class UpdateUserDto {
  @ApiProperty({ example: 'John Doe', required: false })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiProperty({ example: 'john_doe', required: false })
  @IsOptional()
  @IsString()
  @MinLength(3)
  handle?: string;

  @ApiProperty({ example: 'Writer and developer', required: false })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiProperty({ example: 'Tech Insights', required: false })
  @IsOptional()
  @IsString()
  publication?: string;

  @ApiProperty({ example: 'https://example.com/avatar.jpg', required: false })
  @IsOptional()
  @IsString()
  avatar?: string;
}

export class UpdateUserSettingsDto {
  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  emailNotifications?: boolean;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  pushNotifications?: boolean;

  @ApiProperty({ example: false, required: false })
  @IsOptional()
  @IsBoolean()
  emailMarketing?: boolean;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  allowComments?: boolean;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  allowLikes?: boolean;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  showOnlineStatus?: boolean;
}