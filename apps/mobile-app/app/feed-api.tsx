import { View, Text, Image, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { Link } from 'expo-router';
import { Eye } from 'lucide-react-native';
import { useArticles, useHighlights, useStories, useSocialActions, useAuthState } from '../hooks/useApi';
import { useState, useMemo, useCallback } from 'react';
import type { Article, Highlight, Story } from '@vellum/api-client/types';
import { Avatar } from '../components/Avatar';
import { ArticleActions } from '../components/ArticleActions';

const STORY_24H = 24 * 60 * 60 * 1000;

// Skeleton loading component
function ArticleSkeleton() {
  return (
    <View style={{ marginBottom: 26 }}>
      <View style={{ flexDirection: 'row', gap: 16 }}>
        <View style={{ flex: 1 }}>
          <View style={{ height: 10, width: 80, backgroundColor: '#e5e5e5', borderRadius: 4 }} />
          <View style={{ height: 20, width: '100%', backgroundColor: '#e5e5e5', borderRadius: 4, marginTop: 8 }} />
          <View style={{ height: 14, width: 150, backgroundColor: '#e5e5e5', borderRadius: 4, marginTop: 8 }} />
        </View>
        <View style={{ width: 80, height: 80, backgroundColor: '#e5e5e5', borderRadius: 8 }} />
      </View>
    </View>
  );
}

function FeaturedSkeleton() {
  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 }}>
      <View style={{ aspectRatio: 4/5, borderRadius: 16, backgroundColor: '#e5e5e5', marginBottom: 12 }} />
      <View style={{ height: 14, width: 100, backgroundColor: '#e5e5e5', borderRadius: 4 }} />
      <View style={{ height: 32, width: '80%', backgroundColor: '#e5e5e5', borderRadius: 4, marginTop: 8 }} />
      <View style={{ height: 18, width: '90%', backgroundColor: '#e5e5e5', borderRadius: 4, marginTop: 8 }} />
    </View>
  );
}

// Format relative time
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
  const { user, isAuthenticated, isLoading: authLoading } = useAuthState();
  const { data: articlesData, isLoading: articlesLoading, refetch: refetchArticles } = useArticles(1, 10);
  const { data: highlightsData, isLoading: highlightsLoading } = useHighlights(1, 10);
  const { data: storiesData, isLoading: storiesLoading } = useStories();
  const { toggleLike, toggleBookmark, isLoading: actionLoading } = useSocialActions();

  const [likedMap, setLikedMap] = useState<Map<string, boolean>>(new Map());
  const [bookmarkedMap, setBookmarkedMap] = useState<Map<string, boolean>>(new Map());
  const [viewedStories, setViewedStories] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);

  const articles = articlesData?.data || [];
  const highlights = highlightsData?.data || [];
  const stories = storiesData || [];

  // Featured article (first article with featured flag or first in list)
  const featured = useMemo(() => {
    return articles.find(a => a.featured) || articles[0];
  }, [articles]);

  // Rest of articles
  const rest = useMemo(() => {
    if (!featured) return articles;
    return articles.filter(a => a.id !== featured.id);
  }, [articles, featured]);

  // Active story authors (stories from last 24h)
  const activeStoryAuthors = useMemo(() => {
    const authorMap = new Map<string, any>();
    stories.forEach(story => {
      if (Date.now() - new Date(story.createdAt).getTime() < STORY_24H) {
        if (!authorMap.has(story.authorId)) {
          authorMap.set(story.authorId, story.author);
        }
      }
    });
    return Array.from(authorMap.values());
  }, [stories]);

  // Get stories for a specific author
  const getStoriesByAuthor = (authorId: string): Story[] => {
    return stories.filter(s => s.authorId === authorId);
  };

  // Check if author has unviewed stories
  const hasUnviewedStories = (authorId: string): boolean => {
    const authorStories = getStoriesByAuthor(authorId).filter(
      (s) => Date.now() - new Date(s.createdAt).getTime() < STORY_24H
    );
    return authorStories.some((s) => !viewedStories.has(s.id));
  };

  // Check if article is liked (API state + optimistic local override)
  const isArticleLiked = useCallback((article: Article): boolean => {
    const local = likedMap.get(article.slug);
    return local !== undefined ? local : article.isLiked;
  }, [likedMap]);

  // Check if article is bookmarked (API state + optimistic local override)
  const isArticleBookmarked = useCallback((article: Article): boolean => {
    const local = bookmarkedMap.get(article.slug);
    return local !== undefined ? local : article.isBookmarked;
  }, [bookmarkedMap]);

  // Get effective likes count
  const getLikesCount = useCallback((article: Article): number => {
    const local = likedMap.get(article.slug);
    if (local === undefined) return article.likesCount;
    return local ? article.likesCount + 1 : Math.max(0, article.likesCount - 1);
  }, [likedMap]);

  // Handle like toggle
  const handleLike = async (articleSlug: string) => {
    const article = articles.find(a => a.slug === articleSlug);
    if (!article) return;

    const currentLiked = isArticleLiked(article);
    const nextLiked = !currentLiked;

    setLikedMap(prev => {
      const newMap = new Map(prev);
      newMap.set(articleSlug, nextLiked);
      return newMap;
    });

    const result = await toggleLike(articleSlug);
    if (typeof result !== 'boolean') {
      setLikedMap(prev => {
        const newMap = new Map(prev);
        newMap.delete(articleSlug);
        return newMap;
      });
    } else {
      setLikedMap(prev => {
        const newMap = new Map(prev);
        newMap.set(articleSlug, result);
        return newMap;
      });
    }
  };

  // Handle bookmark toggle
  const handleBookmark = async (articleSlug: string) => {
    const article = articles.find(a => a.slug === articleSlug);
    if (!article) return;

    const currentSaved = isArticleBookmarked(article);
    const nextSaved = !currentSaved;

    setBookmarkedMap(prev => {
      const newMap = new Map(prev);
      newMap.set(articleSlug, nextSaved);
      return newMap;
    });

    const result = await toggleBookmark(articleSlug);
    if (typeof result !== 'boolean') {
      setBookmarkedMap(prev => {
        const newMap = new Map(prev);
        newMap.delete(articleSlug);
        return newMap;
      });
    } else {
      setBookmarkedMap(prev => {
        const newMap = new Map(prev);
        newMap.set(articleSlug, result);
        return newMap;
      });
    }
  };

  // Handle refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await refetchArticles();
    setRefreshing(false);
  };

  // Loading state
  if (articlesLoading || highlightsLoading) {
    return (
      <ScrollView style={{ backgroundColor: '#f7f4ee', flex: 1 }}>
        <View style={{ padding: 20 }}>
          <ActivityIndicator size="large" color="#000000" />
          <Text style={{ textAlign: 'center', marginTop: 10, color: '#666666' }}>Loading content...</Text>
        </View>
        <FeaturedSkeleton />
        <View style={{ paddingHorizontal: 16 }}>
          {[1, 2, 3].map(i => <ArticleSkeleton key={i} />)}
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView 
      style={{ backgroundColor: '#f7f4ee', flex: 1 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Stories section */}
      <ScrollView horizontal style={{ paddingHorizontal: 16, paddingVertical: 12, gap: 10 }} showsHorizontalScrollIndicator={false}>
        {/* User's own story */}
        {isAuthenticated && user && (
          <Link href="/compose" asChild>
            <TouchableOpacity style={{ alignItems: 'center', width: 64, marginRight: 6 }}>
              <View style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 3, borderColor: '#d97706', padding: 2 }}>
                <Avatar uri={user.avatar} name={user.name} handle={user.handle} size={54} />
              </View>
              <Text style={{ fontSize: 10, textAlign: 'center', fontWeight: '600', marginTop: 5, color: '#000000', textTransform: 'uppercase', letterSpacing: 0.5 }} numberOfLines={1}>Your Story</Text>
            </TouchableOpacity>
          </Link>
        )}
        
        {/* Other authors' stories */}
        {activeStoryAuthors.map((author) => {
          const unviewed = hasUnviewedStories(author.id);
          const authorStories = getStoriesByAuthor(author.id).filter(
            (st) => Date.now() - new Date(st.createdAt).getTime() < STORY_24H
          );
          const firstStory = authorStories[0];
          
          if (!firstStory) return null;
          
          return (
            <Link key={author.id} href={`/story/${author.id}/${firstStory.id}`} asChild style={{ marginRight: 6 }}>
              <TouchableOpacity style={{ alignItems: 'center', width: 64 }}>
                <View style={{
                  width: 64, height: 64, borderRadius: 32,
                  borderWidth: 3,
                  borderColor: unviewed ? '#d97706' : '#e5e5e5',
                  padding: 2,
                }}>
                  <Avatar uri={author.avatar} name={author.name} handle={author.handle} size={54} />
                </View>
                <Text style={{
                  fontSize: 10, fontWeight: '600', marginTop: 5,
                  color: unviewed ? '#000000' : '#999999',
                  textAlign: 'center', width: '100%',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }} numberOfLines={1}>
                  {author.handle}
                </Text>
              </TouchableOpacity>
            </Link>
          );
        })}
      </ScrollView>

      {/* Featured article */}
      {featured && (
        <View style={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8, width: '100%' }}>
          <Link href={`/article/${featured.slug}`} asChild>
            <TouchableOpacity>
              <View style={{ aspectRatio: 4/5, borderRadius: 16, overflow: 'hidden', marginBottom: 12, width: '100%' }}>
                <Image source={{ uri: featured.cover || 'https://via.placeholder.com/400x500' }} style={{ width: '100%', height: '100%' }} />
                <View style={{ position: 'absolute', top: 12, left: 12, backgroundColor: '#ffffff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                  <Text style={{ fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, color: '#000000' }}>Feature</Text>
                </View>
              </View>
            </TouchableOpacity>
          </Link>
          <Text style={{ fontSize: 10, fontWeight: '600', color: featured.category?.tint || '#d97706', textTransform: 'uppercase', letterSpacing: 1 }}>
            {featured.category?.name || 'Article'} · {featured.readMinutes} min read
          </Text>
          <Link href={`/article/${featured.slug}`} asChild>
            <TouchableOpacity>
              <Text style={{ fontSize: 28, fontFamily: 'Georgia', fontStyle: 'italic', marginTop: 8, color: '#000000', lineHeight: 32 }}>
                {featured.title}
              </Text>
              <Text style={{ fontSize: 14, color: '#666666', marginTop: 8, lineHeight: 20 }}>
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
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#000000' }}>{featured.author?.name}</Text>
                  <Text style={{ fontSize: 10, color: '#999999' }}>{formatRelativeTime(featured.createdAt)}</Text>
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
              tintColor="#0a0a0a"
              activeTintColor="#e11d48"
            />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
            <Eye size={12} color="#a3a3a3" />
            <Text style={{ fontSize: 11, color: '#a3a3a3', fontWeight: '500' }}>
              {featured.views?.toLocaleString() || '0'} views
            </Text>
            <Text style={{ fontSize: 11, color: '#a3a3a3' }}>·</Text>
            <Text style={{ fontSize: 11, color: '#a3a3a3', fontWeight: '500' }}>
              {getLikesCount(featured).toLocaleString()} likes
            </Text>
          </View>
        </View>
      )}

      {/* Highlights section */}
      {highlights.length > 0 && (
        <View style={{ paddingHorizontal: 16, paddingVertical: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 }}>
            <Text style={{ fontSize: 20, fontFamily: 'Georgia', fontStyle: 'italic', color: '#000000' }}>Atmospherics</Text>
            <Link href="/highlights" asChild>
              <TouchableOpacity>
                <Text style={{ fontSize: 10, fontWeight: '600', color: '#ff6b6b', textTransform: 'uppercase', letterSpacing: 1 }}>Watch All</Text>
              </TouchableOpacity>
            </Link>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ gap: 8 }}>
            {highlights.slice(0, 4).map((r) => (
              <Link key={r.id} href="/highlights" asChild style={{ marginRight: 10 }}>
                <TouchableOpacity style={{ width: 150, aspectRatio: 9/16, borderRadius: 12, overflow: 'hidden', position: 'relative' }}>
                  <Image source={{ uri: r.cover || r.thumbnailUrl || 'https://via.placeholder.com/150x267' }} style={{ width: '100%', height: '100%' }} />
                  <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)', padding: 12 }}>
                    <Text style={{ fontSize: 10, color: '#ffffff', opacity: 0.8 }}>{r.author?.handle || r.handle}</Text>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#ffffff', marginTop: 4 }}>{r.title}</Text>
                  </View>
                </TouchableOpacity>
              </Link>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Articles list */}
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
                    <Text style={{ fontSize: 9, fontWeight: '600', color: a.category?.tint || '#d97706', textTransform: 'uppercase', letterSpacing: 1 }}>{a.category?.name || 'Article'}</Text>
                    <Text style={{ fontSize: 16, fontWeight: '500', color: '#000000', marginTop: 4, lineHeight: 20 }}>{a.title}</Text>
                    <Text style={{ fontSize: 12, color: '#666666', marginTop: 4 }}>
                      {a.author?.name} · {formatRelativeTime(a.createdAt)} · {a.readMinutes} min
                    </Text>
                  </View>
                  <Image source={{ uri: a.cover || 'https://via.placeholder.com/80' }} style={{ width: 80, height: 80, borderRadius: 8 }} />
                </TouchableOpacity>
              </Link>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Eye size={12} color="#a3a3a3" />
                  <Text style={{ fontSize: 11, color: '#a3a3a3', fontWeight: '500' }}>
                    {a.views?.toLocaleString() || '0'} views
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
                  tintColor="#525252"
                  activeTintColor="#e11d48"
                />
              </View>
            </View>
          );
        })}
        
        {/* Empty state */}
        {articles.length === 0 && !articlesLoading && (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <Text style={{ fontSize: 18, color: '#999999', textAlign: 'center' }}>No articles found</Text>
            <Text style={{ fontSize: 14, color: '#999999', marginTop: 8, textAlign: 'center' }}>Check back later for new content</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}