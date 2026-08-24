import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  RefreshControl,
  ColorValue,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import {
  Send,
  CheckCircle2,
  Clock,
  AlertCircle,
  Users,
  MessageCircle,
  Check,
  MoreVertical,
  RefreshCw,
} from 'lucide-react-native';
import { useThemeColors } from '../context/ThemeProvider';
import { useI18n } from '../context/I18nProvider';
import { sounds } from '../services/SoundService';
import { backendApi, SupportTicketDetail, SupportTicketMessage } from '../services/BackendApi';
import { CustomHeader, ThemedBackButton } from './_layout';
import { useAuthState } from 'hooks/useApi';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAX_BUBBLE_WIDTH = SCREEN_WIDTH * 0.78;
const AVATAR_SIZE = 32;

// ─── Helpers ───

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function formatFullDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function getInitials(name: string | undefined): string {
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return '?';
  }
  return name
    .split(' ')
    .map(part => part[0])
    .filter(Boolean)
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getStatusConfig(status: string, colors: any) {
  const s = (status || '').toUpperCase();
  const configs = {
    NEW: { icon: Clock, color: colors.primary, bg: colors.primary + '22', label: 'New' },
    ASSIGNED: { icon: Users, color: colors.purple, bg: colors.purple + '22', label: 'Assigned' },
    IN_PROGRESS: { icon: AlertCircle, color: colors.warning, bg: colors.warning + '22', label: 'In Progress' },
    WAITING_ON_CUSTOMER: { icon: Clock, color: colors.amber, bg: colors.amber + '22', label: 'Waiting' },
    ESCALATED: { icon: AlertCircle, color: colors.danger, bg: colors.danger + '22', label: 'Escalated' },
    RESOLVED: { icon: CheckCircle2, color: colors.success, bg: colors.success + '22', label: 'Resolved' },
    CLOSED: { icon: Check, color: colors.textMuted, bg: colors.textMuted + '22', label: 'Closed' },
    REOPENED: { icon: RefreshCw, color: colors.primary, bg: colors.primary + '22', label: 'Reopened' },
  };
  return configs[s as keyof typeof configs] || configs.NEW;
}

const STATUS_KEY_MAP: Record<string, string> = {
  NEW: 'settings.ticketStatusNew',
  ASSIGNED: 'settings.ticketStatusAssigned',
  IN_PROGRESS: 'settings.ticketStatusInProgress',
  WAITING_ON_CUSTOMER: 'settings.ticketStatusWaitingOnCustomer',
  ESCALATED: 'settings.ticketStatusEscalated',
  RESOLVED: 'settings.ticketStatusResolved',
  CLOSED: 'settings.ticketStatusClosed',
  REOPENED: 'settings.ticketStatusReopened',
  OPEN: 'settings.ticketStatusInProgress',
};

function translatedStatus(t: (key: string) => string, raw: string): string {
  const key = STATUS_KEY_MAP[(raw || '').toUpperCase()];
  return key ? t(key) : (raw || '');
}

// ─── Avatar Component ───

function Avatar({
  uri,
  name,
  colors,
  size = AVATAR_SIZE,
  isMine = false,
}: {
  uri?: string;
  name?: string;
  colors: any;
  size?: number;
  isMine?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const initials = getInitials(name);
  const radius = size / 2;

  // No URI or image failed → show initials placeholder
  if (!uri || failed) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: isMine ? colors.primary + '22' : colors.accent + '22',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 2,
        }}
      >
        <Text
          style={{
            fontSize: size * 0.375,
            fontWeight: '700',
            color: isMine ? colors.primary : colors.accent,
          }}
        >
          {initials}
        </Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        marginBottom: 2,
        backgroundColor: colors.surfaceAlt,
      }}
      onError={() => setFailed(true)}
    />
  );
}

// ─── Components ───

function MessageBubble({ 
  message, 
  isMine, 
  isFirst, 
  isLast,
  colors,
}: { 
  message: SupportTicketMessage;
  isMine: boolean;
  isFirst: boolean;
  isLast: boolean;
  colors: any;
}) {
  const showAvatar = isLast && !isMine;
  const showTime = isLast;
  const styles = makeStyles(colors);
  const width = 5;
  
  // Support common avatar field names from your API
  const avatarUri = (message as any).authorAvatar || (message as any).avatarUrl || (message as any).authorImage;

  return (
    <View style={[
      styles.messageRow,
      isMine ? styles.messageRowRight : styles.messageRowLeft,
      isFirst && !isMine && { marginTop: 4 },
      isLast && { marginBottom: 4 },
      isMine ? { marginLeft: width} : {marginRight: width},
    ]}>
      {/* Avatar (only for received messages, last in group) */}
      {!isMine && showAvatar && (
        <Avatar uri={avatarUri} name={message.authorName} isMine={!isMine} colors={colors} />
      )}
      {!isMine && !showAvatar && (
        <View style={styles.avatarSpacer} />
      )}

      {/* Message Bubble */}
      <View style={[
        styles.bubbleWrapper,
        isMine ? styles.bubbleWrapperRight : styles.bubbleWrapperLeft,
      ]}>
        {/* Author name (for received messages) */}
        {!isMine && (
          <Text style={[styles.bubbleAuthor, { color: colors.textSecondary }]}>
            {message.authorName || 'Support'}
          </Text>
        )}
        
        <View style={[
          styles.bubble,
          {
            backgroundColor: isMine ? colors.primary : colors.surface,
            borderBottomRightRadius: isMine && isLast ? 4 : 16,
            borderBottomLeftRadius: !isMine && isLast ? 4 : 16,
          },
          isMine && { borderTopRightRadius: isFirst ? 4 : 16 },
          !isMine && { borderTopLeftRadius: isFirst ? 4 : 16 },
        ]}>
          <Text style={[
            styles.bubbleText,
            { color: isMine ? colors.inverseText : colors.textPrimary },
          ]}>
            {message.body}
          </Text>
        </View>

        {/* Timestamp */}
        {showTime && (
          <Text style={[
            styles.bubbleTime,
            { color: colors.textMuted },
            isMine && styles.bubbleTimeRight,
          ]}>
            {formatDate(message.createdAt)}
          </Text>
        )}
      </View>

      {/* Spacer for sent messages (to align right) */}
      {isMine && <View style={[styles.avatarSpacer, { width: 1 }]} />}
      {isMine && (
        <Avatar uri={avatarUri} name={message.authorName} isMine={isMine} colors={colors} />
      )}
    </View>
  );
}

function StatusBadge({ status, colors, t }: { status: string; colors: any; t: (key: string) => string }) {
  const config = getStatusConfig(status, colors);
  const StatusIcon = config.icon;
  const label = translatedStatus(t, status);
  const styles = makeStyles(colors);

  return (
    <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
      <StatusIcon size={14} color={config.color} />
      <Text style={[styles.statusBadgeText, { color: config.color }]}>
        {label}
      </Text>
    </View>
  );
}

// ─── Main Component ───

export default function HelpTicketDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, isLoading: authLoading } = useAuthState();
  const colors = useThemeColors();
  const { t } = useI18n();

  const [ticket, setTicket] = useState<SupportTicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const replyInputRef = useRef<TextInput>(null);

  // ─── Load Ticket ───
  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await backendApi.getTicket(id);
      setTicket(data);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err: any) {
      setError(err?.message || t('errors.generic'));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    load();
  }, [load]);

  // ─── Send Reply ───
  const sendReply = useCallback(async () => {
    const body = reply.trim();
    if (!body || !id || sending) return;
    setSending(true);
    sounds().play('tap');
    try {
      const msg = await backendApi.replyToTicket(id, { body });
      setTicket((prev) =>
        prev
          ? { ...prev, messages: [...(prev.messages || []), msg] }
          : prev
      );
      setReply('');
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
        replyInputRef.current?.blur();
      }, 50);
    } catch (err: any) {
      alert(err?.message || t('errors.generic'));
    } finally {
      setSending(false);
    }
  }, [reply, id, sending, t]);

  // ─── Refresh ───
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // ─── Styles ───
  const styles = useMemo(() => makeStyles(colors), [colors]);

  // ─── Loading State ───
  if (loading || authLoading) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
        <CustomHeader title={t('settings.ticketDetailTitle')} edges={['right', 'left']} left={<ThemedBackButton />} />
        <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            {t('settings.ticketDetailLoading')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Error State ───
  if (error) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
        <CustomHeader title={t('settings.ticketDetailTitle')} edges={['right', 'left']} left={<ThemedBackButton />} />
        <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
          <AlertCircle size={48} color={colors.danger} />
          <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
          <TouchableOpacity
            style={[styles.retryBtn, { backgroundColor: colors.primary }]}
            onPress={() => {
              sounds().play('tap');
              load();
            }}
          >
            <Text style={[styles.retryBtnText, { color: colors.inverseText }]}>
              {t('common.retry')}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ─── No Ticket ───
  if (!ticket) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
        <CustomHeader title={t('settings.ticketDetailTitle')} edges={['right', 'left']} left={<ThemedBackButton />} />
        <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
          <MessageCircle size={48} color={colors.textMuted} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            {t('settings.ticketDetailNotFound')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const messages = ticket.messages || [];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      <CustomHeader 
        title={t('settings.ticketDetailTitle')} 
        edges={['right', 'left']} 
        left={<ThemedBackButton />}
        right={
          <TouchableOpacity
            onPress={() => setShowActions(!showActions)}
            style={styles.headerAction}
          >
            <MoreVertical size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        }
      />

      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.background }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.container}>
          {/* Ticket Header */}
          <View style={[styles.ticketHeader, { backgroundColor: colors.surface, borderBottomColor: colors.separator }]}>
            <View style={styles.ticketHeaderTop}>
              <Text style={[styles.ticketNumber, { color: colors.textMuted }]}>
                #{ticket.ticketNumber || ticket.id.slice(0, 8) || ''}
              </Text>
              <StatusBadge status={ticket.status} colors={colors} t={t} />
            </View>
            <Text style={[styles.ticketSubject, { color: colors.textPrimary }]}>
              {ticket.subject}
            </Text>
            {!!(ticket.message || ticket.description) && (
              <Text style={[styles.ticketDescription, { color: colors.textSecondary }]}>
                {ticket.message || ticket.description}
              </Text>
            )}
            <View style={styles.ticketMeta}>
              <Text style={[styles.ticketMetaText, { color: colors.textMuted }]}>
                {t('settings.ticketDetailCreatedAt')}: {formatFullDate(ticket.createdAt)}
              </Text>
            </View>
          </View>

          {/* Messages */}
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.messagesContainer}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => {
              scrollRef.current?.scrollToEnd({ animated: true });
            }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                colors={[colors.primary as ColorValue, colors.inverseText as ColorValue]}
                tintColor={colors.primary}
              />
            }
          >
            {messages.length === 0 ? (
              <View style={styles.emptyMessages}>
                <MessageCircle size={32} color={colors.textMuted} />
                <Text style={[styles.emptyMessagesText, { color: colors.textSecondary }]}>
                  {t('settings.ticketDetailNoMessages')}
                </Text>
              </View>
            ) : (
              messages.map((msg, idx) => {

                const isMine = msg.isFromCustomer || msg.authorName === user?.name || false;
                const isFirst = idx === 0 || messages[idx - 1].authorName !== msg.authorName;
                const isLast = idx === messages.length - 1 || messages[idx + 1].authorName !== msg.authorName;
                
                return (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    isMine={isMine}
                    isFirst={isFirst}
                    isLast={isLast}
                    colors={colors}
                  />
                );
              })
            )}
          </ScrollView>

          {/* Reply Bar */}
          <View style={[styles.replyBar, { 
            backgroundColor: colors.surface, 
            borderTopColor: colors.separator 
          }]}>
            <View style={[styles.replyInputContainer, { 
              backgroundColor: colors.surfaceAlt,
              borderColor: colors.border,
            }]}>
              <TextInput
                ref={replyInputRef}
                style={[styles.replyInput, { color: colors.textPrimary }]}
                placeholder={t('settings.replyPlaceholder')}
                placeholderTextColor={colors.textMuted}
                value={reply}
                onChangeText={setReply}
                multiline
                autoCorrect
                editable={!sending}
                maxLength={5000}
              />
              <TouchableOpacity
                style={[
                  styles.sendBtn,
                  { 
                    backgroundColor: !reply.trim() || sending ? colors.border : colors.primary,
                  },
                ]}
                activeOpacity={0.8}
                disabled={!reply.trim() || sending}
                onPress={sendReply}
              >
                {sending ? (
                  <ActivityIndicator color={colors.inverseText} size="small" />
                ) : (
                  <Send size={18} color={!reply.trim() ? colors.textMuted : colors.inverseText} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───
function makeStyles(colors: any) {
  return StyleSheet.create({
    safeArea: { flex: 1 },
    container: { flex: 1 },
    centerContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
      gap: 16,
    },
    loadingText: { fontSize: 14, fontWeight: '400', marginTop: 8 },
    errorText: { fontSize: 14, fontWeight: '500', textAlign: 'center' },
    emptyText: { fontSize: 14, fontWeight: '400', textAlign: 'center' },
    retryBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
    retryBtnText: { fontSize: 14, fontWeight: '600' },
    headerAction: {
      padding: 8,
      borderRadius: 20,
    },
    ticketHeader: {
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      gap: 8,
    },
    ticketHeaderTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    ticketNumber: {
      fontSize: 12,
      fontWeight: '500',
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    ticketSubject: {
      fontSize: 16,
      fontWeight: '600',
      fontFamily: Platform.OS === 'ios' ? 'poppins' : 'serif',
    },
    ticketDescription: {
      fontSize: 13,
      lineHeight: 20,
      marginTop: 2,
    },
    ticketMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    ticketMetaText: {
      fontSize: 12,
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 20,
    },
    statusBadgeText: {
      fontSize: 12,
      fontWeight: '600',
    },
    messagesContainer: {
      paddingHorizontal: 12,
      paddingVertical: 16,
      gap: 4,
    },
    messageRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 8,
    },
    messageRowLeft: {
      justifyContent: 'flex-start',
    },
    messageRowRight: {
      justifyContent: 'flex-end',
    },
    avatarSpacer: {
      width: AVATAR_SIZE,
    },
    bubbleWrapper: {
      maxWidth: MAX_BUBBLE_WIDTH,
    },
    bubbleWrapperLeft: {
      alignItems: 'flex-start',
    },
    bubbleWrapperRight: {
      alignItems: 'flex-end',
    },
    bubbleAuthor: {
      fontSize: 11,
      fontWeight: '600',
      marginBottom: 2,
      marginLeft: 4,
    },
    bubble: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 0.5 },
      shadowOpacity: 0.05,
      shadowRadius: 1,
      elevation: 0.5,
    },
    bubbleText: {
      fontSize: 14,
      lineHeight: 22,
    },
    bubbleTime: {
      fontSize: 10,
      marginTop: 4,
      marginHorizontal: 4,
    },
    bubbleTimeRight: {
      alignSelf: 'flex-end',
    },
    emptyMessages: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 48,
      gap: 12,
    },
    emptyMessagesText: {
      fontSize: 14,
      fontWeight: '400',
    },
    replyBar: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderTopWidth: 1,
    },
    replyInputContainer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      borderRadius: 24,
      borderWidth: 1,
      paddingRight: 6,
    },
    replyInput: {
      flex: 1,
      minHeight: 40,
      maxHeight: 120,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 15,
      textAlignVertical: 'center',
    },
    sendBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 2,
    },
  });
}