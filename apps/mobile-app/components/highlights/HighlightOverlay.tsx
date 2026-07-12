import React, { memo } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  withSpring,
  interpolate,
  Extrapolate,
  Easing,
} from 'react-native-reanimated';
import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal, Music } from 'lucide-react-native';

const { width, height: screenHeight } = Dimensions.get('window');

interface HighlightOverlayProps {
  handle: string;
  authorAvatar?: string;
  description?: string;
  title: string;
  music?: string;
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
  onProfilePress: () => void;
  showFollowButton?: boolean;
  isFollowing?: boolean;
  onFollow?: () => void;
}

/**
 * Overlay component containing author info, caption, and music
 */
const HighlightOverlay = memo(function HighlightOverlay({
  handle,
  authorAvatar,
  description,
  title,
  music,
  onProfilePress,
  showFollowButton = true,
  isFollowing = false,
  onFollow,
}: Omit<HighlightOverlayProps, 'isLiked' | 'isSaved' | 'likeCount' | 'commentCount' | 'shareCount' | 'onLike' | 'onComment' | 'onShare' | 'onBookmark' | 'onMore'>) {
  // Caption expand/collapse animation
  const captionExpanded = useSharedValue(0);
  const [isCaptionExpanded, setIsCaptionExpanded] = React.useState(false);

  const handleCaptionPress = () => {
    setIsCaptionExpanded(!isCaptionExpanded);
    captionExpanded.value = withTiming(isCaptionExpanded ? 0 : 1, { duration: 200 });
  };

  const captionStyle = useAnimatedStyle(() => ({
    maxHeight: interpolate(captionExpanded.value, [0, 1], [60, 200], Extrapolate.CLAMP),
  }));

  return (
    <View style={styles.overlayContainer}>
      {/* Author info */}
      <TouchableOpacity style={styles.authorRow} onPress={onProfilePress} activeOpacity={0.7}>
        <Image
          source={{ uri: authorAvatar || '' }}
          style={styles.authorAvatar}
        />
        <Text style={styles.handleText}>{handle}</Text>
        {showFollowButton && !isFollowing && (
          <TouchableOpacity style={styles.followButton} onPress={onFollow} activeOpacity={0.8}>
            <Text style={styles.followButtonText}>Follow</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      {/* Caption */}
      {(description || title) && (
        <TouchableOpacity activeOpacity={0.9} onPress={handleCaptionPress}>
          <Animated.View style={[styles.captionContainer, captionStyle]}>
            <Text style={styles.captionText} numberOfLines={isCaptionExpanded ? undefined : 2}>
              {description || title}
            </Text>
          </Animated.View>
        </TouchableOpacity>
      )}

      {/* Music */}
      {music && (
        <View style={styles.musicRow}>
          <Music size={13} color="#ffffff" />
          <Text style={styles.musicText} numberOfLines={1}>
            {music}
          </Text>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  overlayContainer: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 72,
    gap: 10,
    zIndex: 5,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  authorAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  handleText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  followButton: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
    marginLeft: 4,
  },
  followButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  captionContainer: {
    overflow: 'hidden',
  },
  captionText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  musicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  musicText: {
    color: '#ffffff',
    fontSize: 12,
    opacity: 0.9,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});

export default HighlightOverlay;