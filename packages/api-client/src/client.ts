import type {
  ApiError,
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  RefreshTokenResponse,
  User,
  Article,
  Highlight,
  Comment,
  Category,
  Notification,
  Story,
  Media,
  PaginatedResponse,
  ToggleResponse,
  SearchResults,
  DashboardStats,
  AuditLog,
  ApiKey,
  UserSettings,
} from './types/index';

// Storage interface for cross-platform compatibility
export interface Storage {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

// Token storage keys
const TOKEN_KEY = 'vellum_access_token';
const REFRESH_TOKEN_KEY = 'vellum_refresh_token';
const USER_KEY = 'vellum_user';

// API Client Configuration
export interface ApiClientConfig {
  baseUrl: string;
  storage: Storage;
  onAuthError?: () => void;
  onRefreshToken?: (tokens: { accessToken: string; refreshToken: string }) => void;
  withCredentials?: boolean;
}

export class ApiClient {
  private baseUrl: string;
  private storage: Storage;
  private onAuthError?: () => void;
  private onRefreshToken?: (tokens: { accessToken: string; refreshToken: string }) => void;
  private withCredentials: boolean;
  private refreshPromise?: Promise<string>;

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl;
    this.storage = config.storage;
    this.onAuthError = config.onAuthError;
    this.onRefreshToken = config.onRefreshToken;
    this.withCredentials = config.withCredentials ?? false;
  }

  // Token management
  async getAccessToken(): Promise<string | null> {
    return this.storage.getItem(TOKEN_KEY);
  }

  async getRefreshToken(): Promise<string | null> {
    return this.storage.getItem(REFRESH_TOKEN_KEY);
  }

  async setTokens(accessToken: string, refreshToken: string): Promise<void> {
    await this.storage.setItem(TOKEN_KEY, accessToken);
    await this.storage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }

  async clearTokens(): Promise<void> {
    await this.storage.removeItem(TOKEN_KEY);
    await this.storage.removeItem(REFRESH_TOKEN_KEY);
    await this.storage.removeItem(USER_KEY);
  }

  async getCurrentUser(): Promise<User | null> {
    const userStr = await this.storage.getItem(USER_KEY);
    return userStr ? JSON.parse(userStr) : null;
  }

  async setCurrentUser(user: User): Promise<void> {
    await this.storage.setItem(USER_KEY, JSON.stringify(user));
  }

  // Refresh token logic
  private async refreshAccessToken(): Promise<string> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.doRefresh();
    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = undefined;
    }
  }

  private async doRefresh(): Promise<string> {
    const refreshToken = await this.getRefreshToken();
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await this.request<RefreshTokenResponse>('/api/auth/refresh', {
      method: 'POST',
      body: { refreshToken },
      skipAuth: true,
    });

    await this.setTokens(response.accessToken, response.refreshToken);
    this.onRefreshToken?.({
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
    });

    return response.accessToken;
  }

  // Core request method
  private async request<T>(
    path: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
      body?: Record<string, unknown>;
      query?: Record<string, string | number | boolean>;
      skipAuth?: boolean;
      retries?: number;
    } = {}
  ): Promise<T> {
    const { method = 'GET', body, query, skipAuth = false, retries = 0 } = options;

    let url = `${this.baseUrl}${path}`;
    if (query) {
      const params = new URLSearchParams();
      Object.entries(query).forEach(([key, value]) => {
        params.append(key, String(value));
      });
      url += `?${params.toString()}`;
    }

    const headers: Record<string, string> = {};

    if (body && method !== 'GET') {
      headers['Content-Type'] = 'application/json';
    }

    if (!skipAuth) {
      const token = await this.getAccessToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    const fetchOptions: RequestInit = {
      method,
      headers,
      credentials: this.withCredentials ? 'include' : 'same-origin',
    };

    if (body && method !== 'GET') {
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(url, fetchOptions);

    // Handle 401 - try refresh token
    if (response.status === 401 && !skipAuth && retries < 1) {
      try {
        const newToken = await this.refreshAccessToken();
        headers['Authorization'] = `Bearer ${newToken}`;
        const retryResponse = await fetch(url, { ...fetchOptions, headers, credentials: this.withCredentials ? 'include' : 'same-origin' });
        return this.handleResponse<T>(retryResponse);
      } catch {
        await this.clearTokens();
        this.onAuthError?.();
        throw new Error('Authentication failed');
      }
    }

    return this.handleResponse<T>(response);
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const error = await response.json() as ApiError;
      throw new ApiClientError(error.message, error.statusCode, error);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return response.json() as Promise<T>;
  }

  // Auth endpoints
  async login(data: LoginRequest): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: data as unknown as Record<string, unknown>,
      skipAuth: true,
    });
    await this.setTokens(response.accessToken, response.refreshToken);
    await this.setCurrentUser(response.user);
    return response;
  }

  async register(data: RegisterRequest): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: data as unknown as Record<string, unknown>,
      skipAuth: true,
    });
    await this.setTokens(response.accessToken, response.refreshToken);
    await this.setCurrentUser(response.user);
    return response;
  }

  async logout(): Promise<void> {
    try {
      await this.request('/api/auth/logout', { method: 'POST' });
    } finally {
      await this.clearTokens();
    }
  }

  async getMe(): Promise<User> {
    return this.request<User>('/api/auth/me');
  }

  // Users endpoints
  async getUser(handle: string): Promise<User> {
    return this.request<User>(`/api/users/${handle}`);
  }

  async updateUser(data: Partial<User>): Promise<User> {
    return this.request<User>('/api/users/me', {
      method: 'PUT',
      body: data,
    });
  }

  async getUserSettings(): Promise<UserSettings> {
    return this.request<UserSettings>('/api/users/me/settings');
  }

  async updateUserSettings(data: Partial<UserSettings>): Promise<UserSettings> {
    return this.request<UserSettings>('/api/users/me/settings', {
      method: 'PUT',
      body: data,
    });
  }

  async searchUsers(query: string, page = 1, limit = 20): Promise<PaginatedResponse<User>> {
    return this.request<PaginatedResponse<User>>('/api/users/search', {
      query: { query, page, limit },
    });
  }

  // Articles endpoints
  async getArticles(page = 1, limit = 10): Promise<PaginatedResponse<Article>> {
    return this.request<PaginatedResponse<Article>>('/api/articles', {
      query: { page, limit },
    });
  }

  async getFeaturedArticles(): Promise<Article[]> {
    return this.request<Article[]>('/api/articles/featured');
  }

  async getArticle(slug: string): Promise<Article> {
    return this.request<Article>(`/api/articles/${slug}`);
  }

  async getArticlesByAuthor(handle: string, page = 1, limit = 10): Promise<PaginatedResponse<Article>> {
    return this.request<PaginatedResponse<Article>>(`/api/articles/author/${handle}`, {
      query: { page, limit },
    });
  }

  async createArticle(data: {
    title: string;
    excerpt: string;
    body: string[];
    cover?: string;
    categoryId: string;
    featured?: boolean;
  }): Promise<Article> {
    return this.request<Article>('/api/articles', {
      method: 'POST',
      body: data,
    });
  }

  async updateArticle(slug: string, data: Partial<Article>): Promise<Article> {
    return this.request<Article>(`/api/articles/${slug}`, {
      method: 'PUT',
      body: data,
    });
  }

  async deleteArticle(slug: string): Promise<void> {
    return this.request(`/api/articles/${slug}`, { method: 'DELETE' });
  }

  // Highlights endpoints
  async getHighlights(page = 1, limit = 10): Promise<PaginatedResponse<Highlight>> {
    return this.request<PaginatedResponse<Highlight>>('/api/highlights', {
      query: { page, limit },
    });
  }

  async getHighlight(id: string): Promise<Highlight> {
    return this.request<Highlight>(`/api/highlights/${id}`);
  }

  async createHighlight(data: {
    title: string;
    cover?: string;
    videoUrl?: string;
    description?: string;
    music?: string;
  }): Promise<Highlight> {
    return this.request<Highlight>('/api/highlights', {
      method: 'POST',
      body: data,
    });
  }

  async updateHighlight(id: string, data: Partial<Highlight>): Promise<Highlight> {
    return this.request<Highlight>(`/api/highlights/${id}`, {
      method: 'PUT',
      body: data,
    });
  }

  async deleteHighlight(id: string): Promise<void> {
    return this.request(`/api/highlights/${id}`, { method: 'DELETE' });
  }

  // Categories endpoints
  async getCategories(): Promise<Category[]> {
    return this.request<Category[]>('/api/categories');
  }

  async getCategory(slug: string): Promise<Category & { articles: Article[] }> {
    return this.request<Category & { articles: Article[] }>(`/api/categories/${slug}`);
  }

  // Comments endpoints
  async getComments(articleSlug?: string, highlightId?: string, page = 1, limit = 20): Promise<PaginatedResponse<Comment>> {
    const query: Record<string, string | number | boolean> = { page, limit };
    if (articleSlug) query.articleSlug = articleSlug;
    if (highlightId) query.highlightId = highlightId;
    return this.request<PaginatedResponse<Comment>>('/api/comments', { query });
  }

  async createComment(data: {
    body: string;
    articleSlug?: string;
    highlightId?: string;
    parentId?: string;
  }): Promise<Comment> {
    return this.request<Comment>('/api/comments', {
      method: 'POST',
      body: data,
    });
  }

  async updateComment(id: string, body: string): Promise<Comment> {
    return this.request<Comment>(`/api/comments/${id}`, {
      method: 'PUT',
      body: { body },
    });
  }

  async deleteComment(id: string): Promise<void> {
    return this.request(`/api/comments/${id}`, { method: 'DELETE' });
  }

  // Likes endpoints
  async toggleLike(data: {
    articleSlug?: string;
    highlightId?: string;
    commentId?: string;
  }): Promise<ToggleResponse> {
    return this.request<ToggleResponse>('/api/likes/toggle', {
      method: 'POST',
      body: data,
    });
  }

  async getLikedArticles(page = 1, limit = 20): Promise<PaginatedResponse<Article>> {
    return this.request<PaginatedResponse<Article>>('/api/likes/articles', {
      query: { page, limit },
    });
  }

  async getLikedHighlights(page = 1, limit = 20): Promise<PaginatedResponse<Highlight>> {
    return this.request<PaginatedResponse<Highlight>>('/api/likes/highlights', {
      query: { page, limit },
    });
  }

  // Bookmarks endpoints
  async toggleBookmark(data: {
    articleSlug?: string;
    highlightId?: string;
  }): Promise<ToggleResponse> {
    return this.request<ToggleResponse>('/api/bookmarks/toggle', {
      method: 'POST',
      body: data,
    });
  }

  async getBookmarkedArticles(page = 1, limit = 20): Promise<PaginatedResponse<Article>> {
    return this.request<PaginatedResponse<Article>>('/api/bookmarks/articles', {
      query: { page, limit },
    });
  }

  async getBookmarkedHighlights(page = 1, limit = 20): Promise<PaginatedResponse<Highlight>> {
    return this.request<PaginatedResponse<Highlight>>('/api/bookmarks/highlights', {
      query: { page, limit },
    });
  }

  // Follows endpoints
  async toggleFollow(userId: string): Promise<ToggleResponse> {
    return this.request<ToggleResponse>(`/api/follows/${userId}`, {
      method: 'POST',
    });
  }

  async getFollowers(userId: string, page = 1, limit = 20): Promise<PaginatedResponse<User>> {
    return this.request<PaginatedResponse<User>>(`/api/follows/${userId}/followers`, {
      query: { page, limit },
    });
  }

  async getFollowing(userId: string, page = 1, limit = 20): Promise<PaginatedResponse<User>> {
    return this.request<PaginatedResponse<User>>(`/api/follows/${userId}/following`, {
      query: { page, limit },
    });
  }

  async isFollowing(userId: string): Promise<{ following: boolean }> {
    return this.request<{ following: boolean }>(`/api/follows/${userId}/is-following`);
  }

  // Notifications endpoints
  async getNotifications(page = 1, limit = 20): Promise<PaginatedResponse<Notification>> {
    return this.request<PaginatedResponse<Notification>>('/api/notifications', {
      query: { page, limit },
    });
  }

  async getUnreadCount(): Promise<{ count: number }> {
    return this.request<{ count: number }>('/api/notifications/unread-count');
  }

  async markNotificationsRead(): Promise<void> {
    return this.request('/api/notifications/read', { method: 'PUT' });
  }

  async deleteNotification(id: string): Promise<void> {
    return this.request(`/api/notifications/${id}`, { method: 'DELETE' });
  }

  // Stories endpoints
  async getStories(): Promise<Story[]> {
    return this.request<Story[]>('/api/stories');
  }

  async getStoriesByAuthor(authorId: string): Promise<Story[]> {
    return this.request<Story[]>(`/api/stories/user/${authorId}`);
  }

  async createStory(data: { image: string; caption?: string; duration?: number }): Promise<Story> {
    return this.request<Story>('/api/stories', {
      method: 'POST',
      body: data,
    });
  }

  async getStoryViews(storyId: string): Promise<{ views: number; viewers: User[] }> {
    return this.request<{ views: number; viewers: User[] }>(`/api/stories/${storyId}/views`);
  }

  async deleteStory(storyId: string): Promise<void> {
    return this.request(`/api/stories/${storyId}`, { method: 'DELETE' });
  }

  // Search endpoint
  async search(query: string, page = 1, limit = 20): Promise<SearchResults> {
    return this.request<SearchResults>('/api/search', {
      query: { query, page, limit },
    });
  }

  // Media endpoints
  async uploadMedia(file: File | Blob, onProgress?: (progress: number) => void): Promise<Media> {
    const formData = new FormData();
    formData.append('file', file);

    const token = await this.getAccessToken();

    // Use fetch with progress tracking via XMLHttpRequest in browser environments
    if (typeof XMLHttpRequest !== 'undefined') {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (e: ProgressEvent) => {
          if (e.lengthComputable && onProgress) {
            onProgress(Math.round((e.loaded / e.total) * 100));
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText) as Media);
          } else {
            reject(new ApiClientError('Upload failed', xhr.status));
          }
        });

        xhr.addEventListener('error', () => {
          reject(new ApiClientError('Upload failed', xhr.status));
        });

        xhr.open('POST', `${this.baseUrl}/api/media/upload`);
        if (token) {
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        }
        xhr.send(formData);
      });
    }

    // Fallback for non-browser environments (React Native)
    const headers: Record<string, string> = {
      'Content-Type': 'multipart/form-data',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}/api/media/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });

    return this.handleResponse<Media>(response);
  }

  async getUserMedia(userId: string, page = 1, limit = 20): Promise<PaginatedResponse<Media>> {
    return this.request<PaginatedResponse<Media>>(`/api/media/user/${userId}`, {
      query: { page, limit },
    });
  }

  async deleteMedia(id: string): Promise<void> {
    return this.request(`/api/media/${id}`, { method: 'DELETE' });
  }

  // Admin endpoints
  async getDashboardStats(): Promise<DashboardStats> {
    return this.request<DashboardStats>('/api/admin/dashboard');
  }

  async getAdminUsers(page = 1, limit = 20): Promise<PaginatedResponse<User>> {
    return this.request<PaginatedResponse<User>>('/api/admin/users', {
      query: { page, limit },
    });
  }

  async updateUserRole(userId: string, role: User['role']): Promise<User> {
    return this.request<User>(`/api/admin/users/${userId}/role`, {
      method: 'PUT',
      body: { role },
    });
  }

  async updateUserStatus(userId: string, isActive: boolean): Promise<User> {
    return this.request<User>(`/api/admin/users/${userId}/status`, {
      method: 'PUT',
      body: { isActive },
    });
  }

  async getAuditLogs(page = 1, limit = 20): Promise<PaginatedResponse<AuditLog>> {
    return this.request<PaginatedResponse<AuditLog>>('/api/admin/audit-logs', {
      query: { page, limit },
    });
  }

  // Webhooks endpoints
  async createApiKey(data: { name: string; scopes: string[] }): Promise<ApiKey> {
    return this.request<ApiKey>('/api/webhooks/api-keys', {
      method: 'POST',
      body: data,
    });
  }

  async getApiKeys(): Promise<ApiKey[]> {
    return this.request<ApiKey[]>('/api/webhooks/api-keys');
  }

  async deleteApiKey(id: string): Promise<void> {
    return this.request(`/api/webhooks/api-keys/${id}`, { method: 'DELETE' });
  }

  // Health check
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return this.request<{ status: string; timestamp: string }>('/api/health');
  }
}

// Custom error class
export class ApiClientError extends Error {
  statusCode: number;
  data?: ApiError;

  constructor(message: string, statusCode: number, data?: ApiError) {
    super(message);
    this.name = 'ApiClientError';
    this.statusCode = statusCode;
    this.data = data;
  }
}

// Create singleton instance function
export function createApiClient(config: ApiClientConfig): ApiClient {
  return new ApiClient(config);
}