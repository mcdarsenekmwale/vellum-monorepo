import React, { memo, useEffect, useRef, useState } from 'react';
import { View, Image, StyleSheet, Dimensions, ActivityIndicator } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, withSequence, withDelay, withRepeat, interpolateColor } from 'react-native-reanimated';
import { Play, ImageOff } from 'lucide-react-native';

const { width } = Dimensions.get('window');

interface HighlightVideoProps {
  source: string;
  isActive: boolean;
  isPlaying: boolean;
  aspectRatio?: number;
  videoUrl?: string; // For future video support
  showPausedIndicator?: boolean;
  isMuted?: boolean;
  loop?: boolean;
}

/**
 * Video/Image component for highlight cards
 * Supports both expo-video and fallback Image display
 */
const HighlightVideo = memo(function HighlightVideo({
  source,
  isActive,
  isPlaying,
  aspectRatio = 9 / 16,
  videoUrl,
  showPausedIndicator = true,
  isMuted = false,
  loop = true,
}: HighlightVideoProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Video player setup using expo-video ~3.0 API
  const player = useVideoPlayer(
    videoUrl ? { uri: videoUrl } : null,
    (player) => {
      if (player) {
        player.loop = loop;
        player.muted = isMuted;
      }
    }
  );

  // Handle play/pause based on isPlaying state
  useEffect(() => {
    if (videoUrl && player) {
      if (isPlaying && isActive) {
        player.play();
      } else {
        player.pause();
      }
    }
  }, [isPlaying, isActive, videoUrl, player]);

  // Update muted state
  useEffect(() => {
    if (videoUrl && player) {
      player.muted = isMuted;
    }
  }, [isMuted, videoUrl, player]);

  // Paused indicator animation
  const pausedOpacity = useSharedValue(0);

  // Shimmer animation
  const shimmerProgress = useSharedValue(0);

  useEffect(() => {
    if (isLoading) {
      shimmerProgress.value = withRepeat(
        withTiming(1, { duration: 1500 }),
        -1,
        false
      );
    }
  }, [isLoading, shimmerProgress]);

  const shimmerStyle = useAnimatedStyle(() => {
    const backgroundColor = interpolateColor(
      shimmerProgress.value,
      [0, 0.5, 1],
      ['#1a1a1a', '#2a2a2a', '#1a1a1a']
    );
    return { backgroundColor };
  });

  useEffect(() => {
    if (!isPlaying && showPausedIndicator) {
      pausedOpacity.value = withSequence(
        withTiming(0.7, { duration: 200 }),
        withDelay(2000, withTiming(0, { duration: 300 }))
      );
    } else {
      pausedOpacity.value = withTiming(0, { duration: 200 });
    }
  }, [isPlaying, showPausedIndicator]);

  const pausedStyle = useAnimatedStyle(() => ({
    opacity: pausedOpacity.value,
  }));

  // Handle image load
  const handleLoad = () => {
    setIsLoading(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  const mediaStyle = StyleSheet.absoluteFill;

  return (
    <View style={styles.mediaWrapper}>
      {/* Shimmer background for loading */}
      {isLoading && (
        <Animated.View style={[styles.shimmerBackground, shimmerStyle]} />
      )}

      {/* Error state */}
      {hasError && (
        <View style={styles.errorContainer}>
          <ImageOff size={48} color="#666" />
        </View>
      )}

      {/* Main content - Video or Image fallback */}
      {videoUrl && player ? (
        <VideoView
          player={player}
          style={[styles.videoView, mediaStyle, { opacity: isLoading ? 0 : 1 }]}
          contentFit="cover"
          nativeControls={false}
          onReadyForDisplay={handleLoad}
        />
      ) : (
        <Image
          source={{ uri: source }}
          style={[styles.backgroundImage, mediaStyle, { opacity: isLoading ? 0 : 1 }]}
          resizeMode="cover"
          onLoad={handleLoad}
          onError={handleError}
        />
      )}

      {/* Gradient overlays */}
      <View style={styles.gradientTop} pointerEvents="none" />
      <View style={styles.gradientTopInner} pointerEvents="none" />
      <View style={styles.gradientBottom} pointerEvents="none" />
      <View style={styles.gradientBottomInner} pointerEvents="none" />

      {/* Paused indicator */}
      {showPausedIndicator && !videoUrl && !hasError && (
        <Animated.View style={[styles.pausedIndicator, pausedStyle]} pointerEvents="none">
          <Play size={48} color="#ffffff" fill="#ffffff" strokeWidth={1.5} />
        </Animated.View>
      )}

      {/* Buffering indicator (for video) */}
      {!isPlaying && isActive && videoUrl && !hasError && (
        <Animated.View style={[styles.bufferingIndicator, pausedStyle]} pointerEvents="none">
          <ActivityIndicator size="large" color="#ffffff" />
        </Animated.View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  mediaWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a1a',
  },
  shimmerBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  errorContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
  },
  videoView: {
    position: 'absolute',
  },
  backgroundImage: {
    position: 'absolute',
  },
  loadingContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradientTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 40,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  gradientTopInner: {
    position: 'absolute',
    top: 80,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: 'rgba(0,0,0,0.005)',
  },
  gradientBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 150,
    backgroundColor: 'rgba(0,0,0,0.26)',
  },
  gradientBottomInner: {
    position: 'absolute',
    bottom: 180,
    left: 0,
    right: 0,
    height: 0,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  pausedIndicator: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -24,
    marginTop: -24,
  },
  bufferingIndicator: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -20,
    marginTop: -20,
  },
});

export default HighlightVideo;