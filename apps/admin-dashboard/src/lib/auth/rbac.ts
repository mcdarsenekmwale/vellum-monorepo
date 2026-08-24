// lib/auth/roles.ts

// ─── Role Definitions ───
// Single source of truth for all roles in the system
export const ROLES = [
  "Guest",
  "User", 
  "Creator",
  "Moderator",
  "Editor",
  "Publisher",
  "SupportAgent",
  "SupportAdmin",
  "PlatformAdmin",
  "Admin",
  "SuperAdmin"
] as const;

export type Role = (typeof ROLES)[number];

// ─── Role Ranking ───
// Higher number = more privilege
const RANK: Record<Role, number> = {
  Guest: 0,
  User: 1,
  Creator: 2,
  SupportAgent: 3,
  Editor: 4,
  Publisher: 5,
  Moderator: 6,
  SupportAdmin: 7,
  PlatformAdmin: 8,
  Admin: 9,
  SuperAdmin: 10,
};

// ─── Helper Functions ───

/**
 * Normalize any backend role format to canonical Role
 * Handles: UPPER_SNAKE_CASE, snake_case, camelCase, kebab-case, PascalCase, "Space separated"
 */
export function normalizeRole(raw: string | null | undefined): Role | undefined {
  if (!raw) return undefined;
  
  // Remove separators and normalize case
  const flat = String(raw)
    .replace(/[_\s\-]+/g, "")
    .toUpperCase();
  
  for (const candidate of ROLES) {
    if (candidate.toUpperCase() === flat) return candidate;
  }
  
  // Handle special cases like "SUPPORT_ADMIN" -> "SupportAdmin"
  const specialCases: Record<string, Role> = {
    SUPPORTADMIN: "SupportAdmin",
    SUPPORTAGENT: "SupportAgent",
    SUPERADMIN: "SuperAdmin",
  };
  
  if (flat in specialCases) {
    return specialCases[flat];
  }
  
  return undefined;
}

/**
 * Get the rank of a role (0 = least privileged)
 */
export function roleRank(role: Role | string | undefined | null): number {
  const canonical = normalizeRole(role as string);
  if (!canonical) return 0;
  return RANK[canonical] ?? 0;
}

/**
 * Check if a role is at least the minimum required role
 */
export function roleAtLeast(role: Role | undefined, min: Role): boolean {
  if (!role) return false;
  
  return roleRank(role) >= roleRank(min);
}

// ─── Resource and Action Definitions ───

export type Resource = 
  | "users"
  | "roles"
  | "permissions"
  | "articles"
  | "posts"
  | "highlights"
  | "videos"
  | "media"
  | "music"
  | "playlists"
  | "categories"
  | "tags"
  | "comments"
  | "reports"
  | "moderation"
  | "followers"
  | "notifications"
  | "analytics"
  | "advertisements"
  | "ai"
  | "webhooks"
  | "jobs"
  | "storage"
  | "api"
  | "audit"
  | "flags"
  | "settings"
  | "profile"
  | "support"
  | "support_tickets"
  | "support_agents"
  | "support_teams"
  | "support_departments"
  | "support_kb"
  | "access_control"
  | "role_requests";

export type Action = "read" | "write" | "delete" | "admin" | "moderate" | "export";

// ─── Permission Matrix ───
// Minimum role required for each action on each resource
const MATRIX: Record<Resource, Partial<Record<Action, Role>>> = {
  // People
  users:       { read: "Moderator", write: "Admin", delete: "Admin", admin: "SuperAdmin", moderate: "Moderator", export: "Admin" },
  roles:       { read: "Admin", write: "SuperAdmin", delete: "SuperAdmin", admin: "SuperAdmin", moderate: "Moderator", export: "Admin" },
  permissions: { read: "Admin", write: "SuperAdmin", delete: "SuperAdmin", admin: "SuperAdmin", moderate: "Moderator", export: "Admin" },
  
  // Content
  articles:    { read: "Guest", write: "Creator", delete: "Editor", admin: "Admin", moderate: "Moderator", export: "Admin" },
  posts:       { read: "Guest", write: "Creator", delete: "Moderator", admin: "Admin", moderate: "Moderator", export: "Admin" },
  highlights:  { read: "Guest", write: "Creator", delete: "Editor", admin: "Admin", moderate: "Moderator", export: "Admin" },
  videos:      { read: "Guest", write: "Creator", delete: "Editor", admin: "Admin", moderate: "Moderator", export: "Admin" },
  media:       { read: "Guest", write: "Creator", delete: "Editor", admin: "Admin", moderate: "Moderator", export: "Admin" },
  music:       { read: "Guest", write: "Editor", delete: "Editor", admin: "Admin", moderate: "Moderator", export: "Admin" },
  playlists:   { read: "Guest", write: "Creator", delete: "Editor", admin: "Admin", moderate: "Moderator", export: "Admin" },
  categories:  { read: "Guest", write: "Admin", delete: "Editor", admin: "Admin", moderate: "Moderator", export: "Admin" },
  tags:        { read: "Guest", write: "Admin", delete: "Editor", admin: "Admin", moderate: "Moderator", export: "Admin" },
  
  // Community
  comments:    { read: "Guest", write: "User", delete: "Moderator", admin: "Admin", moderate: "Moderator", export: "Admin" },
  reports:     { read: "Moderator", write: "Moderator", delete: "Admin", admin: "Admin", moderate: "Moderator", export: "Admin" },
  moderation:  { read: "Moderator", write: "Moderator", delete: "Admin", admin: "Admin", moderate: "Moderator", export: "Admin" },
  followers:   { read: "Moderator", write: "Admin", delete: "Admin", admin: "SuperAdmin", moderate: "Moderator", export: "Admin" },
  notifications: { read: "User", write: "User", delete: "Editor", admin: "Admin", moderate: "Moderator", export: "Admin" },
  
  // Growth
  analytics:   { read: "Editor", write: "Admin", delete: "SuperAdmin", admin: "SuperAdmin", moderate: "Moderator", export: "Admin" },
  advertisements: { read: "Editor", write: "Admin", delete: "Admin", admin: "Admin", moderate: "Moderator", export: "Admin" },
  
  // Platform
  ai:          { read: "Editor", write: "Admin", delete: "Admin", admin: "SuperAdmin", moderate: "Moderator", export: "Admin" },
  webhooks:    { read: "Admin", write: "Admin", delete: "Admin", admin: "SuperAdmin", moderate: "Moderator", export: "Admin" },
  jobs:        { read: "Admin", write: "SuperAdmin", delete: "SuperAdmin", admin: "SuperAdmin", moderate: "Moderator", export: "Admin" },
  storage:     { read: "Admin", write: "Admin", delete: "SuperAdmin", admin: "SuperAdmin", moderate: "Moderator", export: "Admin" },
  api:         { read: "Admin", write: "Admin", delete: "Admin", admin: "SuperAdmin", moderate: "Moderator", export: "Admin" },
  
  // System
  audit:       { read: "Admin", write: "SuperAdmin", delete: "SuperAdmin", admin: "SuperAdmin", moderate: "Moderator", export: "Admin" },
  flags:       { read: "Admin", write: "SuperAdmin", delete: "SuperAdmin", admin: "SuperAdmin", moderate: "Moderator", export: "Admin" },
  settings:    { read: "Admin", write: "Admin", delete: "SuperAdmin", admin: "SuperAdmin", moderate: "Moderator", export: "Admin" },
  profile:     { read: "User", write: "User", delete: "User", admin: "Admin", moderate: "Moderator", export: "Admin" },
  
  // Support
  support:             { read: "SupportAgent", write: "SupportAdmin", delete: "Admin", admin: "Admin", moderate: "SupportAdmin", export: "Admin" },
  support_tickets:     { read: "SupportAgent", write: "SupportAgent", delete: "SupportAdmin", admin: "Admin", moderate: "SupportAdmin", export: "Admin" },
  support_agents:      { read: "SupportAdmin", write: "SupportAdmin", delete: "SupportAdmin", admin: "Admin", moderate: "SupportAdmin", export: "Admin" },
  support_teams:       { read: "SupportAdmin", write: "SupportAdmin", delete: "SupportAdmin", admin: "Admin", moderate: "SupportAdmin", export: "Admin" },
  support_departments: { read: "SupportAdmin", write: "SupportAdmin", delete: "SupportAdmin", admin: "Admin", moderate: "SupportAdmin", export: "Admin" },
  support_kb:          { read: "SupportAgent", write: "SupportAdmin", delete: "SupportAdmin", admin: "Admin", moderate: "SupportAdmin", export: "Admin" },
  
  // Access Control
  access_control: { read: "Admin", write: "SuperAdmin", delete: "SuperAdmin", admin: "SuperAdmin", moderate: "Moderator", export: "Admin" },
  role_requests:  { read: "User", write: "User", delete: "Admin", admin: "Admin", moderate: "Moderator", export: "Admin" },
};

// ─── Permission Check Functions ───

/**
 * Check if a role can perform an action on a resource
 */
export function can(
  role: Role | undefined,
  resource: Resource,
  action: Action = "read"
): boolean {
  if (!role) return false;
  const min = MATRIX[resource]?.[action];
  if (!min) return false;
  return roleAtLeast(role, min);
}

/**
 * Check if a user has read access to a resource
 */
export function canRead(role: Role | undefined, resource: Resource): boolean {
  return can(role, resource, "read");
}

/**
 * Check if a user has write access to a resource
 */
export function canWrite(role: Role | undefined, resource: Resource): boolean {
  return can(role, resource, "write");
}

/**
 * Check if a user can moderate a resource
 */
export function canModerate(role: Role | undefined, resource: Resource): boolean {
  return can(role, resource, "moderate");
}

/**
 * Check if a user can admin a resource
 */
export function canAdmin(role: Role | undefined, resource: Resource): boolean {
  return can(role, resource, "admin");
}

// ─── Route Access Control ───
// Order matters: more specific prefixes must come first

interface RouteAccess {
  prefix: string;
  min: Role;
}

export const ROUTE_ACCESS: RouteAccess[] = [
  // ─── Public Routes ───
  { prefix: "/", min: "Guest" },
  
  // ─── User Routes ───
  { prefix: "/dashboard", min: "User" },
  { prefix: "/profile", min: "User" },
  { prefix: "/notifications", min: "Admin" },
  { prefix: "/status", min: "User" },
  
  // ─── Access Routes ───
  { prefix: "/request-access", min: "User" }, // Must be before /roles
  { prefix: "/role-requests", min: "Admin" }, // Users can see their own requests
  
  // ─── Creator Routes ───
  { prefix: "/media", min: "Creator" },
  
  // ─── Editor Routes ───
  { prefix: "/analytics", min: "Editor" },
  { prefix: "/advertisements", min: "Editor" },
  { prefix: "/ai", min: "Editor" },
  
  // ─── Moderator Routes ───
  { prefix: "/users/deleted", min: "Admin" },
  { prefix: "/users", min: "Moderator" }, // Must be before /users/deleted
  { prefix: "/followers", min: "Moderator" },
  { prefix: "/comments", min: "Moderator" },
  { prefix: "/reports", min: "Moderator" },
  { prefix: "/moderation", min: "Moderator" },
  
  // ─── Admin Routes ───
  { prefix: "/roles", min: "Admin" }, // Must be after /roles/request
  { prefix: "/jobs", min: "Admin" },
  { prefix: "/status", min: "Admin" },
  { prefix: "/permissions", min: "Admin" },
  { prefix: "/webhooks", min: "Admin" },
  { prefix: "/api", min: "Admin" },
  { prefix: "/audit", min: "Admin" },
  { prefix: "/storage", min: "Admin" },
  { prefix: "/flags", min: "Admin" },
  { prefix: "/settings", min: "Admin" },
  { prefix: "/access-control", min: "Admin" },
  
  // ─── Support Routes ───
 
  { prefix: "/support/canned-responses", min: "SupportAdmin" },
  { prefix: "/support/departments", min: "SupportAdmin" },
  { prefix: "/support/teams", min: "SupportAdmin" },
  { prefix: "/support/tickets/deleted", min: "Admin" },
  { prefix: "/support/agents", min: "SupportAdmin" },
  { prefix: "/support/kb", min: "SupportAgent" },
  { prefix: "/support/canned-responses", min: "SupportAgent" },
  { prefix: "/support/tickets/access-requests", min: "SupportAdmin" },
  { prefix: "/support/tickets", min: "SupportAgent" },
  { prefix: "/support/reports", min: "SupportAdmin" },
  { prefix: "/support/comparisons", min: "SupportAdmin" },
   { prefix: "/support", min: "SupportAgent" }, // Must be before specific support routes
  { prefix: "/help", min: "Guest" }, // Help center is public
];

/**
 * Get the minimum role required to access a route
 */
export function requiredRoleFor(path: string): Role {
  const hit = ROUTE_ACCESS.find((r) => 
    path === r.prefix || path.startsWith(r.prefix + "/")
  );
  
  return hit?.min ?? "User";
}

/**
 * Check if a role can visit a route
 */
export function canVisit(role: Role | undefined, path: string): boolean {
  if (path === '/support/tickets/access-requests') {
    return role === 'SupportAdmin';  
  }
  return roleAtLeast(role, requiredRoleFor(path));
}

// ─── Permissions Summary ───

/**
 * Get all permissions for a role as a flat map
 */
export function getPermissions(
  role: Role | undefined
): Record<Resource, Record<Action, boolean>> {
  const result = {} as Record<Resource, Record<Action, boolean>>;
  
  for (const resource of Object.keys(MATRIX) as Resource[]) {
    result[resource] = {
      read: can(role, resource, "read"),
      write: can(role, resource, "write"),
      delete: can(role, resource, "delete"),
      admin: can(role, resource, "admin"),
      moderate: can(role, resource, "moderate"),
      export: can(role, resource, "export"),
    };
  }
  
  return result;
}

/**
 * Get a summary of what a role can do
 */
export function getRoleSummary(role: Role | undefined): {
  role: Role | undefined;
  rank: number;
  canRead: string[];
  canWrite: string[];
  canModerate: string[];
  canAdmin: string[];
} {
  if (!role) {
    return {
      role: undefined,
      rank: 0,
      canRead: [],
      canWrite: [],
      canModerate: [],
      canAdmin: [],
    };
  }

  const resources = Object.keys(MATRIX) as Resource[];
  const canRead: string[] = [];
  const canWrite: string[] = [];
  const canModerate: string[] = [];
  const canAdmin: string[] = [];

  for (const resource of resources) {
    if (can(role, resource, "read")) canRead.push(resource);
    if (can(role, resource, "write")) canWrite.push(resource);
    if (can(role, resource, "moderate")) canModerate.push(resource);
    if (can(role, resource, "admin")) canAdmin.push(resource);
  }

  return {
    role,
    rank: roleRank(role),
    canRead,
    canWrite,
    canModerate,
    canAdmin,
  };
}