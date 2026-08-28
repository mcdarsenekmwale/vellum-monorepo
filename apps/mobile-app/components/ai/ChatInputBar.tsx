import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Send, Square } from 'lucide-react-native';

export interface ChatInputBarProps {
  onSend: (text: string) => void;
  onStop?: () => void;
  isStreaming: boolean;
  disabled?: boolean;
}

/**
 * Keyboard-aware chat input bar with Send/Stop toggle.
 * Must be wrapped inside a KeyboardAvoidingView parent OR sheet interior
 * that already handles keyboard — this component contributes a small
 * KeyboardAvoidingView layer for its own padding.
 */
export function ChatInputBar({
  onSend,
  onStop,
  isStreaming,
  disabled,
}: ChatInputBarProps) {
  const [text, setText] = useState('');

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;
    onSend(trimmed);
    setText('');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
    >
      <View style={styles.wrapper}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder={isStreaming ? 'AI is typing…' : 'Ask Quick Coach anything…'}
          placeholderTextColor="#64748b"
          multiline={false}
          editable={!disabled && !isStreaming}
          returnKeyType="send"
          onSubmitEditing={handleSend}
          blurOnSubmit={false}
          autoCorrect={true}
        />
        {isStreaming ? (
          <TouchableOpacity
            style={[styles.sendButton, styles.stopButton]}
            onPress={onStop}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            accessibilityLabel="Stop generating"
          >
            <Square size={16} color="#ffffff" fill="#ffffff" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!text.trim() || disabled) ? styles.sendButtonDisabled : null,
            ]}
            onPress={handleSend}
            disabled={!text.trim() || disabled}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            accessibilityLabel="Send message"
          >
            <Send size={16} color="#ffffff" />
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#cbd5e1',
    backgroundColor: '#ffffff',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    fontSize: 15,
    color: '#0f172a',
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#10b981', // emerald-500
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#94a3b8', // slate-400
  },
  stopButton: {
    backgroundColor: '#ef4444', // red-500
  },
});
