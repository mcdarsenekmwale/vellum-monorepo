// Role-based access control — 7-role model.
// This is the source of truth for role hierarchy and permission checks.

export const ROLES = [
  "Guest",
  "User",
  "Creator",
  "Moderator",
  "Editor",
  "Admin",
  "SuperAdmin",
] as const;

export type Role = (typeof ROLES)[number];

// Higher number = more privilege.
const RANK: Record<Role, number> = {
  Guest: 0,
  User: 1,
  Creator: 2,
  Moderator: 3,
  Editor: 4,
  Admin: 5,
  SuperAdmin: 6,
};

export function roleRank(role: Role) {
  return RANK[role] ?? 0;
}

export function roleAtLeast(role: Role | undefined, min: Role) {
  if (!role) return false;
  return roleRank(role) >= roleRank(min);
}

// Resource keys used across the app. Add here when adding new gates.
export type Resource =
  | "users"
  | "roles"
  | "articles"
  | "posts"
  | "highlights"
  | "videos"
  | "media"
  | "music"
  | "comments"
  | "categories"
  | "reports"
  | "moderation"
  | "webhooks"
  | "api.keys"
  | "ai.agents"
  | "storage"
  | "audit"
  | "flags"
  | "settings"
  | "tags"
  | "follows"
  | "notifications"
  | "advertisements"
  | "billing"
  | "support";

export type Action = "read" | "write" | "delete" | "admin" | "moderate" | "export";

// Minimum role required to perform an action on a resource.
// Guest (rank 0) has read-only access to public content.
const MATRIX: Record<Resource, Record<Action, Role>> = {
  users:       { read: "Moderator", write: "Admin",     delete: "Admin",     admin: "SuperAdmin", moderate: "Moderator", export: "Admin" },
  roles:       { read: "Admin",     write: "SuperAdmin",delete: "SuperAdmin",admin: "SuperAdmin", moderate: "Moderator", export: "Admin" },
  articles:    { read: "Guest",     write: "Creator",   delete: "Editor",    admin: "Admin",      moderate: "Moderator", export: "Admin" },
  posts:       { read: "Guest",     write: "Creator",   delete: "Moderator", admin: "Admin",      moderate: "Moderator", export: "Admin" },
  highlights:  { read: "Guest",     write: "Creator",   delete: "Editor",    admin: "Admin",      moderate: "Moderator", export: "Admin" },
  videos:      { read: "Guest",     write: "Creator",   delete: "Editor",    admin: "Admin",      moderate: "Moderator", export: "Admin" },
  media:       { read: "Guest",     write: "Creator",   delete: "Editor",    admin: "Admin",      moderate: "Moderator", export: "Admin" },
  music:       { read: "Guest",     write: "Editor",    delete: "Editor",    admin: "Admin",      moderate: "Moderator", export: "Admin" },
  comments:    { read: "Guest",     write: "User",      delete: "Moderator", admin: "Admin",      moderate: "Moderator", export: "Admin" },
  reports:     { read: "Moderator", write: "Moderator", delete: "Admin",     admin: "Admin",      moderate: "Moderator", export: "Admin" },
  moderation:  { read: "Moderator", write: "Moderator", delete: "Admin",     admin: "Admin",      moderate: "Moderator", export: "Admin" },
  webhooks:    { read: "Admin",     write: "Admin",     delete: "Admin",     admin: "SuperAdmin", moderate: "Moderator", export: "Admin" },
  "api.keys":  { read: "Admin",     write: "Admin",     delete: "Admin",     admin: "SuperAdmin", moderate: "Moderator", export: "Admin" },
  "ai.agents": { read: "Editor",    write: "Admin",     delete: "Admin",     admin: "SuperAdmin", moderate: "Moderator", export: "Admin" },
  storage:     { read: "Admin",     write: "Admin",     delete: "SuperAdmin",admin: "SuperAdmin", moderate: "Moderator", export: "Admin" },
  audit:       { read: "Admin",     write: "SuperAdmin",delete: "SuperAdmin",admin: "SuperAdmin", moderate: "Moderator", export: "Admin" },
  flags:       { read: "Admin",     write: "SuperAdmin",delete: "SuperAdmin",admin: "SuperAdmin", moderate: "Moderator", export: "Admin" },
  settings:    { read: "Admin",     write: "Admin",     delete: "SuperAdmin",admin: "SuperAdmin", moderate: "Moderator", export: "Admin" },
  billing:     { read: "Admin",     write: "SuperAdmin",delete: "SuperAdmin",admin: "SuperAdmin", moderate: "Moderator", export: "Admin" },
  categories:  { read: "Guest",     write: "Admin",     delete: "Editor",    admin: "Admin",      moderate: "Moderator", export: "Admin" },
  tags:        { read: "Guest",     write: "Admin",     delete: "Editor",    admin: "Admin",      moderate: "Moderator", export: "Admin" },
  follows:     { read: "Moderator", write: "Admin",     delete: "Admin",     admin: "SuperAdmin", moderate: "Moderator", export: "Admin" },
  notifications: { read: "User",    write: "User",      delete: "Editor",    admin: "Admin",      moderate: "Moderator", export: "Admin" },
  advertisements:{ read: "Editor",   write: "Admin",     delete: "Admin",     admin: "Admin",      moderate: "Moderator", export: "Admin" },
  support:     { read: "Moderator", write: "Moderator", delete: "Admin",     admin: "Admin",      moderate: "Moderator", export: "Admin" },
};

/**
 * Check if a role can perform an action on a resource.
 * Guest users have read-only access to public content (articles, posts, highlights, etc.).
 */
export function can(role: Role | undefined, resource: Resource, action: Action = "read") {
  if (!role) return false;
  const min = MATRIX[resource]?.[action];
  if (!min) return false;
  return roleAtLeast(role, min);
}

/**
 * Check if a user has read-only (view) access to a resource.
 * Useful for determining if content should be visible but not editable.
 */
export function canRead(role: Role | undefined, resource: Resource) {
  return can(role, resource, "read");
}

/**
 * Check if a user has write access to a resource.
 */
export function canWrite(role: Role | undefined, resource: Resource) {
  return can(role, resource, "write");
}

// Route -> minimum role required to view. Used by the auth guard and nav filter.
// Keys are path prefixes checked with startsWith.
export const ROUTE_ACCESS: { prefix: string; min: Role }[] = [
  { prefix: "/dashboard", min: "User" },
  { prefix: "/profile", min: "User" },
  { prefix: "/help", min: "Guest" },
  { prefix: "/notifications", min: "User" },
  { prefix: "/analytics", min: "Editor" },
  { prefix: "/users", min: "Moderator" },
  { prefix: "/followers", min: "Moderator" },
  { prefix: "/roles", min: "Admin" },
  { prefix: "/permissions", min: "Admin" },
  { prefix: "/articles", min: "Guest" },
  { prefix: "/posts", min: "Guest" },
  { prefix: "/highlights", min: "Guest" },
  { prefix: "/videos", min: "Guest" },
  { prefix: "/media", min: "Creator" },
  { prefix: "/music", min: "Guest" },
  { prefix: "/playlists", min: "Guest" },
  { prefix: "/categories", min: "Guest" },
  { prefix: "/tags", min: "Guest" },
  { prefix: "/comments", min: "Moderator" },
  { prefix: "/reports", min: "Moderator" },
  { prefix: "/moderation", min: "Moderator" },
  { prefix: "/advertisements", min: "Editor" },
  { prefix: "/ai", min: "Editor" },
  { prefix: "/webhooks", min: "Admin" },
  { prefix: "/api", min: "Admin" },
  { prefix: "/audit", min: "Admin" },
  { prefix: "/storage", min: "Admin" },
  { prefix: "/status", min: "User" },
  { prefix: "/jobs", min: "Admin" },
  { prefix: "/flags", min: "Admin" },
  { prefix: "/settings", min: "Admin" },
  { prefix: "/support", min: "Moderator" },
];

export function requiredRoleFor(path: string): Role {
  const hit = ROUTE_ACCESS.find((r) => path === r.prefix || path.startsWith(r.prefix + "/"));
  return hit?.min ?? "User";
}

export function canVisit(role: Role | undefined, path: string) {
  return roleAtLeast(role, requiredRoleFor(path));
}

/**
 * Get all permissions for a role as a flat map.
 * Useful for displaying what a user can/cannot do.
 */
export function getPermissions(role: Role | undefined): Record<Resource, Record<Action, boolean>> {
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
