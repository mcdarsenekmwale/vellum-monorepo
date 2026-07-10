import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import type { Article, Highlight, Story, Category, Notification, PaginatedResponse } from '../packages/api-client/src/types/index';

// Generic hook for fetching data
function useFetch<T>(
  fetchFn: () => Promise<T>,
  deps: any[] = []
) {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchFn();
      setData(result);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, deps);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, isLoading, error, refetch };
}

// Articles hooks
export function useArticles(page = 1, limit = 10) {
  return useFetch<PaginatedResponse<Article>>(
    () => apiClient.getArticles(page, limit),
    [page, limit]
  );
}

export function useFeaturedArticles() {
  return useFetch<Article[]>(
    () => apiClient.getFeaturedArticles(),
    []
  );
}

export function useArticle(slug: string) {
  return useFetch<Article>(
    () => apiClient.getArticle(slug),
    [slug]
  );
}

// Highlights hooks
export function useHighlights(page = 1, limit = 10) {
  return useFetch<PaginatedResponse<Highlight>>(
    () => apiClient.getHighlights(page, limit),
    [page, limit]
  );
}

export function useHighlight(id: string) {
  return useFetch<Highlight>(
    () => apiClient.getHighlight(id),
    [id]
  );
}

// Stories hooks
export function useStories() {
  return useFetch<Story[]>(
    () => apiClient.getStories(),
    []
  );
}

export function useStoriesByAuthor(authorId: string) {
  return useFetch<Story[]>(
    () => apiClient.getStoriesByAuthor(authorId),
    [authorId]
  );
}

// Categories hooks
export function useCategories() {
  return useFetch<Category[]>(
    () => apiClient.getCategories(),
    []
  );
}

// Notifications hooks
export function useNotifications(page = 1, limit = 20) {
  return useFetch<PaginatedResponse<Notification>>(
    () => apiClient.getNotifications(page, limit),
    [page, limit]
  );
}

export function useUnreadCount() {
  return useFetch<{ count: number }>(
    () => apiClient.getUnreadCount(),
    []
  );
}

// Social actions hooks
export function useSocialActions() {
  const [isLoading, setIsLoading] = useState(false);

  const toggleLike = useCallback(async (articleSlug?: string, highlightId?: string, commentId?: string) => {
    setIsLoading(true);
    try {
      const result = await apiClient.toggleLike({ articleSlug, highlightId, commentId });
      return result.liked;
    } catch (err) {
      console.error('Failed to toggle like:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const toggleBookmark = useCallback(async (articleSlug?: string, highlightId?: string) => {
    setIsLoading(true);
    try {
      const result = await apiClient.toggleBookmark({ articleSlug, highlightId });
      return result.bookmarked;
    } catch (err) {
      console.error('Failed to toggle bookmark:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const toggleFollow = useCallback(async (userId: string) => {
    setIsLoading(true);
    try {
      const result = await apiClient.toggleFollow(userId);
      return result.following;
    } catch (err) {
      console.error('Failed to toggle follow:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { toggleLike, toggleBookmark, toggleFollow, isLoading };
}

// Auth hook - uses global AuthContext
export function useAuthState() {
  return useAuth();
}