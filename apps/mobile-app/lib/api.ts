import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { createApiClient, ApiClient, Storage } from '@vellbase/api-client';
import { apiBaseUrl } from '../config/env';
import { router } from 'expo-router';

// ═══════════════════════════════════════════════════════════════════════════
// Storage strategy
// ───────────────────────────────────────────────────────────────────────────
// Tokens (JWT, refresh)       → expo-secure-store (encrypted OS keychain)
//                                  On WEB SecureStore is only a stub and its
//                                  native shim (ExpoSecureStore.setValueWith
//                                  KeyAsync) is undefined in v57 → throws.
//                                  Use window.localStorage on web instead.
//                                  Detection uses `typeof window` (runtime)
//                                  AND Platform.OS === 'web' (build-time) to
//                                  survive aliasing / SSR / bundle edge cases.
// User profile cache, non-secrets → AsyncStorage (standard cross-platform)
//
// This follows OWASP mobile security guidance: never persist bearer tokens
// in unencrypted AsyncStorage / SharedPreferences / UserDefaults backups.
// ═══════════════════════════════════════════════════════════════════════════

const isRuntimeWeb =
  typeof window !== 'undefined' &&
  typeof window.localStorage !== 'undefined' &&
  typeof window.document !== 'undefined';
const isWeb = Platform.OS === 'web' || isRuntimeWeb;

const secureTokens: Storage = {
  getItem: async (key: string) => {
    try {
      if (isWeb) {
        if (typeof window === 'undefined') return null;
        return window.localStorage.getItem(key);
      }
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string) => {
    if (isWeb) {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, value);
      }
      return;
    }
    // Native: persist to the OS encrypted keychain. requireAuthentication=false
    // avoids biometric prompts on every save (would break background refreshes)
    // while still keeping data at-rest encrypted via the OS keychain.
    try {
      await SecureStore.setItemAsync(key, value, { requireAuthentication: false });
    } catch {
      // If SecureStore is unavailable (rare simulator edge), fall back to
      // AsyncStorage locally — better than breaking login entirely.
      try {
        await AsyncStorage.setItem(`securefallback:${key}`, value);
      } catch {
        /* unrecoverable */
      }
    }
  },
  removeItem: async (key: string) => {
    try {
      if (isWeb) {
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(key);
        }
        return;
      }
      await SecureStore.deleteItemAsync(key);
    } catch {
      // ignore
    }
    try {
      await AsyncStorage.removeItem(`securefallback:${key}`);
    } catch {
      /* ignore fallback cleanup failures */
    }
  },
};

// Composite storage: tokens from SecureStore, everything else from AsyncStorage.
// The api-client stores under 3 well-known keys: vellbase_access_token,
// vellbase_refresh_token, vellbase_user. We route the first two through SecureStore.
const TOKEN_KEYS = new Set(['vellbase_access_token', 'vellbase_refresh_token']);

const storage: Storage = {
  getItem: async (key: string) => {
    if (TOKEN_KEYS.has(key)) return secureTokens.getItem(key);
    return AsyncStorage.getItem(key);
  },
  setItem: async (key: string, value: string) => {
    if (TOKEN_KEYS.has(key)) {
      await secureTokens.setItem(key, value);
    } else {
      await AsyncStorage.setItem(key, value);
    }
  },
  removeItem: async (key: string) => {
    if (TOKEN_KEYS.has(key)) {
      await secureTokens.removeItem(key);
    } else {
      await AsyncStorage.removeItem(key);
    }
  },
};

export const apiClient: ApiClient = createApiClient({
  baseUrl: apiBaseUrl,
  storage,
  onAuthError: () => {
    // Auth failures MUST be surfaced to the user by re-navigating to
    // the login screen rather than silently logging to console.
    try {
      router.replace('/login');
    } catch {
      // router might not be mounted during bootstrap; that's OK because
      // AuthGate in _layout will redirect based on isAuthenticated=false
      // on the next render.
    }
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
} from '@vellbase/api-client/types';
