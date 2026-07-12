import { View, Text, Image, TouchableOpacity, Dimensions, StatusBar, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { X, Heart, Send } from 'lucide-react-native';
import { useAuthState } from '../../../hooks/useApi';
import { apiClient } from '../../../lib/api';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { Story } from '../../../lib/api';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const formatStoryTimeLeft = (expiresAt: string) => {
  const remaining = new Date(expiresAt).getTime() - Date.now();
  if (remaining <= 0) return 'expired';
  const hours = Math.floor(remaining / (60 * 60 * 1000));
  const mins = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
  if (hours > 0) return `${hours}h left`;
  return `${mins}m left`;
};

export default function StoryViewer() {
  const { authorId, storyId } = useLocalSearchParams<{ authorId: string; storyId?: string }>();
  const router = useRouter();
  const { user: authUser } = useAuthState();
  const [likedStories, setLikedStories] = useState<Record<string, boolean>>({});

  const [stories, setStories] = useState<Story[]>([]);
  const [storyAuthors, setStoryAuthors] = useState<{ id: string; name: string; avatar?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [authorStories, allStories] = await Promise.all([
        apiClient.getStoriesByAuthor(authorId as string),
        apiClient.getStories(),
      ]);
      setStories(authorStories);

      // Derive unique authors from all stories
      const authorsMap = new Map<string, { id: string; name: string; avatar?: string }>();
      allStories.forEach((s) => {
        if (s.author && !authorsMap.has(s.author.id)) {
          authorsMap.set(s.author.id, {
            id: s.author.id,
            name: s.author.name,
            avatar: s.author.avatar,
          });
        }
      });
      setStoryAuthors(Array.from(authorsMap.values()));
    } catch (err: any) {
      setError(err.message || 'Failed to load stories');
    } finally {
      setLoading(false);
    }
  }, [authorId]);

  useEffect(() => {
    fetchStories();
  }, [fetchStories]);

  const authorStories = useMemo(() => {
    return stories.filter((s) => Date.now() - new Date(s.createdAt).getTime() < 24 * 60 * 60 * 1000);
  }, [stories]);

  const initialIdx = useMemo(() => {
    if (!storyId) return 0;
    const idx = authorStories.findIndex((s) => s.id === storyId);
    return Math.max(0, idx);
  }, [authorStories, storyId]);

  const [currentStoryIdx, setCurrentStoryIdx] = useState(initialIdx);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const viewedRef = useRef<Set<string>>(new Set());
  const currentStoryIdxRef = useRef(currentStoryIdx);
  const hasSetInitial = useRef(false);

  useEffect(() => {
    currentStoryIdxRef.current = currentStoryIdx;
  }, [currentStoryIdx]);

  useEffect(() => {
    if (authorStories.length > 0 && !hasSetInitial.current) {
      hasSetInitial.current = true;
      if (storyId) {
        const idx = authorStories.findIndex((s) => s.id === storyId);
        if (idx >= 0) {
          setCurrentStoryIdx(idx);
        }
      }
    }
  }, [authorStories, storyId]);

  const currentStory = authorStories[currentStoryIdx];

  const goToNext = useCallback(() => {
    const idx = currentStoryIdxRef.current;
    if (idx < authorStories.length - 1) {
      setCurrentStoryIdx(idx + 1);
      setProgress(0);
    } else {
      const currentAuthorIdx = storyAuthors.findIndex((a) => a.id === authorId);
      if (currentAuthorIdx < storyAuthors.length - 1) {
        const nextAuthor = storyAuthors[currentAuthorIdx + 1];
        const nextStories = stories.filter(
          (s) => s.authorId === nextAuthor.id && Date.now() - new Date(s.createdAt).getTime() < 24 * 60 * 60 * 1000
        );
        if (nextStories.length > 0) {
          router.replace(`/story/${nextAuthor.id}/${nextStories[0].id}`);
        } else {
          router.back();
        }
      } else {
        router.back();
      }
    }
  }, [authorStories.length, authorId, router, storyAuthors, stories]);

  const goToPrev = useCallback(() => {
    const idx = currentStoryIdxRef.current;
    if (idx > 0) {
      setCurrentStoryIdx(idx - 1);
      setProgress(0);
    } else {
      const currentAuthorIdx = storyAuthors.findIndex((a) => a.id === authorId);
      if (currentAuthorIdx > 0) {
        const prevAuthor = storyAuthors[currentAuthorIdx - 1];
        const prevStories = stories.filter(
          (s) => s.authorId === prevAuthor.id && Date.now() - new Date(s.createdAt).getTime() < 24 * 60 * 60 * 1000
        );
        if (prevStories.length > 0) {
          router.replace(`/story/${prevAuthor.id}/${prevStories[prevStories.length - 1].id}`);
        } else {
          router.back();
        }
      } else {
        router.back();
      }
    }
  }, [authorId, router, storyAuthors, stories]);

  useEffect(() => {
    if (!currentStory || isPaused) return;

    const duration = currentStory.duration || 5000;
    const intervalMs = 50;
    const increment = (intervalMs / duration) * 100;

    intervalRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          return 100;
        }
        return prev + increment;
      });
    }, intervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [currentStory?.id, isPaused]);

  useEffect(() => {
    if (progress >= 100 && currentStory) {
      goToNext();
    }
  }, [progress, currentStory?.id, goToNext]);

  useEffect(() => {
    if (currentStory && !viewedRef.current.has(currentStory.id)) {
      viewedRef.current.add(currentStory.id);
    }
  }, [currentStory?.id]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center' }}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <StatusBar barStyle="light-content" />
        <Text style={{ color: '#ffffff', fontSize: 16, textAlign: 'center' }}>{error}</Text>
        <TouchableOpacity onPress={fetchStories} style={{ marginTop: 20, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: '#ffffff', borderRadius: 20 }}>
          <Text style={{ color: '#000000', fontSize: 14, fontWeight: '600' }}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!currentStory || authorStories.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center' }}>
        <StatusBar barStyle="light-content" />
        <Text style={{ color: '#ffffff', fontSize: 16 }}>Story not available</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20 }}>
          <Text style={{ color: '#d97706', fontSize: 14, fontWeight: '600' }}>Close</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const storyLiked = likedStories[currentStory.id] || false;

  const handleLike = () => {
    setLikedStories((prev) => ({ ...prev, [currentStory.id]: !prev[currentStory.id] }));
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#000000' }}>
      <StatusBar barStyle="light-content" />

      <Image
        source={{ uri: currentStory.image }}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: SCREEN_WIDTH,
          height: SCREEN_HEIGHT,
        }}
        resizeMode="cover"
      />

      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, paddingTop: 50, paddingHorizontal: 12 }}>
        <View style={{ flexDirection: 'row', gap: 3, marginBottom: 12 }}>
          {authorStories.map((_, idx) => (
            <View
              key={idx}
              style={{
                flex: 1,
                height: 3,
                borderRadius: 2,
                backgroundColor: 'rgba(255,255,255,0.3)',
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  height: '100%',
                  width: `${idx < currentStoryIdx ? 100 : idx === currentStoryIdx ? progress : 0}%`,
                  backgroundColor: '#ffffff',
                }}
              />
            </View>
          ))}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Image
              source={{ uri: currentStory.author.avatar || authUser?.avatar || '' }}
              style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' }}
            />
            <View>
              <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '600' }}>
                {currentStory.author.name}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>
                {formatStoryTimeLeft(currentStory.expiresAt)}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <X size={24} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ position: 'absolute', top: 100, bottom: 0, left: 0, flexDirection: 'row' }}>
        <TouchableOpacity
          style={{ width: '30%', height: '100%' }}
          onPress={goToPrev}
          onPressIn={() => setIsPaused(true)}
          onPressOut={() => setIsPaused(false)}
        />
        <TouchableOpacity
          style={{ width: '40%', height: '100%' }}
          onPressIn={() => setIsPaused(true)}
          onPressOut={() => setIsPaused(false)}
        />
        <TouchableOpacity
          style={{ width: '30%', height: '100%' }}
          onPress={goToNext}
          onPressIn={() => setIsPaused(true)}
          onPressOut={() => setIsPaused(false)}
        />
      </View>

      {currentStory.caption && (
        <View style={{ position: 'absolute', bottom: 90, left: 0, right: 0, paddingHorizontal: 20 }}>
          <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '500', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 }}>
            {currentStory.caption}
          </Text>
        </View>
      )}

      <View style={{ position: 'absolute', bottom: 24, left: 0, right: 0, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10 }}>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>Send message</Text>
        </View>
        <TouchableOpacity onPress={handleLike} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Heart size={28} color={storyLiked ? '#ef4444' : '#ffffff'} fill={storyLiked ? '#ef4444' : 'none'} />
        </TouchableOpacity>
        <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Send size={24} color="#ffffff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}
