import React, { memo, useState, useEffect } from 'react';
import { View, Image, StyleSheet, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';
import { ImageOff } from 'lucide-react-native';

interface ShimmerImageProps {
  source?: string;
  style?: any;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'repeat' | 'center';
  borderRadius?: number;
  showErrorState?: boolean;
  aspectRatio?: number;
}

export default function ShimmerImage({
  source,
  style,
  resizeMode = 'cover',
  borderRadius = 0,
  showErrorState = true,
  aspectRatio,
}: ShimmerImageProps) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const progress = useSharedValue(0);

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
      ['#f0f0f0', '#e0e0e0', '#f0f0f0']
    );
    return { backgroundColor };
  });

  const handleLoad = () => {
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
          <ImageOff size={24} color="#999" />
        </View>
      )}

      {source && (
        <Image
          source={{ uri: source }}
          style={[
            styles.image,
            { borderRadius, opacity: status === 'loaded' ? 1 : 0 },
            // Web-only smooth opacity fade. Cast keeps RN typecheck happy.
            (Platform.OS === 'web'
              ? ({ transitionProperty: 'opacity', transitionDuration: '300ms' } as any)
              : null),
          ]}
          resizeMode={resizeMode}
          onLoad={handleLoad}
          onError={handleError}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  shimmer: {
    ...StyleSheet.absoluteFillObject,
  },
  image: {
    ...StyleSheet.absoluteFillObject,
  },
  errorContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
});
