import { View, Text, Image, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Link } from 'expo-router';
import { Eye } from 'lucide-react-native';
import { useArticles, useHighlights, useStories, useSocialActions, useAuthState } from '../hooks/useApi';
import { useMemo, useState, useCallback } from 'react';
import type { Article, Story } from '@vellbase/api-client/types';
import ShimmerImage from '../components/ShimmerImage';
import { Avatar } from '../components/Avatar';
import { ArticleActions } from '../components/ArticleActions';
import { useTheme } from '../context/ThemeProvider';
import { useI18n } from '../context/I18nProvider';

const STORY_24H = 24 * 60 * 60 * 1000;

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = Date.now();
  const diff = now - date.getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return date.toLocaleDateString();
}

export default function FeedPage() {
  const { theme: { colors } } = useTheme();
  const { t } = useI18n();
  const { user, isAuthenticated } = useAuthState();
  const { data: articlesData, isLoading: articlesLoading, error: articlesError, refetch: refetchArticles } = useArticles(1, 10);
  const { data: highlightsData, isLoading: highlightsLoading, error: highlightsError } = useHighlights(1, 10);
  const { data: storiesData } = useStories();
  const { toggleLike, toggleBookmark } = useSocialActions();

  const [viewedStories, setViewedStories] = useState<Set<string>>(new Set());
  const [likedMap, setLikedMap] = useState<Map<string, boolean>>(new Map());
  const [bookmarkedMap, setBookmarkedMap] = useState<Map<string, boolean>>(new Map());

  const articles = articlesData?.data || [];
  const highlights = highlightsData?.data || [];
  const stories = storiesData || [];

  const featured = articles.find((a) => a.featured) || articles[0];
  const rest = featured ? articles.filter((a) => a.id !== featured.id) : articles;

  const isArticleLiked = useCallback((article: Article): boolean => {
    const local = likedMap.get(article.slug);
    return local !== undefined ? local : article.isLiked;
  }, [likedMap]);

  const isArticleBookmarked = useCallback((article: Article): boolean => {
    const local = bookmarkedMap.get(article.slug);
    return local !== undefined ? local : article.isBookmarked;
  }, [bookmarkedMap]);

  const getLikesCount = useCallback((article: Article): number => {
    const local = likedMap.get(article.slug);
    if (local === undefined) return article.likesCount;
    return local ? article.likesCount + 1 : Math.max(0, article.likesCount - 1);
  }, [likedMap]);

  const handleLike = async (slug: string) => {
    const article = articles.find(a => a.slug === slug);
    if (!article) return;
    const next = !isArticleLiked(article);
    setLikedMap(prev => {
      const newMap = new Map(prev);
      newMap.set(slug, next);
      return newMap;
    });
    const result = await toggleLike(slug);
    if (typeof result !== 'boolean') {
      setLikedMap(prev => {
        const newMap = new Map(prev);
        newMap.delete(slug);
        return newMap;
      });
    } else {
      setLikedMap(prev => {
        const newMap = new Map(prev);
        newMap.set(slug, result);
        return newMap;
      });
    }
  };

  const handleBookmark = async (slug: string) => {
    const article = articles.find(a => a.slug === slug);
    if (!article) return;
    const next = !isArticleBookmarked(article);
    setBookmarkedMap(prev => {
      const newMap = new Map(prev);
      newMap.set(slug, next);
      return newMap;
    });
    const result = await toggleBookmark(slug);
    if (typeof result !== 'boolean') {
      setBookmarkedMap(prev => {
        const newMap = new Map(prev);
        newMap.delete(slug);
        return newMap;
      });
    } else {
      setBookmarkedMap(prev => {
        const newMap = new Map(prev);
        newMap.set(slug, result);
        return newMap;
      });
    }
  };

  const activeStoryAuthors = useMemo(() => {
    const authorMap = new Map<string, any>();
    stories.forEach((story) => {
      if (Date.now() - new Date(story.createdAt).getTime() < STORY_24H) {
        if (!authorMap.has(story.authorId)) {
          authorMap.set(story.authorId, story.author);
        }
      }
    });
    return Array.from(authorMap.values());
  }, [stories]);

  const getStoriesByAuthor = (authorId: string): Story[] => {
    return stories.filter(
      (s) => s.authorId === authorId && Date.now() - new Date(s.createdAt).getTime() < STORY_24H
    );
  };

  const hasUnviewedStories = (authorId: string): boolean => {
    const authorStories = getStoriesByAuthor(authorId);
    return authorStories.some((s) => !viewedStories.has(s.id));
  };

  if (articlesLoading || highlightsLoading) {
    return (
      <ScrollView style={{ backgroundColor: colors.background, flex: 1 }}>
        <View style={{ padding: 40, alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.textPrimary} />
          <Text style={{ marginTop: 12, color: colors.textSecondary }}>Loading content...</Text>
        </View>
      </ScrollView>
    );
  }

  if (articlesError || highlightsError) {
    return (
      <ScrollView style={{ backgroundColor: colors.background, flex: 1 }}>
        <View style={{ padding: 40, alignItems: 'center' }}>
          <Text style={{ color: colors.danger, fontSize: 16 }}>Failed to load content</Text>
          <TouchableOpacity onPress={refetchArticles} style={{ marginTop: 16 }}>
            <Text style={{ color: colors.warning, fontWeight: '600' }}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: colors.background, flex: 1 }}>
      <ScrollView horizontal style={{ paddingHorizontal: 16, paddingVertical: 12, gap: 10 }} showsHorizontalScrollIndicator={false}>
        {isAuthenticated && user && (
          <Link href="/profile" asChild>
            <TouchableOpacity style={{ alignItems: 'center', width: 64, marginRight: 6 }}>
              <View style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 3, borderColor: colors.warning, padding: 2 }}>
                <Avatar uri={user.avatar} name={user.name} handle={user.handle} size={54} />
              </View>
              <Text style={{ 
                fontSize: 10, 
                textAlign: 'center', 
                fontWeight: '600', 
                marginTop: 5, 
                color: colors.textPrimary, 
                textTransform: 'uppercase',
                letterSpacing: 0.5 
                }} numberOfLines={1}>Your Story</Text>
            </TouchableOpacity>
          </Link>
        )}
        {activeStoryAuthors.map((s) => {
          const unviewed = hasUnviewedStories(s.id);
          const authorStories = getStoriesByAuthor(s.id);
          const firstStory = authorStories[0];
          if (!firstStory) return null;
          return (
            <Link key={s.id} href={`/story/${s.id}/${firstStory.id}`} asChild style={{ marginRight: 6 }}>
              <TouchableOpacity style={{ alignItems: 'center', width: 64 }}>
                <View style={{
                  width: 64, height: 64, borderRadius: 32,
                  borderWidth: 3,
                  borderColor: unviewed ? colors.warning : colors.border,
                  padding: 2,
                }}>
                  <Avatar uri={s.avatar} name={s.name} handle={s.handle} size={54} />
                </View>
                <Text style={{
                  fontSize: 10, fontWeight: '600', marginTop: 5,
                  color: unviewed ? colors.textPrimary : colors.textMuted,
                  textAlign: 'center', width: '100%',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }} numberOfLines={1}>
                  {s.publication || s.name.split(' ')[0]}
                </Text>
              </TouchableOpacity>
            </Link>
          );
        })}
      </ScrollView>

      {featured && (
        <View style={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8, width: '100%' }}>
          <Link href={`/article/${featured.slug}`} asChild>
            <TouchableOpacity>
              <View style={{ aspectRatio: 4/5, borderRadius: 16, overflow: 'hidden', marginBottom: 12, width: '100%' }}>
                <ShimmerImage
                  source={featured.cover}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                  borderRadius={16}
                />
                <View style={{ position: 'absolute', top: 12, left: 12, backgroundColor: colors.surface, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                  <Text style={{ fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, color: colors.textPrimary }}>Feature</Text>
                </View>
              </View>
            </TouchableOpacity>
          </Link>
          <Text style={{ fontSize: 10, fontWeight: '600', color: colors.warning, textTransform: 'uppercase', letterSpacing: 1 }}>
            {featured.category?.name || 'Article'} · {featured.readMinutes} min read
          </Text>
          <Link href={`/article/${featured.slug}`} asChild>
            <TouchableOpacity>
              <Text style={{ fontSize: 28, fontFamily: 'Georgia', fontStyle: 'italic', marginTop: 8, color: colors.textPrimary, lineHeight: 32 }}>
                {featured.title}
              </Text>
              <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 8, lineHeight: 20 }}>
                {featured.excerpt}
              </Text>
            </TouchableOpacity>
          </Link>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
            <Link href={`/author/${featured.author?.handle}`} asChild>
              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Avatar
                  uri={featured.author?.avatar}
                  name={featured.author?.name}
                  handle={featured.author?.handle}
                  size={36}
                />
                <View>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textPrimary }}>{featured.author?.name}</Text>
                  <Text style={{ fontSize: 10, color: colors.textMuted }}>{formatRelativeTime(featured.publishedAt || featured.createdAt)}</Text>
                </View>
              </TouchableOpacity>
            </Link>
            <ArticleActions
              articleSlug={featured.slug}
              isLiked={isArticleLiked(featured)}
              isBookmarked={isArticleBookmarked(featured)}
              likesCount={getLikesCount(featured)}
              commentsCount={featured.commentsCount || 0}
              onLikeToggle={handleLike}
              onBookmarkToggle={handleBookmark}
              size="medium"
              showShare={true}
              showCounts={false}
              tintColor={colors.textPrimary}
              activeTintColor={colors.danger}
            />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
            <Eye size={12} color={colors.textMuted} />
            <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '500' }}>
              {(featured.views || 0).toLocaleString()} views
            </Text>
            <Text style={{ fontSize: 11, color: colors.textMuted }}>·</Text>
            <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '500' }}>
              {getLikesCount(featured).toLocaleString()} likes
            </Text>
          </View>
        </View>
      )}

      <View style={{ paddingHorizontal: 16, paddingVertical: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 }}>
          <Text style={{ fontSize: 20, fontFamily: 'Georgia', fontStyle: 'italic', color: colors.textPrimary }}>Atmospherics</Text>
          <Link href="/highlights" asChild>
            <TouchableOpacity>
              <Text style={{ fontSize: 10, fontWeight: '600', color: colors.accent, textTransform: 'uppercase', letterSpacing: 1 }}>Watch All</Text>
            </TouchableOpacity>
          </Link>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ gap: 8 }}>
          {highlights.slice(0, 4).map((r) => (
            <Link key={r.id} href="/highlights" asChild style={{ marginRight: 10 }}>
              <TouchableOpacity style={{ width: 150, aspectRatio: 9/16, borderRadius: 12, overflow: 'hidden', position: 'relative' }}>
                <Image source={{ uri: r.cover || r.thumbnailUrl || 'https://via.placeholder.com/150x267' }} style={{ width: '100%', height: '100%' }} />
                <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.overlay, padding: 12 }}>
                  <Text style={{ fontSize: 10, color: colors.inverseText, opacity: 0.8 }}>{r.author?.handle || r.handle}</Text>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: colors.inverseText, marginTop: 4 }}>{r.title}</Text>
                </View>
              </TouchableOpacity>
            </Link>
          ))}
        </ScrollView>
      </View>

      <View style={{ paddingHorizontal: 16, paddingBottom: 100, paddingTop: 16 }}>
        {rest.map((a) => {
          const liked = isArticleLiked(a);
          const bookmarked = isArticleBookmarked(a);
          const likeCount = getLikesCount(a);

          return (
            <View key={a.slug} style={{ marginBottom: 26 }}>
              <Link href={`/article/${a.slug}`} asChild>
                <TouchableOpacity style={{ flexDirection: 'row', gap: 16 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 9, fontWeight: '600', color: colors.warning, textTransform: 'uppercase', letterSpacing: 1 }}>{a.category?.name}</Text>
                    <Text style={{ fontSize: 16, fontWeight: '500', color: colors.textPrimary, marginTop: 4, lineHeight: 20 }}>{a.title}</Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>
                      {a.author?.name} · {formatRelativeTime(a.publishedAt || a.createdAt)} · {a.readMinutes} min
                    </Text>
                  </View>
                  <Image source={{ uri: a.cover || 'https://via.placeholder.com/80' }} style={{ width: 80, height: 80, borderRadius: 8 }} />
                </TouchableOpacity>
              </Link>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Eye size={12} color={colors.textMuted} />
                  <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '500' }}>
                    {(a.views || 0).toLocaleString()} views
                  </Text>
                </View>
                <ArticleActions
                  articleSlug={a.slug}
                  isLiked={liked}
                  isBookmarked={bookmarked}
                  likesCount={likeCount}
                  commentsCount={a.commentsCount || 0}
                  onLikeToggle={handleLike}
                  onBookmarkToggle={handleBookmark}
                  size="small"
                  showShare={true}
                  showCounts={false}
                  variant="compact"
                  tintColor={colors.textSecondary}
                  activeTintColor={colors.danger}
                />
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}
