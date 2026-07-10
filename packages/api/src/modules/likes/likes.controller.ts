import { Controller, Post, Get, Query, UseGuards, Request, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { LikesService } from './likes.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ToggleLikeDto } from './dto/likes.dto';

@ApiTags('Likes')
@Controller('api/likes')
export class LikesController {
  constructor(private likesService: LikesService) {}

  @Post('toggle')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Toggle like on content' })
  @ApiResponse({ status: 200, description: 'Like toggled' })
  async toggleLike(
    @Request() req: any,
    @Body() dto: ToggleLikeDto,
  ) {
    return this.likesService.toggleLike(req.user.id, dto.articleSlug, dto.highlightId, dto.commentId);
  }

  @Get('articles')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get liked articles' })
  @ApiResponse({ status: 200, description: 'Liked articles retrieved' })
  async getLikedArticles(@Request() req: any, @Query('page') page?: number, @Query('limit') limit?: number) {
    return this.likesService.getLikedArticles(req.user.id, page, limit);
  }

  @Get('highlights')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get liked highlights' })
  @ApiResponse({ status: 200, description: 'Liked highlights retrieved' })
  async getLikedHighlights(@Request() req: any, @Query('page') page?: number, @Query('limit') limit?: number) {
    return this.likesService.getLikedHighlights(req.user.id, page, limit);
  }
}