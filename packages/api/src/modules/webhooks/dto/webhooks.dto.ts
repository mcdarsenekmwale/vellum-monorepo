import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsJSON,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  WebhookType,
  WebhookFormat,
  TeamsCardType,
} from '@prisma/client';

// ─── Create Webhook ───────────────────────────────────────────────────────────

export class CreateWebhookDto {
  @ApiProperty({ example: 'Ticket Creation Teams Alert' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({ enum: WebhookType, example: WebhookType.OUTGOING })
  @IsEnum(WebhookType)
  type: WebhookType;

  @ApiProperty({ example: 'https://vellumcorp.webhook.office.com/webhookb2/...' })
  @IsString()
  @IsNotEmpty()
  url: string;

  @ApiPropertyOptional({ example: 'whsec_abc123...' })
  @IsOptional()
  @IsString()
  secret?: string;

  @ApiProperty({ enum: WebhookFormat, default: WebhookFormat.JSON })
  @IsOptional()
  @IsEnum(WebhookFormat)
  format?: WebhookFormat;

  @ApiPropertyOptional({
    type: [String],
    example: ['ticket.created', 'ticket.updated'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  events?: string[];

  @ApiPropertyOptional({ example: { 'X-Custom-Header': 'value' } })
  @IsOptional()
  @IsObject()
  headers?: Record<string, string>;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // ── Outgoing webhook options ──

  @ApiPropertyOptional({ example: 3, minimum: 1, maximum: 10, default: 3 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  retryMaxAttempts?: number;

  @ApiPropertyOptional({ example: 1000, minimum: 100, default: 1000 })
  @IsOptional()
  @IsInt()
  @Min(100)
  retryBackoffDelay?: number;

  // ── Incoming webhook options ──

  @ApiPropertyOptional({ type: [String], example: ['203.0.113.0/24', '198.51.100.1'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedIps?: string[];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  requiresAuth?: boolean;

  // ── Teams integration options ──

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  teamsChannelId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  teamsTeamId?: string;

  @ApiPropertyOptional({ enum: TeamsCardType, example: TeamsCardType.ADAPTIVE })
  @IsOptional()
  @IsEnum(TeamsCardType)
  teamsCardType?: TeamsCardType;

  @ApiPropertyOptional({
    description: 'Card template with {{variable}} placeholders',
  })
  @IsOptional()
  teamsCardTemplate?: any;
}

// ─── Update Webhook ───────────────────────────────────────────────────────────

export class UpdateWebhookDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ enum: WebhookType })
  @IsOptional()
  @IsEnum(WebhookType)
  type?: WebhookType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  url?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  secret?: string;

  @ApiPropertyOptional({ enum: WebhookFormat })
  @IsOptional()
  @IsEnum(WebhookFormat)
  format?: WebhookFormat;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  events?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  headers?: Record<string, string>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // Retry policy
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  retryMaxAttempts?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(100)
  retryBackoffDelay?: number;

  // Security
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedIps?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requiresAuth?: boolean;

  // Teams
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  teamsChannelId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  teamsTeamId?: string;

  @ApiPropertyOptional({ enum: TeamsCardType })
  @IsOptional()
  @IsEnum(TeamsCardType)
  teamsCardType?: TeamsCardType;

  @ApiPropertyOptional()
  @IsOptional()
  teamsCardTemplate?: any;
}

// ─── Query / List ─────────────────────────────────────────────────────────────

export class ListWebhooksQueryDto {
  @ApiPropertyOptional({ enum: WebhookType })
  @IsOptional()
  @IsEnum(WebhookType)
  type?: WebhookType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;

  @ApiPropertyOptional({ example: 'teams' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ example: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number;
}

// ─── Test Webhook (send payload) ──────────────────────────────────────────────

export class TestWebhookDto {
  @ApiPropertyOptional({
    example: 'ticket.created',
    description: 'Event name for the test payload',
  })
  @IsOptional()
  @IsString()
  event?: string;

  @ApiPropertyOptional({
    example: { ticketId: 'TKT-001', subject: 'Test ticket', priority: 'HIGH' },
    description: 'Payload body to send',
  })
  @IsOptional()
  payload?: any;

  @ApiPropertyOptional({
    example: { 'X-Test': 'true' },
    description: 'Additional headers for the test request',
  })
  @IsOptional()
  @IsObject()
  headers?: Record<string, string>;

  @ApiPropertyOptional({
    description: 'Override target URL (testing only)',
  })
  @IsOptional()
  @IsString()
  overrideUrl?: string;
}

// ─── Trigger Webhook by event ────────────────────────────────────────────────

export class TriggerWebhookDto {
  @ApiProperty({
    example: 'ticket.created',
    description: 'Event name that will be matched to webhook subscriptions',
  })
  @IsString()
  @IsNotEmpty()
  event: string;

  @ApiProperty({ description: 'Event data payload' })
  data: any;

  @ApiPropertyOptional({
    description: 'Additional metadata to include with payload',
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

// ─── List Logs ────────────────────────────────────────────────────────────────

export class ListWebhookLogsQueryDto {
  @ApiPropertyOptional({ example: 'ticket.created' })
  @IsOptional()
  @IsString()
  event?: string;

  @ApiPropertyOptional({
    type: Number,
    example: 200,
    description: 'Filter by HTTP status code',
  })
  @IsOptional()
  @IsInt()
  statusCode?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  from?: string; // ISO date string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  to?: string; // ISO date string

  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ example: 50, minimum: 1, maximum: 500 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  @Type(() => Number)
  limit?: number;
}

// ─── Incoming Webhook Handler (public endpoint) ──────────────────────────────

export class IncomingWebhookPayloadDto {
  @ApiPropertyOptional()
  event?: string;

  @ApiPropertyOptional()
  data?: any;

  /** Index signature — allows arbitrary extra JSON fields */
  [key: string]: any;
}

// ─── Create from Template ─────────────────────────────────────────────────────

export class CreateFromTemplateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    example: { url: 'https://hooks.example.com/...', channelId: '19:...' },
    description: 'Values to fill template variables',
  })
  @IsObject()
  variables: Record<string, any>;
}
