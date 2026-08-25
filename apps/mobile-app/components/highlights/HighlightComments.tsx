import React, { memo, useRef, useMemo, useCallback, forwardRef, useImperativeHandle, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Keyboard, Platform } from 'react-native';
import { Avatar } from '../Avatar';
import BottomSheet, { BottomSheetBackdrop, BottomSheetFlatList, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { X, Heart } from 'lucide-react-native';
import type { Comment } from '@vellbase/api-client/types';

interface HighlightCommentsProps {
  highlightId: string | null;
  visible: boolean;
  onClose: () => void;
  comments: Comment[];
  onAddComment: (body: string) => void;
  currentUserAvatar?: string | null;
  currentUserName?: string | null;
  currentUserHandle?: string | null;
}

export interface HighlightCommentsRef {
  open: () => void;
  close: () => void;
}

/**
 * Comments bottom sheet using @gorhom/bottom-sheet
 */
const HighlightComments = memo(forwardRef<HighlightCommentsRef, HighlightCommentsProps>(function HighlightComments(
  { highlightId, visible, onClose, comments, onAddComment, currentUserAvatar, currentUserName, currentUserHandle },
  ref
) {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const [commentText, setCommentText] = useState('');

  // Snap points for bottom sheet
  const snapPoints = useMemo(() => ['65%', '90%'], []);

  // Handle open/close
  const openSheet = useCallback(() => {
    bottomSheetRef.current?.expand();
  }, []);

  const closeSheet = useCallback(() => {
    bottomSheetRef.current?.close();
    Keyboard.dismiss();
  }, []);

  useImperativeHandle(ref, () => ({
    open: openSheet,
    close: closeSheet,
  }));

  // Control visibility
  React.useEffect(() => {
    if (visible) {
      openSheet();
    } else {
      closeSheet();
    }
  }, [visible, openSheet, closeSheet]);

  // Handle send comment
  const handleSend = useCallback(() => {
    const body = commentText.trim();
    if (!body) return;
    onAddComment(body);
    setCommentText('');
  }, [commentText, onAddComment]);

  // Render backdrop
  const renderBackdrop = useCallback((props: any) => (
    <BottomSheetBackdrop
      {...props}
      disappearsOnIndex={-1}
      appearsOnIndex={0}
      opacity={0.5}
      pressBehavior="close"
    />
  ), []);

  // Render comment item
  const renderCommentItem = useCallback(({ item }: { item: Comment }) => (
    <View style={styles.commentItem}>
      <Avatar uri={item.author?.avatar} name={item.author?.name} handle={item.author?.handle} size={32} style={styles.commentAvatar} />
      <View style={styles.commentBody}>
        <Text style={styles.commentAuthor}>
          {item.author?.name || 'Unknown'} <Text style={styles.commentTime}>· {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'now'}</Text>
        </Text>
        <Text style={styles.commentText}>{item.body}</Text>
        <View style={styles.commentActions}>
          <TouchableOpacity hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Heart size={12} color="#999999" />
          </TouchableOpacity>
          <TouchableOpacity hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Text style={styles.commentReply}>Reply</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  ), []);

  // Empty component
  const ListEmptyComponent = useCallback(() => (
    <View style={styles.emptyComments}>
      <Text style={styles.emptyCommentsText}>No comments yet.</Text>
      <Text style={styles.emptyCommentsSub}>Start the conversation.</Text>
    </View>
  ), []);

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={-1}
      snapPoints={snapPoints}
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      enablePanDownToClose
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      style={styles.sheet}
      handleIndicatorStyle={styles.sheetHandle}
      backgroundStyle={styles.sheetBackground}
    >
      {/* Header */}
      <View style={styles.sheetHeader}>
        <Text style={styles.sheetTitle}>Comments</Text>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <X size={22} color="#000000" />
        </TouchableOpacity>
      </View>

      <View style={styles.sheetDivider} />

      {/* Comments list */}
      <BottomSheetFlatList
        data={comments}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.commentsList}
        renderItem={renderCommentItem}
        ListEmptyComponent={ListEmptyComponent}
        // @ts-expect-error: react-native-reanimated Destructor type incompatibility across native libs (pre-existing)
        focusHook={React.useEffect}
      />

      {/* Comment input */}
      <View style={styles.composer}>
        <Avatar uri={currentUserAvatar} name={currentUserName} handle={currentUserHandle} size={28} style={styles.composerAvatar} />
        <BottomSheetTextInput
          value={commentText}
          onChangeText={setCommentText}
          placeholder="Add a comment..."
          placeholderTextColor="#999999"
          style={styles.composerInput}
          multiline
          maxLength={500}
        />
        {commentText.trim().length > 0 && (
          <TouchableOpacity onPress={handleSend} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.composerSend}>Post</Text>
          </TouchableOpacity>
        )}
      </View>
    </BottomSheet>
  );
}));

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: 0,
  },
  sheetBackground: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#d4d4d4',
    borderRadius: 2,
    marginTop: 10,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
  },
  sheetDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#e5e5e5',
  },
  commentsList: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  commentItem: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 10,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  commentBody: {
    flex: 1,
  },
  commentAuthor: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000000',
  },
  commentTime: {
    color: '#999999',
    fontWeight: '400',
    fontSize: 12,
  },
  commentText: {
    fontSize: 14,
    color: '#0a0a0a',
    marginTop: 4,
    lineHeight: 20,
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  commentReply: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999999',
  },
  emptyComments: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyCommentsText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
  },
  emptyCommentsSub: {
    fontSize: 14,
    color: '#999999',
    marginTop: 4,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e5e5',
    backgroundColor: '#ffffff',
  },
  composerAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  composerInput: {
    flex: 1,
    fontSize: 14,
    color: '#000000',
    minHeight: 28,
    maxHeight: 80,
    paddingVertical: 0,
    ...Platform.select({
      ios: {
        paddingVertical: 6,
      },
    }),
  },
  composerSend: {
    color: '#0095f6',
    fontSize: 14,
    fontWeight: '700',
  },
});

export default HighlightComments;