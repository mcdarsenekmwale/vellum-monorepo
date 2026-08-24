import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  Search,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Ticket,
  MessageSquare,
  Compass,
  CreditCard,
  Edit3,
  Bell,
  Shield,
  Settings as SettingsIcon,
} from 'lucide-react-native';
import { useThemeColors } from '../context/ThemeProvider';
import { useI18n } from '../context/I18nProvider';
import { sounds } from '../services/SoundService';
import { backendApi, Faq } from '../services/BackendApi';
import { CustomHeader, ThemedBackButton } from './_layout';

interface HelpCategory {
  key: string;
  nameKey: string;
  count: number;
  Icon: React.ComponentType<any>;
}

const CATEGORIES: HelpCategory[] = [
  { key: 'getting-started', nameKey: 'settings.helpCategoryGettingStarted', count: 8, Icon: Compass },
  { key: 'account-billing', nameKey: 'settings.helpCategoryAccountBilling', count: 12, Icon: CreditCard },
  { key: 'content-writing', nameKey: 'settings.helpCategoryContentWriting', count: 15, Icon: Edit3 },
  { key: 'notifications', nameKey: 'settings.helpCategoryNotifications', count: 6, Icon: Bell },
  { key: 'safety-privacy', nameKey: 'settings.helpCategorySafetyPrivacy', count: 10, Icon: Shield },
  { key: 'troubleshooting', nameKey: 'settings.helpCategoryTroubleshooting', count: 9, Icon: SettingsIcon },
];

function useDebouncedValue<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setDebounced(value), delay);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [value, delay]);
  return debounced;
}

export default function HelpCenterScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ category?: string }>();
  const colors = useThemeColors();
  const { t } = useI18n();

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(
    params?.category ?? null
  );
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debouncedSearch = useDebouncedValue(search);

  useEffect(() => {
    if (params?.category) setSelectedCategory(params.category);
  }, [params?.category]);

  const loadFaqs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await backendApi.listFaqs({
        category: selectedCategory ?? undefined,
        search: debouncedSearch || undefined,
      });
      setFaqs(list || []);
    } catch (err: any) {
      setError(err?.message || t('errors.generic'));
      setFaqs([]);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, debouncedSearch, t]);

  useEffect(() => {
    loadFaqs();
  }, [loadFaqs]);

  const toggleCategory = (key: string) => {
    sounds().play('tap');
    const next = selectedCategory === key ? null : key;
    setSelectedCategory(next);
    if (next) {
      router.setParams({ category: next });
    } else {
      router.setParams({});
    }
  };

  const toggleExpanded = (id: string) => {
    sounds().play('tap');
    setExpanded((e) => ({ ...e, [id]: !e[id] }));
  };

  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <CustomHeader title={t('settings.helpTitle')} edges={['right', 'left']} left={<ThemedBackButton />} />
      <ScrollView contentContainerStyle={styles.scrollContent} style={styles.container}>

        <View style={[styles.searchWrap, { backgroundColor: colors.surface }]}>
          <Search size={18} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder={t('settings.faqSearchPlaceholder')}
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
            returnKeyType="search"
          />
        </View>

        <Text style={styles.sectionHeading}>{t('settings.helpCategoriesHeading').toUpperCase()}</Text>
        <View style={styles.categoryGrid}>
          {CATEGORIES.map((c) => {
            const Icon = c.Icon;
            const isSel = selectedCategory === c.key;
            return (
              <TouchableOpacity
                key={c.key}
                style={[
                  styles.categoryCard,
                  { backgroundColor: colors.surface },
                  isSel && [styles.categoryCardActive, { borderColor: colors.accent }],
                ]}
                activeOpacity={0.8}
                onPress={() => toggleCategory(c.key)}
              >
                <View style={[styles.categoryIcon, { backgroundColor: isSel ? colors.accent : colors.surfaceAlt }]}>
                  <Icon size={18} color={isSel ? colors.inverseText : colors.textPrimary} />
                </View>
                <Text style={[styles.categoryName, { color: colors.textPrimary }]} numberOfLines={2}>
                  {t(c.nameKey)}
                </Text>
                <Text style={[styles.categoryCount, { color: colors.textMuted }]}>
                  {t('settings.helpArticlesCount', { count: c.count })}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.sectionHeading}>
          {(selectedCategory ? t(CATEGORIES.find((c) => c.key === selectedCategory)?.nameKey || '') : t('settings.helpFaqsHeading')).toUpperCase()}
        </Text>

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
                loadFaqs();
              }}
            >
              <Text style={[styles.retryBtnText, { color: colors.inverseText }]}>
                {t('common.retry')}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {!loading && !error && faqs.length === 0 && (
          <View style={styles.stateWrap}>
            <BookOpen size={40} color={colors.textMuted} />
            <Text style={[styles.stateText, { color: colors.textSecondary }]}>
              {t('settings.emptyFaq')}
            </Text>
          </View>
        )}

        {!loading && !error && faqs.length > 0 && (
          <View style={[styles.faqGroup, { backgroundColor: colors.surface }]}>
            {faqs.map((faq, idx) => {
              const isOpen = !!expanded[faq.id];
              const isLast = idx === faqs.length - 1;
              return (
                <View key={faq.id}>
                  <TouchableOpacity
                    style={[
                      styles.faqRow,
                      !isLast && !isOpen && {
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        borderBottomColor: colors.separator,
                      },
                    ]}
                    activeOpacity={0.7}
                    onPress={() => toggleExpanded(faq.id)}
                  >
                    <Text style={[styles.faqQuestion, { color: colors.textPrimary }]} numberOfLines={isOpen ? undefined : 2}>
                      {faq.question}
                    </Text>
                    {isOpen ? (
                      <ChevronUp size={18} color={colors.textMuted} />
                    ) : (
                      <ChevronDown size={18} color={colors.textMuted} />
                    )}
                  </TouchableOpacity>
                  {isOpen && (
                    <View
                      style={[
                        styles.faqAnswerWrap,
                        !isLast && {
                          borderBottomWidth: StyleSheet.hairlineWidth,
                          borderBottomColor: colors.separator,
                        },
                      ]}
                    >
                      <Text style={[styles.faqAnswer, { color: colors.textSecondary }]}>
                        {faq.answer}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.bottomActions}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.surface }]}
            activeOpacity={0.7}
            onPress={() => {
              sounds().play('tap');
              router.push('/help-tickets');
            }}
          >
            <Ticket size={18} color={colors.textPrimary} />
            <Text style={[styles.actionBtnText, { color: colors.textPrimary }]}>
              {t('settings.helpMyTickets')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: colors.accent }]}
            activeOpacity={0.8}
            onPress={() => {
              sounds().play('tap');
              router.push('/help-contact');
            }}
          >
            <MessageSquare size={18} color={colors.inverseText} />
            <Text style={[styles.primaryBtnText, { color: colors.inverseText }]}>
              {t('settings.helpContactSupport')}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    container: { flex: 1, backgroundColor: colors.background },
    scrollContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 48 },
    header: { paddingVertical: 16 },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.textPrimary,
      fontFamily: 'Georgia',
    },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 12,
      marginBottom: 18,
    },
    searchInput: {
      flex: 1,
      fontSize: 15,
      paddingVertical: 0,
    },
    sectionHeading: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textMuted,
      letterSpacing: 1.2,
      marginTop: 8,
      marginBottom: 10,
      marginLeft: 4,
    },
    categoryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginBottom: 10,
    },
    categoryCard: {
      width: '48%',
      padding: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: 'transparent',
      gap: 8,
    },
    categoryCardActive: {
      borderWidth: 1.5,
    },
    categoryIcon: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    categoryName: { fontSize: 14, fontWeight: '600', lineHeight: 18 },
    categoryCount: { fontSize: 12 },
    stateWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 32, gap: 12 },
    stateText: { fontSize: 14, textAlign: 'center' },
    retryBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 },
    retryBtnText: { fontSize: 14, fontWeight: '600' },
    faqGroup: {
      borderRadius: 14,
      overflow: 'hidden',
    },
    faqRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 14,
      gap: 10,
    },
    faqQuestion: { flex: 1, fontSize: 14, fontWeight: '600', lineHeight: 20 },
    faqAnswerWrap: {
      paddingHorizontal: 14,
      paddingBottom: 14,
    },
    faqAnswer: {
      fontSize: 14,
      lineHeight: 22,
    },
    bottomActions: { marginTop: 24, gap: 10 },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      borderRadius: 12,
      gap: 8,
    },
    actionBtnText: { fontSize: 15, fontWeight: '600' },
    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      borderRadius: 12,
      gap: 8,
    },
    primaryBtnText: { fontSize: 15, fontWeight: '600' },
  });
}
