import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Pencil } from 'lucide-react-native';
import { useAuthState } from '../hooks/useApi';
import { apiClient } from '../lib/api';
import { useState, useEffect, useCallback } from 'react';
import type { Article } from '@vellbase/api-client/types';
import { Avatar } from '../components/Avatar';
import { useTheme } from 'context/ThemeProvider';
import { useI18n } from '../context/I18nProvider';

interface ProfileStats {
  articles: number;
  followers: number;
  following: number;
}

export default function ProfilePage() {
  const router = useRouter();
  const { theme: { colors } } = useTheme();
  const { t } = useI18n();
  const { user, isLoading: authLoading } = useAuthState();
  const [likedArticles, setLikedArticles] = useState<Article[]>([]);
  const [savedCount, setSavedCount] = useState(0);
  const [stats, setStats] = useState<ProfileStats>({ articles: 0, followers: 0, following: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!user?.id || !user?.handle) return;
    try {
      const [likedRes, savedRes, authorRes, followersRes, followingRes] = await Promise.all([
        apiClient.getLikedArticles(1, 20),
        apiClient.getBookmarkedArticles(1, 20),
        apiClient.getArticlesByAuthor(user.handle, 1, 1),
        apiClient.getFollowers(user.id, 1, 1),
        apiClient.getFollowing(user.id, 1, 1),
      ]);
      setLikedArticles(likedRes.data);
      setSavedCount(savedRes.total);
      setStats({
        articles: authorRes.total ?? 0,
        followers: followersRes.total ?? 0,
        following: followingRes.total ?? 0,
      });
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to load profile data');
    }
  }, [user?.id, user?.handle]);

  useEffect(() => {
    let active = true;
    (async () => {
      setIsLoading(true);
      await loadData();
      if (active) setIsLoading(false);
    })();
    return () => {
      active = false;
    };
    // Refresh when signed-in user changes (user switch / login-after-logout).
  }, [loadData, user?.id]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await loadData();
    } finally {
      setIsRefreshing(false);
    }
  }, [loadData]);

  const statsDisplay = [
    { label: t('profile.articles'), value: stats.articles },
    { label: t('profile.followers'), value: stats.followers },
    { label: t('profile.following'), value: stats.following },
  ];

  if (authLoading || (isLoading && !error)) {
    return (
      <ScrollView style={{ backgroundColor: colors.background, flex: 1 }}>
        <View style={{ padding: 40, alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={{ marginTop: 12, color: colors.textMuted }}>Loading profile...</Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={{ backgroundColor: colors.background, flex: 1 }}
        contentContainerStyle={{ paddingBottom: 140 }}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
      >
        {error ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <Text style={{ color: colors.danger, fontSize: 16 }}>{error}</Text>
            <TouchableOpacity
              onPress={() => {
                setError(null);
                loadData();
              }}
              style={{ marginTop: 16 }}
            >
              <Text style={{ color: colors.accent, fontWeight: '600' }}>{t('common.retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 24, paddingVertical: 24, alignItems: 'center' }}>
            <Avatar
              uri={user?.avatar}
              name={user?.name}
              handle={user?.handle}
              size={96}
              style={{ borderWidth: 2, borderColor: colors.accent }}
              containerStyle={{ borderWidth: 2, borderColor: colors.accent }}
            />
            <Text
              style={{
                fontSize: 32,
                fontFamily: 'Georgia',
                fontStyle: 'italic',
                marginTop: 16,
                color: colors.textPrimary,
              }}
            >
              {user?.name || 'Guest'}
            </Text>
            <Text
              style={{
                fontSize: 11,
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: 1,
                color: colors.textMuted,
                marginTop: 4,
              }}
            >
              {user?.handle ? `@${user.handle.replace(/^@/, '')}` : '@guest'}
            </Text>
            <Text
              style={{
                fontSize: 14,
                color: colors.textMuted,
                marginTop: 12,
                textAlign: 'center',
                maxWidth: 280,
              }}
            >
              {user?.bio || 'Reader. Occasional writer.'}
            </Text>

            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-around',
                width: '100%',
                marginTop: 24,
                paddingVertical: 16,
                borderTopWidth: 1,
                borderBottomWidth: 1,
                borderColor: colors.border,
              }}
            >
              {statsDisplay.map((s) => (
                <View key={s.label} style={{ alignItems: 'center' }}>
                  <Text
                    style={{
                      fontSize: 24,
                      fontFamily: 'Georgia',
                      fontStyle: 'italic',
                      color: colors.textPrimary,
                    }}
                  >
                    {s.value}
                  </Text>
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: '600',
                      textTransform: 'uppercase',
                      letterSpacing: 1,
                      color: colors.textMuted,
                      marginTop: 2,
                    }}
                  >
                    {s.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {!error && (
          <View style={{ paddingHorizontal: 24 }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <Text
                style={{
                  fontSize: 20,
                  fontFamily: 'Georgia',
                  fontStyle: 'italic',
                  color: colors.textPrimary,
                }}
              >
                Recently liked
              </Text>
              <Link href="/saved" asChild>
                <TouchableOpacity>
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: '600',
                      color: colors.danger,
                      textTransform: 'uppercase',
                      letterSpacing: 1,
                    }}
                  >
                    Saved ({savedCount})
                  </Text>
                </TouchableOpacity>
              </Link>
            </View>

            {likedArticles.length === 0 ? (
              <Text style={{ fontSize: 14, color: colors.textMuted }}>
                Nothing liked yet — tap the heart on a story to see it here.
              </Text>
            ) : (
              <View style={{ gap: 24 }}>
                {likedArticles.map((a) => (
                  <Link key={a.slug} href={`/article/${a.slug}`} asChild>
                    <TouchableOpacity style={{ flexDirection: 'row', gap: 16 }}>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontSize: 9,
                            fontWeight: '600',
                            color: colors.accent,
                            textTransform: 'uppercase',
                            letterSpacing: 1,
                          }}
                        >
                          {a.category?.name}
                        </Text>
                        <Text
                          style={{
                            fontSize: 16,
                            fontWeight: '500',
                            color: colors.textPrimary,
                            marginTop: 4,
                          }}
                        >
                          {a.title}
                        </Text>
                        <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>
                          {a.author?.name}
                        </Text>
                      </View>
                      <Image
                        source={{ uri: a.cover || 'https://via.placeholder.com/64' }}
                        style={{ width: 64, height: 64, borderRadius: 8 }}
                      />
                    </TouchableOpacity>
                  </Link>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Floating Action Button: Edit profile on Profile tab (not Compose),
          positioned ABOVE the tab bar (~64-72px) and above keyboard-inset. */}
      <TouchableOpacity
        onPress={() => router.push('/compose')}
        accessibilityLabel={t('profile.editProfile')}
        style={{
          position: 'absolute',
          right: 24,
          bottom: 88,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: '#ff6b6b',
          justifyContent: 'center',
          alignItems: 'center',
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.2,
          shadowRadius: 8,
          elevation: 6,
        }}
      >
        <Pencil size={20} color="#ffffff" />
      </TouchableOpacity>
    </View>
  );
}
