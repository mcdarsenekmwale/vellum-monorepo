import React, { memo, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { View, StyleSheet, Dimensions, StatusBar } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  withDelay,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Heart } from 'lucide-react-native';
import type { Highlight } from '../../lib/api';
import HighlightVideo from './HighlightVideo';
import HighlightOverlay from './HighlightOverlay';
import HighlightActions from './HighlightActions';

const { width, height: screenHeight } = Dimensions.get('window');

interface HighlightCardProps {
  item: Highlight;
  index: number;
  pageHeight: number;
  isActive: boolean;
  isLiked: boolean;
  isSaved: boolean;
  likedCount: number;
  commentCount: number;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
  onBookmark: () => void;
  onMore: () => void;
  onProfilePress: () => void;
  onDoubleTapLike?: () => void;
  onTogglePlayback?: () => void;
  isPlaying?: boolean;
  showFollowButton?: boolean;
  isFollowing?: boolean;
  onFollow?: () => void;
}

export interface HighlightCardRef {
  triggerHeartBurst: () => void;
}

/**
 * Individual highlight card with gestures and animations
 */
const HighlightCard = memo(forwardRef<HighlightCardRef, HighlightCardProps>(function HighlightCard(
  {
    item,
    index,
    pageHeight,
    isActive,
    isLiked,
    isSaved,
    likedCount,
    commentCount,
    onLike,
    onComment,
    onShare,
    onBookmark,
    onMore,
    onProfilePress,
    onDoubleTapLike,
    onTogglePlayback,
    isPlaying = true,
    showFollowButton = true,
    isFollowing = false,
    onFollow,
  },
  ref
) {
  // Heart burst animation for double-tap
  const heartScale = useSharedValue(0);
  const heartOpacity = useSharedValue(0);

  // Heart burst animation ref
  const heartBurstRef = useRef<any>(null);
  
  // Paused state for tap gesture
  const pausedOpacity = useSharedValue(isPlaying ? 0 : 0.6);

  // Trigger heart burst animation
  const triggerHeartBurst = useCallback(() => {
    heartScale.value = withSequence(
      withTiming(0, { duration: 0 }),
      withSpring(1.3, { damping: 8, stiffness: 100 }),
      withDelay(600, withTiming(0, { duration: 400 }))
    );
    heartOpacity.value = withSequence(
      withTiming(1, { duration: 0 }),
      withDelay(500, withTiming(0, { duration: 300 }))
    );
  }, []);

  // Expose triggerHeartBurst to parent
  useImperativeHandle(ref, () => ({
    triggerHeartBurst,
  }));

  // Double-tap gesture for like
  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      triggerHeartBurst();
      if (onDoubleTapLike) {
        runOnJS(onDoubleTapLike)();
      }
    });

  // Single-tap gesture for pause/play
  const singleTapGesture = Gesture.Tap()
    .numberOfTaps(1)
    .onEnd(() => {
      if (onTogglePlayback) {
        runOnJS(onTogglePlayback)();
      }
    });

  // Long-press gesture for pause
  const longPressGesture = Gesture.LongPress()
    .minDuration(300)
    .onStart(() => {
      if (onTogglePlayback) {
        runOnJS(onTogglePlayback)();
      }
    });

  // Composed gesture (single tap wins if double tap fails)
  const composedGesture = Gesture.Race(
    doubleTapGesture,
    singleTapGesture
  );

  // Heart burst animated style
  const heartStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
    opacity: heartOpacity.value,
  }));

  // Format count helper
  const formatCount = (n: number): string => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return `${n}`;
  };

  const musicText = item.music ?? `Original Audio - ${item.handle}`;

  return (
    <View style={[styles.container, { height: pageHeight }]}>
      {/* Video/Image content */}
      <HighlightVideo
        source={item.cover || ''}
        isActive={isActive}
        isPlaying={isPlaying}
        aspectRatio={item.aspectRatio ?? 9 / 16}
        showPausedIndicator={!isPlaying}
      />

      {/* Gesture container */}
      <GestureDetector gesture={composedGesture}>
        <Animated.View style={styles.gestureContainer}>
          {/* Heart burst overlay */}
          <Animated.View style={[styles.heartBurst, heartStyle]} pointerEvents="none">
            <Heart size={100} color="#ff3040" fill="#ff3040" strokeWidth={0} />
          </Animated.View>
        </Animated.View>
      </GestureDetector>

      {/* Overlay with author info */}
      <HighlightOverlay
        handle={item.handle}
        authorAvatar={item.author?.avatar ?? item.cover}
        authorName={item.author?.name}
        authorHandle={item.author?.handle ?? item.handle}
        description={item.description}
        title={item.title}
        music={musicText}
        onProfilePress={onProfilePress}
        showFollowButton={showFollowButton}
        isFollowing={isFollowing}
        onFollow={onFollow}
      />

      {/* Action buttons */}
      <HighlightActions
        ref={heartBurstRef}
        isLiked={isLiked}
        isSaved={isSaved}
        likeCount={likedCount}
        commentCount={commentCount}
        shareCount={item.shares ?? 0}
        onLike={onLike}
        onComment={onComment}
        onShare={onShare}
        onBookmark={onBookmark}
        onMore={onMore}
        authorAvatar={item.author?.avatar ?? item.cover}
        authorName={item.author?.name}
        authorHandle={item.author?.handle ?? item.handle}
      />
    </View>
  );
}));

const styles = StyleSheet.create({
  container: {
    width: '100%',
    position: 'relative',
    backgroundColor: '#000000',
  },
  gestureContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 4,
  },
  heartBurst: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -50,
    marginTop: -50,
  },
});

export default HighlightCard;
