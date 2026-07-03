import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PhoneShell } from "@/components/PhoneShell";
import { articles } from "@/data/content";
import { ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/category/$name")({
  loader: ({ params }) => {
    const stories = articles.filter(
      (a) => a.category.toLowerCase() === params.name.toLowerCase(),
    );
    if (stories.length === 0) throw notFound();
    return { name: stories[0].category, stories };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Section not found — Vellum" }, { name: "robots", content: "noindex" }] };
    return {
      meta: [
        { title: `${loaderData.name} — Vellum` },
        { name: "description", content: `Stories in ${loaderData.name} on Vellum.` },
      ],
    };
  },
  component: CategoryPage,
  notFoundComponent: () => (
    <PhoneShell>
      <div className="p-10 text-center space-y-3">
        <h1 className="font-display italic text-3xl">No stories here yet</h1>
        <Link to="/discover" className="text-accent text-sm font-bold uppercase tracking-widest">
          Browse sections
        </Link>
      </div>
    </PhoneShell>
  ),
});

function CategoryPage() {
  const { name, stories } = Route.useLoaderData();
  const hero = stories[0];
  const rest = stories.slice(1);

  return (
    <PhoneShell
      header={
        <nav className="px-6 pt-8 pb-4 flex justify-between items-center bg-background/80 backdrop-blur-md sticky top-0 z-20 border-b border-border/50">
          <Link to="/discover" className="flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground">
            <ChevronLeft className="size-4" /> Discover
          </Link>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {stories.length} stories
          </div>
        </nav>
      }
    >
      <section className="px-6 pt-6 pb-4">
        <p className="font-mono text-[10px] font-bold text-accent uppercase tracking-widest mb-2">
          Section
        </p>
        <h1 className="font-display italic text-4xl leading-none">{name}</h1>
      </section>

      <Link
        to="/article/$slug"
        params={{ slug: hero.slug }}
        className="block px-6 pt-4 pb-8"
      >
        <div className="w-full aspect-[4/5] rounded-2xl overflow-hidden bg-muted mb-4">
          <img src={hero.cover} alt="" className="size-full object-cover" />
        </div>
        <h2 className="font-display italic text-2xl leading-tight text-balance">{hero.title}</h2>
        <p className="text-xs text-muted-foreground mt-2">
          {hero.author.name} · {hero.readMinutes} min
        </p>
      </Link>

      <section className="px-6 pb-10 space-y-6 border-t border-border pt-6">
        {rest.map((a) => (
          <Link
            key={a.slug}
            to="/article/$slug"
            params={{ slug: a.slug }}
            className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 items-start"
          >
            <div className="min-w-0 space-y-1">
              <p className="text-[9px] font-bold text-accent tracking-widest uppercase">{a.category}</p>
              <h4 className="text-lg leading-tight font-medium text-balance">{a.title}</h4>
              <p className="text-xs text-muted-foreground">{a.author.name} · {a.readMinutes} min</p>
            </div>
            <img src={a.cover} alt="" className="size-20 rounded-lg object-cover shrink-0" />
          </Link>
        ))}
      </section>
    </PhoneShell>
  );
}
