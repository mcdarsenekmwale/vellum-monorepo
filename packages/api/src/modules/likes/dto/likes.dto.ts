import { IsOptional, IsString } from 'class-validator';

export class ToggleLikeDto {
  @IsOptional()
  @IsString()
  articleSlug?: string;

  @IsOptional()
  @IsString()
  highlightId?: string;

  @IsOptional()
  @IsString()
  commentId?: string;
}
