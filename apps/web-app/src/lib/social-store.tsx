import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiClient } from "./api";
import type { Comment as ApiComment, User } from "./api";

export type UserProfile = {
  name: string;
  handle: string;
  bio: string;
  avatar: string;
};

type SocialState = {
  likes: Record<string, boolean>;
  bookmarks: Record<string, boolean>;
  comments: Record<string, ApiComment[]>;
  commentedArticles: Record<string, boolean>;
  viewedStories: Record<string, number>;
  viewedArticles: Record<string, number>;
  shares: Record<string, number>;
  profile: UserProfile | null;
};

type SocialContextValue = SocialState & {
  isLiked: (slug: string) => boolean;
  isSaved: (slug: string) => boolean;
  hasCommented: (slug: string) => boolean;
  toggleLike: (slug: string) => void;
  toggleBookmark: (slug: string) => void;
  shareArticle: (slug: string) => void;
  addComment: (slug: string, body: string, parentId?: string) => Promise<void>;
  commentsFor: (slug: string) => ApiComment[];
  isStoryViewed: (storyId: string) => boolean;
  markStoryViewed: (storyId: string) => void;
  isArticleViewed: (slug: string) => boolean;
  markArticleViewed: (slug: string) => void;
  updateProfile: (updates: Partial<UserProfile>) => void;
  refreshComments: (slug: string) => Promise<void>;
};

const SocialContext = createContext<SocialContextValue | null>(null);
const STORAGE_KEY = "vellbase:social:v2";

function formatAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = Date.now();
  const diff = now - date.getTime();
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d`;
  return date.toLocaleDateString();
}

export function SocialProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SocialState>({
    likes: {},
    bookmarks: {},
    comments: {},
    commentedArticles: {},
    viewedStories: {},
    viewedArticles: {},
    shares: {},
    profile: null,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setState((s) => ({ ...s, ...JSON.parse(raw) }));
    } catch { }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  // Load current user profile from API on mount
  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await apiClient.getCurrentUser();
        if (user) {
          setState((s) => ({
            ...s,
            profile: {
              id: user.id,
              name: user.name,
              handle: user.handle,
              bio: user.bio || "",
              avatar: user.avatar || "",
            },
          }));
        }
      } catch {
        // not authenticated
      }
    };
    loadUser();
  }, []);

  const toggleLike = useCallback((slug: string) => {
    setState((s) => {
      const newLikes = { ...s.likes, [slug]: !s.likes[slug] };
      // Optimistic UI: sync with backend asynchronously
      apiClient.toggleLike({ articleSlug: slug }).catch(() => {
        // Revert on error
        setState((prev) => ({ ...prev, likes: { ...prev.likes, [slug]: !prev.likes[slug] } }));
      });
      return { ...s, likes: newLikes };
    });
  }, []);

  const toggleBookmark = useCallback((slug: string) => {
    setState((s) => {
      const newBookmarks = { ...s.bookmarks, [slug]: !s.bookmarks[slug] };
      // Optimistic UI: sync with backend asynchronously
      apiClient.toggleBookmark({ articleSlug: slug }).catch(() => {
        // Revert on error
        setState((prev) => ({ ...prev, bookmarks: { ...prev.bookmarks, [slug]: !prev.bookmarks[slug] } }));
      });
      return { ...s, bookmarks: newBookmarks };
    });
  }, []);

  const shareArticle = useCallback((slug: string) => {
    setState((s) => {
      const current = s.shares[slug] || 0;
      const newShares = { ...s.shares, [slug]: current + 1 };
      // Fire and forget: increment share count on backend
      apiClient.shareArticle(slug).catch(() => {
        // Revert on error
        setState((prev) => ({
          ...prev,
          shares: { ...prev.shares, [slug]: Math.max(0, (prev.shares[slug] || 1) - 1) },
        }));
      });
      return { ...s, shares: newShares };
    });
  }, []);

  const refreshComments = useCallback(async (slug: string) => {
    try {
      const response = await apiClient.getComments(slug, undefined, 1, 100);
      setState((s) => ({ ...s, comments: { ...s.comments, [slug]: response.data } }));
    } catch (err) {
      console.error("Failed to load comments:", err);
    }
  }, []);

  const addComment = useCallback(async (slug: string, body: string, parentId?: string) => {
    const clean = body.trim();
    if (!clean) return;
    try {
      const comment = await apiClient.createComment({ body: clean, articleSlug: slug, parentId });
      setState((s) => ({
        ...s,
        comments: {
          ...s.comments,
          [slug]: [...(s.comments[slug] || []), comment],
        },
        commentedArticles: {
          ...s.commentedArticles,
          [slug]: true,
        },
      }));
    } catch (err) {
      console.error("Failed to create comment:", err);
    }
  }, []);

  const commentsFor = useCallback(
    (slug: string) => state.comments[slug] || [],
    [state.comments],
  );

  const isStoryViewed = useCallback(
    (storyId: string) => !!state.viewedStories[storyId],
    [state.viewedStories],
  );

  const markStoryViewed = useCallback((storyId: string) => {
    setState((s) => ({
      ...s,
      viewedStories: { ...s.viewedStories, [storyId]: Date.now() },
    }));
  }, []);

  const isArticleViewed = useCallback(
    (slug: string) => !!state.viewedArticles[slug],
    [state.viewedArticles],
  );

  const markArticleViewed = useCallback((slug: string) => {
    setState((s) => ({
      ...s,
      viewedArticles: { ...s.viewedArticles, [slug]: Date.now() },
    }));
  }, []);

  const updateProfile = useCallback((updates: Partial<UserProfile>) => {
    setState((s) => ({
      ...s,
      profile: s.profile ? { ...s.profile, ...updates } : null,
    }));
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      isLiked: (slug: string) => !!state.likes[slug],
      isSaved: (slug: string) => !!state.bookmarks[slug],
      hasCommented: (slug: string) => !!state.commentedArticles[slug],
      toggleLike,
      toggleBookmark,
      shareArticle,
      addComment,
      commentsFor,
      isStoryViewed,
      markStoryViewed,
      isArticleViewed,
      markArticleViewed,
      updateProfile,
      refreshComments,
    }),
    [state, toggleLike, toggleBookmark, shareArticle, addComment, commentsFor, isStoryViewed, markStoryViewed, isArticleViewed, markArticleViewed, updateProfile, refreshComments],
  );

  return <SocialContext.Provider value={value}>{children}</SocialContext.Provider>;
}

export function useSocial() {
  const ctx = useContext(SocialContext);
  if (!ctx) throw new Error("useSocial must be used inside <SocialProvider>");
  return ctx;
}
