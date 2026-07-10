import { createApiClient } from '../../../packages/api-client/src/client';

const storage = {
  getItem: async (key: string) => localStorage.getItem(key),
  setItem: async (key: string, value: string) => localStorage.setItem(key, value),
  removeItem: async (key: string) => localStorage.removeItem(key),
};

export const apiClient = createApiClient({
  baseUrl: 'http://localhost:3001',
  storage,
});

export type { User, Article, Highlight, Comment, Category, Notification, PaginatedResponse, Story, UserSettings, ArticleAuthor, SearchResults } from '../../../packages/api-client/src/types';
