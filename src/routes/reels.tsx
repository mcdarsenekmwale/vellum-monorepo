import { createFileRoute, Link } from "@tanstack/react-router";
import { PhoneShell } from "@/components/PhoneShell";
import { reels } from "@/data/content";
import { Heart, MessageCircle, Send, ChevronLeft } from "lucide-react";
import { useSocial } from "@/lib/social-store";

export const Route = createFileRoute("/reels")({
  head: () => ({
    meta: [
      { title: "Reels — Vellum" },
      { name: "description", content: "Short-form visual stories from writers and publications on Vellum." },
    ],
  }),
  component: ReelsPage,
});

function ReelsPage() {
  const { likes, toggleLike } = useSocial();

  return (
    <PhoneShell
      header={
        <nav className="px-6 pt-8 pb-4 flex justify-between items-center bg-black/80 backdrop-blur-md sticky top-0 z-20 text-white">
          <Link to="/" className="flex items-center gap-1 text-xs font-bold uppercase tracking-widest opacity-80">
            <ChevronLeft className="size-4" /> Feed
          </Link>
          <div className="font-display italic text-xl">Reels</div>
          <div className="w-12" />
        </nav>
      }
    >
      <div className="bg-black -mt-1 min-h-full">
        {reels.map((r) => {
          const liked = !!likes[`reel:${r.id}`];
          return (
            <section key={r.id} className="relative h-[720px] w-full snap-start overflow-hidden">
              <img src={r.cover} alt={r.title} className="absolute inset-0 size-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />

              {/* Right rail actions */}
              <div className="absolute right-4 bottom-32 flex flex-col items-center gap-6 text-white">
                <button
                  onClick={() => toggleLike(`reel:${r.id}`)}
                  className="flex flex-col items-center gap-1"
                >
                  <Heart className={`size-7 ${liked ? "fill-accent text-accent" : ""}`} strokeWidth={1.6} />
                  <span className="text-[10px] font-semibold tabular-nums">
                    {(r.likes + (liked ? 1 : 0)).toLocaleString()}
                  </span>
                </button>
                <button className="flex flex-col items-center gap-1">
                  <MessageCircle className="size-7" strokeWidth={1.6} />
                  <span className="text-[10px] font-semibold">Reply</span>
                </button>
                <button className="flex flex-col items-center gap-1">
                  <Send className="size-7" strokeWidth={1.6} />
                  <span className="text-[10px] font-semibold">Share</span>
                </button>
              </div>

              {/* Bottom meta */}
              <div className="absolute bottom-24 left-5 right-20 text-white">
                <p className="text-xs font-mono uppercase tracking-widest opacity-70 mb-1">{r.handle}</p>
                <h2 className="font-display italic text-2xl leading-tight">{r.title}</h2>
              </div>
            </section>
          );
        })}
      </div>
    </PhoneShell>
  );
}
