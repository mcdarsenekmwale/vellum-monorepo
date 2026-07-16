import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CommentsService } from './comments.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { CreateCommentDto } from './dto/comments.dto';

@ApiTags('Comments')
@Controller('api/comments')
export class CommentsController {
  constructor(private commentsService: CommentsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.USER, Role.CREATOR, Role.MODERATOR, Role.ADMIN)
  @ApiOperation({ summary: 'Create a comment' })
  @ApiResponse({ status: 201, description: 'Comment created' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async createComment(@Request() req: any, @Body() dto: CreateCommentDto) {
    return this.commentsService.createComment(req.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get comments' })
  @ApiResponse({ status: 200, description: 'Comments retrieved' })
  async getComments(
    @Query('articleSlug') articleSlug?: string,
    @Query('highlightId') highlightId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.commentsService.getComments(articleSlug, highlightId, page, limit);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.USER, Role.CREATOR, Role.MODERATOR, Role.ADMIN)
  @ApiOperation({ summary: 'Update a comment' })
  @ApiResponse({ status: 200, description: 'Comment updated' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async updateComment(@Request() req: any, @Param('id') id: string, @Body() body: { body: string }) {
    return this.commentsService.updateComment(req.user.id, id, body.body);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MODERATOR, Role.ADMIN)
  @ApiOperation({ summary: 'Delete a comment' })
  @ApiResponse({ status: 200, description: 'Comment deleted' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async deleteComment(@Request() req: any, @Param('id') id: string) {
    return this.commentsService.deleteComment(req.user.id, id);
  }
}