import React, { memo, useRef, useCallback, useState, useMemo } from 'react';
import { View, StyleSheet, Dimensions, type ViewToken } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import type { Highlight } from '../../lib/api';
import HighlightCard, { type HighlightCardRef } from './HighlightCard';

const { width, height: screenHeight } = Dimensions.get('window');

interface HighlightPagerProps {
  highlights: Highlight[];
  pageHeight: number;
  isLiked: (slug: string) => boolean;
  isSaved: (slug: string) => boolean;
  toggleLike: (slug: string) => void;
  toggleBookmark: (slug: string) => void;
  commentsFor: (slug: string) => number;
  onCommentOpen: (highlightId: string) => void;
  onProfilePress: (handle: string) => void;
  onIndexChange?: (index: number) => void;
}

/**
 * Pager component using FlashList for vertical scrolling
 * Optimized for full-screen vertical paging
 */
const HighlightPager = memo(function HighlightPager({
  highlights,
  pageHeight,
  isLiked,
  isSaved,
  toggleLike,
  toggleBookmark,
  commentsFor,
  onCommentOpen,
  onProfilePress,
  onIndexChange,
}: HighlightPagerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState<Record<number, boolean>>({ 0: true });
  const listRef = useRef<React.ElementRef<typeof FlashList> | null>(null);
  const cardRefs = useRef<Record<number, HighlightCardRef | null>>({});

  // Get active, previous, and next indices
  const activeIndices = useMemo(() => {
    const indices = new Set([currentIndex]);
    if (currentIndex > 0) indices.add(currentIndex - 1);
    if (currentIndex < highlights.length - 1) indices.add(currentIndex + 1);
    return indices;
  }, [currentIndex, highlights.length]);

  // Viewability config
  const viewabilityConfig = useMemo(() => ({
    itemVisiblePercentThreshold: 60,
  }), []);

  // Handle viewable items change
  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index !== null) {
      const newIndex = viewableItems[0].index;
      if (newIndex !== currentIndex) {
        // Pause previous video
        setIsPlaying(prev => ({ ...prev, [currentIndex]: false }));
        // Play new video
        setIsPlaying(prev => ({ ...prev, [newIndex]: true }));
        setCurrentIndex(newIndex);
        onIndexChange?.(newIndex);
      }
    }
  }, [currentIndex, onIndexChange]);

  // Toggle playback for a specific index
  const togglePlayback = useCallback((index: number) => {
    setIsPlaying(prev => ({
      ...prev,
      [index]: !prev[index],
    }));
  }, []);

  // Handle double-tap like with heart burst
  const handleDoubleTapLike = useCallback((index: number, slug: string) => {
    toggleLike(slug);
    // Trigger heart burst animation on the card
    cardRefs.current[index]?.triggerHeartBurst();
  }, [toggleLike]);

  // Handle share (placeholder)
  const handleShare = useCallback(() => {
    // TODO: Implement share functionality
  }, []);

  // Handle more options (placeholder)
  const handleMore = useCallback(() => {
    // TODO: Implement more options
  }, []);

  // Render each highlight card
  const renderItem = useCallback(({ item, index }: { item: Highlight; index: number }) => {
    const isActive = index === currentIndex;
    const slug = `reel:${item.id}`;
    const liked = isLiked(slug);
    const saved = isSaved(slug);
    const likedCount = liked ? item.likesCount + 1 : item.likesCount;
    const commentCount = item.commentsCount + commentsFor(slug);

    return (
      <HighlightCard
        ref={(ref) => { cardRefs.current[index] = ref; }}
        item={item}
        index={index}
        pageHeight={pageHeight}
        isActive={isActive}
        isLiked={liked}
        isSaved={saved}
        likedCount={likedCount}
        commentCount={commentCount}
        onLike={() => toggleLike(slug)}
        onComment={() => onCommentOpen(item.id)}
        onShare={handleShare}
        onBookmark={() => toggleBookmark(slug)}
        onMore={handleMore}
        onProfilePress={() => onProfilePress(item.handle)}
        onDoubleTapLike={() => handleDoubleTapLike(index, slug)}
        onTogglePlayback={() => togglePlayback(index)}
        isPlaying={isPlaying[index] ?? false}
      />
    );
  }, [
    pageHeight,
    currentIndex,
    isLiked,
    isSaved,
    toggleLike,
    toggleBookmark,
    commentsFor,
    onCommentOpen,
    handleShare,
    handleMore,
    onProfilePress,
    handleDoubleTapLike,
    togglePlayback,
    isPlaying,
  ]);

  // Key extractor
  const keyExtractor = useCallback((item: Highlight) => item.id, []);

  return (
    <FlashList
      ref={listRef as any}
      data={highlights}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      pagingEnabled
      snapToInterval={pageHeight}
      decelerationRate="fast"
      showsVerticalScrollIndicator={false}
      onViewableItemsChanged={onViewableItemsChanged}
      viewabilityConfig={viewabilityConfig}
      removeClippedSubviews
    />
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
});

export default HighlightPager;
