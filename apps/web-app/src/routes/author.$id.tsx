import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { WebShell } from "@/components/WebShell";
import { useUser, useArticlesByAuthor, useSocialActions, useAuthState } from "@/hooks/useApi";
import { apiClient } from "@/lib/api";
import { ArrowLeft, MessageCircle, UserPlus, Check } from "lucide-react";
import { LoginPrompt } from "@/components/LoginPrompt";
import { SmartState } from "@/components/SmartState";
import { GuestGuard } from "@/components/GuestGuard";
import { EnhancedErrorBoundary } from "@/components/EnhancedErrorBoundary";
import { Avatar } from "@/components/Avatar";

function timeAgo(dateString?: string): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 0) return "just now";
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

export const Route = createFileRoute("/author/$id")({
  head: () => ({
    meta: [{ title: "Author — Vellbase" }],
  }),
  component: AuthorPage,
});

function AuthorPage() {
  const { id } = Route.useParams();
  const { user } = useAuthState();
  const {
    data: author,
    isLoading: authorLoading,
    error: authorError,
  } = useUser(id);
  const {
    data: storiesData,
    isLoading: storiesLoading,
    error: storiesError,
  } = useArticlesByAuthor(id);
  const { toggleFollow } = useSocialActions();
  const [following, setFollowing] = useState(false);
  const [isCheckingFollow, setIsCheckingFollow] = useState(true);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  const stories = storiesData?.data ?? [];
  const isLoading = authorLoading || storiesLoading;
  const error = authorError || storiesError;

  useEffect(() => {
    if (!author?.id) return;
    let cancelled = false;
    const check = async () => {
      try {
        const result = await apiClient.isFollowing(author.id);
        if (!cancelled) setFollowing(result.following);
      } catch {
        // Not authenticated or error
      } finally {
        if (!cancelled) setIsCheckingFollow(false);
      }
    };
    check();
    return () => { cancelled = true; };
  }, [author?.id]);

  const handleFollow = async () => {
    if (!author?.id) return;
    try {
      const currentUser = await apiClient.getCurrentUser();
      if (!currentUser) {
        setShowLoginPrompt(true);
        return;
      }
      const wasFollowing = following;
      setFollowing(!wasFollowing);
      const result = await toggleFollow(author.id);
      if (result !== null) {
        setFollowing(Boolean(result));
      } else {
        setFollowing(Boolean(wasFollowing));
      }
    } catch {
      setShowLoginPrompt(true);
    }
  };

  return (
    <WebShell>
      <EnhancedErrorBoundary>
        <div className="max-w-[900px] mx-auto">
          <SmartState
            isLoading={isLoading}
            isError={!!error}
            error={error}
            data={author}
            useShimmer
            emptyTitle="Author not found"
            emptyDescription="This writer may have been removed or the link is incorrect."
            onRetry={() => window.location.reload()}
            shimmerComponent={
              <div className="space-y-6">
                <div className="bg-card border border-border rounded-2xl p-8 md:p-10">
                  <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
                    <div className="size-32 rounded-full bg-muted animate-pulse shrink-0" />
                    <div className="flex-1 min-w-0 space-y-4 w-full">
                      <div className="h-8 w-48 bg-muted rounded mx-auto md:mx-0" />
                      <div className="h-4 w-32 bg-muted rounded mx-auto md:mx-0" />
                      <div className="h-4 w-64 bg-muted rounded mx-auto md:mx-0" />
                      <div className="flex justify-center md:justify-start gap-8 mt-6">
                        <div className="h-8 w-16 bg-muted rounded" />
                        <div className="h-8 w-16 bg-muted rounded" />
                        <div className="h-8 w-16 bg-muted rounded" />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="bg-card border border-border rounded-2xl overflow-hidden">
                      <div className="aspect-[16/10] bg-muted animate-pulse" />
                      <div className="p-5 space-y-2">
                        <div className="h-3 w-16 bg-muted rounded" />
                        <div className="h-5 w-3/4 bg-muted rounded" />
                        <div className="h-3 w-24 bg-muted rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            }
          >
            {author && (
              <>
                {/* Back link */}
                <Link
                  to="/"
                  className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
                >
                  <ArrowLeft className="size-4" />
                  Back to feed
                </Link>

                {/* Profile Header */}
                <div className="bg-card border border-border rounded-2xl p-8 md:p-10">
                  <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
                    <Avatar
                      src={author.avatar}
                      alt={author.name}
                      name={author.name}
                      handle={author.handle}
                      className="size-32 ring-2 ring-accent ring-offset-4 ring-offset-card"
                    />
                    <div className="flex-1 min-w-0 text-center md:text-left">
                      <h1 className="font-display italic text-4xl md:text-5xl leading-none">
                        {author.name}
                      </h1>
                      <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mt-2">
                        {author.publication ?? author.handle}
                      </p>
                      {author.bio && (
                        <p className="text-base text-muted-foreground mt-4 max-w-[60ch] leading-relaxed">
                          {author.bio}
                        </p>
                      )}

                      {/* Stats */}
                      <div className="flex justify-center md:justify-start gap-8 mt-6">
                        <div>
                          <p className="text-2xl font-bold">{storiesData?.total ?? stories.length}</p>
                          <p className="text-xs text-muted-foreground uppercase tracking-widest">
                            Stories
                          </p>
                        </div>
                        <Link
                          // @ts-expect-error TanStack Router typed-link restricts `to` to static literals; runtime correctly resolves dynamic $id param for followers
                          to={`/author/${id}/followers`}
                          className="hover:opacity-70 transition-opacity"
                        >
                          <p className="text-2xl font-bold">
                            {(author as any)?.followerCount?.toLocaleString() ?? 0}
                          </p>
                          <p className="text-xs text-muted-foreground uppercase tracking-widest">
                            Followers
                          </p>
                        </Link>
                        <Link
                          // @ts-expect-error TanStack Router typed-link restricts `to` to static literals; runtime correctly resolves dynamic $id param for following
                          to={`/author/${id}/following`}
                          className="hover:opacity-70 transition-opacity"
                        >
                          <p className="text-2xl font-bold">
                            {(author as any)?.followingCount?.toLocaleString() ?? 0}
                          </p>
                          <p className="text-xs text-muted-foreground uppercase tracking-widest">
                            Following
                          </p>
                        </Link>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-wrap justify-center md:justify-start gap-3 mt-6">
                        <GuestGuard user={user} mode="prompt" promptMessage="Sign in to follow this author">
                          <button
                            onClick={handleFollow}
                            disabled={isCheckingFollow}
                            className={`inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold transition-colors ${
                              following
                                ? "bg-muted text-foreground"
                                : "bg-foreground text-background hover:opacity-90"
                            } ${isCheckingFollow ? "opacity-50 cursor-not-allowed" : ""}`}
                          >
                            {following ? (
                              <>
                                <Check className="size-4" /> Following
                              </>
                            ) : (
                              <>
                                <UserPlus className="size-4" /> Follow
                              </>
                            )}
                          </button>
                        </GuestGuard>
                        <GuestGuard user={user} mode="hide">
                          <button className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-2.5 text-sm font-semibold hover:bg-muted">
                            <MessageCircle className="size-4" />
                            Message
                          </button>
                        </GuestGuard>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Stories List */}
                <div className="mt-8">
                  <h2 className="font-display italic text-2xl mb-4">Stories</h2>
                  <SmartState
                    isLoading={storiesLoading}
                    isError={!!storiesError}
                    error={storiesError}
                    data={stories}
                    emptyTitle="No stories yet"
                    emptyDescription="This author hasn't published any stories."
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {stories.map((a) => (
                        <Link
                          key={a.slug}
                          to="/article/$slug"
                          params={{ slug: a.slug }}
                          className="group bg-card border border-border rounded-2xl overflow-hidden hover:border-accent transition-colors"
                        >
                          <div className="aspect-[16/10] overflow-hidden bg-muted">
                            {a.cover && (
                              <img
                                src={a.cover}
                                alt=""
                                className="size-full object-cover group-hover:scale-105 transition-transform duration-500"
                              />
                            )}
                          </div>
                          <div className="p-5 space-y-2">
                            <p className="text-[10px] font-bold text-accent tracking-widest uppercase">
                              {a.category?.name ?? "Article"}
                            </p>
                            <h3 className="text-lg leading-tight font-semibold text-balance group-hover:text-accent transition-colors">
                              {a.title}
                            </h3>
                            <p className="text-xs text-muted-foreground">
                              {timeAgo(a.publishedAt)} · {a.readMinutes} min read
                            </p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </SmartState>
                </div>
              </>
            )}
          </SmartState>
        </div>
        <LoginPrompt open={showLoginPrompt} onClose={() => setShowLoginPrompt(false)} />
      </EnhancedErrorBoundary>
    </WebShell>
  );
}
