import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PhoneShell, TopBar } from "@/components/PhoneShell";
import { articles, authors } from "@/data/content";
import { Search, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/discover")({
  head: () => ({
    meta: [
      { title: "Discover — Vellum" },
      { name: "description", content: "Search stories, browse categories, and find new voices to follow on Vellum." },
    ],
  }),
  component: DiscoverPage,
});

const categories = [
  { name: "Culture", tint: "oklch(0.92 0.05 40)" },
  { name: "Design", tint: "oklch(0.92 0.05 200)" },
  { name: "Environment", tint: "oklch(0.92 0.06 140)" },
  { name: "Music", tint: "oklch(0.92 0.05 300)" },
  { name: "Architecture", tint: "oklch(0.92 0.03 60)" },
  { name: "Technology", tint: "oklch(0.92 0.04 260)" },
];

function DiscoverPage() {
  const [q, setQ] = useState("");

  const results = useMemo(() => {
    if (!q.trim()) return null;
    const needle = q.toLowerCase();
    return {
      stories: articles.filter(
        (a) =>
          a.title.toLowerCase().includes(needle) ||
          a.excerpt.toLowerCase().includes(needle) ||
          a.category.toLowerCase().includes(needle),
      ),
      people: authors.filter(
        (p) =>
          p.name.toLowerCase().includes(needle) ||
          p.handle.toLowerCase().includes(needle) ||
          (p.publication ?? "").toLowerCase().includes(needle),
      ),
    };
  }, [q]);

  const trending = articles.slice(0, 3);

  return (
    <PhoneShell header={<TopBar title="Discover" />}>
      <section className="px-6 pt-4">
        <div className="flex items-center gap-2 bg-muted rounded-full px-4 py-2.5">
          <Search className="size-4 text-muted-foreground shrink-0" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search stories, people, publications…"
            className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
      </section>

      {results ? (
        <>
          <section className="px-6 pt-8 pb-4">
            <h3 className="text-xs font-bold uppercase tracking-widest mb-4">
              People · {results.people.length}
            </h3>
            {results.people.length === 0 ? (
              <p className="text-sm text-muted-foreground">No matches.</p>
            ) : (
              <ul className="space-y-4">
                {results.people.map((p) => (
                  <li key={p.id}>
                    <Link
                      to="/author/$id"
                      params={{ id: p.id }}
                      className="flex items-center gap-3"
                    >
                      <img src={p.avatar} alt="" className="size-11 rounded-full object-cover shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{p.name}</div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {p.publication ?? p.handle}
                        </div>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-accent shrink-0">
                        View
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="px-6 pb-10">
            <h3 className="text-xs font-bold uppercase tracking-widest mb-4">
              Stories · {results.stories.length}
            </h3>
            {results.stories.length === 0 ? (
              <p className="text-sm text-muted-foreground">No matches.</p>
            ) : (
              <ul className="space-y-6">
                {results.stories.map((a) => (
                  <li key={a.slug}>
                    <Link
                      to="/article/$slug"
                      params={{ slug: a.slug }}
                      className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 items-start"
                    >
                      <div className="min-w-0 space-y-1">
                        <p className="text-[9px] font-bold text-accent tracking-widest uppercase">{a.category}</p>
                        <h4 className="text-base leading-tight font-medium">{a.title}</h4>
                        <p className="text-xs text-muted-foreground">{a.author.name}</p>
                      </div>
                      <img src={a.cover} alt="" className="size-16 rounded-lg object-cover shrink-0" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : (
        <>
          <section className="px-6 pt-8">
            <h3 className="text-xs font-bold uppercase tracking-widest mb-4">Browse by section</h3>
            <div className="grid grid-cols-2 gap-3">
              {categories.map((c) => (
                <Link
                  key={c.name}
                  to="/category/$name"
                  params={{ name: c.name.toLowerCase() }}
                  className="aspect-[4/3] rounded-2xl p-4 flex flex-col justify-between overflow-hidden"
                  style={{ backgroundColor: c.tint }}
                >
                  <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-foreground/60">
                    Section
                  </p>
                  <h4 className="font-display italic text-xl leading-tight text-foreground">{c.name}</h4>
                </Link>
              ))}
            </div>
          </section>

          <section className="px-6 pt-8 pb-10">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="size-4 text-accent" />
              <h3 className="text-xs font-bold uppercase tracking-widest">Trending now</h3>
            </div>
            <ol className="space-y-6">
              {trending.map((a, i) => (
                <li key={a.slug}>
                  <Link
                    to="/article/$slug"
                    params={{ slug: a.slug }}
                    className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-4 items-center"
                  >
                    <span className="font-display italic text-3xl text-muted-foreground w-8 text-center">
                      {i + 1}
                    </span>
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-[9px] font-bold text-accent tracking-widest uppercase">{a.category}</p>
                      <h4 className="text-sm leading-tight font-medium line-clamp-2">{a.title}</h4>
                      <p className="text-[11px] text-muted-foreground">{a.readMinutes} min · {a.publishedAgo}</p>
                    </div>
                    <img src={a.cover} alt="" className="size-14 rounded-lg object-cover shrink-0" />
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        </>
      )}
    </PhoneShell>
  );
}
