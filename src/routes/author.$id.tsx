import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { PhoneShell } from "@/components/PhoneShell";
import { articles, authors } from "@/data/content";
import { ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/author/$id")({
  loader: ({ params }) => {
    const author = authors.find((a) => a.id === params.id);
    if (!author) throw notFound();
    const stories = articles.filter((a) => a.author.id === author.id);
    return { author, stories };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Author not found — Vellum" }, { name: "robots", content: "noindex" }] };
    const { author } = loaderData;
    return {
      meta: [
        { title: `${author.name} — Vellum` },
        { name: "description", content: author.bio ?? `Stories by ${author.name} on Vellum.` },
        { property: "og:title", content: author.name },
        { property: "og:description", content: author.bio ?? `Stories by ${author.name}.` },
        { property: "og:image", content: author.avatar },
      ],
    };
  },
  component: AuthorPage,
  notFoundComponent: () => (
    <PhoneShell>
      <div className="p-10 text-center space-y-3">
        <h1 className="font-display italic text-3xl">Author not found</h1>
        <Link to="/" className="text-accent text-sm font-bold uppercase tracking-widest">
          Back to feed
        </Link>
      </div>
    </PhoneShell>
  ),
});

function AuthorPage() {
  const { author, stories } = Route.useLoaderData();
  const [following, setFollowing] = useState(false);

  return (
    <PhoneShell
      header={
        <nav className="px-6 pt-8 pb-4 flex justify-between items-center bg-background/80 backdrop-blur-md sticky top-0 z-20 border-b border-border/50">
          <Link to="/" className="flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground">
            <ChevronLeft className="size-4" /> Feed
          </Link>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {stories.length} stories
          </div>
        </nav>
      }
    >
      <section className="px-6 pt-6 pb-8 text-center">
        <img
          src={author.avatar}
          alt=""
          className="size-24 rounded-full object-cover mx-auto ring-2 ring-accent ring-offset-4 ring-offset-background"
        />
        <h1 className="font-display italic text-3xl mt-4">{author.name}</h1>
        <p className="font-mono text-[11px] text-muted-foreground uppercase tracking-widest mt-1">
          {author.publication ?? author.handle}
        </p>
        {author.bio && (
          <p className="text-sm text-muted-foreground mt-3 max-w-[32ch] mx-auto leading-relaxed">
            {author.bio}
          </p>
        )}
        <div className="flex justify-center gap-2 mt-5">
          <button
            onClick={() => setFollowing((f) => !f)}
            className={`rounded-full px-5 py-2 text-[11px] font-bold uppercase tracking-widest transition-colors ${
              following
                ? "bg-muted text-foreground"
                : "bg-foreground text-background hover:opacity-90"
            }`}
          >
            {following ? "Following" : "Follow"}
          </button>
          <button className="rounded-full border border-border px-5 py-2 text-[11px] font-bold uppercase tracking-widest hover:bg-muted">
            Message
          </button>
        </div>
      </section>

      <section className="px-6 pb-10 space-y-6 border-t border-border pt-6">
        <h3 className="font-display italic text-xl">Stories</h3>
        {stories.length === 0 ? (
          <p className="text-sm text-muted-foreground">No stories published yet.</p>
        ) : (
          stories.map((a: (typeof stories)[number]) => (
            <Link
              key={a.slug}
              to="/article/$slug"
              params={{ slug: a.slug }}
              className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 items-start"
            >
              <div className="min-w-0 space-y-1">
                <p className="text-[9px] font-bold text-accent tracking-widest uppercase">{a.category}</p>
                <h4 className="text-lg leading-tight font-medium text-balance">{a.title}</h4>
                <p className="text-xs text-muted-foreground">{a.publishedAgo} · {a.readMinutes} min</p>
              </div>
              <img src={a.cover} alt="" className="size-20 rounded-lg object-cover shrink-0" />
            </Link>
          ))
        )}
      </section>
    </PhoneShell>
  );
}
