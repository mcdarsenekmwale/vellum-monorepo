import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Inline seed logic to avoid NestJS DI dependencies
const DEFAULT_PERMISSION_GROUPS = [
  { key: 'users', name: 'Users', permissions: [
    { key: 'users.view', name: 'View Users' }, { key: 'users.create', name: 'Create Users' },
    { key: 'users.edit', name: 'Edit Users' }, { key: 'users.delete', name: 'Delete Users' },
    { key: 'users.restore', name: 'Restore Users' }, { key: 'users.disable', name: 'Disable Users' },
    { key: 'users.impersonate', name: 'Impersonate Users' },
  ]},
  { key: 'roles', name: 'Roles', permissions: [
    { key: 'roles.view', name: 'View Roles' }, { key: 'roles.create', name: 'Create Roles' },
    { key: 'roles.edit', name: 'Edit Roles' }, { key: 'roles.delete', name: 'Delete Roles' },
    { key: 'roles.assign', name: 'Assign Roles' },
  ]},
  { key: 'permissions', name: 'Permissions', permissions: [
    { key: 'permissions.view', name: 'View Permissions' }, { key: 'permissions.create', name: 'Create Permissions' },
    { key: 'permissions.assign', name: 'Assign Permissions' }, { key: 'permissions.override', name: 'Override Permissions' },
  ]},
  { key: 'articles', name: 'Articles', permissions: [
    { key: 'articles.create', name: 'Create Articles' }, { key: 'articles.publish', name: 'Publish Articles' },
    { key: 'articles.schedule', name: 'Schedule Articles' }, { key: 'articles.archive', name: 'Archive Articles' },
    { key: 'articles.delete', name: 'Delete Articles' },
  ]},
  { key: 'support', name: 'Support', permissions: [
    { key: 'tickets.view', name: 'View Tickets' }, { key: 'tickets.create', name: 'Create Tickets' },
    { key: 'tickets.assign', name: 'Assign Tickets' }, { key: 'tickets.reply', name: 'Reply to Tickets' },
    { key: 'tickets.close', name: 'Close Tickets' }, { key: 'tickets.reopen', name: 'Reopen Tickets' },
    { key: 'tickets.escalate', name: 'Escalate Tickets' }, { key: 'tickets.delete', name: 'Delete Tickets' },
  ]},
  { key: 'audit', name: 'Audit Logs', permissions: [{ key: 'audit.view', name: 'View Audit Logs' }] },
  { key: 'settings', name: 'Settings', permissions: [
    { key: 'settings.view', name: 'View Settings' }, { key: 'settings.update', name: 'Update Settings' },
  ]},
];

const DEFAULT_ROLES = [
  { key: 'super_admin', name: 'Super Administrator', rank: 100 },
  { key: 'platform_admin', name: 'Platform Administrator', rank: 90 },
  { key: 'organization_admin', name: 'Organization Administrator', rank: 85 },
  { key: 'support_admin', name: 'Support Administrator', rank: 75 },
  { key: 'support_agent', name: 'Support Agent', rank: 70 },
  { key: 'moderator', name: 'Moderator', rank: 60 },
  { key: 'editor', name: 'Editor', rank: 50 },
  { key: 'author', name: 'Author', rank: 40 },
  { key: 'analyst', name: 'Analyst', rank: 35 },
  { key: 'marketing', name: 'Marketing', rank: 30 },
  { key: 'customer_support', name: 'Customer Support', rank: 25 },
  { key: 'premium_user', name: 'Premium User', rank: 20 },
  { key: 'registered_user', name: 'Registered User', rank: 10 },
  { key: 'api_client', name: 'API Client', rank: 5 },
  { key: 'guest', name: 'Guest', rank: 0 },
];

async function main() {
  console.log('Seeding enterprise RBAC and Support Center...');

  const existing = await prisma.permissionGroup.count();
  if (existing > 0) {
    console.log('RBAC already seeded, skipping...');
  } else {
    const permissionMap = new Map<string, string>();
    for (const [gi, group] of DEFAULT_PERMISSION_GROUPS.entries()) {
      const pg = await prisma.permissionGroup.create({ data: { key: group.key, name: group.name, sortOrder: gi } });
      for (const [pi, perm] of group.permissions.entries()) {
        const p = await prisma.permission.create({ data: { key: perm.key, name: perm.name, groupId: pg.id, sortOrder: pi } });
        permissionMap.set(perm.key, p.id);
      }
    }

    for (const roleDef of DEFAULT_ROLES) {
      const role = await prisma.rbacRole.create({
        data: { key: roleDef.key, name: roleDef.name, isSystem: true, rank: roleDef.rank },
      });
      const allPermIds = Array.from(permissionMap.values());
      const permKeys = Array.from(permissionMap.keys());
      if (roleDef.key === 'super_admin') {
        await prisma.rolePermission.createMany({ data: allPermIds.map((pid) => ({ roleId: role.id, permissionId: pid, granted: true })) });
      } else if (roleDef.key === 'platform_admin') {
        const allowed = new Set(['users.view', 'users.create', 'users.edit', 'users.disable',
          'roles.view', 'roles.assign', 'permissions.view', 'permissions.assign',
          'articles.create', 'articles.publish', 'articles.schedule', 'articles.archive', 'articles.delete',
          'tickets.view', 'tickets.assign', 'audit.view', 'settings.view', 'settings.update']);
        const ids = permKeys.filter((k) => allowed.has(k)).map((k) => permissionMap.get(k)!).filter(Boolean);
        await prisma.rolePermission.createMany({ data: ids.map((pid) => ({ roleId: role.id, permissionId: pid, granted: true })) });
      } else if (roleDef.key === 'organization_admin') {
        const allowed = new Set(['users.view', 'users.create', 'users.edit',
          'roles.view', 'articles.create', 'articles.publish', 'articles.schedule',
          'tickets.view', 'tickets.create', 'tickets.reply', 'tickets.close',
          'settings.view']);
        const ids = permKeys.filter((k) => allowed.has(k)).map((k) => permissionMap.get(k)!).filter(Boolean);
        await prisma.rolePermission.createMany({ data: ids.map((pid) => ({ roleId: role.id, permissionId: pid, granted: true })) });
      } else if (roleDef.key === 'support_admin') {
        const allowed = new Set(['users.view', 'tickets.view', 'tickets.create', 'tickets.assign',
          'tickets.reply', 'tickets.close', 'tickets.reopen', 'tickets.escalate']);
        const ids = permKeys.filter((k) => allowed.has(k)).map((k) => permissionMap.get(k)!).filter(Boolean);
        await prisma.rolePermission.createMany({ data: ids.map((pid) => ({ roleId: role.id, permissionId: pid, granted: true })) });
      } else if (roleDef.key === 'support_agent') {
        const allowed = new Set(['tickets.view', 'tickets.create', 'tickets.reply', 'tickets.close', 'tickets.reopen']);
        const ids = permKeys.filter((k) => allowed.has(k)).map((k) => permissionMap.get(k)!).filter(Boolean);
        await prisma.rolePermission.createMany({ data: ids.map((pid) => ({ roleId: role.id, permissionId: pid, granted: true })) });
      } else if (roleDef.key === 'moderator') {
        const allowed = new Set(['users.view', 'users.disable', 'articles.delete',
          'tickets.view', 'tickets.create', 'tickets.reply', 'audit.view']);
        const ids = permKeys.filter((k) => allowed.has(k)).map((k) => permissionMap.get(k)!).filter(Boolean);
        await prisma.rolePermission.createMany({ data: ids.map((pid) => ({ roleId: role.id, permissionId: pid, granted: true })) });
      } else if (roleDef.key === 'editor') {
        const allowed = new Set(['articles.create', 'articles.publish', 'articles.schedule', 'articles.archive',
          'tickets.view', 'tickets.create', 'tickets.reply']);
        const ids = permKeys.filter((k) => allowed.has(k)).map((k) => permissionMap.get(k)!).filter(Boolean);
        await prisma.rolePermission.createMany({ data: ids.map((pid) => ({ roleId: role.id, permissionId: pid, granted: true })) });
      } else if (roleDef.key === 'author') {
        const allowed = new Set(['articles.create', 'tickets.view', 'tickets.create', 'tickets.reply']);
        const ids = permKeys.filter((k) => allowed.has(k)).map((k) => permissionMap.get(k)!).filter(Boolean);
        await prisma.rolePermission.createMany({ data: ids.map((pid) => ({ roleId: role.id, permissionId: pid, granted: true })) });
      } else if (roleDef.key === 'analyst') {
        const allowed = new Set(['users.view', 'articles.create', 'audit.view', 'settings.view']);
        const ids = permKeys.filter((k) => allowed.has(k)).map((k) => permissionMap.get(k)!).filter(Boolean);
        await prisma.rolePermission.createMany({ data: ids.map((pid) => ({ roleId: role.id, permissionId: pid, granted: true })) });
      } else if (roleDef.key === 'marketing') {
        const allowed = new Set(['users.view', 'articles.create', 'articles.publish', 'articles.schedule',
          'tickets.view', 'tickets.create', 'tickets.reply']);
        const ids = permKeys.filter((k) => allowed.has(k)).map((k) => permissionMap.get(k)!).filter(Boolean);
        await prisma.rolePermission.createMany({ data: ids.map((pid) => ({ roleId: role.id, permissionId: pid, granted: true })) });
      } else if (roleDef.key === 'customer_support') {
        const allowed = new Set(['tickets.view', 'tickets.create', 'tickets.reply', 'tickets.close', 'tickets.reopen']);
        const ids = permKeys.filter((k) => allowed.has(k)).map((k) => permissionMap.get(k)!).filter(Boolean);
        await prisma.rolePermission.createMany({ data: ids.map((pid) => ({ roleId: role.id, permissionId: pid, granted: true })) });
      } else if (roleDef.key === 'registered_user' || roleDef.key === 'premium_user') {
        const allowed = new Set(['tickets.view', 'tickets.create', 'tickets.reply']);
        const ids = permKeys.filter((k) => allowed.has(k)).map((k) => permissionMap.get(k)!).filter(Boolean);
        await prisma.rolePermission.createMany({ data: ids.map((pid) => ({ roleId: role.id, permissionId: pid, granted: true })) });
      }
    }
    console.log('RBAC seeded');
  }

  const deptCount = await prisma.supportDepartment.count();
  if (deptCount === 0) {
    const general = await prisma.supportDepartment.create({ data: { key: 'general', name: 'General Support', email: 'support@vellbase.app' } });
    await prisma.supportTeam.create({ data: { name: 'Tier 1 Support', departmentId: general.id } });
    for (const [i, cat] of ['account', 'billing', 'technical', 'feature', 'bug'].entries()) {
      await prisma.ticketCategory.create({ data: { key: cat, name: cat.charAt(0).toUpperCase() + cat.slice(1), sortOrder: i } });
    }
    console.log('Support departments seeded');
  }

  // Assign roles to existing users
  const roleMap = new Map((await prisma.rbacRole.findMany()).map((r) => [r.key, r.id]));
  const userRoles: Array<{ email: string; roleKeys: string[] }> = [
    { email: 'admin@vellbase.com', roleKeys: ['super_admin'] },
    { email: 'moderator@vellbase.com', roleKeys: ['moderator', 'support_agent'] },
    { email: 'creator@vellbase.com', roleKeys: ['author', 'editor'] },
    { email: 'user1@example.com', roleKeys: ['registered_user'] },
    { email: 'user2@example.com', roleKeys: ['registered_user', 'premium_user'] },
  ];
  for (const { email, roleKeys } of userRoles) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) continue;
    for (const [idx, roleKey] of roleKeys.entries()) {
      const roleId = roleMap.get(roleKey);
      if (!roleId) continue;
      await prisma.userRoleAssignment.upsert({
        where: { userId_roleId: { userId: user.id, roleId } },
        create: { userId: user.id, roleId, isPrimary: idx === 0 },
        update: { isPrimary: idx === 0 },
      });
    }
  }
  // Ensure all users have at least registered_user fallback
  const regRoleId = roleMap.get('registered_user');
  if (regRoleId) {
    const allUsers = await prisma.user.findMany({ include: { roleAssignments: true } });
    for (const u of allUsers) {
      if (u.roleAssignments.length === 0) {
        await prisma.userRoleAssignment.create({
          data: { userId: u.id, roleId: regRoleId, isPrimary: true },
        });
      }
    }
  }

  console.log('Enterprise RBAC + Support seed complete!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
