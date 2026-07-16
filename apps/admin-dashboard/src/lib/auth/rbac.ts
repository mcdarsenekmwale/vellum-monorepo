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
  | "billing";

export type Action = "read" | "write" | "delete" | "admin" | "moderate" | "export";

// Minimum role required to perform an action on a resource.
const MATRIX: Record<Resource, Record<Action, Role>> = {
  users:       { read: "Moderator", write: "Admin",     delete: "Admin",     admin: "SuperAdmin", moderate: "Moderator", export: "Admin" },
  roles:       { read: "Admin",     write: "SuperAdmin",delete: "SuperAdmin",admin: "SuperAdmin", moderate: "Moderator", export: "Admin" },  
  articles:    { read: "User",      write: "Creator",   delete: "Editor",    admin: "Admin", moderate: "Moderator", export: "Admin" },
  posts:       { read: "User",      write: "Creator",   delete: "Moderator", admin: "Admin", moderate: "Moderator", export: "Admin" },
  highlights:  { read: "User",      write: "Creator",   delete: "Editor",    admin: "Admin", moderate: "Moderator", export: "Admin" },
  videos:      { read: "User",      write: "Creator",   delete: "Editor",    admin: "Admin", moderate: "Moderator", export: "Admin" },
  media:       { read: "User",      write: "Creator",   delete: "Editor",    admin: "Admin", moderate: "Moderator", export: "Admin" },
  music:       { read: "User",      write: "Editor",    delete: "Editor",    admin: "Admin", moderate: "Moderator", export: "Admin" },
  comments:    { read: "User",      write: "User",      delete: "Moderator", admin: "Admin", moderate: "Moderator", export: "Admin" },
  reports:     { read: "Moderator", write: "Moderator", delete: "Admin",     admin: "Admin", moderate: "Moderator", export: "Admin" },
  moderation:  { read: "Moderator", write: "Moderator", delete: "Admin",     admin: "Admin", moderate: "Moderator", export: "Admin" },
  webhooks:    { read: "Admin",     write: "Admin",     delete: "Admin",     admin: "SuperAdmin", moderate: "Moderator", export: "Admin" },
  "api.keys":  { read: "Admin",     write: "Admin",     delete: "Admin",     admin: "SuperAdmin", moderate: "Moderator", export: "Admin" },
  "ai.agents": { read: "Editor",    write: "Admin",     delete: "Admin",     admin: "SuperAdmin", moderate: "Moderator", export: "Admin" },
  storage:     { read: "Admin",     write: "Admin",     delete: "SuperAdmin",admin: "SuperAdmin", moderate: "Moderator", export: "Admin" },
  audit:       { read: "Admin",     write: "SuperAdmin",delete: "SuperAdmin",admin: "SuperAdmin", moderate: "Moderator", export: "Admin" },
  flags:       { read: "Admin",     write: "SuperAdmin",delete: "SuperAdmin",admin: "SuperAdmin", moderate: "Moderator", export: "Admin" },
  settings:    { read: "Admin",     write: "Admin",     delete: "SuperAdmin",admin: "SuperAdmin", moderate: "Moderator", export: "Admin" },
  billing:     { read: "Admin",     write: "SuperAdmin",delete: "SuperAdmin",admin: "SuperAdmin", moderate: "Moderator", export: "Admin" },
  categories:  { read: "Editor",    write: "Admin",     delete: "Editor",    admin: "Admin", moderate: "Moderator", export: "Admin" },
  tags:        { read: "Editor",    write: "Admin",     delete: "Editor",    admin: "Admin", moderate: "Moderator", export: "Admin" },
  follows:     { read: "Moderator", write: "Admin",     delete: "Admin",     admin: "SuperAdmin", moderate: "Moderator", export: "Admin" },
  notifications: { read: "User",      write: "User",      delete: "Editor",    admin: "Admin", moderate: "Moderator", export: "Admin" },
  advertisements:{ read: "Editor",    write: "Admin",     delete: "Admin",     admin: "Admin", moderate: "Moderator", export: "Admin" },
};

export function can(role: Role | undefined, resource: Resource, action: Action = "read") {
  if (!role) return false;
  const min = MATRIX[resource]?.[action];
  if (!min) return false;
  return roleAtLeast(role, min);
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
  { prefix: "/articles", min: "User" },
  { prefix: "/posts", min: "User" },
  { prefix: "/highlights", min: "User" },
  { prefix: "/videos", min: "User" },
  { prefix: "/media", min: "Creator" },
  { prefix: "/music", min: "User" },
  { prefix: "/playlists", min: "User" },
  { prefix: "/categories", min: "Editor" },
  { prefix: "/tags", min: "Editor" },
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
];

export function requiredRoleFor(path: string): Role {
  const hit = ROUTE_ACCESS.find((r) => path === r.prefix || path.startsWith(r.prefix + "/"));
  return hit?.min ?? "User";
}

export function canVisit(role: Role | undefined, path: string) {
  return roleAtLeast(role, requiredRoleFor(path));
}
