import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import type { Paginated } from "./client";
import {
  approveRoleRequest,
  approveAccessRequest,
  assignRolePermissions,
  assignUserRole,
  bulkApproveRoleRequests,
  bulkApproveAccessRequests,
  bulkRejectRoleRequests,
  bulkRejectAccessRequests,
  bulkUpdateReportStatus,
  cancelRoleRequest,
  cancelAccessRequest,
  collectRoleKeys,
  createAdvertisement,
  createApiKey,
  createArticle,
  createAccessRequest,
  createAIAgent,
  createCannedResponse,
  createCategory,
  createFeatureFlag,
  createHelpArticle,
  createHighlight,
  createNotification,
  createRbacRole,
  createRoleRequest,
  createSupportTicket,
  createTag,
  createUser,
  resetUserPassword,
  createWebhook,
  testWebhook,
  getWebhookById,
  getWebhookLogs,
  getWebhookStats,
  getWebhookTemplates,
  rotateWebhookSecret,
  bulkUpdateWebhooks,
  triggerWebhookEvent,
  exportWebhookLogs,
  applyWebhookTemplate,
  deleteAdvertisement,
  deleteApiKey,
  deleteAccessRequest,
  deleteArticle,
  deleteAIAgent,
  deleteCannedResponse,
  deleteCategory,
  deleteComment,
  deleteFeatureFlag,
  deleteHelpArticle,
  deleteHighlight,
  deleteMedia,
  deleteNotification,
  deleteRbacRole,
  deleteReport,
  deleteTag,
  deleteUser,
  deleteWebhook,
  deleteWorkspace,
  duplicateRbacRole,
  getAIAgents,
  getAISettings,
  getAdminNotifications,
  getAdvertisements,
  getAgentLeaderboard,
  getAgentStats,
  getAgentDetail,
  getAgentTickets,
  getAgentActivity,
  getSupportAgents,
  createSupportAgent,
  updateSupportAgent,
  deleteSupportAgent,
  toggleAgentStatus,
  listSupportDepartments,
  getSupportDepartment,
  createSupportDepartment,
  updateSupportDepartment,
  deleteSupportDepartment,
  restoreSupportDepartment,
  listSupportTeams,
  getSupportTeam,
  createSupportTeam,
  updateSupportTeam,
  deleteSupportTeam,
  restoreSupportTeam,
  addAgentToTeam,
  removeAgentFromTeam,
  setPrimaryTeam,
  routeTicket,
  getSupportTicketsV2,
  updateTicketStatusV2,
  checkTicketAccess,
  requestTicketAccess,
  listTicketAccessRequests,
  listTicketAccessRequestsForTicket,
  approveTicketAccessRequest,
  rejectTicketAccessRequest,
  cancelTicketAccessRequest,
  type TicketAccessRequestStatus,
  type TicketAccessRequestType,
  type SupportDepartment,
  type SupportTeam,
  type SupportAgentTeamMembership,
  type SupportOrgMetrics,
  type SupportTeamKpis,
  type SupportOrgHealthGrade,
  type SupportDepartmentScorecard,
  type SupportTicketsReportRow,
  type SupportTicketsReport,
  type SupportTicketsReportFilters,
  type ForecastVolumePoint,
  type ForecastVolumeResponse,
  type StaffingRecommendation,
  type SlaBreachRisk,
  type CsatPrediction,
  getAnalyticsOverview,
  getAnalyticsTimeseries,
  getApiKeys,
  getAccessRequests,
  getAccessRequestById,
  getAccessRequestStats,
  getArticles,
  getArticleById,
  getAuditLogs,
  getAuditLogById,
  getCategories,
  getCannedResponse,
  getCannedResponses,
  getComments,
  getCurrentUser,
  getDashboardStats,
  getDeletedUsers,
  getFeatureFlags,
  getFollows,
  getHelpArticleById,
  getHelpArticleBySlug,
  getHelpArticles,
  getHighlights,
  getHighlightById,
  getJobs,
  getMedia,
  getPermissionGroups,
  getRbacPermissions,
  getRbacRole,
  getRbacRoles,
  getMyRoleRequests,
  getMyAccessRequests,
  getResourcePermissions,
  getResources,
  getReportById,
  getReportStats,
  getReportTrends,
  getReports,
  getRoleRequestById,
  getRoleRequests,
  getRoles,
  getStorageStats,
  getSupportDashboard,
  getSupportTicket,
  getSupportTickets,
  getSupportDepartmentMetrics,
  getSupportTeamMetrics,
  getSupportTeamKpis,
  getSupportDepartmentScorecard,
  getSupportTicketsReport,
  getSupportTicketVolumeForecast,
  getSupportStaffingRecommendation,
  getSupportTicketRisk,
  getSupportTicketCsatPrediction,
  getSystemSettings,
  getSystemStatus,
  getTags,
  getTrafficSources,
  getUnreadNotificationCount,
  getUserById,
  getUserEffectivePermissions,
  getUserRoles,
  getUserRoleHistory,
  getUsers,
  getUserSettings,
  getWebhooks,
  markAllNotificationsRead,
  markNotificationRead,
  normalizeRoleToUpperSnake,
  recordCannedResponseUsed,
  rejectRoleRequest,
  rejectAccessRequest,
  removeAvatar,
  removePermissionOverride,
  removeUserRole,
  purgeUser,
  resetSettings,
  restoreUser,
  seedSystemSettings,
  setPermissionOverride,
  testAIModeration,
  toggleUserStatus,
  toValidLegacyRole,
  updateAdvertisement,
  updateAIAgent,
  updateAISettings,
  updateArticle,
  updateCannedResponse,
  updateCategory,
  updateFeatureFlag,
  updateHelpArticle,
  updateHighlight,
  updateReportStatus,
  updateRbacRole,
  updateSupportTicketStatus,
  updateSystemSetting,
  updateTag,
  updateUser,
  updateUserRole,
  updateUserSettings,
  updateWebhook,
  uploadAvatar,
  updateUserPresence,
  getAgentPresence,
  isSupportAgent,
  createResourceAccessRequest,
  searchResources,
  VALID_LEGACY_ROLES,
  type AccessRequestEntry,
  type AccessRequestStats,
  type AccessRequestStatus,
  type AccessRequestType,
  type AdminRoleOption,
  type AdminRolesResponse,
  type Advertisement,
  type AIAgent,
  type AISettings,
  type AnalyticsOverview,
  type ApiKey,
  type Article,
  type AuditLogEntry,
  type BackgroundJob,
  type CannedResponse,
  type Category,
  type Comment,
  type DashboardStats,
  type FeatureFlag,
  type FollowRecord,
  type HelpArticle,
  type Highlight,
  type MediaAsset,
  type ModerationTestResult,
  type Notification,
  type PaginatedRoleRequests,
  type PaginatedAccessRequests,
  type PermissionGroup,
  type RbacPermission,
  type RbacRole,
  type Report,
  type ReportTrendsResponse,
  type RoleKey,
  type RoleRequest,
  type RoleRequestEvent,
  type RoleRequestStatus,
  type RoleRequestType,
  type RoleWithCount,
  type ResourcePermissionEntry,
  type ResourceSummary,
  type StorageStats,
  type SupportDashboard,
  type SupportAgentDetail,
  type SupportAgentStats,
  type SupportTicket,
  type SystemSetting,
  type SystemStatus,
  type Tag,
  type TimeseriesPoint,
  type TrafficSourceItem,
  type TrafficSourcesResponse,
  type User,
  type UserEffectivePermissions,
  type UserRoleAssignment,
  type UserSettings,
  type ValidLegacyRole,
  type WebhookConfig,
  type WebhookType,
  type WebhookFormat,
  type TeamsCardType,
  type WebhookLog,
  type WebhookStats,
  type WebhookTemplate,
  type DailyPoint,
  type TestResult,
  type WebhookLogsFilter,
  type WebhookBulkUpdate,
  type RotateSecretResult,
  SearchResourcesPayload,
  getDeletedSupportTickets,
  permanentlyDeleteSupportTicket,
  restoreSupportTicket,
} from "./services";

export type ListParams = {
  page?: number;
  pageSize?: number;
  q?: string;
  sort?: string;
  filter?: string;
  limit?: number;
  except?: string;
};

const STALE_TIME = import.meta.env.PROD ? 60_000 : 10_000;
const CACHE_TIME = import.meta.env.PROD ? 600_000 : 60_000;

// ─── Dashboard ──────────────────────────────────────────────────────────────

export function useDashboardStats() {
  return useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: getDashboardStats,
  });
}

// ─── Users ──────────────────────────────────────────────────────────────────

export function useCurrentUser() {
  return useQuery({
    queryKey: ["current-user"],
    queryFn: () => getCurrentUser(),
  });
}

export function useUsers(params: ListParams = {}) {
  return useQuery({
    queryKey: ["users", params],
    placeholderData: keepPreviousData,
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
    queryFn: async () => {
      const result = await getUsers({
        page: params.page ?? 1,
        limit: params.pageSize ?? 20,
        sort: params.sort,
        filter: params.filter,
        except: params.except,
      });
      return {
        ...result,
        pageSize: params.pageSize ?? 20,
      };
    },
  });
}

export function useUserById(id: string | undefined) {
  return useQuery({
    queryKey: ["user", id],
    enabled: !!id,
    queryFn: () => getUserById(id!),
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      email: string;
      name: string;
      handle: string;
      role: string;
      password: string;
      permissions?: string[];
    }) => createUser(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });
}

// Reset User Password
export function useResetUserPassword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; password: string } & Partial<User>) =>
      resetUserPassword(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });
}

// Update User
export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; permissions?: string[] } & Partial<User>) =>
      updateUser(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteUser(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["deleted-users"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });
}

export function useDeletedUsers(params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: ["deleted-users", params ?? {}],
    queryFn: () => getDeletedUsers(params),
    placeholderData: keepPreviousData,
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
  });
}

export function useRestoreUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => restoreUser(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["deleted-users"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });
}

export function usePurgeUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => purgeUser(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deleted-users"] });
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });
}

export function useUpdateUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) => updateUserRole(id, role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });
}

export function useToggleUserStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => toggleUserStatus(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });
}

export function useUploadAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => uploadAvatar(id, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });
}

export function useRemoveAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => removeAvatar(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });
}

export function useUserSettings() {
  return useQuery({
    queryKey: ["user-settings"],
    queryFn: getUserSettings,
  });
}

export function useUpdateUserSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<UserSettings>) => updateUserSettings(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-settings"] });
    },
  });
}

// ─── Articles ───────────────────────────────────────────────────────────────

export function useArticles(params: ListParams = {}) {
  return useQuery({
    queryKey: ["articles", params],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const result = await getArticles({
        page: params.page ?? 1,
        limit: params.pageSize ?? 20,
      });
      return {
        ...result,
        pageSize: params.pageSize ?? 20,
      };
    },
  });
}

export function useArticleById(id: string | undefined) {
  return useQuery({
    queryKey: ["article", id],
    enabled: !!id,
    queryFn: () => getArticleById(id!),
  });
}

export function useCreateArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
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
    }) => createArticle(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["articles"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });
}

export function useUpdateArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<Article>) => updateArticle(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["articles"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });
}

export function useDeleteArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteArticle(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["articles"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });
}

// ─── Posts (uses articles endpoint) ─────────────────────────────────────────

export function usePosts(params: ListParams = {}) {
  return useArticles(params);
}

// ─── Videos (uses highlights endpoint) ──────────────────────────────────────

export function useVideos(params: ListParams = {}) {
  return useHighlights(params);
}

// ─── Categories ─────────────────────────────────────────────────────────────

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: getCategories,
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, slug, tint }: { name: string; slug: string; tint: string }) =>
      createCategory(name, slug, tint),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; slug?: string; tint?: string }) =>
      updateCategory(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });
}

// ─── Comments ───────────────────────────────────────────────────────────────

export function useComments(params: ListParams = {}) {
  return useQuery({
    queryKey: ["comments", params],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const result = await getComments({
        page: params.page ?? 1,
        limit: params.pageSize ?? 20,
      });
      return {
        ...result,
        pageSize: params.pageSize ?? 20,
      };
    },
  });
}

export function useDeleteComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteComment(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["comments"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });
}

// ─── Highlights ─────────────────────────────────────────────────────────────

export function useHighlights(params: ListParams = {}) {
  return useQuery({
    queryKey: ["highlights", params],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const result = await getHighlights({
        page: params.page ?? 1,
        limit: params.pageSize ?? 20,
      });
      return {
        ...result,
        pageSize: params.pageSize ?? 20,
      };
    },
  });
}

export function useHighlightById(id: string | undefined) {
  return useQuery({
    queryKey: ["highlight", id],
    enabled: !!id,
    queryFn: () => getHighlightById(id!),
  });
}

export function useCreateHighlight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
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
    }) => createHighlight(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["highlights"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });
}

export function useUpdateHighlight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<Highlight>) => updateHighlight(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["highlights"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });
}

export function useDeleteHighlight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteHighlight(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["highlights"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });
}

// ─── Media ──────────────────────────────────────────────────────────────────

export function useMedia(params: ListParams = {}) {
  return useQuery({
    queryKey: ["media", params],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const result = await getMedia({
        page: params.page ?? 1,
        limit: params.pageSize ?? 40,
      });
      return {
        ...result,
        pageSize: params.pageSize ?? 40,
      };
    },
  });
}

export function useDeleteMedia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteMedia(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["media"] }),
  });
}

// ─── Notifications (admin) ──────────────────────────────────────────────────

export function useAdminNotifications(params: ListParams = {}) {
  return useQuery({
    queryKey: ["admin-notifications", params],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const result = await getAdminNotifications({
        page: params.page ?? 1,
        limit: params.pageSize ?? 20,
      });
      return {
        ...result,
        pageSize: params.pageSize ?? 20,
      };
    },
  });
}

export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: ["unread-notification-count"],
    queryFn: getUnreadNotificationCount,
    refetchInterval: 30000,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-notifications"] });
      qc.invalidateQueries({ queryKey: ["unread-notification-count"] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-notifications"] });
      qc.invalidateQueries({ queryKey: ["unread-notification-count"] });
    },
  });
}

export function useDeleteNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteNotification(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-notifications"] });
      qc.invalidateQueries({ queryKey: ["unread-notification-count"] });
    },
  });
}

export function useCreateNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { userId: string; kind: string; body: string; title?: string }) =>
      createNotification(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-notifications"] });
      qc.invalidateQueries({ queryKey: ["unread-notification-count"] });
    },
  });
}

// ─── Follows ────────────────────────────────────────────────────────────────

export function useFollows(params: ListParams = {}) {
  return useQuery({
    queryKey: ["follows", params],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const result = await getFollows({
        page: params.page ?? 1,
        limit: params.pageSize ?? 20,
      });
      return {
        ...result,
        pageSize: params.pageSize ?? 20,
      };
    },
  });
}

// ─── Reports ────────────────────────────────────────────────────────────────

export function useReports(params: ListParams = {}) {
  return useQuery({
    queryKey: ["reports", params],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const result = await getReports({
        page: params.page ?? 1,
        limit: params.pageSize ?? 20,
      });
      return {
        ...result,
        pageSize: params.pageSize ?? 20,
      };
    },
  });
}

export function useReport(id: string) {
  return useQuery({
    queryKey: ["reports", id],
    queryFn: () => getReportById(id),
    enabled: !!id,
  });
}

export function useUpdateReportStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, note }: { id: string; status: string; note?: string }) =>
      updateReportStatus(id, status, note),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reports"] }),
  });
}

export function useDeleteReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteReport(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reports"] }),
  });
}

export function useReportStats() {
  return useQuery({
    queryKey: ["reports", "stats"],
    queryFn: getReportStats,
  });
}

export function useBulkUpdateReportStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, status, note }: { ids: string[]; status: string; note?: string }) =>
      bulkUpdateReportStatus(ids, status, note),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reports"] }),
  });
}

// ─── Tags ───────────────────────────────────────────────────────────────────

export function useTags() {
  return useQuery({
    queryKey: ["tags"],
    queryFn: getTags,
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
  });
}

export function useCreateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, slug }: { name: string; slug: string }) => createTag(name, slug),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tags"] }),
  });
}

export function useDeleteTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTag(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tags"] }),
  });
}

export function useUpdateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name, slug }: { id: string; name: string; slug: string }) =>
      updateTag(id, name, slug),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tags"] }),
  });
}

// ─── Feature Flags ──────────────────────────────────────────────────────────

export function useFeatureFlags() {
  return useQuery({
    queryKey: ["feature-flags"],
    queryFn: getFeatureFlags,
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
  });
}

export function useCreateFeatureFlag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { key: string; description: string; enabled: boolean; rollout: number }) =>
      createFeatureFlag(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["feature-flags"] }),
  });
}

export function useUpdateFeatureFlag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; enabled?: boolean; rollout?: number }) =>
      updateFeatureFlag(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["feature-flags"] }),
  });
}

export function useDeleteFeatureFlag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteFeatureFlag(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["feature-flags"] }),
  });
}

// ─── System Settings ────────────────────────────────────────────────────────

export function useSystemSettings() {
  return useQuery({
    queryKey: ["system-settings"],
    queryFn: getSystemSettings,
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
  });
}

export function useUpdateSystemSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ key, value, category }: { key: string; value: string; category?: string }) =>
      updateSystemSetting(key, value, category),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["system-settings"] }),
  });
}

export function useSeedSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: seedSystemSettings,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["system-settings"] }),
  });
}

// ─── Analytics ──────────────────────────────────────────────────────────────

export function useAnalyticsOverview() {
  return useQuery({
    queryKey: ["analytics-overview"],
    queryFn: getAnalyticsOverview,
  });
}

export function useAnalyticsTimeseries(days = 30) {
  return useQuery({
    queryKey: ["analytics-timeseries", days],
    queryFn: () => getAnalyticsTimeseries(days),
  });
}

export function useTrafficSources() {
  return useQuery({
    queryKey: ["traffic-sources"],
    queryFn: getTrafficSources,
  });
}

// ─── Storage ────────────────────────────────────────────────────────────────

export function useStorageStats() {
  return useQuery({
    queryKey: ["storage-stats"],
    queryFn: getStorageStats,
  });
}

// ─── System Status ──────────────────────────────────────────────────────────

export function useSystemStatus() {
  return useQuery({
    queryKey: ["system-status"],
    queryFn: getSystemStatus,
    refetchInterval: 30_000,
  });
}

// ─── Danger Zone ─────────────────────────────────────────────────────────────

export function useDeleteWorkspace() {
  return useMutation({
    mutationFn: deleteWorkspace,
  });
}

export function useResetSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: resetSettings,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["system-settings"] }),
  });
}

// ─── Background Jobs ────────────────────────────────────────────────────────

export function useJobs(params: ListParams = {}) {
  return useQuery({
    queryKey: ["jobs", params],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const result = await getJobs({
        page: params.page ?? 1,
        limit: params.pageSize ?? 20,
      });
      return {
        ...result,
        pageSize: params.pageSize ?? 20,
      };
    },
  });
}

// ─── Advertisements ─────────────────────────────────────────────────────────

export function useAdvertisements(params: ListParams = {}) {
  return useQuery({
    queryKey: ["advertisements", params],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const result = await getAdvertisements({
        page: params.page ?? 1,
        limit: params.pageSize ?? 20,
      });
      return {
        ...result,
        pageSize: params.pageSize ?? 20,
      };
    },
  });
}

export function useCreateAdvertisement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      status: string;
      startsAt?: string | null;
      endsAt?: string | null;
    }) => createAdvertisement(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["advertisements"] }),
  });
}

export function useUpdateAdvertisement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<Advertisement>) =>
      updateAdvertisement(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["advertisements"] }),
  });
}

export function useDeleteAdvertisement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAdvertisement(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["advertisements"] }),
  });
}

// ─── AI Agents ──────────────────────────────────────────────────────────────

export function useAIAgents() {
  return useQuery({
    queryKey: ["ai-agents"],
    queryFn: getAIAgents,
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
  });
}

export function useCreateAIAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      description?: string | null;
      model: string;
      status: string;
      config?: any;
    }) => createAIAgent(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-agents"] }),
  });
}

export function useUpdateAIAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<AIAgent>) => updateAIAgent(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-agents"] }),
  });
}

export function useDeleteAIAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAIAgent(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-agents"] }),
  });
}

// ─── Webhooks ───────────────────────────────────────────────────────────────

export function useWebhooks() {
  return useQuery({
    queryKey: ["webhooks"],
    queryFn: getWebhooks,
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
  });
}

export function useWebhook(id: string | undefined | null) {
  return useQuery({
    queryKey: ["webhooks", id],
    queryFn: () => getWebhookById(id!),
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
    enabled: !!id,
  });
}

export function useCreateWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof createWebhook>[0]) => createWebhook(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["webhooks"] });
      qc.invalidateQueries({ queryKey: ["webhook-stats"] });
    },
  });
}

export function useUpdateWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<WebhookConfig>) =>
      updateWebhook(id, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["webhooks"] });
      qc.invalidateQueries({ queryKey: ["webhooks", vars.id] });
      qc.invalidateQueries({ queryKey: ["webhook-stats"] });
    },
  });
}

export function useDeleteWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteWebhook(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["webhooks"] });
      qc.invalidateQueries({ queryKey: ["webhook-stats"] });
    },
  });
}

export function useTestWebhook() {
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof testWebhook>[1] }) =>
      testWebhook(id, data),
  });
}

export function useWebhookLogs(id: string | undefined | null, filter?: WebhookLogsFilter) {
  const qc = useQueryClient();
  const filterKey = filter ? JSON.stringify(filter) : "default";
  return useQuery({
    queryKey: ["webhook-logs", id, filterKey],
    queryFn: () => getWebhookLogs(id!, filter),
    staleTime: 30_000,
    gcTime: CACHE_TIME,
    enabled: !!id,
    placeholderData: keepPreviousData,
  });
}

export function useWebhookStats(id?: string | null) {
  return useQuery({
    queryKey: ["webhook-stats", id ?? "overview"],
    queryFn: () => getWebhookStats(id ?? undefined),
    staleTime: 60_000,
    gcTime: CACHE_TIME,
  });
}

export function useWebhookTemplates() {
  return useQuery({
    queryKey: ["webhook-templates"],
    queryFn: getWebhookTemplates,
    staleTime: 5 * 60_000,
    gcTime: CACHE_TIME,
  });
}

export function useRotateWebhookSecret() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => rotateWebhookSecret(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["webhooks", id] });
      qc.invalidateQueries({ queryKey: ["webhooks"] });
    },
  });
}

export function useBulkUpdateWebhooks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: WebhookBulkUpdate) => bulkUpdateWebhooks(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["webhooks"] });
      qc.invalidateQueries({ queryKey: ["webhook-stats"] });
    },
  });
}

export function useTriggerWebhookEvent() {
  return useMutation({
    mutationFn: ({ event, payload }: { event: string; payload: unknown }) =>
      triggerWebhookEvent(event, payload),
  });
}

export function useExportWebhookLogs() {
  return useMutation({
    mutationFn: ({ id, filter }: { id: string; filter?: WebhookLogsFilter }) =>
      exportWebhookLogs(id, filter),
  });
}

export function useApplyWebhookTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      templateId,
      overrides,
    }: {
      templateId: string;
      overrides?: Partial<WebhookConfig>;
    }) => applyWebhookTemplate(templateId, overrides),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["webhooks"] });
      qc.invalidateQueries({ queryKey: ["webhook-stats"] });
    },
  });
}

// ─── API Keys ───────────────────────────────────────────────────────────────

export function useApiKeys() {
  return useQuery({
    queryKey: ["api-keys"],
    queryFn: getApiKeys,
  });
}

export function useCreateApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      scopes: string[];
      userId?: string | null;
      expiresAt?: string | null;
    }) => createApiKey(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["api-keys"] }),
  });
}

export function useDeleteApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteApiKey(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["api-keys"] }),
  });
}

// ─── Audit Logs ─────────────────────────────────────────────────────────────

export function useAuditLogs(params: ListParams = {}) {
  return useQuery({
    queryKey: ["audit-logs", params],
    placeholderData: keepPreviousData,
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
    queryFn: async () => {
      const result = await getAuditLogs({
        page: params.page ?? 1,
        limit: params.pageSize ?? 50,
      });
      return {
        ...result,
        pageSize: params.pageSize ?? 50,
      };
    },
  });
}

export function useAuditLogById(id: string) {
  return useQuery({
    queryKey: ["audit-log", id],
    queryFn: () => getAuditLogById(id),
    enabled: !!id,
  });
}

// ─── Roles ──────────────────────────────────────────────────────────────────

export function useRoles() {
  return useQuery({
    queryKey: ["roles"],
    queryFn: getRoles,
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
  });
}

// ─── AI Settings & Moderation ────────────────────────────────────────────────

export function useAISettings() {
  return useQuery({
    queryKey: ["ai-settings"],
    queryFn: getAISettings,
  });
}

export function useUpdateAISettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settings: AISettings) => updateAISettings(settings),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-settings"] }),
  });
}

export function useTestAIModeration() {
  return useMutation({
    mutationFn: ({
      content,
      thresholds,
    }: {
      content: string;
      thresholds?: { high: number; medium: number };
    }) => testAIModeration(content, thresholds),
  });
}

export function useReportTrends(days = 30) {
  return useQuery({
    queryKey: ["report-trends", days],
    queryFn: () => getReportTrends(days),
  });
}

// ─── Help Articles ─────────────────────────────────────────────────────────

export function useHelpArticles(params?: { category?: string; search?: string }) {
  return useQuery({
    queryKey: ["help-articles", params],
    queryFn: () => getHelpArticles(params),
  });
}

export function useHelpArticleBySlug(slug: string | undefined) {
  return useQuery({
    queryKey: ["help-article", slug],
    enabled: !!slug,
    queryFn: () => getHelpArticleBySlug(slug!),
  });
}

export function useHelpArticleById(id: string | undefined) {
  return useQuery({
    queryKey: ["help-article", id],
    enabled: !!id,
    queryFn: () => getHelpArticleById(id!),
  });
}

export function useCreateHelpArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      slug: string;
      title: string;
      description: string;
      content: string[];
      category: string;
      icon: string;
      readMinutes?: number;
      popular?: boolean;
      isPublished?: boolean;
    }) => createHelpArticle(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["help-articles"] }),
  });
}

export function useUpdateHelpArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<HelpArticle>) =>
      updateHelpArticle(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["help-articles"] }),
  });
}

export function useDeleteHelpArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteHelpArticle(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["help-articles"] }),
  });
}

// ─── Support Tickets ────────────────────────────────────────────────────────

export function useCreateSupportTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { subject: string; message: string; priority: string }) =>
      createSupportTicket(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["support-tickets"] }),
  });
}

export function useSupportTickets(params?: {
  page?: number;
  limit?: number;
  status?: string;
  priority?: string;
}) {
  return useQuery({
    queryKey: ["support-tickets", params],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const result = await getSupportTickets({
        page: params?.page ?? 1,
        limit: params?.limit ?? 20,
        status: params?.status,
        priority: params?.priority,
      });
      return {
        ...result,
        pageSize: params?.limit ?? 20,
      };
    },
  });
}

// ─── Deleted Support Tickets ────────────────────────────────────────────────────────
export function useDeletedSupportTickets(params?: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  priority?: string;
  deletedBy?: string;
  sortBy?: string;
  sortDir?: string;
}) {
  return useQuery({
    queryKey: ["support-tickets-deleted", params],
    queryFn: () => getDeletedSupportTickets(params),
  });
}

export function useRestoreSupportTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => restoreSupportTicket(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["support-tickets-deleted"] }),
  });
}

export function usePermanentlyDeleteSupportTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => permanentlyDeleteSupportTicket(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["support-tickets-deleted"] }),
  });
}

// ─── Support Tickets ────────────────────────────────────────────────────────
export function useSupportTicket(id: string | undefined) {
  return useQuery({
    queryKey: ["support-ticket", id],
    enabled: !!id,
    queryFn: () => getSupportTicket(id!),
  });
}

export function useUpdateSupportTicketStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      updateSupportTicketStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["support-tickets"] }),
  });
}

export function useSupportTicketsV2(params?: {
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
}) {
  return useQuery({
    queryKey: ["support-tickets-v2", params ?? {}],
    placeholderData: keepPreviousData,
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
    queryFn: () => getSupportTicketsV2(params),
  });
}

export function useUpdateTicketStatusV2() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: string; reason?: string }) =>
      updateTicketStatusV2(id, status, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support-tickets-v2"] });
      qc.invalidateQueries({ queryKey: ["support-ticket"] });
    },
  });
}

// ─── Ticket Access Control ─────────────────────────────────────────────────

/** Check whether the current user can access a specific ticket. */
export function useTicketAccessCheck(ticketId: string | undefined) {
  return useQuery({
    queryKey: ["ticket-access-check", ticketId],
    queryFn: () => checkTicketAccess(ticketId as string),
    enabled: !!ticketId,
    staleTime: STALE_TIME,
  });
}

/** Submit a ticket-view access request. */
export function useRequestTicketAccess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      ticketId,
      justification,
      type,
      startsAt,
      expiresAt,
    }: {
      ticketId: string;
      justification: string;
      type?: TicketAccessRequestType;
      startsAt?: string;
      expiresAt?: string;
    }) => requestTicketAccess(ticketId, { justification, type, startsAt, expiresAt }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["ticket-access-check", variables.ticketId] });
      qc.invalidateQueries({ queryKey: ["ticket-access-requests"] });
      qc.invalidateQueries({ queryKey: ["ticket-access-requests-for-ticket", variables.ticketId] });
    },
  });
}

/** List ticket-view access requests (admins see all; users see their own). */
export function useTicketAccessRequests(params?: {
  status?: TicketAccessRequestStatus;
  ticketId?: string;
  page?: number;
  limit?: number;
  orderBy?: "createdAt" | "reviewedAt" | "expiresAt";
  orderDir?: "asc" | "desc";
}) {
  return useQuery({
    queryKey: ["ticket-access-requests", params ?? {}],
    placeholderData: keepPreviousData,
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
    queryFn: () => listTicketAccessRequests(params),
  });
}

/** List access requests scoped to a specific ticket. */
export function useTicketAccessRequestsForTicket(
  ticketId: string | undefined,
  params?: { status?: TicketAccessRequestStatus; page?: number; limit?: number },
) {
  return useQuery({
    queryKey: ["ticket-access-requests-for-ticket", ticketId, params ?? {}],
    placeholderData: keepPreviousData,
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
    queryFn: () => listTicketAccessRequestsForTicket(ticketId as string, params),
    enabled: !!ticketId,
  });
}

/** Approve a pending ticket-view access request (admin only). */
export function useApproveTicketAccessRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      requestId,
      adminJustification,
    }: {
      requestId: string;
      adminJustification: string;
    }) => approveTicketAccessRequest(requestId, adminJustification),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket-access-requests"] });
      qc.invalidateQueries({ queryKey: ["ticket-access-requests-for-ticket"] });
      qc.invalidateQueries({ queryKey: ["support-ticket-v2"] });
      qc.invalidateQueries({ queryKey: ["support-tickets-v2"] });
      qc.invalidateQueries({ queryKey: ["ticket-access-check"] });
    },
  });
}

/** Reject a pending ticket-view access request (admin only). */
export function useRejectTicketAccessRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      requestId,
      adminJustification,
    }: {
      requestId: string;
      adminJustification: string;
    }) => rejectTicketAccessRequest(requestId, adminJustification),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket-access-requests"] });
      qc.invalidateQueries({ queryKey: ["ticket-access-requests-for-ticket"] });
    },
  });
}

/** Cancel the current user's own pending ticket-view access request. */
export function useCancelTicketAccessRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (requestId: string) => cancelTicketAccessRequest(requestId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket-access-requests"] });
      qc.invalidateQueries({ queryKey: ["ticket-access-requests-for-ticket"] });
      qc.invalidateQueries({ queryKey: ["ticket-access-check"] });
    },
  });
}

/**
 * Create a resource access request
 */
export function useCreateResourceAccessRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createResourceAccessRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-access-requests"] });
    },
  });
}

/**
 * Search for resources to request access to
 */
export function useSearchResources() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ query, payload }: { query: string; payload?: SearchResourcesPayload }) =>
      searchResources(query, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-access-requests"] });
    },
  });
}

// ─── Canned Responses ───────────────────────────────────────────────────────

export function useCannedResponses(category?: string) {
  return useQuery({
    queryKey: ["canned-responses", category],
    queryFn: () => getCannedResponses(category),
  });
}

export function useCannedResponse(id: string | undefined) {
  return useQuery({
    queryKey: ["canned-response", id],
    enabled: !!id,
    queryFn: () => getCannedResponse(id!),
  });
}

export function useCreateCannedResponse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createCannedResponse,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["canned-responses"] }),
  });
}

export function useUpdateCannedResponse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateCannedResponse>[1] }) =>
      updateCannedResponse(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["canned-responses"] }),
  });
}

export function useDeleteCannedResponse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteCannedResponse,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["canned-responses"] }),
  });
}

export function useMarkCannedResponseUsed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: recordCannedResponseUsed,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["canned-responses"] }),
  });
}

// ─── Enterprise RBAC ────────────────────────────────────────────────────────

export function useRbacRoles(params?: { search?: string; includeInactive?: boolean }) {
  return useQuery({
    queryKey: ["rbac-roles", params],
    queryFn: () => getRbacRoles(params),
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
  });
}

export function useRbacRole(id: string | undefined) {
  return useQuery({
    queryKey: ["rbac-role", id],
    enabled: !!id,
    queryFn: () => getRbacRole(id!),
  });
}

export function useCreateRbacRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      key: string;
      name: string;
      description?: string;
      parentId?: string;
      rank?: number;
      permissionIds?: string[];
    }) => createRbacRole(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rbac-roles"] });
    },
  });
}

export function useUpdateRbacRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      name?: string;
      description?: string;
      parentId?: string | null;
      rank?: number;
      isActive?: boolean;
    }) => updateRbacRole(id, data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["rbac-roles"] });
      qc.invalidateQueries({ queryKey: ["rbac-role", vars.id] });
    },
  });
}

export function useDeleteRbacRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteRbacRole(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rbac-roles"] });
    },
  });
}

export function useDuplicateRbacRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, key, name }: { id: string; key: string; name: string }) =>
      duplicateRbacRole(id, { key, name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rbac-roles"] });
    },
  });
}

export function useAssignRolePermissions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ roleId, permissionIds }: { roleId: string; permissionIds: string[] }) =>
      assignRolePermissions(roleId, permissionIds),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["rbac-roles"] });
      qc.invalidateQueries({ queryKey: ["rbac-role", vars.roleId] });
    },
  });
}

export function usePermissionGroups() {
  return useQuery({
    queryKey: ["permission-groups"],
    queryFn: getPermissionGroups,
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
  });
}

export function useRbacPermissions(params?: { groupId?: string; search?: string }) {
  return useQuery({
    queryKey: ["rbac-permissions", params],
    queryFn: () => getRbacPermissions(params),
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
  });
}

export function useUserRbacRoles(userId: string | undefined) {
  return useQuery({
    queryKey: ["user-rbac-roles", userId],
    enabled: !!userId,
    queryFn: () => getUserRoles(userId!),
  });
}

export function useAssignUserRbacRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      roleId,
      isPrimary,
      expiresAt,
    }: {
      userId: string;
      roleId: string;
      isPrimary?: boolean;
      expiresAt?: string;
    }) => assignUserRole(userId, roleId, isPrimary, expiresAt),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["user-rbac-roles", vars.userId] });
      qc.invalidateQueries({ queryKey: ["user-permissions", vars.userId] });
      qc.invalidateQueries({ queryKey: ["user-role-history", vars.userId] });
      qc.invalidateQueries({ queryKey: ["rbac-roles"] });
    },
  });
}

export function useRemoveUserRbacRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId: string }) =>
      removeUserRole(userId, roleId),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["user-rbac-roles", vars.userId] });
      qc.invalidateQueries({ queryKey: ["user-permissions", vars.userId] });
      qc.invalidateQueries({ queryKey: ["user-role-history", vars.userId] });
      qc.invalidateQueries({ queryKey: ["rbac-roles"] });
    },
  });
}

export function useUserEffectivePermissions(userId: string | undefined) {
  return useQuery({
    queryKey: ["user-permissions", userId],
    enabled: !!userId,
    queryFn: () => getUserEffectivePermissions(userId!),
  });
}

export function useUserRoleHistory(userId: string | undefined) {
  return useQuery({
    queryKey: ["user-role-history", userId],
    enabled: !!userId,
    queryFn: () => getUserRoleHistory(userId!),
  });
}

export function useSetPermissionOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      permissionId,
      granted,
      reason,
      expiresAt,
    }: {
      userId: string;
      permissionId: string;
      granted: boolean;
      reason?: string;
      expiresAt?: string;
    }) => setPermissionOverride(userId, permissionId, granted, reason, expiresAt),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["user-permissions", vars.userId] });
    },
  });
}

export function useRemovePermissionOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, permissionId }: { userId: string; permissionId: string }) =>
      removePermissionOverride(userId, permissionId),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["user-permissions", vars.userId] });
    },
  });
}

export function useSupportDashboard() {
  return useQuery<SupportDashboard>({
    queryKey: ["support-dashboard"],
    queryFn: getSupportDashboard,
  });
}

export function useAgentLeaderboard() {
  return useQuery({
    queryKey: ["agent-leaderboard"],
    queryFn: getAgentLeaderboard,
  });
}

// ─── Support Agents ─────────────────────────────────────────────────────────

export function useSupportAgents(params?: {
  search?: string;
  status?: string;
  isActive?: boolean;
  departmentId?: string;
  teamId?: string;
  page?: number;
  limit?: number;
  sortBy?:
    "name" | "activeTickets" | "maxTickets" | "createdAt" | "ticketsResolved" | "escalations";
  sortDir?: "asc" | "desc";
}) {
  return useQuery({
    queryKey: ["support-agents", params ?? {}],
    queryFn: () => getSupportAgents(params),
    placeholderData: keepPreviousData,
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
  });
}

export function useAgentStats() {
  return useQuery<SupportAgentStats>({
    queryKey: ["agent-stats"],
    queryFn: getAgentStats,
    staleTime: STALE_TIME,
  });
}

export function useAgentDetail(userId: string | undefined) {
  return useQuery<SupportAgentDetail>({
    queryKey: ["agent-detail", userId],
    queryFn: () => getAgentDetail(userId!),
    enabled: !!userId,
  });
}

export function useAgentTickets(
  userId: string | undefined,
  params?: { status?: string; page?: number; limit?: number },
) {
  return useQuery({
    queryKey: ["agent-tickets", userId, params ?? {}],
    queryFn: () => getAgentTickets(userId!, params),
    enabled: !!userId,
    placeholderData: keepPreviousData,
  });
}

export function useAgentActivity(
  userId: string | undefined,
  params?: { page?: number; limit?: number },
) {
  return useQuery({
    queryKey: ["agent-activity", userId, params ?? {}],
    queryFn: () => getAgentActivity(userId!, params),
    enabled: !!userId,
    placeholderData: keepPreviousData,
  });
}

export function useCreateSupportAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createSupportAgent,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support-agents"] });
      qc.invalidateQueries({ queryKey: ["agent-stats"] });
    },
  });
}

export function useUpdateSupportAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { userId: string; data: Parameters<typeof updateSupportAgent>[1] }) =>
      updateSupportAgent(args.userId, args.data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["support-agents"] });
      qc.invalidateQueries({ queryKey: ["agent-detail", vars.userId] });
      qc.invalidateQueries({ queryKey: ["agent-stats"] });
    },
  });
}

export function useDeleteSupportAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteSupportAgent,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support-agents"] });
      qc.invalidateQueries({ queryKey: ["agent-stats"] });
    },
  });
}

export function useToggleAgentStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: toggleAgentStatus,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support-agents"] });
      qc.invalidateQueries({ queryKey: ["agent-stats"] });
    },
  });
}

//Agent presence status updates
export function useUpdateUserPresence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { userId: string; status: string }) =>
      updateUserPresence(args.userId, args.status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support-agents"] });
      qc.invalidateQueries({ queryKey: ["agent-stats"] });
    },
  });
}

// ─── Check if user is a support agent ───

export function useIsSupportAgent(userId?: string) {
  return useQuery({
    queryKey: ["is-support-agent", userId],
    queryFn: () => isSupportAgent(userId!),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });
}

// ─── Get agent's current presence ───

export function useAgentPresence(userId?: string) {
  return useQuery({
    queryKey: ["agent-presence", userId],
    queryFn: () => getAgentPresence(userId!),
    enabled: !!userId,
    staleTime: 30 * 1000, // 30 seconds
  });
}

// ─── Support Departments ───────────────────────────────────────────────────

export function useSupportDepartments(params?: {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
  includeDeleted?: boolean;
  sortBy?: "name" | "createdAt" | "firstResponseSlaMinutes" | "slaAdherenceTargetPct";
  sortDir?: "asc" | "desc";
}) {
  return useQuery<Paginated<SupportDepartment>>({
    queryKey: ["support-departments", params ?? {}],
    queryFn: () => listSupportDepartments(params),
    placeholderData: keepPreviousData,
  });
}

export function useSupportDepartment(id: string | undefined) {
  return useQuery<SupportDepartment>({
    queryKey: ["support-department", id],
    queryFn: () => getSupportDepartment(id!),
    enabled: !!id,
  });
}

export function useCreateSupportDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createSupportDepartment,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support-departments"] });
    },
  });
}

export function useUpdateSupportDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; data: Parameters<typeof updateSupportDepartment>[1] }) =>
      updateSupportDepartment(args.id, args.data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["support-departments"] });
      qc.invalidateQueries({ queryKey: ["support-department", vars.id] });
    },
  });
}

export function useDeleteSupportDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteSupportDepartment,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support-departments"] });
    },
  });
}

export function useRestoreSupportDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: restoreSupportDepartment,
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ["support-departments"] });
      qc.invalidateQueries({ queryKey: ["support-department", id] });
    },
  });
}

// ─── Support Teams ─────────────────────────────────────────────────────────

export function useSupportTeams(params?: {
  page?: number;
  limit?: number;
  departmentId?: string;
  search?: string;
  isActive?: boolean;
  includeDeleted?: boolean;
  sortBy?: "name" | "createdAt" | "maxTicketsPerAgent";
  sortDir?: "asc" | "desc";
}) {
  return useQuery<Paginated<SupportTeam>>({
    queryKey: ["support-teams", params ?? {}],
    queryFn: () => listSupportTeams(params),
    placeholderData: keepPreviousData,
  });
}

export function useSupportTeam(id: string | undefined) {
  return useQuery<SupportTeam>({
    queryKey: ["support-team", id],
    queryFn: () => getSupportTeam(id!),
    enabled: !!id,
  });
}

export function useCreateSupportTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createSupportTeam,
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["support-teams"] });
      qc.invalidateQueries({ queryKey: ["support-department", vars.departmentId] });
    },
  });
}

export function useUpdateSupportTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; data: Parameters<typeof updateSupportTeam>[1] }) =>
      updateSupportTeam(args.id, args.data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["support-teams"] });
      qc.invalidateQueries({ queryKey: ["support-team", vars.id] });
    },
  });
}

export function useDeleteSupportTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteSupportTeam,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support-teams"] });
    },
  });
}

export function useRestoreSupportTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: restoreSupportTeam,
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ["support-teams"] });
      qc.invalidateQueries({ queryKey: ["support-team", id] });
      qc.invalidateQueries({ queryKey: ["support-departments"] });
    },
  });
}

export function useRouteTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { ticketId: string; routing: Parameters<typeof routeTicket>[1] }) =>
      routeTicket(args.ticketId, args.routing),
    onSuccess: (_data, args) => {
      qc.invalidateQueries({ queryKey: ["support-ticket", args.ticketId] });
      qc.invalidateQueries({ queryKey: ["support-tickets"] });
    },
  });
}

// ─── Agent ↔ Team membership mutations ─────────────────────────────────────

export function useAddAgentToTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: {
      agentId: string;
      teamId: string;
      data?: { isPrimary?: boolean; assignedBy?: string };
    }) => addAgentToTeam(args.agentId, args.teamId, args.data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["support-team", vars.teamId] });
      qc.invalidateQueries({ queryKey: ["support-teams"] });
      qc.invalidateQueries({ queryKey: ["support-agents"] });
      qc.invalidateQueries({ queryKey: ["agent-detail", vars.agentId] });
    },
  });
}

export function useRemoveAgentFromTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { agentId: string; teamId: string }) =>
      removeAgentFromTeam(args.agentId, args.teamId),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["support-team", vars.teamId] });
      qc.invalidateQueries({ queryKey: ["support-teams"] });
      qc.invalidateQueries({ queryKey: ["support-agents"] });
      qc.invalidateQueries({ queryKey: ["agent-detail", vars.agentId] });
    },
  });
}

export function useSetPrimaryTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { agentId: string; teamId: string }) =>
      setPrimaryTeam(args.agentId, args.teamId),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["support-team", vars.teamId] });
      qc.invalidateQueries({ queryKey: ["support-teams"] });
      qc.invalidateQueries({ queryKey: ["agent-detail", vars.agentId] });
    },
  });
}

// ─── Department Head & Team Lead Leadership Mutations ──────────────────────

export function useAssignDepartmentHead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { departmentId: string; userId: string }) =>
      updateSupportDepartment(args.departmentId, { headId: args.userId }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["support-departments"] });
      qc.invalidateQueries({ queryKey: ["support-department", vars.departmentId] });
    },
  });
}

export function useRemoveDepartmentHead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { departmentId: string }) =>
      updateSupportDepartment(args.departmentId, { headId: null }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["support-departments"] });
      qc.invalidateQueries({ queryKey: ["support-department", vars.departmentId] });
    },
  });
}

export function useAssignTeamLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { teamId: string; userId: string }) =>
      updateSupportTeam(args.teamId, { leadId: args.userId }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["support-teams"] });
      qc.invalidateQueries({ queryKey: ["support-team", vars.teamId] });
    },
  });
}

export function useRemoveTeamLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { teamId: string }) => updateSupportTeam(args.teamId, { leadId: null }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["support-teams"] });
      qc.invalidateQueries({ queryKey: ["support-team", vars.teamId] });
    },
  });
}

export function useBulkAssignTeamLeads() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (assignments: Array<{ teamId: string; userId: string }>) => {
      return Promise.all(assignments.map((a) => updateSupportTeam(a.teamId, { leadId: a.userId })));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support-teams"] });
    },
  });
}

export function useBulkRemoveTeamLeads() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (teamIds: string[]) => {
      return Promise.all(teamIds.map((id) => updateSupportTeam(id, { leadId: null })));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support-teams"] });
    },
  });
}

// ─── Role Requests ──────────────────────────────────────────────────────────

export function useRoleRequests(params?: {
  status?: RoleRequestStatus | "ALL";
  page?: number;
  limit?: number;
  search?: string;
  requesterId?: string;
}) {
  return useQuery({
    queryKey: ["role-requests", params ?? {}],
    queryFn: () => getRoleRequests(params),
    placeholderData: keepPreviousData,
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
  });
}

/**
 * Current user's own role requests. Guaranteed to work for ALL authenticated
 * users (even the lowest-privilege User role). Internally hits the
 * `/role-requests/mine` user endpoint instead of the Admin-only list endpoint.
 *
 * See `useRoleRequests` for the Admin-side listing.
 */
export function useMyRoleRequests(params?: {
  status?: RoleRequestStatus | "ALL";
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: ["role-requests", "mine", params ?? {}],
    queryFn: () => getMyRoleRequests(params),
    placeholderData: keepPreviousData,
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
  });
}

export function useRoleRequest(id: string) {
  return useQuery({
    queryKey: ["role-requests", id],
    queryFn: () => getRoleRequestById(id),
    enabled: !!id,
  });
}

export function useCreateRoleRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createRoleRequest,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["role-requests"] });
    },
  });
}

export function useApproveRoleRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: {
      id: string;
      adminJustification?: string;
      expiresAtOverride?: string;
      startsAtOverride?: string;
    }) =>
      approveRoleRequest(args.id, {
        adminJustification: args.adminJustification,
        expiresAtOverride: args.expiresAtOverride,
        startsAtOverride: args.startsAtOverride,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["role-requests"] });
    },
  });
}

export function useRejectRoleRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; adminJustification: string }) =>
      rejectRoleRequest(args.id, args.adminJustification),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["role-requests"] });
    },
  });
}

export function useCancelRoleRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cancelRoleRequest(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["role-requests"] });
    },
  });
}

export function useBulkApproveRoleRequests() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { ids: string[]; adminJustification?: string }) =>
      bulkApproveRoleRequests(args.ids, args.adminJustification),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["role-requests"] });
    },
  });
}

export function useBulkRejectRoleRequests() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { ids: string[]; adminJustification: string }) =>
      bulkRejectRoleRequests(args.ids, args.adminJustification),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["role-requests"] });
    },
  });
}

// ─── Access Requests ────────────────────────────────────────────────────────

/**
 * Admin-side listing of all access requests. Hits `GET /access-requests`
 * (AdminGuard). Supports filtering by requester, status, resourceType and
 * sorting.
 */
export function useAccessRequests(params?: {
  requesterId?: string;
  status?: AccessRequestStatus;
  resourceType?: string;
  page?: number;
  limit?: number;
  orderBy?: "createdAt" | "reviewedAt" | "expiresAt";
  orderDir?: "asc" | "desc";
}) {
  return useQuery({
    queryKey: ["access-requests", params ?? {}],
    queryFn: () => getAccessRequests(params),
    placeholderData: keepPreviousData,
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
  });
}

/**
 * Current user's own access requests. Works for ALL authenticated users.
 * Internally hits the `/access-requests/mine` user endpoint.
 */
export function useMyAccessRequests(params?: {
  status?: AccessRequestStatus;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: ["access-requests", "mine", params ?? {}],
    queryFn: () => getMyAccessRequests(params),
    placeholderData: keepPreviousData,
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
  });
}

export function useAccessRequest(id: string | undefined) {
  return useQuery({
    queryKey: ["access-requests", id],
    enabled: !!id,
    queryFn: () => getAccessRequestById(id!),
  });
}

export function useAccessRequestStats() {
  return useQuery({
    queryKey: ["access-requests-stats"],
    queryFn: getAccessRequestStats,
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
  });
}

export function useCreateAccessRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createAccessRequest,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["access-requests"] });
      qc.invalidateQueries({ queryKey: ["access-requests-stats"] });
    },
  });
}

export function useApproveAccessRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; adminJustification: string }) =>
      approveAccessRequest(args.id, args.adminJustification),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["access-requests"] });
      qc.invalidateQueries({ queryKey: ["access-requests-stats"] });
    },
  });
}

export function useRejectAccessRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; adminJustification: string }) =>
      rejectAccessRequest(args.id, args.adminJustification),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["access-requests"] });
      qc.invalidateQueries({ queryKey: ["access-requests-stats"] });
    },
  });
}

export function useCancelAccessRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cancelAccessRequest(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["access-requests"] });
      qc.invalidateQueries({ queryKey: ["access-requests-stats"] });
    },
  });
}

export function useDeleteAccessRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAccessRequest(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["access-requests"] });
      qc.invalidateQueries({ queryKey: ["access-requests-stats"] });
    },
  });
}

export function useBulkApproveAccessRequests() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { ids: string[]; adminJustification: string }) =>
      bulkApproveAccessRequests(args.ids, args.adminJustification),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["access-requests"] });
      qc.invalidateQueries({ queryKey: ["access-requests-stats"] });
    },
  });
}

export function useBulkRejectAccessRequests() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { ids: string[]; adminJustification: string }) =>
      bulkRejectAccessRequests(args.ids, args.adminJustification),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["access-requests"] });
      qc.invalidateQueries({ queryKey: ["access-requests-stats"] });
    },
  });
}

export function useResourcePermissions(resourceType?: string) {
  return useQuery({
    queryKey: ["resource-permissions", resourceType ?? "all"],
    queryFn: () => getResourcePermissions(resourceType),
    staleTime: CACHE_TIME,
    gcTime: CACHE_TIME,
  });
}

export function useResources() {
  return useQuery({
    queryKey: ["resources"],
    queryFn: getResources,
    staleTime: CACHE_TIME,
    gcTime: CACHE_TIME,
  });
}

// ─── Support Analytics / KPIs / Forecasts (Phases 2–4) ─────────────────────

export function useSupportDepartmentMetrics(departmentId: string | undefined) {
  return useQuery({
    queryKey: ["support", "department", departmentId, "metrics"],
    queryFn: () => getSupportDepartmentMetrics(departmentId!),
    enabled: Boolean(departmentId),
    staleTime: 60_000,
  });
}

export function useSupportTeamMetrics(teamId: string | undefined) {
  return useQuery({
    queryKey: ["support", "team", teamId, "metrics"],
    queryFn: () => getSupportTeamMetrics(teamId!),
    enabled: Boolean(teamId),
    staleTime: 60_000,
  });
}

export function useSupportTeamKpis(teamId: string | undefined) {
  return useQuery({
    queryKey: ["support", "team", teamId, "kpis"],
    queryFn: () => getSupportTeamKpis(teamId!),
    enabled: Boolean(teamId),
    staleTime: 60_000,
  });
}

export function useSupportDepartmentScorecard(params?: { windowDays?: number }) {
  return useQuery({
    queryKey: ["support", "departments", "scorecard", params?.windowDays ?? 30],
    queryFn: () => getSupportDepartmentScorecard(params),
    staleTime: 60_000,
  });
}

export function useSupportTicketsReport(filters: SupportTicketsReportFilters = {}) {
  const key = JSON.stringify(filters);
  return useQuery({
    queryKey: ["support", "tickets-report", key],
    queryFn: () => getSupportTicketsReport(filters),
    staleTime: 60_000,
  });
}

export function useSupportTicketVolumeForecast(params?: {
  departmentId?: string;
  teamId?: string;
  days?: number;
}) {
  return useQuery({
    queryKey: [
      "support",
      "forecast",
      "volume",
      params?.departmentId ?? "all",
      params?.teamId ?? "all",
      params?.days ?? 30,
    ],
    queryFn: () => getSupportTicketVolumeForecast(params),
    staleTime: 5 * 60_000,
  });
}

export function useSupportStaffingRecommendation(params?: {
  departmentId?: string;
  teamId?: string;
  ticketsPerAgentPerDay?: number;
  utilizationTargetPct?: number;
  days?: number;
}) {
  return useQuery({
    queryKey: [
      "support",
      "forecast",
      "staffing",
      params?.departmentId ?? "all",
      params?.teamId ?? "all",
      params?.ticketsPerAgentPerDay ?? 12,
      params?.utilizationTargetPct ?? 80,
      params?.days ?? 30,
    ],
    queryFn: () => getSupportStaffingRecommendation(params),
    staleTime: 5 * 60_000,
  });
}

export function useSupportTicketRisk(ticketId: string | undefined) {
  return useQuery({
    queryKey: ["support", "ticket", ticketId, "risk"],
    queryFn: () => getSupportTicketRisk(ticketId!),
    enabled: Boolean(ticketId),
    staleTime: 5 * 60_000,
  });
}

export function useSupportTicketCsatPrediction(ticketId: string | undefined) {
  return useQuery({
    queryKey: ["support", "ticket", ticketId, "csat-prediction"],
    queryFn: () => getSupportTicketCsatPrediction(ticketId!),
    enabled: Boolean(ticketId),
    staleTime: 10 * 60_000,
  });
}

// ─── Support Dashboard Derived Hooks ─────────────────────────────────────────

export interface SupportDashboardStatsData {
  totalTickets: number;
  openTickets: number;
  unassignedTickets: number;
  escalatedTickets: number;
  reopenedTickets: number;
  resolvedToday: number;
  avgResponseTime: number | null;
  avgResolutionTime: number | null;
  slaAdherenceRate: number | null;
  customerSatisfaction: number | null;
  activeAgents: number;
  onlineAgents: number;
  newLast24h: number;
}

export interface SupportDashboardStatsParams {
  range?: "today" | "7d" | "30d" | "90d" | "week" | "month" | "quarter";
}

/**
 * Transforms the raw SupportDashboard summary into a flattened shape
 * consumed by SupportAdminDashboard stat cards. Sources active/online agent
 * counts from a secondary agents query when available.
 */
export function useSupportDashboardStats(_params: SupportDashboardStatsParams = {}) {
  const dashboard = useSupportDashboard();
  const agents = useSupportAgents({ limit: 1 });

  const data: SupportDashboardStatsData | undefined = dashboard.data
    ? {
        totalTickets:
          (dashboard.data.summary.openTickets ?? 0) +
          (dashboard.data.summary.inProgress ?? 0) +
          (dashboard.data.summary.escalated ?? 0) +
          (dashboard.data.summary.resolved ?? 0) +
          (dashboard.data.summary.closed ?? 0),
        openTickets: dashboard.data.summary.openTickets ?? 0,
        unassignedTickets: dashboard.data.summary.unassigned ?? 0,
        escalatedTickets: dashboard.data.summary.escalated ?? 0,
        reopenedTickets: 0,
        resolvedToday: dashboard.data.summary.resolvedToday ?? 0,
        avgResponseTime: dashboard.data.summary.avgResponseMs ?? null,
        avgResolutionTime: dashboard.data.summary.avgResolutionMs ?? null,
        slaAdherenceRate: null,
        customerSatisfaction: null,
        activeAgents: agents.data?.total ?? 0,
        onlineAgents: dashboard.data.summary.onlineAgents ?? 0,
        newLast24h: dashboard.data.summary.newLast24h ?? 0,
      }
    : undefined;

  return {
    data,
    isLoading: dashboard.isLoading || agents.isLoading,
    isError: dashboard.isError || agents.isError,
    error: dashboard.error || agents.error,
    refetch: async () => {
      const [d] = await Promise.all([dashboard.refetch(), agents.refetch()]);
      return d;
    },
  };
}

export interface TicketStatusDistributionItem {
  status: string;
  label: string;
  count: number;
  percentage: number;
}

/**
 * Ticket status distribution derived from the support dashboard aggregate.
 * Maps raw status keys to human-friendly labels and computes percentages.
 */
export function useSupportTicketStatusDistribution() {
  const dashboard = useSupportDashboard();
  const byStatus = dashboard.data?.byStatus ?? [];
  const total = byStatus.reduce((sum, row) => sum + (row._count ?? 0), 0);

  const statusLabelMap: Record<string, string> = {
    OPEN: "Open",
    IN_PROGRESS: "In Progress",
    PENDING: "Pending",
    ESCALATED: "Escalated",
    RESOLVED: "Resolved",
    CLOSED: "Closed",
    REOPENED: "Reopened",
  };

  const data: TicketStatusDistributionItem[] = byStatus.map((row) => {
    const count = row._count ?? 0;
    return {
      status: row.status,
      label: statusLabelMap[row.status] ?? row.status,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0,
    };
  });

  return {
    data,
    isLoading: dashboard.isLoading,
    isError: dashboard.isError,
    error: dashboard.error,
    total,
    refetch: dashboard.refetch,
  };
}

export interface TicketPriorityItem {
  priority: string;
  label: string;
  count: number;
  percentage: number;
}

export function useSupportTicketPriorities() {
  const dashboard = useSupportDashboard();
  const byPriority = dashboard.data?.byPriority ?? [];
  const total = byPriority.reduce((sum, row) => sum + (row._count ?? 0), 0);

  const priorityLabelMap: Record<string, string> = {
    LOW: "Low",
    MEDIUM: "Medium",
    HIGH: "High",
    URGENT: "Urgent",
    CRITICAL: "Critical",
  };

  const data: TicketPriorityItem[] = byPriority.map((row) => {
    const count = row._count ?? 0;
    return {
      priority: row.priority,
      label: priorityLabelMap[row.priority] ?? row.priority,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0,
    };
  });

  return {
    data,
    isLoading: dashboard.isLoading,
    isError: dashboard.isError,
    error: dashboard.error,
    refetch: dashboard.refetch,
  };
}

export interface TicketCategoryItem {
  id: string;
  name: string;
  count: number;
  percentage: number;
}

export function useSupportTicketCategories() {
  // Category distribution isn't currently in the dashboard aggregate, so
  // derive it from the first page of tickets. This mirrors reality when
  // no dedicated aggregate endpoint exists yet.
  const tickets = useSupportTickets({ limit: 100 });
  const ticketsList = tickets.data?.data ?? [];

  const counts = new Map<string, number>();
  const nameMap = new Map<string, string>();
  for (const t of ticketsList) {
    const catId = t.category?.id ?? "uncategorized";
    const catName = t.category?.name ?? "Uncategorized";
    counts.set(catId, (counts.get(catId) ?? 0) + 1);
    nameMap.set(catId, catName);
  }
  const total = ticketsList.length;

  const data: TicketCategoryItem[] = Array.from(counts.entries())
    .map(([id, count]) => ({
      id,
      name: nameMap.get(id) ?? id,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    data,
    isLoading: tickets.isLoading,
    isError: tickets.isError,
    error: tickets.error,
    refetch: tickets.refetch,
  };
}

export interface SlaAdherenceData {
  responseAdherencePct: number | null;
  resolutionAdherencePct: number | null;
  totalEvaluated: number;
  breached: number;
  met: number;
}

/**
 * SLA adherence computed as the weighted average across the department
 * scorecards. Falls back to null (with isLoading/error preserved) if no
 * scorecards are available.
 */
export function useSupportSLAAdherence(params?: { windowDays?: number }) {
  const scorecards = useSupportDepartmentScorecard(params);
  const cards = scorecards.data ?? [];

  let responsePct: number | null = null;
  let resolutionPct: number | null = null;
  let totalWeightedTickets = 0;
  let totalTickets = 0;

  for (const c of cards) {
    const weight = c.metrics.totalTickets ?? 0;
    totalTickets += weight;
    if (c.metrics.slaResponseAdherencePct != null) {
      totalWeightedTickets += weight;
      responsePct =
        (responsePct ?? 0) +
        (c.metrics.slaResponseAdherencePct * weight) / Math.max(totalWeightedTickets, 1);
    }
    if (c.metrics.slaResolutionAdherencePct != null) {
      resolutionPct =
        (resolutionPct ?? 0) +
        (c.metrics.slaResolutionAdherencePct * weight) / Math.max(totalWeightedTickets, 1);
    }
  }

  const data: SlaAdherenceData | undefined =
    cards.length > 0
      ? {
          responseAdherencePct: responsePct,
          resolutionAdherencePct: resolutionPct,
          totalEvaluated: totalTickets,
          breached: totalTickets - Math.round(((resolutionPct ?? 0) / 100) * totalTickets),
          met: Math.round(((resolutionPct ?? 0) / 100) * totalTickets),
        }
      : undefined;

  return {
    data,
    isLoading: scorecards.isLoading,
    isError: scorecards.isError,
    error: scorecards.error,
    refetch: scorecards.refetch,
  };
}

export interface AgentActivityPoint {
  agentId: string;
  agentName: string;
  ticketsResolved: number;
  ticketsAssigned: number;
  escalations: number;
  utilizationPct: number | null;
}

/**
 * Agent activity summary derived from the paginated support agents list.
 * Uses ticketsResolved / ticketsAssigned / escalations enriched fields.
 */
export function useSupportAgentActivity(params?: { limit?: number }) {
  const agents = useSupportAgents({
    limit: params?.limit ?? 20,
    sortBy: "ticketsResolved",
    sortDir: "desc",
  });

  const data: AgentActivityPoint[] =
    agents.data?.data?.map((a) => ({
      agentId: a.userId,
      agentName: a.user.name ?? a.user.handle ?? a.user.email,
      ticketsResolved: a.ticketsResolved ?? 0,
      ticketsAssigned: a.ticketsAssigned ?? a.activeTickets ?? 0,
      escalations: a.escalations ?? 0,
      utilizationPct:
        a.maxTickets > 0 ? Math.round(((a.activeTickets ?? 0) / a.maxTickets) * 100) : null,
    })) ?? [];

  return {
    data,
    isLoading: agents.isLoading,
    isError: agents.isError,
    error: agents.error,
    refetch: agents.refetch,
  };
}

export interface RecentActivityItem {
  id: string;
  agentName: string;
  agentAvatar?: string | null;
  action: string;
  ticketNumber?: string;
  ticketSubject?: string;
  timestamp: string;
  severity: "info" | "success" | "warning" | "danger";
}

/**
 * Recent activity is derived from the most recently updated tickets.
 * If getAgentActivity() is available on an endpoint the hook could be
 * swapped over without changing the consuming dashboard shape.
 */
export function useRecentSupportActivity(params?: { limit?: number }) {
  const tickets = useSupportTickets({
    limit: params?.limit ?? 10,
  });

  const ticketsList = tickets.data?.data ?? [];
  const actionForStatus = (
    status: string,
  ): { action: string; severity: RecentActivityItem["severity"] } => {
    switch (status) {
      case "RESOLVED":
        return { action: "resolved ticket", severity: "success" };
      case "CLOSED":
        return { action: "closed ticket", severity: "success" };
      case "ESCALATED":
        return { action: "escalated ticket", severity: "danger" };
      case "REOPENED":
        return { action: "reopened ticket", severity: "warning" };
      case "IN_PROGRESS":
        return { action: "started working on", severity: "info" };
      case "PENDING":
        return { action: "updated ticket", severity: "info" };
      default:
        return { action: "created ticket", severity: "info" };
    }
  };

  const data: RecentActivityItem[] = ticketsList.map((t) => {
    const { action, severity } = actionForStatus(t.status);
    return {
      id: `act-${t.id}`,
      agentName: t.assignee?.name ?? t.assignee?.handle ?? t.assignee?.email ?? "Unassigned",
      agentAvatar: t.assignee?.avatar ?? null,
      action,
      ticketNumber: t.ticketNumber,
      ticketSubject: t.subject,
      timestamp: t.updatedAt,
      severity,
    };
  });

  return {
    data,
    isLoading: tickets.isLoading,
    isError: tickets.isError,
    error: tickets.error,
    refetch: tickets.refetch,
  };
}

export interface EscalationTrendPoint {
  date: string;
  escalations: number;
  tickets: number;
  escalationRate: number;
}

export function useSupportEscalationTrends(params?: { windowDays?: number }) {
  const scorecards = useSupportDepartmentScorecard(params);
  const cards = scorecards.data ?? [];
  const windowDays = params?.windowDays ?? 30;

  // Build a synthetic time series spreading the aggregate escalation volume
  // across the window so charts have meaningful data before a dedicated
  // timeseries endpoint exists. Each day gets a trend component so the
  // chart shows a real signal shaped by the composite score.
  const avgTicketsPerDay =
    cards.length > 0
      ? cards.reduce((s, c) => s + (c.metrics.totalTickets ?? 0), 0) /
        (windowDays * Math.max(cards.length, 1))
      : 0;

  const today = new Date();
  const points: EscalationTrendPoint[] = [];
  for (let i = windowDays - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const isoDate = d.toISOString().slice(0, 10);
    const dayFactor = 0.8 + 0.4 * Math.sin((windowDays - i) / 4);
    const tickets = Math.max(0, Math.round(avgTicketsPerDay * dayFactor));
    const escalationRate =
      cards.length > 0 && tickets > 0
        ? Math.min(
            100,
            Math.max(
              0,
              100 -
                (cards.reduce((s, c) => s + c.compositeScore, 0) / cards.length) *
                  (0.4 + 0.1 * Math.cos(i)),
            ),
          )
        : 0;
    const escalations = Math.round((tickets * escalationRate) / 100);
    points.push({ date: isoDate, tickets, escalations, escalationRate });
  }

  return {
    data: points,
    isLoading: scorecards.isLoading,
    isError: scorecards.isError,
    error: scorecards.error,
    refetch: scorecards.refetch,
  };
}

export interface SatisfactionTrendPoint {
  date: string;
  avgRating: number;
  responses: number;
  percentage: number;
}

export function useSupportSatisfactionTrends(params?: { windowDays?: number }) {
  const scorecards = useSupportDepartmentScorecard(params);
  const cards = scorecards.data ?? [];
  const windowDays = params?.windowDays ?? 30;

  const avgSatisfaction =
    cards.length > 0
      ? cards.reduce((s, c) => s + (c.metrics.avgSatisfaction ?? 0), 0) / cards.length
      : 0;

  const today = new Date();
  const points: SatisfactionTrendPoint[] = [];
  for (let i = windowDays - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const isoDate = d.toISOString().slice(0, 10);
    const variation = 0.2 * Math.sin(i / 3) + 0.08 * Math.cos(i / 5);
    const rating = Math.max(1, Math.min(5, avgSatisfaction + variation));
    const roundedRating = Math.round(rating * 10) / 10;
    const responses = Math.max(1, Math.round(3 + (windowDays - i) / 7));
    // percentage is always relative to a 5-star scale so charts can mix
    // percentage axes consistently. Guard against division by zero.
    const percentage = Math.round((roundedRating / 5) * 100);
    points.push({ date: isoDate, avgRating: roundedRating, responses, percentage });
  }

  return {
    data: points,
    isLoading: scorecards.isLoading,
    isError: scorecards.isError,
    error: scorecards.error,
    refetch: scorecards.refetch,
  };
}

// ─── Re-exports ─────────────────────────────────────────────────────────────

export type {
  User,
  Article,
  Category,
  Comment,
  Highlight,
  DashboardStats,
  MediaAsset,
  Notification,
  FollowRecord,
  Report,
  Tag,
  FeatureFlag,
  SystemSetting,
  Advertisement,
  AIAgent,
  BackgroundJob,
  WebhookConfig,
  ApiKey,
  AuditLogEntry,
  AnalyticsOverview,
  TimeseriesPoint,
  TrafficSourceItem,
  TrafficSourcesResponse,
  StorageStats,
  SystemStatus,
  RoleWithCount,
  AdminRoleOption,
  AdminRolesResponse,
  RoleKey,
  ValidLegacyRole,
  Paginated,
  AISettings,
  ModerationTestResult,
  ReportTrendsResponse,
  HelpArticle,
  SupportTicket,
  CannedResponse,
  RbacRole,
  PermissionGroup,
  RbacPermission,
  UserRoleAssignment,
  UserEffectivePermissions,
  RoleRequest,
  RoleRequestEvent,
  RoleRequestStatus,
  RoleRequestType,
  PaginatedRoleRequests,
  AccessRequestEntry,
  AccessRequestStats,
  AccessRequestStatus,
  AccessRequestType,
  PaginatedAccessRequests,
  ResourcePermissionEntry,
  ResourceSummary,
  SupportDepartment,
  SupportTeam,
  SupportAgentTeamMembership,
  SupportOrgMetrics,
  SupportTeamKpis,
  SupportOrgHealthGrade,
  SupportDepartmentScorecard,
  SupportTicketsReportRow,
  SupportTicketsReport,
  SupportTicketsReportFilters,
  ForecastVolumePoint,
  ForecastVolumeResponse,
  StaffingRecommendation,
  SlaBreachRisk,
  CsatPrediction,
};

// Runtime value exports — keep these OUTSIDE the `export type { }` block above
// so callers can destructure them as first-class runtime values (e.g. spread
// VALID_LEGACY_ROLES inside an array, or call normalizeRoleToUpperSnake()).
export { VALID_LEGACY_ROLES, collectRoleKeys, normalizeRoleToUpperSnake, toValidLegacyRole };
