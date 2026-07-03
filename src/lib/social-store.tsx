import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { seedComments, currentUser, type Comment, authors } from "@/data/content";

type SocialState = {
  likes: Record<string, boolean>;
  bookmarks: Record<string, boolean>;
  comments: Comment[];
};

type SocialContextValue = SocialState & {
  toggleLike: (slug: string) => void;
  toggleBookmark: (slug: string) => void;
  addComment: (slug: string, body: string, parentId?: string) => void;
  commentsFor: (slug: string) => Comment[];
};

const SocialContext = createContext<SocialContextValue | null>(null);
const STORAGE_KEY = "vellum:social:v1";

export function SocialProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SocialState>({
    likes: {},
    bookmarks: {},
    comments: seedComments,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setState((s) => ({ ...s, ...JSON.parse(raw) }));
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const toggleLike = useCallback((slug: string) => {
    setState((s) => ({ ...s, likes: { ...s.likes, [slug]: !s.likes[slug] } }));
  }, []);

  const toggleBookmark = useCallback((slug: string) => {
    setState((s) => ({ ...s, bookmarks: { ...s.bookmarks, [slug]: !s.bookmarks[slug] } }));
  }, []);

  const addComment = useCallback((slug: string, body: string, parentId?: string) => {
    const clean = body.trim();
    if (!clean) return;
    const comment: Comment = {
      id: `c${Date.now()}`,
      articleSlug: slug,
      author: { ...currentUser, avatar: currentUser.avatar || authors[0].avatar },
      body: clean,
      ago: "just now",
      parentId,
    };
    setState((s) => ({ ...s, comments: [...s.comments, comment] }));
  }, []);

  const commentsFor = useCallback(
    (slug: string) => state.comments.filter((c) => c.articleSlug === slug),
    [state.comments],
  );

  const value = useMemo(
    () => ({ ...state, toggleLike, toggleBookmark, addComment, commentsFor }),
    [state, toggleLike, toggleBookmark, addComment, commentsFor],
  );

  return <SocialContext.Provider value={value}>{children}</SocialContext.Provider>;
}

export function useSocial() {
  const ctx = useContext(SocialContext);
  if (!ctx) throw new Error("useSocial must be used inside <SocialProvider>");
  return ctx;
}
