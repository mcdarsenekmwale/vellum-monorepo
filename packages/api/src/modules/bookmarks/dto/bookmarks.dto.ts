import { IsOptional, IsString } from 'class-validator';

export class ToggleBookmarkDto {
  @IsOptional()
  @IsString()
  articleSlug?: string;

  @IsOptional()
  @IsString()
  highlightId?: string;
}
