import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsBoolean, IsOptional, MinLength } from 'class-validator';

export class CreateHighlightDto {
  @ApiProperty({ example: 'Amazing sunset' })
  @IsString()
  @MinLength(1)
  title: string;

  @ApiProperty({ example: 'https://example.com/cover.jpg', required: false })
  @IsOptional()
  @IsString()
  cover?: string;

  @ApiProperty({ example: 'https://example.com/video.mp4', required: false })
  @IsOptional()
  @IsString()
  videoUrl?: string;

  @ApiProperty({ example: 'https://example.com/thumbnail.jpg', required: false })
  @IsOptional()
  @IsString()
  thumbnailUrl?: string;

  @ApiProperty({ example: 'john_doe' })
  @IsString()
  handle: string;

  @ApiProperty({ example: 'Beautiful sunset captured today', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'Artist - Song', required: false })
  @IsOptional()
  @IsString()
  music?: string;

  @ApiProperty({ example: 1.777, required: false })
  @IsOptional()
  @IsNumber()
  aspectRatio?: number;

  @ApiProperty({ example: 15000, required: false })
  @IsOptional()
  @IsNumber()
  duration?: number;
}

export class UpdateHighlightDto {
  @ApiProperty({ example: 'Updated title', required: false })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ example: 'https://example.com/new-cover.jpg', required: false })
  @IsOptional()
  @IsString()
  cover?: string;

  @ApiProperty({ example: 'Updated description', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}