import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetView,
  BottomSheetModalProvider,
} from '@gorhom/bottom-sheet';
import { X, Sparkles, RotateCcw, AlertCircle } from 'lucide-react-native';
import { ChatBubble } from './ChatBubble';
import { ChatInputBar } from './ChatInputBar';
import {
  ChatMessageLite,
  SSEOutput,
  getBearerToken,
  runAIChat,
} from '../../lib/aiSseClient';

export interface QuickCoachSheetRef {
  present: () => void;
  dismiss: () => void;
}

interface QuickCoachSheetProps {
  /** Called when user taps close. Optional — sheet closes itself too. */
  onDismiss?: () => void;
}

type Msg = ChatMessageLite & { id: string };

const QUICK_ACTIONS: Array<{ label: string; prompt: string }> = [
  {
    label: 'Draft caption',
    prompt: 'Write a short, engaging Instagram-style caption for my latest article.',
  },
  {
    label: 'Reply to comments',
    prompt: 'Draft 3 polite, varied reply templates for common positive and negative comments on my stories.',
  },
  {
    label: "Today's insights",
    prompt: 'Give me 3 data-backed creator insights tailored to a storyteller audience today.',
  },
  {
    label: 'Viral tags',
    prompt: 'Suggest 10 relevant, high-engagement hashtags for a new lifestyle article drop.',
  },
];

function uid() {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  );
}

const PLACEHOLDER_ASSISTANT: Msg = {
  id: 'welcome',
  role: 'assistant',
  content:
    "Hi! I'm Vell Quick Coach. Ask me anything about drafting, growing your audience, or picking today's story angle. 👇",
};

export const QuickCoachSheet = forwardRef<QuickCoachSheetRef, QuickCoachSheetProps>(
  function QuickCoachSheet(props, ref) {
    const { onDismiss } = props;

    const bottomSheetModalRef = useRef<BottomSheetModal>(null);
    const scrollRef = useRef<ScrollView>(null);

    const [messages, setMessages] = useState<Msg[]>([PLACEHOLDER_ASSISTANT]);
    const [conversationId, setConversationId] = useState<string | undefined>(undefined);
    const [isStreaming, setIsStreaming] = useState(false);
    const [errorBanner, setErrorBanner] = useState<string | null>(null);
    const [tokenLoading, setTokenLoading] = useState(false);

    const abortedRef = useRef<{ current: boolean }>({ current: false });
    const lastUserMsgRef = useRef<Msg | null>(null);

    const snapPoints = useMemo(() => ['60%', '82%'], []);

    useImperativeHandle(
      ref,
      (): QuickCoachSheetRef => ({
        present: () => {
          bottomSheetModalRef.current?.present();
        },
        dismiss: () => {
          bottomSheetModalRef.current?.dismiss();
        },
      }),
      [],
    );

    const scrollToEnd = useCallback(() => {
      // Scroll on next tick so new content layout is measured.
      setTimeout(() => {
        try {
          scrollRef.current?.scrollToEnd({ animated: true });
        } catch {
          /* ignore */
        }
      }, 16);
    }, []);

    useEffect(() => {
      scrollToEnd();
    }, [messages, isStreaming, scrollToEnd]);

    const rebuildAssistantStreamFromChunks = (
      acc: string,
      setAcc: (s: string) => void,
    ) => {
      setMessages((prev) => {
        // Find the trailing assistant message (the one being streamed).
        const copy = [...prev];
        const lastIdx = copy.length - 1;
        if (lastIdx >= 0 && copy[lastIdx].role === 'assistant') {
          copy[lastIdx] = { ...copy[lastIdx], content: acc };
        } else {
          copy.push({ id: uid(), role: 'assistant', content: acc });
        }
        setAcc(acc); // keep closure-local string in sync
        return copy;
      });
    };

    const sendMessages = useCallback(
      async (userMessage: Msg) => {
        setErrorBanner(null);
        setTokenLoading(true);

        let token: string | null = null;
        try {
          token = await getBearerToken();
        } catch {
          token = null;
        } finally {
          setTokenLoading(false);
        }

        // Prepare the messages list for the API request (exclude placeholder welcome).
        const apiMessages: ChatMessageLite[] = messages
          .filter((m) => m.id !== PLACEHOLDER_ASSISTANT.id)
          .map(({ role, content, tool_call_id }) => ({
            role,
            content,
            tool_call_id,
          }));
        apiMessages.push({ role: userMessage.role, content: userMessage.content });

        // Append the user's message + an empty assistant placeholder to UI.
        const assistantId = uid();
        setMessages((prev) => {
          const filtered =
            prev.length === 1 && prev[0].id === PLACEHOLDER_ASSISTANT.id ? [] : prev;
          return [
            ...filtered,
            userMessage,
            { id: assistantId, role: 'assistant', content: '' },
          ];
        });

        setIsStreaming(true);
        abortedRef.current = { current: false };
        lastUserMsgRef.current = userMessage;

        let accText = '';
        const setAcc = (s: string) => {
          accText = s;
        };

        try {
          const result: SSEOutput = await runAIChat({
            req: {
              conversationId,
              placement: 'mobile-nav',
              messages: apiMessages,
            },
            bearerToken: token,
            onChunk: (delta) => {
              if (abortedRef.current.current) return;
              accText += delta;
              rebuildAssistantStreamFromChunks(accText, setAcc);
            },
            aborted: abortedRef.current,
          });

          if (result.meta?.conversationId) {
            setConversationId(result.meta.conversationId);
          }

          if (result.error && !abortedRef.current.current) {
            setErrorBanner(result.error.message || 'Something went wrong. Try again.');
            // Remove the empty assistant bubble if nothing was written.
            if (!accText) {
              setMessages((prev) => prev.filter((m) => m.id !== assistantId));
            }
          } else if (abortedRef.current.current) {
            // User aborted — if assistant bubble is empty, remove it.
            if (!accText) {
              setMessages((prev) => prev.filter((m) => m.id !== assistantId));
            }
          } else {
            // Finalize: ensure content is exactly joined chunks (match data).
            if (result.chunks.length > 0) {
              const finalText = result.chunks.join('');
              if (finalText !== accText) {
                rebuildAssistantStreamFromChunks(finalText, setAcc);
              }
            }
          }
        } catch (e) {
          setErrorBanner(String((e as Error)?.message || e));
          if (!accText) {
            setMessages((prev) => prev.filter((m) => m.id !== assistantId));
          }
        } finally {
          setIsStreaming(false);
          abortedRef.current = { current: false };
        }
      },
      [messages, conversationId],
    );

    const handleSend = useCallback(
      (text: string) => {
        if (isStreaming) return;
        const userMsg: Msg = { id: uid(), role: 'user', content: text };
        void sendMessages(userMsg);
      },
      [isStreaming, sendMessages],
    );

    const handleChipPress = useCallback(
      (prompt: string) => {
        handleSend(prompt);
      },
      [handleSend],
    );

    const handleStop = useCallback(() => {
      abortedRef.current.current = true;
      // UI will de-activate streaming on the next event loop tick when
      // runAIChat notices the abort and returns.
    }, []);

    const handleRetry = useCallback(() => {
      const last = lastUserMsgRef.current;
      if (!last) return;
      void sendMessages(last);
    }, [sendMessages]);

    const handleClose = useCallback(() => {
      bottomSheetModalRef.current?.dismiss();
    }, []);

    return (
      <BottomSheetModal
        ref={bottomSheetModalRef}
        index={0}
        snapPoints={snapPoints}
        enableDismissOnClose={true}
        enablePanDownToClose={true}
        stackBehavior="push"
        onDismiss={onDismiss}
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.sheetHandle}
      >
        <BottomSheetView style={{ flex: 1 }}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerTitleGroup}>
                <View style={styles.headerIconPill}>
                  <Sparkles size={14} color="#f59e0b" />
                </View>
                <Text style={styles.headerTitle}>Vell Quick Coach</Text>
                <View style={styles.modelPill}>
                  <Text style={styles.modelPillText}>Coach · GPT-4o</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={handleClose}
                style={styles.closeButton}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                accessibilityLabel="Close Quick Coach"
              >
                <X size={20} color="#334155" />
              </TouchableOpacity>
            </View>

            {/* Error banner */}
            {errorBanner ? (
              <View style={styles.errorBanner}>
                <AlertCircle size={16} color="#b91c1c" style={{ marginTop: 1 }} />
                <Text style={styles.errorBannerText} numberOfLines={3}>
                  {errorBanner}
                </Text>
                <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
                  <RotateCcw size={14} color="#ffffff" />
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {/* Chat scroll area */}
            {Platform.OS === 'web' ? (
              <ScrollView
                ref={scrollRef as any}
                style={styles.scrollArea}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                automaticallyAdjustContentInsets={false}
              >
                {messages.map((m) => (
                  <ChatBubble
                    key={m.id}
                    role={m.role}
                    content={
                      m.role === 'assistant' && !m.content && isStreaming
                        ? '…'
                        : m.content || ' '
                    }
                  />
                ))}
                {tokenLoading && (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator size="small" color="#10b981" />
                  </View>
                )}
              </ScrollView>
            ) : (
              <BottomSheetScrollView
                ref={scrollRef as any}
                style={styles.scrollArea}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
              >
                {messages.map((m) => (
                  <ChatBubble
                    key={m.id}
                    role={m.role}
                    content={
                      m.role === 'assistant' && !m.content && isStreaming
                        ? '…'
                        : m.content || ' '
                    }
                  />
                ))}
                {tokenLoading && (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator size="small" color="#10b981" />
                  </View>
                )}
              </BottomSheetScrollView>
            )}

            {/* Quick action chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsRow}
            >
              {QUICK_ACTIONS.map((chip) => (
                <TouchableOpacity
                  key={chip.label}
                  style={styles.chip}
                  onPress={() => handleChipPress(chip.prompt)}
                  disabled={isStreaming}
                >
                  <Text
                    style={[
                      styles.chipText,
                      isStreaming ? styles.chipTextDisabled : null,
                    ]}
                  >
                    {chip.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Input bar */}
            <ChatInputBar
              onSend={handleSend}
              onStop={handleStop}
              isStreaming={isStreaming || tokenLoading}
            />
          </KeyboardAvoidingView>
        </BottomSheetView>
      </BottomSheetModal>
    );
  },
);

/**
 * Re-export of BottomSheetModalProvider from gorhom so the top-level
 * layout can wrap the app tree with a single provider.
 */
export { BottomSheetModalProvider as QuickCoachSheetProvider };

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  sheetHandle: {
    backgroundColor: '#cbd5e1',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginTop: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#cbd5e1',
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    flexWrap: 'wrap',
  },
  headerIconPill: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    letterSpacing: -0.1,
  },
  modelPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: '#e0f2fe', // sky-100
  },
  modelPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0369a1',
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#fef2f2',
    marginHorizontal: 12,
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorBannerText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 17,
    color: '#b91c1c',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#dc2626',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
  },
  loadingRow: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  chipsRow: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    flexDirection: 'row',
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    marginRight: 8,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
  },
  chipTextDisabled: {
    color: '#94a3b8',
  },
});
