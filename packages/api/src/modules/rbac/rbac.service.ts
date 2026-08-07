import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CacheService } from '../../shared/cache/cache.service';
import {
  DEFAULT_PERMISSION_GROUPS,
  DEFAULT_ROLES,
  ROLE_PERMISSION_MAP,
} from './rbac.constants';

const CACHE_TTL = 300; // 5 minutes
const CACHE_KEY_ROLES = 'rbac:roles';
const CACHE_KEY_PERMISSIONS = 'rbac:permissions';
const CACHE_KEY_GROUPS = 'rbac:groups';
const CACHE_TTL_ROLES = 300; // 5 minutes
const CACHE_TTL_PERMISSIONS = 300; // 5 minutes
const CACHE_TTL_GROUPS = 600; // 10 minutes

@Injectable()
export class RbacService {
  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
  ) {}

  /** Write a security-relevant event to the AuditLog table (best-effort). */
  private async audit(
    userId: string | null,
    action: string,
    resource: string,
    opts?: { resourceId?: string; details?: Record<string, unknown>; changes?: Record<string, unknown>; success?: boolean },
  ) {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId,
          action,
          resource,
          resourceId: opts?.resourceId ?? null,
          details: opts?.details ? (opts.details as any) : null,
          changes: opts?.changes ? (opts.changes as any) : null,
          success: opts?.success ?? true,
        },
      });
    } catch {
      /* audit logging is best-effort; never break primary flows */
    }
  }

  // ─── Permission Resolution ─────────────────────────────────────────────────

  async getEffectivePermissions(userId: string): Promise<Set<string>> {
    const cacheKey = `rbac:permissions:${userId}`;
    const cached = await this.cache.get<string[]>(cacheKey);
    if (cached) return new Set(cached);

    const permissions = await this.computeEffectivePermissions(userId);
    await this.cache.set(cacheKey, Array.from(permissions), CACHE_TTL);
    return permissions;
  }

  private async computeEffectivePermissions(userId: string): Promise<Set<string>> {
    const now = new Date();
    const effective = new Set<string>();
    const denied = new Set<string>();

    // 1. Collect role-based permissions (including inherited)
    const assignments = await this.prisma.userRoleAssignment.findMany({
      where: {
        userId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        role: { deletedAt: null, isActive: true },
      },
      include: {
        role: {
          include: {
            permissions: { include: { permission: true } },
            parent: {
              include: {
                permissions: { include: { permission: true } },
              },
            },
          },
        },
      },
    });

    for (const assignment of assignments) {
      this.applyRolePermissions(assignment.role, effective);
      if (assignment.role.parent) {
        this.applyRolePermissions(assignment.role.parent, effective);
      }
    }

    // 2. Apply user overrides (denies first, then allows)
    const overrides = await this.prisma.userPermissionOverride.findMany({
      where: {
        userId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      include: { permission: true },
    });

    for (const override of overrides) {
      if (!override.granted) {
        denied.add(override.permission.key);
      }
    }

    for (const override of overrides) {
      if (override.granted) {
        effective.add(override.permission.key);
      }
    }

    // 3. Remove denied permissions (user deny > user allow > role)
    for (const key of denied) {
      effective.delete(key);
    }

    // 4. Wildcard check for super_admin
    if (effective.has('*')) {
      const allPerms = await this.prisma.permission.findMany({ where: { deletedAt: null } });
      return new Set(allPerms.map((p) => p.key));
    }

    return effective;
  }

  private applyRolePermissions(
    role: { permissions: { granted: boolean; permission: { key: string } }[] },
    effective: Set<string>,
  ) {
    for (const rp of role.permissions) {
      if (rp.granted) {
        effective.add(rp.permission.key);
      }
    }
  }

  async hasPermission(userId: string, permission: string): Promise<boolean> {
    const perms = await this.getEffectivePermissions(userId);
    return perms.has(permission) || perms.has('*');
  }

  async hasAnyPermission(userId: string, permissions: string[]): Promise<boolean> {
    const perms = await this.getEffectivePermissions(userId);
    if (perms.has('*')) return true;
    return permissions.some((p) => perms.has(p));
  }

  async hasAllPermissions(userId: string, permissions: string[]): Promise<boolean> {
    const perms = await this.getEffectivePermissions(userId);
    if (perms.has('*')) return true;
    return permissions.every((p) => perms.has(p));
  }

  async invalidateUserCache(userId: string) {
    await this.cache.del(`rbac:permissions:${userId}`);
  }

  // ─── Role CRUD ─────────────────────────────────────────────────────────────

  async listRoles(params?: { search?: string; includeInactive?: boolean }) {
    const useCache = !params || (!params.search && !params.includeInactive);
    if (useCache) {
      const cached = await this.cache.get<any[]>(CACHE_KEY_ROLES);
      if (cached) return cached;
    }

    const where: Record<string, unknown> = { deletedAt: null };
    if (!params?.includeInactive) where.isActive = true;
    if (params?.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { key: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const roles = await this.prisma.rbacRole.findMany({
      where,
      include: {
        _count: { select: { userAssignments: true, permissions: true } },
        parent: { select: { id: true, key: true, name: true } },
        permissions: {
          include: { permission: { include: { group: true } } },
          orderBy: { permission: { key: 'asc' } },
        },
      },
      orderBy: [{ rank: 'desc' }, { name: 'asc' }],
    });

    const result = roles.map((r) => ({
      ...r,
      userCount: r._count.userAssignments,
      permissionCount: r._count.permissions,
    }));

    if (useCache) {
      await this.cache.set(CACHE_KEY_ROLES, result, CACHE_TTL_ROLES);
    }

    return result;
  }

  async getRole(id: string) {
    const role = await this.prisma.rbacRole.findFirst({
      where: { id, deletedAt: null },
      include: {
        permissions: { include: { permission: { include: { group: true } } } },
        parent: true,
        children: true,
        _count: { select: { userAssignments: true } },
      },
    });
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  async createRole(data: {
    key: string;
    name: string;
    description?: string;
    parentId?: string;
    rank?: number;
    permissionIds?: string[];
  }) {
    const existing = await this.prisma.rbacRole.findUnique({ where: { key: data.key } });
    if (existing) throw new BadRequestException(`Role key "${data.key}" already exists`);

    const role = await this.prisma.rbacRole.create({
      data: {
        key: data.key,
        name: data.name,
        description: data.description,
        parentId: data.parentId,
        rank: data.rank ?? 0,
        isSystem: false,
      },
    });

    if (data.permissionIds?.length) {
      await this.assignPermissionsToRole(role.id, data.permissionIds);
    }

    try { await this.cache.del(CACHE_KEY_ROLES); } catch { /* optional */ }
    return this.getRole(role.id);
  }

  async updateRole(
    id: string,
    data: { name?: string; description?: string; parentId?: string; rank?: number; isActive?: boolean },
  ) {
    const role = await this.prisma.rbacRole.findFirst({ where: { id, deletedAt: null } });
    if (!role) throw new NotFoundException('Role not found');
    if (role.isSystem && data.isActive === false) {
      throw new BadRequestException('Cannot deactivate system roles');
    }
    if (data.parentId && data.parentId === id) {
      throw new BadRequestException('A role cannot inherit from itself');
    }

    await this.prisma.rbacRole.update({ where: { id }, data });
    try { await this.cache.del(CACHE_KEY_ROLES); } catch { /* optional */ }
    return this.getRole(id);
  }

  async deleteRole(id: string) {
    const role = await this.prisma.rbacRole.findFirst({ where: { id, deletedAt: null } });
    if (!role) throw new NotFoundException('Role not found');
    if (role.isSystem) throw new BadRequestException('Cannot delete system roles');

    await this.prisma.rbacRole.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
    const users = await this.prisma.userRoleAssignment.findMany({ where: { roleId: id }, select: { userId: true } });
    await Promise.all(users.map((u) => this.invalidateUserCache(u.userId)));
    try { await this.cache.del(CACHE_KEY_ROLES); } catch { /* optional */ }
    return { success: true };
  }

  async restoreRole(id: string) {
    const role = await this.prisma.rbacRole.findUnique({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');

    await this.prisma.rbacRole.update({ where: { id }, data: { deletedAt: null, isActive: true } });
    const users = await this.prisma.userRoleAssignment.findMany({ where: { roleId: id }, select: { userId: true } });
    await Promise.all(users.map((u) => this.invalidateUserCache(u.userId)));
    try { await this.cache.del(CACHE_KEY_ROLES); } catch { /* optional */ }
    return this.getRole(id);
  }

  async duplicateRole(id: string, newKey: string, newName: string) {
    const source = await this.getRole(id);
    const role = await this.createRole({
      key: newKey,
      name: newName,
      description: source.description ?? undefined,
      parentId: source.parentId ?? undefined,
      rank: source.rank,
      permissionIds: source.permissions.map((p) => p.permissionId),
    });
    return role;
  }

  async assignPermissionsToRole(roleId: string, permissionIds: string[], changedById?: string) {
    const role = await this.prisma.rbacRole.findFirst({ where: { id: roleId, deletedAt: null } });
    if (!role) throw new NotFoundException('Role not found');

    // Capture existing permissions for audit "changes" before overwriting
    const existingPerms = await this.prisma.rolePermission.findMany({
      where: { roleId },
      select: { permissionId: true },
    });
    const existingIds = existingPerms.map((p) => p.permissionId).sort();

    const uniquePermissionIds = Array.from(new Set(permissionIds));
    if (uniquePermissionIds.length) {
      const existingPermissions = await this.prisma.permission.count({
        where: { id: { in: uniquePermissionIds }, deletedAt: null },
      });
      if (existingPermissions !== uniquePermissionIds.length) {
        throw new BadRequestException('One or more permissions do not exist');
      }
    }

    await this.prisma.rolePermission.deleteMany({ where: { roleId } });
    if (uniquePermissionIds.length) {
      await this.prisma.rolePermission.createMany({
        data: uniquePermissionIds.map((permissionId) => ({ roleId, permissionId, granted: true })),
        skipDuplicates: true,
      });
    }
    // Invalidate cache for all users with this role
    const users = await this.prisma.userRoleAssignment.findMany({ where: { roleId }, select: { userId: true } });
    await Promise.all(users.map((u) => this.invalidateUserCache(u.userId)));

    try {
      await this.cache.del(CACHE_KEY_PERMISSIONS);
      await this.cache.del(CACHE_KEY_GROUPS);
    } catch { /* optional */ }

    await this.audit(changedById ?? null, 'UPDATE_ROLE_PERMISSIONS', 'RolePermission', {
      resourceId: roleId,
      details: { roleId, roleName: role.name, roleKey: role.key, permissionCount: uniquePermissionIds.length },
      changes: {
        from: { permissionIds: existingIds },
        to: { permissionIds: [...uniquePermissionIds].sort() },
        added: uniquePermissionIds.filter((id) => !existingIds.includes(id)).sort(),
        removed: existingIds.filter((id) => !uniquePermissionIds.includes(id)).sort(),
      },
    });

    return this.getRole(roleId);
  }

  // ─── Permission CRUD ───────────────────────────────────────────────────────

  async listPermissionGroups() {
    const cached = await this.cache.get<any[]>(CACHE_KEY_GROUPS);
    if (cached) return cached;

    const result = await this.prisma.permissionGroup.findMany({
      where: { deletedAt: null },
      include: {
        permissions: { where: { deletedAt: null }, orderBy: { sortOrder: 'asc' } },
      },
      orderBy: { sortOrder: 'asc' },
    });

    await this.cache.set(CACHE_KEY_GROUPS, result, CACHE_TTL_GROUPS);
    return result;
  }

  async listPermissions(params?: { groupId?: string; search?: string }) {
    const useCache = !params || (!params.groupId && !params.search);
    if (useCache) {
      const cached = await this.cache.get<any[]>(CACHE_KEY_PERMISSIONS);
      if (cached) return cached;
    }

    const where: Record<string, unknown> = { deletedAt: null };
    if (params?.groupId) where.groupId = params.groupId;
    if (params?.search) {
      where.OR = [
        { key: { contains: params.search, mode: 'insensitive' } },
        { name: { contains: params.search, mode: 'insensitive' } },
      ];
    }
    const result = await this.prisma.permission.findMany({
      where,
      include: { group: true },
      orderBy: [{ group: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
    });

    if (useCache) {
      await this.cache.set(CACHE_KEY_PERMISSIONS, result, CACHE_TTL_PERMISSIONS);
    }

    return result;
  }

  async getPermission(id: string) {
    const permission = await this.prisma.permission.findFirst({
      where: { id, deletedAt: null },
      include: { group: true },
    });
    if (!permission) throw new NotFoundException('Permission not found');
    return permission;
  }

  async createPermission(data: {
    key: string;
    name: string;
    description?: string;
    groupId: string;
    sortOrder?: number;
  }) {
    const existing = await this.prisma.permission.findUnique({ where: { key: data.key } });
    if (existing) throw new BadRequestException(`Permission key "${data.key}" already exists`);

    const group = await this.prisma.permissionGroup.findFirst({ where: { id: data.groupId, deletedAt: null } });
    if (!group) throw new NotFoundException('Permission group not found');

    const result = await this.prisma.permission.create({
      data: {
        key: data.key,
        name: data.name,
        description: data.description,
        groupId: data.groupId,
        sortOrder: data.sortOrder ?? 0,
      },
      include: { group: true },
    });

    try {
      await this.cache.del(CACHE_KEY_PERMISSIONS);
      await this.cache.del(CACHE_KEY_GROUPS);
    } catch { /* optional */ }

    return result;
  }

  async updatePermission(
    id: string,
    data: { name?: string; description?: string; groupId?: string; sortOrder?: number },
  ) {
    const permission = await this.prisma.permission.findFirst({ where: { id, deletedAt: null } });
    if (!permission) throw new NotFoundException('Permission not found');

    if (data.groupId) {
      const group = await this.prisma.permissionGroup.findFirst({ where: { id: data.groupId, deletedAt: null } });
      if (!group) throw new NotFoundException('Permission group not found');
    }

    const updated = await this.prisma.permission.update({
      where: { id },
      data,
      include: { group: true },
    });

    const impactedUsers = await this.prisma.userRoleAssignment.findMany({
      where: { role: { permissions: { some: { permissionId: id } } } },
      select: { userId: true },
    });
    await Promise.all(impactedUsers.map((user) => this.invalidateUserCache(user.userId)));

    try {
      await this.cache.del(CACHE_KEY_PERMISSIONS);
      await this.cache.del(CACHE_KEY_GROUPS);
    } catch { /* optional */ }

    return updated;
  }

  async deletePermission(id: string) {
    const permission = await this.prisma.permission.findFirst({ where: { id, deletedAt: null } });
    if (!permission) throw new NotFoundException('Permission not found');

    const impactedUsers = await this.prisma.userRoleAssignment.findMany({
      where: { role: { permissions: { some: { permissionId: id } } } },
      select: { userId: true },
    });

    await this.prisma.permission.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.prisma.rolePermission.deleteMany({ where: { permissionId: id } });
    await this.prisma.userPermissionOverride.deleteMany({ where: { permissionId: id } });
    await Promise.all(impactedUsers.map((user) => this.invalidateUserCache(user.userId)));

    try {
      await this.cache.del(CACHE_KEY_PERMISSIONS);
      await this.cache.del(CACHE_KEY_GROUPS);
    } catch { /* optional */ }

    return { success: true };
  }

  // ─── User Role Assignment ──────────────────────────────────────────────────

  async getUserRoles(userId: string) {
    return this.prisma.userRoleAssignment.findMany({
      where: { userId },
      include: { role: true },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async assignRoleToUser(
    userId: string,
    roleId: string,
    options?: { isPrimary?: boolean; expiresAt?: Date; assignedBy?: string },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const role = await this.prisma.rbacRole.findFirst({ where: { id: roleId, deletedAt: null } });
    if (!role) throw new NotFoundException('Role not found');

    if (options?.isPrimary) {
      await this.prisma.userRoleAssignment.updateMany({
        where: { userId },
        data: { isPrimary: false },
      });
    }

    const assignment = await this.prisma.userRoleAssignment.upsert({
      where: { userId_roleId: { userId, roleId } },
      create: {
        userId,
        roleId,
        isPrimary: options?.isPrimary ?? false,
        expiresAt: options?.expiresAt,
        assignedBy: options?.assignedBy,
      },
      update: {
        isPrimary: options?.isPrimary ?? undefined,
        expiresAt: options?.expiresAt,
        assignedBy: options?.assignedBy,
      },
      include: { role: true },
    });

    await this.prisma.roleAssignmentHistory.create({
      data: { userId, roleId, action: 'assigned', assignedBy: options?.assignedBy },
    });

    await this.audit(options?.assignedBy ?? null, 'ASSIGN_RBAC_ROLE', 'UserRoleAssignment', {
      resourceId: userId,
      details: { userId, roleId, roleName: role.name, roleKey: role.key, isPrimary: options?.isPrimary ?? false },
    });
    await this.invalidateUserCache(userId);
    return assignment;
  }

  async removeRoleFromUser(userId: string, roleId: string, removedBy?: string) {
    const role = await this.prisma.rbacRole.findFirst({ where: { id: roleId } });
    await this.prisma.userRoleAssignment.deleteMany({ where: { userId, roleId } });
    await this.prisma.roleAssignmentHistory.create({
      data: { userId, roleId, action: 'removed', assignedBy: removedBy },
    });
    await this.audit(removedBy ?? null, 'REMOVE_RBAC_ROLE', 'UserRoleAssignment', {
      resourceId: userId,
      details: { userId, roleId, roleName: role?.name ?? null, roleKey: role?.key ?? null },
    });
    await this.invalidateUserCache(userId);
    return { success: true };
  }

  async bulkAssignRole(userIds: string[], roleId: string, assignedBy?: string) {
    const results = await Promise.all(
      userIds.map((userId) => this.assignRoleToUser(userId, roleId, { assignedBy })),
    );
    return { assigned: results.length };
  }

  async getUserEffectivePermissions(userId: string) {
    const permissions = await this.getEffectivePermissions(userId);
    const roles = await this.getUserRoles(userId);
    const overrides = await this.prisma.userPermissionOverride.findMany({
      where: { userId },
      include: { permission: true },
    });
    return {
      permissions: Array.from(permissions).sort(),
      roles: roles.map((r) => r.role),
      overrides,
    };
  }

  async getRoleHistory(userId: string) {
    return this.prisma.roleAssignmentHistory.findMany({
      where: { userId },
      include: { role: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  // ─── User Permission Overrides ─────────────────────────────────────────────

  async setUserPermissionOverride(
    userId: string,
    permissionId: string,
    granted: boolean,
    options?: { reason?: string; expiresAt?: Date; grantedBy?: string },
  ) {
    const override = await this.prisma.userPermissionOverride.upsert({
      where: { userId_permissionId: { userId, permissionId } },
      create: {
        userId,
        permissionId,
        granted,
        reason: options?.reason,
        expiresAt: options?.expiresAt,
        grantedBy: options?.grantedBy,
      },
      update: {
        granted,
        reason: options?.reason,
        expiresAt: options?.expiresAt,
        grantedBy: options?.grantedBy,
      },
      include: { permission: true },
    });
    await this.invalidateUserCache(userId);
    return override;
  }

  async removeUserPermissionOverride(userId: string, permissionId: string) {
    await this.prisma.userPermissionOverride.deleteMany({ where: { userId, permissionId } });
    await this.invalidateUserCache(userId);
    return { success: true };
  }

  // ─── Seed ──────────────────────────────────────────────────────────────────

  async seedRbac() {
    const existing = await this.prisma.permissionGroup.count();
    if (existing > 0) return { message: 'RBAC already seeded' };

    // Create permission groups and permissions
    const permissionMap = new Map<string, string>();
    for (const [gi, group] of DEFAULT_PERMISSION_GROUPS.entries()) {
      const pg = await this.prisma.permissionGroup.create({
        data: { key: group.key, name: group.name, sortOrder: gi },
      });
      for (const [pi, perm] of group.permissions.entries()) {
        const p = await this.prisma.permission.create({
          data: { key: perm.key, name: perm.name, groupId: pg.id, sortOrder: pi },
        });
        permissionMap.set(perm.key, p.id);
      }
    }

    // Create roles and assign permissions
    const roleMap = new Map<string, string>();
    for (const roleDef of DEFAULT_ROLES) {
      const role = await this.prisma.rbacRole.create({
        data: {
          key: roleDef.key,
          name: roleDef.name,
          isSystem: roleDef.isSystem,
          rank: roleDef.rank,
        },
      });
      roleMap.set(roleDef.key, role.id);

      const permKeys = ROLE_PERMISSION_MAP[roleDef.key] ?? [];
      if (permKeys.includes('*')) {
        await this.prisma.rolePermission.create({
          data: { roleId: role.id, permissionId: permissionMap.values().next().value!, granted: true },
        });
        // Store wildcard via a special permission or handle in compute
        // For super_admin, we'll assign all permissions
        const allPermIds = Array.from(permissionMap.values());
        await this.prisma.rolePermission.createMany({
          data: allPermIds.map((pid) => ({ roleId: role.id, permissionId: pid, granted: true })),
        });
      } else {
        const permIds = permKeys.map((k) => permissionMap.get(k)).filter(Boolean) as string[];
        if (permIds.length) {
          await this.prisma.rolePermission.createMany({
            data: permIds.map((pid) => ({ roleId: role.id, permissionId: pid, granted: true })),
          });
        }
      }
    }

    try {
      await this.cache.del(CACHE_KEY_ROLES);
      await this.cache.del(CACHE_KEY_PERMISSIONS);
      await this.cache.del(CACHE_KEY_GROUPS);
    } catch { /* optional */ }

    return { groups: DEFAULT_PERMISSION_GROUPS.length, roles: DEFAULT_ROLES.length };
  }

  async assignDefaultRolesToUsers() {
    const roleMap = new Map(
      (await this.prisma.rbacRole.findMany()).map((r) => [r.key, r.id]),
    );

    const mappings: Record<string, string> = {
      ADMIN: 'platform_admin',
      MODERATOR: 'moderator',
      CREATOR: 'author',
      USER: 'registered_user',
      GUEST: 'guest',
    };

    const users = await this.prisma.user.findMany({ where: { deletedAt: null } });
    for (const user of users) {
      const roleKey = mappings[user.role] ?? 'registered_user';
      const roleId = roleMap.get(roleKey);
      if (roleId) {
        await this.assignRoleToUser(user.id, roleId, { isPrimary: true });
      }
      if (user.email === 'admin@vellum.com') {
        const superAdminId = roleMap.get('super_admin');
        if (superAdminId) await this.assignRoleToUser(user.id, superAdminId, { isPrimary: true });
      }
    }

    return { users: users.length };
  }
}
