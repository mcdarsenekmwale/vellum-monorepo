import { Stack, useRouter, usePathname } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as Linking from 'expo-linking';
import {
  Home,
  Compass,
  Play,
  Bookmark,
  User,
  Search,
  Bell,
  Settings,
  ChevronLeft,
} from 'lucide-react-native';
import { View, Text, TouchableOpacity, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAuthState, useUnreadCount } from '../hooks/useApi';
import { AuthProvider } from '../context/AuthContext';
import {
  ClientSettings,
  DEFAULT_SETTINGS,
  hydrateClientSettings,
  SettingsStoreProvider,
  useSettingsStore,
} from '../context/SettingsStore';
import { VellumThemeProvider, useThemeColors } from '../context/ThemeProvider';
import { I18nProvider, useI18n } from '../context/I18nProvider';
import { createSoundService, sounds } from '../services/SoundService';
import React, { useEffect, useState, useRef } from 'react';

const TAB_BAR_CONTENT_HEIGHT = Platform.OS === 'ios' ? 49 : 56;

const PUBLIC_ROUTES = ['/login', '/register'];
const TAB_ROUTES = ['/', '/index', '/discover', '/highlights', '/saved', '/profile'];

export function BackButton() {
  const router = useRouter();
  return (
    <TouchableOpacity
      onPress={() => router.back()}
      style={{ paddingHorizontal: 8, paddingVertical: 8 }}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
    >
      <ChevronLeft size={26} color="#000000" />
    </TouchableOpacity>
  );
}

export function HeaderLogo() {
  return (
    <Text
      style={{
        fontFamily: 'Georgia',
        fontStyle: 'italic',
        fontSize: 25,
        fontWeight: '600',
        color: '#000000',
        letterSpacing: -0.5,
      }}
    >
      Vellum.
    </Text>
  );
}

function useNotificationBadgeCount(): number | null {
  const { isAuthenticated } = useAuthState();
  const { data, error } = useUnreadCount();
  if (!isAuthenticated) return 0;
  if (error) return 0;
  return typeof data?.count === 'number' ? data.count : 0;
}

export function ProfileHeaderActions() {
  const router = useRouter();
  const { t } = useI18n();
  const unread = useNotificationBadgeCount();
  const showDot = typeof unread === 'number' && unread > 0;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginRight: 12 }}>
      <TouchableOpacity
        onPress={() => router.push('/notifications')}
        style={{
          backgroundColor: '#e5e5e5',
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityLabel={`Notifications${showDot ? ` (${unread} unread)` : ''}`}
      >
        <Bell size={20} color="#000000" />
        {showDot ? (
          <View style={[styles.notifDot, unread > 99 ? styles.notifDotLarge : undefined]} />
        ) : null}
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => router.push('/settings')}
        style={{
          backgroundColor: '#e5e5e5',
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: 'center',
          justifyContent: 'center',
        }}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityLabel={t('common.settings')}
      >
        <Settings size={20} color="#000000" />
      </TouchableOpacity>
    </View>
  );
}

export function FeedHeaderActions() {
  const router = useRouter();
  const unread = useNotificationBadgeCount();
  const showDot = typeof unread === 'number' && unread > 0;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginRight: 5 }}>
      <TouchableOpacity
        onPress={() => router.push('/discover')}
        style={{
          backgroundColor: '#e5e5e5',
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: 'center',
          justifyContent: 'center',
        }}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityLabel="Search / Discover"
      >
        <Search size={20} color="#000000" />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => router.push('/notifications')}
        style={{
          backgroundColor: '#e5e5e5',
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityLabel={`Notifications${showDot ? ` (${unread} unread)` : ''}`}
      >
        <Bell size={20} color="#000000" />
        {showDot ? (
          <View style={[styles.notifDot, unread > 99 ? styles.notifDotLarge : undefined]} />
        ) : null}
      </TouchableOpacity>
    </View>
  );
}

export const CustomHeaderActions = () => {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.profileButton}
        activeOpacity={0.7}
        onPress={() => { }}
      >
        <View style={styles.innerDot} />
      </TouchableOpacity>
    </View>
  );
};

export function CustomHeader({
  title,
  left,
  right,
  titleAlign = 'center',
  customTitle,
  isMain = true,
  edges = ['top', 'left', 'right'],
}: {
  title?: string;
  edges?: any[];
  left?: React.ReactNode;
  right?: React.ReactNode;
  titleAlign?: 'center' | 'left' | undefined;
  customTitle?: React.ReactNode;
  isMain?: boolean;
}) {
  const colors = useThemeColors();
  return (
    <SafeAreaView style={{ backgroundColor: colors.background }} edges={edges}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 56,
          paddingHorizontal: 12,
        }}
      >
        {isMain && (
          <View style={{ width: 80, alignItems: 'flex-start', justifyContent: 'center' }}>
            {left}
          </View>
        )}
        <View
          style={{
            flex: 1,
            alignItems: titleAlign === 'left' ? 'flex-start' : 'center',
            justifyContent: 'center',
          }}
        >
          {customTitle || (
            <Text
              style={{
                fontFamily: 'Georgia',
                fontStyle: 'italic',
                fontSize: 22,
                
                color: colors.textPrimary,
              }}
            >
              {/* Capitalize the title */}
              {title ? title.charAt(0).toUpperCase() + title.slice(1) : ''}
            </Text>
          )}
        </View>
        <View style={{ width: 80, alignItems: 'flex-end', justifyContent: 'center' }}>
          {right}
        </View>
      </View>
    </SafeAreaView>
  );
}

// Themed BackButton & HeaderLogo helpers (read theme colors internally).
export function ThemedBackButton() {
  const router = useRouter();
  const colors = useThemeColors();
  return (
    <TouchableOpacity
      onPress={() => router.back()}
      style={{ paddingHorizontal: 8, paddingVertical: 8 }}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
    >
      <ChevronLeft size={26} color={colors.textPrimary} />
    </TouchableOpacity>
  );
}

export function ThemedHeaderLogo() {
  const colors = useThemeColors();
  return (
    <Text
      style={{
        fontFamily: 'Georgia',
        fontStyle: 'italic',
        fontSize: 25,
        fontWeight: '600',
        color: colors.textPrimary,
        letterSpacing: -0.5,
      }}
    >
      Vellum.
    </Text>
  );
}

const TAB_ITEMS = [
  { key: 'index', labelKey: 'navigation.home', icon: Home, route: '/' },
  { key: 'discover', labelKey: 'navigation.discover', icon: Compass, route: '/discover' },
  { key: 'highlights', labelKey: 'navigation.highlights', icon: Play, route: '/highlights' },
  { key: 'saved', labelKey: 'navigation.saved', icon: Bookmark, route: '/saved' },
  { key: 'profile', labelKey: 'navigation.profile', icon: User, route: '/profile' },
];

function CustomTabBar() {
  const router = useRouter();
  const pathname = usePathname();
  const colors = useThemeColors();
  const { t } = useI18n();

  const getActiveKey = (): string => {
    if (pathname === '/' || pathname === '/index') return 'index';
    const firstSegment = pathname.split('/')[1];
    if (firstSegment && TAB_ITEMS.some((item) => item.key === firstSegment)) {
      return firstSegment;
    }
    return 'index';
  };

  const shouldHideTabBar = (): boolean => {
    if (pathname.startsWith('/story/')) return true;
    if (pathname === '/login' || pathname === '/register') return true;
    if (pathname.startsWith('/article/')) return true;
    if (pathname.startsWith('/author/')) return true;
    if (pathname.startsWith('/category/')) return true;
    if (pathname === '/compose') return true;
    if (pathname === '/notifications') return true;
    if (pathname === '/settings') return true;
    if (pathname.startsWith('/settings-')) return true;
    if (pathname === '/help-center') return true;
    if (pathname.startsWith('/help-')) return true;
    return false;
  };

  if (shouldHideTabBar()) {
    return null;
  }

  const activeKey = getActiveKey();

  // Use router.replace so the stack doesn't grow unbounded as users tap tabs.
  const handlePress = (route: string) => {
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        try {
          // Debug instrumentation (in-memory only): track that handlePress actually fired
          // so we can confirm clicks reach the router call site even on web.
          (window as any).__lastTabPress = {
            route,
            at: new Date().toISOString(),
            pathnameBefore: pathname,
          };
          // Also expose the router for cross-cutting tests that need direct
          // navigation (Playwright automation uses this to jump straight to
          // /settings without relying on fragile DOM click coordinate math).
          if (!(window as any).__router) {
            (window as any).__router = router;
          }
        } catch { }
      }
      try {
        router.replace(route as any);
      } catch {
        router.push(route as any);
      }
    } catch (e) {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        try {
          (window as any).__lastTabPressError = String(e && typeof e === 'object' ? ((e as any).stack || String(e)) : String(e));
        } catch { }
      }
    } finally {
      try { sounds().playTap(); } catch { /* ignore */ }
    }
  };

  return (
    <SafeAreaView
      edges={['left', 'right', 'bottom']}
      pointerEvents="auto"
      style={[tabStyles.tabBarSafeArea, { backgroundColor: colors.surface, borderTopColor: colors.border }]}
    >
      <View style={tabStyles.tabBarContainer} pointerEvents="box-none">
        {TAB_ITEMS.map((item) => {
          const isActive = activeKey === item.key;
          const Icon = item.icon;
          return (
            <TouchableOpacity
              key={item.key}
              onPress={() => handlePress(item.route)}
              style={tabStyles.tabItem}
              activeOpacity={0.7}
              hitSlop={{ top: 16, bottom: 16, left: 8, right: 8 }}

            >
              <View style={tabStyles.tabItemInner}>
                <Icon
                  size={24}
                  color={isActive ? colors.textPrimary : colors.textMuted}
                  strokeWidth={isActive ? 2.5 : 1.5}
                />
                <Text
                  style={[
                    tabStyles.tabLabel,
                    { color: isActive ? colors.textPrimary : colors.textMuted },
                    isActive && tabStyles.tabLabelActive,
                  ]}
                >
                  {t(item.labelKey)}
                </Text>
                {isActive ? (
                  <View style={[tabStyles.activeDot, { backgroundColor: colors.accent }]} />
                ) : (
                  <View style={tabStyles.inactiveDot} />
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading } = useAuthState();
  const [isReady, setIsReady] = useState(false);
  const [navigated, setNavigated] = useState(false);
  const colors = useThemeColors();

  useEffect(() => {
    if (isLoading) return;
    setIsReady(true);
  }, [isLoading]);

  useEffect(() => {
    if (!isReady || navigated) return;

    const isPublicRoute = PUBLIC_ROUTES.includes(pathname);

    if (!isAuthenticated && !isPublicRoute) {
      setNavigated(true);
      router.replace('/login');
    } else if (isAuthenticated && isPublicRoute) {
      setNavigated(true);
      router.replace('/');
    }
  }, [isAuthenticated, isReady, pathname, router, navigated]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {children}
      <CustomTabBar />
      {!isReady && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: colors.background,
            zIndex: 1000,
          }}
        >
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      )}
    </View>
  );
}

export default function RootLayout() {
  const [initial, setInitial] = useState<ClientSettings | null>(null);

  // Outer hydration: load preferences BEFORE any provider/context mounts so that
  // the very first paint uses the saved theme (no flash of wrong theme).
  useEffect(() => {
    let cancelled = false;
    hydrateClientSettings()
      .then((s) => {
        if (!cancelled) setInitial(s ?? { ...DEFAULT_SETTINGS });
      })
      .catch(() => {
        if (!cancelled) setInitial({ ...DEFAULT_SETTINGS });
      });
    return () => { cancelled = true; };
  }, []);

  // Keep the shared SoundService singleton pointed at the live soundEnabled flag.
  // We build a getter that reads through a mutable ref; this avoids creating the
  // sound service inside a provider render and lets the singleton live outside React.
  const soundRef = React.useRef(initial?.soundEnabled ?? DEFAULT_SETTINGS.soundEnabled);
  useEffect(() => { soundRef.current = initial?.soundEnabled ?? DEFAULT_SETTINGS.soundEnabled; });
  useEffect(() => {
    createSoundService(() => soundRef.current);
  }, []);

  const initialSettings = initial ?? { ...DEFAULT_SETTINGS };

  return (
    <AuthProvider>
      <SettingsStoreProvider initialSettings={initialSettings}>
        <VellumThemeProvider>
          <I18nProvider>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <AppShellContent />
            </GestureHandlerRootView>
          </I18nProvider>
        </VellumThemeProvider>
      </SettingsStoreProvider>
    </AuthProvider>
  );
}

function AppShellContent() {
  const { settings } = useSettingsStore();
  const router = useRouter();
  const { t } = useI18n();
  const notificationListenerRef = useRef<Notifications.Subscription | null>(null);
  const responseListenerRef = useRef<Notifications.Subscription | null>(null);

  // Keep sound service pointed at latest settings.soundEnabled without reconstructing
  // the providers (it uses a getter — this is a cheap pointer refresh).
  useEffect(() => {
    createSoundService(() => settings.soundEnabled);
  }, [settings.soundEnabled]);

  /**
   * Push notification deep-linking & tap handling:
   *  - Wire expo-notifications foreground listener (shows nothing extra, but lets us log).
   *  - On notification tap (notificationResponse), read `data.href` or fall back to
   *    `data.url` / `data.screen` params and `router.push()` them. Falls back safely if
   *    the notification carries no routing payload, and silently swallows errors so a
   *    malformed push can never crash the shell. Also handles `Linking` cold-start URLs.
   */
  useEffect(() => {
    let disposed = false;
    if (Platform.OS === 'web') return;

    try {
      // Configure foreground handler so in-app pushes render gently
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: settings.soundEnabled,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });

      notificationListenerRef.current = Notifications.addNotificationReceivedListener(() => {
        /* Foreground push arrived; we could badge increment here, intentionally no-op */
      });

      /**
       * Deep-links a notification payload into the router. Accepts:
       *   data.href  → full expo-router href (best, includes params)
       *   data.url   → same (alias from some backends)
       *   data.screen + data.params → build href manually
       */
      const routeNotification = (payload?: Record<string, any> | null) => {
        if (!payload || disposed) return;
        try {
          let href: string | null = payload.href || payload.url || null;
          if (!href && payload.screen) {
            const parts = new URLSearchParams(payload.params || {}).toString();
            href = parts ? `/${payload.screen}?${parts}` : `/${payload.screen}`;
          }
          if (href && typeof href === 'string' && href.startsWith('/')) {
            router.push(href as any);
          }
        } catch {
          /* ignore router errors */
        }
      };

      // Tap on notification (while running or killed/background)
      responseListenerRef.current = Notifications.addNotificationResponseReceivedListener(
        (response) => {
          const data = response?.notification?.request?.content?.data as any;
          routeNotification(data || {});
        },
      );

      // Also handle URL deep links / universal links coming through expo-linking
      const sub = Linking.addEventListener?.('url', ({ url }) => {
        try {
          const parsed = Linking.parse(url);
          const path = parsed.path ? `/${parsed.path.replace(/^\//, '')}` : null;
          const qs =
            parsed.queryParams && Object.keys(parsed.queryParams).length
              ? '?' + new URLSearchParams(parsed.queryParams as any).toString()
              : '';
          if (path && path.length > 1) router.push((path + qs) as any);
        } catch {
          /* ignore malformed linking events */
        }
      });

      // Handle initial URL if app was cold-launched from a link
      Linking.getInitialURL?.()
        .then((url) => {
          if (!url || disposed) return;
          const parsed = Linking.parse(url);
          const path = parsed.path ? `/${parsed.path.replace(/^\//, '')}` : null;
          const qs =
            parsed.queryParams && Object.keys(parsed.queryParams).length
              ? '?' + new URLSearchParams(parsed.queryParams as any).toString()
              : '';
          if (path && path.length > 1) router.push((path + qs) as any);
        })
        .catch(() => { });

      return () => {
        disposed = true;
        if (sub && typeof sub.remove === 'function') sub.remove();
        if (notificationListenerRef.current) {
          notificationListenerRef.current.remove();
          notificationListenerRef.current = null;
        }
        if (responseListenerRef.current) {
          responseListenerRef.current.remove();
          responseListenerRef.current = null;
        }
      };
    } catch {
      return;
    }
    // Intentionally run once on mount; router and soundEnabled captured via closures.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthGate>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen
          name="index"
          options={{
            title: 'Feed',
            header: () => (
              <CustomHeader
                isMain={false}
                customTitle={<ThemedHeaderLogo />}
                titleAlign="left"
                right={<FeedHeaderActions />}
              />
            ),
            headerShown: true,
          }}
        />
        <Stack.Screen
          name="login"
          options={{
            title: 'Sign In',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="register"
          options={{
            title: 'Create Account',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="discover"
          options={{
            title: 'Discover',
            header: () => (
              <CustomHeader
                isMain={false}
                title="Discover"
                titleAlign="left"
                right={<CustomHeaderActions />}
              />
            ),
            headerShown: true,
          }}
        />
        <Stack.Screen
          name="highlights"
          options={{
            title: 'Highlights',
            header: () => <CustomHeader title="Highlights" />,
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="saved"
          options={{
            title: 'Saved',
            header: () => (
              <CustomHeader
                isMain={false}
                title="Saved"
                titleAlign="left"
                right={<CustomHeaderActions />}
              />
            ),
            headerShown: true,
          }}
        />
        <Stack.Screen
          name="profile"
          options={{
            title: 'Profile',
            header: () => (
              <CustomHeader
                isMain={false}
                title={t('common.profile')}
                titleAlign="left"
                right={<ProfileHeaderActions />}
              />
            ),
            headerShown: true,
          }}
        />
        <Stack.Screen
          name="compose"
          options={{
            title: 'New Story',
            header: () => <CustomHeader title="New Story" left={<ThemedBackButton />} />,
            headerShown: false,
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="notifications"
          options={{
            title: 'Activity',
            header: () => <CustomHeader title="Activity" left={<ThemedBackButton />} />,
            headerShown: true,
          }}
        />
        <Stack.Screen
          name="settings"
          options={{
            title: 'Settings',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="settings-privacy"
          options={{
            title: 'Privacy',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="settings-about"
          options={{
            title: 'About',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="settings-subscription"
          options={{
            title: 'Subscription',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="help-center"
          options={{
            title: 'Help Center',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="help-tickets"
          options={{
            title: 'My Tickets',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="help-ticket-detail"
          options={{
            title: 'Ticket',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="help-contact"
          options={{
            title: 'Contact Support',
            header: () => <CustomHeader title="Contact Support" left={<ThemedBackButton />} />,
            headerShown: true,
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="feed-api"
          options={{
            title: 'Feed API',
            headerShown: false,
          }}
        />
      </Stack>
    </AuthGate>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  profileButton: {
    width: 36,
    height: 36,
    borderRadius: 55,
    backgroundColor: '#FDF2EE',
    borderWidth: 1.5,
    borderColor: '#f1ad98ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  innerDot: {
    width: 9,
    height: 9,
    borderRadius: 6,
    backgroundColor: '#E89B7A',
  },
  notifDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
  },
  notifDotLarge: {
    width: 10,
    height: 10,
    borderRadius: 5,
    top: 5,
    right: 5,
  },
});

const tabStyles = StyleSheet.create({
  tabBarSafeArea: {
    backgroundColor: '#ffffff',
    borderTopWidth: 0.5,
    borderTopColor: '#e5e5e5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -0.5 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    width: '100%',
    paddingTop: 3,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 99999,
    isolation: 'isolate' as any,
  },
  tabBarContainer: {
    flexDirection: 'row',
    width: '100%',
    height: TAB_BAR_CONTENT_HEIGHT,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
    height: '100%',
  },
  tabItemInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
    textTransform: 'none',
    letterSpacing: 0.1,
  },
  tabLabelActive: {
    fontWeight: '700',
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E07050',
    marginTop: 1,
  },
  inactiveDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'transparent',
    marginTop: 1,
  },
});
