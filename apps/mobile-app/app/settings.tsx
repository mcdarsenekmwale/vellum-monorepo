import { View, Text, TouchableOpacity, ScrollView, Animated, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { 
  ArrowLeft, 
  Bell, 
  Moon, 
  Globe, 
  Heart, 
  HelpCircle, 
  Info, 
  Shield, 
  Volume2,
  ChevronRight 
} from 'lucide-react-native';
import { useState, useRef, useCallback, useEffect } from 'react';
import { useAuthState } from '../hooks/useApi';
import { apiClient } from '../lib/api';
import { Avatar } from '../components/Avatar';

/* ----------------- Custom Switch Component ----------------- */

function CustomSwitch({ 
  value, 
  onValueChange, 
  activeColor = '#d4653a',
  inactiveColor = '#e5e0d8',
  thumbColor = '#ffffff',
  size = 'medium'
}: { 
  value: boolean; 
  onValueChange: (val: boolean) => void;
  activeColor?: string;
  inactiveColor?: string;
  thumbColor?: string;
  size?: 'small' | 'medium' | 'large';
}) {
  const animatedValue = useRef(new Animated.Value(value ? 1 : 0)).current;
  
  const dimensions = {
    small: { width: 36, height: 20, thumb: 16, padding: 2 },
    medium: { width: 48, height: 28, thumb: 24, padding: 2 },
    large: { width: 56, height: 32, thumb: 28, padding: 2 },
  }[size];

  const translateX = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, dimensions.width - dimensions.thumb - dimensions.padding * 2],
  });

  const handlePress = useCallback(() => {
    const newValue = !value;
    Animated.spring(animatedValue, {
      toValue: newValue ? 1 : 0,
      useNativeDriver: true,
      friction: 8,
      tension: 40,
    }).start();
    onValueChange(newValue);
  }, [value, onValueChange, animatedValue]);

  const backgroundColor = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [inactiveColor, activeColor],
  });

  return (
    <Pressable onPress={handlePress} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
      <Animated.View
        style={[
          styles.switchTrack,
          {
            width: dimensions.width,
            height: dimensions.height,
            borderRadius: dimensions.height / 2,
            padding: dimensions.padding,
            backgroundColor,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.switchThumb,
            {
              width: dimensions.thumb,
              height: dimensions.thumb,
              borderRadius: dimensions.thumb / 2,
              backgroundColor: thumbColor,
              transform: [{ translateX }],
              shadowColor: '#000000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.15,
              shadowRadius: 3,
              elevation: 3,
            },
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}

/* ----------------- Settings Page ----------------- */

export default function SettingsPage() {
  const router = useRouter();
  const { user, isLoading: authLoading, logout } = useAuthState();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [darkModeEnabled, setDarkModeEnabled] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await apiClient.getUserSettings();
        setNotificationsEnabled(settings.pushNotifications);
      } catch {
        // ignore
      }
    };
    if (user) {
      loadSettings();
    }
  }, [user]);

  const handleToggleNotifications = async (val: boolean) => {
    setNotificationsEnabled(val);
    try {
      await apiClient.updateUserSettings({ pushNotifications: val });
    } catch (err) {
      console.error('Failed to update settings:', err);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      router.replace('/login');
    } catch (err) {
      console.error('Failed to logout:', err);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const settingGroups = [
    {
      title: 'Preferences',
      items: [
        { 
          icon: Bell, 
          label: 'Notifications', 
          description: 'Manage push notifications', 
          type: 'toggle' as const, 
          value: notificationsEnabled, 
          onChange: handleToggleNotifications 
        },
        { 
          icon: Moon, 
          label: 'Appearance', 
          description: 'Light, dark, or system', 
          type: 'toggle' as const, 
          value: darkModeEnabled, 
          onChange: setDarkModeEnabled 
        },
        { 
          icon: Volume2, 
          label: 'Sound', 
          description: 'Enable audio effects', 
          type: 'toggle' as const, 
          value: soundEnabled, 
          onChange: setSoundEnabled 
        },
        { 
          icon: Globe, 
          label: 'Language', 
          description: 'English', 
          type: 'link' as const 
        },
      ],
    },
    {
      title: 'Account',
      items: [
        { 
          icon: Shield, 
          label: 'Privacy', 
          description: 'Manage data and permissions', 
          type: 'link' as const 
        },
        { 
          icon: Heart, 
          label: 'Subscription', 
          description: 'Vellum Pro — $4.99/month', 
          type: 'link' as const 
        },
        { 
          icon: Info, 
          label: 'About', 
          description: 'Version 1.0.0', 
          type: 'link' as const 
        },
      ],
    },
    {
      title: 'Support',
      items: [
        { 
          icon: HelpCircle, 
          label: 'Help Center', 
          description: 'FAQs and contact', 
          type: 'link' as const 
        },
      ],
    },
  ];

  if (authLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#d4653a" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* User Profile Header */}
      {user && (
        <View style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 16, alignItems: 'center' }}>
          <Avatar
            uri={user.avatar}
            name={user.name}
            handle={user.handle}
            size={80}
            style={{ borderWidth: 2, borderColor: '#e5e0d8' }}
          />
          <Text style={{ fontSize: 22, fontFamily: 'Georgia', fontStyle: 'italic', marginTop: 12, color: '#000000' }}>{user.name}</Text>
          <Text style={{ fontSize: 12, fontWeight: '600', color: '#666666', marginTop: 4 }}>{user.handle}</Text>
          {user.bio && (
            <Text style={{ fontSize: 13, color: '#666666', marginTop: 8, textAlign: 'center' }}>{user.bio}</Text>
          )}
        </View>
      )}

      {/* Settings Groups */}
      <View style={styles.content}>
        {settingGroups.map((group) => (
          <View key={group.title} style={styles.group}>
            <Text style={styles.groupTitle}>{group.title}</Text>
            <View style={styles.groupItems}>
              {group.items.map((item, idx) => {
                const Icon = item.icon;

                return (
                  <TouchableOpacity
                    key={idx}
                    style={styles.item}
                    activeOpacity={item.type === 'link' ? 0.7 : 1}
                    disabled={item.type === 'toggle'}
                  >
                    <View style={styles.iconContainer}>
                      <Icon size={18} color="#333333" strokeWidth={1.8} />
                    </View>
                    <View style={styles.itemContent}>
                      <Text style={styles.itemLabel}>{item.label}</Text>
                      <Text style={styles.itemDescription}>{item.description}</Text>
                    </View>
                    {item.type === 'toggle' ? (
                      <CustomSwitch
                        value={item.value}
                        onValueChange={item.onChange}
                        activeColor="#d4653a"
                        inactiveColor="#e5e0d8"
                        size="medium"
                      />
                    ) : (
                      <ChevronRight size={18} color="#cccccc" strokeWidth={2} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}

        {/* Sign Out */}
        <TouchableOpacity style={styles.signOutButton} activeOpacity={0.7} onPress={handleLogout} disabled={isLoggingOut}>
          <Text style={[styles.signOutText, isLoggingOut && { opacity: 0.5 }]}>
            {isLoggingOut ? 'Signing out...' : 'Sign out'}
          </Text>
        </TouchableOpacity>

        {/* Footer */}
        <Text style={styles.footer}>Vellum v1.0.0</Text>
      </View>
    </ScrollView>
  );
}

/* ----------------- Styles ----------------- */

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f7f4ee',
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontFamily: 'Georgia',
    fontStyle: 'italic',
    fontSize: 26,
    fontWeight: '400',
    color: '#000000',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e8e4de',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 40,
    gap: 28,
  },
  group: {
    gap: 12,
  },
  groupTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#999999',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  groupItems: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f2ed',
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#f7f4ee',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemContent: {
    flex: 1,
    gap: 2,
  },
  itemLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
  },
  itemDescription: {
    fontSize: 12,
    color: '#999999',
  },
  signOutButton: {
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginTop: 4,
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#d4653a',
  },
  footer: {
    fontSize: 12,
    color: '#cccccc',
    textAlign: 'center',
    marginTop: 8,
  },

  /* Custom Switch */
  switchTrack: {
    justifyContent: 'center',
  },
  switchThumb: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
});
