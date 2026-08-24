import { View, Text, TextInput, TouchableOpacity, ScrollView, StatusBar, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, Animated, Keyboard } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, ImagePlus, Sparkles } from 'lucide-react-native';
import { useState, useMemo, useEffect, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCategories } from '../hooks/useApi';
import { apiClient } from '../lib/api';
import { useTheme } from 'context/ThemeProvider';
import { useI18n } from '../context/I18nProvider';

export default function ComposePage() {
  const { theme: { colors } } = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const toolbarAnimation = useRef(new Animated.Value(0)).current;

  const { data: categories, isLoading, error, refetch } = useCategories();

  useEffect(() => {
    if (categories && categories.length > 0 && !selectedCategoryId) {
      setSelectedCategoryId(categories[0].id);
    }
  }, [categories, selectedCategoryId]);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardWillShow', (e) => {
      Animated.timing(toolbarAnimation, {
        toValue: e.endCoordinates.height,
        duration: e.duration || 250,
        useNativeDriver: false,
      }).start();
    });
    const hideSub = Keyboard.addListener('keyboardWillHide', (e) => {
      Animated.timing(toolbarAnimation, {
        toValue: 0,
        duration: e.duration || 250,
        useNativeDriver: false,
      }).start();
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [toolbarAnimation]);

  const wordCount = useMemo(() => {
    return body.trim() ? body.trim().split(/\s+/).length : 0;
  }, [body]);

  const handleSubmit = async () => {
    if (!title.trim() || !body.trim() || !selectedCategoryId) {
      alert('Please fill in all fields and select a category');
      return;
    }
    setSubmitting(true);
    try {
      await apiClient.createArticle({
        title: title.trim(),
        excerpt: body.trim().slice(0, 200),
        body: [body.trim()],
        categoryId: selectedCategoryId,
        featured: false,
      });
      router.push('/');
    } catch (err: any) {
      alert(err.message || 'Failed to publish story');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSuggestTitle = () => {
    const suggestions = [
      'The Art of Slow Living',
      'Finding Beauty in the Everyday',
      'A Quiet Revolution',
      'Through the Looking Glass',
    ];
    const random = suggestions[Math.floor(Math.random() * suggestions.length)];
    setTitle(random);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]} edges={['top']}>
        <StatusBar barStyle="dark-content" backgroundColor="#faf8f4" />
        <ActivityIndicator size="large" color="#d4653a" />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 24 }]} edges={['top']}>
        <StatusBar barStyle="dark-content" backgroundColor="#faf8f4" />
        <Text style={{ fontSize: 16, color: colors.textMuted, textAlign: 'center' }}>{error}</Text>
        <TouchableOpacity onPress={refetch} style={{ marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: colors.buttonPrimary, borderRadius: 20 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.buttonText }}>{t('common.retry')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#faf8f4" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: 10 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.cancelButton}
          activeOpacity={0.7}
        >
          <ChevronLeft size={16} color={colors.textMuted} strokeWidth={2.5} />
          <Text style={styles.cancelText}>{t('common.cancel')}</Text>
        </TouchableOpacity>

        <Text style={styles.draftStatus}>DRAFT · 1 MIN</Text>

        <TouchableOpacity
          onPress={handleSubmit}
          style={[styles.publishButton, submitting && { opacity: 0.6 }]}
          activeOpacity={0.8}
          disabled={submitting}
        >
          <Text style={styles.publishText}>{submitting ? 'PUBLISHING...' : t('compose.publish')}</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
        {/* Cover Image Upload Area */}
        <TouchableOpacity style={styles.coverUpload} activeOpacity={0.7}>
          <ImagePlus size={28} color={colors.textMuted} strokeWidth={1.5} />
          <Text style={styles.coverUploadText}>ADD COVER IMAGE</Text>
        </TouchableOpacity>

        {/* Section Label */}
        <Text style={styles.sectionLabel}>SECTION</Text>

        {/* Category Pills - Horizontal Scroll */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryScroll}
          contentContainerStyle={styles.categoryScrollContent}
        >
          {categories?.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              onPress={() => setSelectedCategoryId(cat.id)}
              style={[
                styles.categoryPill,
                selectedCategoryId === cat.id && styles.categoryPillActive,
              ]}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.categoryPillText,
                selectedCategoryId === cat.id && styles.categoryPillTextActive,
              ]}>
                {cat.name.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Title Input */}
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder={t('compose.titlePlaceholder')}
          placeholderTextColor="#cccccc"
          style={styles.titleInput}
          multiline
          numberOfLines={2}
        />

        {/* Body Input */}
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder={t('compose.bodyPlaceholder')}
          placeholderTextColor="#999999"
          style={styles.bodyInput}
          multiline
          numberOfLines={30}
          textAlignVertical="top"
        />
      </ScrollView>

      {/* Bottom Toolbar */}
      <Animated.View style={[styles.bottomToolbar, { paddingBottom: toolbarAnimation }]}>
        <Text style={styles.wordCount}>{t('compose.wordCount', { count: wordCount })}</Text>
        <TouchableOpacity
          style={styles.suggestButton}
          onPress={handleSuggestTitle}
          activeOpacity={0.7}
        >
          <Sparkles size={16} color="#d4653a" strokeWidth={2} />
          <Text style={styles.suggestText}>Suggest a title</Text>
        </TouchableOpacity>
      </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#faf8f4',
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0ede8',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  cancelText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#666666',
    letterSpacing: 1.5,
  },
  draftStatus: {
    fontSize: 12,
    fontWeight: '500',
    color: '#999999',
    letterSpacing: 2,
  },
  publishButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#d4653a',
    borderRadius: 20,
  },
  publishText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 1.5,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 20,
  },
  coverUpload: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#e5e0d8',
    borderStyle: 'dashed',
    backgroundColor: '#f5f2ed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  coverUploadText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#666666',
    letterSpacing: 1.5,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#666666',
    letterSpacing: 2,
    marginTop: 28,
    marginBottom: 12,
  },
  categoryScroll: {
    flexGrow: 0,
    marginBottom: 4,
  },
  categoryScrollContent: {
    gap: 10,
    paddingRight: 24,
  },
  categoryPill: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#e5e0d8',
    backgroundColor: '#ffffff',
  },
  categoryPillActive: {
    backgroundColor: '#1a1a1a',
    borderColor: '#1a1a1a',
  },
  categoryPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666666',
    letterSpacing: 1,
  },
  categoryPillTextActive: {
    color: '#ffffff',
  },
  titleInput: {
    fontFamily: 'Georgia',
    fontStyle: 'italic',
    fontSize: 32,
    fontWeight: '400',
    color: '#000000',
    marginTop: 24,
    paddingVertical: 0,
    lineHeight: 42,
  },
  bodyInput: {
    fontSize: 16,
    color: '#333333',
    marginTop: 16,
    paddingVertical: 0,
    lineHeight: 26,
    minHeight: 200,
  },
  bottomToolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e0d8',
    backgroundColor: '#faf8f4',
  },
  wordCount: {
    fontSize: 13,
    fontWeight: '700',
    color: '#666666',
    letterSpacing: 1.5,
  },
  suggestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  suggestText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#d4653a',
    letterSpacing: 0.5,
  },
});
