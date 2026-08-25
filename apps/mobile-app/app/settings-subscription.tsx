import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RefreshCw, CreditCard, ExternalLink } from 'lucide-react-native';
import { useThemeColors } from '../context/ThemeProvider';
import { useI18n } from '../context/I18nProvider';
import { sounds } from '../services/SoundService';
import { backendApi, Subscription } from '../services/BackendApi';
import { CustomHeader, ThemedBackButton } from './_layout';

function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

async function openPricing(): Promise<void> {
  try {
    await Linking.openURL('https://vellbase.example.com/pricing');
  } catch {
    // ignore
  }
}

export default function SettingsSubscriptionScreen() {
  const colors = useThemeColors();
  const { t } = useI18n();

  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sub = await backendApi.getSubscription();
      setSubscription(sub);
    } catch (err: any) {
      setError(err?.message || t('errors.generic'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const restore = useCallback(async () => {
    setRestoring(true);
    sounds().play('tap');
    try {
      const result = await backendApi.restorePurchases();
      if (result?.success) {
        Alert.alert(t('settings.subscriptionRestoreSuccess'));
        await load();
      } else {
        Alert.alert(t('settings.subscriptionRestoreError'));
      }
    } catch (err: any) {
      Alert.alert(t('settings.subscriptionRestoreError'), err?.message);
    } finally {
      setRestoring(false);
    }
  }, [t, load]);

  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <CustomHeader title={t('settings.subscriptionTitle')} edges={['right', 'left']} left={<ThemedBackButton />} />
      <ScrollView contentContainerStyle={styles.scrollContent} style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('settings.subscriptionTitle')}</Text>
        </View>

        {loading && (
          <View style={styles.stateWrap}>
            <ActivityIndicator color={colors.accent} size="large" />
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

        {!loading && !error && !subscription && (
          <View style={styles.stateWrap}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceAlt }]}>
              <CreditCard size={32} color={colors.textMuted} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
              {t('settings.subscriptionEmpty')}
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              Upgrade to unlock unlimited bookmarks, AI writing assistant, and more.
            </Text>
          </View>
        )}

        {!loading && !error && subscription && (
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <View style={styles.planRow}>
              <Text style={[styles.planName, { color: colors.textPrimary }]}>
                {subscription.planName}
              </Text>
              <StatusBadge status={subscription.status} t={t} colors={colors} />
            </View>

            {subscription.renewalDate && (
              <Row
                label={t('settings.subscriptionRenewalDate')}
                value={formatDate(subscription.renewalDate)}
                colors={colors}
              />
            )}

            {subscription.cancelAtPeriodEnd && (
              <Row
                label=""
                value={t('settings.subscriptionCancelAtPeriodEnd')}
                colors={colors}
                valueColor={colors.warning}
                isLast
              />
            )}
          </View>
        )}

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: colors.accent }]}
            activeOpacity={0.8}
            onPress={() => {
              sounds().play('tap');
              openPricing();
            }}
          >
            <ExternalLink size={16} color={colors.inverseText} />
            <Text style={[styles.primaryBtnText, { color: colors.inverseText }]}>
              {t('settings.subscriptionUpgrade')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryBtn, { backgroundColor: colors.surface }]}
            activeOpacity={0.7}
            onPress={restore}
            disabled={restoring}
          >
            {restoring ? (
              <ActivityIndicator color={colors.accent} size="small" />
            ) : (
              <>
                <RefreshCw size={16} color={colors.accent} />
                <Text style={[styles.secondaryBtnText, { color: colors.accent }]}>
                  {t('settings.subscriptionRestore')}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({
  label,
  value,
  colors,
  valueColor,
  isLast,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof useThemeColors>;
  valueColor?: string;
  isLast?: boolean;
}) {
  const styles = makeStyles(colors);
  return (
    <View
      style={[
        styles.row,
        !isLast && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.separator,
        },
      ]}
    >
      {label ? (
        <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>{label}</Text>
      ) : (
        <View />
      )}
      <Text style={[styles.rowValue, { color: valueColor ?? colors.textPrimary }]}>
        {value}
      </Text>
    </View>
  );
}

function StatusBadge({
  status,
  t,
  colors,
}: {
  status: Subscription['status'];
  t: (k: string) => string;
  colors: ReturnType<typeof useThemeColors>;
}) {
  const map: Record<Subscription['status'], { bg: string; text: string; label: string }> = {
    active: { bg: colors.success + '22', text: colors.success, label: t('settings.subscriptionStatusActive') },
    canceled: { bg: colors.textMuted + '22', text: colors.textMuted, label: t('settings.subscriptionStatusCanceled') },
    past_due: { bg: colors.danger + '22', text: colors.danger, label: t('settings.subscriptionStatusPastDue') },
    trialing: { bg: colors.accent + '22', text: colors.accent, label: t('settings.subscriptionStatusTrialing') },
  };
  const cfg = map[status] || map.active;
  return (
    <View style={{ backgroundColor: cfg.bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: cfg.text }}>{cfg.label}</Text>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    container: { flex: 1, backgroundColor: colors.background },
    scrollContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 48 },
    header: { paddingVertical: 16 },
    title: {
      fontSize: 18,
      fontWeight: '400',
      color: colors.textPrimary,
      fontFamily: 'Georgia',
    },
    stateWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 48,
      gap: 14,
    },
    stateText: { fontSize: 15, textAlign: 'center' },
    retryBtn: {
      paddingHorizontal: 20,
      paddingVertical: 11,
      borderRadius: 10,
    },
    retryBtnText: { fontSize: 14, fontWeight: '600' },
    emptyIcon: {
      width: 72,
      height: 72,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4,
    },
    emptyTitle: { fontSize: 18, fontWeight: '700' },
    emptySubtitle: { fontSize: 14, textAlign: 'center', maxWidth: 280, lineHeight: 20 },
    card: {
      borderRadius: 16,
      overflow: 'hidden',
      paddingHorizontal: 14,
      paddingVertical: 6,
    },
    planRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.separator,
    },
    planName: { fontSize: 18, fontWeight: '700' },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 13,
    },
    rowLabel: { fontSize: 14, fontWeight: '500' },
    rowValue: { fontSize: 14, fontWeight: '600' },
    actions: { marginTop: 22, gap: 10 },
    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      borderRadius: 12,
      gap: 8,
    },
    primaryBtnText: { fontSize: 15, fontWeight: '600' },
    secondaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      borderRadius: 12,
      gap: 8,
      minHeight: 52,
    },
    secondaryBtnText: { fontSize: 15, fontWeight: '600' },
  });
}
