import AsyncStorage from '@react-native-async-storage/async-storage';
import { createApiClient, ApiClient, Storage } from '../packages/api-client/src/index';

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

// In production builds, override via build config or environment
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';

export const apiClient: ApiClient = createApiClient({
  baseUrl: API_BASE_URL,
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
} from '../packages/api-client/src/types/index';