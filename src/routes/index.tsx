import { createFileRoute, Link } from "@tanstack/react-router";
import { Search, Bell } from "lucide-react";
import { PhoneShell, TopBar } from "@/components/PhoneShell";
import { ArticleActions } from "@/components/ArticleActions";
import { articles, reels, stories } from "@/data/content";

export const Route = createFileRoute("/")({
  component: FeedPage,
});

function FeedPage() {
  const featured = articles.find((a) => a.featured)!;
  const rest = articles.filter((a) => !a.featured);

  return (
    <PhoneShell
      header={
        <TopBar
          right={
            <div className="flex items-center gap-2">
              <Link to="/discover" className="size-10 rounded-full bg-muted grid place-items-center hover:bg-accent/10">
                <Search className="size-4" strokeWidth={1.8} />
              </Link>
              <Link to="/notifications" className="size-10 rounded-full bg-muted grid place-items-center relative hover:bg-accent/10">
                <Bell className="size-4" strokeWidth={1.8} />
                <span className="absolute top-2 right-2 size-1.5 bg-accent rounded-full" />
              </Link>
            </div>
          }
        />
      }
    >
      {/* Stories */}
      <section className="px-6 py-4 flex gap-4 overflow-x-auto no-scrollbar">
        {stories.map((s, i) => (
          <Link
            key={s.id}
            to="/author/$id"
            params={{ id: s.id }}
            className="flex-none flex flex-col items-center gap-2 w-16"
          >
            <div className={`size-16 rounded-full p-0.5 ring-2 ring-offset-2 ring-offset-background ${i === 0 ? "ring-accent" : "ring-border"}`}>
              <img src={s.avatar} alt={s.name} className="size-full rounded-full object-cover" />
            </div>
            <span className={`text-[10px] font-medium uppercase tracking-wider truncate w-full text-center ${i === 0 ? "text-foreground" : "text-muted-foreground"}`}>
              {s.publication || s.name.split(" ")[0]}
            </span>
          </Link>
        ))}
      </section>

      {/* Hero feature */}
      <article className="px-6 py-4 animate-entry">
        <Link
          to="/article/$slug"
          params={{ slug: featured.slug }}
          className="block group"
        >
          <div className="relative w-full aspect-[4/5] bg-muted rounded-2xl overflow-hidden mb-4">
            <img src={featured.cover} alt={featured.title} className="size-full object-cover transition-transform duration-700 group-hover:scale-105" />
            <div className="absolute top-4 left-4 bg-background/90 backdrop-blur px-3 py-1 rounded-full">
              <span className="text-[10px] font-bold tracking-widest uppercase">Feature</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="font-mono text-[10px] text-accent font-semibold uppercase tracking-widest">
              {featured.category} · {featured.readMinutes} min read
            </div>
            <h2 className="text-[28px] font-display italic leading-[1.05] text-balance">{featured.title}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">{featured.excerpt}</p>
            <div className="flex justify-between items-center pt-3">
              <div className="flex items-center gap-2 min-w-0">
                <img src={featured.author.avatar} alt="" className="size-6 rounded-full object-cover shrink-0" />
                <span className="text-xs text-muted-foreground truncate">
                  By <span className="text-foreground font-medium">{featured.author.name}</span>
                </span>
              </div>
              <ArticleActions slug={featured.slug} baseLikes={featured.likes} compact />
            </div>
          </div>
        </Link>
      </article>

      {/* Reels row */}
      <section className="py-8 animate-entry" style={{ animationDelay: "150ms" }}>
        <div className="px-6 flex justify-between items-end mb-4">
          <h3 className="font-display text-xl italic">Atmospherics</h3>
          <Link to="/reels" className="text-[10px] font-bold text-accent tracking-widest uppercase">
            Watch All
          </Link>
        </div>
        <div className="flex gap-3 overflow-x-auto px-6 no-scrollbar snap-x">
          {reels.slice(0, 4).map((r) => (
            <Link
              key={r.id}
              to="/reels"
              className="flex-none w-[160px] aspect-[9/16] bg-muted rounded-xl overflow-hidden relative snap-start"
            >
              <img src={r.cover} alt={r.title} className="size-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              <div className="absolute bottom-3 left-3 right-3 text-white">
                <p className="text-[10px] font-medium opacity-80">{r.handle}</p>
                <p className="text-xs font-bold leading-tight truncate">{r.title}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* List */}
      <section className="px-6 space-y-8 pb-10 animate-entry" style={{ animationDelay: "300ms" }}>
        {rest.map((a) => (
          <Link
            key={a.slug}
            to="/article/$slug"
            params={{ slug: a.slug }}
            className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 items-start group"
          >
            <div className="min-w-0 space-y-1">
              <p className="text-[9px] font-bold text-accent tracking-widest uppercase">{a.category}</p>
              <h4 className="text-lg leading-tight font-medium group-hover:text-accent transition-colors text-balance">
                {a.title}
              </h4>
              <p className="text-xs text-muted-foreground">
                {a.author.name} · {a.publishedAgo} · {a.readMinutes} min
              </p>
            </div>
            <img src={a.cover} alt="" className="size-20 rounded-lg object-cover shrink-0" />
          </Link>
        ))}
      </section>
    </PhoneShell>
  );
}
