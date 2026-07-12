import { Controller, Get, Put, Delete, Param, Query, Body, UseGuards, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { AdminGuard } from '../auth/admin.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Role } from '@prisma/client';

@ApiTags('Admin')
@Controller('api/admin')
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Post('seed')
  @ApiOperation({ summary: 'Seed database with initial data' })
  @ApiResponse({ status: 200, description: 'Seed completed' })
  async seedData() {
    return this.adminService.seedData();
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Get admin dashboard stats' })
  @ApiResponse({ status: 200, description: 'Stats retrieved' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getDashboardStats() {
    return this.adminService.getDashboardStats();
  }

  @Get('users')
  @ApiOperation({ summary: 'List all users' })
  @ApiResponse({ status: 200, description: 'Users retrieved' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async listUsers(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.adminService.listUsers(page, limit);
  }

  @Put('users/:id/role')
  @ApiOperation({ summary: 'Update user role' })
  @ApiResponse({ status: 200, description: 'Role updated' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async updateUserRole(@Param('id') id: string, @Body() body: { role: Role }) {
    return this.adminService.updateUserRole(id, body.role);
  }

  @Put('users/:id/status')
  @ApiOperation({ summary: 'Toggle user status' })
  @ApiResponse({ status: 200, description: 'Status updated' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async toggleUserStatus(@Param('id') id: string) {
    return this.adminService.toggleUserStatus(id);
  }

  @Get('articles')
  @ApiOperation({ summary: 'List all articles' })
  @ApiResponse({ status: 200, description: 'Articles retrieved' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async listArticles(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.adminService.listArticles(page, limit);
  }

  @Delete('articles/:id')
  @ApiOperation({ summary: 'Delete article' })
  @ApiResponse({ status: 200, description: 'Article deleted' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async deleteArticle(@Param('id') id: string) {
    return this.adminService.deleteArticle(id);
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'List audit logs' })
  @ApiResponse({ status: 200, description: 'Logs retrieved' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async listAuditLogs(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.adminService.listAuditLogs(page, limit);
  }
}