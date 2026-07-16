import { Controller, Post, Get, Query, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { FollowsService } from './follows.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Follows')
@Controller('api/follows')
export class FollowsController {
  constructor(private followsService: FollowsService) {}

  @Post(':userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.USER, Role.CREATOR, Role.MODERATOR, Role.ADMIN)
  @ApiOperation({ summary: 'Follow or unfollow a user' })
  @ApiResponse({ status: 200, description: 'Follow toggled' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async followUser(@Request() req: any, @Param('userId') userId: string) {
    return this.followsService.followUser(req.user.id, userId);
  }

  @Get(':userId/followers')
  @ApiOperation({ summary: 'Get user followers' })
  @ApiResponse({ status: 200, description: 'Followers retrieved' })
  async getFollowers(@Param('userId') userId: string, @Query('page') page?: number, @Query('limit') limit?: number) {
    return this.followsService.getFollowers(userId, page, limit);
  }

  @Get(':userId/following')
  @ApiOperation({ summary: 'Get users followed by user' })
  @ApiResponse({ status: 200, description: 'Following list retrieved' })
  async getFollowing(@Param('userId') userId: string, @Query('page') page?: number, @Query('limit') limit?: number) {
    return this.followsService.getFollowing(userId, page, limit);
  }

  @Get(':userId/is-following')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Check if current user follows a user' })
  @ApiResponse({ status: 200, description: 'Following status retrieved' })
  async isFollowing(@Request() req: any, @Param('userId') userId: string) {
    return this.followsService.isFollowing(req.user.id, userId);
  }
}