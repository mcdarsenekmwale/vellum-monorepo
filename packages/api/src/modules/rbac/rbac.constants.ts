export const PERMISSIONS_KEY = 'permissions';

export const DEFAULT_PERMISSION_GROUPS = [
  {
    key: 'users',
    name: 'Users',
    permissions: [
      { key: 'users.view', name: 'View Users' },
      { key: 'users.create', name: 'Create Users' },
      { key: 'users.edit', name: 'Edit Users' },
      { key: 'users.delete', name: 'Delete Users' },
      { key: 'users.restore', name: 'Restore Users' },
      { key: 'users.disable', name: 'Disable Users' },
      { key: 'users.impersonate', name: 'Impersonate Users' },
    ],
  },
  {
    key: 'roles',
    name: 'Roles',
    permissions: [
      { key: 'roles.view', name: 'View Roles' },
      { key: 'roles.create', name: 'Create Roles' },
      { key: 'roles.edit', name: 'Edit Roles' },
      { key: 'roles.delete', name: 'Delete Roles' },
      { key: 'roles.assign', name: 'Assign Roles' },
    ],
  },
  {
    key: 'permissions',
    name: 'Permissions',
    permissions: [
      { key: 'permissions.view', name: 'View Permissions' },
      { key: 'permissions.create', name: 'Create Permissions' },
      { key: 'permissions.assign', name: 'Assign Permissions' },
      { key: 'permissions.override', name: 'Override Permissions' },
    ],
  },
  {
    key: 'articles',
    name: 'Articles',
    permissions: [
      { key: 'articles.create', name: 'Create Articles' },
      { key: 'articles.publish', name: 'Publish Articles' },
      { key: 'articles.schedule', name: 'Schedule Articles' },
      { key: 'articles.archive', name: 'Archive Articles' },
      { key: 'articles.delete', name: 'Delete Articles' },
    ],
  },
  {
    key: 'posts',
    name: 'Posts',
    permissions: [
      { key: 'posts.create', name: 'Create Posts' },
      { key: 'posts.edit', name: 'Edit Posts' },
      { key: 'posts.delete', name: 'Delete Posts' },
      { key: 'posts.feature', name: 'Feature Posts' },
    ],
  },
  {
    key: 'highlights',
    name: 'Highlights',
    permissions: [
      { key: 'highlights.create', name: 'Create Highlights' },
      { key: 'highlights.publish', name: 'Publish Highlights' },
      { key: 'highlights.delete', name: 'Delete Highlights' },
    ],
  },
  {
    key: 'videos',
    name: 'Videos',
    permissions: [
      { key: 'videos.upload', name: 'Upload Videos' },
      { key: 'videos.edit', name: 'Edit Videos' },
      { key: 'videos.delete', name: 'Delete Videos' },
    ],
  },
  {
    key: 'categories',
    name: 'Categories',
    permissions: [{ key: 'categories.manage', name: 'Manage Categories' }],
  },
  {
    key: 'tags',
    name: 'Tags',
    permissions: [{ key: 'tags.manage', name: 'Manage Tags' }],
  },
  {
    key: 'reports',
    name: 'Reports',
    permissions: [
      { key: 'reports.view', name: 'View Reports' },
      { key: 'reports.export', name: 'Export Reports' },
    ],
  },
  {
    key: 'analytics',
    name: 'Analytics',
    permissions: [
      { key: 'analytics.view', name: 'View Analytics' },
      { key: 'analytics.export', name: 'Export Analytics' },
    ],
  },
  {
    key: 'notifications',
    name: 'Notifications',
    permissions: [{ key: 'notifications.manage', name: 'Manage Notifications' }],
  },
  {
    key: 'webhooks',
    name: 'Webhooks',
    permissions: [
      { key: 'webhooks.create', name: 'Create Webhooks' },
      { key: 'webhooks.edit', name: 'Edit Webhooks' },
      { key: 'webhooks.delete', name: 'Delete Webhooks' },
      { key: 'webhooks.test', name: 'Test Webhooks' },
    ],
  },
  {
    key: 'settings',
    name: 'Settings',
    permissions: [
      { key: 'settings.view', name: 'View Settings' },
      { key: 'settings.update', name: 'Update Settings' },
    ],
  },
  {
    key: 'audit',
    name: 'Audit Logs',
    permissions: [{ key: 'audit.view', name: 'View Audit Logs' }],
  },
  {
    key: 'support',
    name: 'Support',
    permissions: [
      { key: 'tickets.view', name: 'View Tickets' },
      { key: 'tickets.create', name: 'Create Tickets' },
      { key: 'tickets.assign', name: 'Assign Tickets' },
      { key: 'tickets.reply', name: 'Reply to Tickets' },
      { key: 'tickets.close', name: 'Close Tickets' },
      { key: 'tickets.reopen', name: 'Reopen Tickets' },
      { key: 'tickets.escalate', name: 'Escalate Tickets' },
      { key: 'tickets.delete', name: 'Delete Tickets' },
    ],
  },
] as const;

export const DEFAULT_ROLES = [
  { key: 'super_admin', name: 'Super Administrator', isSystem: true, rank: 100 },
  { key: 'platform_admin', name: 'Platform Administrator', isSystem: true, rank: 90 },
  { key: 'content_admin', name: 'Content Administrator', isSystem: true, rank: 80 },
  { key: 'support_admin', name: 'Support Administrator', isSystem: true, rank: 75 },
  { key: 'support_agent', name: 'Support Agent', isSystem: true, rank: 70 },
  { key: 'moderator', name: 'Moderator', isSystem: true, rank: 60 },
  { key: 'editor', name: 'Editor', isSystem: true, rank: 50 },
  { key: 'author', name: 'Author', isSystem: true, rank: 40 },
  { key: 'analyst', name: 'Analyst', isSystem: true, rank: 35 },
  { key: 'marketing_manager', name: 'Marketing Manager', isSystem: true, rank: 30 },
  { key: 'finance', name: 'Finance', isSystem: true, rank: 25 },
  { key: 'customer_support', name: 'Customer Support', isSystem: true, rank: 20 },
  { key: 'registered_user', name: 'Registered User', isSystem: true, rank: 10 },
  { key: 'premium_user', name: 'Premium User', isSystem: true, rank: 15 },
  { key: 'read_only', name: 'Read-Only User', isSystem: true, rank: 5 },
  { key: 'api_client', name: 'API Client', isSystem: true, rank: 5 },
  { key: 'guest', name: 'Guest', isSystem: true, rank: 0 },
] as const;

export const ROLE_PERMISSION_MAP: Record<string, string[]> = {
  super_admin: ['*'],
  platform_admin: [
    'users.view', 'users.create', 'users.edit', 'users.delete', 'users.disable',
    'roles.view', 'roles.create', 'roles.edit', 'roles.assign',
    'permissions.view', 'permissions.assign',
    'articles.create', 'articles.publish', 'articles.schedule', 'articles.archive', 'articles.delete',
    'posts.create', 'posts.edit', 'posts.delete', 'posts.feature',
    'highlights.create', 'highlights.publish', 'highlights.delete',
    'videos.upload', 'videos.edit', 'videos.delete',
    'categories.manage', 'tags.manage',
    'reports.view', 'reports.export', 'analytics.view', 'analytics.export',
    'notifications.manage', 'webhooks.create', 'webhooks.edit', 'webhooks.delete', 'webhooks.test',
    'settings.view', 'settings.update', 'audit.view',
    'tickets.view', 'tickets.create', 'tickets.assign', 'tickets.reply', 'tickets.close', 'tickets.reopen', 'tickets.escalate',
  ],
  content_admin: [
    'articles.create', 'articles.publish', 'articles.schedule', 'articles.archive', 'articles.delete',
    'posts.create', 'posts.edit', 'posts.delete', 'posts.feature',
    'highlights.create', 'highlights.publish', 'highlights.delete',
    'videos.upload', 'videos.edit', 'videos.delete',
    'categories.manage', 'tags.manage',
    'reports.view', 'analytics.view',
  ],
  support_admin: [
    'tickets.view', 'tickets.create', 'tickets.assign', 'tickets.reply', 'tickets.close', 'tickets.reopen', 'tickets.escalate', 'tickets.delete',
    'users.view', 'reports.view', 'analytics.view',
  ],
  support_agent: [
    'tickets.view', 'tickets.create', 'tickets.reply', 'tickets.close', 'tickets.reopen',
    'users.view',
  ],
  moderator: [
    'users.view', 'users.disable',
    'articles.delete', 'posts.delete', 'highlights.delete',
    'reports.view', 'tickets.view', 'tickets.reply',
  ],
  editor: [
    'articles.create', 'articles.publish', 'articles.schedule', 'articles.archive',
    'posts.create', 'posts.edit', 'posts.feature',
    'highlights.create', 'highlights.publish',
    'categories.manage', 'tags.manage',
  ],
  author: [
    'articles.create', 'posts.create', 'highlights.create', 'videos.upload',
  ],
  analyst: ['reports.view', 'reports.export', 'analytics.view', 'analytics.export'],
  marketing_manager: ['posts.feature', 'analytics.view', 'notifications.manage'],
  finance: ['reports.view', 'reports.export', 'analytics.export'],
  customer_support: ['tickets.view', 'tickets.create', 'tickets.reply'],
  registered_user: ['tickets.create'],
  premium_user: ['tickets.create', 'tickets.view'],
  read_only: ['users.view', 'reports.view', 'analytics.view', 'tickets.view'],
  api_client: ['articles.create', 'posts.create'],
  guest: [],
};
