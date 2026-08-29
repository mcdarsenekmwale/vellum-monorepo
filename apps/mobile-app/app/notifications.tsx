import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  Alert,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { useFocusEffect, useRouter } from 'expo-router';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { Check, BellRing, MessageCircleHeart } from 'lucide-react-native';

import {
  MobileActivityCard,
  type MobileActivityGroup,
} from '../components/activity/mobile-activity-card';
import { openActivitySseStream } from '../lib/use-activity-sse';
import {
  registerExpoPushToken,
  scheduleLocalActivityReminderEveryMinutes,
  fireTestLocalNotificationNow,
} from '../lib/use-expo-push-registration';
import { apiBaseUrl } from '../config/env';
import { CustomHeader } from './_layout';

const isWeb =
  Platform.OS === 'web' ||
  (typeof window !== 'undefined' &&
    typeof window.localStorage !== 'undefined' &&
    typeof window.document !== 'undefined');

const API_BASE = (() => {
  const base = (apiBaseUrl || '').replace(/\/$/, '');
  if (base) return base;
  return Platform.OS === 'android' ? 'http://10.0.2.2:3001' : 'http://127.0.0.1:3001';
})();

async function bearer(): Promise<Record<string, string>> {
  try {
    let t = '';
    if (isWeb && typeof window !== 'undefined') {
      t = window.localStorage.getItem('vellbase_access_token') || '';
    } else {
      t = (await SecureStore.getItemAsync('vellbase_access_token')) || '';
    }
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch {
    return {};
  }
}

function RightActions({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity
      style={styles.swipeAction}
      activeOpacity={0.85}
      onPress={onPress}
      accessibilityLabel="Mark as read"
    >
      <Check size={20} color="#FFFFFF" strokeWidth={2.5} />
      <Text style={styles.swipeActionLabel}>Read</Text>
    </TouchableOpacity>
  );
}

function EmptyState() {
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIconBox}>
        <MessageCircleHeart size={40} color="#0EA5E9" strokeWidth={1.5} />
      </View>
      <Text style={styles.emptyTitle}>All caught up</Text>
      <Text style={styles.emptySubtitle}>
        Likes, comments, follows and replies will appear here.
      </Text>
    </View>
  );
}

function Header({
  unread,
  onMarkAll,
  onTestLocal,
}: {
  unread: number;
  onMarkAll: () => void;
  onTestLocal: () => void;
}) {
  return (
    <View style={styles.headerRow}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <BellRing size={16} color="#0EA5E9" />
        <Text style={styles.headerSubtitle}>
          {unread > 0 ? `${unread} NEW` : 'NO NEW ACTIVITY'}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        {__DEV__ && (
          <TouchableOpacity onPress={onTestLocal} activeOpacity={0.7}>
            <Text style={styles.headerTestBtn}>TEST</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={onMarkAll}
          activeOpacity={0.7}
          disabled={unread === 0}
          style={{ opacity: unread === 0 ? 0.4 : 1 }}
        >
          <Text style={styles.markAllBtn}>MARK ALL READ</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function NotificationsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<MobileActivityGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [unread, setUnread] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const sseCloseRef = useRef<null | (() => void)>(null);

  const reload = useCallback(async (before?: string) => {
    try {
      const auth = await bearer();
      const r = await fetch(
        `${API_BASE}/api/activity/feed${before ? `?before=${encodeURIComponent(before)}` : ''}`,
        { headers: { ...auth } },
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      const next: MobileActivityGroup[] = Array.isArray(j.items) ? j.items : [];
      setItems((prev) => (before ? [...prev, ...next] : next));
      setUnread(typeof j.unread === 'number' ? j.unread : 0);
    } catch (e: any) {
      if (!before) {
        // Only surface hard errors on initial / pull-to-refresh to avoid noisy toasts during pagination
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      setLoading(true);
      reload();

      // Register Expo push token lazily when user visits notifications
      registerExpoPushToken().catch(() => {});

      // Load cadence from secure storage and schedule repeating local reminders
      const loadCadence = async () => {
        try {
          const raw = isWeb
            ? typeof window !== 'undefined'
              ? window.localStorage.getItem('activity:reminderMinutes')
              : null
            : await SecureStore.getItemAsync('activity:reminderMinutes');
          const mins = Number(raw) || 0;
          if (mins > 0) {
            scheduleLocalActivityReminderEveryMinutes(mins).catch(() => {});
          }
        } catch {
          /* ignore */
        }
      };
      loadCadence();

      // Open SSE stream for live unread & incremental updates
      openActivitySseStream({
        onEvent: (ev) => {
          if (!live) return;
          if (ev.type === 'unread' || ev.type === 'hello') {
            setUnread(ev.unread);
          }
          if (ev.type === 'activity') {
            // Brief delay then reload top of feed to pick up new row(s)
            setTimeout(() => reload(), 250);
          }
        },
        onError: () => {
          /* no-op: reconnect happens automatically on next focus remount */
        },
      })
        .then((handle) => {
          sseCloseRef.current = handle.close;
        })
        .catch(() => {});

      return () => {
        live = false;
        try {
          sseCloseRef.current?.();
        } catch {
          /* ignore */
        }
        sseCloseRef.current = null;
      };
    }, [reload]),
  );

  const markAllRead = useCallback(async () => {
    try {
      const auth = await bearer();
      const r = await fetch(`${API_BASE}/api/activity/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth },
        body: JSON.stringify({ all: true }),
      });
      if (r.ok) {
        const j = await r.json().catch(() => ({}));
        setUnread(typeof j.unread === 'number' ? j.unread : 0);
        setItems((list) => list.map((x) => ({ ...x, read: true })));
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to mark as read');
    }
  }, []);

  const markOneRead = useCallback(async (id: string) => {
    try {
      const auth = await bearer();
      await fetch(`${API_BASE}/api/activity/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth },
        body: JSON.stringify({ ids: [id] }),
      });
      setItems((list) =>
        list.map((x) => (x.id === id ? { ...x, read: true } : x)),
      );
      setUnread((u) => Math.max(0, u - 1));
    } catch {
      /* optimistic-only fallback ok */
    }
  }, []);

  const handlePressCard = useCallback(
    (item: MobileActivityGroup) => {
      if (!item.read) markOneRead(item.id);
      try {
        if (item.linkHref && item.linkHref.startsWith('/')) {
          router.push(item.linkHref as any);
          return;
        }
        if (item.articleSlug) {
          router.push(`/article/${item.articleSlug}` as any);
        } else if (item.commentId || item.highlightId) {
          // Navigate to article if slug present; else no-op to stay on feed
        }
      } catch {
        /* ignore router errors */
      }
    },
    [markOneRead, router],
  );

  const renderSwipeRow = useCallback(
    ({ item }: { item: MobileActivityGroup }) => {
      if (item.read) {
        return <MobileActivityCard item={item} onPress={() => handlePressCard(item)} />;
      }
      return (
        <Swipeable
          renderRightActions={() => <RightActions onPress={() => markOneRead(item.id)} />}
          overshootRight={false}
          friction={2}
          rightThreshold={60}
        >
          <MobileActivityCard item={item} onPress={() => handlePressCard(item)} />
        </Swipeable>
      );
    },
    [handlePressCard, markOneRead],
  );

  const handleTestLocal = useCallback(() => {
    fireTestLocalNotificationNow()
      .then((id) => {
        if (!id && Platform.OS !== 'web') {
          Alert.alert('Note', 'Could not schedule test notification. Check permissions.');
        }
      })
      .catch(() => {});
  }, []);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <CustomHeader title="Activity" />
      <Header unread={unread} onMarkAll={markAllRead} onTestLocal={handleTestLocal} />

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#0EA5E9" />
          <Text style={styles.loadingLabel}>Loading activity…</Text>
        </View>
      ) : items.length === 0 ? (
        <EmptyState />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          renderItem={renderSwipeRow}
          style={{ flex: 1, backgroundColor: '#F8FAFC' }}
          contentContainerStyle={{ paddingBottom: 120 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                reload();
              }}
              tintColor="#0EA5E9"
              colors={['#0EA5E9']}
            />
          }
          onEndReached={() => {
            const lastId = items[items.length - 1]?.id;
            if (lastId) reload(lastId).catch(() => {});
          }}
          onEndReachedThreshold={0.5}
          ItemSeparatorComponent={() => (
            <View
              style={{
                height: StyleSheet.hairlineWidth,
                backgroundColor: '#F1F5F9',
                marginLeft: 88,
              }}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: '#475569',
  },
  markAllBtn: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: '#0EA5E9',
  },
  headerTestBtn: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: '#94A3B8',
  },
  loadingWrap: {
    paddingTop: 64,
    alignItems: 'center',
    gap: 12,
  },
  loadingLabel: {
    color: '#94A3B8',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  swipeAction: {
    width: 90,
    backgroundColor: '#0EA5E9',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    gap: 4,
  },
  swipeActionLabel: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 14,
    paddingTop: 100,
  },
  emptyIconBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  emptySubtitle: {
    fontSize: 13,
    lineHeight: 20,
    color: '#64748B',
    textAlign: 'center',
  },
});
