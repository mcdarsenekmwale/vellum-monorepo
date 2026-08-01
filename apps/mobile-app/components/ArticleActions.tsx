import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { Heart, Bookmark, MessageCircle, Share2 } from 'lucide-react-native';
import { Link } from 'expo-router';

interface ArticleActionsProps {
  articleSlug: string;
  isLiked: boolean;
  isBookmarked: boolean;
  isCommented?: boolean;
  likesCount: number;
  commentsCount: number;
  onLikeToggle?: (slug: string) => void;
  onBookmarkToggle?: (slug: string) => void;
  onCommentPress?: (slug: string) => void;
  size?: 'small' | 'medium' | 'large';
  showShare?: boolean;
  showCounts?: boolean;
  variant?: 'spread' | 'compact';
  tintColor?: string;
  activeTintColor?: string;
}

const SIZE_CONFIG = {
  small: {
    icon: 16,
    gap: 14,
    countSize: 11,
  },
  medium: {
    icon: 20,
    gap: 16,
    countSize: 13,
  },
  large: {
    icon: 24,
    gap: 20,
    countSize: 15,
  },
};

export function ArticleActions({
  articleSlug,
  isLiked,
  isBookmarked,
  isCommented = false,
  likesCount,
  commentsCount,
  onLikeToggle,
  onBookmarkToggle,
  onCommentPress,
  size = 'medium',
  showShare = true,
  showCounts = true,
  variant = 'spread',
  tintColor = '#0a0a0a',
  activeTintColor = '#e11d48',
}: ArticleActionsProps) {
  const config = SIZE_CONFIG[size];
  const likeScale = useRef(new Animated.Value(1)).current;
  const bookmarkScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isLiked) {
      Animated.sequence([
        Animated.timing(likeScale, { toValue: 1.3, duration: 150, useNativeDriver: true }),
        Animated.timing(likeScale, { toValue: 1, duration: 100, useNativeDriver: true }),
      ]).start();
    }
  }, [isLiked, likeScale]);

  useEffect(() => {
    if (isBookmarked) {
      Animated.sequence([
        Animated.timing(bookmarkScale, { toValue: 1.3, duration: 150, useNativeDriver: true }),
        Animated.timing(bookmarkScale, { toValue: 1, duration: 100, useNativeDriver: true }),
      ]).start();
    }
  }, [isBookmarked, bookmarkScale]);

  const handleLike = () => {
    if (onLikeToggle) {
      if (!isLiked) {
        Animated.sequence([
          Animated.timing(likeScale, { toValue: 1.35, duration: 120, useNativeDriver: true }),
          Animated.timing(likeScale, { toValue: 1, duration: 120, useNativeDriver: true }),
        ]).start();
      }
      onLikeToggle(articleSlug);
    }
  };

  const handleBookmark = () => {
    if (onBookmarkToggle) {
      if (!isBookmarked) {
        Animated.sequence([
          Animated.timing(bookmarkScale, { toValue: 1.35, duration: 120, useNativeDriver: true }),
          Animated.timing(bookmarkScale, { toValue: 1, duration: 120, useNativeDriver: true }),
        ]).start();
      }
      onBookmarkToggle(articleSlug);
    }
  };

  const handleComment = () => {
    if (onCommentPress) {
      onCommentPress(articleSlug);
    }
  };

  const likeColor = isLiked ? activeTintColor : tintColor;
  const commentColor = isCommented ? activeTintColor : tintColor;
  const bookmarkColor = isBookmarked ? activeTintColor : tintColor;

  return (
    <View style={[
      styles.container,
      variant === 'spread' && styles.containerSpread,
      { gap: config.gap }
    ]}>
      <View style={styles.leftGroup}>
        <TouchableOpacity onPress={handleLike} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Animated.View style={{ transform: [{ scale: likeScale }] }}>
            <Heart
              size={config.icon}
              color={likeColor}
              fill={isLiked ? likeColor : 'none'}
              strokeWidth={size === 'small' ? 1.8 : 2}
            />
          </Animated.View>
        </TouchableOpacity>

        {showCounts && (
          <Text style={[styles.countText, { fontSize: config.countSize, color: tintColor }]}>
            {likesCount > 0 ? likesCount.toLocaleString() : ''}
          </Text>
        )}

        {onCommentPress ? (
          <TouchableOpacity onPress={handleComment} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MessageCircle
              size={config.icon}
              color={commentColor}
              strokeWidth={size === 'small' ? 1.8 : 2}
            />
          </TouchableOpacity>
        ) : (
          <Link href={`/article/${articleSlug}`} asChild>
            <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <MessageCircle
                size={config.icon}
                color={commentColor}
                strokeWidth={size === 'small' ? 1.8 : 2}
              />
            </TouchableOpacity>
          </Link>
        )}

        {showCounts && (
          <Text style={[styles.countText, { fontSize: config.countSize, color: tintColor }]}>
            {commentsCount > 0 ? commentsCount.toLocaleString() : ''}
          </Text>
        )}
      </View>

      <View style={[styles.rightGroup, { gap: config.gap }]}>
        {showShare && (
          <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Share2 size={config.icon} color={tintColor} strokeWidth={size === 'small' ? 1.8 : 2} />
          </TouchableOpacity>
        )}

        <TouchableOpacity onPress={handleBookmark} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Animated.View style={{ transform: [{ scale: bookmarkScale }] }}>
            <Bookmark
              size={config.icon}
              color={bookmarkColor}
              fill={isBookmarked ? bookmarkColor : 'none'}
              strokeWidth={size === 'small' ? 1.8 : 2}
            />
          </Animated.View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  containerSpread: {
    justifyContent: 'space-between',
    // width: '100%',
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  countText: {
    fontWeight: '500',
    marginLeft: -4,
    minWidth: 8,
  },
});

export default ArticleActions;
