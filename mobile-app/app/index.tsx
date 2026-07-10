import { View, Text, Image, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Link } from 'expo-router';
import { Heart, Bookmark, MessageCircle, Share2, Eye } from 'lucide-react-native';
import { useArticles, useHighlights, useStories, useSocialActions, useAuthState } from '../hooks/useApi';
import { useMemo, useState } from 'react';
import type { Story } from '../packages/api-client/src/types/index';

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
  const { user, isAuthenticated } = useAuthState();
  const { data: articlesData, isLoading: articlesLoading, error: articlesError, refetch: refetchArticles } = useArticles(1, 10);
  const { data: highlightsData, isLoading: highlightsLoading, error: highlightsError } = useHighlights(1, 10);
  const { data: storiesData } = useStories();
  const { toggleLike, toggleBookmark } = useSocialActions();

  const [viewedStories, setViewedStories] = useState<Set<string>>(new Set());

  const articles = articlesData?.data || [];
  const highlights = highlightsData?.data || [];
  const stories = storiesData || [];

  const featured = articles.find((a) => a.featured) || articles[0];
  const rest = featured ? articles.filter((a) => a.id !== featured.id) : articles;

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

  const handleLike = async (slug: string) => {
    await toggleLike(slug);
    refetchArticles();
  };

  const handleBookmark = async (slug: string) => {
    await toggleBookmark(slug);
    refetchArticles();
  };

  if (articlesLoading || highlightsLoading) {
    return (
      <ScrollView style={{ backgroundColor: '#f7f4ee', flex: 1 }}>
        <View style={{ padding: 40, alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#000000" />
          <Text style={{ marginTop: 12, color: '#666666' }}>Loading content...</Text>
        </View>
      </ScrollView>
    );
  }

  if (articlesError || highlightsError) {
    return (
      <ScrollView style={{ backgroundColor: '#f7f4ee', flex: 1 }}>
        <View style={{ padding: 40, alignItems: 'center' }}>
          <Text style={{ color: '#e11d48', fontSize: 16 }}>Failed to load content</Text>
          <TouchableOpacity onPress={refetchArticles} style={{ marginTop: 16 }}>
            <Text style={{ color: '#d97706', fontWeight: '600' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: '#f7f4ee', flex: 1 }}>
      <ScrollView horizontal style={{ paddingHorizontal: 16, paddingVertical: 12, gap: 10 }} showsHorizontalScrollIndicator={false}>
        {isAuthenticated && user && (
          <Link href="/profile" asChild>
            <TouchableOpacity style={{ alignItems: 'center', width: 64, marginRight: 6 }}>
              <View style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 3, borderColor: '#d97706', padding: 2 }}>
                <Image source={{ uri: user.avatar || 'https://via.placeholder.com/64' }} style={{ width: '100%', height: '100%', borderRadius: 28 }} />
              </View>
              <Text style={{ 
                fontSize: 10, 
                textAlign: 'center', 
                fontWeight: '600', 
                marginTop: 5, 
                color: '#000000', 
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
                  borderColor: unviewed ? '#d97706' : '#e5e5e5',
                  padding: 2,
                }}>
                  <Image source={{ uri: s.avatar || 'https://via.placeholder.com/64' }} style={{ width: '100%', height: '100%', borderRadius: 28 }} />
                </View>
                <Text style={{
                  fontSize: 10, fontWeight: '600', marginTop: 5,
                  color: unviewed ? '#000000' : '#999999',
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
                <Image source={{ uri: featured.cover || 'https://via.placeholder.com/400x500' }} style={{ width: '100%', height: '100%' }} />
                <View style={{ position: 'absolute', top: 12, left: 12, backgroundColor: '#ffffff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                  <Text style={{ fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, color: '#000000' }}>Feature</Text>
                </View>
              </View>
            </TouchableOpacity>
          </Link>
          <Text style={{ fontSize: 10, fontWeight: '600', color: '#d97706', textTransform: 'uppercase', letterSpacing: 1 }}>
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
            <Link href={`/author/${featured.author?.id}`} asChild>
              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Image source={{ uri: featured.author?.avatar || 'https://via.placeholder.com/36' }} style={{ width: 36, height: 36, borderRadius: 18 }} />
                <View>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#000000' }}>{featured.author?.name}</Text>
                  <Text style={{ fontSize: 10, color: '#999999' }}>{formatRelativeTime(featured.publishedAt || featured.createdAt)}</Text>
                </View>
              </TouchableOpacity>
            </Link>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <TouchableOpacity onPress={() => handleLike(featured.slug)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Heart size={22} color={featured.isLiked ? '#e11d48' : '#0a0a0a'} fill={featured.isLiked ? '#e11d48' : 'none'} />
              </TouchableOpacity>
              <Link href={`/article/${featured.slug}`} asChild>
                <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <MessageCircle size={22} color="#0a0a0a" />
                </TouchableOpacity>
              </Link>
              <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Share2 size={22} color="#0a0a0a" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleBookmark(featured.slug)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Bookmark size={22} color={featured.isBookmarked ? '#d97706' : '#0a0a0a'} fill={featured.isBookmarked ? '#d97706' : 'none'} />
              </TouchableOpacity>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
            <Eye size={12} color="#a3a3a3" />
            <Text style={{ fontSize: 11, color: '#a3a3a3', fontWeight: '500' }}>
              {(featured.views || 0).toLocaleString()} views
            </Text>
            <Text style={{ fontSize: 11, color: '#a3a3a3' }}>·</Text>
            <Text style={{ fontSize: 11, color: '#a3a3a3', fontWeight: '500' }}>
              {(featured.likesCount || 0).toLocaleString()} likes
            </Text>
          </View>
        </View>
      )}

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

      <View style={{ paddingHorizontal: 16, paddingBottom: 100, paddingTop: 16 }}>
        {rest.map((a) => {
          return (
            <View key={a.slug} style={{ marginBottom: 26 }}>
              <Link href={`/article/${a.slug}`} asChild>
                <TouchableOpacity style={{ flexDirection: 'row', gap: 16 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 9, fontWeight: '600', color: '#d97706', textTransform: 'uppercase', letterSpacing: 1 }}>{a.category?.name}</Text>
                    <Text style={{ fontSize: 16, fontWeight: '500', color: '#000000', marginTop: 4, lineHeight: 20 }}>{a.title}</Text>
                    <Text style={{ fontSize: 12, color: '#666666', marginTop: 4 }}>
                      {a.author?.name} · {formatRelativeTime(a.publishedAt || a.createdAt)} · {a.readMinutes} min
                    </Text>
                  </View>
                  <Image source={{ uri: a.cover || 'https://via.placeholder.com/80' }} style={{ width: 80, height: 80, borderRadius: 8 }} />
                </TouchableOpacity>
              </Link>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Eye size={12} color="#a3a3a3" />
                  <Text style={{ fontSize: 11, color: '#a3a3a3', fontWeight: '500' }}>
                    {(a.views || 0).toLocaleString()} views
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <TouchableOpacity onPress={() => handleLike(a.slug)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                    <Heart size={16} color={a.isLiked ? '#e11d48' : '#525252'} fill={a.isLiked ? '#e11d48' : 'none'} />
                  </TouchableOpacity>
                  <Link href={`/article/${a.slug}`} asChild>
                    <TouchableOpacity hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                      <MessageCircle size={16} color="#525252" />
                    </TouchableOpacity>
                  </Link>
                  <TouchableOpacity hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                    <Share2 size={16} color="#525252" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleBookmark(a.slug)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                    <Bookmark size={16} color={a.isBookmarked ? '#d97706' : '#525252'} fill={a.isBookmarked ? '#d97706' : 'none'} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}
