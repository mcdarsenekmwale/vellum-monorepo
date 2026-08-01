import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { RbacService } from './rbac.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from './permissions.guard';
import { Permissions } from './permissions.decorator';

@ApiTags('RBAC')
@Controller('api/rbac')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RbacController {
  constructor(private rbacService: RbacService) {}

  // ─── Roles ─────────────────────────────────────────────────────────────────

  @Get('roles')
  @Permissions('roles.view')
  @ApiOperation({ summary: 'List all roles' })
  async listRoles(@Query('search') search?: string, @Query('includeInactive') includeInactive?: string) {
    return this.rbacService.listRoles({ search, includeInactive: includeInactive === 'true' });
  }

  @Get('roles/:id')
  @Permissions('roles.view')
  @ApiOperation({ summary: 'Get role by ID' })
  async getRole(@Param('id') id: string) {
    return this.rbacService.getRole(id);
  }

  @Post('roles')
  @Permissions('roles.create')
  @ApiOperation({ summary: 'Create a role' })
  async createRole(
    @Body()
    body: {
      key: string;
      name: string;
      description?: string;
      parentId?: string;
      rank?: number;
      permissionIds?: string[];
    },
  ) {
    return this.rbacService.createRole(body);
  }

  @Put('roles/:id')
  @Permissions('roles.edit')
  @ApiOperation({ summary: 'Update a role' })
  async updateRole(
    @Param('id') id: string,
    @Body() body: { name?: string; description?: string; parentId?: string; rank?: number; isActive?: boolean },
  ) {
    return this.rbacService.updateRole(id, body);
  }

  @Delete('roles/:id')
  @Permissions('roles.delete')
  @ApiOperation({ summary: 'Delete a role' })
  async deleteRole(@Param('id') id: string) {
    return this.rbacService.deleteRole(id);
  }

  @Post('roles/:id/restore')
  @Permissions('roles.edit')
  @ApiOperation({ summary: 'Restore a soft-deleted role' })
  async restoreRole(@Param('id') id: string) {
    return this.rbacService.restoreRole(id);
  }

  @Post('roles/:id/duplicate')
  @Permissions('roles.create')
  @ApiOperation({ summary: 'Duplicate a role' })
  async duplicateRole(@Param('id') id: string, @Body() body: { key: string; name: string }) {
    return this.rbacService.duplicateRole(id, body.key, body.name);
  }

  @Put('roles/:id/permissions')
  @Permissions('permissions.assign')
  @ApiOperation({ summary: 'Assign permissions to a role' })
  async assignPermissions(
    @Param('id') id: string,
    @Body() body: { permissionIds: string[] },
    @Req() req: { user: { id: string } },
  ) {
    return this.rbacService.assignPermissionsToRole(id, body.permissionIds, req.user.id);
  }

  // ─── Permissions ───────────────────────────────────────────────────────────

  @Get('permissions')
  @Permissions('permissions.view')
  @ApiOperation({ summary: 'List all permissions' })
  async listPermissions(@Query('groupId') groupId?: string, @Query('search') search?: string) {
    return this.rbacService.listPermissions({ groupId, search });
  }

  @Get('permissions/:id')
  @Permissions('permissions.view')
  @ApiOperation({ summary: 'Get permission by ID' })
  async getPermission(@Param('id') id: string) {
    return this.rbacService.getPermission(id);
  }

  @Post('permissions')
  @Permissions('permissions.create')
  @ApiOperation({ summary: 'Create a permission' })
  async createPermission(
    @Body() body: { key: string; name: string; groupId: string; description?: string; sortOrder?: number },
  ) {
    return this.rbacService.createPermission(body);
  }

  @Put('permissions/:id')
  @Permissions('permissions.create')
  @ApiOperation({ summary: 'Update a permission' })
  async updatePermission(
    @Param('id') id: string,
    @Body() body: { name?: string; description?: string; groupId?: string; sortOrder?: number },
  ) {
    return this.rbacService.updatePermission(id, body);
  }

  @Delete('permissions/:id')
  @Permissions('permissions.create')
  @ApiOperation({ summary: 'Delete a permission' })
  async deletePermission(@Param('id') id: string) {
    return this.rbacService.deletePermission(id);
  }

  @Get('permission-groups')
  @Permissions('permissions.view')
  @ApiOperation({ summary: 'List permission groups with permissions' })
  async listPermissionGroups() {
    return this.rbacService.listPermissionGroups();
  }

  // ─── User Access ───────────────────────────────────────────────────────────

  @Get('users/:userId/roles')
  @Permissions('roles.view')
  @ApiOperation({ summary: 'Get user role assignments' })
  async getUserRoles(@Param('userId') userId: string) {
    return this.rbacService.getUserRoles(userId);
  }

  @Post('users/:userId/roles')
  @Permissions('roles.assign')
  @ApiOperation({ summary: 'Assign role to user' })
  async assignRole(
    @Param('userId') userId: string,
    @Body() body: { roleId: string; isPrimary?: boolean; expiresAt?: string },
    @Req() req: { user: { id: string } },
  ) {
    return this.rbacService.assignRoleToUser(userId, body.roleId, {
      isPrimary: body.isPrimary,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
      assignedBy: req.user.id,
    });
  }

  @Delete('users/:userId/roles/:roleId')
  @Permissions('roles.assign')
  @ApiOperation({ summary: 'Remove role from user' })
  async removeRole(
    @Param('userId') userId: string,
    @Param('roleId') roleId: string,
    @Req() req: { user: { id: string } },
  ) {
    return this.rbacService.removeRoleFromUser(userId, roleId, req.user.id);
  }

  @Post('users/bulk-assign-role')
  @Permissions('roles.assign')
  @ApiOperation({ summary: 'Bulk assign role to users' })
  async bulkAssignRole(
    @Body() body: { userIds: string[]; roleId: string },
    @Req() req: { user: { id: string } },
  ) {
    return this.rbacService.bulkAssignRole(body.userIds, body.roleId, req.user.id);
  }

  @Get('users/:userId/effective-permissions')
  @Permissions('permissions.view')
  @ApiOperation({ summary: 'Get effective permissions for user' })
  async getEffectivePermissions(@Param('userId') userId: string) {
    return this.rbacService.getUserEffectivePermissions(userId);
  }

  @Get('users/:userId/role-history')
  @Permissions('roles.view')
  @ApiOperation({ summary: 'Get role assignment history' })
  async getRoleHistory(@Param('userId') userId: string) {
    return this.rbacService.getRoleHistory(userId);
  }

  @Post('users/:userId/permission-overrides')
  @Permissions('permissions.override')
  @ApiOperation({ summary: 'Set user permission override' })
  async setPermissionOverride(
    @Param('userId') userId: string,
    @Body() body: { permissionId: string; granted: boolean; reason?: string; expiresAt?: string },
    @Req() req: { user: { id: string } },
  ) {
    return this.rbacService.setUserPermissionOverride(userId, body.permissionId, body.granted, {
      reason: body.reason,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
      grantedBy: req.user.id,
    });
  }

  @Delete('users/:userId/permission-overrides/:permissionId')
  @Permissions('permissions.override')
  @ApiOperation({ summary: 'Remove user permission override' })
  async removePermissionOverride(
    @Param('userId') userId: string,
    @Param('permissionId') permissionId: string,
  ) {
    return this.rbacService.removeUserPermissionOverride(userId, permissionId);
  }

  @Get('me/permissions')
  @ApiOperation({ summary: 'Get current user effective permissions' })
  async getMyPermissions(@Req() req: { user: { id: string } }) {
    return this.rbacService.getUserEffectivePermissions(req.user.id);
  }

  // ─── Seed ──────────────────────────────────────────────────────────────────

  @Post('seed')
  @Permissions('roles.create')
  @ApiOperation({ summary: 'Seed RBAC data' })
  async seedRbac() {
    const rbac = await this.rbacService.seedRbac();
    const users = await this.rbacService.assignDefaultRolesToUsers();
    return { rbac, users };
  }
}
