import { useState, useEffect, useCallback } from 'react';
import { ApiClient } from '@vellum/api-client';
import type {
  Article,
  Highlight,
  Story,
  Category,
  Notification,
  PaginatedResponse,
  User,
  UserSettings,
} from '@vellum/api-client';

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

export function useArticles(apiClient: ApiClient, page = 1, limit = 10) {
  return useFetch<PaginatedResponse<Article>>(
    () => apiClient.getArticles(page, limit),
    [apiClient, page, limit]
  );
}

export function useFeaturedArticles(apiClient: ApiClient) {
  return useFetch<Article[]>(
    () => apiClient.getFeaturedArticles(),
    [apiClient]
  );
}

export function useArticle(apiClient: ApiClient, slug: string) {
  return useFetch<Article>(
    () => apiClient.getArticle(slug),
    [apiClient, slug]
  );
}

export function useArticlesByAuthor(apiClient: ApiClient, handle: string, page = 1, limit = 10) {
  return useFetch<PaginatedResponse<Article>>(
    () => apiClient.getArticlesByAuthor(handle, page, limit),
    [apiClient, handle, page, limit]
  );
}

export function useBookmarkedArticles(apiClient: ApiClient, page = 1, limit = 100) {
  const { data, isLoading, error, refetch } = useArticles(apiClient, page, limit);
  const filtered = data
    ? { ...data, data: data.data.filter((a) => a.isBookmarked) }
    : null;
  return { data: filtered, isLoading, error, refetch };
}

export function useLikedArticles(apiClient: ApiClient, page = 1, limit = 100) {
  const { data, isLoading, error, refetch } = useArticles(apiClient, page, limit);
  const filtered = data
    ? { ...data, data: data.data.filter((a) => a.isLiked) }
    : null;
  return { data: filtered, isLoading, error, refetch };
}

export function useHighlights(apiClient: ApiClient, page = 1, limit = 10) {
  return useFetch<PaginatedResponse<Highlight>>(
    () => apiClient.getHighlights(page, limit),
    [apiClient, page, limit]
  );
}

export function useHighlight(apiClient: ApiClient, id: string) {
  return useFetch<Highlight>(
    () => apiClient.getHighlight(id),
    [apiClient, id]
  );
}

export function useStories(apiClient: ApiClient) {
  return useFetch<Story[]>(
    () => apiClient.getStories(),
    [apiClient]
  );
}

export function useStoriesByAuthor(apiClient: ApiClient, authorId: string) {
  return useFetch<Story[]>(
    () => apiClient.getStoriesByAuthor(authorId),
    [apiClient, authorId]
  );
}

export function useCategories(apiClient: ApiClient) {
  return useFetch<Category[]>(
    () => apiClient.getCategories(),
    [apiClient]
  );
}

export function useCategory(apiClient: ApiClient, slug: string) {
  return useFetch<Category & { articles: Article[] }>(
    () => apiClient.getCategory(slug),
    [apiClient, slug]
  );
}

export function useUser(apiClient: ApiClient, handle: string) {
  return useFetch<User>(
    () => apiClient.getUser(handle),
    [apiClient, handle]
  );
}

export function useMe(apiClient: ApiClient) {
  return useFetch<User>(
    () => apiClient.getMe(),
    [apiClient]
  );
}

export function useNotifications(apiClient: ApiClient, page = 1, limit = 20) {
  return useFetch<PaginatedResponse<Notification>>(
    () => apiClient.getNotifications(page, limit),
    [apiClient, page, limit]
  );
}

export function useUnreadCount(apiClient: ApiClient) {
  return useFetch<{ count: number }>(
    () => apiClient.getUnreadCount(),
    [apiClient]
  );
}

export function useUserSettings(apiClient: ApiClient) {
  return useFetch<UserSettings>(
    () => apiClient.getUserSettings(),
    [apiClient]
  );
}

export function useSocialActions(apiClient: ApiClient) {
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
  }, [apiClient]);

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
  }, [apiClient]);

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
  }, [apiClient]);

  return { toggleLike, toggleBookmark, toggleFollow, isLoading };
}

export function useAuthState(apiClient: ApiClient) {
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
  }, [apiClient]);

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
