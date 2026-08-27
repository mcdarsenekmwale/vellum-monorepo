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
  deletedAt: string | null;

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
  publisherId: string;
  publisherAvatar: string | undefined;
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

export type WebhookType = "INCOMING" | "OUTGOING";
export type WebhookFormat = "JSON" | "FORM" | "XML" | "PLAIN";
export type TeamsCardType = "MESSAGE" | "ADAPTIVE";
export type TestStatus = "idle" | "loading" | "success" | "error";
export type PayloadFormat = "json" | "form" | "xml" | "plain";

export interface WebhookConfig {
  id: string;
  name: string;
  type: WebhookType;
  url: string;
  secret?: string | null;
  format?: WebhookFormat;
  events: string[];
  headers?: Record<string, string> | null;
  isActive: boolean;
  lastTriggeredAt?: string | null;
  failureCount?: number;
  retryMaxAttempts?: number;
  retryBackoffDelay?: number;
  allowedIps?: string[];
  requiresAuth?: boolean;
  teamsChannelId?: string | null;
  teamsTeamId?: string | null;
  teamsCardType?: TeamsCardType | null;
  teamsCardTemplate?: Record<string, unknown> | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
  logs?: WebhookLog[];
}

export interface WebhookLog {
  timestamp?: string;
  id: string;
  webhookId: string;
  event: string;
  payload: unknown;
  statusCode: number | null;
  response: any | null;
  error: string | null;
  durationMs?: number | null;
  attempt?: number;
  createdAt: string;
}

export interface WebhookStats {
  total: number;
  totalIncoming: number;
  totalOutgoing: number;
  active: number;
  totalTriggers: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  averageDurationMs: number;
  last7Days: DailyPoint[];
  last30Days: DailyPoint[];
  byEvent: Array<{ event: string; count: number; success: number; failure: number }>;
}

export interface DailyPoint {
  date: string;
  triggers: number;
  success: number;
  failure: number;
}

export interface WebhookTemplate {
  id: string;
  name: string;
  description: string;
  type: WebhookType;
  events: string[];
  format?: WebhookFormat;
  headers?: Record<string, string>;
  teamsCardType?: TeamsCardType;
  teamsCardTemplate?: Record<string, unknown>;
  icon?: string;
  category: string;
}

export interface TestResult {
  status: TestStatus;
  statusCode?: number;
  success?: boolean;
  responseTime?: number;
  responseBody?: string;
  responseHeaders?: Record<string, string>;
  errorMessage?: string;
  message?: string;
  timestamp: string;
  logs?: LogEntry[];
}

export interface LogEntry {
  id: string;
  timestamp: string;
  type: "request" | "response" | "error";
  data: unknown;
  statusCode?: number;
}

export interface WebhookLogsFilter {
  event?: string;
  status?: "success" | "failure" | "all";
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export interface WebhookBulkUpdate {
  ids: string[];
  action: "enable" | "disable" | "delete";
}

export interface RotateSecretResult {
  id: string;
  secret: string;
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
  content: {
    totalArticles: number;
    totalHighlights: number;
    totalComments: number;
    newArticlesToday: number;
    newCommentsToday: number;
    newHighlightsToday: number;
    totalTrafficSources?: number;
    newContentToday?: number;
  },
  users: {
    totalUsers: number;
    dailyActiveUsers: number;
    weeklyActiveUsers: number;
    newUsersToday: number;
    monthlyActiveUsers: number;
  },
  engagement: {
    totalLikes: number;
    totalFollows: number;
    totalBookmarks: number;
    totalArticleViews: number;
    avgViewsPerArticle: number;
  }
}

export interface TimeseriesPoint {
  date: string;
  users: number;
  articles: number;
  highlights: number;
  likes: number;
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

export interface HeatmapPoint {
  x: string;
  y: string;
  value: number;
}

export interface RealtimeEvent {
  id: string;
  type: "view" | "like" | "comment" | "share" | "register" | "publish";
  user: string;
  action: string;
  target: string;
  timestamp: string;
}

export interface RealtimeResponse {
  events: RealtimeEvent[];
  activeUsers: number;
}

export interface RetentionCohort {
  id: string;
  label: string;
  values: number[];
}

export interface RetentionResponse {
  cohorts: RetentionCohort[];
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

export async function resetUserPassword(id: string, data: { password: string }): Promise<User> {
  return api(`/admin/users/${id}/reset-password`, { method: "POST", body: JSON.stringify(data) });
}

export async function deleteUser(id: string): Promise<void> {
  return api(`/admin/users/${id}`, { method: "DELETE" });
}

export async function getDeletedUsers(params?: {
  page?: number;
  limit?: number;
}): Promise<Paginated<User>> {
  return api("/admin/users/deleted", { query: params });
}

export async function restoreUser(id: string): Promise<User> {
  return api(`/admin/users/${id}/restore`, { method: "PUT" });
}

export async function purgeUser(id: string): Promise<{ id: string; purged: boolean }> {
  return api(`/admin/users/${id}/purge`, { method: "DELETE" });
}

export async function updateUserRole(id: string, role: RoleKey): Promise<User> {
  return api(`/admin/users/${id}/role`, { method: "PUT", body: JSON.stringify({ role }) });
}

export async function uploadAvatar(id: string, file: File): Promise<User> {
  const formData = new FormData();
  formData.append("file", file);

  const base = API_BASE_URL.replace(/\/+$/, "");
  const url = `${base}/api/admin/users/${id}/avatar`;
  const token = localStorage.getItem("vellbase.admin.session.v1")
    ? JSON.parse(localStorage.getItem("vellbase.admin.session.v1")!).token
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
  teamId?: string | null;
  categoryId?: string | null;
  dueAt?: string | null;
  firstResponseAt?: string | null;
  resolvedAt?: string | null;
  closedAt?: string | null;
  reopenedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    email: string;
    name: string;
    handle: string;
    avatar: string | null;
    plan?: string;
    role?: string;
    createdAt?: any;
  };
  assignee?: {
    id: string;
    email: string;
    name: string;
    handle: string;
    avatar: string | null;
  };
  department?: { id: string; name: string; key: string };
  team?: { id: string; name: string; departmentId?: string };
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
  assignments?: Array<{
    id: string;
    agentId: string;
    agent?: { id: string; name: string } | null;
    assignedBy?: { id: string; name: string } | null;
    assignedAt: string;
    endedAt?: string | null;
    isActive: boolean;
    reason: string | null;
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

export async function restoreSupportTicket(id: string): Promise<void> {
  return api(`/admin/support-tickets/deleted/${id}/restore`, { method: "PUT" });
}

export async function permanentlyDeleteSupportTicket(id: string): Promise<void> {
  return api(`/admin/support-tickets/deleted/${id}/permanentently-delete`, { method: "DELETE" });
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
    avgResponseMs?: number;
    avgResolutionMs?: number;
    newLast24h?: number;
    resolvedToday?: number;
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
  isActive: boolean;
  vacationUntil?: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatar: string | null;
    handle?: string;
    role?: string;
  };
  department?: { id: string; name: string } | null;
  team?: { id: string; name: string } | null;
  // Enriched fields from listAgents
  ticketsAssigned?: number;
  ticketsResolved?: number;
  escalations?: number;
}

export interface SupportAgentDetail extends SupportAgent {
  tickets: SupportAgentTicket[];
  recentActivity: SupportAgentActivity[];
  metrics: {
    totalAssigned: number;
    resolved: number;
    escalated: number;
    reopened: number;
    escalationRate: number;
    reopenRate: number;
  };
}

export interface SupportAgentTicket {
  id: string;
  ticketNumber: string;
  subject: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  category?: { name: string } | null;
}

export interface SupportAgentActivity {
  id: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  metadata?: any;
  createdAt: string;
}

export interface SupportAgentStats {
  total: number;
  active: number;
  inactive: number;
  online: number;
  busy: number;
  away: number;
  offline: number;
  totalTickets: number;
  resolvedTickets: number;
  closedTickets: number;
  resolutionRate: number;
}

export async function getSupportDashboard(): Promise<SupportDashboard> {
  return api("/support/dashboard");
}

export async function getSupportAgents(params?: {
  departmentId?: string;
  teamId?: string;
  status?: string;
  isActive?: boolean;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?:
    "name" | "activeTickets" | "maxTickets" | "createdAt" | "ticketsResolved" | "escalations";
  sortDir?: "asc" | "desc";
}): Promise<Paginated<SupportAgent>> {
  return api("/support/agents", { query: params });
}

export async function getAgentStats(): Promise<SupportAgentStats> {
  return api("/support/agents/stats");
}

export async function getAgentDetail(userId: string): Promise<SupportAgentDetail> {
  return api(`/support/agents/${userId}`);
}

export async function createSupportAgent(data: {
  userId: string;
  departmentId?: string;
  teamId?: string;
  skills?: string[];
  maxTickets?: number;
}): Promise<SupportAgent> {
  return api("/support/agents", { method: "POST", body: JSON.stringify(data) });
}

export async function updateSupportAgent(
  userId: string,
  data: {
    departmentId?: string;
    teamId?: string;
    skills?: string[];
    maxTickets?: number;
    isActive?: boolean;
  },
): Promise<SupportAgent> {
  return api(`/support/agents/${userId}`, { method: "PUT", body: JSON.stringify(data) });
}

export async function deleteSupportAgent(userId: string): Promise<{ success: boolean }> {
  return api(`/support/agents/${userId}`, { method: "DELETE" });
}

export async function toggleAgentStatus(userId: string): Promise<SupportAgent> {
  return api(`/support/agents/${userId}/status`, { method: "PATCH" });
}

export async function updateUserPresence(userId: string, status: string): Promise<SupportAgent> {
  return api(`/support/agents/${userId}/presence`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

// ─── Get agent's current presence ───
export async function getAgentPresence(userId: string): Promise<SupportAgent> {
  return api(`/support/agents/${userId}/presence`);
}

// ─── Check if user is a support agent ───
export async function isSupportAgent(userId: string): Promise<boolean> {
  return api(`/support/agents/check/${userId}`);
}

export async function getAgentTickets(
  userId: string,
  params?: { status?: string; page?: number; limit?: number },
): Promise<Paginated<SupportAgentTicket>> {
  return api(`/support/agents/${userId}/tickets`, { query: params });
}

export async function getAgentActivity(
  userId: string,
  params?: { page?: number; limit?: number },
): Promise<Paginated<SupportAgentActivity>> {
  return api(`/support/agents/${userId}/activity`, { query: params });
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

// ─── Deleted Support Tickets ────────────────────────────────────────────────────────

export async function getDeletedSupportTickets(params?: {
  page?: number;
  limit?: number;
}): Promise<Paginated<SupportTicket>> {
  return api("/support/tickets/deleted", { query: params });
}

export async function getSupportTicketsV2(params?: {
  page?: number;
  limit?: number;
  status?: string;
  priority?: string;
  assigneeId?: string;
  departmentId?: string;
  teamId?: string;
  categoryId?: string;
  unassigned?: boolean;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  orderBy?: "createdAt" | "updatedAt" | "priority" | "status";
  orderDir?: "asc" | "desc";
}): Promise<Paginated<SupportTicket>> {
  return api("/support/tickets", { query: params as Record<string, any> });
}

export async function routeTicket(
  ticketId: string,
  routing: { agentId?: string; teamId?: string; departmentId?: string; reason?: string },
): Promise<SupportTicket> {
  return api(`/support/tickets/${ticketId}/route`, {
    method: "POST",
    body: JSON.stringify(routing),
  });
}

export async function getSupportTicketV2(id: string): Promise<SupportTicket> {
  return api(`/support/tickets/${id}`);
}

// ─── Ticket Access Control ───────────────────────────────────────────────
//
// The backend restricts ticket visibility by role: support agents and lower
// roles only see tickets they created or are assigned to (plus team-member
// and explicit-grant visibility). When `getSupportTicketV2` returns 403, the
// UI should prompt the user to submit a ticket-view access request via the
// endpoints below.

export interface TicketAccessCheck {
  hasAccess: boolean;
  reason: "admin" | "owner" | "assignee" | "team" | "grant" | "none";
}

export type TicketAccessRequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
export type TicketAccessRequestType = "PERMANENT" | "TEMPORARY";

export interface TicketAccessRequest {
  id: string;
  requesterId: string;
  reviewerId: string | null;
  resourceType: string;
  resourceId: string | null;
  permissionKey: string;
  type: TicketAccessRequestType;
  status: TicketAccessRequestStatus;
  justification: string;
  adminJustification: string | null;
  startsAt: string | null;
  expiresAt: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  requester?: { id: string; name: string; email: string; avatar: string | null; handle: string };
  reviewer?: { id: string; name: string; email: string } | null;
}

export async function checkTicketAccess(ticketId: string): Promise<TicketAccessCheck> {
  return api(`/support/tickets/${encodeURIComponent(ticketId)}/access`);
}

export async function requestTicketAccess(
  ticketId: string,
  body: {
    justification: string;
    type?: TicketAccessRequestType;
    startsAt?: string;
    expiresAt?: string;
  },
): Promise<TicketAccessRequest> {
  return api(`/support/tickets/${encodeURIComponent(ticketId)}/access-request`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function listTicketAccessRequests(params?: {
  status?: TicketAccessRequestStatus;
  ticketId?: string;
  page?: number;
  limit?: number;
  orderBy?: "createdAt" | "reviewedAt" | "expiresAt";
  orderDir?: "asc" | "desc";
}): Promise<Paginated<TicketAccessRequest>> {
  return api("/support/tickets/access-requests", { query: params as Record<string, any> });
}

export async function listTicketAccessRequestsForTicket(
  ticketId: string,
  params?: { status?: TicketAccessRequestStatus; page?: number; limit?: number },
): Promise<Paginated<TicketAccessRequest>> {
  return api(`/support/tickets/${encodeURIComponent(ticketId)}/access-requests`, {
    query: params as Record<string, any>,
  });
}

export async function approveTicketAccessRequest(
  requestId: string,
  adminJustification: string,
): Promise<TicketAccessRequest> {
  return api(`/support/tickets/access-requests/${encodeURIComponent(requestId)}/approve`, {
    method: "POST",
    body: JSON.stringify({ adminJustification }),
  });
}

export async function rejectTicketAccessRequest(
  requestId: string,
  adminJustification: string,
): Promise<TicketAccessRequest> {
  return api(`/support/tickets/access-requests/${encodeURIComponent(requestId)}/reject`, {
    method: "POST",
    body: JSON.stringify({ adminJustification }),
  });
}

export async function cancelTicketAccessRequest(requestId: string): Promise<TicketAccessRequest> {
  return api(`/support/tickets/access-requests/${encodeURIComponent(requestId)}/cancel`, {
    method: "POST",
  });
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
  tags: string[];
  variables: string[];
  shortcuts: string[];
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
  shortcuts?: string[];
  isActive?: boolean;
  usageCount?: number;
  tags?: string[];
  variables?: string[];
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
    shortcuts?: string[];
    isActive?: boolean;
    usageCount?: number;
    tags?: string[];
    variables?: string[];
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
  return  api("/admin/analytics/overview");
}

export async function getAnalyticsTimeseries(days?: number): Promise<TimeseriesPoint[]> {
  return api("/admin/analytics/timeseries", { query: { days } });
}

export async function getTrafficSources(): Promise<TrafficSourcesResponse> {
  return api("/admin/analytics/traffic");
}

export async function getAnalyticsHeatmap(): Promise<HeatmapPoint[]> {
  return api("/admin/analytics/heatmap");
}

export async function getAnalyticsRealtime(): Promise<RealtimeResponse> {
  return api("/admin/analytics/realtime");
}

export async function getAnalyticsRetention(): Promise<RetentionResponse> {
  return api("/admin/analytics/retention");
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

export async function getWebhookById(id: string): Promise<WebhookConfig> {
  return api(`/admin/webhooks/${id}`); 
}

export async function createWebhook(data: {
  name: string;
  url: string;
  events: string[];
  isActive?: boolean;
  type?: WebhookType;
  format?: WebhookFormat;
  secret?: string;
  headers?: Record<string, string>;
  retryMaxAttempts?: number;
  retryBackoffDelay?: number;
  allowedIps?: string[];
  requiresAuth?: boolean;
  teamsChannelId?: string;
  teamsTeamId?: string;
  teamsCardType?: TeamsCardType;
  teamsCardTemplate?: Record<string, unknown>;
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

export async function testWebhook(
  id: string,
  data: {
    event?: string;
    payload?: unknown;
    overrideUrl?: string;
    headers?: Record<string, string>;
  },
): Promise<TestResult> {
  return api(`/admin/webhooks/${id}/test`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getWebhookLogs(
  id: string,
  filter?: WebhookLogsFilter,
): Promise<{ items: WebhookLog[]; total: number }> {
  const params = new URLSearchParams();
  if (filter?.event) params.set("event", filter.event);
  if (filter?.status) params.set("status", filter.status);
  if (filter?.from) params.set("from", filter.from);
  if (filter?.to) params.set("to", filter.to);
  if (filter?.limit) params.set("limit", String(filter.limit));
  if (filter?.offset) params.set("offset", String(filter.offset));
  const qs = params.toString();
  return api(`/admin/webhooks/${id}/logs${qs ? `?${qs}` : ""}`);
}

export async function getWebhookStats(id?: string): Promise<WebhookStats> {
  const path = id ? `/admin/webhooks/${id}/stats` : "/admin/webhooks/stats/overview";
  return api(path);
}

export async function getWebhookTemplates(): Promise<WebhookTemplate[]> {
  return api("/admin/webhooks/templates");
}

export async function rotateWebhookSecret(id: string): Promise<RotateSecretResult> {
  return api(`/admin/webhooks/${id}/rotate-secret`, { method: "POST" });
}

export async function bulkUpdateWebhooks(
  data: WebhookBulkUpdate,
): Promise<{ updated: number; deleted: number }> {
  return api("/admin/webhooks/bulk", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function triggerWebhookEvent(
  event: string,
  payload: unknown,
): Promise<{ triggered: number; results: Array<{ id: string; success: boolean }> }> {
  return api("/admin/webhooks/trigger", {
    method: "POST",
    body: JSON.stringify({ event, payload }),
  });
}

export async function exportWebhookLogs(
  id: string,
  filter?: WebhookLogsFilter,
): Promise<{ csvUrl: string; count: number }> {
  const params = new URLSearchParams();
  if (filter?.event) params.set("event", filter.event);
  if (filter?.status) params.set("status", filter.status);
  if (filter?.from) params.set("from", filter.from);
  if (filter?.to) params.set("to", filter.to);
  const qs = params.toString();
  return api(`/admin/webhooks/${id}/logs/export${qs ? `?${qs}` : ""}`);
}

export async function applyWebhookTemplate(
  templateId: string,
  overrides: Partial<WebhookConfig> = {},
): Promise<WebhookConfig> {
  return api(`/admin/webhooks/templates/${templateId}/apply`, {
    method: "POST",
    body: JSON.stringify(overrides),
  });
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
  resolvedBy: any;
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
  totalPages: number;
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

/**
 * Current-authenticated-user-only role request history.
 *
 * Hits the JWT-gated `/api/role-requests/mine` endpoint on the backend which
 * scopes results to `requesterId === req.user.id` server-side — it does NOT
 * rely on the caller passing a requesterId filter. This is important because
 * the base `/api/role-requests` list endpoint is AdminGuard-protected, which
 * would 403 for least-privileged users trying to see their own requests.
 *
 * See also `getRoleRequests` which is the admin-side listing and requires an
 * Admin or SuperAdmin bearer token.
 */
export async function getMyRoleRequests(params?: {
  status?: RoleRequestStatus | "ALL";
  page?: number;
  limit?: number;
}): Promise<PaginatedRoleRequests> {
  return api("/role-requests/mine", { query: params });
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

// ─── Access Control Requests ───────────────────────────────────────────────────

export type AccessRequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
export type AccessRequestType = "PERMANENT" | "TEMPORARY";

export interface AccessRequestEntry {
  id: string;
  requesterId: string;
  reviewerId: string | null;
  resourceType: string;
  resourceId: string | null;
  permissionKey: string;
  type: AccessRequestType;
  status: AccessRequestStatus;
  justification: string;
  adminJustification: string | null;
  startsAt: string | null;
  expiresAt: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  requester: {
    id: string;
    name: string;
    email: string;
    avatar: string | null;
    handle: string;
  };
  reviewer: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export interface PaginatedAccessRequests {
  data: AccessRequestEntry[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AccessRequestStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  cancelled: number;
  byResource: { resourceType: string; count: number }[];
}

export interface ResourcePermissionEntry {
  id: string;
  resourceType: string;
  permissionKey: string;
  permissionName: string;
  description: string | null;
  createdAt: string;
}

export interface ResourceSummary {
  type: string;
  permissionCount: number;
}

export interface SearchResourcesPayload {
  query: string;
  limit?: number;
  types?: string[];
}

export interface SearchResourceResult {
  id: string;
  type: string;
  title?: string;
  subject?: string;
  name?: string;
  description?: string;
  status?: string;
  [key: string]: any;
}

export async function getAccessRequests(params?: {
  requesterId?: string;
  status?: AccessRequestStatus;
  resourceType?: string;
  page?: number;
  limit?: number;
  orderBy?: "createdAt" | "reviewedAt" | "expiresAt";
  orderDir?: "asc" | "desc";
}): Promise<PaginatedAccessRequests> {
  return api("/access-requests", { query: params });
}

export async function getMyAccessRequests(params?: {
  status?: AccessRequestStatus;
  page?: number;
  limit?: number;
}): Promise<PaginatedAccessRequests> {
  return api("/access-requests/mine", { query: params });
}

export async function getAccessRequestById(id: string): Promise<AccessRequestEntry> {
  return api(`/access-requests/${id}`);
}

export async function createAccessRequest(data: {
  resourceType: string;
  resourceId?: string;
  permissionKey: string;
  type: AccessRequestType;
  justification: string;
  startsAt?: string;
  expiresAt?: string;
}): Promise<AccessRequestEntry> {
  return api("/access-requests", { method: "POST", body: JSON.stringify(data) });
}

export async function approveAccessRequest(
  id: string,
  adminJustification: string,
): Promise<AccessRequestEntry> {
  return api(`/access-requests/${id}/approve`, {
    method: "PUT",
    body: JSON.stringify({ adminJustification }),
  });
}

export async function rejectAccessRequest(
  id: string,
  adminJustification: string,
): Promise<AccessRequestEntry> {
  return api(`/access-requests/${id}/reject`, {
    method: "PUT",
    body: JSON.stringify({ adminJustification }),
  });
}

export async function cancelAccessRequest(id: string): Promise<AccessRequestEntry> {
  return api(`/access-requests/${id}/cancel`, { method: "PUT" });
}

export async function deleteAccessRequest(id: string): Promise<{ id: string; deleted: boolean }> {
  return api(`/access-requests/${id}`, { method: "DELETE" });
}

export async function bulkApproveAccessRequests(
  ids: string[],
  adminJustification: string,
): Promise<{ approved: number; failed: number; total: number; requests: AccessRequestEntry[] }> {
  return api("/access-requests/bulk-approve", {
    method: "POST",
    body: JSON.stringify({ ids, adminJustification }),
  });
}

export async function bulkRejectAccessRequests(
  ids: string[],
  adminJustification: string,
): Promise<{ rejected: number; failed: number; total: number; requests: AccessRequestEntry[] }> {
  return api("/access-requests/bulk-reject", {
    method: "POST",
    body: JSON.stringify({ ids, adminJustification }),
  });
}

export async function getAccessRequestStats(): Promise<AccessRequestStats> {
  return api("/access-requests/stats/summary");
}

export async function getResourcePermissions(
  resourceType?: string,
): Promise<ResourcePermissionEntry[]> {
  return api("/access-requests/resources/permissions", {
    query: resourceType ? { resourceType } : undefined,
  });
}

export async function getResources(): Promise<ResourceSummary[]> {
  return api("/access-requests/resources/list");
}

// Create a resource access request
export async function createResourceAccessRequest(data: {
  resourceType: string;
  resourceId?: string;
  permissionKey: string;
  type: AccessRequestType;
  justification: string;
  startsAt?: string;
  expiresAt?: string;
}): Promise<AccessRequestEntry> {
  return api("/access-requests/resources", { method: "POST", body: JSON.stringify(data) });
}

// Search for resources to request access to
export async function searchResources(
  query: string,
  payload?: SearchResourcesPayload,
): Promise<ResourceSummary[]> {
  return api("/access-requests/resources/search", {
    query: { query },
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Phase 1 — Support Departments & Teams
// ────────────────────────────────────────────────────────────────────────────

export interface SupportDepartment {
  id: string;
  key: string;
  name: string;
  description: string | null;
  email: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  headId: string | null;
  head?: { id: string; name: string; email: string; avatar: string | null } | null;
  firstResponseSlaMinutes: number;
  resolutionSlaMinutes: number;
  slaAdherenceTargetPct: number;
  businessHoursStartMin: number;
  businessHoursEndMin: number;
  businessDays: number[];
  timezone: string;
  budgetAllocated: number | null;
  resourceCapacityFte: number | null;
  teams?: Array<{
    id: string;
    name: string;
    description: string | null;
    isActive: boolean;
    leadId: string | null;
    lead?: { id: string; name: string; email: string; avatar: string | null } | null;
    maxTicketsPerAgent: number;
    concurrentTicketLimitPerAgent: number;
    skillSpecialization: string | null;
    _count: { agents: number; memberships: number };
  }>;
  _count?: { agents: number; tickets: number; teams: number };
}

export interface SupportTeam {
  id: string;
  name: string;
  departmentId: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  leadId: string | null;
  lead?: { id: string; name: string; email: string; avatar: string | null } | null;
  slaInheritFromDept: boolean;
  firstResponseSlaMinutes: number | null;
  resolutionSlaMinutes: number | null;
  businessHoursInherit: boolean;
  businessHoursStartMin: number | null;
  businessHoursEndMin: number | null;
  businessDays: number[];
  timezone: string | null;
  maxTicketsPerAgent: number;
  concurrentTicketLimitPerAgent: number;
  skillSpecialization: string | null;
  department?: { id: string; name: string; key: string };
  _count?: { members: number } | { agents: number; memberships: number };
  memberships?: SupportAgentTeamMembership[];
}

export interface SupportAgentTeamMembership {
  id: string;
  agentId: string;
  teamId: string;
  isPrimary: boolean;
  startDate: string;
  endDate: string | null;
  assignedBy: string | null;
  assignedAt: string;
  agent?: SupportAgent;
}

// ── Departments ────────────────────────────────────────────────────────────

export async function listSupportDepartments(params?: {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
  includeDeleted?: boolean;
  sortBy?: "name" | "createdAt" | "firstResponseSlaMinutes" | "slaAdherenceTargetPct";
  sortDir?: "asc" | "desc";
}): Promise<Paginated<SupportDepartment>> {
  return api("/support/departments", { query: params });
}

export async function getSupportDepartment(id: string): Promise<SupportDepartment> {
  return api(`/support/departments/${id}`);
}

export async function createSupportDepartment(data: {
  key: string;
  name: string;
  description?: string | null;
  email?: string | null;
  headId?: string | null;
  firstResponseSlaMinutes?: number;
  resolutionSlaMinutes?: number;
  slaAdherenceTargetPct?: number;
  businessHoursStartMin?: number;
  businessHoursEndMin?: number;
  businessDays?: number[];
  timezone?: string;
  budgetAllocated?: number | null;
  resourceCapacityFte?: number | null;
  isActive?: boolean;
}): Promise<SupportDepartment> {
  return api("/support/departments", { method: "POST", body: JSON.stringify(data) });
}

export async function updateSupportDepartment(
  id: string,
  data: {
    name?: string;
    description?: string | null;
    email?: string | null;
    headId?: string | null;
    isActive?: boolean;
    firstResponseSlaMinutes?: number;
    resolutionSlaMinutes?: number;
    slaAdherenceTargetPct?: number;
    businessHoursStartMin?: number;
    businessHoursEndMin?: number;
    businessDays?: number[];
    timezone?: string;
    budgetAllocated?: number | null;
    resourceCapacityFte?: number | null;
  },
): Promise<SupportDepartment> {
  return api(`/support/departments/${id}`, { method: "PATCH", body: JSON.stringify(data) });
}

export async function deleteSupportDepartment(id: string): Promise<SupportDepartment> {
  return api(`/support/departments/${id}`, { method: "DELETE" });
}

export async function restoreSupportDepartment(id: string): Promise<SupportDepartment> {
  return api(`/support/departments/${id}/restore`, { method: "POST" });
}

// ── Teams ──────────────────────────────────────────────────────────────────

export async function listSupportTeams(params?: {
  page?: number;
  limit?: number;
  departmentId?: string;
  search?: string;
  isActive?: boolean;
  includeDeleted?: boolean;
  sortBy?: "name" | "createdAt" | "maxTicketsPerAgent";
  sortDir?: "asc" | "desc";
}): Promise<Paginated<SupportTeam>> {
  return api("/support/teams", { query: params });
}

export async function getSupportTeam(id: string): Promise<SupportTeam> {
  return api(`/support/teams/${id}`);
}

export async function createSupportTeam(data: {
  departmentId: string;
  name: string;
  description?: string | null;
  leadId?: string | null;
  slaInheritFromDept?: boolean;
  firstResponseSlaMinutes?: number | null;
  resolutionSlaMinutes?: number | null;
  businessHoursInherit?: boolean;
  businessHoursStartMin?: number | null;
  businessHoursEndMin?: number | null;
  businessDays?: number[];
  timezone?: string | null;
  maxTicketsPerAgent?: number;
  concurrentTicketLimitPerAgent?: number;
  skillSpecialization?: string | null;
  isActive?: boolean;
}): Promise<SupportTeam> {
  return api("/support/teams", { method: "POST", body: JSON.stringify(data) });
}

export async function updateSupportTeam(
  id: string,
  data: {
    name?: string;
    description?: string | null;
    leadId?: string | null;
    isActive?: boolean;
    departmentId?: string;
    slaInheritFromDept?: boolean;
    firstResponseSlaMinutes?: number | null;
    resolutionSlaMinutes?: number | null;
    businessHoursInherit?: boolean;
    businessHoursStartMin?: number | null;
    businessHoursEndMin?: number | null;
    businessDays?: number[];
    timezone?: string | null;
    maxTicketsPerAgent?: number;
    concurrentTicketLimitPerAgent?: number;
    skillSpecialization?: string | null;
  },
): Promise<SupportTeam> {
  return api(`/support/teams/${id}`, { method: "PATCH", body: JSON.stringify(data) });
}

export async function deleteSupportTeam(id: string): Promise<SupportTeam> {
  return api(`/support/teams/${id}`, { method: "DELETE" });
}

export async function restoreSupportTeam(id: string): Promise<SupportTeam> {
  return api(`/support/teams/${id}/restore`, { method: "POST" });
}

// ── Agent ↔ Team memberships ───────────────────────────────────────────────

export async function addAgentToTeam(
  agentId: string,
  teamId: string,
  data?: { isPrimary?: boolean; assignedBy?: string },
): Promise<SupportAgentTeamMembership> {
  return api(`/support/agents/${agentId}/teams/${teamId}`, {
    method: "POST",
    body: JSON.stringify(data ?? {}),
  });
}

export async function removeAgentFromTeam(
  agentId: string,
  teamId: string,
): Promise<SupportAgentTeamMembership> {
  return api(`/support/agents/${agentId}/teams/${teamId}`, { method: "DELETE" });
}

export async function setPrimaryTeam(
  agentId: string,
  teamId: string,
): Promise<SupportAgentTeamMembership> {
  return api(`/support/agents/${agentId}/teams/${teamId}/primary`, { method: "POST" });
}

// ────────────────────────────────────────────────────────────────────────────
// Phases 2–4 — Support Analytics, KPIs, Reports, Predictive
// ────────────────────────────────────────────────────────────────────────────

export interface SupportOrgMetrics {
  id: string;
  generatedAt: string;
  tickets: {
    total: number;
    new24h: number;
    new7d: number;
    new30d: number;
    avgDaily7d: number;
    avgDaily30d: number;
    backlog: number;
    escalated: number;
  };
  statusBreakdown: Record<string, number>;
  priorityBreakdown: Record<string, number>;
  satisfaction: { avg: number | null; count: number };
  sla: {
    responseAdherencePct: number | null;
    resolutionAdherencePct: number | null;
    breached: number;
  };
  agents: {
    total: number;
    active: number;
    assignedTickets: number;
    avgTicketsPerActiveAgent: number;
  };
  teams?: { total: number; active: number };
  memberships?: { active: number };
}

export interface SupportTeamKpis {
  id: string;
  windowDays: number;
  generatedAt: string;
  volume: {
    total: number;
    new: number;
    backlog: number;
    escalated: number;
    resolved: number;
    avgInteractionsPerTicket: number | null;
  };
  sla: {
    responseAdherencePct: number | null;
    resolutionAdherencePct: number | null;
    breachResolutionCount: number;
    breachResponseCount: number;
  };
  satisfaction: {
    csatAvg: number | null;
    csatSampleSize: number;
  };
  efficiency: {
    fcrRatePct: number | null;
    reopenRatePct: number | null;
  };
  backlogToResolvedRatio: number | null;
}

export type SupportOrgHealthGrade = "A" | "B" | "C" | "D" | "F";

export interface SupportDepartmentScorecard {
  id: string;
  name: string;
  windowDays: number;
  generatedAt: string;
  metrics: {
    totalTickets: number;
    slaResponseAdherencePct: number | null;
    slaResolutionAdherencePct: number | null;
    avgSatisfaction: number | null;
    avgInteractionsPerTicket: number | null;
    agentUtilizationPct: number | null;
  };
  varianceVsAvgPct: number | null;
  compositeScore: number;
  healthGrade: SupportOrgHealthGrade;
}

export interface SupportTicketsReportRow {
  id: string;
  subject: string;
  status: string;
  priority: string;
  type: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  departmentId: string | null;
  departmentName?: string | null;
  teamId: string | null;
  teamName?: string | null;
  assigneeId: string | null;
  assigneeName?: string | null;
  reporterId: string | null;
  reporterName?: string | null;
  slaMetResponse: boolean | null;
  slaMetResolution: boolean | null;
  satisfaction: number | null;
  interactionsCount: number | null;
}

export interface SupportTicketsReport {
  filters: Record<string, any>;
  total: number;
  page: number;
  limit: number;
  rows: SupportTicketsReportRow[];
  summary: {
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    avgSatisfaction: number | null;
    slaResponseAdherencePct: number | null;
    slaResolutionAdherencePct: number | null;
  };
}

export interface ForecastVolumePoint {
  date: string;
  dayOfWeek: number;
  forecastTickets: number;
  lowerBound: number;
  upperBound: number;
  confidencePct: number;
  adjustedForWeekend: boolean;
  seasonalityFactor: number;
}

export interface ForecastVolumeResponse {
  scope: { departmentId?: string; teamId?: string };
  days: number;
  generatedAt: string;
  summary: {
    totalForecastTickets: number;
    avgDailyForecast: number;
    peakDay: string;
    peakDayForecast: number;
    quietDay: string;
    quietDayForecast: number;
  };
  daily: ForecastVolumePoint[];
  input: {
    avgDaily30d: number;
    avgDaily7d: number;
    trendPct: number;
    daysOfHistoryUsed: number;
  };
}

export interface StaffingRecommendation {
  scope: { departmentId?: string; teamId?: string };
  generatedAt: string;
  assumptions: {
    ticketsPerAgentPerDay: number;
    utilizationTargetPct: number;
    days: number;
  };
  forecast: {
    totalTickets: number;
    avgDailyTickets: number;
  };
  agents: {
    currentActiveCount: number;
    recommendedFte: number;
    deltaFte: number;
    recommendedNewHires: number;
    recommendedReduction: number;
  };
  capacity: {
    currentDailyCapacity: number;
    requiredDailyCapacity: number;
    capacityGapDaily: number;
    utilizationForecastPct: number | null;
  };
  confidence: "LOW" | "MEDIUM" | "HIGH";
  reasons: string[];
}

export interface SlaBreachRisk {
  ticketId: string;
  generatedAt: string;
  riskScore: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  reasons: string[];
  details: {
    hoursOpen: number;
    priorityMultiplier: number;
    statusFactor: number;
    reassignmentFactor: number;
    breachProbabilityPct: number | null;
    hoursUntilDeadline: number | null;
  };
}

export interface CsatPrediction {
  ticketId: string;
  generatedAt: string;
  predictedScore: number; // 1.0 – 5.0
  confidencePct: number;
  factors: Array<{ factor: string; weight: number; direction: "UP" | "DOWN" | "NEUTRAL" }>;
  bucket: "POOR" | "FAIR" | "GOOD" | "EXCELLENT";
}

export interface SupportTicketsReportFilters {
  page?: number;
  limit?: number;
  departmentId?: string;
  teamId?: string;
  status?: string;
  priority?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export async function getSupportDepartmentMetrics(
  departmentId: string,
): Promise<SupportOrgMetrics> {
  return api(`/support/departments/${encodeURIComponent(departmentId)}/metrics`);
}

export async function getSupportTeamMetrics(teamId: string): Promise<SupportOrgMetrics> {
  return api(`/support/teams/${encodeURIComponent(teamId)}/metrics`);
}

export async function getSupportTeamKpis(teamId: string): Promise<SupportTeamKpis> {
  return api(`/support/teams/${encodeURIComponent(teamId)}/kpis`);
}

export async function getSupportDepartmentScorecard(params?: {
  windowDays?: number;
}): Promise<SupportDepartmentScorecard[]> {
  return api("/support/departments/scorecard", { query: params });
}

export async function getSupportTicketsReport(
  filters: SupportTicketsReportFilters = {},
): Promise<SupportTicketsReport> {
  return api("/support/tickets-report", { query: filters as Record<string, any> });
}

export function getSupportTicketsReportCsvUrl(
  filters: Omit<SupportTicketsReportFilters, "page" | "limit"> = {},
): string {
  const base = `${API_BASE_URL.replace(/\/+$/, "")}/support/tickets-report.csv`;
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v === undefined || v === null || v === "") continue;
    sp.set(k, String(v));
  }
  const qs = sp.toString();
  return qs ? `${base}?${qs}` : base;
}

export async function getSupportTicketVolumeForecast(params?: {
  departmentId?: string;
  teamId?: string;
  days?: number;
}): Promise<ForecastVolumeResponse> {
  return api("/support/forecast/volume", { query: params });
}

export async function getSupportStaffingRecommendation(params?: {
  departmentId?: string;
  teamId?: string;
  ticketsPerAgentPerDay?: number;
  utilizationTargetPct?: number;
  days?: number;
}): Promise<StaffingRecommendation> {
  return api("/support/forecast/staffing", { query: params });
}

export async function getSupportTicketRisk(ticketId: string): Promise<SlaBreachRisk> {
  return api(`/support/tickets/${encodeURIComponent(ticketId)}/risk`);
}

export async function getSupportTicketCsatPrediction(ticketId: string): Promise<CsatPrediction> {
  return api(`/support/tickets/${encodeURIComponent(ticketId)}/csat-prediction`);
}

// ============ STATUS PAGE ============
export type ServiceName = 'database' | 'api' | 'redis' | 'storage' | 'webhooks';
export type ServiceStatus = 'healthy' | 'degraded' | 'down';
export type OverallStatus = 'operational' | 'degraded' | 'outage';
export type Severity = 'info' | 'warning' | 'critical';

export interface ProbeResult {
  service: ServiceName;
  status: ServiceStatus;
  latencyP50: number;
  latencyP95: number;
  latencyP99: number;
  utilization: number;
  errorRate: number;
  queueDepth?: number;
  extra?: Record<string, unknown>;
}

export interface RealtimeStatusResponse {
  overall: OverallStatus;
  updatedAt: string;
  services: Record<ServiceName, { current: ProbeResult; spark: ProbeResult[] }>;
  recentAlerts: AlertItem[];
}

export interface MetricsSeriesResponse {
  service: ServiceName;
  range: '1h' | '6h' | '24h' | '7d';
  points: ProbeResult[];
}

export interface AlertRule {
  id: string;
  service: ServiceName;
  metric: 'latency-p50' | 'latency-p95' | 'latency-p99' | 'utilization' | 'error-rate' | 'queue-depth';
  operator: '>' | '<' | '>=' | '<=' | '==';
  threshold: number;
  windowSeconds: number;
  severity: Severity;
  channels: Record<string, unknown> & { dashboard?: boolean; email?: boolean; teams?: string; slack?: string };
  enabled: boolean;
  cooldownSeconds: number;
  lastFiredAt?: string;
  createdById?: string;
  updatedAt: string;
  createdAt: string;
}

export interface AlertRuleListResponse {
  items: AlertRule[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AlertItem {
  id: string;
  ruleId?: string;
  service: ServiceName;
  severity: Severity;
  message: string;
  value?: number;
  threshold?: number;
  acknowledgedAt?: string;
  acknowledgedById?: string;
  snoozedUntil?: string;
  closedAt?: string;
  closeNote?: string;
  incidentId?: string;
  createdAt: string;
  rule?: AlertRule;
  incident?: Incident;
}

export interface AlertListResponse {
  items: AlertItem[];
  hasMore: boolean;
  nextCursor: string | null;
}

export interface Incident {
  id: string;
  title: string;
  severity: Severity;
  service: ServiceName;
  startedAt: string;
  detectedAt?: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  postmortemUrl?: string;
  summary?: string;
  alerts: any[];
  createdAt: string;
  updatedAt: string;
  _count?: { alerts: number };
}

export interface TestRuleResponse {
  fired: boolean;
  value: number | null;
  reason: string;
  channels: Array<{ name: string; ok: boolean; error?: string }>;
}

export async function getStatusRealtime(): Promise<RealtimeStatusResponse> {
  return api("/admin/metrics/realtime");
}

export async function getMetricsSeries(
  service: ServiceName,
  range: '1h' | '6h' | '24h' | '7d' = '24h',
): Promise<MetricsSeriesResponse> {
  return api("/admin/metrics/series", { query: { service, range } });
}

export async function listAlertRules(page = 1, pageSize = 50): Promise<AlertRuleListResponse> {
  return api("/admin/alerts/rules", { query: { page, pageSize } });
}

export async function createAlertRule(data: Omit<AlertRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<AlertRule> {
  return api("/admin/alerts/rules", { method: "POST", body: JSON.stringify(data) });
}

export async function updateAlertRule(
  id: string,
  patch: Partial<AlertRule>,
): Promise<AlertRule> {
  return api(`/admin/alerts/rules/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
}

export async function deleteAlertRule(id: string): Promise<void> {
  return api(`/admin/alerts/rules/${id}`, { method: "DELETE" });
}

export async function testAlertRule(id: string): Promise<TestRuleResponse> {
  return api(`/admin/alerts/rules/${id}/test`, { method: "POST" });
}

export async function listAlerts(params?: {
  severity?: string;
  service?: string;
  acked?: boolean;
  since?: string;
  until?: string;
  cursor?: string;
  limit?: number;
}): Promise<AlertListResponse> {
  return api("/admin/alerts", { query: params });
}

export async function bulkAckAlerts(ids: string[]): Promise<{ acked: number }> {
  return api("/admin/alerts/bulk-ack", { method: "POST", body: JSON.stringify({ ids }) });
}

export async function bulkSnoozeAlerts(ids: string[], until: string): Promise<{ snoozed: number }> {
  return api("/admin/alerts/bulk-snooze", { method: "POST", body: JSON.stringify({ ids, until }) });
}

export async function closeAlert(id: string, closeNote: string): Promise<AlertItem> {
  return api(`/admin/alerts/${id}/close`, { method: "POST", body: JSON.stringify({ closeNote }) });
}

export async function listIncidents(limit = 30): Promise<Incident[]> {
  return api("/admin/incidents", { query: { limit } });
}

export async function updateIncident(
  id: string,
  patch: { title?: string; postmortemUrl?: string; summary?: string },
): Promise<Incident> {
  return api(`/admin/incidents/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
}

export async function getStatusViewPrefs(): Promise<Record<string, unknown> | null> {
  return api("/admin/settings/status-view");
}

export async function saveStatusViewPrefs(prefs: Record<string, unknown>): Promise<{ ok: true }> {
  return api("/admin/settings/status-view", { method: "PUT", body: JSON.stringify(prefs) });
}
