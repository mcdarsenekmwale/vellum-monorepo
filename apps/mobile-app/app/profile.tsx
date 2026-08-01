import { View, Text, Image, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Link } from 'expo-router';
import { Pencil } from 'lucide-react-native';
import { useAuthState } from '../hooks/useApi';
import { apiClient } from '../lib/api';
import { useState, useEffect } from 'react';
import type { Article } from '@vellum/api-client/types';
import { Avatar } from '../components/Avatar';

export default function ProfilePage() {
  const { user, isLoading: authLoading } = useAuthState();
  const [likedArticles, setLikedArticles] = useState<Article[]>([]);
  const [savedCount, setSavedCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [likedRes, savedRes] = await Promise.all([
        apiClient.getLikedArticles(1, 20),
        apiClient.getBookmarkedArticles(1, 20),
      ]);
      setLikedArticles(likedRes.data);
      setSavedCount(savedRes.total);
    } catch (err: any) {
      setError(err.message || 'Failed to load profile data');
    } finally {
      setIsLoading(false);
    }
  };

  const stats = [
    { label: 'Reading', value: likedArticles.length + savedCount },
    { label: 'Likes', value: likedArticles.length },
    { label: 'Replies', value: 0 },
  ];

  if (authLoading || isLoading) {
    return (
      <ScrollView style={{ backgroundColor: '#f7f4ee', flex: 1 }}>
        <View style={{ padding: 40, alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#000000" />
          <Text style={{ marginTop: 12, color: '#666666' }}>Loading profile...</Text>
        </View>
      </ScrollView>
    );
  }

  if (error) {
    return (
      <ScrollView style={{ backgroundColor: '#f7f4ee', flex: 1 }}>
        <View style={{ padding: 40, alignItems: 'center' }}>
          <Text style={{ color: '#e11d48', fontSize: 16 }}>{error}</Text>
          <TouchableOpacity onPress={loadData} style={{ marginTop: 16 }}>
            <Text style={{ color: '#d97706', fontWeight: '600' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: '#f7f4ee', flex: 1 }}>
      <View style={{ paddingHorizontal: 24, paddingVertical: 24, alignItems: 'center' }}>
        <Avatar
          uri={user?.avatar}
          name={user?.name}
          handle={user?.handle}
          size={96}
          style={{ borderWidth: 2, borderColor: '#ff6b6b' }}
          containerStyle={{ borderWidth: 2, borderColor: '#ff6b6b' }}
        />
        <Text style={{ fontSize: 32, fontFamily: 'Georgia', fontStyle: 'italic', marginTop: 16, color: '#000000' }}>{user?.name || 'Guest'}</Text>
        <Text style={{ fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, color: '#666666', marginTop: 4 }}>{user?.handle || '@guest'}</Text>
        <Text style={{ fontSize: 14, color: '#666666', marginTop: 12, textAlign: 'center', maxWidth: 280 }}>{user?.bio || 'Reader. Occasional writer.'}</Text>

        <View style={{ flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginTop: 24, paddingVertical: 16, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#e5e5e5' }}>
          {stats.map((s) => (
            <View key={s.label} style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 24, fontFamily: 'Georgia', fontStyle: 'italic', color: '#000000' }}>{s.value}</Text>
              <Text style={{ fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, color: '#666666', marginTop: 2 }}>{s.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={{ paddingHorizontal: 24, paddingBottom: 100 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Text style={{ fontSize: 20, fontFamily: 'Georgia', fontStyle: 'italic', color: '#000000' }}>Recently liked</Text>
          <Link href="/saved" asChild>
            <TouchableOpacity>
              <Text style={{ fontSize: 10, fontWeight: '600', color: '#ff6b6b', textTransform: 'uppercase', letterSpacing: 1 }}>Saved</Text>
            </TouchableOpacity>
          </Link>
        </View>

        {likedArticles.length === 0 ? (
          <Text style={{ fontSize: 14, color: '#666666' }}>Nothing liked yet — tap the heart on a story to see it here.</Text>
        ) : (
          <View style={{ gap: 24 }}>
            {likedArticles.map((a) => (
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

      <Link href="/compose" asChild>
        <TouchableOpacity style={{ position: 'absolute', bottom: -100, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: '#ff6b6b', justifyContent: 'center', alignItems: 'center', shadowColor: '#000000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 }}>
          <Pencil size={20} color="#ffffff" />
        </TouchableOpacity>
      </Link>
    </ScrollView>
  );
}
