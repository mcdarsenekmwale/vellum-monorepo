import { useThemeColors } from "context/ThemeProvider";
import { useRef, useCallback } from "react";
import { Animated, Pressable, StyleSheet } from "react-native";

export default function CustomSwitch({
  value,
  onValueChange,
  activeColor = '#d4653a',
  inactiveColor = '#e5e0d8',
  thumbColor = '#ffffff',
  size = 'medium',
  colors,
}: {
  value: boolean;
  onValueChange: (val: boolean) => void;
  activeColor?: string;
  inactiveColor?: string;
  thumbColor?: string;
  size?: 'small' | 'medium' | 'large';
  colors: ReturnType<typeof useThemeColors>;
}) {
  const animatedValue = useRef(new Animated.Value(value ? 1 : 0)).current;
  const styles = makeStyles(colors);

  const dimensions = {
    small: { width: 36, height: 20, thumb: 16, padding: 2 },
    medium: { width: 48, height: 28, thumb: 24, padding: 2 },
    large: { width: 56, height: 32, thumb: 28, padding: 2 },
  }[size];

  const translateX = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, dimensions.width - dimensions.thumb - dimensions.padding * 2],
  });

  const handlePress = useCallback(() => {
    const newValue = !value;
    Animated.spring(animatedValue, {
      toValue: newValue ? 1 : 0,
      useNativeDriver: true,
      friction: 8,
      tension: 40,
    }).start();
    onValueChange(newValue);
  }, [value, onValueChange, animatedValue]);

  const backgroundColor = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [inactiveColor, activeColor],
  });

  return (
    <Pressable onPress={handlePress} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
      <Animated.View
        style={[
          styles.switchTrack,
          {
            width: dimensions.width,
            height: dimensions.height,
            borderRadius: dimensions.height / 2,
            padding: dimensions.padding,
            backgroundColor,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.switchThumb,
            {
              width: dimensions.thumb,
              height: dimensions.thumb,
              borderRadius: dimensions.thumb / 2,
              backgroundColor: thumbColor,
              transform: [{ translateX }],
              shadowColor: '#000000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.15,
              shadowRadius: 3,
              elevation: 3,
            },
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}


function makeStyles(colors: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    
    /* Custom Switch */
    switchTrack: {
      justifyContent: 'center',
    },
    switchThumb: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 3,
      elevation: 3,
    },
    
  });
}