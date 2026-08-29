import { IsArray, IsBoolean, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class FeedQueryDto {
  @IsOptional() @IsInt() @Min(1) @Max(100)
  limit?: number;

  @IsOptional() @IsString() @MaxLength(64)
  before?: string;

  @IsOptional() @IsBoolean()
  onlyUnread?: boolean;
}

export class MarkReadDto {
  @IsOptional() @IsArray() @IsUUID(undefined, { each: true })
  ids?: string[];

  @IsOptional() @IsBoolean()
  all?: boolean;
}

export class UpdatePrefsDto {
  @IsOptional() @IsBoolean() groupLikes?: boolean;
  @IsOptional() @IsBoolean() groupComments?: boolean;
  @IsOptional() @IsBoolean() groupFollows?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(1440 * 30) activityReminderEveryMinutes?: number;
  @IsOptional() @IsString() @MaxLength(5) quietHoursStart?: string;
  @IsOptional() @IsString() @MaxLength(5) quietHoursEnd?: string;
}

export class ExpoTokenDto {
  @IsString() @MaxLength(512)
  token: string;

  @IsOptional() @IsString() @MaxLength(256)
  deviceId?: string;

  @IsString()
  action: 'register' | 'unregister';
}

export class WebhookInboundDto {
  @IsUUID(undefined) userId: string;
  @IsOptional() @IsUUID(undefined) actorId?: string;
  @IsString() kind: string;
  @IsOptional() @IsString() @MaxLength(200) articleSlug?: string;
  @IsOptional() @IsString() @MaxLength(64) highlightId?: string;
  @IsOptional() @IsString() @MaxLength(64) commentId?: string;
  @IsOptional() @IsString() @MaxLength(500) previewText?: string;
  @IsOptional() @IsString() @MaxLength(500) linkHref?: string;
}
