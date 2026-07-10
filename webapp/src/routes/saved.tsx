import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { WebShell } from "@/components/WebShell";
import { useBookmarkedArticles } from "@/hooks/useApi";
import { Bookmark } from "lucide-react";
import { apiClient } from "@/lib/api";

export const Route = createFileRoute("/saved")({
  head: () => ({
    meta: [
      { title: "Saved — Vellum" },
      { name: "description", content: "The stories you've bookmarked to read later." },
    ],
  }),
  beforeLoad: async () => {
    const user = await apiClient.getCurrentUser();
    if (!user) {
      throw redirect({ to: "/login", search: { redirect: "/saved" } });
    }
  },
  component: SavedPage,
});

function SavedPage() {
  const { data, isLoading, error } = useBookmarkedArticles(1, 100);
  const saved = data?.data || [];

  if (isLoading) {
    return (
      <WebShell>
        <div className="max-w-[900px] mx-auto animate-pulse space-y-4">
          <div className="h-8 w-24 bg-muted rounded mb-2" />
          <div className="h-4 w-48 bg-muted rounded mb-6" />
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex gap-4 p-4 bg-card border border-border rounded-xl">
              <div className="size-24 bg-muted rounded-lg shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-16 bg-muted rounded" />
                <div className="h-5 w-2/3 bg-muted rounded" />
                <div className="h-3 w-32 bg-muted rounded" />
              </div>
            </div>
          ))}
        </div>
      </WebShell>
    );
  }

  if (error) {
    return (
      <WebShell>
        <div className="max-w-[900px] mx-auto py-20 text-center">
          <p className="text-muted-foreground">Failed to load saved articles. Please try again later.</p>
        </div>
      </WebShell>
    );
  }

  return (
    <WebShell>
      <div className="max-w-[900px] mx-auto">
        <section className="mb-6">
          <h1 className="text-3xl font-display italic mb-2">Saved</h1>
          <p className="text-sm text-muted-foreground">
            {saved.length} {saved.length === 1 ? "story" : "stories"} in your library
          </p>
        </section>

        {saved.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl text-center py-20 space-y-4">
            <div className="size-14 mx-auto rounded-full bg-muted grid place-items-center">
              <Bookmark className="size-6 text-muted-foreground" />
            </div>
            <h2 className="font-display italic text-2xl">Nothing saved yet</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Tap the bookmark on any story to keep it here.
            </p>
            <Link
              to="/"
              className="inline-flex items-center rounded-full bg-foreground text-background px-6 py-2.5 text-sm font-semibold hover:opacity-90"
            >
              Browse feed
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {saved.map((a) => (
              <Link
                key={a.slug}
                to="/article/$slug"
                params={{ slug: a.slug }}
                className="flex gap-4 p-4 bg-card border border-border rounded-xl hover:bg-muted transition-colors"
              >
                <img src={a.cover || ""} alt="" className="size-24 rounded-lg object-cover shrink-0" />
                <div className="min-w-0 space-y-1 flex-1">
                  <p className="text-[10px] font-bold text-accent tracking-widest uppercase">
                    {a.category?.name || "Article"}
                  </p>
                  <h4 className="text-base leading-tight font-semibold line-clamp-2">{a.title}</h4>
                  <p className="text-xs text-muted-foreground">
                    {a.author?.name || "Unknown"} · {a.readMinutes} min
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </WebShell>
  );
}
