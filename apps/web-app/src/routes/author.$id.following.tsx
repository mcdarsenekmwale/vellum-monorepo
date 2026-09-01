import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { WebShell } from "@/components/WebShell";
import { Avatar } from "@/components/Avatar";
import { apiClient } from "@/lib/api";
import { useUser, useSocialActions } from "@/hooks/useApi";
import { ArrowLeft, UserPlus, Check } from "lucide-react";
import { LoginPrompt } from "@/components/LoginPrompt";
import type { User } from "@/lib/api";

export const Route = createFileRoute("/author/$id/following")({
  head: () => ({
    meta: [{ title: "Following — Vellbase" }],
  }),
  component: FollowingPage,
});

function FollowingPage() {
  const { id } = Route.useParams();
  const { data: author } = useUser(id);
  const { toggleFollow } = useSocialActions();
  const [following, setFollowing] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const user = await apiClient.getUser(id);
        const result = await apiClient.getFollowing(user.id, 1, 50);
        setFollowing(result.data as unknown as User[]);

        const currentUser = await apiClient.getCurrentUser();
        if (currentUser && result.data.length > 0) {
          const checks = await Promise.all(
            result.data.map(async (u: any) => {
              try {
                const r = await apiClient.isFollowing(u.id);
                return [u.id, r.following];
              } catch {
                return [u.id, false];
              }
            })
          );
          const map: Record<string, boolean> = {};
          checks.forEach(([uid, isFollowing]) => {
            map[uid as string] = Boolean(isFollowing);
          });
          setFollowingMap(map);
        }
      } catch (err: any) {
        setError(err.message || "Failed to load following");
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [id]);

  const handleToggleFollow = async (userId: string) => {
    try {
      const currentUser = await apiClient.getCurrentUser();
      if (!currentUser) {
        setShowLoginPrompt(true);
        return;
      }
      const wasFollowing = followingMap[userId] || false;
      setFollowingMap((prev) => ({ ...prev, [userId]: Boolean(!wasFollowing) }));
      const result = await toggleFollow(userId);
      if (result !== null) {
        setFollowingMap((prev) => ({ ...prev, [userId]: Boolean(result) }));
      } else {
        setFollowingMap((prev) => ({ ...prev, [userId]: Boolean(wasFollowing) }));
      }
    } catch {
      setShowLoginPrompt(true);
    }
  };

  if (isLoading) {
    return (
      <WebShell>
        <div className="max-w-[680px] mx-auto py-10 animate-pulse space-y-4">
          <div className="h-6 w-32 bg-muted rounded" />
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-4 p-4 bg-card border border-border rounded-2xl">
                <div className="size-12 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 bg-muted rounded" />
                  <div className="h-3 w-48 bg-muted rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </WebShell>
    );
  }

  if (error) {
    return (
      <WebShell>
        <div className="max-w-[680px] mx-auto py-20 text-center">
          <p className="text-muted-foreground">Failed to load following.</p>
        </div>
      </WebShell>
    );
  }

  return (
    <WebShell>
      <div className="max-w-[680px] mx-auto">
        <Link
          // @ts-expect-error TanStack Router typed-link restricts `to` to static literals; runtime correctly resolves dynamic $id param
          to={`/author/${id}`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="size-4" />
          Back to profile
        </Link>

        <h1 className="font-display italic text-3xl mb-6">
          {author?.name || author?.handle || "User"} is following
        </h1>

        <div className="space-y-3">
          {following.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12 bg-card border border-border rounded-2xl">
              Not following anyone yet.
            </p>
          ) : (
            following.map((user: any) => (
              <div
                key={user.id}
                className="flex items-center gap-4 p-4 bg-card border border-border rounded-2xl hover:border-accent/30 transition-colors"
              >
                <Link
                  // @ts-expect-error TanStack Router typed-link restricts `to` to static literals; runtime correctly resolves dynamic $handle param
                  to={`/author/${user.handle}`}
                  className="shrink-0"
                >
                  <Avatar
                    src={user.avatar}
                    name={user.name}
                    handle={user.handle}
                    size="lg"
                  />
                </Link>
                <div className="flex-1 min-w-0">
                  <Link
                    // @ts-expect-error TanStack Router typed-link restricts `to` to static literals; runtime correctly resolves dynamic $handle param
                    to={`/author/${user.handle}`}
                    className="font-semibold hover:underline block truncate"
                  >
                    {user.name}
                  </Link>
                  <p className="text-sm text-muted-foreground truncate">
                    @{user.handle}
                  </p>
                </div>
                <button
                  onClick={() => handleToggleFollow(user.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors shrink-0 ${
                    followingMap[user.id]
                      ? "bg-muted text-foreground"
                      : "bg-foreground text-background hover:opacity-90"
                  }`}
                >
                  {followingMap[user.id] ? (
                    <>
                      <Check className="size-3.5" /> Following
                    </>
                  ) : (
                    <>
                      <UserPlus className="size-3.5" /> Follow
                    </>
                  )}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
      <LoginPrompt open={showLoginPrompt} onClose={() => setShowLoginPrompt(false)} />
    </WebShell>
  );
}
