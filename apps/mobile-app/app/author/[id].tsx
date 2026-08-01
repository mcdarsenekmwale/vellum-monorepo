import { View, Text, Image, TouchableOpacity, ScrollView, ActivityIndicator, Share } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect, useCallback } from 'react';
import { UserPlus, Share2 } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiClient } from '../../lib/api';
import type { User, Article } from '../../lib/api';
import { BackButton } from 'app/_layout';
import { Avatar } from '../../components/Avatar';

interface AuthorProfile extends User {
  followerCount?: number;
  followingCount?: number;
  articleCount?: number;
  isFollowing?: boolean;
}

const timeAgo = (dateStr: string) => {
  const date = new Date(dateStr);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
};

export default function AuthorPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [author, setAuthor] = useState<AuthorProfile | null>(null);
  const [authorArticles, setAuthorArticles] = useState<Article[]>([]);
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [followLoading, setFollowLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [userRes, articlesRes] = await Promise.all([
        apiClient.getUser(id),
        apiClient.getArticlesByAuthor(id),
      ]);
      setAuthor(userRes as AuthorProfile);
      setAuthorArticles(articlesRes.data || []);
      if (userRes.id) {
        try {
          const followStatus = await apiClient.isFollowing(userRes.id);
          setFollowing(followStatus.following);
        } catch {
          setFollowing(false);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load author');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleFollow = async () => {
    if (!author || followLoading) return;
    setFollowLoading(true);
    try {
      await apiClient.toggleFollow(author.id);
      setFollowing(prev => !prev);
      setAuthor(prev => prev ? {
        ...prev,
        followerCount: following
          ? (prev.followerCount || 0) - 1
          : (prev.followerCount || 0) + 1,
      } : prev);
    } catch (err) {
      console.error('Follow error:', err);
    } finally {
      setFollowLoading(false);
    }
  };

  const handleShare = async () => {
    if (!author) return;
    try {
      await Share.share({
        message: `Check out ${author.name} (@${author.handle}) on Vellum`,
      });
    } catch (err) {
      console.error('Share error:', err);
    }
  };

  const handleArticlePress = (slug: string) => {
    router.push(`/article/${slug}`);
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f7f4ee' }} edges={['top']}>
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 56,
          paddingHorizontal: 12,
        }}>
          <BackButton />
          <Text style={{
            fontFamily: 'Georgia',
            fontStyle: 'italic',
            fontSize: 20,
            color: '#000000',
          }}>
            Author
          </Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#000000" />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !author) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f7f4ee' }} edges={['top']}>
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 56,
          paddingHorizontal: 12,
        }}>
          <BackButton />
          <Text style={{
            fontFamily: 'Georgia',
            fontStyle: 'italic',
            fontSize: 20,
            color: '#000000',
          }}>
            Author
          </Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Text style={{ fontSize: 16, color: '#666666', textAlign: 'center' }}>
            {error || 'Author not found'}
          </Text>
          <TouchableOpacity
            onPress={fetchData}
            style={{
              marginTop: 16,
              paddingHorizontal: 24,
              paddingVertical: 10,
              backgroundColor: '#000000',
              borderRadius: 20,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#ffffff' }}>
              Retry
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f7f4ee' }} edges={['top']}>
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 56,
        paddingHorizontal: 12,
      }}>
        <BackButton />
        <Text style={{
          fontFamily: 'Georgia',
          fontStyle: 'italic',
          fontSize: 20,
          color: '#000000',
        }}>
          {author.name}
        </Text>
        <TouchableOpacity
          onPress={handleShare}
          style={{ padding: 8 }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Share2 size={22} color="#000000" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingHorizontal: 24, paddingVertical: 24, alignItems: 'center' }}>
          <Avatar
            uri={author.avatar}
            name={author.name}
            handle={author.handle}
            size={96}
            style={{
              borderWidth: 2,
              borderColor: '#d4653a',
            }}
          />
          <Text style={{
            fontSize: 28,
            fontFamily: 'Georgia',
            fontStyle: 'italic',
            marginTop: 16,
            color: '#000000',
          }}>
            {author.name}
          </Text>
          <Text style={{
            fontSize: 12,
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: 1,
            color: '#666666',
            marginTop: 4,
          }}>
            @{author.handle}
          </Text>
          {author.publication && (
            <Text style={{ fontSize: 12, color: '#666666', marginTop: 4 }}>
              {author.publication}
            </Text>
          )}
          {author.bio && (
            <Text style={{
              fontSize: 14,
              color: '#666666',
              marginTop: 12,
              textAlign: 'center',
              maxWidth: 280,
            }}>
              {author.bio}
            </Text>
          )}

          <TouchableOpacity
            onPress={handleFollow}
            disabled={followLoading}
            style={{
              marginTop: 20,
              paddingHorizontal: 32,
              paddingVertical: 12,
              borderRadius: 24,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              backgroundColor: following ? 'transparent' : '#000000',
              borderWidth: following ? 1.5 : 0,
              borderColor: '#000000',
              opacity: followLoading ? 0.6 : 1,
            }}
            activeOpacity={0.7}
          >
            <UserPlus size={16} color={following ? '#000000' : '#ffffff'} />
            <Text style={{
              fontSize: 14,
              fontWeight: '600',
              color: following ? '#000000' : '#ffffff',
            }}>
              {following ? 'Following' : 'Follow'}
            </Text>
          </TouchableOpacity>

          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-around',
            width: '100%',
            marginTop: 24,
            paddingVertical: 16,
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: '#e5e5e5',
          }}>
            <View style={{ alignItems: 'center' }}>
              <Text style={{
                fontSize: 24,
                fontFamily: 'Georgia',
                fontStyle: 'italic',
                color: '#000000',
              }}>
                {author.articleCount ?? authorArticles.length}
              </Text>
              <Text style={{
                fontSize: 10,
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: 1,
                color: '#666666',
                marginTop: 2,
              }}>
                Stories
              </Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{
                fontSize: 24,
                fontFamily: 'Georgia',
                fontStyle: 'italic',
                color: '#000000',
              }}>
                {author.followerCount ?? 0}
              </Text>
              <Text style={{
                fontSize: 10,
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: 1,
                color: '#666666',
                marginTop: 2,
              }}>
                Followers
              </Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{
                fontSize: 24,
                fontFamily: 'Georgia',
                fontStyle: 'italic',
                color: '#000000',
              }}>
                {author.followingCount ?? 0}
              </Text>
              <Text style={{
                fontSize: 10,
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: 1,
                color: '#666666',
                marginTop: 2,
              }}>
                Following
              </Text>
            </View>
          </View>
        </View>

        <View style={{ paddingHorizontal: 24 }}>
          <Text style={{
            fontSize: 20,
            fontFamily: 'Georgia',
            fontStyle: 'italic',
            color: '#000000',
            marginBottom: 16,
          }}>
            Latest stories
          </Text>

          {authorArticles.length === 0 ? (
            <Text style={{
              fontSize: 14,
              color: '#999999',
              fontStyle: 'italic',
              textAlign: 'center',
              paddingVertical: 24,
            }}>
              No stories yet
            </Text>
          ) : (
            <View style={{ gap: 24 }}>
              {authorArticles.map((a) => (
                <TouchableOpacity
                  key={a.slug}
                  onPress={() => handleArticlePress(a.slug)}
                  style={{ flexDirection: 'row', gap: 16 }}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{
                      fontSize: 9,
                      fontWeight: '700',
                      color: '#d4653a',
                      textTransform: 'uppercase',
                      letterSpacing: 1,
                    }}>
                      {a.category?.name || 'Article'}
                    </Text>
                    <Text style={{
                      fontSize: 16,
                      fontWeight: '500',
                      color: '#000000',
                      marginTop: 4,
                    }}>
                      {a.title}
                    </Text>
                    <Text style={{
                      fontSize: 12,
                      color: '#666666',
                      marginTop: 4,
                    }}>
                      {timeAgo(a.publishedAt || a.createdAt)} · {a.readMinutes} min · {a.likesCount?.toLocaleString() || 0} likes
                    </Text>
                  </View>
                  {a.cover && (
                    <Image
                      source={{ uri: a.cover }}
                      style={{ width: 80, height: 80, borderRadius: 8 }}
                    />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
