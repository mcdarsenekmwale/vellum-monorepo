import { createFileRoute, Link } from "@tanstack/react-router";
import { WebShell } from "@/components/WebShell";
import { useCategory } from "@/hooks/useApi";
import { ArrowLeft, Clock } from "lucide-react";

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

export const Route = createFileRoute("/category/$name")({
  head: () => ({
    meta: [{ title: "Category — Vellum" }],
  }),
  component: CategoryPage,
});

function CategoryPage() {
  const { name } = Route.useParams();
  const { data: category, isLoading, error } = useCategory(name);

  if (isLoading) {
    return (
      <WebShell>
        <div className="max-w-[1000px] mx-auto py-20">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-48 bg-muted rounded" />
            <div className="h-64 w-full bg-muted rounded-2xl" />
          </div>
        </div>
      </WebShell>
    );
  }

  if (error || !category) {
    return (
      <WebShell>
        <div className="max-w-[680px] mx-auto py-20 text-center space-y-4">
          <h1 className="font-display italic text-4xl">No stories here yet</h1>
          <Link
            to="/discover"
            className="text-accent text-sm font-bold uppercase tracking-widest hover:underline"
          >
            Browse sections
          </Link>
        </div>
      </WebShell>
    );
  }

  const stories = category.articles ?? [];
  const hero = stories[0];
  const rest = stories.slice(1);

  return (
    <WebShell>
      <div className="max-w-[1000px] mx-auto">
        {/* Back link */}
        <Link
          to="/discover"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="size-4" />
          Back to discover
        </Link>

        {/* Section Header */}
        <div className="mb-8">
          <p className="font-mono text-xs font-bold text-accent uppercase tracking-widest mb-2">
            Section
          </p>
          <h1 className="font-display italic text-5xl md:text-6xl leading-none">
            {category.name}
          </h1>
          <p className="text-sm text-muted-foreground mt-3">
            {stories.length} {stories.length === 1 ? "story" : "stories"}
          </p>
        </div>

        {/* Hero Story */}
        {hero && (
          <Link
            to="/article/$slug"
            params={{ slug: hero.slug }}
            className="group block mb-10"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-card border border-border rounded-2xl overflow-hidden hover:border-accent transition-colors">
              <div className="aspect-[4/3] md:aspect-auto overflow-hidden bg-muted">
                {hero.cover && (
                  <img
                    src={hero.cover}
                    alt=""
                    className="size-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                )}
              </div>
              <div className="p-6 md:p-8 flex flex-col justify-center space-y-4">
                <p className="text-[10px] font-bold text-accent tracking-widest uppercase">
                  {hero.category?.name ?? category.name}
                </p>
                <h2 className="font-display italic text-3xl md:text-4xl leading-tight text-balance group-hover:text-accent transition-colors">
                  {hero.title}
                </h2>
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {hero.excerpt ?? "Read on Vellum."}
                </p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground pt-2">
                  {hero.author?.avatar && (
                    <img
                      src={hero.author.avatar}
                      alt=""
                      className="size-7 rounded-full object-cover"
                    />
                  )}
                  <span className="font-semibold text-foreground">
                    {hero.author?.name}
                  </span>
                  <span>·</span>
                  <Clock className="size-3" />
                  <span>{hero.readMinutes} min read</span>
                </div>
              </div>
            </div>
          </Link>
        )}

        {/* Other Stories */}
        {rest.length > 0 && (
          <div>
            <h3 className="font-display italic text-2xl mb-4">
              More in {category.name}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rest.map((a) => (
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
                      {a.category?.name ?? category.name}
                    </p>
                    <h4 className="text-base leading-tight font-semibold text-balance line-clamp-2 group-hover:text-accent transition-colors">
                      {a.title}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      {a.author?.name} · {a.readMinutes} min
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </WebShell>
  );
}
