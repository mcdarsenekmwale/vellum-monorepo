import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../lib/api';
import type { Article, Highlight, Story, Category, Notification, PaginatedResponse, User, UserSettings } from '../lib/api';

// Generic hook for fetching data
function useFetch<T>(
  fetchFn: () => Promise<T>,
  deps: unknown[] = []
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

export function useArticlesByAuthor(handle: string, page = 1, limit = 10) {
  return useFetch<PaginatedResponse<Article>>(
    () => apiClient.getArticlesByAuthor(handle, page, limit),
    [handle, page, limit]
  );
}

export function useBookmarkedArticles(page = 1, limit = 100) {
  const { data, isLoading, error, refetch } = useArticles(page, limit);
  const filtered = data
    ? { ...data, data: data.data.filter((a) => a.isBookmarked) }
    : null;
  return { data: filtered, isLoading, error, refetch };
}

export function useLikedArticles(page = 1, limit = 100) {
  const { data, isLoading, error, refetch } = useArticles(page, limit);
  const filtered = data
    ? { ...data, data: data.data.filter((a) => a.isLiked) }
    : null;
  return { data: filtered, isLoading, error, refetch };
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

export function useCategory(slug: string) {
  return useFetch<Category & { articles: Article[] }>(
    () => apiClient.getCategory(slug),
    [slug]
  );
}

// User hooks
export function useUser(handle: string) {
  return useFetch<User>(
    () => apiClient.getUser(handle),
    [handle]
  );
}

export function useMe() {
  return useFetch<User>(
    () => apiClient.getMe(),
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

// Settings hooks
export function useUserSettings() {
  return useFetch<UserSettings>(
    () => apiClient.getUserSettings(),
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

// Auth hook
export function useAuthState() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const currentUser = await apiClient.getCurrentUser();
        if (currentUser) {
          const me = await apiClient.getMe();
          setUser(me);
          setIsAuthenticated(true);
        }
      } catch {
        setUser(null);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };
    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const response = await apiClient.login({ email, password });
    setUser(response.user);
    setIsAuthenticated(true);
    return response;
  };

  const logout = async () => {
    await apiClient.logout();
    setUser(null);
    setIsAuthenticated(false);
  };

  return { user, isLoading, isAuthenticated, login, logout };
}
