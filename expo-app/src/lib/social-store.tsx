import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { currentUser, seedComments, type Comment } from "@/data/content";

type State = {
  likes: Record<string, boolean>;
  bookmarks: Record<string, boolean>;
  follows: Record<string, boolean>;
  comments: Comment[];
};

type Ctx = State & {
  toggleLike: (slug: string) => void;
  toggleBookmark: (slug: string) => void;
  toggleFollow: (id: string) => void;
  addComment: (slug: string, body: string, parentId?: string) => void;
};

const STORAGE_KEY = "vellum.social.v1";

const empty: State = { likes: {}, bookmarks: {}, follows: {}, comments: seedComments };

const SocialContext = createContext<Ctx | null>(null);

export function SocialProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(empty);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as Partial<State>;
          setState({
            likes: parsed.likes ?? {},
            bookmarks: parsed.bookmarks ?? {},
            follows: parsed.follows ?? {},
            comments: parsed.comments ?? seedComments,
          });
        } catch {}
      }
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (hydrated) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, hydrated]);

  const toggleLike = useCallback(
    (slug: string) => setState((s) => ({ ...s, likes: { ...s.likes, [slug]: !s.likes[slug] } })),
    [],
  );
  const toggleBookmark = useCallback(
    (slug: string) => setState((s) => ({ ...s, bookmarks: { ...s.bookmarks, [slug]: !s.bookmarks[slug] } })),
    [],
  );
  const toggleFollow = useCallback(
    (id: string) => setState((s) => ({ ...s, follows: { ...s.follows, [id]: !s.follows[id] } })),
    [],
  );
  const addComment = useCallback((slug: string, body: string, parentId?: string) => {
    if (!body.trim()) return;
    const c: Comment = {
      id: `c-${Date.now()}`,
      articleSlug: slug,
      author: currentUser,
      body: body.trim(),
      ago: "now",
      parentId,
    };
    setState((s) => ({ ...s, comments: [...s.comments, c] }));
  }, []);

  const value = useMemo<Ctx>(
    () => ({ ...state, toggleLike, toggleBookmark, toggleFollow, addComment }),
    [state, toggleLike, toggleBookmark, toggleFollow, addComment],
  );

  return <SocialContext.Provider value={value}>{children}</SocialContext.Provider>;
}

export function useSocial() {
  const ctx = useContext(SocialContext);
  if (!ctx) throw new Error("useSocial must be used inside SocialProvider");
  return ctx;
}
