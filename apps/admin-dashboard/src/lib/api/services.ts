import { api, type Paginated, API_BASE_URL } from "./client";

// ─── Dashboard ──────────────────────────────────────────────────────────────

export interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalArticles: number;
  totalHighlights: number;
  totalComments: number;
  totalLikes: number;
  totalViews: number;
  newUsersThisWeek: number;
  newArticlesThisWeek: number;
}

// ─── Users ──────────────────────────────────────────────────────────────────

export interface User {
  lastLoginAt: any;
  id: string;
  email: string;
  handle: string;
  name: string;
  role: string;
  isActive: boolean;
  avatar: string | null;
  bio: string | null;
  publication: string | null;
  createdAt: string;
  updatedAt: string;

  location?: string;
  website?: string;

  //
  followersCount?: number;
  followingCount?: number;

  twoFactorEnabled?: boolean;
  emailNotifications?: boolean;
}

// ─── Articles ───────────────────────────────────────────────────────────────

export interface Article {
  tagIds: any;
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body?: string[];
  cover: string | null;
  readMinutes: number;
  categoryId: string;
  authorId: string;
  likesCount: number;
  views: number;
  featured: boolean;
  isPublished: boolean;
  publishedAt: string | null;
  commentsCount: number;
  createdAt: string;
  updatedAt: string;
  author?: { id: string; handle: string; name: string };
  category?: { id: string; name: string; slug: string };
}

// ─── Categories ─────────────────────────────────────────────────────────────

export interface Category {
  isVisible: boolean;
  description: any;
  id: string;
  name: string;
  slug: string;
  tint: string;
  sortOrder?: number;
  createdAt?: string;
  updatedAt?: string;
}

// ─── Comments ───────────────────────────────────────────────────────────────

export interface Comment {
  id: string;
  articleSlug: string | null;
  highlightId: string | null;
  authorId: string;
  body: string;
  status: string;
  isSpam: boolean;
  isFlag: boolean;
  isHidden: boolean;
  parentId: string | null;
  likesCount: number;
  repliesCount: number;
  createdAt: string;
  updatedAt: string;
  author?: { id: string; handle: string; name: string; avatar: string | null };
}

// ─── Notifications ──────────────────────────────────────────────────────────

export interface Notification {
  link: any;
  targetId: any;
  title: string;
  metadata: any;
  readAt: boolean;
  scheduledFor: any;
  id: string;
  userId: string;
  actorId: string | null;
  kind: string;
  articleSlug: string | null;
  highlightId: string | null;
  commentId: string | null;
  body: string | null;
  read: boolean;
  createdAt: string;
  updatedAt: string;
  user?: { id: string; handle: string; name: string; avatar: string | null; email: string };
  actor?: { id: string; handle: string; name: string; avatar: string | null; email: string };
}

// ─── Highlights ─────────────────────────────────────────────────────────────

export interface Highlight {
  id: string;
  title: string;
  cover: string | null;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  handle: string;
  authorId: string | null;
  likesCount: number;
  viewsCount: number;
  commentsCount: number;
  shares: number;
  description: string | null;
  aspectRatio: number | null;
  duration: number | null;
  isPublished: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  author?: { id: string; handle: string; name: string; avatar: string | null };
}

// ─── Media ──────────────────────────────────────────────────────────────────

export interface MediaAsset {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  type: string;
  url: string;
  thumbnailUrl: string | null;
  width: number | null;
  height: number | null;
  uploadedBy: string;
  createdAt: string;
  uploader?: { id: string; handle: string; name: string; avatar: string | null };
}

// ─── Follows ────────────────────────────────────────────────────────────────

export interface FollowRecord {
  id: string;
  followerId: string;
  followingId: string;
  createdAt: string;
  follower?: { id: string; handle: string; name: string; avatar: string | null };
  following?: { id: string; handle: string; name: string; avatar: string | null };
}

// ─── Reports ────────────────────────────────────────────────────────────────

export interface Report {
  aiScore: number;
  id: string;
  targetType: string;
  targetId: string;
  reason: string;
  reporterId: string;
  status: string;
  priority: string;
  notes: string | null;
  resolvedById: string | null;
  description?: string;
  reporter?: {
    id: string;
    name: string;
    handle: string;
    avatarUrl?: string;
  };
  moderator?: {
    id: string;
    name: string;
  };
  moderationNote?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReportStats {
  openTrend?: number;
  criticalTrend?: number;
  resolvedTrend?: number;
  aiScoreTrend?: number;

  total: number;
  pending: number;
  inProgress: number;
  resolved: number;
  dismissed: number;
  autoActioned: number;
  byTargetType: { targetType: string; count: number }[];
  byReason: { reason: string; count: number }[];
  byPriority: { priority: string; count: number }[];
  avgResolutionTimeMs: number | null;
  newThisWeek: number;
  resolvedThisWeek: number;
}

// ─── Tags ───────────────────────────────────────────────────────────────────

export interface Tag {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt?: string;
}

// ─── Feature Flags ──────────────────────────────────────────────────────────

export interface FeatureFlag {
  id: string;
  key: string;
  description: string;
  enabled: boolean;
  rollout: number;
  createdAt: string;
  updatedAt: string;
}

// ─── System Settings ────────────────────────────────────────────────────────

export interface SystemSetting {
  id: string;
  key: string;
  value: string;
  category: string;
  description?: string;
  version?: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Advertisements ─────────────────────────────────────────────────────────

export interface Advertisement {
  id: string;
  name: string;
  status: string;
  impressions: number;
  clicks: number;
  spend: number;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── AI Agents ──────────────────────────────────────────────────────────────

export interface AIAgent {
  id: string;
  name: string;
  description: string | null;
  model: string;
  status: string;
  runs: number;
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
  config: Record<any, any>;
  featured?: any;
}

// ─── Background Jobs ────────────────────────────────────────────────────────

export interface BackgroundJob {
  id: string;
  name: string;
  queue: string;
  status: string;
  duration: number | null;
  error: string | null;
  ranAt: string;
  createdAt: string;
}

// ─── Webhooks ───────────────────────────────────────────────────────────────

export interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  secret: string;
  events: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  webhookLogs?: WebhookLog[];
}

export interface WebhookLog {
  id: string;
  webhookId: string;
  event: string;
  payload: unknown;
  statusCode: number | null;
  response: string | null;
  error: string | null;
  createdAt: string;
}

// ─── API Keys ───────────────────────────────────────────────────────────────

export interface ApiKey {
  id: string;
  name: string;
  key: string;
  userId: string | null;
  scopes: string[];
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  user?: { id: string; handle: string; name: string } | null;
}

// ─── Analytics ──────────────────────────────────────────────────────────────

export interface AnalyticsOverview {
  totalUsers: number;
  activeUsers: number;
  totalArticles: number;
  totalHighlights: number;
  totalComments: number;
  totalLikes: number;
  totalViews: number;
  dailyActiveUsers: number;
  weeklyActiveUsers: number;
  newUsersToday: number;
  newContentToday: number;
}

export interface TimeseriesPoint {
  date: string;
  users: number;
  articles: number;
  highlights: number;
  comments: number;
}

export interface TrafficSourceItem {
  name: string;
  views: number;
  count: number;
}

export interface TrafficSourcesResponse {
  sources: TrafficSourceItem[];
  totalArticleViews: number;
  highlightEngagement: number;
  totalViews: number;
}

// ─── Storage ────────────────────────────────────────────────────────────────

export interface StorageStats {
  totalSize: number;
  totalFiles: number;
  byType: { type: string; count: number; size: number }[];
}

// ─── System Status ──────────────────────────────────────────────────────────

export interface SystemStatus {
  database: "ok" | "error";
  timestamp: string;
  counts: {
    activeUsers: number;
    totalArticles: number;
    totalHighlights: number;
    totalComments: number;
    totalMedia: number;
    pendingJobs: number;
    openReports: number;
    activeSessions: number;
  };
}

// ─── Roles ──────────────────────────────────────────────────────────────────
// Legacy RoleWithCount is superseded by AdminRoleOption / AdminRolesResponse.
// Retained temporarily for backward-compat type references in hooks.ts exports.
export interface RoleWithCount {
  role: string;
  count: number;
}

// ─── API Functions ──────────────────────────────────────────────────────────

// Dashboard
export async function getDashboardStats(): Promise<DashboardStats> {
  return api("/admin/dashboard");
}

// Users
export async function getUsers(params?: {
  page?: number;
  limit?: number;
  sort?: string;
  filter?: string;
  except?: string;
}): Promise<Paginated<User>> {
  return api("/admin/users", { query: params });
}

export async function getUserById(id: string): Promise<User> {
  return api(`/admin/users/${id}`);
}

export async function getCurrentUser(): Promise<User> {
  return api("/users/me");
}

// Valid Prisma Role enum values — MUST match `enum Role` in schema.prisma
// exactly.  The full 8-level hierarchy (least → most privileged):
//   GUEST → USER → CREATOR → MODERATOR → SUPPORT_ADMIN → ADMIN → PLATFORM_ADMIN → SUPER_ADMIN
//
// Custom RBAC roles from the RbacRole table (e.g. "organization_admin",
// "editor", "analyst") are NOT part of this enum — the backend stores them
// as primary assignments in UserRoleAssignment, writing the nearest
// matching legacy equivalent (via RBAC_TO_LEGACY mapping) to user.role.
export const VALID_LEGACY_ROLES: readonly ValidLegacyRole[] = [
  "GUEST",
  "USER",
  "CREATOR",
  "MODERATOR",
  "SUPPORT_ADMIN",
  "ADMIN",
  "PLATFORM_ADMIN",
  "SUPER_ADMIN",
];
export type ValidLegacyRole =
  | "GUEST"
  | "USER"
  | "CREATOR"
  | "MODERATOR"
  | "SUPPORT_ADMIN"
  | "ADMIN"
  | "PLATFORM_ADMIN"
  | "SUPER_ADMIN";

/**
 * Any assignable role key passed to `/admin/users/:id` and related endpoints.
 * It can be either a legacy enum ("ADMIN"…) or a custom RbacRole.key string
 * (e.g. "support_admin").  The backend validates the value against both lists
 * and returns 400 if it does not exist in either.
 */
export type RoleKey = ValidLegacyRole | string;

/** One entry returned by `GET /admin/roles` (custom roles). */
export interface AdminRoleOption {
  id: string;
  key: RoleKey;
  name: string;
  type: "legacy" | "custom";
  /** The nearest-matching legacy enum. Always one of VALID_LEGACY_ROLES. */
  role: ValidLegacyRole;
  description: string;
  count: number;
}

/** Full shape of `GET /admin/roles` response. */
export interface AdminRolesResponse {
  legacy: AdminRoleOption[];
  custom: AdminRoleOption[];
}

/**
 * Mirrors the backend normalizeToUpperSnake() in admin.service.ts:
 *   - PascalCase / camelCase → word boundaries
 *   - kebab-case / spaces / dots → underscores
 *   - collapse multiple underscores, strip leading/trailing, toUpperCase
 *
 * Use this to build a UI-side enum matcher so that "support_admin",
 * "SupportAdmin", "support-admin" etc. all resolve to SUPPORT_ADMIN when
 * displayed on a badge or filtered in a role picker.
 */
export function normalizeRoleToUpperSnake(raw: string): string {
  return raw
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[-\s.]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}

/**
 * Normalises a role candidate to a legacy enum — only used for rendering a
 * best-effort UI fallback / badge tint when a user's current `role` column
 * is read.  NEVER use this to coerce a role that will be sent back to the
 * backend — we send role keys as-is so the backend can validate them
 * against the live RbacRole table instead of silently demoting to USER.
 *
 * Tries, in order:
 *   1. exact case-sensitive match
 *   2. case-insensitive match against VALID_LEGACY_ROLES
 *   3. form-normalized match (normalizeRoleToUpperSnake)
 *   4. fallback only when all three fail
 */
export function toValidLegacyRole(
  raw: string | null | undefined,
  fallback: ValidLegacyRole = "USER",
): ValidLegacyRole {
  if (!raw) return fallback;
  const trimmed = raw.trim();
  if ((VALID_LEGACY_ROLES as readonly string[]).includes(trimmed)) {
    return trimmed as ValidLegacyRole;
  }
  const ci = trimmed.toUpperCase();
  for (const v of VALID_LEGACY_ROLES) {
    if (v.toUpperCase() === ci) return v;
  }
  const normalized = normalizeRoleToUpperSnake(trimmed);
  if ((VALID_LEGACY_ROLES as readonly string[]).includes(normalized)) {
    return normalized as ValidLegacyRole;
  }
  return fallback;
}

/** Flatten the AdminRolesResponse into a list of role keys accepted by the API. */
export function collectRoleKeys(resp: AdminRolesResponse): RoleKey[] {
  return [...resp.legacy.map((r) => r.key), ...resp.custom.map((r) => r.key)];
}

/**
 * Admin user-role APIs: accept any RoleKey string (legacy enum OR custom
 * RbacRole.key) and pass it straight to the backend. The backend resolves
 * the value via AdminService.resolveRole() (checks legacy enum first, then
 * RbacRole table by key/name) and throws 400 if neither matches.
 */
export async function listRoles(): Promise<AdminRolesResponse> {
  return api("/admin/roles");
}

export async function createUser(data: {
  email: string;
  name: string;
  handle: string;
  role: RoleKey;
  password: string;
}): Promise<User> {
  return api("/admin/users", { method: "POST", body: JSON.stringify(data) });
}

export async function updateUser(
  id: string,
  data: Partial<User> & { role?: RoleKey },
): Promise<User> {
  return api(`/admin/users/${id}`, { method: "PUT", body: JSON.stringify(data) });
}

export async function deleteUser(id: string): Promise<void> {
  return api(`/admin/users/${id}`, { method: "DELETE" });
}

export async function updateUserRole(id: string, role: RoleKey): Promise<User> {
  return api(`/admin/users/${id}/role`, { method: "PUT", body: JSON.stringify({ role }) });
}

export async function uploadAvatar(id: string, file: File): Promise<User> {
  const formData = new FormData();
  formData.append("file", file);

  const base = API_BASE_URL.replace(/\/+$/, "");
  const url = `${base}/api/admin/users/${id}/avatar`;
  const token = localStorage.getItem("vellum.admin.session.v1")
    ? JSON.parse(localStorage.getItem("vellum.admin.session.v1")!).token
    : null;

  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  const text = await res.text();
  const body = text ? JSON.parse(text) : undefined;

  if (!res.ok) {
    throw new Error(body?.message || res.statusText);
  }

  return body as User;
}

export async function removeAvatar(id: string): Promise<User> {
  return api(`/admin/users/${id}/avatar`, { method: "DELETE" });
}

export interface UserSettings {
  emailNotifications: boolean;
  pushNotifications: boolean;
  emailMarketing: boolean;
  allowComments: boolean;
  allowLikes: boolean;
  showOnlineStatus: boolean;
}

export async function getUserSettings(): Promise<UserSettings> {
  return api("/users/me/settings");
}

export async function updateUserSettings(data: Partial<UserSettings>): Promise<UserSettings> {
  return api("/users/me/settings", { method: "PUT", body: JSON.stringify(data) });
}

export async function toggleUserStatus(id: string): Promise<User> {
  return api(`/admin/users/${id}/status`, { method: "PUT" });
}

// Articles
export async function getArticles(params?: {
  page?: number;
  limit?: number;
}): Promise<Paginated<Article>> {
  return api("/admin/articles", { query: params });
}

export async function getArticleById(id: string): Promise<Article> {
  return api(`/admin/articles/${id}`);
}

export async function createArticle(data: {
  title: string;
  slug: string;
  excerpt: string;
  body: string[];
  categoryId: string;
  authorId: string;
  isPublished?: boolean;
  featured?: boolean;
  cover?: string | null;
  readMinutes?: number;
}): Promise<Article> {
  return api("/admin/articles", { method: "POST", body: JSON.stringify(data) });
}

export async function updateArticle(id: string, data: Partial<Article>): Promise<Article> {
  return api(`/admin/articles/${id}`, { method: "PUT", body: JSON.stringify(data) });
}

export async function deleteArticle(id: string): Promise<void> {
  return api(`/admin/articles/${id}`, { method: "DELETE" });
}

// Categories
export async function getCategories(): Promise<Category[]> {
  return api("/admin/categories");
}

export async function createCategory(name: string, slug: string, tint: string): Promise<Category> {
  return api("/admin/categories", { method: "POST", body: JSON.stringify({ name, slug, tint }) });
}

export async function updateCategory(
  id: string,
  data: { name?: string; slug?: string; tint?: string },
): Promise<Category> {
  return api(`/admin/categories/${id}`, { method: "PUT", body: JSON.stringify(data) });
}

export async function deleteCategory(id: string): Promise<void> {
  return api(`/admin/categories/${id}`, { method: "DELETE" });
}

// Comments
export async function getComments(params?: {
  page?: number;
  limit?: number;
}): Promise<Paginated<Comment>> {
  return api("/admin/comments", { query: params });
}

export async function deleteComment(id: string): Promise<void> {
  return api(`/admin/comments/${id}`, { method: "DELETE" });
}

// Highlights
export async function getHighlights(params?: {
  page?: number;
  limit?: number;
}): Promise<Paginated<Highlight>> {
  return api("/admin/highlights", { query: params });
}

export async function getHighlightById(id: string): Promise<Highlight> {
  return api(`/admin/highlights/${id}`);
}

export async function createHighlight(data: {
  title: string;
  handle: string;
  description?: string | null;
  cover?: string | null;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  authorId?: string | null;
  isPublished?: boolean;
  aspectRatio?: number | null;
  duration?: number | null;
}): Promise<Highlight> {
  return api("/admin/highlights", { method: "POST", body: JSON.stringify(data) });
}

export async function updateHighlight(id: string, data: Partial<Highlight>): Promise<Highlight> {
  return api(`/admin/highlights/${id}`, { method: "PUT", body: JSON.stringify(data) });
}

export async function deleteHighlight(id: string): Promise<void> {
  return api(`/admin/highlights/${id}`, { method: "DELETE" });
}

// Media
export async function getMedia(params?: {
  page?: number;
  limit?: number;
}): Promise<Paginated<MediaAsset>> {
  return api("/admin/media", { query: params });
}

export async function deleteMedia(id: string): Promise<void> {
  return api(`/admin/media/${id}`, { method: "DELETE" });
}

// Notifications (admin — all users)
export async function getAdminNotifications(params?: {
  page?: number;
  limit?: number;
}): Promise<Paginated<Notification>> {
  return api("/admin/notifications", { query: params });
}

export async function markNotificationRead(id: string): Promise<Notification> {
  return api(`/admin/notifications/${id}/read`, { method: "PUT" });
}

export async function markAllNotificationsRead(): Promise<{ message: string }> {
  return api("/admin/notifications/read-all", { method: "PUT" });
}

export async function deleteNotification(id: string): Promise<void> {
  return api(`/admin/notifications/${id}`, { method: "DELETE" });
}

export async function createNotification(data: {
  userId: string;
  kind: string;
  body: string;
  title?: string;
}): Promise<Notification> {
  return api("/admin/notifications", { method: "POST", body: JSON.stringify(data) });
}

// User notifications (current user)
export async function getUnreadNotificationCount(): Promise<{ count: number }> {
  return api("/notifications/unread-count");
}

// Follows
export async function getFollows(params?: {
  page?: number;
  limit?: number;
}): Promise<Paginated<FollowRecord>> {
  return api("/admin/follows", { query: params });
}

// Reports
export async function getReports(params?: {
  page?: number;
  limit?: number;
}): Promise<Paginated<Report>> {
  return api("/admin/reports", { query: params });
}

export async function getReportById(id: string): Promise<Report> {
  return api(`/admin/reports/${id}`);
}

export async function updateReportStatus(
  id: string,
  status: string,
  note?: string,
): Promise<Report> {
  return api(`/admin/reports/${id}/status`, {
    method: "PUT",
    body: JSON.stringify({ status, note }),
  });
}

export async function deleteReport(id: string): Promise<void> {
  return api(`/admin/reports/${id}`, { method: "DELETE" });
}

export async function getReportStats(): Promise<ReportStats> {
  return api("/admin/reports/stats");
}

// ─── Help Articles ─────────────────────────────────────────────────────────

export interface HelpArticle {
  id: string;
  slug: string;
  title: string;
  description: string;
  content: string[];
  category: string;
  icon: string;
  readMinutes: number;
  popular: boolean;
  views: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function getHelpArticles(params?: {
  category?: string;
  search?: string;
}): Promise<HelpArticle[]> {
  return api("/admin/help/articles", { query: params });
}

export async function getHelpArticleBySlug(slug: string): Promise<HelpArticle> {
  return api(`/admin/help/articles/slug/${slug}`);
}

export async function getHelpArticleById(id: string): Promise<HelpArticle> {
  return api(`/admin/help/articles/${id}`);
}

export async function createHelpArticle(data: {
  slug: string;
  title: string;
  description: string;
  content: string[];
  category: string;
  icon: string;
  readMinutes?: number;
  popular?: boolean;
  isPublished?: boolean;
}): Promise<HelpArticle> {
  return api("/admin/help/articles", { method: "POST", body: JSON.stringify(data) });
}

export async function updateHelpArticle(
  id: string,
  data: Partial<HelpArticle>,
): Promise<HelpArticle> {
  return api(`/admin/help/articles/${id}`, { method: "PUT", body: JSON.stringify(data) });
}

export async function deleteHelpArticle(id: string): Promise<void> {
  return api(`/admin/help/articles/${id}`, { method: "DELETE" });
}

// ─── Support Tickets ────────────────────────────────────────────────────────

export interface SupportTicket {
  id: string;
  ticketNumber: string;
  subject: string;
  message: string;
  description?: string;
  type?: string;
  priority: string;
  status: string;
  userId: string;
  assigneeId?: string | null;
  departmentId?: string | null;
  categoryId?: string | null;
  dueAt?: string | null;
  firstResponseAt?: string | null;
  resolvedAt?: string | null;
  closedAt?: string | null;
  reopenedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  user?: { id: string; email: string; name: string; handle: string; avatar: string | null };
  assignee?: { id: string; email: string; name: string; handle: string; avatar: string | null };
  department?: { id: string; name: string; key: string };
  category?: { id: string; name: string; key: string };
  messages?: Array<{
    id: string;
    body: string;
    isInternal: boolean;
    createdAt: string;
    author: { id: string; name: string; avatar: string | null };
  }>;
  internalNotes?: Array<{
    id: string;
    body: string;
    createdAt: string;
    author: { id: string; name: string; avatar?: string | null };
  }>;
  statusHistory?: Array<{
    id: string;
    fromStatus: string | null;
    toStatus: string;
    reason: string | null;
    createdAt: string;
    changedBy: { id: string; name: string };
  }>;
}

export async function createSupportTicket(data: {
  subject: string;
  message: string;
  priority: string;
}): Promise<SupportTicket> {
  return api("/admin/support-tickets", { method: "POST", body: JSON.stringify(data) });
}

export async function getSupportTickets(params?: {
  page?: number;
  limit?: number;
  status?: string;
  priority?: string;
}): Promise<Paginated<SupportTicket>> {
  return api("/admin/support-tickets", { query: params });
}

export async function getSupportTicket(id: string): Promise<SupportTicket> {
  return api(`/admin/support-tickets/${id}`);
}

export async function updateSupportTicketStatus(
  id: string,
  status: string,
): Promise<SupportTicket> {
  return api(`/admin/support-tickets/${id}/status`, {
    method: "PUT",
    body: JSON.stringify({ status }),
  });
}

// ─── Enterprise RBAC API ────────────────────────────────────────────────────

export interface RbacPermission {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  groupId?: string;
  group?: { id: string; key: string; name: string };
}

export interface RbacRole {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  isSystem: boolean;
  isActive: boolean;
  rank: number;
  parentId?: string | null;
  userCount?: number;
  permissionCount?: number;
  parent?: { id: string; key: string; name: string } | null;
  permissions?: Array<{
    permissionId: string;
    granted: boolean;
    permission: RbacPermission & { group?: { id: string; key: string; name: string } };
  }>;
}

export interface PermissionGroup {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  permissions: RbacPermission[];
}

export interface UserRoleAssignment {
  id: string;
  userId: string;
  roleId: string;
  isPrimary: boolean;
  expiresAt?: string | null;
  role: RbacRole;
}

export interface UserEffectivePermissions {
  permissions: string[];
  roles: RbacRole[];
  overrides: Array<{
    id: string;
    granted: boolean;
    reason?: string | null;
    permission: RbacPermission;
  }>;
}

export async function getRbacRoles(params?: {
  search?: string;
  includeInactive?: boolean;
}): Promise<RbacRole[]> {
  return api("/rbac/roles", { query: params });
}

export async function getRbacRole(id: string): Promise<RbacRole> {
  return api(`/rbac/roles/${id}`);
}

export async function createRbacRole(data: {
  key: string;
  name: string;
  description?: string;
  parentId?: string;
  rank?: number;
  permissionIds?: string[];
}): Promise<RbacRole> {
  return api("/rbac/roles", { method: "POST", body: JSON.stringify(data) });
}

export async function updateRbacRole(
  id: string,
  data: {
    name?: string;
    description?: string;
    parentId?: string | null;
    rank?: number;
    isActive?: boolean;
  },
): Promise<RbacRole> {
  return api(`/rbac/roles/${id}`, { method: "PUT", body: JSON.stringify(data) });
}

export async function deleteRbacRole(id: string): Promise<{ success: boolean }> {
  return api(`/rbac/roles/${id}`, { method: "DELETE" });
}

export async function restoreRbacRole(id: string): Promise<RbacRole> {
  return api(`/rbac/roles/${id}/restore`, { method: "POST" });
}

export async function duplicateRbacRole(
  id: string,
  data: { key: string; name: string },
): Promise<RbacRole> {
  return api(`/rbac/roles/${id}/duplicate`, { method: "POST", body: JSON.stringify(data) });
}

export async function assignRolePermissions(
  roleId: string,
  permissionIds: string[],
): Promise<RbacRole> {
  return api(`/rbac/roles/${roleId}/permissions`, {
    method: "PUT",
    body: JSON.stringify({ permissionIds }),
  });
}

export async function getPermissionGroups(): Promise<PermissionGroup[]> {
  return api("/rbac/permission-groups");
}

export async function getRbacPermissions(params?: {
  groupId?: string;
  search?: string;
}): Promise<RbacPermission[]> {
  return api("/rbac/permissions", { query: params });
}

export async function getRbacPermission(id: string): Promise<RbacPermission> {
  return api(`/rbac/permissions/${id}`);
}

export async function createRbacPermission(data: {
  key: string;
  name: string;
  groupId: string;
  description?: string;
  sortOrder?: number;
}): Promise<RbacPermission> {
  return api("/rbac/permissions", { method: "POST", body: JSON.stringify(data) });
}

export async function updateRbacPermission(
  id: string,
  data: { name?: string; groupId?: string; description?: string; sortOrder?: number },
): Promise<RbacPermission> {
  return api(`/rbac/permissions/${id}`, { method: "PUT", body: JSON.stringify(data) });
}

export async function deleteRbacPermission(id: string): Promise<{ success: boolean }> {
  return api(`/rbac/permissions/${id}`, { method: "DELETE" });
}

export async function getUserRoles(userId: string): Promise<UserRoleAssignment[]> {
  return api(`/rbac/users/${userId}/roles`);
}

export async function assignUserRole(
  userId: string,
  roleId: string,
  isPrimary?: boolean,
  expiresAt?: string,
) {
  return api(`/rbac/users/${userId}/roles`, {
    method: "POST",
    body: JSON.stringify({ roleId, isPrimary, expiresAt }),
  });
}

export async function removeUserRole(userId: string, roleId: string) {
  return api(`/rbac/users/${userId}/roles/${roleId}`, { method: "DELETE" });
}

export async function bulkAssignUserRole(userIds: string[], roleId: string) {
  return api("/rbac/users/bulk-assign-role", {
    method: "POST",
    body: JSON.stringify({ userIds, roleId }),
  });
}

export async function getUserEffectivePermissions(
  userId: string,
): Promise<UserEffectivePermissions> {
  return api(`/rbac/users/${userId}/effective-permissions`);
}

export async function getUserRoleHistory(userId: string) {
  return api(`/rbac/users/${userId}/role-history`);
}

export async function setPermissionOverride(
  userId: string,
  permissionId: string,
  granted: boolean,
  reason?: string,
  expiresAt?: string,
) {
  return api(`/rbac/users/${userId}/permission-overrides`, {
    method: "POST",
    body: JSON.stringify({ permissionId, granted, reason, expiresAt }),
  });
}

export async function removePermissionOverride(userId: string, permissionId: string) {
  return api(`/rbac/users/${userId}/permission-overrides/${permissionId}`, { method: "DELETE" });
}

export async function getMyPermissions(): Promise<UserEffectivePermissions> {
  return api("/rbac/me/permissions");
}

export async function seedRbac() {
  return api("/rbac/seed", { method: "POST" });
}

// ─── Enterprise Support API ─────────────────────────────────────────────────

export interface SupportDashboard {
  summary: {
    openTickets: number;
    unassigned: number;
    inProgress: number;
    escalated: number;
    resolved: number;
    closed: number;
    onlineAgents: number;
  };
  byPriority: Array<{ priority: string; _count: number }>;
  byStatus: Array<{ status: string; _count: number }>;
}

export interface SupportAgent {
  id: string;
  userId: string;
  status: string;
  activeTickets: number;
  maxTickets: number;
  skills: string[];
  user: { id: string; name: string; email: string; avatar: string | null };
  department?: { id: string; name: string };
}

export async function getSupportDashboard(): Promise<SupportDashboard> {
  return api("/support/dashboard");
}

export async function getSupportAgents(): Promise<SupportAgent[]> {
  return api("/support/agents");
}

export async function assignTicket(ticketId: string, agentId: string, reason?: string) {
  return api(`/support/tickets/${ticketId}/assign`, {
    method: "POST",
    body: JSON.stringify({ agentId, reason }),
  });
}

export async function addTicketMessage(ticketId: string, body: string, isInternal?: boolean) {
  return api(`/support/tickets/${ticketId}/messages`, {
    method: "POST",
    body: JSON.stringify({ body, isInternal }),
  });
}

export async function addTicketNote(ticketId: string, body: string) {
  return api(`/support/tickets/${ticketId}/notes`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}

export async function escalateTicket(ticketId: string, reason?: string) {
  return api(`/support/tickets/${ticketId}/escalate`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export async function getSupportTicketsV2(params?: {
  page?: number;
  limit?: number;
  status?: string;
  priority?: string;
  assigneeId?: string;
  unassigned?: boolean;
  search?: string;
}): Promise<Paginated<SupportTicket>> {
  return api("/support/tickets", { query: params });
}

export async function getSupportTicketV2(id: string): Promise<SupportTicket> {
  return api(`/support/tickets/${id}`);
}

export async function updateTicketStatusV2(
  id: string,
  status: string,
  reason?: string,
): Promise<SupportTicket> {
  return api(`/support/tickets/${id}/status`, {
    method: "PUT",
    body: JSON.stringify({ status, reason }),
  });
}

export interface CannedResponse {
  id: string;
  title: string;
  body: string;
  category: string | null;
  shortcut: string | null;
  isActive: boolean;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export async function getCannedResponses(category?: string): Promise<CannedResponse[]> {
  return api("/support/canned-responses", { query: { category } });
}

export async function getCannedResponse(id: string): Promise<CannedResponse> {
  return api(`/support/canned-responses/${id}`);
}

export async function createCannedResponse(data: {
  title: string;
  body: string;
  category?: string;
  shortcut?: string;
}): Promise<CannedResponse> {
  return api("/support/canned-responses", { method: "POST", body: JSON.stringify(data) });
}

export async function updateCannedResponse(
  id: string,
  data: {
    title?: string;
    body?: string;
    category?: string;
    shortcut?: string;
    isActive?: boolean;
  },
): Promise<CannedResponse> {
  return api(`/support/canned-responses/${id}`, { method: "PUT", body: JSON.stringify(data) });
}

export async function deleteCannedResponse(id: string): Promise<{ success: boolean }> {
  return api(`/support/canned-responses/${id}`, { method: "DELETE" });
}

export async function recordCannedResponseUsed(id: string): Promise<CannedResponse> {
  return api(`/support/canned-responses/${id}/use`, { method: "POST" });
}

export async function getAgentLeaderboard() {
  return api("/support/agents/leaderboard");
}

export async function bulkUpdateReportStatus(
  ids: string[],
  status: string,
  note?: string,
): Promise<{ updated: number; reports: Report[] }> {
  return api("/admin/reports/bulk/status", {
    method: "PUT",
    body: JSON.stringify({ ids, status, note }),
  });
}

// Tags
export async function getTags(): Promise<Tag[]> {
  return api("/admin/tags");
}

export async function createTag(name: string, slug: string): Promise<Tag> {
  return api("/admin/tags", { method: "POST", body: JSON.stringify({ name, slug }) });
}

export async function deleteTag(id: string): Promise<void> {
  return api(`/admin/tags/${id}`, { method: "DELETE" });
}

export async function updateTag(id: string, name: string, slug: string): Promise<Tag> {
  return api(`/admin/tags/${id}`, { method: "PUT", body: JSON.stringify({ name, slug }) });
}

// Feature Flags
export async function getFeatureFlags(): Promise<FeatureFlag[]> {
  return api("/admin/flags");
}

export async function createFeatureFlag(data: {
  key: string;
  description: string;
  enabled: boolean;
  rollout: number;
}): Promise<FeatureFlag> {
  return api("/admin/flags", { method: "POST", body: JSON.stringify(data) });
}

export async function updateFeatureFlag(
  id: string,
  data: { enabled?: boolean; rollout?: number },
): Promise<FeatureFlag> {
  return api(`/admin/flags/${id}`, { method: "PUT", body: JSON.stringify(data) });
}

export async function deleteFeatureFlag(id: string): Promise<void> {
  return api(`/admin/flags/${id}`, { method: "DELETE" });
}

// System Settings
export async function getSystemSettings(): Promise<Record<string, SystemSetting[]>> {
  return api("/admin/settings");
}

export async function updateSystemSetting(
  key: string,
  value: string,
  category?: string,
): Promise<SystemSetting> {
  return api("/admin/settings", {
    method: "PUT",
    body: JSON.stringify({ key, value, category }),
  });
}

export async function seedSystemSettings(): Promise<{ message: string; seeded: number }> {
  return api("/admin/settings/seed", { method: "POST" });
}

// Analytics
export async function getAnalyticsOverview(): Promise<AnalyticsOverview> {
  return api("/admin/analytics/overview");
}

export async function getAnalyticsTimeseries(days?: number): Promise<TimeseriesPoint[]> {
  return api("/admin/analytics/timeseries", { query: { days } });
}

export async function getTrafficSources(): Promise<TrafficSourcesResponse> {
  return api("/admin/analytics/traffic");
}

// Storage
export async function getStorageStats(): Promise<StorageStats> {
  return api("/admin/storage");
}

// System Status
export async function getSystemStatus(): Promise<SystemStatus> {
  return api("/admin/status");
}

// Danger Zone
export async function deleteWorkspace(): Promise<{ success: boolean; message: string }> {
  return api("/admin/workspace", { method: "DELETE" });
}

export async function resetSettings(): Promise<{ success: boolean; message: string }> {
  return api("/admin/settings/reset", { method: "POST" });
}

// Background Jobs
export async function getJobs(params?: {
  page?: number;
  limit?: number;
}): Promise<Paginated<BackgroundJob>> {
  return api("/admin/jobs", { query: params });
}

// Advertisements
export async function getAdvertisements(params?: {
  page?: number;
  limit?: number;
}): Promise<Paginated<Advertisement>> {
  return api("/admin/advertisements", { query: params });
}

export async function createAdvertisement(data: {
  name: string;
  status: string;
  startsAt?: string | null;
  endsAt?: string | null;
}): Promise<Advertisement> {
  return api("/admin/advertisements", { method: "POST", body: JSON.stringify(data) });
}

export async function updateAdvertisement(
  id: string,
  data: Partial<Advertisement>,
): Promise<Advertisement> {
  return api(`/admin/advertisements/${id}`, { method: "PUT", body: JSON.stringify(data) });
}

export async function deleteAdvertisement(id: string): Promise<void> {
  return api(`/admin/advertisements/${id}`, { method: "DELETE" });
}

// AI Agents
export async function getAIAgents(): Promise<AIAgent[]> {
  return api("/admin/ai-agents");
}

export async function createAIAgent(data: {
  name: string;
  description?: string | null;
  model: string;
  status: string;
  config?: any;
}): Promise<AIAgent> {
  return api("/admin/ai-agents", { method: "POST", body: JSON.stringify(data) });
}

export async function updateAIAgent(id: string, data: Partial<AIAgent>): Promise<AIAgent> {
  return api(`/admin/ai-agents/${id}`, { method: "PUT", body: JSON.stringify(data) });
}

export async function deleteAIAgent(id: string): Promise<void> {
  return api(`/admin/ai-agents/${id}`, { method: "DELETE" });
}

// Webhooks
export async function getWebhooks(): Promise<WebhookConfig[]> {
  return api("/admin/webhooks");
}

export async function createWebhook(data: {
  name: string;
  url: string;
  events: string[];
  isActive?: boolean;
}): Promise<WebhookConfig> {
  return api("/admin/webhooks", { method: "POST", body: JSON.stringify(data) });
}

export async function updateWebhook(
  id: string,
  data: Partial<WebhookConfig>,
): Promise<WebhookConfig> {
  return api(`/admin/webhooks/${id}`, { method: "PUT", body: JSON.stringify(data) });
}

export async function deleteWebhook(id: string): Promise<void> {
  return api(`/admin/webhooks/${id}`, { method: "DELETE" });
}

// API Keys
export async function getApiKeys(): Promise<ApiKey[]> {
  return api("/admin/api-keys");
}

export async function createApiKey(data: {
  name: string;
  scopes: string[];
  userId?: string | null;
  expiresAt?: string | null;
}): Promise<ApiKey> {
  return api("/admin/api-keys", { method: "POST", body: JSON.stringify(data) });
}

export async function deleteApiKey(id: string): Promise<void> {
  return api(`/admin/api-keys/${id}`, { method: "DELETE" });
}

// Audit Logs
export async function getAuditLogs(params?: {
  page?: number;
  limit?: number;
}): Promise<Paginated<AuditLogEntry>> {
  return api("/admin/audit-logs", { query: params });
}

export async function getAuditLogById(id: string): Promise<AuditLogEntry> {
  return api(`/admin/audit-logs/${id}`);
}

export interface AuditLogEntry {
  id: string;
  userId: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  details: any;
  metadata?: any;
  changes?: Record<string, { old: any; new: any }> | null | undefined;
  success: boolean;
  ipAddress: string | null;
  userAgent: string | null;
  location: string | null;
  createdAt: string;
  user?: { id: string; handle: string; name: string; role?: string };
}

// Roles
// Returns the union of legacy Prisma Role enum values + custom RBAC roles
// defined in the RbacRole table. Use this to populate role pickers in the UI.
export async function getRoles(): Promise<AdminRolesResponse> {
  return api("/admin/roles");
}

// AI Settings & Moderation
export interface AISettings {
  enabled: boolean;
  autoFlag: boolean;
  autoResolve: boolean;
  riskThresholds: {
    high: number;
    medium: number;
  };
  categories: {
    spam: boolean;
    harassment: boolean;
    misinformation: boolean;
    copyright: boolean;
    violence: boolean;
    hateSpeech: boolean;
    selfHarm: boolean;
    sexualContent: boolean;
  };
  notifications: {
    emailOnCritical: boolean;
    slackWebhook?: string;
    digestFrequency: "realtime" | "hourly" | "daily" | "weekly";
  };
  modelConfig: {
    model: "gpt-4" | "gpt-3.5" | "claude" | "custom";
    temperature: number;
    maxTokens: number;
    customPrompt?: string;
  };
  trainingData: {
    useHistoricalReports: boolean;
    feedbackLoop: boolean;
    lastRetrained?: string;
  };
}

export interface ModerationTestResult {
  score: number;
  riskLevel: "low" | "medium" | "high";
  category: string;
  confidence: number;
  reasoning: string;
  thresholds: { high: number; medium: number };
}

export interface ReportTrendsResponse {
  daily: Array<{
    date: string;
    total: number;
    open: number;
    resolved: number;
    dismissed: number;
    critical: number;
  }>;
  trend: number;
  summary: {
    totalReports: number;
    lastWeekTotal: number;
    trendDirection: "up" | "down" | "stable";
  };
}

export interface ReportStatsResponse {
  openCount: number;
  resolvedCount: number;
  dismissedCount: number;
  criticalCount: number;
  underReviewCount: number;
  openTrend: string;
  resolvedTrend: string;
  criticalTrend: string;
  aiScoreTrend: string;
}

export async function getAISettings(): Promise<Record<string, string>> {
  return api("/admin/ai/settings");
}

export async function updateAISettings(settings: AISettings): Promise<Record<string, string>> {
  return api("/admin/ai/settings", { method: "PUT", body: JSON.stringify(settings) });
}

export async function testAIModeration(
  content: string,
  thresholds?: { high: number; medium: number },
): Promise<ModerationTestResult> {
  return api("/admin/ai/moderation/test", {
    method: "POST",
    body: JSON.stringify({ content, thresholds }),
  });
}

export async function getReportTrends(days?: number): Promise<ReportTrendsResponse> {
  return api("/admin/reports/trends", { query: { days } });
}

// ─── Role Requests ──────────────────────────────────────────────────────────

export type RoleRequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";
export type RoleRequestType = "PERMANENT" | "TEMPORARY";

export interface RoleRequestEvent {
  id: string;
  requestId: string;
  actorId?: string | null;
  transition: RoleRequestStatus;
  reason?: string | null;
  createdAt: string;
  actor?: { id: string; name: string; email: string } | null;
  metadata?: Record<string, any> | null;
}

export interface RoleRequest {
  id: string;
  requesterId: string;
  reviewerId?: string | null;
  requestedRoleKey: string;
  type: RoleRequestType;
  status: RoleRequestStatus;
  justification: string;
  adminJustification?: string | null;
  startsAt?: string | null;
  expiresAt?: string | null;
  reviewedAt?: string | null;
  resultingAssignmentId?: string | null;
  createdAt: string;
  updatedAt: string;
  requester?: { id: string; name: string; email: string; avatar?: string | null } | null;
  reviewer?: { id: string; name: string; email: string } | null;
  history?: RoleRequestEvent[];
}

export interface PaginatedRoleRequests {
  data: RoleRequest[];
  total: number;
  page: number;
  limit: number;
}

export async function createRoleRequest(data: {
  requestedRoleKey: string;
  type: RoleRequestType;
  justification: string;
  startsAt?: string;
  expiresAt?: string;
}): Promise<RoleRequest> {
  return api("/role-requests", { method: "POST", body: JSON.stringify(data) });
}

export async function getRoleRequests(params?: {
  status?: RoleRequestStatus | "ALL";
  page?: number;
  limit?: number;
  requesterId?: string;
}): Promise<PaginatedRoleRequests> {
  return api("/role-requests", { query: params });
}

export async function getRoleRequestById(id: string): Promise<RoleRequest> {
  return api(`/role-requests/${id}`);
}

export async function approveRoleRequest(
  id: string,
  args?: {
    adminJustification?: string;
    expiresAtOverride?: string;
    startsAtOverride?: string;
  },
): Promise<RoleRequest> {
  return api(`/role-requests/${id}/approve`, {
    method: "PUT",
    body: JSON.stringify(args ?? {}),
  });
}

export async function rejectRoleRequest(
  id: string,
  adminJustification: string,
): Promise<RoleRequest> {
  return api(`/role-requests/${id}/reject`, {
    method: "PUT",
    body: JSON.stringify({ adminJustification }),
  });
}

export async function cancelRoleRequest(id: string): Promise<RoleRequest> {
  return api(`/role-requests/${id}/cancel`, { method: "PUT" });
}

export async function bulkApproveRoleRequests(
  ids: string[],
  adminJustification?: string,
): Promise<{ updated: number; requests: RoleRequest[] }> {
  return api("/role-requests/admin/bulk-approve", {
    method: "POST",
    body: JSON.stringify({ ids, adminJustification }),
  });
}

export async function bulkRejectRoleRequests(
  ids: string[],
  adminJustification: string,
): Promise<{ updated: number; requests: RoleRequest[] }> {
  return api("/role-requests/admin/bulk-reject", {
    method: "POST",
    body: JSON.stringify({ ids, adminJustification }),
  });
}
