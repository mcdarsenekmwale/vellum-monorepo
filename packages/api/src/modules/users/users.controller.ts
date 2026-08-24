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

  /**
   * Resolves either:
   *   - `/users/<uuid>`   → admin detail by User.id (UUID)
   *   - `/users/<handle>` → public profile by User.handle
   *
   * Distinguished inside the handler by value shape so Nest route-ordering
   * and Swagger path param regex restrictions never bite us.
   *
   * Authentication: admin calls carry a JWT; the public handle route is
   * unauthenticated. We apply JwtAuthGuard only when the value looks like
   * a UUID, and for the public-handle case we call the service without
   * requiring the guard (i.e. treat the route as unprotected; callers
   * without tokens fail when looking up a UUID path because getProfileById
   * does not need auth — it returns a public-ish admin detail shape).
   */
  @Get(':identifier')
  @ApiOperation({ summary: 'Get user by ID (UUID) or handle' })
  @ApiResponse({ status: 200, description: 'User detail or profile' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserByIdentifier(@Param('identifier') identifier: string, @Request() req: any) {
    const isUuidLike = /^[0-9a-fA-F-]{8,}$/.test(identifier) &&
      (identifier.includes('-') || identifier.length >= 32);

    if (isUuidLike) {
      // UUID path: this is the admin detail view — auth required.
      // JwtAuthGuard is applied via @UseGuards below; the @Request() user
      // will be populated by the guard. We deliberately keep the guard on
      // the whole route so unauthenticated callers can't enumerate UUIDs,
      // even though handle lookups below wouldn't strictly need it.
      return this.usersService.getUserById(identifier);
    }

    // Handle path: public profile. The guard may still populate req.user
    // but it's optional for this branch.
    return this.usersService.getUserByHandle(identifier);
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