import { createFileRoute, Link } from "@tanstack/react-router";
import { WebShell } from "@/components/WebShell";
import { useSocial } from "@/lib/social-store";
import { useAuthState, useLikedArticles, useBookmarkedArticles, useArticlesByAuthor } from "@/hooks/useApi";
import { Pencil, Grid3x3, Bookmark, Heart } from "lucide-react";
import { useState } from "react";

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

function ProfileIndexPage() {
  const { profile, likes, comments } = useSocial();
  const { user, isAuthenticated, isLoading: authLoading } = useAuthState();
  const { data: likedData, isLoading: likedLoading } = useLikedArticles(1, 100);
  const { data: bookmarkedData, isLoading: bookmarkedLoading } = useBookmarkedArticles(1, 100);
  const { data: myArticlesData, isLoading: myArticlesLoading } = useArticlesByAuthor(user?.handle || "", 1, 100);

  const likedArticles = likedData?.data || [];
  const savedArticles = bookmarkedData?.data || [];
  const myArticles = myArticlesData?.data || [];
  const totalComments = Object.values(comments).reduce((sum, arr) => sum + arr.length, 0);

  const [tab, setTab] = useState<"posts" | "saved" | "tagged">("posts");

  const currentProfile = user || profile;

  const stats = [
    { label: "Posts", value: myArticles.length },
    { label: "Followers", value: 0 },
    { label: "Following", value: 0 },
  ];

  const isLoading = authLoading || likedLoading || bookmarkedLoading;

  if (isLoading) {
    return (
      <WebShell>
        <div className="max-w-[900px] mx-auto animate-pulse space-y-6">
          <div className="bg-card border border-border rounded-2xl p-8">
            <div className="flex gap-6">
              <div className="size-32 rounded-full bg-muted" />
              <div className="flex-1 space-y-3">
                <div className="h-6 w-48 bg-muted rounded" />
                <div className="h-4 w-32 bg-muted rounded" />
                <div className="h-4 w-64 bg-muted rounded" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-card border border-border rounded-2xl p-5 h-24" />
            ))}
          </div>
        </div>
      </WebShell>
    );
  }

  return (
    <WebShell>
      <div className="max-w-[900px] mx-auto">
        {/* Profile Header */}
        <section className="bg-card border border-border rounded-2xl p-8 mb-6">
          <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
            <img
              src={currentProfile?.avatar || undefined}
              alt=""
              className="size-32 rounded-full object-cover ring-4 ring-accent ring-offset-4 ring-offset-card"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-4 mb-3 flex-wrap">
                <h1 className="text-2xl font-semibold">{currentProfile?.handle || "@you"}</h1>
                <Link
                  to="/profile/edit"
                  className="px-4 py-1.5 bg-muted hover:bg-muted/70 rounded-lg text-sm font-semibold flex items-center gap-2"
                >
                  <Pencil className="size-4" /> Edit profile
                </Link>
              </div>
              <div className="flex gap-6 mb-4">
                {stats.map((s) => (
                  <div key={s.label} className="text-sm">
                    <span className="font-semibold">{s.value.toLocaleString()}</span>{" "}
                    <span className="text-muted-foreground">{s.label.toLowerCase()}</span>
                  </div>
                ))}
              </div>
              <div>
                <p className="font-semibold">{currentProfile?.name || "You"}</p>
                <p className="text-sm text-muted-foreground">{currentProfile?.bio || undefined}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Activity Stats */}
        <section className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-card border border-border rounded-2xl p-5 text-center">
            <div className="font-display italic text-3xl">{likedArticles.length + savedArticles.length}</div>
            <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mt-1">
              Reading
            </div>
          </div>
          <div className="bg-card border border-border rounded-2xl p-5 text-center">
            <div className="font-display italic text-3xl">{likedArticles.length}</div>
            <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mt-1">
              Likes
            </div>
          </div>
          <div className="bg-card border border-border rounded-2xl p-5 text-center">
            <div className="font-display italic text-3xl">{totalComments}</div>
            <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mt-1">
              Replies
            </div>
          </div>
        </section>

        {/* Tabs */}
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
                  className={`flex-1 flex items-center justify-center gap-2 py-4 text-xs font-semibold tracking-widest transition-colors ${
                    active ? "border-b-2 border-foreground" : "text-muted-foreground hover:text-foreground"
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
              <div>
                {myArticles.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No posts yet.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {myArticles.map((a) => (
                      <Link
                        key={a.slug}
                        to="/article/$slug"
                        params={{ slug: a.slug }}
                        className="aspect-square bg-muted rounded-lg overflow-hidden group relative"
                      >
                        <img src={a.cover || undefined} alt="" className="size-full object-cover transition-transform group-hover:scale-105" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-4 text-white font-semibold">
                            <span className="flex items-center gap-1">
                              <Heart className="size-5 fill-white" /> {a.likesCount.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === "saved" && (
              <div>
                {savedArticles.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nothing saved yet — bookmark a story to keep it here.
                  </p>
                ) : (
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
                        <img src={a.cover || undefined} alt="" className="size-20 rounded-lg object-cover" />
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === "tagged" && (
              <p className="text-sm text-muted-foreground text-center py-8">
                No tagged posts yet.
              </p>
            )}
          </div>
        </section>
      </div>

      <Link
        to="/compose"
        className="fixed bottom-8 right-8 z-40 size-14 rounded-full bg-accent text-white grid place-items-center shadow-xl hover:scale-105 transition-transform"
        aria-label="New story"
      >
        <Pencil className="size-5" strokeWidth={2} />
      </Link>
    </WebShell>
  );
}
