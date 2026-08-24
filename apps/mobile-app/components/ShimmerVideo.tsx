import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';
import { useVideoPlayer, VideoView } from 'expo-video';
import { VideoOff } from 'lucide-react-native';

interface ShimmerVideoProps {
  source?: string;
  style?: any;
  borderRadius?: number;
  showErrorState?: boolean;
  aspectRatio?: number;
  isMuted?: boolean;
  loop?: boolean;
  autoPlay?: boolean;
}

export default function ShimmerVideo({
  source,
  style,
  borderRadius = 0,
  showErrorState = true,
  aspectRatio,
  isMuted = false,
  loop = true,
  autoPlay = false,
}: ShimmerVideoProps) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const progress = useSharedValue(0);

  const player = useVideoPlayer(
    source ? { uri: source } : null,
    (playerRef) => {
      if (playerRef) {
        playerRef.loop = loop;
        playerRef.muted = isMuted;
        if (autoPlay) {
          playerRef.play();
        }
        // expo-video 3.0: no `VideoView.onReadyForDisplay`; signal readiness via listeners + timeout.
        const t = setTimeout(() => setStatus('loaded'), 800);
        try {
          const anyPlayer = playerRef as any;
          let cleaned = false;
          const unsub = anyPlayer.addListener?.({
            playbackStateChange: () => { if (!cleaned) { setStatus('loaded'); cleanUp(); } },
            statusChange: () => { if (!cleaned) { setStatus('loaded'); cleanUp(); } },
          });
          function cleanUp() {
            if (cleaned) return;
            cleaned = true;
            clearTimeout(t);
            if (typeof unsub === 'function') unsub();
          }
          if (typeof unsub === 'function') return cleanUp;
        } catch {
          /* listener API varies across expo-video versions */
        }
      }
    }
  );

  useEffect(() => {
    if (status === 'loading') {
      progress.value = withRepeat(
        withTiming(1, { duration: 1500 }),
        -1,
        false
      );
    }
  }, [status, progress]);

  useEffect(() => {
    setStatus('loading');
  }, [source]);

  const animatedShimmerStyle = useAnimatedStyle(() => {
    const backgroundColor = interpolateColor(
      progress.value,
      [0, 0.5, 1],
      ['#1a1a1a', '#2a2a2a', '#1a1a1a']
    );
    return { backgroundColor };
  });

  const handleLoaded = () => {
    setStatus('loaded');
  };

  const handleError = () => {
    setStatus('error');
  };

  const containerStyle = [
    styles.container,
    { borderRadius },
    aspectRatio ? { aspectRatio } : null,
    style,
  ];

  return (
    <View style={containerStyle}>
      {status === 'loading' && (
        <Animated.View
          style={[styles.shimmer, { borderRadius }, animatedShimmerStyle]}
        />
      )}

      {status === 'error' && showErrorState && (
        <View style={[styles.errorContainer, { borderRadius }]}>
          <VideoOff size={32} color="#666" />
        </View>
      )}

      {source && player && (
        <VideoView
          player={player}
          style={[
            styles.video,
            { borderRadius, opacity: status === 'loaded' ? 1 : 0 },
          ]}
          contentFit="cover"
          nativeControls={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
  },
  shimmer: {
    ...StyleSheet.absoluteFillObject,
  },
  video: {
    ...StyleSheet.absoluteFillObject,
  },
  errorContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
});
