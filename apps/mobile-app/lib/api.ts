import AsyncStorage from '@react-native-async-storage/async-storage';
import { createApiClient, ApiClient, Storage } from '@vellum/api-client';
import { apiBaseUrl } from '../config/env';

const storage: Storage = {
  getItem: async (key: string) => {
    return AsyncStorage.getItem(key);
  },
  setItem: async (key: string, value: string) => {
    await AsyncStorage.setItem(key, value);
  },
  removeItem: async (key: string) => {
    await AsyncStorage.removeItem(key);
  },
};

export const apiClient: ApiClient = createApiClient({
  baseUrl: apiBaseUrl,
  storage,
  onAuthError: () => {
    console.log('Auth error - user needs to re-login');
  },
});

export type {
  User,
  Article,
  Highlight,
  Comment,
  Category,
  Notification,
  Story,
  Media,
  PaginatedResponse,
  AuthResponse,
} from '@vellum/api-client/types';