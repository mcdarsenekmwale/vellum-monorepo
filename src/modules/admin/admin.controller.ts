import { Controller, Get, Put, Delete, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { AdminGuard } from '../auth/admin.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Role } from '@prisma/client';

@ApiTags('Admin')
@Controller('api/admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get admin dashboard stats' })
  @ApiResponse({ status: 200, description: 'Stats retrieved' })
  async getDashboardStats() {
    return this.adminService.getDashboardStats();
  }

  @Get('users')
  @ApiOperation({ summary: 'List all users' })
  @ApiResponse({ status: 200, description: 'Users retrieved' })
  async listUsers(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.adminService.listUsers(page, limit);
  }

  @Put('users/:id/role')
  @ApiOperation({ summary: 'Update user role' })
  @ApiResponse({ status: 200, description: 'Role updated' })
  async updateUserRole(@Param('id') id: string, @Body() body: { role: Role }) {
    return this.adminService.updateUserRole(id, body.role);
  }

  @Put('users/:id/status')
  @ApiOperation({ summary: 'Toggle user status' })
  @ApiResponse({ status: 200, description: 'Status updated' })
  async toggleUserStatus(@Param('id') id: string) {
    return this.adminService.toggleUserStatus(id);
  }

  @Get('articles')
  @ApiOperation({ summary: 'List all articles' })
  @ApiResponse({ status: 200, description: 'Articles retrieved' })
  async listArticles(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.adminService.listArticles(page, limit);
  }

  @Delete('articles/:id')
  @ApiOperation({ summary: 'Delete article' })
  @ApiResponse({ status: 200, description: 'Article deleted' })
  async deleteArticle(@Param('id') id: string) {
    return this.adminService.deleteArticle(id);
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'List audit logs' })
  @ApiResponse({ status: 200, description: 'Logs retrieved' })
  async listAuditLogs(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.adminService.listAuditLogs(page, limit);
  }
}