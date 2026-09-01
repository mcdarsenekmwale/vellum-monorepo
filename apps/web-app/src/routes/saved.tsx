import { createFileRoute, Link } from "@tanstack/react-router";
import { WebShell } from "@/components/WebShell";
import { useBookmarkedArticles } from "@/hooks/useApi";
import { Bookmark } from "lucide-react";
import { requireAuth } from "@/lib/auth";
import { SmartState } from "@/components/SmartState";
import { EnhancedErrorBoundary } from "@/components/EnhancedErrorBoundary";
import { useI18n } from "@/components/providers/I18nProvider";

export const Route = createFileRoute("/saved")({
  head: () => ({
    meta: [
      { title: "Saved — Vellbase" },
      { name: "description", content: "The stories you've bookmarked to read later." },
    ],
  }),
  beforeLoad: async ({ location }) => {
    await requireAuth(location.pathname);
  },
  component: SavedPage,
});

function SavedPage() {
  const { data, isLoading, error } = useBookmarkedArticles(1, 100);
  const { t } = useI18n();
  const saved = data?.data || [];

  return (
    <WebShell>
      <EnhancedErrorBoundary>
        <div className="max-w-[900px] mx-auto">
          <section className="mb-6">
            <h1 className="text-3xl font-display italic mb-2">{t("navigation.saved")}</h1>
            <p className="text-sm text-muted-foreground">
              {saved.length} {saved.length === 1 ? "story" : "stories"} in your library
            </p>
          </section>

          <SmartState
            isLoading={isLoading}
            isError={!!error}
            error={error}
            data={saved}
            useShimmer
            emptyTitle={t("emptyStates.noSavedArticles")}
            emptyDescription="Tap the bookmark on any story to keep it here."
            onRetry={() => window.location.reload()}
            shimmerComponent={
              <div className="space-y-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex gap-4 p-4 bg-card border border-border rounded-xl animate-pulse">
                    <div className="size-24 bg-muted rounded-lg shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-16 bg-muted rounded" />
                      <div className="h-5 w-2/3 bg-muted rounded" />
                      <div className="h-3 w-32 bg-muted rounded" />
                    </div>
                  </div>
                ))}
              </div>
            }
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {saved.map((a) => (
                <Link
                  key={a.slug}
                  to="/article/$slug"
                  params={{ slug: a.slug }}
                  className="flex gap-4 p-4 bg-card border border-border rounded-xl hover:bg-muted transition-colors"
                >
                  <img src={a.cover || undefined} alt={a.title || 'Article cover'} className="size-24 rounded-lg object-cover shrink-0" />
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
          </SmartState>
        </div>
      </EnhancedErrorBoundary>
    </WebShell>
  );
}
