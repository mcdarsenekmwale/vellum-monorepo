import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { PlusSquare } from 'lucide-react-native';

interface HighlightFooterProps {
  title?: string;
  onCreatePress?: () => void;
}

/**
 * Top header for Highlights screen
 */
const HighlightFooter = memo(function HighlightFooter({
  title = 'Highlights',
  onCreatePress,
}: HighlightFooterProps) {
  return (
    <View style={styles.container} pointerEvents="box-none">
      <Text style={styles.title}>{title}</Text>
      <TouchableOpacity
        style={styles.createButton}
        onPress={onCreatePress}
        activeOpacity={0.7}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <PlusSquare size={24} color="#ffffff" strokeWidth={1.8} />
      </TouchableOpacity>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 56,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  title: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  createButton: {
    padding: 6,
  },
});

export default HighlightFooter;