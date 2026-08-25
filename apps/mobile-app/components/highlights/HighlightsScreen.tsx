import React, { memo, useMemo, useCallback, useState } from 'react';
import { View, StyleSheet, StatusBar, Dimensions, Platform, ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useHighlights, useAuthState, useSocialActions } from '../../hooks/useApi';
import { apiClient } from '../../lib/api';
import type { Comment } from '@vellbase/api-client/types';
import HighlightPager from './HighlightPager';
import HighlightComments, { type HighlightCommentsRef } from './HighlightComments';
import HighlightFooter from './HighlightFooter';

const { height: screenHeight } = Dimensions.get('window');
const TAB_BAR_CONTENT_HEIGHT = Platform.OS === 'ios' ? 49 : 56;

/**
 * Main Highlights screen component
 * Integrates all highlight components with API-backed social logic
 */
const HighlightsScreen = memo(function HighlightsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuthState();
  const { toggleLike, toggleBookmark } = useSocialActions();
  const { data: highlightsData, isLoading, error, refetch } = useHighlights(1, 50);
  const [sheetHighlightId, setSheetHighlightId] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const commentsRef = React.useRef<HighlightCommentsRef>(null);

  const pageHeight = useMemo(() => {
    return screenHeight - insets.top - TAB_BAR_CONTENT_HEIGHT - insets.bottom;
  }, [insets.top, insets.bottom]);

  // Memoized highlight items
  const highlightItems = useMemo(() => {
    return highlightsData?.data || [];
  }, [highlightsData]);

  // Like state tracking (optimistic UI)
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>({});
  const [savedMap, setSavedMap] = useState<Record<string, boolean>>({});

  const handleToggleLike = useCallback(async (highlightId: string) => {
    const prev = likedMap[highlightId] || false;
    setLikedMap((m) => ({ ...m, [highlightId]: !prev }));
    try {
      const result = await toggleLike(undefined, highlightId);
      if (result !== null) {
        setLikedMap((m) => ({ ...m, [highlightId]: result as boolean }));
      }
    } catch {
      setLikedMap((m) => ({ ...m, [highlightId]: prev }));
    }
  }, [likedMap, toggleLike]);

  const handleToggleBookmark = useCallback(async (highlightId: string) => {
    const prev = savedMap[highlightId] || false;
    setSavedMap((m) => ({ ...m, [highlightId]: !prev }));
    try {
      const result = await toggleBookmark(undefined, highlightId);
      if (result !== null) {
        setSavedMap((m) => ({ ...m, [highlightId]: result as boolean }));
      }
    } catch {
      setSavedMap((m) => ({ ...m, [highlightId]: prev }));
    }
  }, [savedMap, toggleBookmark]);

  const isLiked = useCallback((id: string) => likedMap[id] || false, [likedMap]);
  const isSaved = useCallback((id: string) => savedMap[id] || false, [savedMap]);

  // Open comments sheet and fetch comments
  const openComments = useCallback(async (highlightId: string) => {
    setSheetHighlightId(highlightId);
    setCommentsLoading(true);
    try {
      const result = await apiClient.getComments(undefined, highlightId, 1, 50);
      setComments(result.data);
    } catch (err) {
      console.error('Failed to load comments:', err);
      setComments([]);
    } finally {
      setCommentsLoading(false);
    }
    commentsRef.current?.open();
  }, []);

  // Close comments sheet
  const closeComments = useCallback(() => {
    setSheetHighlightId(null);
    setComments([]);
    commentsRef.current?.close();
  }, []);

  // Add comment handler
  const handleAddComment = useCallback(async (body: string) => {
    if (!sheetHighlightId) return;
    try {
      const newComment = await apiClient.createComment({ body, highlightId: sheetHighlightId });
      setComments((prev) => [...prev, newComment]);
    } catch (err) {
      console.error('Failed to add comment:', err);
    }
  }, [sheetHighlightId]);

  // Comments count helper
  const commentsCount = useCallback((highlightId: string) => {
    return 0; // Would need backend support for comment counts per highlight
  }, []);

  // Profile navigation
  const handleProfilePress = useCallback((handle: string) => {
    // TODO: Navigate to author profile
    // router.push(`/author/${handle.replace('@', '')}`);
  }, [router]);

  // Create highlight handler
  const handleCreateHighlight = useCallback(() => {
    // TODO: Navigate to compose screen
    router.push('/compose');
  }, [router]);

  // Index change handler (for analytics/preloading)
  const handleIndexChange = useCallback((index: number) => {
    // Could be used for analytics tracking or preloading
  }, []);

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <Text style={{ color: '#ffffff', fontSize: 16, textAlign: 'center' }}>{error}</Text>
        <TouchableOpacity onPress={refetch} style={{ marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: '#ffffff', borderRadius: 20 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#000000' }}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      {/* Pager */}
      <HighlightPager
        highlights={highlightItems}
        pageHeight={pageHeight}
        isLiked={isLiked}
        isSaved={isSaved}
        toggleLike={handleToggleLike}
        toggleBookmark={handleToggleBookmark}
        commentsFor={commentsCount}
        onCommentOpen={openComments}
        onProfilePress={handleProfilePress}
        onIndexChange={handleIndexChange}
      />

      {/* Header overlay */}
      <HighlightFooter
        title="Highlights"
        onCreatePress={handleCreateHighlight}
      />

      {/* Comments bottom sheet */}
      <HighlightComments
        ref={commentsRef}
        highlightId={sheetHighlightId}
        visible={sheetHighlightId !== null}
        onClose={closeComments}
        comments={comments}
        onAddComment={handleAddComment}
        currentUserAvatar={user?.avatar}
        currentUserName={user?.name}
        currentUserHandle={user?.handle}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
});

export default HighlightsScreen;
