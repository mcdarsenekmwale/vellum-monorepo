import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMemo, useState, useEffect, useCallback } from "react";
import { WebShell } from "@/components/WebShell";
import { Avatar } from "@/components/Avatar";
import ShimmerImage from "@/components/ShimmerImage";
import { useSocial } from "@/lib/social-store";
import { useArticle, useAuthState } from "@/hooks/useApi";
import { ChevronLeft, Send, Heart, Bookmark, MessageCircle, Eye, Sparkles, Share2, Copy, Check } from "lucide-react";
import type { Comment } from "@/lib/api";
import { SmartState } from "@/components/SmartState";
import { GuestGuard } from "@/components/GuestGuard";
import { EnhancedErrorBoundary } from "@/components/EnhancedErrorBoundary";

function formatRelativeTime(dateStr: string | undefined): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = Date.now();
  const diff = now - date.getTime();
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d`;
  return date.toLocaleDateString();
}

export const Route = createFileRoute("/article/$slug")({
  component: ArticleDetail,
  notFoundComponent: () => (
    <WebShell>
      <div className="max-w-[680px] mx-auto py-20 text-center space-y-4">
        <h1 className="font-display italic text-4xl">Story not found</h1>
        <Link to="/" className="text-accent text-sm font-bold uppercase tracking-widest hover:underline">
          Back to feed
        </Link>
      </div>
    </WebShell>
  ),
});

function ArticleDetail() {
  const { slug } = Route.useParams();
  const { data: article, isLoading, error } = useArticle(slug);
  const { user, isAuthenticated } = useAuthState();
  const { commentsFor, addComment, isLiked, isSaved, hasCommented, toggleLike, toggleBookmark, markArticleViewed, refreshComments, shareArticle } = useSocial();
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [showAiSummary, setShowAiSummary] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const [likeAnimKey, setLikeAnimKey] = useState(0);
  const [bookmarkAnimKey, setBookmarkAnimKey] = useState(0);

  useEffect(() => {
    if (slug) {
      refreshComments(slug);
    }
  }, [slug, refreshComments]);

  useEffect(() => {
    if (slug) {
      markArticleViewed(slug);
    }
  }, [slug, markArticleViewed]);

  useEffect(() => {
    if (!showShareMenu) return;
    const handleClickOutside = () => setShowShareMenu(false);
    const timer = setTimeout(() => {
      document.addEventListener("click", handleClickOutside);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("click", handleClickOutside);
    };
  }, [showShareMenu]);

  const all = commentsFor(slug);
  const liked = isLiked(slug);
  const saved = isSaved(slug);
  const commented = hasCommented(slug);

  const handleLike = useCallback(() => {
    setLikeAnimKey(k => k + 1);
    toggleLike(slug);
  }, [toggleLike, slug]);

  const handleBookmark = useCallback(() => {
    setBookmarkAnimKey(k => k + 1);
    toggleBookmark(slug);
  }, [toggleBookmark, slug]);

  const aiSummary = useMemo(() => {
    if (!article) return null;
    const sentences = article.body.join(" ").split(/[.!?]+/).filter(Boolean);
    const keyPoints = sentences.slice(0, 3).map((s) => s.trim()).filter(Boolean);
    return {
      tlDr: article.excerpt,
      keyPoints,
      readTime: article.readMinutes,
      tone: article.category?.name === "Culture" ? "Thoughtful & reflective" :
            article.category?.name === "Design" ? "Analytical & design-focused" :
            article.category?.name === "Technology" ? "Technical & forward-looking" :
            "Informative & engaging",
    };
  }, [article]);

  const threads = useMemo(() => {
    const roots = all.filter((c) => !c.parentId);
    return roots.map((r) => ({
      root: r,
      replies: all.filter((c) => c.parentId === r.id),
    }));
  }, [all]);

  const submit = async () => {
    if (!draft.trim()) return;
    await addComment(slug, draft, replyTo?.id);
    setDraft("");
    setReplyTo(null);
  };

  const handleShare = async () => {
    const url = window.location.href;
    const shareData = {
      title: article?.title || "Vellbase",
      text: article?.excerpt || "",
      url,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        if (slug) shareArticle(slug);
      } catch {
        // User cancelled
      }
    } else {
      setShowShareMenu(!showShareMenu);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      if (slug) shareArticle(slug);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const shareOnTwitter = () => {
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(article?.title || "");
    window.open(`https://twitter.com/intent/tweet?url=${url}&text=${text}`, "_blank");
    setShowShareMenu(false);
    if (slug) shareArticle(slug);
  };

  const shareOnLinkedIn = () => {
    const url = encodeURIComponent(window.location.href);
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}`, "_blank");
    setShowShareMenu(false);
    if (slug) shareArticle(slug);
  };

  const likes = liked && article ? article.likesCount + 1 : (article?.likesCount ?? 0);

  return (
    <WebShell>
      <EnhancedErrorBoundary>
        <div className="max-w-[720px] mx-auto">
          <SmartState
            isLoading={isLoading}
            isError={!!error}
            error={error}
            data={article}
            useShimmer
            emptyTitle="Article not found"
            emptyDescription="This story may have been removed or the link is incorrect."
            onRetry={() => window.location.reload()}
            shimmerComponent={
              <div className="space-y-6">
                <div className="h-4 w-32 bg-muted rounded" />
                <div className="aspect-[16/10] bg-muted rounded-[2rem]" />
                <div className="h-4 w-24 bg-muted rounded" />
                <div className="h-12 w-3/4 bg-muted rounded" />
                <div className="h-6 w-full bg-muted rounded" />
                <div className="h-4 w-48 bg-muted rounded" />
                <div className="space-y-4">
                  <div className="h-4 w-full bg-muted rounded" />
                  <div className="h-4 w-full bg-muted rounded" />
                  <div className="h-4 w-2/3 bg-muted rounded" />
                </div>
              </div>
            }
          >
            {article && (
              <>
                {/* Back link */}
                <Link
                  to="/"
                  className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8"
                >
                  <ChevronLeft className="size-4" /> Back to feed
                </Link>

                {/* Hero cover with feature badge */}
                <div className="relative mb-8">
                  <div className="overflow-hidden rounded-[2rem] bg-muted">
                    <ShimmerImage
                      src={article.cover || undefined}
                      alt={article.title}
                      className="size-full object-cover"
                      wrapperClassName="w-full"
                      aspectRatio="16/9"
                    />
                  </div>
                  {article.featured && (
                    <div className="absolute top-6 left-6">
                      <span className="inline-block bg-white text-foreground px-6 py-2.5 rounded-full text-xs font-bold uppercase tracking-widest shadow-sm">
                        Feature
                      </span>
                    </div>
                  )}
                </div>

                {/* Meta: category + read time */}
                <div className="flex items-center gap-3 text-sm font-bold uppercase tracking-[0.2em] text-amber-600 mb-5">
                  <span>{article.category?.name || "Article"}</span>
                  <span className="opacity-50">·</span>
                  <span>{article.readMinutes} min read</span>
                </div>

                {/* Title */}
                <h1 className="font-display italic text-5xl md:text-6xl lg:text-7xl leading-[1.05] text-balance mb-6">
                  {article.title}
                </h1>

                {/* Excerpt / dek */}
                <p className="text-xl md:text-2xl text-muted-foreground leading-relaxed text-balance mb-10">
                  {article.excerpt}
                </p>

                {/* Author row: avatar + byline | likes + bookmark */}
                <div className="flex items-center justify-between pb-10 border-b border-border">
                  <Link
                    to="/author/$id"
                    params={{ id: article.author?.handle || article.authorId }}
                    className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                  >
                    <Avatar
                      src={article.author?.avatar}
                      alt=""
                      name={article.author?.name}
                      handle={article.author?.handle}
                      size="lg"
                    />
                    <div>
                      <p className="text-lg font-semibold">
                        By {article.author?.name || "Unknown"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatRelativeTime(article.publishedAt)}
                      </p>
                    </div>
                  </Link>

                  <div className="flex items-center gap-5">
                    <GuestGuard user={user} mode="prompt" promptMessage="Sign in to like this article">
                      <button
                        onClick={handleLike}
                        className="flex items-center gap-2 text-lg font-medium text-foreground hover:text-amber-600 transition-colors"
                      >
                        <span key={likeAnimKey} className={liked ? "ig-bounce" : ""}>
                          <Heart
                            className="size-6"
                            strokeWidth={1.8}
                            fill={liked ? "#d97706" : "none"}
                            color={liked ? "#d97706" : "currentColor"}
                          />
                        </span>
                        <span>{likes.toLocaleString()}</span>
                      </button>
                    </GuestGuard>
                    <GuestGuard user={user} mode="prompt" promptMessage="Sign in to save this article">
                      <button
                        onClick={handleBookmark}
                        className="hover:text-amber-600 transition-colors"
                      >
                        <span key={bookmarkAnimKey} className={saved ? "ig-bounce" : ""}>
                          <Bookmark
                            className="size-6"
                            strokeWidth={1.8}
                            fill={saved ? "#d97706" : "none"}
                            color={saved ? "#d97706" : "currentColor"}
                          />
                        </span>
                      </button>
                    </GuestGuard>
                    <button
                      onClick={handleShare}
                      className="hover:text-amber-600 transition-colors"
                    >
                      <Share2
                        className="size-6"
                        strokeWidth={1.8}
                      />
                    </button>
                  </div>
                </div>

                {/* Body content */}
                <div className="py-10 space-y-6">
                  {article.body.map((p: string, i: number) => (
                    <p
                      key={i}
                      className={`text-lg leading-[1.8] text-foreground/90 ${
                        i === 0 ? "first-letter:font-display first-letter:italic first-letter:text-6xl first-letter:float-left first-letter:mr-3 first-letter:leading-none first-letter:text-amber-600" : ""
                      }`}
                    >
                      {p}
                    </p>
                  ))}
                </div>

                {/* Bottom actions */}
                <div className="py-8 border-t border-border flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <GuestGuard user={user} mode="prompt" promptMessage="Sign in to like this article">
                      <button
                        onClick={handleLike}
                        className="flex items-center gap-2 text-base font-semibold hover:text-amber-600 transition-colors"
                      >
                        <span key={`bottom-like-${likeAnimKey}`} className={liked ? "ig-bounce" : ""}>
                          <Heart
                            className="size-6"
                            strokeWidth={1.8}
                            fill={liked ? "#d97706" : "none"}
                            color={liked ? "#d97706" : "currentColor"}
                          />
                        </span>
                        <span>{likes.toLocaleString()} likes</span>
                      </button>
                    </GuestGuard>
                    <button
                      onClick={() => {
                        const el = document.getElementById("comments-section");
                        if (el) el.scrollIntoView({ behavior: "smooth" });
                      }}
                      className={`flex items-center gap-2 text-base font-semibold transition-colors ${
                        commented ? "text-amber-600 hover:text-amber-700" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <MessageCircle
                        className="size-6"
                        strokeWidth={1.8}
                        fill={commented ? "#d97706" : "none"}
                        color={commented ? "#d97706" : "currentColor"}
                      />
                      <span>{all.length} comments</span>
                    </button>
                    <div className="relative">
                      <button
                        onClick={handleShare}
                        className="flex items-center gap-2 text-base font-semibold text-muted-foreground hover:text-amber-600 transition-colors"
                      >
                        <Share2 className="size-6" strokeWidth={1.8} />
                        <span>Share</span>
                      </button>
                      {showShareMenu && (
                        <div className="absolute bottom-full left-0 mb-2 bg-card border border-border rounded-xl shadow-lg p-2 min-w-[180px] z-10">
                          <button
                            onClick={copyLink}
                            className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg hover:bg-muted transition-colors text-left"
                          >
                            {copied ? <Check className="size-4 text-green-600" /> : <Copy className="size-4" />}
                            {copied ? "Copied!" : "Copy link"}
                          </button>
                          <button
                            onClick={shareOnTwitter}
                            className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg hover:bg-muted transition-colors text-left"
                          >
                            <Share2 className="size-4" />
                            Share on Twitter
                          </button>
                          <button
                            onClick={shareOnLinkedIn}
                            className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg hover:bg-muted transition-colors text-left"
                          >
                            <Share2 className="size-4" />
                            Share on LinkedIn
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Eye className="size-5" strokeWidth={1.8} />
                      <span>{article.views.toLocaleString()} views</span>
                    </div>
                    <GuestGuard user={user} mode="prompt" promptMessage="Sign in to save this article">
                      <button
                        onClick={handleBookmark}
                        className="flex items-center gap-2 text-base font-semibold hover:text-amber-600 transition-colors"
                      >
                        <span key={`bottom-bookmark-${bookmarkAnimKey}`} className={saved ? "ig-bounce" : ""}>
                          <Bookmark
                            className="size-6"
                            strokeWidth={1.8}
                            fill={saved ? "#d97706" : "none"}
                            color={saved ? "#d97706" : "currentColor"}
                          />
                        </span>
                        <span>{saved ? "Saved" : "Save"}</span>
                      </button>
                    </GuestGuard>
                  </div>
                </div>

                {/* AI Summary */}
                {aiSummary && (
                  <div className="py-8 border-t border-border">
                    <button
                      onClick={() => setShowAiSummary(!showAiSummary)}
                      className="w-full flex items-center justify-between p-5 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 rounded-2xl hover:from-amber-100 hover:to-orange-100 dark:hover:from-amber-950/50 dark:hover:to-orange-950/50 transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-full bg-amber-500 grid place-items-center text-white">
                          <Sparkles className="size-5" />
                        </div>
                        <div className="text-left">
                          <p className="font-semibold text-foreground">AI Summary</p>
                          <p className="text-sm text-muted-foreground">Get the key takeaways in seconds</p>
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-amber-600 group-hover:text-amber-700 transition-colors">
                        {showAiSummary ? "Hide" : "Show"}
                      </span>
                    </button>

                    {showAiSummary && (
                      <div className="mt-5 p-6 bg-card border border-border rounded-2xl space-y-5 animate-entry">
                        <div>
                          <h4 className="text-sm font-bold uppercase tracking-wider text-amber-600 mb-2">TL;DR</h4>
                          <p className="text-base text-foreground/90 leading-relaxed">{aiSummary.tlDr}</p>
                        </div>
                        <div>
                          <h4 className="text-sm font-bold uppercase tracking-wider text-amber-600 mb-3">Key Points</h4>
                          <ul className="space-y-2">
                            {aiSummary.keyPoints.map((point, i) => (
                              <li key={i} className="flex gap-3 text-sm text-foreground/80">
                                <span className="text-amber-500 font-bold shrink-0">{i + 1}.</span>
                                <span>{point}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="flex gap-6 pt-4 border-t border-border">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Read Time</p>
                            <p className="text-sm font-semibold text-foreground mt-1">{aiSummary.readTime} min</p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tone</p>
                            <p className="text-sm font-semibold text-foreground mt-1">{aiSummary.tone}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Comments section */}
                <section id="comments-section" className="py-10 border-t border-border">
                  <h2 className="text-xl font-semibold mb-8 flex items-center gap-2">
                    <MessageCircle className="size-5" />
                    Discussion · {all.length}
                  </h2>
                  <div className="space-y-8">
                    {threads.map(({ root, replies }) => (
                      <CommentBlock
                        key={root.id}
                        comment={root}
                        replies={replies}
                        onReply={setReplyTo}
                      />
                    ))}
                    {threads.length === 0 && (
                      <p className="text-sm text-muted-foreground">Be the first to reply.</p>
                    )}
                  </div>
                </section>

                {/* Comment composer */}
                <GuestGuard user={user} mode="prompt" promptMessage="Sign in to join the discussion" className="sticky bottom-4 pt-4">
                  <div className="bg-card border border-border rounded-full p-2 shadow-lg">
                    {replyTo && (
                      <div className="flex items-center justify-between px-4 pb-2 text-xs">
                        <span className="text-muted-foreground">
                          Replying to{" "}
                          <span className="text-foreground font-medium">{replyTo.author?.name || "Unknown"}</span>
                        </span>
                        <button
                          onClick={() => setReplyTo(null)}
                          className="text-amber-600 font-bold"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <input
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && submit()}
                        placeholder={replyTo ? "Write a reply…" : "Join the discussion…"}
                        className="flex-1 bg-transparent px-4 py-2 text-sm outline-none placeholder:text-muted-foreground"
                      />
                      <button
                        onClick={submit}
                        disabled={!draft.trim()}
                        className="size-10 grid place-items-center rounded-full bg-amber-600 text-white disabled:opacity-40 hover:opacity-90 shrink-0"
                      >
                        <Send className="size-4" />
                      </button>
                    </div>
                  </div>
                </GuestGuard>
              </>
            )}
          </SmartState>
        </div>
      </EnhancedErrorBoundary>
    </WebShell>
  );
}

function CommentBlock({
  comment,
  replies,
  onReply,
}: {
  comment: Comment;
  replies: Comment[];
  onReply: (c: Comment) => void;
}) {
  return (
    <div className="flex gap-4">
      <Avatar
        src={comment.author?.avatar}
        alt=""
        name={comment.author?.name}
        handle={comment.author?.handle}
        size="md"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-3">
          <span className="text-sm font-semibold">{comment.author?.name || "Unknown"}</span>
          <span className="text-xs text-muted-foreground">{formatRelativeTime(comment.createdAt)}</span>
        </div>
        <p className="text-base text-foreground/90 leading-relaxed mt-1.5">
          {comment.body}
        </p>
        <div className="flex items-center gap-4 mt-2">
          <button
            onClick={() => onReply(comment)}
            className="text-xs font-semibold text-muted-foreground hover:text-amber-600"
          >
            Reply
          </button>
          <button className="text-xs font-semibold text-muted-foreground hover:text-amber-600 flex items-center gap-1">
            <Heart className="size-3.5" strokeWidth={1.8} />
            <span>Like</span>
          </button>
        </div>

        {replies.length > 0 && (
          <div className="mt-6 space-y-6 border-l-2 border-border pl-4 ml-2">
            {replies.map((r) => (
              <div key={r.id} className="flex gap-3">
                <Avatar
                  src={r.author?.avatar}
                  alt=""
                  name={r.author?.name}
                  handle={r.author?.handle}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-semibold">{r.author?.name || "Unknown"}</span>
                    <span className="text-xs text-muted-foreground">{formatRelativeTime(r.createdAt)}</span>
                  </div>
                  <p className="text-sm text-foreground/85 leading-relaxed mt-1">
                    {r.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
