import { Controller, Get, Post, Delete, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { StoriesService } from './stories.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Stories')
@Controller('api/stories')
export class StoriesController {
  constructor(private storiesService: StoriesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create a story' })
  @ApiResponse({ status: 201, description: 'Story created' })
  async createStory(@Request() req: any, @Body() body: { image: string; caption?: string; duration?: number }) {
    return this.storiesService.createStory(req.user.id, body.image, body.caption, body.duration);
  }

  @Get()
  @ApiOperation({ summary: 'Get all stories' })
  @ApiResponse({ status: 200, description: 'Stories retrieved' })
  async getStories() {
    return this.storiesService.getStories();
  }

  @Get('user/:authorId')
  @ApiOperation({ summary: 'Get user stories' })
  @ApiResponse({ status: 200, description: 'Stories retrieved' })
  async getUserStories(@Param('authorId') authorId: string) {
    return this.storiesService.getUserStories(authorId);
  }

  @Get(':authorId/:storyId')
  @ApiOperation({ summary: 'Get a specific story' })
  @ApiResponse({ status: 200, description: 'Story found' })
  @ApiResponse({ status: 404, description: 'Story not found' })
  async getStory(@Param('authorId') authorId: string, @Param('storyId') storyId: string, @Request() req?: any) {
    const viewerId = req?.user?.id;
    return this.storiesService.getStory(authorId, storyId, viewerId);
  }

  @Get(':storyId/views')
  @ApiOperation({ summary: 'Get story view count' })
  @ApiResponse({ status: 200, description: 'View count retrieved' })
  async getStoryViewCount(@Param('storyId') storyId: string) {
    return this.storiesService.getStoryViewCount(storyId);
  }

  @Delete(':storyId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Delete a story' })
  @ApiResponse({ status: 200, description: 'Story deleted' })
  @ApiResponse({ status: 404, description: 'Story not found' })
  async deleteStory(@Request() req: any, @Param('storyId') storyId: string) {
    return this.storiesService.deleteStory(req.user.id, storyId);
  }
}