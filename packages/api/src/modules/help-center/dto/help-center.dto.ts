import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  MinLength,
  MaxLength,
  IsInt,
  Min,
  Max,
} from 'class-validator';

const TICKET_CATEGORIES = [
  'General',
  'Account',
  'Technical',
  'Billing',
  'Safety',
] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

const STATUS_VALUES = ['active', 'closed', 'all'] as const;
export type TicketStatusFilter = (typeof STATUS_VALUES)[number];

export class ListFaqsQuery {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiProperty({ required: false, default: 12 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  perPage?: number;
}

export class ListTicketsQuery {
  @ApiProperty({
    required: false,
    enum: STATUS_VALUES,
    default: 'all',
  })
  @IsOptional()
  @IsString()
  @IsEnum(STATUS_VALUES, {
    message: 'status must be one of: active, closed, all',
  })
  status?: TicketStatusFilter;

  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiProperty({ required: false, default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  perPage?: number;
}

export class CreateTicketDto {
  @ApiProperty({
    example: 'Technical',
    enum: TICKET_CATEGORIES,
  })
  @IsString()
  @IsEnum(TICKET_CATEGORIES, {
    message:
      'category must be one of: General, Account, Technical, Billing, Safety',
  })
  category: TicketCategory;

  @ApiProperty({ example: 'Cannot upload images to my article', minLength: 3, maxLength: 120 })
  @IsString()
  @MinLength(3, { message: 'subject must be at least 3 characters' })
  @MaxLength(120, { message: 'subject cannot exceed 120 characters' })
  subject: string;

  @ApiProperty({
    example:
      'When I try to drag and drop a cover image nothing happens. Chrome on Mac, latest version.',
    minLength: 10,
    maxLength: 2000,
  })
  @IsString()
  @MinLength(10, { message: 'body must be at least 10 characters' })
  @MaxLength(2000, { message: 'body cannot exceed 2000 characters' })
  body: string;
}

export class CreateTicketMessageDto {
  @ApiProperty({
    example: 'I followed the steps and it worked, thanks!',
    minLength: 1,
    maxLength: 2000,
  })
  @IsString()
  @MinLength(1, { message: 'body must be at least 1 character' })
  @MaxLength(2000, { message: 'body cannot exceed 2000 characters' })
  body: string;
}
