import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, MinLength } from 'class-validator';

export class CreateCommentDto {
  @ApiProperty({ example: 'Great article!' })
  @IsString()
  @MinLength(1)
  body: string;

  @ApiProperty({ example: 'article-slug', required: false })
  @IsOptional()
  @IsString()
  articleSlug?: string;

  @ApiProperty({ example: 'highlight-id', required: false })
  @IsOptional()
  @IsString()
  highlightId?: string;

  @ApiProperty({ example: 'parent-comment-id', required: false })
  @IsOptional()
  @IsString()
  parentId?: string;
}