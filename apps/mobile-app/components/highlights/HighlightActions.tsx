import React, { memo, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Avatar } from '../Avatar';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal } from 'lucide-react-native';

interface HighlightActionsProps {
  ref?: React.Ref<{ triggerHeartBurst: () => void }>;
   isLiked: boolean;
  isSaved: boolean;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
  onBookmark: () => void;
  onMore: () => void;
  authorAvatar?: string;
  authorName?: string;
  authorHandle?: string;
}

/**
 * Action buttons component with animations
 */
const HighlightActions = memo(function HighlightActions({
  ref,
  isLiked,
  isSaved,
  likeCount,
  commentCount,
  shareCount,
  onLike,
  onComment,
  onShare,
  onBookmark,
  onMore,
  authorAvatar,
  authorName,
  authorHandle,
}: HighlightActionsProps) {
  // Button scale animations
  const likeScale = useSharedValue(1);
  const bookmarkScale = useSharedValue(1);
  const commentScale = useSharedValue(1);
  const shareScale = useSharedValue(1);
  const musicRotation = useSharedValue(0);

  // Heart burst animation (for double-tap like)
  const heartBurstScale = useSharedValue(0);
  const heartBurstOpacity = useSharedValue(0);

  // Animate button press
  const animateButtonPress = (scale: { value: number }) => {
    scale.value = withSequence(
      withSpring(0.85, { damping: 15, stiffness: 300 }),
      withSpring(1, { damping: 10, stiffness: 200 })
    );
  };

  // Handle like with animation
  const handleLikePress = () => {
    animateButtonPress(likeScale);
    onLike();
  };

  // Handle bookmark with animation
  const handleBookmarkPress = () => {
    animateButtonPress(bookmarkScale);
    onBookmark();
  };

  // Handle comment with animation
  const handleCommentPress = () => {
    animateButtonPress(commentScale);
    onComment();
  };

  // Handle share with animation
  const handleSharePress = () => {
    animateButtonPress(shareScale);
    onShare();
  };

  // Animated styles
  const likeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: likeScale.value }],
  }));

  const bookmarkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: bookmarkScale.value }],
  }));

  const commentStyle = useAnimatedStyle(() => ({
    transform: [{ scale: commentScale.value }],
  }));

  const shareStyle = useAnimatedStyle(() => ({
    transform: [{ scale: shareScale.value }],
  }));

  const heartBurstStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartBurstScale.value }],
    opacity: heartBurstOpacity.value,
  }));

  // Music disc rotation
  React.useEffect(() => {
    musicRotation.value = withTiming(360, { duration: 3000, easing: Easing.linear });
  }, []);

  const musicStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${musicRotation.value % 360}deg` }],
  }));

  // Trigger heart burst animation
  const triggerHeartBurst = () => {
    heartBurstScale.value = withSequence(
      withTiming(0, { duration: 0 }),
      withSpring(1.2, { damping: 8, stiffness: 100 }),
      withDelay(800, withTiming(0, { duration: 300 }))
    );
    heartBurstOpacity.value = withSequence(
      withTiming(1, { duration: 0 }),
      withDelay(600, withTiming(0, { duration: 400 }))
    );
  };

  // Expose heart burst trigger for parent component
  const heartBurstRef = useRef<{ triggerHeartBurst: () => void } | null>(null);
  
  React.useImperativeHandle(heartBurstRef, () => ({
    triggerHeartBurst: () => triggerHeartBurst(),
  }));

  // Format count
  const formatCount = (n: number): string => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return `${n}`;
  };

  return (
    <View style={styles.actionsContainer}>
      {/* Heart burst overlay */}
      <Animated.View style={[styles.heartBurstContainer, heartBurstStyle]} pointerEvents="none">
        <Heart size={100} color="#ff3040" fill="#ff3040" />
      </Animated.View>

      {/* Like button */}
      <Animated.View style={likeStyle}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleLikePress}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Heart
            size={32}
            color={isLiked ? '#ff3040' : '#ffffff'}
            fill={isLiked ? '#ff3040' : 'transparent'}
            strokeWidth={1.8}
          />
          <Text style={styles.actionText}>{formatCount(likeCount)}</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Comment button */}
      <Animated.View style={commentStyle}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleCommentPress}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MessageCircle size={30} color="#ffffff" strokeWidth={1.8} />
          <Text style={styles.actionText}>{formatCount(commentCount)}</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Share button */}
      <Animated.View style={shareStyle}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleSharePress}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Send size={28} color="#ffffff" strokeWidth={1.8} />
          <Text style={styles.actionText}>{formatCount(shareCount)}</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Bookmark button */}
      <Animated.View style={bookmarkStyle}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleBookmarkPress}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Bookmark
            size={28}
            color="#ffffff"
            fill={isSaved ? '#ffffff' : 'transparent'}
            strokeWidth={1.8}
          />
          <Text style={styles.actionText}>{isSaved ? 'Saved' : 'Save'}</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* More button */}
      <TouchableOpacity
        style={styles.actionButton}
        onPress={onMore}
        activeOpacity={0.7}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <MoreHorizontal size={28} color="#ffffff" strokeWidth={1.8} />
      </TouchableOpacity>

      {/* Music disc */}
      {authorAvatar && (
        <Animated.View style={[styles.audioThumb, musicStyle]}>
          <Avatar
            uri={authorAvatar}
            name={authorName}
            handle={authorHandle}
            size={36}
          />
        </Animated.View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  actionsContainer: {
    position: 'absolute',
    right: 12,
    bottom: 20,
    alignItems: 'center',
    gap: 18,
    zIndex: 5,
  },
  heartBurstContainer: {
    position: 'absolute',
    top: -20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButton: {
    alignItems: 'center',
    gap: 4,
  },
  actionText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  audioThumb: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
    marginTop: 10,
    backgroundColor: '#000000',
  },
  audioThumbImage: {
    width: '100%',
    height: '100%',
  },
});

export default HighlightActions;