import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { WebShell } from "@/components/WebShell";
import { useUser, useArticlesByAuthor } from "@/hooks/useApi";
import { ArrowLeft, MessageCircle, UserPlus, Check } from "lucide-react";

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
    meta: [{ title: "Author — Vellum" }],
  }),
  component: AuthorPage,
});

function AuthorPage() {
  const { id } = Route.useParams();
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
  const [following, setFollowing] = useState(false);

  const stories = storiesData?.data ?? [];
  const isLoading = authorLoading || storiesLoading;
  const error = authorError || storiesError;

  if (isLoading) {
    return (
      <WebShell>
        <div className="max-w-[900px] mx-auto py-20 text-center">
          <div className="animate-pulse space-y-4">
            <div className="h-32 w-32 bg-muted rounded-full mx-auto" />
            <div className="h-8 w-48 bg-muted rounded mx-auto" />
            <div className="h-4 w-64 bg-muted rounded mx-auto" />
          </div>
        </div>
      </WebShell>
    );
  }

  if (error || !author) {
    return (
      <WebShell>
        <div className="max-w-[680px] mx-auto py-20 text-center space-y-4">
          <h1 className="font-display italic text-4xl">Author not found</h1>
          <Link
            to="/"
            className="text-accent text-sm font-bold uppercase tracking-widest hover:underline"
          >
            Back to feed
          </Link>
        </div>
      </WebShell>
    );
  }

  return (
    <WebShell>
      <div className="max-w-[900px] mx-auto">
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
            <img
              src={
                author.avatar ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(author.name)}&background=random`
              }
              alt={author.name}
              className="size-32 rounded-full object-cover ring-2 ring-accent ring-offset-4 ring-offset-card shrink-0"
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
                  <p className="text-2xl font-bold">{stories.length}</p>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest">
                    Stories
                  </p>
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {stories
                      .reduce((sum, s) => sum + (s.likesCount || 0), 0)
                      .toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest">
                    Likes
                  </p>
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {stories
                      .reduce((sum, s) => sum + (s.commentCount || 0), 0)
                      .toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest">
                    Comments
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap justify-center md:justify-start gap-3 mt-6">
                <button
                  onClick={() => setFollowing((f) => !f)}
                  className={`inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold transition-colors ${
                    following
                      ? "bg-muted text-foreground"
                      : "bg-foreground text-background hover:opacity-90"
                  }`}
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
                <button className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-2.5 text-sm font-semibold hover:bg-muted">
                  <MessageCircle className="size-4" />
                  Message
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Stories List */}
        <div className="mt-8">
          <h2 className="font-display italic text-2xl mb-4">Stories</h2>
          {stories.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No stories published yet.
            </p>
          ) : (
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
          )}
        </div>
      </div>
    </WebShell>
  );
}
