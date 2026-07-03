import { createFileRoute, Link } from "@tanstack/react-router";
import { PhoneShell, TopBar } from "@/components/PhoneShell";
import { articles } from "@/data/content";
import { useSocial } from "@/lib/social-store";
import { Bookmark } from "lucide-react";

export const Route = createFileRoute("/saved")({
  head: () => ({
    meta: [
      { title: "Saved — Vellum" },
      { name: "description", content: "The stories you've bookmarked to read later." },
    ],
  }),
  component: SavedPage,
});

function SavedPage() {
  const { bookmarks } = useSocial();
  const saved = articles.filter((a) => bookmarks[a.slug]);

  return (
    <PhoneShell header={<TopBar title="Saved" />}>
      <section className="px-6 py-6">
        <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-6">
          {saved.length} {saved.length === 1 ? "story" : "stories"} in your library
        </p>

        {saved.length === 0 ? (
          <div className="text-center py-20 space-y-3">
            <div className="size-14 mx-auto rounded-full bg-muted grid place-items-center">
              <Bookmark className="size-5 text-muted-foreground" />
            </div>
            <h2 className="font-display italic text-2xl">Nothing saved yet</h2>
            <p className="text-sm text-muted-foreground max-w-[24ch] mx-auto">
              Tap the bookmark on any story to keep it here.
            </p>
            <Link
              to="/"
              className="inline-flex items-center rounded-full bg-foreground text-background px-5 py-2.5 text-xs font-bold uppercase tracking-widest mt-2"
            >
              Browse feed
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {saved.map((a) => (
              <Link
                key={a.slug}
                to="/article/$slug"
                params={{ slug: a.slug }}
                className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 items-start"
              >
                <div className="min-w-0 space-y-1">
                  <p className="text-[9px] font-bold text-accent tracking-widest uppercase">{a.category}</p>
                  <h4 className="text-lg leading-tight font-medium text-balance">{a.title}</h4>
                  <p className="text-xs text-muted-foreground">
                    {a.author.name} · {a.readMinutes} min
                  </p>
                </div>
                <img src={a.cover} alt="" className="size-20 rounded-lg object-cover shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </section>
    </PhoneShell>
  );
}
