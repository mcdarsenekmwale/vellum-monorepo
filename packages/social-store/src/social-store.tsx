import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ApiClient } from "@vellbase/api-client";
import type { Comment as ApiComment, User } from "@vellbase/api-client";

export interface Storage {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

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
  viewedStories: Record<string, number>;
  viewedArticles: Record<string, number>;
  profile: UserProfile | null;
};

type SocialContextValue = SocialState & {
  isLiked: (slug: string) => boolean;
  isSaved: (slug: string) => boolean;
  toggleLike: (slug: string) => void;
  toggleBookmark: (slug: string) => void;
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

export interface SocialProviderProps {
  apiClient: ApiClient;
  storage: Storage;
  children: ReactNode;
}

export function SocialProvider({ apiClient, storage, children }: SocialProviderProps) {
  const [state, setState] = useState<SocialState>({
    likes: {},
    bookmarks: {},
    comments: {},
    viewedStories: {},
    viewedArticles: {},
    profile: null,
  });

  useEffect(() => {
    const loadState = async () => {
      try {
        const raw = await storage.getItem(STORAGE_KEY);
        if (raw) setState((s) => ({ ...s, ...JSON.parse(raw) }));
      } catch {}
    };
    loadState();
  }, [storage]);

  useEffect(() => {
    storage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
  }, [state, storage]);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await apiClient.getCurrentUser();
        if (user) {
          setState((s) => ({
            ...s,
            profile: {
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
  }, [apiClient]);

  const toggleLike = useCallback((slug: string) => {
    setState((s) => {
      const newLikes = { ...s.likes, [slug]: !s.likes[slug] };
      apiClient.toggleLike({ articleSlug: slug }).catch(() => {
        setState((prev) => ({ ...prev, likes: { ...prev.likes, [slug]: !prev.likes[slug] } }));
      });
      return { ...s, likes: newLikes };
    });
  }, [apiClient]);

  const toggleBookmark = useCallback((slug: string) => {
    setState((s) => {
      const newBookmarks = { ...s.bookmarks, [slug]: !s.bookmarks[slug] };
      apiClient.toggleBookmark({ articleSlug: slug }).catch(() => {
        setState((prev) => ({ ...prev, bookmarks: { ...prev.bookmarks, [slug]: !prev.bookmarks[slug] } }));
      });
      return { ...s, bookmarks: newBookmarks };
    });
  }, [apiClient]);

  const refreshComments = useCallback(async (slug: string) => {
    try {
      const response = await apiClient.getComments(slug, undefined, 1, 100);
      setState((s) => ({ ...s, comments: { ...s.comments, [slug]: response.data } }));
    } catch (err) {
      console.error("Failed to load comments:", err);
    }
  }, [apiClient]);

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
      }));
    } catch (err) {
      console.error("Failed to create comment:", err);
    }
  }, [apiClient]);

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
      toggleLike,
      toggleBookmark,
      addComment,
      commentsFor,
      isStoryViewed,
      markStoryViewed,
      isArticleViewed,
      markArticleViewed,
      updateProfile,
      refreshComments,
    }),
    [state, toggleLike, toggleBookmark, addComment, commentsFor, isStoryViewed, markStoryViewed, isArticleViewed, markArticleViewed, updateProfile, refreshComments],
  );

  return <SocialContext.Provider value={value}>{children}</SocialContext.Provider>;
}

export function useSocial() {
  const ctx = useContext(SocialContext);
  if (!ctx) throw new Error("useSocial must be used inside <SocialProvider>");
  return ctx;
}
