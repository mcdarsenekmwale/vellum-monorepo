import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Bot, User } from 'lucide-react-native';

export interface ChatBubbleProps {
  role: 'user' | 'assistant' | 'tool';
  content: string;
}

/**
 * Single chat message bubble. Assistant on the left with a Bot avatar,
 * user on the right with emerald background and white text.
 */
export function ChatBubble({ role, content }: ChatBubbleProps) {
  const isUser = role === 'user';
  const isTool = role === 'tool';

  if (isTool) {
    return (
      <View style={styles.toolWrapper}>
        <Text style={styles.toolText}>{content}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.row, isUser ? styles.rowRight : styles.rowLeft]}>
      {!isUser ? (
        <View style={styles.assistantAvatar}>
          <Bot size={14} color="#ffffff" />
        </View>
      ) : null}

      <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
        <Text
          style={[
            styles.bubbleText,
            isUser ? styles.userBubbleText : styles.assistantBubbleText,
          ]}
        >
          {content}
        </Text>
      </View>

      {isUser ? (
        <View style={styles.userAvatar}>
          <User size={14} color="#ffffff" />
        </View>
      ) : null}
    </View>
  );
}

const AVATAR_SIZE = 24;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginVertical: 4,
    maxWidth: '100%',
    gap: 6,
  },
  rowLeft: {
    justifyContent: 'flex-start',
    paddingRight: 32,
  },
  rowRight: {
    justifyContent: 'flex-end',
    paddingLeft: 32,
  },
  assistantAvatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: '#0ea5e9', // sky-500
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  userAvatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: '#10b981', // emerald-500
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
  },
  assistantBubble: {
    backgroundColor: '#f8fafc', // slate-50
    borderWidth: 1,
    borderColor: '#cbd5e1', // slate-300
    borderBottomLeftRadius: 4,
  },
  userBubble: {
    backgroundColor: '#10b981', // emerald-500
    borderBottomRightRadius: 4,
  },
  bubbleText: {
    fontSize: 14.5,
    lineHeight: 20,
  },
  assistantBubbleText: {
    color: '#0f172a', // slate-900
  },
  userBubbleText: {
    color: '#ffffff',
  },
  toolWrapper: {
    alignSelf: 'center',
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginVertical: 4,
  },
  toolText: {
    fontSize: 12,
    color: '#92400e',
    fontStyle: 'italic',
  },
});
