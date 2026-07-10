import { View, Text, Image, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, Link } from 'expo-router';
import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../lib/api';
import type { User, Article } from '../../lib/api';

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

export default function AuthorPage() {
  const { id } = useLocalSearchParams();
  const [author, setAuthor] = useState<User | null>(null);
  const [authorArticles, setAuthorArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const handle = Array.isArray(id) ? id[0] : id;
      if (!handle) {
        setError('Invalid author ID');
        setLoading(false);
        return;
      }
      const [userRes, articlesRes] = await Promise.all([
        apiClient.getUser(handle),
        apiClient.getArticlesByAuthor(handle),
      ]);
      setAuthor(userRes);
      setAuthorArticles(articlesRes.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load author');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#f7f4ee', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#ff6b6b" />
      </View>
    );
  }

  if (error || !author) {
    return (
      <View style={{ flex: 1, backgroundColor: '#f7f4ee', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Text style={{ fontSize: 16, color: '#666666', textAlign: 'center' }}>{error || 'Author not found'}</Text>
        <TouchableOpacity onPress={fetchData} style={{ marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: '#000000', borderRadius: 20 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#ffffff' }}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: '#f7f4ee', flex: 1 }}>
      <View style={{ paddingHorizontal: 24, paddingVertical: 24, alignItems: 'center' }}>
        <Image
          source={{ uri: author.avatar || '' }}
          style={{ width: 96, height: 96, borderRadius: 48, borderWidth: 2, borderColor: '#ff6b6b' }}
        />
        <Text style={{ fontSize: 28, fontFamily: 'Georgia', fontStyle: 'italic', marginTop: 16, color: '#000000' }}>{author.name}</Text>
        <Text style={{ fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, color: '#666666', marginTop: 4 }}>{author.handle}</Text>
        {author.publication && (
          <Text style={{ fontSize: 12, color: '#666666', marginTop: 4 }}>{author.publication}</Text>
        )}
        {author.bio && (
          <Text style={{ fontSize: 14, color: '#666666', marginTop: 12, textAlign: 'center', maxWidth: 280 }}>{author.bio}</Text>
        )}

        <TouchableOpacity style={{ marginTop: 20, paddingHorizontal: 32, paddingVertical: 12, backgroundColor: '#000000', borderRadius: 24 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#ffffff', textTransform: 'uppercase', letterSpacing: 1 }}>Follow</Text>
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginTop: 24, paddingVertical: 16, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#e5e5e5' }}>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 24, fontFamily: 'Georgia', fontStyle: 'italic', color: '#000000' }}>{authorArticles.length}</Text>
            <Text style={{ fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, color: '#666666', marginTop: 2 }}>Stories</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 24, fontFamily: 'Georgia', fontStyle: 'italic', color: '#000000' }}>12K</Text>
            <Text style={{ fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, color: '#666666', marginTop: 2 }}>Followers</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 24, fontFamily: 'Georgia', fontStyle: 'italic', color: '#000000' }}>847</Text>
            <Text style={{ fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, color: '#666666', marginTop: 2 }}>Following</Text>
          </View>
        </View>
      </View>

      <View style={{ paddingHorizontal: 24, paddingBottom: 100 }}>
        <Text style={{ fontSize: 20, fontFamily: 'Georgia', fontStyle: 'italic', color: '#000000', marginBottom: 16 }}>Latest stories</Text>
        <View style={{ gap: 24 }}>
          {authorArticles.map((a) => (
            <Link key={a.slug} href={`/article/${a.slug}`} asChild>
              <TouchableOpacity style={{ flexDirection: 'row', gap: 16 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 9, fontWeight: '600', color: '#ff6b6b', textTransform: 'uppercase', letterSpacing: 1 }}>{a.category.name}</Text>
                  <Text style={{ fontSize: 16, fontWeight: '500', color: '#000000', marginTop: 4 }}>{a.title}</Text>
                  <Text style={{ fontSize: 12, color: '#666666', marginTop: 4 }}>
                    {timeAgo(new Date(a.publishedAt || a.createdAt))} · {a.readMinutes} min · {a.likesCount.toLocaleString()} likes
                  </Text>
                </View>
                <Image source={{ uri: a.cover || '' }} style={{ width: 80, height: 80, borderRadius: 8 }} />
              </TouchableOpacity>
            </Link>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
