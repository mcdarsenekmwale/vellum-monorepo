import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Plus, ChevronRight, Clock, CheckCircle2 } from 'lucide-react-native';
import { useThemeColors } from '../context/ThemeProvider';
import { useI18n } from '../context/I18nProvider';
import { sounds } from '../services/SoundService';
import { backendApi, SupportTicketListItem } from '../services/BackendApi';
import { CustomHeader, ThemedBackButton } from './_layout';

type TabKey = 'active' | 'closed';

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function statusBadgeStyle(
  status: string,
  colors: ReturnType<typeof useThemeColors>
): { bg: string; text: string } {
  const s = (status || '').toUpperCase();
  if (s.includes('CLOSED') || s.includes('RESOLVED')) {
    return { bg: colors.textMuted + '22', text: colors.textMuted };
  }
  if (s.includes('WAITING')) {
    return { bg: colors.warning + '22', text: colors.warning };
  }
  return { bg: colors.accent + '22', text: colors.accent };
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

export default function HelpTicketsScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { t } = useI18n();

  const [tab, setTab] = useState<TabKey>('active');
  const [tickets, setTickets] = useState<SupportTicketListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch all tickets (no status filter — web API uses TicketStatus enum, not 'active'/'closed')
      const allTickets = await backendApi.listMyTickets();
      // Filter client-side: "active" = not CLOSED/RESOLVED, "closed" = CLOSED/RESOLVED
      const closedStatuses = ['CLOSED', 'RESOLVED'];
      const filtered = (allTickets || []).filter((tkt) => {
        const s = (tkt.status || '').toUpperCase();
        return tab === 'active' ? !closedStatuses.includes(s) : closedStatuses.includes(s);
      });
      setTickets(filtered);
    } catch (err: any) {
      setError(err?.message || t('errors.generic'));
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, [tab, t]);

  useEffect(() => {
    load();
  }, [load]);

  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <CustomHeader title={t('settings.ticketsTitle')} edges={['right', 'left']} left={<ThemedBackButton />} />
        <ScrollView contentContainerStyle={styles.scrollContent} style={{ flex: 1 }}>

          <View style={[styles.segmentedOuter, { backgroundColor: colors.surfaceAlt }]}>
            {(
              [
                { key: 'active', label: t('settings.ticketsActive') },
                { key: 'closed', label: t('settings.ticketsClosed') },
              ] as { key: TabKey; label: string }[]
            ).map((opt) => {
              const isSel = tab === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[
                    styles.segmentedBtn,
                    isSel && [styles.segActive, { backgroundColor: colors.surface }],
                  ]}
                  activeOpacity={0.8}
                  onPress={() => {
                    sounds().play('tap');
                    setTab(opt.key);
                  }}
                >
                  <Text
                    style={[
                      styles.segText,
                      { color: isSel ? colors.textPrimary : colors.textSecondary },
                      isSel && { fontWeight: '600' },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {loading && (
            <View style={styles.stateWrap}>
              <ActivityIndicator color={colors.accent} />
            </View>
          )}

          {!loading && error && (
            <View style={styles.stateWrap}>
              <Text style={[styles.stateText, { color: colors.danger }]}>{error}</Text>
              <TouchableOpacity
                style={[styles.retryBtn, { backgroundColor: colors.accent }]}
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
          )}

          {!loading && !error && tickets.length === 0 && (
            <View style={styles.stateWrap}>
              {tab === 'active' ? <Clock size={40} color={colors.textMuted} /> : <CheckCircle2 size={40} color={colors.textMuted} />}
              <Text style={[styles.stateText, { color: colors.textSecondary }]}>
                {tab === 'active' ? t('settings.emptyTicketsOpen') : t('settings.emptyTicketsClosed')}
              </Text>
            </View>
          )}

          {!loading && !error && tickets.length > 0 && (
            <View style={{ gap: 10 }}>
              {tickets.map((ticket) => {
                const badge = statusBadgeStyle(ticket.status, colors);
                return (
                  <TouchableOpacity
                    key={ticket.id}
                    style={[styles.card, { backgroundColor: colors.surface }]}
                    activeOpacity={0.7}
                    onPress={() => {
                      sounds().play('tap');
                      router.push(`/help-ticket-detail?id=${ticket.id}`);
                    }}
                  >
                    <View style={{ flex: 1, gap: 6 }}>
                      <View style={styles.cardTop}>
                        <Text style={[styles.cardSubject, { color: colors.textPrimary }]} numberOfLines={1}>
                          {ticket.subject}
                        </Text>
                        <ChevronRight size={16} color={colors.textMuted} />
                      </View>
                      <View style={styles.cardBottom}>
                        <Text style={[styles.cardId, { color: colors.textMuted }]}>
                          {ticket.ticketNumber ? ticket.ticketNumber : `#${ticket.id.slice(0, 8)}`}
                        </Text>
                        <View style={{ backgroundColor: badge.bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
                          <Text style={{ fontSize: 11, fontWeight: '600', color: badge.text }}>
                            {translatedStatus(t, ticket.status)}
                          </Text>
                        </View>
                        <Text style={[styles.cardDate, { color: colors.textMuted }]}>
                          {formatDate(ticket.updatedAt)}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </ScrollView>

        <TouchableOpacity
          style={[styles.fab, { backgroundColor: colors.accent }]}
          activeOpacity={0.85}
          onPress={() => {
            sounds().play('tap');
            router.push('/help-contact');
          }}
        >
          <Plus size={22} color={colors.inverseText} />
          <Text style={[styles.fabText, { color: colors.inverseText }]}>
            {t('settings.newTicket')}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function makeStyles(colors: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    scrollContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 100 },
    header: { paddingVertical: 16 },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.textPrimary,
      fontFamily: 'Georgia',
    },
    segmentedOuter: {
      flexDirection: 'row',
      padding: 3,
      borderRadius: 10,
      marginBottom: 16,
    },
    segmentedBtn: {
      flex: 1,
      paddingVertical: 10,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
    },
    segActive: {
      ...Platform.select({
        ios: {
          shadowColor: colors.shadow,
          shadowOpacity: 0.08,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 2 },
        },
        android: { elevation: 1 },
      }),
    },
    segText: { fontSize: 13 },
    stateWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, gap: 12 },
    stateText: { fontSize: 14, textAlign: 'center' },
    retryBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 },
    retryBtnText: { fontSize: 14, fontWeight: '600' },
    card: {
      borderRadius: 14,
      padding: 14,
    },
    cardTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    cardSubject: { flex: 1, fontSize: 15, fontWeight: '600' },
    cardBottom: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    cardId: { fontSize: 12 },
    cardDate: { fontSize: 12, marginLeft: 'auto' },
    fab: {
      position: 'absolute',
      right: 20,
      bottom: 24,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 18,
      paddingVertical: 14,
      borderRadius: 999,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.22,
      shadowRadius: 10,
      elevation: 6,
    },
    fabText: { fontSize: 14, fontWeight: '700' },
  });
}
