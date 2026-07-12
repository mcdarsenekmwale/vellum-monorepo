import { View, Text, Image, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Heart, MessageCircle, UserPlus, Bookmark } from 'lucide-react-native';
import { useNotifications, useArticles } from '../hooks/useApi';
import { apiClient } from '../lib/api';
import { useMemo } from 'react';
import type { Notification } from '@vellum/api-client/types';

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = Date.now();
  const diff = now - date.getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return date.toLocaleDateString();
}

export default function NotificationsPage() {
  const router = useRouter();
  const { data: notificationsData, isLoading, error, refetch } = useNotifications(1, 20);
  const { data: articlesData } = useArticles(1, 50);

  const items = notificationsData?.data || [];
  const articles = articlesData?.data || [];

  const articleMap = useMemo(() => {
    const map = new Map<string, any>();
    articles.forEach((a) => map.set(a.slug, a));
    return map;
  }, [articles]);

  const unreadCount = items.filter((a) => !a.read).length;

  const markAllRead = async () => {
    try {
      await apiClient.markNotificationsRead();
      refetch();
    } catch (err) {
      console.error('Failed to mark notifications read:', err);
    }
  };

  const iconFor = (kind: Notification['kind']) => {
    switch (kind) {
      case 'LIKE': return Heart;
      case 'COMMENT':
      case 'REPLY': return MessageCircle;
      case 'FOLLOW': return UserPlus;
      case 'BOOKMARK': return Bookmark;
      default: return Heart;
    }
  };

  const verbFor = (kind: Notification['kind']) => {
    switch (kind) {
      case 'LIKE': return 'liked your story';
      case 'COMMENT': return 'commented on your story';
      case 'REPLY': return 'replied to you';
      case 'FOLLOW': return 'started following you';
      case 'BOOKMARK': return 'saved your story';
      default: return 'interacted with you';
    }
  };

  if (isLoading) {
    return (
      <ScrollView style={styles.container}>
        <View style={{ padding: 40, alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#000000" />
          <Text style={{ marginTop: 12, color: '#666666' }}>Loading notifications...</Text>
        </View>
      </ScrollView>
    );
  }

  if (error) {
    return (
      <ScrollView style={styles.container}>
        <View style={{ padding: 40, alignItems: 'center' }}>
          <Text style={{ color: '#e11d48', fontSize: 16 }}>Failed to load notifications</Text>
          <TouchableOpacity onPress={refetch} style={{ marginTop: 16 }}>
            <Text style={{ color: '#d4653a', fontWeight: '600' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Subtitle Header */}
      <View style={styles.subtitleRow}>
        <Text style={styles.subtitle}>
          {unreadCount} NEW · THIS WEEK
        </Text>
        <TouchableOpacity onPress={markAllRead} activeOpacity={0.7}>
          <Text style={styles.markAllRead}>MARK ALL READ</Text>
        </TouchableOpacity>
      </View>

      {/* Notification List */}
      <View style={styles.listContainer}>
        {items.map((n) => {
          const actor = n.actor;
          const article = n.articleSlug ? articleMap.get(n.articleSlug) : null;
          const Icon = iconFor(n.kind);

          return (
            <TouchableOpacity
              key={n.id}
              onPress={() => {
                if (article) {
                  router.push(`/article/${article.slug}`);
                } else if (actor) {
                  router.push(`/author/${actor.id}`);
                }
              }}
              style={styles.notificationItem}
              activeOpacity={0.7}
            >
              {/* Avatar with action icon */}
              <View style={styles.avatarWrapper}>
                <Image source={{ uri: actor?.avatar || 'https://via.placeholder.com/48' }} style={styles.avatar} />
                <View style={styles.actionIcon}>
                  <Icon
                    size={11}
                    color={n.kind === 'LIKE' ? '#d4653a' : '#666666'}
                    fill={n.kind === 'LIKE' ? '#d4653a' : 'none'}
                    strokeWidth={2}
                  />
                </View>
              </View>

              {/* Content */}
              <View style={styles.content}>
                <Text style={styles.message} numberOfLines={3}>
                  <Text style={styles.actorName}>{actor?.name || 'Someone'}</Text>
                  <Text style={styles.verb}> {verbFor(n.kind)}</Text>
                  {article && (
                    <Text style={styles.articleTitle}> "{article.title}"</Text>
                  )}
                </Text>
                {n.body && (
                  <Text style={styles.replyPreview} numberOfLines={1}>
                    "{n.body}"
                  </Text>
                )}
                <Text style={styles.timeAgo}>{formatRelativeTime(n.createdAt)}</Text>
              </View>

              {/* Article thumbnail */}
              {article && (
                <Image source={{ uri: article.cover || 'https://via.placeholder.com/56' }} style={styles.thumbnail} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f7f4ee',
    flex: 1,
  },
  subtitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
  },
  subtitle: {
    fontSize: 10,
    fontWeight: '500',
    color: '#666666',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  markAllRead: {
    fontSize: 10,
    fontWeight: '700',
    color: '#d4653a',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  listContainer: {
    paddingBottom: 100,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e8e4de',
  },
  avatarWrapper: {
    position: 'relative',
    marginTop: 2,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  actionIcon: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e5e0d8',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  content: {
    flex: 1,
    paddingTop: 2,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    color: '#333333',
  },
  actorName: {
    fontWeight: '700',
    color: '#000000',
  },
  verb: {
    color: '#666666',
  },
  articleTitle: {
    color: '#333333',
  },
  replyPreview: {
    fontSize: 13,
    color: '#999999',
    fontStyle: 'italic',
    marginTop: 6,
    lineHeight: 18,
  },
  timeAgo: {
    fontSize: 11,
    fontWeight: '500',
    color: '#999999',
    marginTop: 6,
    textTransform: 'uppercase',
  },
  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: 12,
    marginTop: 2,
  },
});
