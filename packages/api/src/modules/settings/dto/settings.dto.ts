import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  ValidateNested,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export type ProfileVisibility = 'public' | 'followers' | 'private';
const PROFILE_VISIBILITY_VALUES = ['public', 'followers', 'private'] as const;

export class UpdatePrivacyDto {
  @ApiProperty({
    example: 'public',
    enum: ['public', 'followers', 'private'],
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsEnum(PROFILE_VISIBILITY_VALUES, {
    message: 'profileVisibility must be one of: public, followers, private',
  })
  profileVisibility?: ProfileVisibility;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  allowComments?: boolean;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  showLikesCount?: boolean;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  showOnlineStatus?: boolean;
}

class PushNotificationPrefsDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  likes: boolean;

  @ApiProperty({ example: true })
  @IsBoolean()
  comments: boolean;

  @ApiProperty({ example: true })
  @IsBoolean()
  replies: boolean;

  @ApiProperty({ example: true })
  @IsBoolean()
  follows: boolean;

  @ApiProperty({ example: true })
  @IsBoolean()
  mentions: boolean;

  @ApiProperty({ example: false })
  @IsBoolean()
  newArticles: boolean;

  @ApiProperty({ example: true })
  @IsBoolean()
  system: boolean;
}

class EmailNotificationPrefsDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  digest: boolean;

  @ApiProperty({ example: false })
  @IsBoolean()
  marketing: boolean;
}

export class UpdateNotificationPreferencesDto {
  @ApiProperty({ type: PushNotificationPrefsDto })
  @IsObject()
  @ValidateNested()
  @Type(() => PushNotificationPrefsDto)
  push: PushNotificationPrefsDto;

  @ApiProperty({ type: EmailNotificationPrefsDto })
  @IsObject()
  @ValidateNested()
  @Type(() => EmailNotificationPrefsDto)
  email: EmailNotificationPrefsDto;

  @ApiProperty({ example: true })
  @IsBoolean()
  soundsEnabled: boolean;
}

export type PlanName = 'Free' | 'Pro' | 'Teams';
export type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled';

export interface NotificationPrefsShape {
  push: {
    likes: boolean;
    comments: boolean;
    replies: boolean;
    follows: boolean;
    mentions: boolean;
    newArticles: boolean;
    system: boolean;
  };
  email: {
    digest: boolean;
    marketing: boolean;
  };
  soundsEnabled: boolean;
}

export interface SubscriptionShape {
  planName: PlanName;
  status: SubscriptionStatus;
  renewalDate?: string;
  cancelAtPeriodEnd: boolean;
  features: {
    aiDrafts: number;
    customDomain: boolean;
    analytics: boolean;
  };
}

export class SubscriptionFeaturesDto {
  @IsInt()
  aiDrafts: number;

  @IsBoolean()
  customDomain: boolean;

  @IsBoolean()
  analytics: boolean;
}
