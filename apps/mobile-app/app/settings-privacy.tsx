import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Switch,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeColors } from '../context/ThemeProvider';
import { useI18n } from '../context/I18nProvider';
import { sounds } from '../services/SoundService';
import { backendApi, ApiError } from '../services/BackendApi';
import { CustomHeader, ThemedBackButton } from './_layout';
import CustomSwitch from 'components/custom_switch';

type ProfileVisibility = 'public' | 'followers' | 'private';

interface PrivacyState {
  profileVisibility: ProfileVisibility;
  allowComments: boolean;
  showLikesCount: boolean;
  showOnlineStatus: boolean;
}

const DEFAULT_STATE: PrivacyState = {
  profileVisibility: 'public',
  allowComments: true,
  showLikesCount: true,
  showOnlineStatus: true,
};

function useToast() {
  return useCallback((message: string) => {
    Alert.alert(message);
  }, []);
}

export default function SettingsPrivacyScreen() {
  const colors = useThemeColors();
  const { t } = useI18n();
  const toast = useToast();

  const [state, setState] = useState<PrivacyState>(DEFAULT_STATE);
  const [busy, setBusy] = useState<Partial<Record<keyof PrivacyState, boolean>>>({});

  const optimisticUpdate = useCallback(
    async <K extends keyof PrivacyState>(
      key: K,
      next: PrivacyState[K],
      patch: Record<string, unknown>
    ) => {
      const prev = state[key];
      setState((s) => ({ ...s, [key]: next }));
      setBusy((b) => ({ ...b, [key]: true }));
      sounds().play('tap');
      try {
        await backendApi.updateUser(patch);
      } catch (err: any) {
        setState((s) => ({ ...s, [key]: prev }));
        toast(err?.message || t('errors.generic'));
      } finally {
        setBusy((b) => ({ ...b, [key]: false }));
      }
    },
    [state, toast, t]
  );

  const setVisibility = (v: ProfileVisibility) => {
    if (v === state.profileVisibility) return;
    optimisticUpdate('profileVisibility', v, { profileVisibility: v });
  };

  const toggleComments = (v: boolean) => {
    optimisticUpdate('allowComments', v, { allowComments: v });
  };

  const toggleLikes = (v: boolean) => {
    optimisticUpdate('showLikesCount', v, { showLikesCount: v });
  };

  const toggleOnline = (v: boolean) => {
    optimisticUpdate('showOnlineStatus', v, { showOnlineStatus: v });
  };

  const visibilityOptions: { value: ProfileVisibility; labelKey: string }[] = useMemo(
    () => [
      { value: 'public', labelKey: 'settings.privacyPublic' },
      { value: 'followers', labelKey: 'settings.privacyFollowers' },
      { value: 'private', labelKey: 'settings.privacyPrivate' },
    ],
    []
  );

  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <CustomHeader title={t('settings.privacyTitle')} edges={['right', 'left']} left={<ThemedBackButton />} />
      <ScrollView contentContainerStyle={styles.scrollContent} style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('settings.privacyTitle')}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {t('settings.privacySubtitle')}
          </Text>
        </View>

        <Text style={styles.sectionHeading}>
          {t('settings.privacyProfileVisibility').toUpperCase()}
        </Text>
        <View style={styles.group}>
          <View style={styles.segmentedOuter}>
            {visibilityOptions.map((opt, idx) => {
              const isSel = state.profileVisibility === opt.value;
              const isBusy = !!busy.profileVisibility;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.segmentedBtn,
                    isSel && [
                      styles.segmentedBtnActive,
                      { backgroundColor: colors.accent },
                    ],
                    idx === 0 && { borderTopLeftRadius: 10, borderBottomLeftRadius: 10 },
                    idx === visibilityOptions.length - 1 && {
                      borderTopRightRadius: 10,
                      borderBottomRightRadius: 10,
                    },
                  ]}
                  activeOpacity={0.8}
                  disabled={isBusy}
                  onPress={() => setVisibility(opt.value)}
                >
                  {isBusy ? (
                    <ActivityIndicator color={isSel ? colors.inverseText : colors.textSecondary} size="small" />
                  ) : (
                    <Text
                      style={[
                        styles.segmentedText,
                        { color: isSel ? colors.inverseText : colors.textSecondary },
                        isSel && { fontWeight: '600' },
                      ]}
                    >
                      {t(opt.labelKey)}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <Text style={styles.sectionHeading}>{t('settings.account').toUpperCase()}</Text>
        <View style={styles.group}>
          <ToggleRow
            label={t('settings.privacyAllowComments')}
            value={state.allowComments}
            onChange={toggleComments}
            busy={!!busy.allowComments}
            colors={colors}
          />
          <ToggleRow
            label={t('settings.privacyShowLikesCount')}
            value={state.showLikesCount}
            onChange={toggleLikes}
            busy={!!busy.showLikesCount}
            colors={colors}
          />
          <ToggleRow
            label={t('settings.privacyShowOnline')}
            value={state.showOnlineStatus}
            onChange={toggleOnline}
            busy={!!busy.showOnlineStatus}
            colors={colors}
            isLast
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
  busy,
  colors,
  isLast,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  busy: boolean;
  colors: ReturnType<typeof useThemeColors>;
  isLast?: boolean;
}) {
  const styles = makeStyles(colors);
  return (
    <View
      style={[
        styles.toggleRow,
        !isLast && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.separator,
        },
      ]}
    >
      <Text style={[styles.toggleLabel, { color: colors.textPrimary }]}>{label}</Text>
      {busy ? (
        <ActivityIndicator color={colors.accent} size="small" />
      ) : (
        <CustomSwitch
          colors={colors}
          value={value}
          onValueChange={onChange}
          activeColor="#d4653a"
          inactiveColor="#e5e0d8"
          thumbColor={Platform.OS === 'android' ? colors.surface : undefined}
          size="medium"


        />
      )}
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    container: { flex: 1, backgroundColor: colors.background },
    scrollContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 48 },
    header: { paddingVertical: 16, gap: 6 },
    title: {
      fontSize: 18,
      fontWeight: '400',
      color: colors.textPrimary,
      fontFamily: 'Georgia',
    },
    subtitle: { fontSize: 14, lineHeight: 20 },
    sectionHeading: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textMuted,
      letterSpacing: 1.2,
      marginTop: 20,
      marginBottom: 10,
      marginLeft: 4,
    },
    group: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      overflow: 'hidden',
      marginBottom: 8,
      padding: 14,
    },
    segmentedOuter: {
      flexDirection: 'row',
      backgroundColor: colors.surfaceAlt,
      borderRadius: 10,
      padding: 3,
    },
    segmentedBtn: {
      flex: 1,
      paddingVertical: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    segmentedBtnActive: {},
    segmentedText: { fontSize: 13 },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      paddingHorizontal: 4,
    },
    toggleLabel: { fontSize: 15, fontWeight: '500', flex: 1, paddingRight: 12 },
  });
}
