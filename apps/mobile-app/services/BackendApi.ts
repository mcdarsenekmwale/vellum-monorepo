import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { apiBaseUrl } from '../config/env';

const isWeb = Platform.OS === 'web';

export class ApiError extends Error {
  statusCode: number;
  data?: unknown;

  constructor(message: string, statusCode: number, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.data = data;
  }
}

export interface NotificationPreferences {
  pushLikes: boolean;
  pushComments: boolean;
  pushReplies: boolean;
  pushFollows: boolean;
  pushMentions: boolean;
  pushNewArticles: boolean;
  pushSystem: boolean;
  emailDigest: boolean;
  emailMarketing: boolean;
}

export interface Subscription {
  id: string;
  planName: string;
  status: 'active' | 'canceled' | 'past_due' | 'trialing';
  renewalDate?: string;
  cancelAtPeriodEnd: boolean;
}

export interface FaqCategory {
  key: string;
  name: string;
  count: number;
}

export interface Faq {
  id: string;
  question: string;
  answer: string;
  category: string;
}

export interface SupportTicketListItem {
  id: string;
  ticketNumber?: string;
  subject: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface SupportTicketDetail {

  id: string;
  ticketNumber?: string;
  subject: string;
  message: string;
  description?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  messages: SupportTicketMessage[];
}

export interface SupportTicketMessage {
  isFromCustomer: boolean;
  isFromAgent?: boolean;
  id: string;
  body: string;
  authorName: string;
  createdAt: string;
}

export interface CreateTicketPayload {
  category?: string;
  subject: string;
  body: string;
}

class BackendApiService {
  private async getToken(): Promise<string | null> {
    try {
      if (isWeb) {
        if (typeof window === 'undefined') return null;
        // api-client (lib/api.ts) uses 'vellbase_access_token' for storage; also
        // support the legacy ':' key used by BackendApi for reads.
        return (
          window.localStorage.getItem('vellbase_access_token') ||
          window.localStorage.getItem('vellbase:access_token')
        );
      }
      const token = await SecureStore.getItemAsync('vellbase_access_token');
      if (token) return token;
      return await SecureStore.getItemAsync('vellbase:access_token');
    } catch {
      return null;
    }
  }

  private async request<T>(
    path: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
      body?: unknown;
      query?: Record<string, string | number | boolean>;
    } = {}
  ): Promise<T> {
    const { method = 'GET', body, query } = options;

    let url = `${apiBaseUrl}${path}`;
    if (query) {
      const params = new URLSearchParams();
      Object.entries(query).forEach(([k, v]) => {
        params.append(k, String(v));
      });
      url += `?${params.toString()}`;
    }

    const headers: Record<string, string> = {};
    if (body && method !== 'GET') {
      headers['Content-Type'] = 'application/json';
    }

    const token = await this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const fetchOptions: RequestInit = {
      method,
      headers,
    };

    if (body && method !== 'GET') {
      fetchOptions.body = JSON.stringify(body);
    }

    let response: Response;
    try {
      response = await fetch(url, fetchOptions);
    } catch (err: any) {
      throw new ApiError(err?.message || 'Network error', 0);
    }

    if (response.status === 401) {
      throw new ApiError('Unauthorized', 401);
    }

    if (!response.ok) {
      let message = `Request failed (${response.status})`;
      try {
        const text = await response.text();
        try {
          const parsed = JSON.parse(text);
          if (parsed?.message) {
            message = String(parsed.message);
          } else if (text && text.length < 300) {
            message = text;
          }
        } catch {
          if (text && text.length < 300) {
            message = text;
          }
        }
      } catch {
        // ignore
      }
      throw new ApiError(message, response.status);
    }

    if (response.status === 204) {
      return {} as T;
    }

    const raw = await response.text();
    if (!raw || raw.trim().length === 0) {
      return {} as T;
    }

    try {
      return JSON.parse(raw) as T;
    } catch {
      throw new ApiError('Unexpected response format', response.status);
    }
  }

  async updateUser(partial: Record<string, unknown>): Promise<unknown> {
    return this.request<unknown>('/api/v1/me', {
      method: 'PATCH',
      body: partial,
    });
  }

  async getSubscription(): Promise<Subscription | null> {
    return this.request<Subscription | null>('/api/v1/me/subscription');
  }

  async restorePurchases(): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>('/api/v1/me/subscription/restore', {
      method: 'POST',
    });
  }

  async listFaqs(params?: {
    category?: string;
    search?: string;
    page?: number;
    perPage?: number;
  }): Promise<Faq[]> {
    const query: Record<string, string | number | boolean> = {};
    if (params?.category) query.category = params.category;
    if (params?.search) query.search = params.search;
    if (params?.page) query.page = params.page;
    if (params?.perPage) query.perPage = params.perPage;
    return this.request<Faq[]>('/api/v1/help/faqs', { query });
  }

  async listMyTickets(params?: {
    status?: string;
    page?: number;
    perPage?: number;
  }): Promise<SupportTicketListItem[]> {
    const query: Record<string, string | number | boolean> = {};
    if (params?.status) query.status = params.status;
    if (params?.page) query.page = params.page;
    if (params?.perPage) query.limit = params.perPage;

    const resp = await this.request<{ data: SupportTicketListItem[]; total: number; page: number; pageSize: number }>(
      '/api/help/tickets',
      { query },
    );
    return resp?.data ?? [];
  }

  async getTicket(id: string): Promise<SupportTicketDetail> {
    const raw = await this.request<any>(`/api/help/tickets/${id}`);
    // Map web API message shape { author: { name } } → { authorName }
    return {
      id: raw.id,
      ticketNumber: raw.ticketNumber,
      subject: raw.subject,
      message: raw.message,
      description: raw.description,
      status: raw.status,
      updatedAt: raw.updatedAt,
      createdAt: raw.createdAt,
      messages: (raw.messages ?? []).map((m: any) => ({
        id: m.id,
        body: m.body,
        authorName: m.author?.name ?? m.authorName ?? 'Unknown',
        createdAt: m.createdAt,
      })),
    };
  }

  async createTicket(payload: CreateTicketPayload): Promise<{ id: string }> {
    return this.request<{ id: string }>('/api/help/tickets', {
      method: 'POST',
      body: {
        subject: payload.subject,
        message: payload.body,
        ...(payload.category ? { categoryId: payload.category } : {}),
      },
    });
  }

  async replyToTicket(id: string, payload: { body: string }): Promise<SupportTicketMessage> {
    const raw = await this.request<any>(`/api/help/tickets/${id}/messages`, {
      method: 'POST',
      body: payload,
    });
    return {
      id: raw.id,
      body: raw.message,
      isFromCustomer: false,
      authorName: raw.author?.name ?? raw.authorName ?? 'Unknown',
      createdAt: raw.createdAt,
    };
  }

  async updateNotificationPreferences(prefs: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
    return this.request<NotificationPreferences>('/api/v1/me/notifications/preferences', {
      method: 'PUT',
      body: prefs,
    });
  }

  async getNotificationPreferences(): Promise<NotificationPreferences> {
    return this.request<NotificationPreferences>('/api/v1/me/notifications/preferences');
  }
}

export const backendApi = new BackendApiService();
