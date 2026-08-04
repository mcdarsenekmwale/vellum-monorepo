import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ArticlesService } from './articles.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/jwt-optional-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { CreateArticleDto, UpdateArticleDto, ArticleQueryDto } from './dto/articles.dto';

@ApiTags('Articles')
@Controller('api/articles')
export class ArticlesController {
  constructor(private articlesService: ArticlesService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CREATOR, Role.MODERATOR, Role.ADMIN)
  @ApiOperation({ summary: 'Create a new article' })
  @ApiResponse({ status: 201, description: 'Article created' })
  @ApiResponse({ status: 400, description: 'Invalid input or category not found' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async createArticle(@Request() req: any, @Body() dto: CreateArticleDto) {
    return this.articlesService.createArticle(req.user.id, dto);
  }

  @Get(':slug')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get an article by slug' })
  @ApiResponse({ status: 200, description: 'Article found' })
  @ApiResponse({ status: 404, description: 'Article not found' })
  async getArticle(@Param('slug') slug: string, @Request() req?: any) {
    const userId = req?.user?.id;
    return this.articlesService.getArticle(slug, userId);
  }

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get articles list' })
  @ApiResponse({ status: 200, description: 'Articles retrieved' })
  async getArticles(@Query() query: ArticleQueryDto, @Request() req?: any) {
    const userId = req?.user?.id;
    try {
      const result = await this.articlesService.getArticles(query, userId);
      return result;
    } catch (error: any) {
      console.error('Articles query error:', error.message);
      console.error('Error stack:', error.stack);
      throw error;
    }
  }

  @Get('author/:handle')
  @ApiOperation({ summary: 'Get articles by author' })
  @ApiResponse({ status: 200, description: 'Articles retrieved' })
  @ApiResponse({ status: 404, description: 'Author not found' })
  async getArticlesByAuthor(
    @Param('handle') handle: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.articlesService.getArticlesByAuthor(handle, page, limit);
  }

  @Get('featured')
  @ApiOperation({ summary: 'Get featured articles' })
  @ApiResponse({ status: 200, description: 'Featured articles retrieved' })
  async getFeaturedArticles(@Query('limit') limit?: number) {
    return this.articlesService.getFeaturedArticles(limit);
  }

  @Put(':slug')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CREATOR, Role.MODERATOR, Role.ADMIN)
  @ApiOperation({ summary: 'Update an article' })
  @ApiResponse({ status: 200, description: 'Article updated' })
  @ApiResponse({ status: 403, description: 'Not authorized' })
  @ApiResponse({ status: 404, description: 'Article not found' })
  async updateArticle(@Request() req: any, @Param('slug') slug: string, @Body() dto: UpdateArticleDto) {
    return this.articlesService.updateArticle(req.user.id, slug, dto);
  }

  @Delete(':slug')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CREATOR, Role.MODERATOR, Role.ADMIN)
  @ApiOperation({ summary: 'Delete an article' })
  @ApiResponse({ status: 200, description: 'Article deleted' })
  @ApiResponse({ status: 403, description: 'Not authorized' })
  @ApiResponse({ status: 404, description: 'Article not found' })
  async deleteArticle(@Request() req: any, @Param('slug') slug: string) {
    return this.articlesService.deleteArticle(req.user.id, slug);
  }

  @Post(':slug/share')
  @ApiOperation({ summary: 'Increment share count for an article' })
  @ApiResponse({ status: 200, description: 'Share count incremented' })
  @ApiResponse({ status: 404, description: 'Article not found' })
  async shareArticle(@Param('slug') slug: string) {
    return this.articlesService.incrementShares(slug);
  }
}