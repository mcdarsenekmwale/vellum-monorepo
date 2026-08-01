import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UpdateUserDto, UpdateUserSettingsDto } from './dto/users.dto';

@ApiTags('Users')
@Controller('api/users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'User profile' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMe(@Request() req: any) {
    return this.usersService.getProfile(req.user.id);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search users' })
  @ApiResponse({ status: 200, description: 'Users found' })
  async searchUsers(@Query('q') query: string, @Query('limit') limit?: number) {
    return this.usersService.searchUsers(query, limit);
  }

  @Get('me/settings')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get user settings' })
  @ApiResponse({ status: 200, description: 'User settings' })
  @ApiResponse({ status: 404, description: 'Settings not found' })
  async getSettings(@Request() req: any) {
    return this.usersService.getSettings(req.user.id);
  }

  @Get(':handle')
  @ApiOperation({ summary: 'Get user profile by handle' })
  @ApiResponse({ status: 200, description: 'User profile' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserByHandle(@Param('handle') handle: string) {
    return this.usersService.getUserByHandle(handle);
  }

  @Put('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update current user' })
  @ApiResponse({ status: 200, description: 'User updated' })
  @ApiResponse({ status: 400, description: 'Handle already taken' })
  async updateUser(@Request() req: any, @Body() dto: UpdateUserDto) {
    return this.usersService.updateUser(req.user.id, dto);
  }

  @Put('me/settings')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update user settings' })
  @ApiResponse({ status: 200, description: 'Settings updated' })
  async updateSettings(@Request() req: any, @Body() dto: UpdateUserSettingsDto) {
    return this.usersService.updateSettings(req.user.id, dto);
  }

  @Delete('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Delete user account' })
  @ApiResponse({ status: 200, description: 'Account deactivated' })
  async deleteUser(@Request() req: any) {
    return this.usersService.deleteUser(req.user.id);
  }
}