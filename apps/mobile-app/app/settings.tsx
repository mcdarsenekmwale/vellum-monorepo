import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Animated,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Switch,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as NotificationsLib from 'expo-notifications';
import {
  ChevronRight,
  X,
  Check,
  Moon,
  Sun,
  Monitor,
  Globe,
  Bell,
  Shield,
  CreditCard,
  HelpCircle,
  Info,
  Volume2,
} from 'lucide-react-native';
import { useSettingsStore, Appearance, LocaleTag } from '../context/SettingsStore';
import { useThemeColors } from '../context/ThemeProvider';
import { useI18n } from '../context/I18nProvider';
import { useAuthState } from '../hooks/useApi';
import { sounds } from '../services/SoundService';
import { backendApi, NotificationPreferences, ApiError } from '../services/BackendApi';
import { CustomHeader, ThemedBackButton } from './_layout';
import CustomSwitch from 'components/custom_switch';

type SectionKey =
  | 'appearance'
  | 'language'
  | 'sound'
  | 'notifications'
  | 'privacy'
  | 'subscription'
  | 'helpCenter'
  | 'about';

function useToast() {
  return useCallback((message: string) => {
    Alert.alert(message);
  }, []);
}

async function checkNotificationPermission(): Promise<{ granted: boolean }> {
  try {
    if (Platform.OS === 'web') {
      const anyN = (globalThis as any).Notification;
      if (anyN && anyN.permission) {
        return { granted: anyN.permission === 'granted' };
      }
      return { granted: true };
    }
    const result = await NotificationsLib.getPermissionsAsync();
    const granted =
      (result as any).granted === true ||
      (result as any).status === 'granted' ||
      (result as any).ios?.status === 'granted';
    return { granted: !!granted };
  } catch {
    return { granted: true };
  }
}

async function openOsSettings(): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      return;
    }
    await Linking.openSettings();
  } catch {
    // ignore
  }
}

export default function SettingsScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { t } = useI18n();
  const { settings, setAppearance, setSoundEnabled, setLocale } = useSettingsStore();
  const { logout } = useAuthState();
  const toast = useToast();

  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences>({
    pushLikes: true,
    pushComments: true,
    pushReplies: true,
    pushFollows: true,
    pushMentions: true,
    pushNewArticles: true,
    pushSystem: true,
    emailDigest: true,
    emailMarketing: false,
  });
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifBusy, setNotifBusy] = useState<Record<string, boolean>>({});
  const [osPermissionGranted, setOsPermissionGranted] = useState(true);

  const overlayAnimated = useRef(new Animated.Value(0)).current;
  const sheetAnimated = useRef(new Animated.Value(0)).current;
  const [activeSheet, setActiveSheet] = useState<null | 'appearance' | 'language' | 'notifications'>(null);

  const openSheet = useCallback((sheet: 'appearance' | 'language' | 'notifications') => {
    sounds().play('tap');
    setActiveSheet(sheet);
    if (sheet === 'appearance') setAppearanceOpen(true);
    if (sheet === 'language') setLanguageOpen(true);
    if (sheet === 'notifications') {
      setNotificationsOpen(true);
      loadNotificationPrefs();
      checkNotificationPermission().then((r) => setOsPermissionGranted(r.granted));
    }
    // react-native-web does not support useNativeDriver for Animated.spring/
    // Animated.timing — passing true silently breaks the .start() completion
    // callback, leaving activeSheet mounted forever (leaked overlays).
    const useNativeDriver = Platform.OS !== 'web';
    Animated.parallel([
      Animated.timing(overlayAnimated, { toValue: 1, duration: 220, useNativeDriver }),
      Animated.spring(sheetAnimated, { toValue: 1, friction: 8, tension: 50, useNativeDriver }),
    ]).start();
  }, [overlayAnimated, sheetAnimated]);

  const closeSheet = useCallback(() => {
    sounds().play('tap');
    const useNativeDriver = Platform.OS !== 'web';
    Animated.parallel([
      Animated.timing(overlayAnimated, { toValue: 0, duration: 180, useNativeDriver }),
      Animated.timing(sheetAnimated, { toValue: 0, duration: 220, useNativeDriver }),
    ]).start(() => {
      setActiveSheet(null);
      setAppearanceOpen(false);
      setLanguageOpen(false);
      setNotificationsOpen(false);
      setOsPermissionGranted(false);
    });
  }, [overlayAnimated, sheetAnimated]);

  const loadNotificationPrefs = useCallback(async () => {
    setNotifLoading(true);
    try {
      const prefs = await backendApi.getNotificationPreferences();
      setNotifPrefs(prefs);
    } catch {
      // use defaults
    } finally {
      setNotifLoading(false);
    }
  }, []);

  const toggleNotif = useCallback(async (key: keyof NotificationPreferences) => {
    const prev = notifPrefs[key];
    const next = !prev;
    setNotifPrefs((p) => ({ ...p, [key]: next }));
    setNotifBusy((b) => ({ ...b, [key]: true }));
    try {
      const updated = await backendApi.updateNotificationPreferences({ [key]: next });
      setNotifPrefs(updated);
    } catch (err: any) {
      setNotifPrefs((p) => ({ ...p, [key]: prev }));
      toast(err?.message || t('errors.generic'));
    } finally {
      setNotifBusy((b) => ({ ...b, [key]: false }));
    }
  }, [notifPrefs, toast, t]);

  const openAppearanceSheet = () => openSheet('appearance');
  const openLanguageSheet = () => openSheet('language');
  const openNotificationsSheet = () => openSheet('notifications');

  const onLeft = useCallback((key: SectionKey) => {
    sounds().play('tap');
    switch (key) {
      case 'appearance':
        openAppearanceSheet();
        break;
      case 'language':
        openLanguageSheet();
        break;
      case 'notifications':
        openNotificationsSheet();
        break;
      case 'privacy':
        router.push('/settings-privacy');
        break;
      case 'subscription':
        router.push('/settings-subscription');
        break;
      case 'helpCenter':
        router.push('/help-center');
        break;
      case 'about':
        router.push('/settings-about');
        break;
    }
  }, [router, openAppearanceSheet, openLanguageSheet, openNotificationsSheet]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      router.replace('/login');
    } catch {
      router.replace('/login');
    } finally {
      setIsLoggingOut(false);
    }
  };

  const sheetTranslateY = sheetAnimated.interpolate({
    inputRange: [0, 1],
    outputRange: [600, 0],
  });
  const overlayOpacity = overlayAnimated.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const appearanceOptions: { value: Appearance; labelKey: string; icon: any }[] = useMemo(
    () => [
      { value: 'light', labelKey: 'settings.appearanceLight', icon: Sun },
      { value: 'dark', labelKey: 'settings.appearanceDark', icon: Moon },
      { value: 'system', labelKey: 'settings.appearanceSystem', icon: Monitor },
    ],
    [],
  );

  const languageOptions: { tag: LocaleTag; label: string; flag: string }[] = useMemo(
    () => [
      { tag: 'en', label: 'English', flag: '🇺🇸' },
      { tag: 'fr', label: 'Français', flag: '🇫🇷' },
      { tag: "es", label: "Español", flag: "🇪🇸" },
      { tag: "de", label: "Deutsch", flag: "🇩🇪" },
      { tag: "zh", label: "中文", flag: "🇨🇳" },
      { tag: "ja", label: "日本語", flag: "🇯🇵" },
      { tag: "ko", label: "한국어", flag: "🇰🇷" },
      { tag: "pt", label: "Português", flag: "🇵🇹" },
      { tag: "ru", label: "Русский", flag: "🇷🇺" },
      { tag: "tr", label: "Türkçe", flag: "🇹🇷" },
      { tag: "vi", label: "Tiếng Việt", flag: "🇻🇳" },
    ],
    [],
  );

  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <CustomHeader title={t('settings.title')} edges={['right', 'left']} left={<ThemedBackButton />} />
      <ScrollView contentContainerStyle={styles.scrollContent} style={styles.container}>

        <Text style={styles.sectionHeading}>{t('settings.preferences').toUpperCase()}</Text>
        <View style={styles.group}>
          <SettingRow
            label={t('settings.sectionsAppearance')}
            description={t('settings.sectionsAppearanceDescription')}
            onPress={() => onLeft('appearance')}
            colors={colors}
            right={
              <Text style={styles.rowValue}>
                {settings.appearance === 'light'
                  ? t('settings.appearanceLight')
                  : settings.appearance === 'dark'
                    ? t('settings.appearanceDark')
                    : t('settings.appearanceSystem')}
              </Text>
            }
            Icon={settings.appearance === 'dark' ? Moon : Sun}
          />
          <SettingRow
            label={t('settings.sectionsLanguage')}
            description={t('settings.sectionsLanguageDescription')}
            onPress={() => onLeft('language')}
            colors={colors}
            right={
              <Text style={styles.rowValue}>
                {settings.locale.toUpperCase()}
              </Text>
            }
            Icon={Globe}
          />
          <SettingRow
            label={t('settings.sectionsSound')}
            description={t('settings.sectionsSoundDescription')}
            onPress={() => {
              sounds().play('tap');
            }}
            colors={colors}
            right={
              <CustomSwitch
                colors={colors}
                value={settings.soundEnabled}
                onValueChange={(v: boolean) => {
                  sounds().play('tap');
                  setSoundEnabled(v);
                }}
                activeColor="#d4653a"
                inactiveColor="#e5e0d8"
                size="medium"
                thumbColor={Platform.OS === 'android' ? (settings.soundEnabled ? colors.surface : colors.surface) : undefined}
              />
            }
            Icon={Volume2}
            isLast
          />
        </View>

        <View style={styles.group}>
          <SettingRow
            label={t('settings.sectionsNotifications')}
            description={t('settings.sectionsNotificationsDescription')}
            onPress={() => onLeft('notifications')}
            colors={colors}
            Icon={Bell}
          />
          <SettingRow
            label={t('settings.sectionsPrivacy')}
            description={t('settings.sectionsPrivacyDescription')}
            onPress={() => onLeft('privacy')}
            colors={colors}
            Icon={Shield}
            isLast
          />
        </View>

        <Text style={styles.sectionHeading}>{t('settings.account').toUpperCase()}</Text>
        <View style={styles.group}>
          <SettingRow
            label={t('settings.sectionsSubscription')}
            description={t('settings.sectionsSubscriptionDescription')}
            onPress={() => onLeft('subscription')}
            colors={colors}
            Icon={CreditCard}
          />
          <SettingRow
            label={t('settings.sectionsHelpCenter')}
            description={t('settings.sectionsHelpCenterDescription')}
            onPress={() => onLeft('helpCenter')}
            colors={colors}
            Icon={HelpCircle}
          />
          <SettingRow
            label={t('settings.sectionsAbout')}
            description={t('settings.sectionsAboutDescription')}
            onPress={() => onLeft('about')}
            colors={colors}
            Icon={Info}
            isLast
          />
        </View>

        <TouchableOpacity
          style={styles.logoutButton}
          activeOpacity={0.7}
          onPress={handleLogout}
          disabled={isLoggingOut}
        >
          {isLoggingOut ? (
            <ActivityIndicator color={colors.danger} />
          ) : (
            <Text style={[styles.logoutText, { color: colors.danger }]}>
              {t('settings.sectionsSignOut')}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {activeSheet && (
        <View style={styles.overlayContainer} pointerEvents="box-none">
          <Animated.View
            style={[styles.overlay, { backgroundColor: colors.overlay, opacity: overlayOpacity }]}
            pointerEvents={activeSheet ? 'auto' : 'none'}
          >
            <Pressable style={StyleSheet.absoluteFill} onPress={closeSheet} />
          </Animated.View>

          <Animated.View
            style={[
              styles.sheet,
              { backgroundColor: colors.surface, transform: [{ translateY: sheetTranslateY }] },
            ]}
            pointerEvents={activeSheet ? 'auto' : 'none'}
          >
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>
                {activeSheet === 'appearance'
                  ? t('settings.appearanceSheetTitle')
                  : activeSheet === 'language'
                    ? t('settings.languageSheetTitle')
                    : t('settings.sectionsNotifications')}
              </Text>
              <TouchableOpacity onPress={closeSheet} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
              {activeSheet === 'appearance' && (
                <View style={styles.sheetContent}>
                  {appearanceOptions.map((opt) => {
                    const isSel = settings.appearance === opt.value;
                    const IconC = opt.icon;
                    return (
                      <TouchableOpacity
                        key={opt.value}
                        style={[
                          styles.optionRow,
                          { borderBottomColor: colors.separator },
                        ]}
                        onPress={() => {
                          sounds().play('tap');
                          setAppearance(opt.value);
                          closeSheet();
                        }}
                      >
                        <View style={[styles.optionIcon, { backgroundColor: colors.surfaceAlt }]}>
                          <IconC size={18} color={colors.textPrimary} />
                        </View>
                        <Text style={[styles.optionLabel, { color: colors.textPrimary }]}>
                          {t(opt.labelKey)}
                        </Text>
                        {isSel ? (
                          <Check size={20} color={colors.accent} />
                        ) : (
                          <View style={{ width: 20 }} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {activeSheet === 'language' && (
                <View style={styles.sheetContent}>
                  {languageOptions.map((opt) => {
                    const isSel = settings.locale === opt.tag;
                    return (
                      <TouchableOpacity
                        key={opt.tag}
                        style={[
                          styles.optionRow,
                          { borderBottomColor: colors.separator },
                        ]}
                        onPress={() => {
                          sounds().play('tap');
                          setLocale(opt.tag);
                          closeSheet();
                        }}
                      >
                        <View style={[styles.optionIcon, { backgroundColor: colors.surfaceAlt }]}>
                          <Text style={{ fontSize: 16 }}>{opt.flag}</Text>
                        </View>
                        <Text style={[styles.optionLabel, { color: colors.textPrimary }]}>
                          {opt.label}
                        </Text>
                        {isSel ? (
                          <Check size={20} color={colors.accent} />
                        ) : (
                          <View style={{ width: 20 }} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {activeSheet === 'notifications' && (
                <View style={styles.sheetContent}>
                  {!osPermissionGranted && (
                    <View
                      style={[
                        styles.osBanner,
                        { backgroundColor: colors.warning + '22', borderColor: colors.warning },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.osBannerText, { color: colors.warning }]}>
                          {t('settings.osDisabledInfo')}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.osBannerBtn, { backgroundColor: colors.warning }]}
                        onPress={openOsSettings}
                      >
                        <Text style={[styles.osBannerBtnText, { color: colors.inverseText }]}>
                          {t('settings.osOpenSettings')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {notifLoading ? (
                    <ActivityIndicator color={colors.accent} style={{ marginTop: 16 }} />
                  ) : (
                    <>
                      <Text style={[styles.sheetSubtitle, { color: colors.textMuted }]}>
                        {t('settings.pushNotifications')}
                      </Text>
                      <NotifToggleRow
                        label={t('settings.notifyLikes')}
                        value={notifPrefs.pushLikes}
                        onChange={() => toggleNotif('pushLikes')}
                        busy={!!notifBusy.pushLikes}
                        colors={colors}
                      />
                      <NotifToggleRow
                        label={t('settings.notifyComments')}
                        value={notifPrefs.pushComments}
                        onChange={() => toggleNotif('pushComments')}
                        busy={!!notifBusy.pushComments}
                        colors={colors}
                      />
                      <NotifToggleRow
                        label={t('settings.notifyReplies')}
                        value={notifPrefs.pushReplies}
                        onChange={() => toggleNotif('pushReplies')}
                        busy={!!notifBusy.pushReplies}
                        colors={colors}
                      />
                      <NotifToggleRow
                        label={t('settings.notifyFollows')}
                        value={notifPrefs.pushFollows}
                        onChange={() => toggleNotif('pushFollows')}
                        busy={!!notifBusy.pushFollows}
                        colors={colors}
                      />
                      <NotifToggleRow
                        label={t('settings.notifyMentions')}
                        value={notifPrefs.pushMentions}
                        onChange={() => toggleNotif('pushMentions')}
                        busy={!!notifBusy.pushMentions}
                        colors={colors}
                      />
                      <NotifToggleRow
                        label={t('settings.notifyNewArticles')}
                        value={notifPrefs.pushNewArticles}
                        onChange={() => toggleNotif('pushNewArticles')}
                        busy={!!notifBusy.pushNewArticles}
                        colors={colors}
                      />
                      <NotifToggleRow
                        label={t('settings.notifySystem')}
                        value={notifPrefs.pushSystem}
                        onChange={() => toggleNotif('pushSystem')}
                        busy={!!notifBusy.pushSystem}
                        colors={colors}
                        isLast
                      />

                      <Text
                        style={[
                          styles.sheetSubtitle,
                          { color: colors.textMuted, marginTop: 20 },
                        ]}
                      >
                        {t('settings.emailNotifications')}
                      </Text>
                      <NotifToggleRow
                        label={t('settings.weeklyDigest')}
                        value={notifPrefs.emailDigest}
                        onChange={() => toggleNotif('emailDigest')}
                        busy={!!notifBusy.emailDigest}
                        colors={colors}
                      />
                      <NotifToggleRow
                        label={t('settings.marketingEmails')}
                        value={notifPrefs.emailMarketing}
                        onChange={() => toggleNotif('emailMarketing')}
                        busy={!!notifBusy.emailMarketing}
                        colors={colors}
                        isLast
                      />
                      <Text style={[styles.sheetFooter, { color: colors.textMuted }]}>
                        {t('settings.emailSubtitle')}
                      </Text>
                    </>
                  )}
                </View>
              )}
            </ScrollView>
          </Animated.View>
        </View>
      )}
    </SafeAreaView>
  );
}

/* ----------------- Custom Switch Component ----------------- */


function SettingRow({
  label,
  onPress,
  colors,
  right,
  Icon,
  isLast,
  description,
}: {
  label: string;
  description?: string;
  onPress: () => void;
  colors: ReturnType<typeof useThemeColors>;
  right?: React.ReactNode;
  Icon?: React.ComponentType<any>;
  isLast?: boolean;
}) {
  const styles = makeStyles(colors);
  return (
    <TouchableOpacity
      style={[styles.row, !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator }]}
      activeOpacity={0.7}
      onPress={onPress}
    >
      {Icon && (
        <View style={[styles.rowIcon, { backgroundColor: colors.surfaceAlt }]}>
          <Icon size={18} color={colors.textPrimary} />
        </View>
      )}
      <View style={styles.itemContent}>
        <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>{label}</Text>
        {description && <Text style={[styles.itemDescription, { color: colors.textMuted }]}>{description}</Text>}
      </View>

      <View style={{ flex: 1 }} />
      {right ?? null}
      {right === undefined && <ChevronRight size={18} color={colors.textMuted} />}
    </TouchableOpacity>
  );
}

function NotifToggleRow({
  label,
  value,
  onChange,
  busy,
  colors,
  isLast,
}: {
  label: string;
  value: boolean;
  onChange: () => void;
  busy: boolean;
  colors: ReturnType<typeof useThemeColors>;
  isLast?: boolean;
}) {
  const styles = makeStyles(colors);
  return (
    <View
      style={[
        styles.notifRow,
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator },
      ]}
    >
      <Text style={[styles.notifRowLabel, { color: colors.textPrimary }]}>{label}</Text>
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
    header: { paddingVertical: 16 },
    title: { fontSize: 28, fontWeight: '700', color: colors.textPrimary, fontFamily: 'Georgia' },
    sectionHeading: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textMuted,
      letterSpacing: 1.2,
      marginBottom: 10,
      marginLeft: 4,
    },
    group: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      overflow: 'hidden',
      marginBottom: 8,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 14,
      gap: 12,
    },
    rowIcon: {
      width: 34,
      height: 34,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
    },
    rowLabel: { fontSize: 15, fontWeight: '500', flex: 1 },
    rowValue: { fontSize: 14, color: colors.textSecondary, marginRight: 4 },

    logoutButton: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 20,
      minHeight: 54,
    },
    logoutText: {
      fontSize: 15,
      fontWeight: '600',
    },

    overlayContainer: {
      ...StyleSheet.absoluteFillObject,
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
    },
    sheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      paddingHorizontal: 18,
      maxHeight: '82%',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: -6 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
      elevation: 20,
    },
    sheetHandle: {
      alignSelf: 'center',
      width: 42,
      height: 5,
      borderRadius: 3,
      backgroundColor: colors.separator,
      marginTop: 10,
      marginBottom: 6,
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 10,
      marginBottom: 4,
    },
    sheetTitle: { fontSize: 18, fontWeight: '700' },
    sheetContent: { paddingBottom: 10 },
    sheetSubtitle: {
      fontSize: 12,
      fontWeight: '600',
      letterSpacing: 0.5,
      marginBottom: 6,
      marginTop: 14,
      marginLeft: 4,
    },
    sheetFooter: {
      fontSize: 12,
      marginTop: 14,
      marginLeft: 4,
      lineHeight: 18,
    },
    optionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      gap: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    optionIcon: {
      width: 32,
      height: 32,
      borderRadius: 9,
      justifyContent: 'center',
      alignItems: 'center',
    },
    optionLabel: { flex: 1, fontSize: 15, fontWeight: '500' },

    notifRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      paddingHorizontal: 4,
    },
    notifRowLabel: { fontSize: 14, fontWeight: '500', flex: 1, paddingRight: 12 },

    osBanner: {
      marginTop: 10,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    osBannerText: { fontSize: 13, fontWeight: '500', lineHeight: 18 },
    osBannerBtn: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
    },
    osBannerBtnText: { fontSize: 12, fontWeight: '700' },

    itemContent: {
      flex: 3,
      gap: 2,
    },
    itemLabel: {
      fontSize: 15,
      fontWeight: '600',
    },
    itemDescription: {
      fontSize: 12,
      color: '#999999',
    },
  });
}
