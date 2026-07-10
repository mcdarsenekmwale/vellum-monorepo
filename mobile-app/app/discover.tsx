import { View, Text, Image, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Search, TrendingUp } from 'lucide-react-native';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { useArticles, useCategories } from '../hooks/useApi';
import { apiClient } from '../lib/api';
import type { Article, Category } from '../packages/api-client/src/types/index';

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

export default function DiscoverPage() {
  const [query, setQuery] = useState('');
  const { data: articlesData, isLoading: articlesLoading, error: articlesError, refetch: refetchArticles } = useArticles(1, 10);
  const { data: categoriesData, isLoading: categoriesLoading, error: categoriesError } = useCategories();
  const [searchResults, setSearchResults] = useState<{ stories: Article[]; people: any[] } | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  const articles = articlesData?.data || [];
  const categories = categoriesData || [];
  const trending = articles.slice(0, 3);

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    setSearchLoading(true);
    try {
      const res = await apiClient.search(searchQuery);
      setSearchResults({
        stories: res.articles,
        people: res.users,
      });
    } catch (err) {
      console.error('Search failed:', err);
      setSearchResults({ stories: [], people: [] });
    } finally {
      setSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      performSearch(query);
    }, 300);
    return () => clearTimeout(timeout);
  }, [query, performSearch]);

  const isLoading = articlesLoading || categoriesLoading;
  const hasError = articlesError || categoriesError;

  if (isLoading) {
    return (
      <ScrollView style={{ backgroundColor: '#f7f4ee', flex: 1 }}>
        <View style={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#e5e5e5', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10 }}>
            <Search size={16} color="#999999" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search stories, people, publications…"
              placeholderTextColor="#999999"
              style={{ flex: 1, fontSize: 14, color: '#000000' }}
            />
          </View>
        </View>
        <View style={{ padding: 40, alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#000000" />
          <Text style={{ marginTop: 12, color: '#666666' }}>Loading discover...</Text>
        </View>
      </ScrollView>
    );
  }

  if (hasError) {
    return (
      <ScrollView style={{ backgroundColor: '#f7f4ee', flex: 1 }}>
        <View style={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#e5e5e5', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10 }}>
            <Search size={16} color="#999999" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search stories, people, publications…"
              placeholderTextColor="#999999"
              style={{ flex: 1, fontSize: 14, color: '#000000' }}
            />
          </View>
        </View>
        <View style={{ padding: 40, alignItems: 'center' }}>
          <Text style={{ color: '#e11d48', fontSize: 16 }}>Failed to load discover</Text>
          <TouchableOpacity onPress={refetchArticles} style={{ marginTop: 16 }}>
            <Text style={{ color: '#d97706', fontWeight: '600' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: '#f7f4ee', flex: 1 }}>
      <View style={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#e5e5e5', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10 }}>
          <Search size={16} color="#999999" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search stories, people, publications…"
            placeholderTextColor="#999999"
            style={{ flex: 1, fontSize: 14, color: '#000000' }}
          />
        </View>
      </View>

      {query.trim() ? (
        <>
          <View style={{ paddingHorizontal: 24, paddingVertical: 16 }}>
            <Text style={{ fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, color: '#999999', marginBottom: 16 }}>
              People · {searchResults?.people.length ?? 0}
            </Text>
            {searchLoading ? (
              <ActivityIndicator size="small" color="#000000" />
            ) : searchResults?.people.length === 0 ? (
              <Text style={{ fontSize: 14, color: '#666666' }}>No matches.</Text>
            ) : (
              <View style={{ gap: 16 }}>
                {searchResults?.people.map((p) => (
                  <Link key={p.id} href={`/author/${p.id}`} asChild>
                    <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <Image source={{ uri: p.avatar || 'https://via.placeholder.com/44' }} style={{ width: 44, height: 44, borderRadius: 22 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: '500', color: '#000000' }}>{p.name}</Text>
                        <Text style={{ fontSize: 12, color: '#666666' }}>{p.handle}</Text>
                      </View>
                      <Text style={{ fontSize: 10, fontWeight: '600', color: '#ff6b6b', textTransform: 'uppercase', letterSpacing: 1 }}>View</Text>
                    </TouchableOpacity>
                  </Link>
                ))}
              </View>
            )}
          </View>

          <View style={{ paddingHorizontal: 24, paddingBottom: 100 }}>
            <Text style={{ fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, color: '#999999', marginBottom: 16 }}>
              Stories · {searchResults?.stories.length ?? 0}
            </Text>
            {searchLoading ? (
              <ActivityIndicator size="small" color="#000000" />
            ) : searchResults?.stories.length === 0 ? (
              <Text style={{ fontSize: 14, color: '#666666' }}>No matches.</Text>
            ) : (
              <View style={{ gap: 24 }}>
                {searchResults?.stories.map((a) => (
                  <Link key={a.slug} href={`/article/${a.slug}`} asChild>
                    <TouchableOpacity style={{ flexDirection: 'row', gap: 16 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 9, fontWeight: '600', color: '#ff6b6b', textTransform: 'uppercase', letterSpacing: 1 }}>{a.category?.name}</Text>
                        <Text style={{ fontSize: 16, fontWeight: '500', color: '#000000', marginTop: 4 }}>{a.title}</Text>
                        <Text style={{ fontSize: 12, color: '#666666', marginTop: 4 }}>{a.author?.name}</Text>
                      </View>
                      <Image source={{ uri: a.cover || 'https://via.placeholder.com/64' }} style={{ width: 64, height: 64, borderRadius: 8 }} />
                    </TouchableOpacity>
                  </Link>
                ))}
              </View>
            )}
          </View>
        </>
      ) : (
        <>
          <View style={{ paddingHorizontal: 24, paddingVertical: 16 }}>
            <Text style={{ fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, color: '#999999', marginBottom: 16 }}>Browse by section</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {categories.map((c) => (
                <Link key={c.name} href={`/category/${c.slug}`} asChild>
                  <TouchableOpacity style={{ width: '47%', aspectRatio: 6/4, borderRadius: 16, backgroundColor: c.tint, padding: 12, justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 9, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, color: '#666666' }}>Section</Text>
                    <Text style={{ fontSize: 20, fontFamily: 'Georgia', fontStyle: 'italic', color: '#000000' }}>{c.name}</Text>
                  </TouchableOpacity>
                </Link>
              ))}
            </View>
          </View>

          <View style={{ paddingHorizontal: 24, paddingBottom: 100 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <TrendingUp size={16} color="#ff6b6b" />
              <Text style={{ fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, color: '#999999' }}>Trending now</Text>
            </View>
            <View style={{ gap: 24 }}>
              {trending.map((a, i) => (
                <Link key={a.slug} href={`/article/${a.slug}`} asChild>
                  <TouchableOpacity style={{ flexDirection: 'row', gap: 16 }}>
                    <Text style={{ fontSize: 32, fontFamily: 'Georgia', fontStyle: 'italic', color: '#e5e5e5', width: 32, textAlign: 'center' }}>{i + 1}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 9, fontWeight: '600', color: '#ff6b6b', textTransform: 'uppercase', letterSpacing: 1 }}>{a.category?.name}</Text>
                      <Text style={{ fontSize: 16, fontWeight: '500', color: '#000000', marginTop: 4 }}>{a.title}</Text>
                      <Text style={{ fontSize: 11, color: '#666666', marginTop: 4 }}>{a.readMinutes} min · {formatRelativeTime(a.publishedAt || a.createdAt)}</Text>
                    </View>
                    <Image source={{ uri: a.cover || 'https://via.placeholder.com/56' }} style={{ width: 56, height: 56, borderRadius: 8 }} />
                  </TouchableOpacity>
                </Link>
              ))}
            </View>
          </View>
        </>
      )}
    </ScrollView>
  );
}
