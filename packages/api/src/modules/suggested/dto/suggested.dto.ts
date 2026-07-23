import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString } from 'class-validator';

export class SuggestedQueryDto {
  @ApiProperty({ example: 4, required: false })
  @IsOptional()
  @IsNumber()
  limit?: number;

  @ApiProperty({ example: 0, required: false, description: 'Number of suggestions to skip (offset)' })
  @IsOptional()
  @IsNumber()
  offset?: number;
}

export class SuggestedReplaceDto {
  @ApiProperty({ example: 'article-id-123', description: 'ID of the article to replace' })
  @IsString()
  excludeArticleId: string;

  @ApiProperty({ example: 'author-id-456', description: 'ID of the author that was just followed' })
  @IsString()
  excludeAuthorId: string;
}
