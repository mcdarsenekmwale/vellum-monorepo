import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsBoolean, IsOptional, IsArray, MinLength } from 'class-validator';

export class CreateArticleDto {
  @ApiProperty({ example: 'The Future of AI' })
  @IsString()
  @MinLength(3)
  title: string;

  @ApiProperty({ example: 'Exploring the latest advancements in artificial intelligence' })
  @IsString()
  @MinLength(10)
  excerpt: string;

  @ApiProperty({ example: ['Paragraph 1', 'Paragraph 2'] })
  @IsArray()
  @IsString({ each: true })
  body: string[];

  @ApiProperty({ example: 'https://example.com/cover.jpg', required: false })
  @IsOptional()
  @IsString()
  cover?: string;

  @ApiProperty({ example: 5 })
  @IsNumber()
  readMinutes: number;

  @ApiProperty({ example: 'tech' })
  @IsString()
  categorySlug: string;
}

export class UpdateArticleDto {
  @ApiProperty({ example: 'Updated Title', required: false })
  @IsOptional()
  @IsString()
  @MinLength(3)
  title?: string;

  @ApiProperty({ example: 'Updated excerpt', required: false })
  @IsOptional()
  @IsString()
  excerpt?: string;

  @ApiProperty({ example: ['Updated paragraph'], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  body?: string[];

  @ApiProperty({ example: 'https://example.com/new-cover.jpg', required: false })
  @IsOptional()
  @IsString()
  cover?: string;

  @ApiProperty({ example: 8, required: false })
  @IsOptional()
  @IsNumber()
  readMinutes?: number;

  @ApiProperty({ example: 'science', required: false })
  @IsOptional()
  @IsString()
  categorySlug?: string;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class ArticleQueryDto {
  @ApiProperty({ example: 1, required: false })
  @IsOptional()
  @IsNumber()
  page?: number;

  @ApiProperty({ example: 10, required: false })
  @IsOptional()
  @IsNumber()
  limit?: number;

  @ApiProperty({ example: 'tech', required: false })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ example: 'trending', required: false })
  @IsOptional()
  @IsString()
  sort?: string;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  featured?: boolean;
}