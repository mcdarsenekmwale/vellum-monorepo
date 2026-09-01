import React, { useState, useEffect, useCallback } from "react";
import { Heart, Bookmark, MessageCircle, Share2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

interface ArticleActionsProps {
  articleSlug: string;
  isLiked: boolean;
  isBookmarked: boolean;
  isCommented?: boolean;
  likesCount: number;
  commentsCount: number;
  onLikeToggle?: (slug: string) => void;
  onBookmarkToggle?: (slug: string) => void;
  onCommentClick?: (slug: string) => void;
  onShare?: (slug: string) => void;
  size?: "sm" | "md" | "lg";
  variant?: "spread" | "compact";
  showShare?: boolean;
  showCounts?: boolean;
  tintColor?: string;
  activeTintColor?: string;
  className?: string;
}

const SIZE_CONFIG = {
  sm: {
    icon: "size-4",
    gap: "gap-3",
    text: "text-xs",
  },
  md: {
    icon: "size-5",
    gap: "gap-4",
    text: "text-sm",
  },
  lg: {
    icon: "size-6",
    gap: "gap-6",
    text: "text-base",
  },
};

function ActionButton({
  children,
  onClick,
  className,
  activeColor,
  active,
  "aria-label": ariaLabel,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  activeColor?: string;
  active?: boolean;
  "aria-label"?: string;
}) {
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (active) {
      setAnimating(true);
      const timer = setTimeout(() => setAnimating(false), 300);
      return () => clearTimeout(timer);
    }
  }, [active]);

  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center transition-colors duration-200",
        "hover:opacity-70 active:opacity-50",
        className
      )}
      style={active && activeColor ? { color: activeColor } : undefined}
    >
      <span
        className={cn("inline-block", animating && "animate-bounce-in")}
        style={{
          animation: animating
            ? "ig-bounce 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)"
            : undefined,
        }}
      >
        {children}
      </span>
    </button>
  );
}

export function ArticleActions({
  articleSlug,
  isLiked,
  isBookmarked,
  isCommented = false,
  likesCount,
  commentsCount,
  onLikeToggle,
  onBookmarkToggle,
  onCommentClick,
  onShare,
  size = "md",
  variant = "spread",
  showShare = true,
  showCounts = true,
  tintColor,
  activeTintColor = "#d97706",
  className,
}: ArticleActionsProps) {
  const config = SIZE_CONFIG[size];

  const handleLike = useCallback(() => {
    if (onLikeToggle) onLikeToggle(articleSlug);
  }, [onLikeToggle, articleSlug]);

  const handleBookmark = useCallback(() => {
    if (onBookmarkToggle) onBookmarkToggle(articleSlug);
  }, [onBookmarkToggle, articleSlug]);

  const handleShare = useCallback(() => {
    if (onShare) onShare(articleSlug);
  }, [onShare, articleSlug]);

  const likeColor = isLiked ? activeTintColor : tintColor || "currentColor";
  const commentColor = isCommented ? activeTintColor : tintColor || "currentColor";
  const bookmarkColor = isBookmarked ? activeTintColor : tintColor || "currentColor";

  const commentElement = onCommentClick ? (
    <button
      onClick={() => onCommentClick(articleSlug)}
      className="inline-flex items-center transition-colors duration-200 hover:opacity-70"
      style={{ color: isCommented ? activeTintColor : tintColor || "currentColor" }}
      aria-label={isCommented ? "View comments" : "Comment on article"}
    >
      <MessageCircle className={config.icon} strokeWidth={1.8} />
    </button>
  ) : (
    <Link
      to="/article/$slug"
      params={{ slug: articleSlug }}
      className="inline-flex items-center transition-colors duration-200 hover:opacity-70"
      style={{ color: isCommented ? activeTintColor : tintColor || "currentColor" }}
      aria-label="View comments"
    >
      <MessageCircle className={config.icon} strokeWidth={1.8} />
    </Link>
  );

  return (
    <div
      className={cn(
        "flex items-center",
        variant === "spread" && "justify-between w-full",
        config.gap,
        className
      )}
    >
      <div className={cn("flex items-center", config.gap)}>
        {onLikeToggle ? (
          <ActionButton
            onClick={handleLike}
            active={isLiked}
            activeColor={activeTintColor}
            className={tintColor ? "" : "text-foreground"}
            aria-label={isLiked ? "Unlike article" : "Like article"}
          >
            <Heart
              className={config.icon}
              strokeWidth={1.8}
              fill={isLiked ? activeTintColor : "none"}
              color={isLiked ? activeTintColor : "currentColor"}
            />
          </ActionButton>
        ) : (
          <Heart
            className={config.icon}
            strokeWidth={1.8}
            fill={isLiked ? activeTintColor : "none"}
            color={likeColor}
          />
        )}

        {showCounts && likesCount > 0 && (
          <span className={cn("font-semibold", config.text)} style={{ color: tintColor || undefined }}>
            {likesCount.toLocaleString()}
          </span>
        )}

        {commentElement}

        {showCounts && commentsCount > 0 && (
          <span className={cn("font-semibold", config.text)} style={{ color: tintColor || undefined }}>
            {commentsCount.toLocaleString()}
          </span>
        )}
      </div>

      <div className={cn("flex items-center", config.gap)}>
        {showShare && (
          <button
            onClick={handleShare}
            className="inline-flex items-center transition-colors duration-200 hover:opacity-70"
            style={{ color: tintColor || "currentColor" }}
            aria-label="Share article"
          >
            <Share2 className={config.icon} strokeWidth={1.8} />
          </button>
        )}

        {onBookmarkToggle ? (
          <ActionButton
            onClick={handleBookmark}
            active={isBookmarked}
            activeColor={activeTintColor}
            className={tintColor ? "" : "text-foreground"}
            aria-label={isBookmarked ? "Remove bookmark" : "Bookmark article"}
          >
            <Bookmark
              className={config.icon}
              strokeWidth={1.8}
              fill={isBookmarked ? activeTintColor : "none"}
              color={isBookmarked ? activeTintColor : "currentColor"}
            />
          </ActionButton>
        ) : (
          <Bookmark
            className={config.icon}
            strokeWidth={1.8}
            fill={isBookmarked ? activeTintColor : "none"}
            color={bookmarkColor}
          />
        )}
      </div>
    </div>
  );
}

export default ArticleActions;
