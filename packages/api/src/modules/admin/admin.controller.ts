import { Controller, Get, Put, Delete, Param, Query, Body, UseGuards, Post, UseInterceptors, UploadedFile, Req, BadRequestException, Patch, HttpException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { AdminGuard } from '../auth/admin.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Role, RolePermissionRequestStatus, RolePermissionRequestType } from '@prisma/client';
import { FileInterceptor } from '@nestjs/platform-express';

import { ApiBearerAuth } from '@nestjs/swagger';
import { SupportAdminGuard } from '../auth/support-admin.guard';
import { WebhookTestRequest, WebhookTestService } from './webhook-test.service';


// Role validation is handled by AdminService.resolveRole() / resolveRoleOrThrow
// which accepts both legacy enum values AND custom RbacRole.key/name rows,
// returning unified error messages with both lists. Keep the type import so
// the Swagger generated schema still shows the enum in body examples.
const _ = Role;
const __unused = [RolePermissionRequestStatus, RolePermissionRequestType]; // silence lint

/**
 * Defensive helper to extract the authenticated user id no matter which
 * naming convention the `req.user` object follows.
 *
 * Two shapes coexist in the codebase:
 *   - JWT convention: `req.user.sub` (what AdminController + RoleRequestsController
 *     historically expect since the JWT payload carries `sub`).
 *   - Prisma convention: `req.user.id` (what 90% of the other controllers use
 *     because validateUser used to return the raw prisma user row).
 *
 * `AuthService.validateUser` was fixed to attach BOTH fields, but keeping this
 * helper at every call site means a future refactor that drops one field will
 * still not silently regress into assertActorAuthenticated failures.
 *
 * Call this as `actorId(req)` inside a controller.
 */
function actorId(req: { user?: { sub?: string | null; id?: string | null } }): string | undefined {
  const u = req.user;
  const raw = u?.sub ?? u?.id;
  if (!raw) return undefined;
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  return trimmed.length > 0 ? trimmed : undefined;
}

@ApiTags('Admin')
@Controller('api/admin')
export class AdminController {
  constructor(
    private adminService: AdminService,
    private webhookTestService: WebhookTestService,
  ) { }

  @Post('seed')
  @UseGuards(JwtAuthGuard, AdminGuard)
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
  @ApiOperation({ summary: 'List all users (excludes soft-deleted by default)' })
  @ApiResponse({ status: 200, description: 'Users retrieved' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async listUsers(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('except') except?: string,
    @Query('includeDeleted') includeDeleted?: string,
  ) {
    const include = includeDeleted === 'true' || includeDeleted === '1';
    return this.adminService.listUsers(page, limit, except, include);
  }

  @Get('users/deleted')
  @ApiOperation({ summary: 'List all soft-deleted users' })
  @ApiResponse({ status: 200, description: 'Deleted users retrieved' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async listDeletedUsers(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.adminService.listDeletedUsers(page, limit);
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({ status: 200, description: 'User retrieved' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getUserById(@Param('id') id: string) {
    return this.adminService.getUserById(id);
  }

  @Get('roles')
  @ApiOperation({ summary: 'List all assignable roles: legacy Role enum + custom RBAC roles from RbacRole table' })
  @ApiResponse({ status: 200, description: 'Roles retrieved (union of legacy + custom)' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  async listRoles() {
    return this.adminService.listRoles();
  }

  @Post('users')
  @ApiOperation({ summary: 'Create a user' })
  @ApiResponse({ status: 201, description: 'User created' })
  @ApiResponse({ status: 400, description: 'Invalid role or missing required fields' })
  @ApiResponse({ status: 403, description: 'Self-creation not allowed' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async createUser(
    @Req() req: any,
    @Body() body: { email: string; name: string; handle: string; role: Role | string; password: string },
  ) {
    return this.adminService.createUser(actorId(req), body.email, body.name, body.handle, body.role, body.password);
  }

  @Post('users/:id/reset-password')
  @ApiOperation({ summary: 'Reset a user password' })
  @ApiResponse({ status: 200, description: 'Password reset' })
  @ApiResponse({ status: 400, description: 'Invalid password length' })
  @ApiResponse({ status: 403, description: 'Self-password reset not allowed' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async resetUserPassword(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { password: string },
  ) {
    return this.adminService.resetUserPassword(actorId(req), id, body);
  }

  @Put('users/:id')
  @ApiOperation({ summary: 'Update a user' })
  @ApiResponse({ status: 200, description: 'User updated' })
  @ApiResponse({ status: 400, description: 'Invalid role value' })
  @ApiResponse({ status: 403, description: 'Self-role/status edit not allowed' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async updateUser(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { name?: string; handle?: string; bio?: string; website?: string; location?: string; email?: string; role?: Role | string; avatar?: string; publication?: string; isActive?: boolean },
  ) {
    return this.adminService.updateUser(actorId(req), id, body);
  }

  @Delete('users/:id')
  @ApiOperation({ summary: 'Soft-delete a user (30-day retention before permanent deletion)' })
  @ApiResponse({ status: 200, description: 'User soft-deleted' })
  @ApiResponse({ status: 400, description: 'User is already soft-deleted' })
  @ApiResponse({ status: 403, description: 'Self-deletion not allowed' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async deleteUser(@Req() req: any, @Param('id') id: string) {
    return this.adminService.deleteUser(actorId(req), id);
  }

  @Put('users/:id/restore')
  @ApiOperation({ summary: 'Restore a soft-deleted user' })
  @ApiResponse({ status: 200, description: 'User restored' })
  @ApiResponse({ status: 400, description: 'User is not soft-deleted' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async restoreUser(@Req() req: any, @Param('id') id: string) {
    return this.adminService.restoreUser(actorId(req), id);
  }

  @Delete('users/:id/purge')
  @ApiOperation({ summary: 'Permanently delete a soft-deleted user and all related data (IRREVERSIBLE)' })
  @ApiResponse({ status: 200, description: 'User permanently deleted' })
  @ApiResponse({ status: 400, description: 'User must be soft-deleted first' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async purgeUser(@Req() req: any, @Param('id') id: string) {
    return this.adminService.purgeUser(actorId(req), id);
  }

  @Put('users/:id/role')
  @ApiOperation({ summary: 'Update user role (accepts legacy Role enum OR a valid RbacRole.key / RbacRole.name from the roles table)' })
  @ApiResponse({ status: 200, description: 'Role updated' })
  @ApiResponse({ status: 400, description: 'Invalid role value — not found in legacy enum or RbacRole table' })
  @ApiResponse({ status: 403, description: 'Self-role edit not allowed' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async updateUserRole(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { role: Role | string },
  ) {
    return this.adminService.updateUserRole(actorId(req), id, body.role);
  }

  @Put('users/:id/status')
  @ApiOperation({ summary: 'Toggle user status' })
  @ApiResponse({ status: 200, description: 'Status updated' })
  @ApiResponse({ status: 403, description: 'Self-status edit not allowed' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async toggleUserStatus(@Req() req: any, @Param('id') id: string) {
    return this.adminService.toggleUserStatus(actorId(req), id);
  }

  @Post('users/:id/avatar')
  @ApiOperation({ summary: 'Upload user avatar' })
  @ApiResponse({ status: 200, description: 'Avatar uploaded' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  async uploadAvatar(@Req() req: any, @Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    // Actor id extracted but not required by service today — keep extracting so
    // audit trails can be added later without controller changes.
    actorId(req);
    return this.adminService.uploadAvatar(id, file);
  }

  @Delete('users/:id/avatar')
  @ApiOperation({ summary: 'Remove user avatar' })
  @ApiResponse({ status: 200, description: 'Avatar removed' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async removeAvatar(@Req() req: any, @Param('id') id: string) {
    actorId(req);
    return this.adminService.removeAvatar(id);
  }

  @Get('articles')
  @ApiOperation({ summary: 'List all articles' })
  @ApiResponse({ status: 200, description: 'Articles retrieved' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async listArticles(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.adminService.listArticles(page, limit);
  }

  @Get('articles/:id')
  @ApiOperation({ summary: 'Get article by ID' })
  @ApiResponse({ status: 200, description: 'Article retrieved' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getArticleById(@Param('id') id: string) {
    return this.adminService.getArticleById(id);
  }

  @Post('articles')
  @ApiOperation({ summary: 'Create an article' })
  @ApiResponse({ status: 201, description: 'Article created' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async createArticle(
    @Body() body: {
      title: string;
      slug: string;
      excerpt: string;
      body: string[];
      categoryId: string;
      authorId: string;
      isPublished: boolean;
      featured: boolean;
      cover?: string;
      readMinutes: number;
    },
  ) {
    return this.adminService.createArticle(body);
  }

  @Put('articles/:id')
  @ApiOperation({ summary: 'Update an article' })
  @ApiResponse({ status: 200, description: 'Article updated' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async updateArticle(
    @Param('id') id: string,
    @Body() body: {
      title?: string;
      slug?: string;
      excerpt?: string;
      body?: string[];
      categoryId?: string;
      authorId?: string;
      isPublished?: boolean;
      featured?: boolean;
      cover?: string;
      readMinutes?: number;
    },
  ) {
    return this.adminService.updateArticle(id, body);
  }

  @Delete('articles/:id')
  @ApiOperation({ summary: 'Delete article' })
  @ApiResponse({ status: 200, description: 'Article deleted' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async deleteArticle(@Param('id') id: string) {
    return this.adminService.deleteArticle(id);
  }

  @Get('highlights')
  @ApiOperation({ summary: 'List all highlights' })
  @ApiResponse({ status: 200, description: 'Highlights retrieved' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async listHighlights(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.adminService.listHighlights(page, limit);
  }

  @Get('highlights/:id')
  @ApiOperation({ summary: 'Get highlight by ID' })
  @ApiResponse({ status: 200, description: 'Highlight retrieved' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getHighlightById(@Param('id') id: string) {
    return this.adminService.getHighlightById(id);
  }

  @Post('highlights')
  @ApiOperation({ summary: 'Create a highlight' })
  @ApiResponse({ status: 201, description: 'Highlight created' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async createHighlight(
    @Body() body: {
      title: string;
      handle: string;
      description?: string;
      cover?: string;
      videoUrl?: string;
      thumbnailUrl?: string;
      authorId?: string;
      isPublished: boolean;
      aspectRatio?: number;
      duration?: number;
    },
  ) {
    return this.adminService.createHighlight(body);
  }

  @Put('highlights/:id')
  @ApiOperation({ summary: 'Update a highlight' })
  @ApiResponse({ status: 200, description: 'Highlight updated' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async updateHighlight(
    @Param('id') id: string,
    @Body() body: {
      title?: string;
      handle?: string;
      description?: string;
      cover?: string;
      videoUrl?: string;
      thumbnailUrl?: string;
      authorId?: string;
      isPublished?: boolean;
      aspectRatio?: number;
      duration?: number;
    },
  ) {
    return this.adminService.updateHighlight(id, body);
  }

  @Delete('highlights/:id')
  @ApiOperation({ summary: 'Delete highlight' })
  @ApiResponse({ status: 200, description: 'Highlight deleted' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async deleteHighlight(@Param('id') id: string) {
    return this.adminService.deleteHighlight(id);
  }

  @Get('comments')
  @ApiOperation({ summary: 'List all comments' })
  @ApiResponse({ status: 200, description: 'Comments retrieved' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async listComments(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.adminService.listComments(page, limit);
  }

  @Delete('comments/:id')
  @ApiOperation({ summary: 'Delete comment' })
  @ApiResponse({ status: 200, description: 'Comment deleted' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async deleteComment(@Param('id') id: string) {
    return this.adminService.deleteComment(id);
  }

  @Get('media')
  @ApiOperation({ summary: 'List all media uploads' })
  @ApiResponse({ status: 200, description: 'Media retrieved' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async listMedia(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.adminService.listMedia(page, limit);
  }

  @Delete('media/:id')
  @ApiOperation({ summary: 'Delete media upload' })
  @ApiResponse({ status: 200, description: 'Media deleted' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async deleteMedia(@Param('id') id: string) {
    return this.adminService.deleteMedia(id);
  }

  @Get('notifications')
  @ApiOperation({ summary: 'List all notifications across users' })
  @ApiResponse({ status: 200, description: 'Notifications retrieved' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async listAllNotifications(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Req() req?: { user?: { id: string; role?: Role | null } },
  ) {
    const actor = req?.user ? { id: req.user.id, role: req.user.role ?? null } : undefined;
    return this.adminService.listAllNotifications(page, limit, actor);
  }

  @Put('notifications/:id/read')
  @ApiOperation({ summary: 'Mark a notification as read (admin)' })
  @ApiResponse({ status: 200, description: 'Notification marked as read' })
  @UseGuards(JwtAuthGuard)
  async markNotificationRead(
    @Param('id') id: string,
  ) {
    return this.adminService.markNotificationRead(id);
  }

  @Put('notifications/read-all')
  @ApiOperation({ summary: 'Mark all notifications as read (admin)' })
  @ApiResponse({ status: 200, description: 'All notifications marked as read' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async markAllNotificationsRead() {
    return this.adminService.markAllNotificationsRead();
  }

  @Delete('notifications/:id')
  @ApiOperation({ summary: 'Delete a notification (admin)' })
  @ApiResponse({ status: 200, description: 'Notification deleted' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async deleteNotification(@Param('id') id: string) {
    return this.adminService.deleteNotification(id);
  }

  @Post('notifications')
  @ApiOperation({ summary: 'Create and send a notification (admin)' })
  @ApiResponse({ status: 201, description: 'Notification created' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async createNotification(@Body() body: { userId: string; kind: string; body: string; title?: string }) {
    return this.adminService.createNotification(body);
  }

  @Get('follows')
  @ApiOperation({ summary: 'List all follows' })
  @ApiResponse({ status: 200, description: 'Follows retrieved' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async listFollows(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.adminService.listFollows(page, limit);
  }

  @Get('categories')
  @ApiOperation({ summary: 'List all categories' })
  @ApiResponse({ status: 200, description: 'Categories retrieved' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async listCategories() {
    return this.adminService.listCategories();
  }

  @Post('categories')
  @ApiOperation({ summary: 'Create a category' })
  @ApiResponse({ status: 201, description: 'Category created' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async createCategory(@Body() body: { name: string; slug: string; tint: string }) {
    return this.adminService.createCategory(body.name, body.slug, body.tint);
  }

  @Put('categories/:id')
  @ApiOperation({ summary: 'Update a category' })
  @ApiResponse({ status: 200, description: 'Category updated' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async updateCategory(@Param('id') id: string, @Body() body: { name?: string; slug?: string; tint?: string }) {
    return this.adminService.updateCategory(id, body);
  }

  @Delete('categories/:id')
  @ApiOperation({ summary: 'Delete a category' })
  @ApiResponse({ status: 200, description: 'Category deleted' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async deleteCategory(@Param('id') id: string) {
    return this.adminService.deleteCategory(id);
  }

  @Get('webhooks')
  @ApiOperation({ summary: 'List all webhooks with recent logs' })
  @ApiResponse({ status: 200, description: 'Webhooks retrieved' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async listWebhooks() {
    return this.adminService.listWebhooks();
  }

  @Post('webhooks')
  @ApiOperation({ summary: 'Create a webhook' })
  @ApiResponse({ status: 201, description: 'Webhook created' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async createWebhook(@Body() body: { name: string; url: string; events: string[]; isActive: boolean }) {
    return this.adminService.createWebhook(body.name, body.url, body.events, body.isActive);
  }

  @Get('webhooks/:id/logs')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Fetch execution logs for a webhook' })
  @ApiResponse({ status: 200, description: 'Logs with pagination' })
  async listWebhookLogs(
    @Param('id') id: string,
    @Query() query: {
      page?: number; limit?: number,
      eventType?: string, status?: string, from?: string, to?: string, statusCode?: number
    },
  ) {
    return this.adminService.listLogs(id, query);
  }

  @Get('webhooks/templates')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'List webhook templates (admin catalog)' })
  @ApiResponse({ status: 200, description: 'Templates with categories + preseeded config' })
  async listWebhookTemplates(@Query('category') category?: string) {
    return this.adminService.listWebhookTemplates(category);
  }

  @Get('webhooks/stats/overview')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Global webhook KPIs + event breakdown (admin list view overview)' })
  @ApiResponse({ status: 200, description: 'Overview stats (total executions, success/error counts, success rate, per-event breakdown)' })
  async getWebhookStatsOverview(@Req() req: any) {
    const userId = actorId(req);
    const role = req.user?.role;
    return this.adminService.getWebhookStatsOverview(userId, role);
  }

  // ─── Webhook testing service───────────────────────────────────────────────────────────────────
  @Post('webhooks/:id/test')
  @ApiOperation({ summary: 'Test a webhook' })
  @ApiResponse({ status: 200, description: 'Webhook test result' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async testWebhook(
    @Param('id') id: string,
    @Body() body: WebhookTestRequest['body'],

  ) {
    // Log the test request
    const result = await this.webhookTestService.testWebhook(id, body);

    // Return the result with appropriate status
    if (result.success) {
      return {
        ...result,
        message: 'Webhook test completed successfully',
      };
    } else {
      throw new HttpException(
        {
          message: 'Webhook test failed',
          error: result.errorMessage,
          details: result,
        },
        result.statusCode || 500,
      );
    }
  }

  // ─── Web Webhook ───────────────────────────────────────────────────────────────────

  //Get Webhook by ID
  @Get('webhooks/:id')
  @ApiOperation({ summary: 'Get a single webhook by id' })
  @ApiResponse({ status: 200, description: 'Webhook retrieved' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getWebhook(@Param('id') id: string) {
    return this.adminService.getWebhook(id);
  }

  @Put('webhooks/:id')
  @ApiOperation({ summary: 'Update a webhook' })
  @ApiResponse({ status: 200, description: 'Webhook updated' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async updateWebhook(
    @Param('id') id: string,
    @Body() body: { name?: string; url?: string; events?: string[]; isActive?: boolean },
  ) {
    return this.adminService.updateWebhook(id, body);
  }

  @Delete('webhooks/:id')
  @ApiOperation({ summary: 'Delete a webhook' })
  @ApiResponse({ status: 200, description: 'Webhook deleted' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async deleteWebhook(@Param('id') id: string) {
    return this.adminService.deleteWebhook(id);
  }

  @Get('api-keys')
  @ApiOperation({ summary: 'List all API keys' })
  @ApiResponse({ status: 200, description: 'API keys retrieved' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async listApiKeys() {
    return this.adminService.listApiKeys();
  }

  @Post('api-keys')
  @ApiOperation({ summary: 'Create an API key' })
  @ApiResponse({ status: 201, description: 'API key created' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async createApiKey(@Body() body: { name: string; scopes: string[]; userId?: string; expiresAt?: Date }) {
    return this.adminService.createApiKey(body.name, body.scopes, body.userId, body.expiresAt);
  }

  @Delete('api-keys/:id')
  @ApiOperation({ summary: 'Revoke/delete an API key' })
  @ApiResponse({ status: 200, description: 'API key deleted' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async deleteApiKey(@Param('id') id: string) {
    return this.adminService.deleteApiKey(id);
  }

  @Get('reports')
  @ApiOperation({ summary: 'List all reports' })
  @ApiResponse({ status: 200, description: 'Reports retrieved' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async listReports(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.adminService.listReports(page, limit);
  }

  @Get('reports/:id')
  @ApiOperation({ summary: 'Get a single report by id' })
  @ApiResponse({ status: 200, description: 'Report retrieved' })
  @ApiResponse({ status: 404, description: 'Report not found' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getReport(@Param('id') id: string) {
    return this.adminService.getReportById(id);
  }

  @Put('reports/:id/status')
  @ApiOperation({ summary: 'Update report status' })
  @ApiResponse({ status: 200, description: 'Report status updated' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async updateReportStatus(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { status: string; note?: string },
  ) {
    return this.adminService.updateReportStatus(id, body.status, actorId(req), body.note);
  }

  @Delete('reports/:id')
  @ApiOperation({ summary: 'Delete a report' })
  @ApiResponse({ status: 200, description: 'Report deleted' })
  @ApiResponse({ status: 404, description: 'Report not found' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async deleteReport(@Req() req: any, @Param('id') id: string) {
    await this.adminService.deleteReport(actorId(req), id);
    return { id, deleted: true };
  }

  @Put(['reports/bulk/status'])
  @ApiOperation({ summary: 'Bulk update status for multiple reports' })
  @ApiResponse({ status: 200, description: 'Reports status updated' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async bulkUpdateReportStatus(
    @Req() req: any,
    @Body() body: { ids: string[]; status: string; note?: string },
  ) {
    return this.adminService.bulkUpdateReportStatus(
      actorId(req),
      body.ids ?? [],
      body.status,
      body.note,
    );
  }

  @Get('analytics/overview')
  @ApiOperation({ summary: 'Get analytics overview' })
  @ApiResponse({ status: 200, description: 'Analytics overview retrieved' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getAnalyticsOverview() {
    return this.adminService.getAnalyticsOverview();
  }

  @Get('analytics/timeseries')
  @ApiOperation({ summary: 'Get analytics time series data' })
  @ApiResponse({ status: 200, description: 'Time series data retrieved' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getAnalyticsTimeseries(@Query('days') days?: number) {
    return this.adminService.getAnalyticsTimeseries(days);
  }

  @Get('analytics/traffic')
  @ApiOperation({ summary: 'Get traffic sources breakdown' })
  @ApiResponse({ status: 200, description: 'Traffic sources retrieved' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getTrafficSources() {
    return this.adminService.getTrafficSources();
  }

  @Get('tags')
  @ApiOperation({ summary: 'List all tags' })
  @ApiResponse({ status: 200, description: 'Tags retrieved' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async listTags() {
    return this.adminService.listTags();
  }

  @Post('tags')
  @ApiOperation({ summary: 'Create a tag' })
  @ApiResponse({ status: 201, description: 'Tag created' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async createTag(@Body() body: { name: string; slug: string }) {
    return this.adminService.createTag(body.name, body.slug);
  }

  @Put('tags/:id')
  @ApiOperation({ summary: 'Update a tag' })
  @ApiResponse({ status: 200, description: 'Tag updated' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async updateTag(@Param('id') id: string, @Body() body: { name: string; slug: string }) {
    return this.adminService.updateTag(id, body.name, body.slug);
  }

  @Delete('tags/:id')
  @ApiOperation({ summary: 'Delete a tag' })
  @ApiResponse({ status: 200, description: 'Tag deleted' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async deleteTag(@Param('id') id: string) {
    return this.adminService.deleteTag(id);
  }

  @Get('flags')
  @ApiOperation({ summary: 'List all feature flags' })
  @ApiResponse({ status: 200, description: 'Feature flags retrieved' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async listFeatureFlags() {
    return this.adminService.listFeatureFlags();
  }

  @Post('flags')
  @ApiOperation({ summary: 'Create a feature flag' })
  @ApiResponse({ status: 201, description: 'Feature flag created' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async createFeatureFlag(@Body() body: { key: string; description: string; enabled: boolean; rollout: number }) {
    return this.adminService.createFeatureFlag(body.key, body.description, body.enabled, body.rollout);
  }

  @Put('flags/:id')
  @ApiOperation({ summary: 'Update a feature flag' })
  @ApiResponse({ status: 200, description: 'Feature flag updated' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async updateFeatureFlag(@Param('id') id: string, @Body() body: { enabled?: boolean; rollout?: number }) {
    return this.adminService.updateFeatureFlag(id, body);
  }

  @Delete('flags/:id')
  @ApiOperation({ summary: 'Delete a feature flag' })
  @ApiResponse({ status: 200, description: 'Feature flag deleted' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async deleteFeatureFlag(@Param('id') id: string) {
    return this.adminService.deleteFeatureFlag(id);
  }

  @Get('settings')
  @ApiOperation({ summary: 'List all system settings grouped by category' })
  @ApiResponse({ status: 200, description: 'System settings retrieved' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async listSystemSettings() {
    return this.adminService.listSystemSettings();
  }

  @Put('settings')
  @ApiOperation({ summary: 'Update a system setting' })
  @ApiResponse({ status: 200, description: 'Setting updated' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async updateSystemSetting(@Body() body: { key: string; value: string; category?: string }) {
    return this.adminService.updateSystemSetting(body.key, body.value, body.category);
  }

  @Get('storage')
  @ApiOperation({ summary: 'Get storage statistics' })
  @ApiResponse({ status: 200, description: 'Storage stats retrieved' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getStorageStats() {
    return this.adminService.getStorageStats();
  }

  @Get('status')
  @ApiOperation({ summary: 'Get system status' })
  @ApiResponse({ status: 200, description: 'System status retrieved' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getSystemStatus() {
    return this.adminService.getSystemStatus();
  }

  @Delete('workspace')
  @ApiOperation({ summary: 'Delete workspace (destructive)' })
  @ApiResponse({ status: 200, description: 'Workspace deleted' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async deleteWorkspace() {
    return this.adminService.deleteWorkspace();
  }

  @Post('settings/reset')
  @ApiOperation({ summary: 'Reset all system settings' })
  @ApiResponse({ status: 200, description: 'Settings reset' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async resetSettings() {
    return this.adminService.resetSettings();
  }

  @Post('settings/seed')
  @ApiOperation({ summary: 'Seed default system settings if none exist' })
  @ApiResponse({ status: 200, description: 'Settings seeded' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async seedSettings() {
    return this.adminService.seedSettings();
  }

  @Get('jobs')
  @ApiOperation({ summary: 'List background jobs' })
  @ApiResponse({ status: 200, description: 'Jobs retrieved' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async listJobs(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.adminService.listJobs(page, limit);
  }

  @Get('advertisements')
  @ApiOperation({ summary: 'List advertisements' })
  @ApiResponse({ status: 200, description: 'Advertisements retrieved' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async listAdvertisements(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.adminService.listAdvertisements(page, limit);
  }

  @Post('advertisements')
  @ApiOperation({ summary: 'Create an advertisement' })
  @ApiResponse({ status: 201, description: 'Advertisement created' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async createAdvertisement(@Body() body: { name: string; status: string; startsAt?: Date; endsAt?: Date }) {
    return this.adminService.createAdvertisement(body);
  }

  @Put('advertisements/:id')
  @ApiOperation({ summary: 'Update an advertisement' })
  @ApiResponse({ status: 200, description: 'Advertisement updated' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async updateAdvertisement(
    @Param('id') id: string,
    @Body() body: { name?: string; status?: string; startsAt?: Date; endsAt?: Date },
  ) {
    return this.adminService.updateAdvertisement(id, body);
  }

  @Delete('advertisements/:id')
  @ApiOperation({ summary: 'Delete an advertisement' })
  @ApiResponse({ status: 200, description: 'Advertisement deleted' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async deleteAdvertisement(@Param('id') id: string) {
    return this.adminService.deleteAdvertisement(id);
  }

  @Get('ai-agents')
  @ApiOperation({ summary: 'List AI agents' })
  @ApiResponse({ status: 200, description: 'AI agents retrieved' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async listAIAgents() {
    return this.adminService.listAIAgents();
  }

  @Post('ai-agents')
  @ApiOperation({ summary: 'Create an AI agent' })
  @ApiResponse({ status: 201, description: 'AI agent created' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async createAIAgent(@Body() body: { name: string; description?: string; model?: string; status?: string; config?: any }) {
    return this.adminService.createAIAgent(body);
  }

  @Put('ai-agents/:id')
  @ApiOperation({ summary: 'Update an AI agent' })
  @ApiResponse({ status: 200, description: 'AI agent updated' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async updateAIAgent(
    @Param('id') id: string,
    @Body() body: { name?: string; description?: string; model?: string; status?: string; config?: any },
  ) {
    return this.adminService.updateAIAgent(id, body);
  }

  @Delete('ai-agents/:id')
  @ApiOperation({ summary: 'Delete an AI agent' })
  @ApiResponse({ status: 200, description: 'AI agent deleted' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async deleteAIAgent(@Param('id') id: string) {
    return this.adminService.deleteAIAgent(id);
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'List audit logs' })
  @ApiResponse({ status: 200, description: 'Logs retrieved' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async listAuditLogs(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.adminService.listAuditLogs(page, limit);
  }

  @Get('audit-logs/:id')
  @ApiOperation({ summary: 'Get audit log by ID' })
  @ApiResponse({ status: 200, description: 'Audit log retrieved' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getAuditLogById(@Param('id') id: string) {
    return this.adminService.getAuditLogById(id);
  }

  @Get('ai/settings')
  @ApiOperation({ summary: 'Get AI moderation settings' })
  @ApiResponse({ status: 200, description: 'AI settings retrieved' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getAISettings() {
    return this.adminService.getAISettings();
  }

  @Put('ai/settings')
  @ApiOperation({ summary: 'Update AI moderation settings' })
  @ApiResponse({ status: 200, description: 'AI settings updated' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async updateAISettings(@Body() body: Record<string, any>) {
    return this.adminService.updateAISettings(body);
  }

  @Post('ai/moderation/test')
  @ApiOperation({ summary: 'Test content against AI moderation' })
  @ApiResponse({ status: 200, description: 'Moderation test completed' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async testAIModeration(@Body() body: { content: string; thresholds?: { high: number; medium: number } }) {
    return this.adminService.testAIModeration(body.content, body.thresholds);
  }

  @Get('reports/trends')
  @ApiOperation({ summary: 'Get report trends over time' })
  @ApiResponse({ status: 200, description: 'Report trends retrieved' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getReportTrends(@Query('days') days?: number) {
    return this.adminService.getReportTrends(days);
  }

  @Get('reports/stats')
  @ApiOperation({ summary: 'Get report statistics' })
  @ApiResponse({ status: 200, description: 'Report stats retrieved' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getReportStats() {
    return this.adminService.getReportStats();
  }

  @Get('help/articles')
  @ApiOperation({ summary: 'List help articles' })
  @ApiResponse({ status: 200, description: 'Help articles retrieved' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async listHelpArticles(@Query('category') category?: string, @Query('search') search?: string) {
    return this.adminService.listHelpArticles({ category, search });
  }

  @Get('help/articles/:id')
  @ApiOperation({ summary: 'Get help article by ID' })
  @ApiResponse({ status: 200, description: 'Help article retrieved' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getHelpArticleById(@Param('id') id: string) {
    return this.adminService.getHelpArticleById(id);
  }

  @Get('help/articles/slug/:slug')
  @ApiOperation({ summary: 'Get help article by slug' })
  @ApiResponse({ status: 200, description: 'Help article retrieved' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getHelpArticleBySlug(@Param('slug') slug: string) {
    return this.adminService.getHelpArticleBySlug(slug);
  }

  @Post('help/articles')
  @ApiOperation({ summary: 'Create a help article' })
  @ApiResponse({ status: 201, description: 'Help article created' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async createHelpArticle(
    @Body() body: {
      slug: string;
      title: string;
      description: string;
      content: string[];
      category: string;
      icon: string;
      readMinutes?: number;
      popular?: boolean;
      isPublished?: boolean;
    },
  ) {
    return this.adminService.createHelpArticle(body);
  }

  @Put('help/articles/:id')
  @ApiOperation({ summary: 'Update a help article' })
  @ApiResponse({ status: 200, description: 'Help article updated' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async updateHelpArticle(
    @Param('id') id: string,
    @Body() body: {
      slug?: string;
      title?: string;
      description?: string;
      content?: string[];
      category?: string;
      icon?: string;
      readMinutes?: number;
      popular?: boolean;
      isPublished?: boolean;
    },
  ) {
    return this.adminService.updateHelpArticle(id, body);
  }

  @Delete('help/articles/:id')
  @ApiOperation({ summary: 'Delete a help article' })
  @ApiResponse({ status: 200, description: 'Help article deleted' })
  @UseGuards(JwtAuthGuard, AdminGuard)
  async deleteHelpArticle(@Param('id') id: string) {
    return this.adminService.deleteHelpArticle(id);
  }

  @Post('support-tickets')
  @ApiOperation({ summary: 'Create a support ticket' })
  @ApiResponse({ status: 201, description: 'Support ticket created' })
  @UseGuards(JwtAuthGuard)
  async createSupportTicket(
    @Req() req: any,
    @Body() body: { subject: string; message: string; priority: string },
  ) {
    const userId = req.user?.id;
    return this.adminService.createSupportTicket(userId, body);
  }

  @Get('support-tickets')
  @ApiOperation({ summary: 'List support tickets (support admin)' })
  @ApiResponse({ status: 200, description: 'Support tickets retrieved' })
  @UseGuards(JwtAuthGuard, SupportAdminGuard)
  async listSupportTickets(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
  ) {
    return this.adminService.listSupportTickets({ page, limit, status, priority });
  }




  //restore support ticket
  @Put('support-tickets/deleted/:id/restore')
  @ApiOperation({ summary: 'Restore support ticket' })
  @ApiResponse({ status: 200, description: 'Support ticket restored' })
  @UseGuards(JwtAuthGuard, SupportAdminGuard)
  async restoreSupportTicket(@Param('id') id: string) {
    return this.adminService.restoreSupportTicket(id);
  }

  //permanent delete support ticket
  @Delete('support-tickets/deleted/:id/permanently-delete')
  @ApiOperation({ summary: 'Permanently delete support ticket' })
  @ApiResponse({ status: 200, description: 'Support ticket permanently deleted' })
  @UseGuards(JwtAuthGuard, SupportAdminGuard)
  async permanentlyDeleteSupportTicket(@Param('id') id: string) {
    return this.adminService.permanentlyDeleteSupportTicket(id);
  }

  //
  @Get('support-tickets/:id')
  @ApiOperation({ summary: 'Get support ticket by ID' })
  @ApiResponse({ status: 200, description: 'Support ticket retrieved' })
  @UseGuards(JwtAuthGuard, SupportAdminGuard)
  async getSupportTicket(@Param('id') id: string) {
    return this.adminService.getSupportTicket(id);
  }

  @Put('support-tickets/:id/status')
  @ApiOperation({ summary: 'Update support ticket status' })
  @ApiResponse({ status: 200, description: 'Support ticket status updated' })
  @UseGuards(JwtAuthGuard, SupportAdminGuard)
  async updateSupportTicketStatus(@Param('id') id: string, @Body() body: { status: string }) {
    return this.adminService.updateSupportTicketStatus(id, body.status);
  }
}
