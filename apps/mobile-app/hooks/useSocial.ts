import { useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ViewedState = {
  viewedStories: Record<string, number>;
  viewedArticles: Record<string, number>;
};

const STORAGE_KEY = 'vellbase:viewed:v1';

const defaultState: ViewedState = {
  viewedStories: {},
  viewedArticles: {},
};

export function useSocial() {
  const [state, setState] = useState<ViewedState>(defaultState);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadState();
  }, []);

  const loadState = async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setState((s) => ({ ...s, ...parsed }));
      }
    } catch (error) {
      console.error('Failed to load viewed state:', error);
    }
    setLoaded(true);
  };

  const saveState = async (next: ViewedState) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (error) {
      console.error('Failed to save viewed state:', error);
    }
  };

  const updateState = useCallback((updater: (prev: ViewedState) => ViewedState) => {
    setState((prev) => {
      const next = updater(prev);
      saveState(next);
      return next;
    });
  }, []);

  const isStoryViewed = useCallback(
    (storyId: string) => !!state.viewedStories[storyId],
    [state.viewedStories],
  );

  const markStoryViewed = useCallback((storyId: string) => {
    updateState((prev) => ({
      ...prev,
      viewedStories: { ...prev.viewedStories, [storyId]: Date.now() },
    }));
  }, [updateState]);

  const isArticleViewed = useCallback(
    (slug: string) => !!state.viewedArticles[slug],
    [state.viewedArticles],
  );

  const markArticleViewed = useCallback((slug: string) => {
    updateState((prev) => ({
      ...prev,
      viewedArticles: { ...prev.viewedArticles, [slug]: Date.now() },
    }));
  }, [updateState]);

  return {
    loaded,
    isStoryViewed,
    markStoryViewed,
    isArticleViewed,
    markArticleViewed,
  };
}
