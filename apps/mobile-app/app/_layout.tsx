import { Stack, useRouter, usePathname } from 'expo-router';
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
import { useAuthState } from '../hooks/useApi';
import { AuthProvider } from '../context/AuthContext';
import { useEffect, useState } from 'react';

const TAB_BAR_CONTENT_HEIGHT = Platform.OS === 'ios' ? 49 : 56;

const PUBLIC_ROUTES = ['/login', '/register'];
const TAB_ROUTES = ['/', '/index', '/discover', '/highlights', '/saved', '/profile'];

function BackButton() {
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

function HeaderLogo() {
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

function ProfileHeaderActions() {
  const router = useRouter();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginRight: 12 }}>
      <TouchableOpacity onPress={() => router.push('/notifications')} style={{ backgroundColor: '#e5e5e5', width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', position: 'relative' }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Bell size={20} color="#000000" />
        <View style={{ position: 'absolute', top: 6, right: 6, width: 6, height: 6, backgroundColor: '#ef4444', borderRadius: 3 }} />
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.push('/settings')} style={{ backgroundColor: '#e5e5e5', width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Settings size={20} color="#000000" />
      </TouchableOpacity>
    </View>
  );
}

function FeedHeaderActions() {
  const router = useRouter();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginRight: 5 }}>
      <TouchableOpacity onPress={() => router.push('/discover')} style={{ backgroundColor: '#e5e5e5', width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Search size={20} color="#000000" />
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.push('/notifications')} style={{ backgroundColor: '#e5e5e5', width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', position: 'relative' }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Bell size={20} color="#000000" />
        <View style={{ position: 'absolute', top: 6, right: 6, width: 6, height: 6, backgroundColor: '#ef4444', borderRadius: 3 }} />
      </TouchableOpacity>
    </View>
  );
}

const CustomHeaderActions = () => {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.profileButton}
        activeOpacity={0.7}
        onPress={() => {}}
      >
        <View style={styles.innerDot} />
      </TouchableOpacity>
    </View>
  );
};

function CustomHeader({ title, left, right, titleAlign = 'center', customTitle, isMain = true }: { title?: string; left?: React.ReactNode; right?: React.ReactNode; titleAlign?: 'center' | 'left' | undefined; customTitle?: React.ReactNode; isMain?: boolean }) {
  return (
    <SafeAreaView style={{ backgroundColor: '#f7f4ee' }} edges={['top', 'left', 'right']}>
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 56,
        paddingHorizontal: 12,
      }}>
        {isMain && 
          <View style={{ width: 80, alignItems: 'flex-start', justifyContent: 'center' }}>
            {left}
          </View>
        }
        <View style={{ flex: 1, alignItems: titleAlign === 'left' ? 'flex-start' : 'center', justifyContent: 'center' }}>
          {customTitle || (
            <Text style={{
              fontFamily: 'Georgia',
              fontStyle: 'italic',
              fontSize: 22,
              color: '#000000',
            }}>
              {title}
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

const TAB_ITEMS = [
  { key: 'index', label: 'Feed', icon: Home, route: '/' },
  { key: 'discover', label: 'Discover', icon: Compass, route: '/discover' },
  { key: 'highlights', label: 'Highlights', icon: Play, route: '/highlights' },
  { key: 'saved', label: 'Saved', icon: Bookmark, route: '/saved' },
  { key: 'profile', label: 'Profile', icon: User, route: '/profile' },
];

function CustomTabBar() {
  const router = useRouter();
  const pathname = usePathname();

  const getActiveKey = (): string => {
    if (pathname === '/' || pathname === '/index') return 'index';
    const firstSegment = pathname.split('/')[1];
    if (firstSegment && TAB_ITEMS.some(item => item.key === firstSegment)) {
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
    if (pathname.startsWith('/settings/')) return true;
    return false;
  };

  if (shouldHideTabBar()) {
    return null;
  }

  const activeKey = getActiveKey();

  const handlePress = (route: string) => {
    router.push(route as any);
  };

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={tabStyles.tabBarSafeArea}>
      <View style={tabStyles.tabBarContainer}>
        {TAB_ITEMS.map((item) => {
          const isActive = activeKey === item.key;
          const Icon = item.icon;
          return (
            <TouchableOpacity
              key={item.key}
              onPress={() => handlePress(item.route)}
              style={tabStyles.tabItem}
              activeOpacity={0.7}
            >
              <View style={tabStyles.tabItemInner}>
                <Icon
                  size={24}
                  color={isActive ? '#000000' : '#999999'}
                  strokeWidth={isActive ? 2.5 : 1.5}
                />
                <Text
                  style={[
                    tabStyles.tabLabel,
                    { color: isActive ? '#000000' : '#999999' },
                    isActive && tabStyles.tabLabelActive,
                  ]}
                >
                  {item.label}
                </Text>
                {isActive ? (
                  <View style={tabStyles.activeDot} />
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
    <View style={{ flex: 1 }}>
      {children}
      <CustomTabBar />
      {!isReady && (
        <View style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          justifyContent: 'center', 
          alignItems: 'center', 
          backgroundColor: '#f7f4ee',
          zIndex: 1000,
        }}>
          <ActivityIndicator size="large" color="#000000" />
        </View>
      )}
    </View>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AuthGate>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: '#f7f4ee' },
            }}
          >
            <Stack.Screen
              name="index"
              options={{
                title: 'Feed',
                header: () => <CustomHeader isMain={false} customTitle={<HeaderLogo />} titleAlign="left" right={<FeedHeaderActions />} />,
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
                header: () => <CustomHeader isMain={false} title="Discover" titleAlign="left" right={<CustomHeaderActions />} />,
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
                header: () => <CustomHeader isMain={false} title="Saved" titleAlign="left" right={<CustomHeaderActions />} />,
                headerShown: true,
              }}
            />
            <Stack.Screen
              name="profile"
              options={{
                title: 'Profile',
                header: () => <CustomHeader isMain={false} title="you" titleAlign="left" right={<ProfileHeaderActions />} />,
                headerShown: true,
              }}
            />
            <Stack.Screen
              name="compose"
              options={{
                title: 'New Story',
                header: () => <CustomHeader title="New Story" left={<BackButton />} />,
                headerShown: false,
                presentation: 'modal',
              }}
            />
            <Stack.Screen
              name="notifications"
              options={{
                title: 'Activity',
                header: () => <CustomHeader title="Activity" left={<BackButton />} />,
                headerShown: true,
              }}
            />
            <Stack.Screen
              name="settings"
              options={{
                title: 'Settings',
                header: () => <CustomHeader title="Settings" left={<BackButton />} />,
                headerShown: true,
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
      </GestureHandlerRootView>
    </AuthProvider>
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
    zIndex: 100,
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
