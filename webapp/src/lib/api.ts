import { createApiClient } from '../../../packages/api-client/src/client';

const storage = {
  getItem: async (key: string) => localStorage.getItem(key),
  setItem: async (key: string, value: string) => localStorage.setItem(key, value),
  removeItem: async (key: string) => localStorage.removeItem(key),
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

export const apiClient = createApiClient({
  baseUrl: API_BASE_URL,
  storage,
});

export type { User, Article, Highlight, Comment, Category, Notification, PaginatedResponse, Story, UserSettings, ArticleAuthor, SearchResults } from '../../../packages/api-client/src/types';
