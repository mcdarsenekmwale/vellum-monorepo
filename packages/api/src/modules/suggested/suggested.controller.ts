import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { SuggestedService } from './suggested.service';
import { SuggestedQueryDto } from './dto/suggested.dto';

@ApiTags('Suggested')
@Controller('api/suggested')
export class SuggestedController {
  constructor(private suggestedService: SuggestedService) {}

  @Get('articles')
  @ApiOperation({ summary: 'Get suggested articles from authors not yet followed' })
  @ApiResponse({ status: 200, description: 'Suggested articles retrieved' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number, description: 'Number of items to skip' })
  async getSuggestedArticles(@Query() query: SuggestedQueryDto, @Request() req?: any) {
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
  ) {
    const userId = req?.user?.id;
    return this.suggestedService.getReplacementArticle(userId, excludeArticleId, excludeAuthorId);
  }
}
