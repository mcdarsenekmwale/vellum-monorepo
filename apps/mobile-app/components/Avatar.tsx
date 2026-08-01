import React, { useMemo } from 'react';
import { View, Text, Image, ImageStyle, ViewStyle } from 'react-native';

interface AvatarProps {
  uri?: string | null;
  name?: string | null;
  handle?: string | null;
  size?: number;
  style?: ImageStyle;
  containerStyle?: ViewStyle;
}

const BG_COLORS = [
  '#d97706',
  '#0891b2',
  '#059669',
  '#7c3aed',
  '#db2777',
  '#ea580c',
  '#2563eb',
  '#16a34a',
];

function getInitials(name: string | null | undefined, handle: string | null | undefined): string {
  const source = (name && name.trim()) || (handle && handle.trim());
  if (!source) return '?';

  const trimmed = source.trim();

  if (/^[\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af]/.test(trimmed)) {
    return trimmed.charAt(0).toUpperCase();
  }

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  }

  return trimmed.charAt(0).toUpperCase();
}

function getColorIndex(text: string | null | undefined): number {
  if (!text) return 0;
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash % BG_COLORS.length;
}

export function Avatar({ uri, name, handle, size = 44, style, containerStyle }: AvatarProps) {
  const initials = useMemo(() => getInitials(name, handle), [name, handle]);
  const bgColor = useMemo(() => BG_COLORS[getColorIndex(name || handle)], [name, handle]);
  const fontSize = useMemo(() => Math.round(size * 0.38), [size]);

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[
          {
            width: size,
            height: size,
            borderRadius: size / 2,
          },
          style,
        ]}
      />
    );
  }

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bgColor,
          alignItems: 'center',
          justifyContent: 'center',
        },
        containerStyle,
      ]}
    >
      <Text
        style={{
          color: '#ffffff',
          fontSize,
          fontWeight: '600',
          letterSpacing: 0.5,
        }}
      >
        {initials}
      </Text>
    </View>
  );
}

export default Avatar;
