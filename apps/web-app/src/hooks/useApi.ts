import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '../lib/api';
import type {
  Article,
  Highlight,
  Story,
  Category,
  Notification,
  PaginatedResponse,
  User,
  UserSettings,
  HelpArticle,
  SupportTicket,
  TicketCategory,
  TicketStatus,
  CreateTicketRequest,
  TicketListResponse,
  TicketMessage,
} from '../lib/api';

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

export function useInfiniteArticles(limit = 10) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const hasMoreRef = useRef(true);
  const isFetchingRef = useRef(false);

  const loadPage = useCallback(async (pageNum: number, append: boolean) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    if (append) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
      setError(null);
    }

    try {
      const result = await apiClient.getArticles(pageNum, limit);
      setTotalPages(result.pages || 0);
      setTotal(result.total || 0);
      hasMoreRef.current = pageNum < (result.pages || 0);

      if (append) {
        setArticles((prev) => {
          const existingIds = new Set(prev.map((a) => a.id));
          const newArticles = result.data.filter((a) => !existingIds.has(a.id));
          return [...prev, ...newArticles];
        });
      } else {
        setArticles(result.data);
      }
    } catch (err: any) {
      if (!append) {
        setError(err instanceof Error ? err : new Error(err.message || 'An error occurred'));
      }
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
      isFetchingRef.current = false;
    }
  }, [limit]);

  useEffect(() => {
    loadPage(1, false);
  }, [loadPage]);

  const loadMore = useCallback(() => {
    if (!hasMoreRef.current || isFetchingRef.current) return;
    const nextPage = page + 1;
    setPage(nextPage);
    loadPage(nextPage, true);
  }, [page, loadPage]);

  const refetch = useCallback(() => {
    setPage(1);
    hasMoreRef.current = true;
    loadPage(1, false);
  }, [loadPage]);

  const hasMore = articles.length > 0 && page < totalPages;

  return {
    data: articles,
    isLoading,
    isLoadingMore,
    error,
    loadMore,
    refetch,
    hasMore,
    total,
    totalPages,
    page,
  };
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
    () => (handle ? apiClient.getArticlesByAuthor(handle, page, limit) : Promise.resolve({ data: [], total: 0, page, limit, pages: 0 })),
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

// ─── Help Center ──────────────────────────────────────────────────────────

// KB Articles (public)
export function useHelpArticles(params?: { category?: string; search?: string }) {
  return useFetch<HelpArticle[]>(
    () => apiClient.getHelpArticles(params),
    [params?.category ?? null, params?.search ?? null]
  );
}

export function useHelpArticle(slug: string) {
  return useFetch<HelpArticle>(
    () => apiClient.getHelpArticle(slug),
    [slug]
  );
}

export function useTicketCategories() {
  return useFetch<TicketCategory[]>(
    () => apiClient.getTicketCategories(),
    []
  );
}

// My Tickets
export function useMyTickets(page = 1, limit = 20, status?: TicketStatus) {
  return useFetch<TicketListResponse>(
    () => apiClient.getMyTickets(page, limit, status),
    [page, limit, status ?? null]
  );
}

export function useMyTicket(ticketId: string) {
  return useFetch<SupportTicket>(
    () => (ticketId ? apiClient.getMyTicket(ticketId) : Promise.resolve(null as unknown as SupportTicket)),
    [ticketId]
  );
}

// Ticket mutations
export function useCreateTicket() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(async (data: CreateTicketRequest) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await apiClient.createSupportTicket(data);
      return result;
    } catch (err: any) {
      setError(err.message || 'Failed to create ticket');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { mutate, isLoading, error };
}

export function useReplyToTicket() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(async (ticketId: string, body: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await apiClient.replyToTicket(ticketId, body);
      return result;
    } catch (err: any) {
      setError(err.message || 'Failed to send reply');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { mutate, isLoading, error };
}
