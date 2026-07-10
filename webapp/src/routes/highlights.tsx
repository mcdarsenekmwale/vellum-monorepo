import { createFileRoute } from "@tanstack/react-router";
import { WebShell } from "@/components/WebShell";
import { Heart, MessageCircle, Send, Play } from "lucide-react";
import { useSocial } from "@/lib/social-store";
import { useHighlights } from "@/hooks/useApi";

export const Route = createFileRoute("/highlights")({
  head: () => ({
    meta: [
      { title: "Highlights — Vellum" },
      {
        name: "description",
        content:
          "Short-form visual stories from writers and publications on Vellum.",
      },
    ],
  }),
  component: HighlightsPage,
});

function HighlightsPage() {
  const { likes, toggleLike } = useSocial();
  const { data: highlightsData, isLoading, error } = useHighlights(1, 20);

  const highlights = highlightsData?.data ?? [];

  if (isLoading) {
    return (
      <WebShell>
        <div className="max-w-[1100px] mx-auto">
          <h1 className="text-3xl font-display italic mb-6">Highlights</h1>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="bg-muted rounded-xl aspect-[9/16] animate-pulse"
              />
            ))}
          </div>
        </div>
      </WebShell>
    );
  }

  if (error) {
    return (
      <WebShell>
        <div className="max-w-[1100px] mx-auto py-20 text-center">
          <p className="text-muted-foreground">Failed to load highlights</p>
        </div>
      </WebShell>
    );
  }

  return (
    <WebShell>
      <div className="max-w-[1100px] mx-auto">
        <h1 className="text-3xl font-display italic mb-6">Highlights</h1>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {highlights.map((h) => {
            const liked = !!likes[`reel:${h.id}`];
            const aspectRatio = h.aspectRatio ?? 9 / 16;
            return (
              <div
                key={h.id}
                className="relative bg-muted rounded-xl overflow-hidden group cursor-pointer"
                style={{ aspectRatio }}
              >
                {h.cover && (
                  <img
                    src={h.cover}
                    alt={h.title}
                    className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />

                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="size-12 rounded-full bg-white/20 backdrop-blur grid place-items-center">
                    <Play className="size-5 text-white fill-white" />
                  </div>
                </div>

                <div className="absolute right-3 bottom-16 flex flex-col items-center gap-4 text-white">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleLike(`reel:${h.id}`);
                    }}
                    className="flex flex-col items-center gap-1"
                  >
                    <Heart
                      className={`size-6 ${liked ? "fill-accent text-accent" : ""}`}
                      strokeWidth={1.6}
                    />
                    <span className="text-[10px] font-semibold tabular-nums">
                      {(h.likesCount + (liked ? 1 : 0)).toLocaleString()}
                    </span>
                  </button>
                  <button className="flex flex-col items-center gap-1">
                    <MessageCircle className="size-6" strokeWidth={1.6} />
                    <span className="text-[10px] font-semibold">Reply</span>
                  </button>
                  <button className="flex flex-col items-center gap-1">
                    <Send className="size-6" strokeWidth={1.6} />
                    <span className="text-[10px] font-semibold">Share</span>
                  </button>
                </div>

                <div className="absolute bottom-3 left-3 right-14 text-white">
                  <p className="text-[10px] font-mono uppercase tracking-widest opacity-70 mb-1">
                    {h.handle}
                  </p>
                  <h2 className="font-display italic text-lg leading-tight">
                    {h.title}
                  </h2>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </WebShell>
  );
}
