import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { WebShell } from "@/components/WebShell";
import { Avatar } from "@/components/Avatar";
import { useArticles, useCategories } from "@/hooks/useApi";
import { apiClient } from "@/lib/api";
import { Search, TrendingUp } from "lucide-react";
import { SmartState } from "@/components/SmartState";
import { EnhancedErrorBoundary } from "@/components/EnhancedErrorBoundary";
import { useI18n } from "@/components/providers/I18nProvider";

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

export const Route = createFileRoute("/discover")({
  head: () => ({
    meta: [
      { title: "Discover — Vellbase" },
      { name: "description", content: "Search stories, browse categories, and find new voices to follow on Vellbase." },
    ],
  }),
  component: DiscoverPage,
});

function DiscoverPage() {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [searchResults, setSearchResults] = useState<{
    users: import("@/lib/api").ArticleAuthor[];
    articles: import("@/lib/api").Article[];
    highlights: import("@/lib/api").Highlight[];
    categories: import("@/lib/api").Category[];
  } | null>(null);
  const [searching, setSearching] = useState(false);

  const { data: articlesData, isLoading: articlesLoading } = useArticles(1, 10);
  const { data: categoriesData, isLoading: categoriesLoading } = useCategories();

  const articles = articlesData?.data || [];
  const categories = categoriesData || [];
  const trending = articles.slice(0, 3);

  const handleSearch = async (query: string) => {
    setQ(query);
    if (!query.trim()) {
      setSearchResults(null);
      return;
    }
    setSearching(true);
    try {
      const results = await apiClient.search(query, 1, 20);
      setSearchResults(results);
    } catch (err) {
      console.error("Search failed:", err);
      setSearchResults({ users: [], articles: [], highlights: [], categories: [] });
    } finally {
      setSearching(false);
    }
  };

  const results = searchResults;

  return (
    <WebShell>
      <EnhancedErrorBoundary>
        <div className="max-w-[900px] mx-auto">
          <h1 className="text-3xl font-display italic mb-6">{t("discover.title")}</h1>

          <section className="mb-8">
            <div className="flex items-center gap-2 bg-card border border-border rounded-full px-5 py-3">
              <Search className="size-5 text-muted-foreground shrink-0" />
              <input
                value={q}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder={t("discover.searchPlaceholder")}
                className="flex-1 min-w-0 bg-transparent text-base outline-none placeholder:text-muted-foreground"
              />
            </div>
          </section>

          {searching ? (
            <div className="py-12 text-center animate-pulse">
              <div className="h-4 w-32 bg-muted rounded mx-auto" />
            </div>
          ) : results ? (
            <div className="grid md:grid-cols-2 gap-6">
              <section>
                <h3 className="text-sm font-bold uppercase tracking-widest mb-4">
                  People · {(results as any).users?.length || 0}
                </h3>
                {(results as any).users?.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No matches.</p>
                ) : (
                  <ul className="space-y-4">
                    {(results as any).users?.map((p: any) => (
                      <li key={p.id}>
                        <Link
                            to="/author/$id"
                            params={{ id: p.handle }}
                            className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl hover:bg-muted transition-colors"
                          >
                          <Avatar src={p.avatar} name={p.name} handle={p.handle} size="lg" />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold truncate">{p.handle}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {p.name} · {p.publication || "Writer"}
                            </div>
                          </div>
                          <span className="text-xs font-semibold text-accent shrink-0">
                            View
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <h3 className="text-sm font-bold uppercase tracking-widest mb-4">
                  Stories · {results.articles?.length || 0}
                </h3>
                {results.articles?.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No matches.</p>
                ) : (
                  <ul className="space-y-4">
                    {results.articles?.map((a) => (
                      <li key={a.slug}>
                        <Link
                          to="/article/$slug"
                          params={{ slug: a.slug }}
                          className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 items-start p-3 bg-card border border-border rounded-xl hover:bg-muted transition-colors"
                        >
                          <div className="min-w-0 space-y-1">
                            <p className="text-[10px] font-bold text-accent tracking-widest uppercase">{a.category?.name || "Article"}</p>
                            <h4 className="text-base leading-tight font-semibold">{a.title}</h4>
                            <p className="text-xs text-muted-foreground">{a.author?.name || "Unknown"}</p>
                          </div>
                          <img src={a.cover || undefined} alt={a.title || 'Article cover'} className="size-16 rounded-lg object-cover shrink-0" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          ) : (
            <div className="space-y-10">
              <section>
                <h3 className="text-sm font-bold uppercase tracking-widest mb-4">Browse by section</h3>
                <SmartState
                  isLoading={categoriesLoading}
                  isError={false}
                  data={categories}
                  useShimmer
                  emptyTitle="No categories"
                  emptyDescription="Categories will appear here once created."
                  shimmerComponent={
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="aspect-[4/3] rounded-2xl bg-muted animate-pulse" />
                      ))}
                    </div>
                  }
                >
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {categories.map((c) => (
                      <Link
                        key={c.id}
                        to="/category/$name"
                        params={{ name: c.slug }}
                        className="aspect-[4/3] rounded-2xl p-5 flex flex-col justify-between overflow-hidden hover:scale-[1.02] transition-transform"
                        style={{ backgroundColor: c.tint+'50' }}
                      >
                        <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/60">
                          Section
                        </p>
                        <h4 className="font-display italic text-2xl leading-tight text-foreground">{c.name}</h4>
                      </Link>
                    ))}
                  </div>
                </SmartState>
              </section>

              <section>
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="size-5 text-accent" />
                  <h3 className="text-sm font-bold uppercase tracking-widest">Trending now</h3>
                </div>
                <SmartState
                  isLoading={articlesLoading}
                  isError={false}
                  data={trending}
                  useShimmer
                  emptyTitle="No trending stories"
                  emptyDescription="Check back later for trending content."
                  shimmerComponent={
                    <div className="grid md:grid-cols-2 gap-4">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="flex gap-4 p-4 bg-card border border-border rounded-xl animate-pulse">
                          <div className="h-10 w-12 bg-muted rounded" />
                          <div className="size-20 bg-muted rounded-lg" />
                          <div className="flex-1 space-y-2">
                            <div className="h-3 w-16 bg-muted rounded" />
                            <div className="h-4 w-full bg-muted rounded" />
                            <div className="h-3 w-24 bg-muted rounded" />
                          </div>
                        </div>
                      ))}
                    </div>
                  }
                >
                  <div className="grid md:grid-cols-2 gap-4">
                    {trending.map((a, i) => (
                      <Link
                        key={a.slug}
                        to="/article/$slug"
                        params={{ slug: a.slug }}
                        className="flex gap-4 p-4 bg-card border border-border rounded-xl hover:bg-muted transition-colors"
                      >
                        <span className="font-display italic text-4xl text-muted-foreground/30 w-12 shrink-0 text-center">
                          {i + 1}
                        </span>
                        <img src={a.cover || undefined} alt={a.title || 'Article cover'} className="size-20 rounded-lg object-cover shrink-0" />
                        <div className="min-w-0 space-y-1 flex-1">
                          <p className="text-[10px] font-bold text-accent tracking-widest uppercase">{a.category?.name || "Article"}</p>
                          <h4 className="text-sm leading-tight font-semibold line-clamp-2">{a.title}</h4>
                          <p className="text-xs text-muted-foreground">{a.readMinutes} min · {formatRelativeTime(a.publishedAt)}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </SmartState>
              </section>
            </div>
          )}
        </div>
      </EnhancedErrorBoundary>
    </WebShell>
  );
}
