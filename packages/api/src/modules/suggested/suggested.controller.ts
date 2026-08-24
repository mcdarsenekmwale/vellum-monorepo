import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import {
  PaginatedResult,
  SuggestedService,
  ArticleSuggestion,
  AuthorSuggestion,
} from './suggested.service';
import { SuggestedQueryDto } from './dto/suggested.dto';
import { OptionalJwtAuthGuard } from '../auth/jwt-optional-auth.guard';

@ApiTags('Suggested')
@Controller('api/suggested')
@UseGuards(OptionalJwtAuthGuard)
export class SuggestedController {
  constructor(private suggestedService: SuggestedService) {}

  @Get('articles')
  @ApiOperation({ summary: 'Get suggested articles from authors not yet followed' })
  @ApiResponse({ status: 200, description: 'Suggested articles retrieved' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number, description: 'Number of items to skip' })
  async getSuggestedArticles(
    @Query() query: SuggestedQueryDto,
    @Request() req?: any,
  ): Promise<PaginatedResult<ArticleSuggestion>> {
    const userId = req?.user?.id;
    const limit = query.limit ?? 4;
    const offset = query.offset ?? 0;
    return this.suggestedService.getSuggestedArticles(userId, limit, offset);
  }

  @Get('articles/replace')
  @ApiOperation({ summary: 'Get a replacement article for a followed author' })
  @ApiResponse({ status: 200, description: 'Replacement article or null if none available' })
  @ApiQuery({ name: 'excludeArticleId', required: true, type: String })
  @ApiQuery({ name: 'excludeAuthorId', required: true, type: String, description: 'Author ID to exclude (just followed)' })
  async getReplacementArticle(
    @Query('excludeArticleId') excludeArticleId: string,
    @Query('excludeAuthorId') excludeAuthorId: string,
    @Request() req?: any,
  ): Promise<ArticleSuggestion | null> {
    const userId = req?.user?.id;
    return this.suggestedService.getReplacementArticle(userId, excludeArticleId, excludeAuthorId);
  }

  @Get('authors')
  @ApiOperation({ summary: 'Get suggested authors not yet followed' })
  @ApiResponse({ status: 200, description: 'Suggested authors retrieved' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number, description: 'Number of items to skip' })
  async getSuggestedAuthors(
    @Query() query: SuggestedQueryDto,
    @Request() req?: any,
  ): Promise<PaginatedResult<AuthorSuggestion>> {
    const userId = req?.user?.id;
    const limit = query.limit ?? 5;
    const offset = query.offset ?? 0;
    return this.suggestedService.getSuggestedAuthors(userId, limit, offset);
  }

  @Get('authors/replace')
  @ApiOperation({ summary: 'Get a replacement author for a just-followed author' })
  @ApiResponse({ status: 200, description: 'Replacement author or null if none available' })
  @ApiQuery({ name: 'excludeAuthorId', required: true, type: String, description: 'Author ID to exclude (just followed)' })
  async getReplacementAuthor(
    @Query('excludeAuthorId') excludeAuthorId: string,
    @Request() req?: any,
  ): Promise<AuthorSuggestion | null> {
    const userId = req?.user?.id;
    return this.suggestedService.getReplacementAuthor(userId, excludeAuthorId);
  }
}
