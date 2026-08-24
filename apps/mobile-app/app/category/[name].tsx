import { View, Text, Image, TouchableOpacity, ScrollView, ActivityIndicator, StatusBar } from 'react-native';
import { useLocalSearchParams, Link } from 'expo-router';
import { useCategories, useArticles } from '../../hooks/useApi';
import { useI18n } from 'context/I18nProvider';
import { useTheme } from 'context/ThemeProvider';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CustomHeader, ThemedBackButton } from 'app/_layout';

const timeAgo = (date: Date) => {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
};

export default function CategoryPage() {
  const { name } = useLocalSearchParams();
  const { theme: { colors } } = useTheme();
  const { t } = useI18n();
  const { data: categoriesData, isLoading: categoriesLoading, error: categoriesError, refetch: refetchCategories } = useCategories();
  const { data: articlesData, isLoading: articlesLoading, error: articlesError, refetch: refetchArticles } = useArticles(1, 100);

  const categoryName = decodeURIComponent(Array.isArray(name) ? name[0] : name || '').toLowerCase();
  const category = categoriesData?.find((c) => c.name.toLowerCase() === categoryName);
  const categoryArticles = articlesData?.data.filter((a) => a.category.name.toLowerCase() === categoryName) || [];

  const loading = categoriesLoading || articlesLoading;
  const error = categoriesError || articlesError;

  const handleRetry = () => {
    refetchCategories();
    refetchArticles();
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#ff6b6b" />
      </View>
    );
  }

  if (error || !category) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Text style={{ fontSize: 16, color: colors.textMuted, alignItems: 'center' }}>{error || 'Category not found'}</Text>
        <TouchableOpacity onPress={handleRetry} style={{ marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: colors.primary, borderRadius: 20 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.primaryText }}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
      
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <CustomHeader
     
        left={<ThemedBackButton />}
        title={t('settings.contactLabelCategory')}
        edges={['left', 'right']}

      />
      <ScrollView style={{ backgroundColor: colors.background, flex: 1 }}>
        <View style={{ paddingHorizontal: 24, paddingVertical: 24 }}>
          <Text style={{ fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, color: colors.textMuted }}>Section</Text>
          <Text style={{ fontSize: 32, fontFamily: 'Georgia', fontStyle: 'italic', marginTop: 8, color: colors.text }}>{category.name}</Text>
          <Text style={{ fontSize: 14, color: colors.textMuted, marginTop: 8 }}>
            {categoryArticles.length} stories in this section
          </Text>
        </View>

        <View style={{ paddingHorizontal: 24, paddingBottom: 100 }}>
          <View style={{ gap: 24 }}>
            {categoryArticles.map((a) => (
              <Link key={a.slug} href={`/article/${a.slug}`} asChild>
                <TouchableOpacity style={{ flexDirection: 'row', gap: 16 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 9, fontWeight: '600', color: '#ff6b6b', textTransform: 'uppercase', letterSpacing: 1 }}>{a.category.name}</Text>
                    <Text style={{ fontSize: 16, fontWeight: '500', color: '#000000', marginTop: 4 }}>{a.title}</Text>
                    <Text style={{ fontSize: 12, color: '#666666', marginTop: 4 }}>
                      {a.author.name} · {timeAgo(new Date(a.publishedAt || a.createdAt))} · {a.readMinutes} min
                    </Text>
                  </View>
                  <Image source={{ uri: a.cover || '' }} style={{ width: 80, height: 80, borderRadius: 8 }} />
                </TouchableOpacity>
              </Link>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
    