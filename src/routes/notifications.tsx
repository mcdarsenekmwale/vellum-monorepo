import { createFileRoute, Link } from "@tanstack/react-router";
import { PhoneShell, TopBar } from "@/components/PhoneShell";
import { authors, articles } from "@/data/content";
import { Heart, MessageCircle, UserPlus, Bookmark } from "lucide-react";
import type { ComponentType } from "react";

type Activity = {
  id: string;
  kind: "like" | "reply" | "follow" | "bookmark";
  actorId: string;
  articleSlug?: string;
  body?: string;
  ago: string;
  unread?: boolean;
};

const activity: Activity[] = [
  { id: "n1", kind: "like", actorId: "lydia", articleSlug: "serif-fonts-digital-design", ago: "8m", unread: true },
  { id: "n2", kind: "reply", actorId: "julian", articleSlug: "quiet-return-of-physical-objects", body: "This was the sentence that took the longest to write.", ago: "42m", unread: true },
  { id: "n3", kind: "follow", actorId: "elena", ago: "2h", unread: true },
  { id: "n4", kind: "bookmark", actorId: "marcus", articleSlug: "solar-windows-future", ago: "5h" },
  { id: "n5", kind: "like", actorId: "traveler", articleSlug: "brutalism-comfort", ago: "1d" },
  { id: "n6", kind: "follow", actorId: "archdaily", ago: "2d" },
];

const iconFor: Record<Activity["kind"], ComponentType<{ className?: string }>> = {
  like: Heart,
  reply: MessageCircle,
  follow: UserPlus,
  bookmark: Bookmark,
};

const verbFor: Record<Activity["kind"], string> = {
  like: "liked your story",
  reply: "replied to you",
  follow: "started following you",
  bookmark: "saved your story",
};

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — Vellum" },
      { name: "description", content: "Recent activity on your stories and profile." },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const unreadCount = activity.filter((a) => a.unread).length;

  return (
    <PhoneShell header={<TopBar title="Activity" />}>
      <section className="px-6 pt-4 pb-2 flex items-baseline justify-between">
        <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
          {unreadCount} new · this week
        </p>
        <button className="text-[10px] font-bold text-accent uppercase tracking-widest">
          Mark all read
        </button>
      </section>

      <ul className="px-2 pb-10 divide-y divide-border">
        {activity.map((n) => {
          const actor = authors.find((a) => a.id === n.actorId)!;
          const article = n.articleSlug ? articles.find((a) => a.slug === n.articleSlug) : null;
          const Icon = iconFor[n.kind];

          return (
            <li key={n.id}>
              <Link
                to={article ? "/article/$slug" : "/author/$id"}
                params={article ? { slug: article.slug } : { id: actor.id }}
                className={`grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3 items-center px-4 py-4 ${n.unread ? "bg-accent/[0.04]" : ""}`}
              >
                <div className="relative shrink-0">
                  <img src={actor.avatar} alt="" className="size-11 rounded-full object-cover" />
                  <span className="absolute -bottom-1 -right-1 size-5 rounded-full bg-background grid place-items-center border border-border">
                    <Icon className={`size-3 ${n.kind === "like" ? "text-accent fill-accent" : "text-foreground"}`} />
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm leading-snug">
                    <span className="font-medium">{actor.name}</span>{" "}
                    <span className="text-muted-foreground">{verbFor[n.kind]}</span>
                    {article && (
                      <>
                        {" "}
                        <span className="text-foreground/80">"{article.title}"</span>
                      </>
                    )}
                  </p>
                  {n.body && (
                    <p className="text-[12px] text-muted-foreground italic mt-1 line-clamp-1">"{n.body}"</p>
                  )}
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">
                    {n.ago}
                  </p>
                </div>
                {article && (
                  <img src={article.cover} alt="" className="size-12 rounded-md object-cover shrink-0" />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </PhoneShell>
  );
}
