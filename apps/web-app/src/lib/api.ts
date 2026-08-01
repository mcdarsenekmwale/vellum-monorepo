import { createApiClient } from '@vellum/api-client';
import { apiBaseUrl } from '../config/env';

const storage = {
  getItem: async (key: string) => localStorage.getItem(key),
  setItem: async (key: string, value: string) => localStorage.setItem(key, value),
  removeItem: async (key: string) => localStorage.removeItem(key),
};

export const apiClient = createApiClient({
  baseUrl: apiBaseUrl,
  storage,
  withCredentials: true,
});

export type {
  User,
  Article,
  Highlight,
  Comment,
  Category,
  Notification,
  PaginatedResponse,
  Story,
  UserSettings,
  ArticleAuthor,
  SearchResults,
  SuggestedArticlesResponse,
  SuggestedAuthor,
  SuggestedAuthorsResponse,
  HelpArticle,
  SupportTicket,
  TicketCategory,
  TicketMessage,
  TicketStatus,
  TicketPriority,
  TicketType,
  CreateTicketRequest,
  TicketListResponse,
} from '@vellum/api-client/types';
