import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronRight, FileText, Shield, Award, Globe } from 'lucide-react-native';
import { useThemeColors } from '../context/ThemeProvider';
import { useI18n } from '../context/I18nProvider';
import { sounds } from '../services/SoundService';
import { CustomHeader, ThemedBackButton } from './_layout';

const APP_NAME = 'Vellbase';
const APP_VERSION = '1.0.0';
const BUILD_NUMBER = '42';

const LINKS: {
  url: string;
  labelKey: string;
  Icon: React.ComponentType<any>;
}[] = [
  { url: 'https://vellbase.example.com/terms', labelKey: 'settings.aboutTerms', Icon: FileText },
  { url: 'https://vellbase.example.com/privacy', labelKey: 'settings.aboutPrivacy', Icon: Shield },
  { url: 'https://vellbase.example.com/licenses', labelKey: 'settings.aboutLicenses', Icon: Award },
  { url: 'https://vellbase.example.com', labelKey: 'settings.aboutWebsite', Icon: Globe },
];

async function openUrl(url: string): Promise<void> {
  try {
    await Linking.openURL(url);
  } catch {
    // swallow linking errors silently
  }
}

export default function SettingsAboutScreen() {
  const colors = useThemeColors();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <CustomHeader title={t('common.about')} edges={['right', 'left']} left={<ThemedBackButton />} />
      <ScrollView contentContainerStyle={styles.scrollContent} style={styles.container}>
        <View style={styles.header}>
          <View style={[styles.appLogo, { backgroundColor: colors.accentMuted }]}>
            <Text style={[styles.appLogoText, { color: colors.accent }]}>V</Text>
          </View>
          <Text style={[styles.appName, { color: colors.textPrimary }]}>
            {t('Vellbase')}
          </Text>
        </View>

        <View style={styles.group}>
          <InfoRow label={t('settings.aboutAppName')} value={APP_NAME} colors={colors} />
          <InfoRow label={t('settings.aboutVersion')} value={APP_VERSION} colors={colors} />
          <InfoRow label={t('settings.aboutBuild')} value={BUILD_NUMBER} colors={colors} isLast />
        </View>

        <Text style={styles.sectionHeading}>LEGAL</Text>
        <View style={styles.group}>
          {LINKS.map((link, idx) => {
            const isLast = idx === LINKS.length - 1;
            const Icon = link.Icon;
            return (
              <TouchableOpacity
                key={link.url}
                style={[
                  styles.linkRow,
                  !isLast && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: colors.separator,
                  },
                ]}
                activeOpacity={0.7}
                onPress={() => {
                  sounds().play('tap');
                  openUrl(link.url);
                }}
              >
                <View style={[styles.linkIcon, { backgroundColor: colors.surfaceAlt }]}>
                  <Icon size={18} color={colors.textPrimary} />
                </View>
                <Text style={[styles.linkLabel, { color: colors.textPrimary }]}>
                  {t(link.labelKey)}
                </Text>
                <ChevronRight size={18} color={colors.textMuted} />
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.footer, { color: colors.textMuted }]}>
          © 2025 Vellbase Labs. All rights reserved.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({
  label,
  value,
  colors,
  isLast,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof useThemeColors>;
  isLast?: boolean;
}) {
  const styles = makeStyles(colors);
  return (
    <View
      style={[
        styles.infoRow,
        !isLast && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.separator,
        },
      ]}
    >
      <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{value}</Text>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    container: { flex: 1, backgroundColor: colors.background },
    scrollContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 48 },
    header: { alignItems: 'center', paddingVertical: 28, gap: 14 },
    appLogo: {
      width: 72,
      height: 72,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    appLogoText: { fontSize: 34, fontWeight: '800' },
    appName: { fontSize: 22, fontWeight: '700', fontFamily: 'Georgia' },
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
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      paddingVertical: 14,
    },
    infoLabel: { fontSize: 14, fontWeight: '500' },
    infoValue: { fontSize: 14, fontWeight: '600' },
    linkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 14,
      gap: 12,
    },
    linkIcon: {
      width: 32,
      height: 32,
      borderRadius: 9,
      justifyContent: 'center',
      alignItems: 'center',
    },
    linkLabel: { flex: 1, fontSize: 15, fontWeight: '500' },
    footer: {
      fontSize: 12,
      textAlign: 'center',
      marginTop: 28,
    },
  });
}
