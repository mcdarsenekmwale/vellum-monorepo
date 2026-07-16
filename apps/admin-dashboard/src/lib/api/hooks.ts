import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import type { Paginated } from "./client";
import {
  getDashboardStats,
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  getArticles,
  getArticleById,
  createArticle,
  updateArticle,
  deleteArticle,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getComments,
  deleteComment,
  getCurrentUser,
  getHighlights,
  getHighlightById,
  createHighlight,
  updateHighlight,
  deleteHighlight,
  updateUserRole,
  toggleUserStatus,
  getMedia,
  deleteMedia,
  getAdminNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  createNotification,
  getUnreadNotificationCount,
  getFollows,
  getReports,
  updateReportStatus,
  deleteReport,
  getReportStats,
  bulkUpdateReportStatus,
  getTags,
  createTag,
  deleteTag,
  updateTag,
  getFeatureFlags,
  createFeatureFlag,
  updateFeatureFlag,
  deleteFeatureFlag,
  getSystemSettings,
  updateSystemSetting,
  getAnalyticsOverview,
  getAnalyticsTimeseries,
  getTrafficSources,
  getStorageStats,
  getSystemStatus,
  getJobs,
  getAdvertisements,
  createAdvertisement,
  updateAdvertisement,
  deleteAdvertisement,
  getAIAgents,
  createAIAgent,
  updateAIAgent,
  deleteAIAgent,
  getWebhooks,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  getApiKeys,
  createApiKey,
  deleteApiKey,
  getAuditLogs,
  getAuditLogById,
  getRoles,
  getAISettings,
  updateAISettings,
  testAIModeration,
  getReportTrends,
  getHelpArticles,
  getHelpArticleBySlug,
  getHelpArticleById,
  createHelpArticle,
  updateHelpArticle,
  deleteHelpArticle,
  createSupportTicket,
  getSupportTickets,
  getSupportTicket,
  updateSupportTicketStatus,
  type User,
  type Article,
  type Category,
  type Comment,
  type Highlight,
  type DashboardStats,
  type MediaAsset,
  type Notification,
  type FollowRecord,
  type Report,
  type Tag,
  type FeatureFlag,
  type SystemSetting,
  type Advertisement,
  type AIAgent,
  type BackgroundJob,
  type WebhookConfig,
  type ApiKey,
  type AuditLogEntry,
  type AnalyticsOverview,
  type TimeseriesPoint,
  type TrafficSourceItem,
  type TrafficSourcesResponse,
  type StorageStats,
  type SystemStatus,
  type RoleWithCount,
  type AISettings,
  type ModerationTestResult,
  type ReportTrendsResponse,
  type HelpArticle,
  type SupportTicket,
  uploadAvatar,
  removeAvatar,
  getUserSettings,
  updateUserSettings,
  type UserSettings,
  deleteWorkspace,
  resetSettings,
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
    mutationFn: (data: { email: string; name: string; handle: string; role: string; password: string }) => createUser(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<User>) => updateUser(id, data),
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
    mutationFn: (data: { title: string; slug: string; excerpt: string; body: string[]; categoryId: string; authorId: string; isPublished?: boolean; featured?: boolean; cover?: string | null; readMinutes?: number }) => createArticle(data),
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
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, slug, tint }: { name: string; slug: string; tint: string }) => createCategory(name, slug, tint),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; slug?: string; tint?: string }) => updateCategory(id, data),
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
    mutationFn: (data: { title: string; handle: string; description?: string | null; cover?: string | null; videoUrl?: string | null; thumbnailUrl?: string | null; authorId?: string | null; isPublished?: boolean; aspectRatio?: number | null; duration?: number | null }) => createHighlight(data),
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

export function useUpdateReportStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, note }: { id: string; status: string; note?: string }) => updateReportStatus(id, status, note),
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
    mutationFn: ({ ids, status, note }: { ids: string[]; status: string; note?: string }) => bulkUpdateReportStatus(ids, status, note),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reports"] }),
  });
}

// ─── Tags ───────────────────────────────────────────────────────────────────

export function useTags() {
  return useQuery({
    queryKey: ["tags"],
    queryFn: getTags,
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
    mutationFn: ({ id, name, slug }: { id: string; name: string; slug: string }) => updateTag(id, name, slug),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tags"] }),
  });
}



// ─── Feature Flags ──────────────────────────────────────────────────────────

export function useFeatureFlags() {
  return useQuery({
    queryKey: ["feature-flags"],
    queryFn: getFeatureFlags,
  });
}

export function useCreateFeatureFlag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { key: string; description: string; enabled: boolean; rollout: number }) => createFeatureFlag(data),
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
  });
}

export function useUpdateSystemSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) => updateSystemSetting(key, value),
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
    mutationFn: (data: { name: string; status: string; startsAt?: string | null; endsAt?: string | null }) => createAdvertisement(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["advertisements"] }),
  });
}

export function useUpdateAdvertisement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<Advertisement>) => updateAdvertisement(id, data),
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
  });
}

export function useCreateAIAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; description?: string | null; model: string; status: string; config?: any }) => createAIAgent(data),
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
  });
}

export function useCreateWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; url: string; events: string[]; isActive?: boolean }) => createWebhook(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["webhooks"] }),
  });
}

export function useUpdateWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<WebhookConfig>) => updateWebhook(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["webhooks"] }),
  });
}

export function useDeleteWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteWebhook(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["webhooks"] }),
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
    mutationFn: (data: { name: string; scopes: string[]; userId?: string | null; expiresAt?: string | null }) => createApiKey(data),
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
    mutationFn: ({ content, thresholds }: { content: string; thresholds?: { high: number; medium: number } }) =>
      testAIModeration(content, thresholds),
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
  Paginated,
  AISettings,
  ModerationTestResult,
  ReportTrendsResponse,
  HelpArticle,
  SupportTicket,
};
