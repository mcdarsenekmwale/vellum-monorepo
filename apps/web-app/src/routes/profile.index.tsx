import { createFileRoute, Link } from "@tanstack/react-router";
import { WebShell } from "@/components/WebShell";
import { Avatar } from "@/components/Avatar";
import { useSocial } from "@/lib/social-store";
import { useAuthState, useLikedArticles, useBookmarkedArticles, useArticlesByAuthor, useFollowers, useFollowing, useToggleFollow } from "@/hooks/useApi";
import { Pencil, Grid3x3, Bookmark, Heart, Users, Search, X, Loader2, AlertCircle } from "lucide-react";
import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { SmartState } from "@/components/SmartState";
import { EnhancedErrorBoundary } from "@/components/EnhancedErrorBoundary";
import { useI18n } from "@/components/providers/I18nProvider";
import { cn } from "@/lib/utils";
import { FollowUser } from "@/lib/api";
import { AiWebProfileFAB } from "@/components/ai/web-profile-fab";
import { AiWebSharedChatDrawer } from "@/components/ai/web-shared-chat-drawer";

function formatRelativeTime(dateStr: string | undefined): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = Date.now();
  const diff = now - date.getTime();
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return date.toLocaleDateString();
}

export const Route = createFileRoute("/profile/")({
  component: ProfileIndexPage,
});

// ─── Followers/Following Modal ───

interface FollowModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  userId: string;
  type: "followers" | "following";
}

function FollowModal({ isOpen, onClose, title, userId, type }: FollowModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [allUsers, setAllUsers] = useState<FollowUser[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialLoadRef = useRef(true);

  // ─── Hooks ───
  const followersQuery = useFollowers(userId, page, 20, debouncedSearch);
  const followingQuery = useFollowing(userId, page, 20, debouncedSearch);
  const toggleFollowMutation = useToggleFollow();

  // Select the correct query based on type
  const { data, isLoading, error, refetch } = type === "followers"
    ? followersQuery
    : followingQuery;

  // ─── Search debounce ───
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
      setAllUsers([]);
      setHasMore(true);
      isInitialLoadRef.current = true;
    }, 300);
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  // ─── Update users when data changes ───
  useEffect(() => {
    if (data?.data) {
      const newUsers: any[] = data.data;

      if (page === 1 || isInitialLoadRef.current) {
        setAllUsers(newUsers);
        isInitialLoadRef.current = false;
      } else {
        // Prevent duplicates
        const existingIds = new Set(allUsers.map(u => u.id));
        const uniqueNewUsers = newUsers.filter(u => !existingIds.has(u.id));
        setAllUsers((prev) => [...prev, ...uniqueNewUsers]);
      }

      setHasMore(newUsers.length === 20);
      setIsLoadingMore(false);
    }
  }, [data, page]);

  // ─── Reset on close ───
  useEffect(() => {
    if (!isOpen) {
      setAllUsers([]);
      setPage(1);
      setHasMore(true);
      setSearchQuery("");
      setDebouncedSearch("");
      isInitialLoadRef.current = true;
    }
  }, [isOpen]);

  // ─── Handle follow toggle with mutation ───
  const handleFollowToggle = async (targetUserId: string, currentFollowStatus: boolean) => {
    try {
      // Optimistic update
      setAllUsers((prev) =>
        prev.map((u) =>
          u.id === targetUserId
            ? {
              ...u,
              isFollowing: !currentFollowStatus,
              followerCount: currentFollowStatus ? (u.followerCount || 0) - 1 : (u.followerCount || 0) + 1,
            }
            : u
        )
      );

      await toggleFollowMutation.mutateAsync(targetUserId);
    } catch (error) {
      // Revert on error
      setAllUsers((prev) =>
        prev.map((u) =>
          u.id === targetUserId
            ? { ...u, isFollowing: currentFollowStatus }
            : u
        )
      );
      console.error("Failed to toggle follow:", error);
    }
  };

  // ─── Intersection Observer for infinite scroll ───
  useEffect(() => {
    if (!isOpen || isLoading || isLoadingMore || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore && !isLoading) {
          setIsLoadingMore(true);
          setPage((prev) => prev + 1);
        }
      },
      {
        root: null,
        rootMargin: "100px",
        threshold: 0.1,
      }
    );

    const currentRef = loadMoreRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [isOpen, isLoading, hasMore, isLoadingMore]);

  // ─── Handle retry ───
  const handleRetry = useCallback(() => {
    refetch();
  }, [refetch]);

  // ─── Check if user is following back ───
  const userIsFollowingBack = (userId: string) => {
    return (followingQuery.data?.data?.find((u: any) => u?.id === userId) as any)?.isFollowing;
  };

  // ─── Reset page when search changes ───
  useEffect(() => {
    if (debouncedSearch) {
      setPage(1);
      setAllUsers([]);
      setHasMore(true);
      isInitialLoadRef.current = true;
    }
  }, [debouncedSearch]);

  if (!isOpen) return null;

  // ─── Loading state for first page ───
  if (isLoading && page === 1) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-card border border-border rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col shadow-2xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
            <h2 className="text-lg font-semibold">{title}</h2>
            <button onClick={onClose} className="p-1.5 rounded-full hover:bg-muted transition-colors">
              <X className="size-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-2 animate-pulse">
                <div className="size-12 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 bg-muted rounded" />
                  <div className="h-3 w-24 bg-muted rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* ─── Backdrop ─── */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* ─── Modal ─── */}
      <div className="relative bg-card border border-border rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* ─── Header ─── */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-muted transition-colors"
            aria-label="Close modal"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* ─── Search Bar ─── */}
        <div className="px-4 py-3 border-b border-border shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${title.toLowerCase()}...`}
              className="w-full pl-9 pr-4 py-2 bg-muted/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted transition-colors"
              >
                <X className="size-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>

        {/* ─── Content ─── */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {error ? (
            // ─── Error state ───
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="size-12 rounded-full bg-red-500/10 flex items-center justify-center mb-3">
                <AlertCircle className="size-6 text-red-500" />
              </div>
              <p className="text-sm font-medium text-red-500">
                {error && typeof error === 'object' && 'message' in error ? (error as Error).message : "Failed to load"}
              </p>
              <button
                onClick={handleRetry}
                className="mt-3 text-sm text-primary hover:underline"
              >
                Try again
              </button>
            </div>
          ) : allUsers.length === 0 ? (
            // ─── Empty state ───
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="size-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium">No {title.toLowerCase()}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {searchQuery ? "Try a different search term" : `This user has no ${title.toLowerCase()} yet`}
              </p>
            </div>
          ) : (
            // ─── User list ───
            <>
              {allUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <Link
                    to="/author/$id"
                    params={{ id: user.handle }}
                    className="flex items-center gap-3 flex-1 min-w-0"
                    onClick={onClose}
                  >
                    <Avatar
                      src={user.avatar}
                      name={user.name}
                      handle={user.handle}
                      size="md"
                      className="size-12 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{user.name}</p>
                      <p className="text-xs text-muted-foreground truncate">@{user.handle}</p>
                      {user.bio && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{user.bio}</p>
                      )}
                    </div>
                  </Link>

                  {/* ─── Follow button ─── */}
                  {user.id !== userId && (
                    <button
                      onClick={() => handleFollowToggle(user.id, user.isFollowing || false)}
                      disabled={toggleFollowMutation.isPending}
                      className={cn(
                        "flex-none px-4 py-1.5 rounded-full text-xs cursor-pointer transition-colors font-medium",
                        user.isFollowing
                          ? "bg-muted hover:bg-muted/80 text-foreground"
                          : "bg-primary hover:bg-primary/90 text-primary-foreground",
                        toggleFollowMutation.isPending && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      {toggleFollowMutation.isPending ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (user.isFollowing || type === 'following') ? (
                        "Following"
                      ) : (
                        userIsFollowingBack(user.id) ?  "View": "Follow back"
                      )}
                    </button>
                  )}
                </div>
              ))}

              {/* ─── Load more trigger ─── */}
              {hasMore && (
                <div ref={loadMoreRef} className="py-4 flex justify-center">
                  {isLoadingMore ? (
                    <Loader2 className="size-5 animate-spin text-muted-foreground" />
                  ) : (
                    <span className="text-xs text-muted-foreground">Scroll for more</span>
                  )}
                </div>
              )}

              {/* ─── End of list ─── */}
              {!hasMore && allUsers.length > 0 && (
                <div className="py-4 text-center">
                  <span className="text-xs text-muted-foreground">
                    — {allUsers.length} {title.toLowerCase()} —
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Profile Page ───

function ProfileIndexPage() {
  const { profile, likes, comments } = useSocial();
  const { user, isAuthenticated, isLoading: authLoading } = useAuthState();
  const { t } = useI18n();
  const { data: likedData, isLoading: likedLoading } = useLikedArticles(1, 100);
  const { data: bookmarkedData, isLoading: bookmarkedLoading } = useBookmarkedArticles(1, 100);
  const { data: myArticlesData, isLoading: myArticlesLoading } = useArticlesByAuthor(user?.handle || "", 1, 100);

  // ─── Computed values ───
  const likedArticles = useMemo(() => likedData?.data || [], [likedData]);
  const savedArticles = useMemo(() => bookmarkedData?.data || [], [bookmarkedData]);
  const myArticles = useMemo(() => myArticlesData?.data || [], [myArticlesData]);
  const totalComments = useMemo(() =>
    Object.values(comments).reduce((sum, arr) => sum + arr.length, 0),
    [comments]
  );

  const [tab, setTab] = useState<"posts" | "saved" | "tagged">("posts");
  const currentProfile = user || profile;

  // ─── Modal state ───
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    type: "followers" | "following";
    userId: string;
  }>({
    isOpen: false,
    type: "followers",
    userId: (currentProfile as any)?.id as string || "",
  });

  // ─── Modal handlers ───
  const openFollowers = useCallback(() => {
    if (user?.id) {
      setModalState({
        isOpen: true,
        type: "followers",
        userId: user.id,
      });
    }
  }, [user]);

  const openFollowing = useCallback(() => {
    if (user?.id) {
      setModalState({
        isOpen: true,
        type: "following",
        userId: user.id,
      });
    }
  }, [user]);

  const closeModal = useCallback(() => {
    setModalState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  // ─── Update modal userId when currentProfile changes ───
  useEffect(() => {
    if ((currentProfile as any)?.id) {
      setModalState((prev) => ({
        ...prev,
        userId: (currentProfile as any)?.id as string || "",
      }));
    }
  }, [currentProfile]);

  // ─── Stats ───
  const stats = useMemo(() => [
    {
      label: t("profile.articles"),
      value: myArticlesData?.total ?? myArticles.length,
      onClick: null,
    },
    {
      label: t("profile.followers"),
      value: (currentProfile as any)?.followerCount ?? 0,
      onClick: openFollowers,
    },
    {
      label: t("profile.following"),
      value: (currentProfile as any)?.followingCount ?? 0,
      onClick: openFollowing,
    },
  ], [myArticlesData, myArticles, currentProfile, t, openFollowers, openFollowing]);

  const isLoading = authLoading || likedLoading || bookmarkedLoading || myArticlesLoading;

  // ─── Shimmer component ───
  const ShimmerProfile = useMemo(() => (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-2xl p-8">
        <div className="flex gap-6">
          <div className="size-32 rounded-full bg-muted animate-pulse" />
          <div className="flex-1 space-y-3">
            <div className="h-6 w-48 bg-muted rounded" />
            <div className="h-4 w-32 bg-muted rounded" />
            <div className="h-4 w-64 bg-muted rounded" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-card border border-border rounded-2xl p-5 h-24 animate-pulse" />
        ))}
      </div>
    </div>
  ), []);

  return (
    <WebShell>
      <EnhancedErrorBoundary>
        <div className="max-w-[900px] mx-auto">
          <SmartState
            isLoading={isLoading}
            isError={false}
            data={currentProfile}
            useShimmer
            shimmerComponent={ShimmerProfile}
          >
            <>
              {/* ─── Profile Header ─── */}
              <section className="bg-card border border-border rounded-2xl p-8 mb-6">
                <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
                  <Avatar
                    src={currentProfile?.avatar}
                    name={currentProfile?.name}
                    handle={currentProfile?.handle}
                    size="2xl"
                    className="size-32 ring-4 ring-accent ring-offset-4 ring-offset-card shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                   
                    <div className="flex items-center gap-4 mb-3 flex-wrap">
                      <h1 className="text-2xl font-semibold">{currentProfile?.handle || "@you"}</h1>
                      <Link
                        to="/profile/edit"
                        className="px-4 py-1.5 bg-muted hover:bg-muted/70 rounded-lg text-sm font-semibold flex items-center gap-2"
                      >
                        <Pencil className="size-4" /> {t("profile.editProfile")}
                      </Link>
                    </div>

                    {/* ─── Stats with clickable followers/following ─── */}
                    <div className="flex gap-6 mb-4 flex-wrap">
                      {stats.map((s) => (
                        s.onClick ? (
                          <button
                            key={s.label}
                            onClick={s.onClick}
                            className="text-sm hover:opacity-70 transition-opacity cursor-pointer text-left"
                          >
                            <span className="font-semibold">{s.value.toLocaleString()}</span>{" "}
                            <span className="text-muted-foreground">{s.label.toLowerCase()}</span>
                          </button>
                        ) : (
                          <div key={s.label} className="text-sm">
                            <span className="font-semibold">{s.value.toLocaleString()}</span>{" "}
                            <span className="text-muted-foreground">{s.label.toLowerCase()}</span>
                          </div>
                        )
                      ))}
                    </div>

                    <div>
                      <p className="font-semibold">{currentProfile?.name || "You"}</p>
                      <p className="text-sm text-muted-foreground">{currentProfile?.bio || undefined}</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* ─── Activity Stats ─── */}
              <section className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-card border border-border rounded-2xl p-5 text-center">
                  <div className="font-display italic text-3xl">{likedArticles.length + savedArticles.length}</div>
                  <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mt-1">
                    {t("profile.reading")}
                  </div>
                </div>
                <div className="bg-card border border-border rounded-2xl p-5 text-center">
                  <div className="font-display italic text-3xl">{likedArticles.length}</div>
                  <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mt-1">
                    {t("profile.likes")}
                  </div>
                </div>
                <div className="bg-card border border-border rounded-2xl p-5 text-center">
                  <div className="font-display italic text-3xl">{totalComments}</div>
                  <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mt-1">
                    {t("profile.replies")}
                  </div>
                </div>
              </section>

              {/* ─── Tabs ─── */}
              <section className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="flex border-b border-border">
                  {[
                    { key: "posts", label: "POSTS", icon: Grid3x3 },
                    { key: "saved", label: "SAVED", icon: Bookmark },
                    { key: "tagged", label: "TAGGED", icon: Heart },
                  ].map((t) => {
                    const Icon = t.icon;
                    const active = tab === t.key;
                    return (
                      <button
                        key={t.key}
                        onClick={() => setTab(t.key as typeof tab)}
                        className={`flex-1 flex items-center justify-center gap-2 py-4 text-xs font-semibold tracking-widest transition-colors ${active ? "border-b-2 border-foreground" : "text-muted-foreground hover:text-foreground"
                          }`}
                      >
                        <Icon className="size-4" />
                        {t.label}
                      </button>
                    );
                  })}
                </div>

                <div className="p-6">
                  {tab === "posts" && (
                    <SmartState
                      isLoading={myArticlesLoading}
                      isError={false}
                      data={myArticles}
                      emptyTitle="No posts yet"
                      emptyDescription="Your published stories will appear here."
                    >
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {myArticles.map((a) => (
                          <Link
                            key={a.slug}
                            to="/article/$slug"
                            params={{ slug: a.slug }}
                            className="aspect-square bg-muted rounded-lg overflow-hidden group relative"
                          >
                            {a.cover ? (
                              <img src={a.cover} alt={a.title || 'Article cover'} className="size-full object-cover transition-transform group-hover:scale-105" />
                            ) : (
                              <div className="size-full bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
                                <span className="text-xs text-muted-foreground">No image</span>
                              </div>
                            )}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                              <div className="opacity-0 group-hover:opacity-100 flex items-center gap-4 text-white font-semibold">
                                <span className="flex items-center gap-1">
                                  <Heart className="size-5 fill-white" /> {a.likesCount?.toLocaleString() || 0}
                                </span>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </SmartState>
                  )}

                  {tab === "saved" && (
                    <SmartState
                      isLoading={bookmarkedLoading}
                      isError={false}
                      data={savedArticles}
                      emptyTitle="Nothing saved yet"
                      emptyDescription="Bookmark a story to keep it here."
                    >
                      <div className="space-y-4">
                        {savedArticles.map((a) => (
                          <Link
                            key={a.slug}
                            to="/article/$slug"
                            params={{ slug: a.slug }}
                            className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 items-start p-3 hover:bg-muted rounded-xl"
                          >
                            <div className="min-w-0 space-y-1">
                              <p className="text-[10px] font-bold text-accent tracking-widest uppercase">
                                {a.category?.name || "Article"}
                              </p>
                              <h4 className="text-base leading-tight font-semibold">{a.title}</h4>
                              <p className="text-xs text-muted-foreground">{a.author?.name || "Unknown"}</p>
                            </div>
                            {a.cover ? (
                              <img src={a.cover} alt={a.title || 'Article cover'} className="size-20 rounded-lg object-cover" />
                            ) : (
                              <div className="size-20 rounded-lg bg-muted flex items-center justify-center">
                                <span className="text-xs text-muted-foreground">No image</span>
                              </div>
                            )}
                          </Link>
                        ))}
                      </div>
                    </SmartState>
                  )}

                  {tab === "tagged" && (
                    <div className="text-center py-12">
                      <Heart className="size-12 text-muted-foreground/30 mx-auto mb-3" />
                      <p className="text-sm font-medium text-muted-foreground">No tagged posts yet</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Posts you've been tagged in will appear here
                      </p>
                    </div>
                  )}
                </div>
              </section>
            </>
          </SmartState>
        </div>

        {/* ─── Compose button ─── */}
        <Link
          to="/compose"
          className="fixed bottom-8 right-8 z-40 size-14 rounded-full bg-accent text-white grid place-items-center shadow-xl hover:scale-105 transition-transform"
          aria-label="New story"
        >
          <Pencil className="size-5" strokeWidth={2} />
        </Link>      
      </EnhancedErrorBoundary>

      {/* ─── Followers/Following Modal ─── */}
      {modalState.userId && (
        <FollowModal
          isOpen={modalState.isOpen}
          onClose={closeModal}
          title={modalState.type === "followers" ? "Followers" : "Following"}
          userId={modalState.userId}
          type={modalState.type}
        />
      )}
    </WebShell>
  );
}