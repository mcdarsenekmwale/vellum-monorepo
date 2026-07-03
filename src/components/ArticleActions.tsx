import { Heart, Bookmark, MessageCircle, Share2 } from "lucide-react";
import { useSocial } from "@/lib/social-store";

export function ArticleActions({
  slug,
  baseLikes,
  compact = false,
  onComment,
}: {
  slug: string;
  baseLikes: number;
  compact?: boolean;
  onComment?: () => void;
}) {
  const { likes, bookmarks, toggleLike, toggleBookmark } = useSocial();
  const liked = !!likes[slug];
  const saved = !!bookmarks[slug];
  const count = baseLikes + (liked ? 1 : 0);

  return (
    <div className={`flex items-center ${compact ? "gap-3" : "gap-4"} text-muted-foreground`}>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggleLike(slug);
        }}
        className="flex items-center gap-1.5 group"
      >
        <Heart
          className={`size-4 transition-all ${liked ? "fill-accent text-accent scale-110" : "group-hover:text-accent"}`}
          strokeWidth={1.8}
        />
        <span className="text-xs tabular-nums">{count.toLocaleString()}</span>
      </button>
      {onComment && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onComment();
          }}
          className="flex items-center gap-1.5 hover:text-foreground"
        >
          <MessageCircle className="size-4" strokeWidth={1.8} />
        </button>
      )}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggleBookmark(slug);
        }}
        className="ml-auto"
      >
        <Bookmark
          className={`size-4 transition-all ${saved ? "fill-foreground text-foreground" : "hover:text-foreground"}`}
          strokeWidth={1.8}
        />
      </button>
      {!compact && (
        <button className="hover:text-foreground">
          <Share2 className="size-4" strokeWidth={1.8} />
        </button>
      )}
    </div>
  );
}
