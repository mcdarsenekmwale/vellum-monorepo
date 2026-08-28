import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Sparkles } from 'lucide-react-native';
import { Platform } from 'react-native';

interface AIIconHeaderProps {
  onPress: () => void;
}

const isWeb =
  Platform.OS === 'web' ||
  (typeof window !== 'undefined' &&
    typeof window.localStorage !== 'undefined');

/**
 * Top-nav AI Quick Coach icon. Renders a Sparkles (brain/AI) icon with
 * an optional amber suggestion badge, tap opens the Quick Coach sheet.
 */
export function AIIconHeader({ onPress }: AIIconHeaderProps) {
  const [hasSuggestion, setHasSuggestion] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        let v: string | null = null;
        if (isWeb && typeof window !== 'undefined') {
          v = window.localStorage.getItem('ai.suggestionPending');
        } else {
          v = await SecureStore.getItemAsync('ai.suggestionPending');
        }
        if (mounted) setHasSuggestion(v === '1');
      } catch {
        if (mounted) setHasSuggestion(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.container}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      accessibilityLabel="AI Quick Coach"
      accessibilityRole="button"
    >
      <Sparkles size={20} color="#000000" />
      {hasSuggestion ? <View style={styles.badge} /> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#e5e5e5',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#f59e0b', // amber-500
    borderWidth: 1.5,
    borderColor: '#e5e5e5',
  },
});
