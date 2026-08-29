/**
 * Expo push-token registration against /api/activity/expo-push-token endpoint,
 * with lightweight retry + local reminder scheduling helpers.
 */
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { apiBaseUrl } from '../config/env';

const TOKEN_KEY = 'vellbase_access_token';

const isWeb =
  Platform.OS === 'web' ||
  (typeof window !== 'undefined' &&
    typeof window.localStorage !== 'undefined' &&
    typeof window.document !== 'undefined');

async function bearer(): Promise<string> {
  try {
    if (isWeb) {
      if (typeof window === 'undefined') return '';
      return window.localStorage.getItem(TOKEN_KEY) || '';
    }
    return (await SecureStore.getItemAsync(TOKEN_KEY)) || '';
  } catch {
    return '';
  }
}

function resolveBase(override?: string): string {
  const base = (override || apiBaseUrl || '').replace(/\/$/, '');
  if (base) return base;
  return Platform.OS === 'android' ? 'http://10.0.2.2:3001' : 'http://127.0.0.1:3001';
}

export async function ensurePermissions(): Promise<boolean> {
  if (isWeb) return true;
  try {
    const existing = await Notifications.getPermissionsAsync();
    const granted =
      (existing as any).granted === true ||
      (existing as any).status === 'granted' ||
      (existing as any).ios?.status === 'granted';
    if (granted) return true;
    const r = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
    return !!(r as any).granted || (r as any).status === 'granted';
  } catch {
    return false;
  }
}

async function withRetry<T>(
  fn: () => Promise<T>,
  attempts = 3,
  delayMs = 600,
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i < attempts - 1) {
        await new Promise((res) => setTimeout(res, delayMs * (i + 1)));
      }
    }
  }
  throw lastErr;
}

export async function registerExpoPushToken(
  apiBase?: string,
): Promise<{ ok: boolean; token?: string; action?: string }> {
  const base = resolveBase(apiBase);
  const ok = await ensurePermissions();
  if (!ok) return { ok: false };
  let token: string | undefined;
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: (process.env.EXPO_PUBLIC_PROJECT_ID as string) || undefined,
    });
    token = tokenData?.data;
  } catch {
    return { ok: false };
  }
  if (!token) return { ok: false };
  try {
    await withRetry(async () => {
      const auth = await bearer();
      const res = await fetch(`${base}/api/activity/expo-push-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
        },
        body: JSON.stringify({ token, action: 'register' }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    });
    return { ok: true, token, action: 'register' };
  } catch {
    return { ok: false, token };
  }
}

export async function unregisterExpoPushToken(
  token: string,
  apiBase?: string,
): Promise<boolean> {
  const base = resolveBase(apiBase);
  try {
    await withRetry(async () => {
      const auth = await bearer();
      const res = await fetch(`${base}/api/activity/expo-push-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
        },
        body: JSON.stringify({ token, action: 'unregister' }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Schedule a repeating local reminder notification every N minutes.
 * First cancels any previously scheduled notifications from this module (or
 * all scheduled notifications broadly to keep cadence unique).
 * Returns the scheduling identifier, or null when unavailable.
 */
export async function scheduleLocalActivityReminderEveryMinutes(
  minutes: number,
): Promise<string | null> {
  if (minutes <= 0 || isWeb) return null;
  const ok = await ensurePermissions();
  if (!ok) return null;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
  } catch {
    /* ignore */
  }
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'You have new activity waiting',
        body: 'Tap to catch up on likes, comments and follows.',
        sound: true,
        data: { urlScheme: 'vellbase://notifications', href: '/notifications' },
      },
      trigger: {
        seconds: Math.max(60, minutes * 60),
        repeats: true,
      } as any,
    });
    return id;
  } catch {
    return null;
  }
}

/** Fire an immediate local test notification to verify permissions/behavior. */
export async function fireTestLocalNotificationNow(): Promise<string | null> {
  if (isWeb) return null;
  const ok = await ensurePermissions();
  if (!ok) return null;
  try {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Test local notification',
        body: 'If you see this, notifications permissions are correctly configured for Vellbase.',
        data: { href: '/notifications' },
      },
      trigger: null as any,
    });
  } catch {
    return null;
  }
}
