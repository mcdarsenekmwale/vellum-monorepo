import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SearchService } from './search.service';

@ApiTags('Search')
@Controller('api/search')
export class SearchController {
  constructor(private searchService: SearchService) {}

  @Get()
  @ApiOperation({ summary: 'Search across content' })
  @ApiResponse({ status: 200, description: 'Search results retrieved' })
  async search(
    @Query('query') query: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('type') type?: 'users' | 'articles' | 'highlights',
  ) {
    return this.searchService.search(query, page, limit, type);
  }
}