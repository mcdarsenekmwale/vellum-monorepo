import { Controller, Post, Get, Query, UseGuards, Request, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { BookmarksService } from './bookmarks.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ToggleBookmarkDto } from './dto/bookmarks.dto';

@ApiTags('Bookmarks')
@Controller('api/bookmarks')
export class BookmarksController {
  constructor(private bookmarksService: BookmarksService) {}

  @Post('toggle')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Toggle bookmark on content' })
  @ApiResponse({ status: 200, description: 'Bookmark toggled' })
  async toggleBookmark(
    @Request() req: any,
    @Body() dto: ToggleBookmarkDto,
  ) {
    return this.bookmarksService.toggleBookmark(req.user.id, dto.articleSlug, dto.highlightId);
  }

  @Get('articles')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get bookmarked articles' })
  @ApiResponse({ status: 200, description: 'Bookmarked articles retrieved' })
  async getBookmarkedArticles(@Request() req: any, @Query('page') page?: number, @Query('limit') limit?: number) {
    return this.bookmarksService.getBookmarkedArticles(req.user.id, page, limit);
  }

  @Get('highlights')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get bookmarked highlights' })
  @ApiResponse({ status: 200, description: 'Bookmarked highlights retrieved' })
  async getBookmarkedHighlights(@Request() req: any, @Query('page') page?: number, @Query('limit') limit?: number) {
    return this.bookmarksService.getBookmarkedHighlights(req.user.id, page, limit);
  }
}