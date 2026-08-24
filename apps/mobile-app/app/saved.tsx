import { View, Text, Image, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { Link } from 'expo-router';
import { Bookmark } from 'lucide-react-native';
import { apiClient } from '../lib/api';
import { useState, useEffect } from 'react';
import type { Article } from '@vellum/api-client/types';
import { useTheme } from 'context/ThemeProvider';
import { useI18n } from '../context/I18nProvider';

export default function SavedPage() {
  const { theme: { colors } } = useTheme();
  const { t } = useI18n();
  const [savedArticles, setSavedArticles] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSaved();
  }, []);

  const loadSaved = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.getBookmarkedArticles(1, 20);
      setSavedArticles(res.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load saved articles');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.emptyContent}>
        <View style={{ padding: 40, alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#000000" />
          <Text style={{ marginTop: 12, color: '#666666' }}>Loading saved articles...</Text>
        </View>
      </ScrollView>
    );
  }

  if (error) {
    return (
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.emptyContent}>
        <View style={{ padding: 40, alignItems: 'center' }}>
          <Text style={{ color: colors.danger, fontSize: 16 }}>{error}</Text>
          <TouchableOpacity onPress={loadSaved} style={{ marginTop: 16 }}>
            <Text style={{ color: colors.accent, fontWeight: '600' }}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={savedArticles.length === 0 ? styles.emptyContent : undefined}>
      {/* Subtitle */}
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        {savedArticles.length} {savedArticles.length === 1 ? 'STORY' : 'STORIES'} IN YOUR LIBRARY
      </Text>

      {savedArticles.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.iconCircle}>
            <Bookmark size={24} color={colors.textMuted} strokeWidth={1.5} />
          </View>
          <Text style={styles.emptyTitle}>{t('emptyStates.noSavedArticles')}</Text>
          <Text style={styles.emptyDescription}>
            Tap the bookmark on any story{'\n'}to keep it here.
          </Text>
          <Link href="/" asChild>
            <TouchableOpacity style={styles.browseButton} activeOpacity={0.8}>
              <Text style={[styles.browseButtonText, { color: colors.inverseText }]}>BROWSE FEED</Text>
            </TouchableOpacity>
          </Link>
        </View>
      ) : (
        <View style={styles.articlesContainer}>
          <View style={styles.articlesList}>
            {savedArticles.map((a) => (
              <Link key={a.slug} href={`/article/${a.slug}`} asChild>
                <TouchableOpacity style={styles.articleItem}>
                  <View style={styles.articleContent}>
                    <Text style={styles.category}>{a.category?.name}</Text>
                    <Text style={[styles.articleTitle, { color: colors.textPrimary }]}>{a.title}</Text>
                    <Text style={[styles.author, { color: colors.textMuted }]}>{a.author?.name}</Text>
                  </View>
                  <Image source={{ uri: a.cover || 'https://via.placeholder.com/64' }} style={styles.articleImage} />
                </TouchableOpacity>
              </Link>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    
    flex: 1,
  },
  subtitle: {
    fontSize: 10,
    fontWeight: '500',
   
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    paddingHorizontal: 24,
    paddingTop: 4,
    paddingBottom: 8,
  },
  emptyContent: {
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 40,
    paddingTop: 120,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#e8e6e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontFamily: 'Georgia',
    fontStyle: 'italic',
    fontSize: 28,
    fontWeight: '400',
    color: '#000000',
    marginTop: 28,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 15,
    color: '#666666',
    marginTop: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  browseButton: {
    backgroundColor: '#000000',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 32,
    marginTop: 28,
  },
  browseButtonText: {
    
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  articlesContainer: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 100,
  },
  articlesList: {
    gap: 24,
  },
  articleItem: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'flex-start',
  },
  articleContent: {
    flex: 1,
  },
  category: {
    fontSize: 9,
    fontWeight: '600',
    color: '#ff6b6b',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  articleTitle: {
    fontSize: 16,
    fontWeight: '500',
  
    marginTop: 4,
    lineHeight: 22,
  },
  author: {
    fontSize: 12,
    
    marginTop: 4,
  },
  articleImage: {
    width: 64,
    height: 64,
    borderRadius: 8,
  },
});


