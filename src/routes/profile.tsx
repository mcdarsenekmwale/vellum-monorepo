import { createFileRoute, Link } from "@tanstack/react-router";
import { PhoneShell, TopBar } from "@/components/PhoneShell";
import { articles, currentUser } from "@/data/content";
import { useSocial } from "@/lib/social-store";
import { Settings, Bell, Pencil } from "lucide-react";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Your profile — Vellum" },
      { name: "description", content: "Your reading activity, likes and drafts on Vellum." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { likes, bookmarks, comments } = useSocial();
  const liked = articles.filter((a) => likes[a.slug]);
  const savedCount = Object.values(bookmarks).filter(Boolean).length;
  const myComments = comments.filter((c) => c.author.id === "me");

  const stats = [
    { label: "Reading", value: liked.length + savedCount },
    { label: "Likes", value: liked.length },
    { label: "Replies", value: myComments.length },
  ];

  return (
    <PhoneShell
      header={
        <TopBar
          title="Me"
          right={
            <div className="flex items-center gap-2">
              <Link to="/notifications" className="size-10 rounded-full bg-muted grid place-items-center">
                <Bell className="size-4" strokeWidth={1.8} />
              </Link>
              <button className="size-10 rounded-full bg-muted grid place-items-center">
                <Settings className="size-4" strokeWidth={1.8} />
              </button>
            </div>
          }
        />
      }
    >
      <section className="px-6 pt-6 pb-8 text-center">
        <img
          src={currentUser.avatar}
          alt=""
          className="size-24 rounded-full object-cover mx-auto ring-2 ring-accent ring-offset-4 ring-offset-background"
        />
        <h2 className="font-display italic text-3xl mt-4">{currentUser.name}</h2>
        <p className="font-mono text-[11px] text-muted-foreground uppercase tracking-widest mt-1">
          {currentUser.handle}
        </p>
        <p className="text-sm text-muted-foreground mt-3 max-w-[28ch] mx-auto">{currentUser.bio}</p>

        <div className="grid grid-cols-3 gap-2 mt-6 border-y border-border py-4">
          {stats.map((s) => (
            <div key={s.label}>
              <div className="font-display italic text-2xl">{s.value}</div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-0.5">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="px-6 pb-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display italic text-xl">Recently liked</h3>
          <Link to="/saved" className="text-[10px] font-bold text-accent uppercase tracking-widest">
            Saved
          </Link>
        </div>

        {liked.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing liked yet — tap the heart on a story to see it here.
          </p>
        ) : (
          <div className="space-y-6">
            {liked.map((a) => (
              <Link
                key={a.slug}
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
            ))}
          </div>
        )}
      </section>
    </PhoneShell>
  );
}
