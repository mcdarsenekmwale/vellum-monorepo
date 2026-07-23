"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import {
  Heart,
  Bookmark,
  MessageCircle,
  Share2,
  UserPlus,
  RefreshCw,
  AlertCircle,
  Eye,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import { useSocial } from "@/lib/social-store";
import { useLoginPrompt } from "@/components/LoginPrompt";
import { useAuthState } from "@/hooks/useApi";
import type { Article, SuggestedArticlesResponse } from "@/lib/api";

interface SuggestedForYouProps {
  limit?: number;
}

type LoadingState = "idle" | "loading" | "error" | "success";

interface ArticleState {
  isFollowing: boolean;
  followLoading: boolean;
  commentOpen: boolean;
  commentText: string;
  commentLoading: boolean;
  replacing: boolean;
}

function formatRelativeTime(dateStr: string | undefined): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = Date.now();
  const diff = now - date.getTime();
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return date.toLocaleDateString();
}

export function SuggestedForYou({ limit = 4 }: SuggestedForYouProps) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loadingState, setLoadingState] = useState<LoadingState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [articleStates, setArticleStates] = useState<Record<string, ArticleState>>({});
  const offsetRef = useRef(0);

  const { isAuthenticated } = useAuthState();
  const { isLiked, isSaved, toggleLike, toggleBookmark, shareArticle } = useSocial();
  const { promptLogin, LoginPromptComponent } = useLoginPrompt();

  const fetchSuggested = useCallback(async () => {
    setLoadingState("loading");
    setError(null);

    try {
      const response = await apiClient.getSuggestedArticles(limit, 0);
      offsetRef.current = limit;
      setArticles(response.data);

      const initialStates: Record<string, ArticleState> = {};
      response.data.forEach((a) => {
        initialStates[a.id] = {
          isFollowing: false,
          followLoading: false,
          commentOpen: false,
          commentText: "",
          commentLoading: false,
          replacing: false,
        };
      });
      setArticleStates(initialStates);

      setLoadingState("success");
    } catch (err: any) {
      console.error("[SuggestedForYou] Failed to load suggested articles:", err);
      setError(err.message || "Failed to load suggestions");
      setLoadingState("error");
    }
  }, [limit]);

  useEffect(() => {
    fetchSuggested();
  }, [fetchSuggested]);

  const handleRetry = () => {
    setRetryCount((c) => c + 1);
    fetchSuggested();
  };

  const handleFollow = async (article: Article) => {
    if (!isAuthenticated) {
      promptLogin("follow this author");
      return;
    }

    const authorId = article.author?.id || article.authorId;
    if (!authorId) return;

    setArticleStates((prev) => ({
      ...prev,
      [article.id]: { ...prev[article.id], followLoading: true, replacing: true },
    }));

    try {
      await apiClient.toggleFollow(authorId);

      const replacement = await apiClient.getSuggestedReplacement(article.id, authorId);

      setArticles((prev) => {
        const index = prev.findIndex((a) => a.id === article.id);
        if (index === -1) return prev;

        const newArticles = [...prev];

        if (replacement) {
          newArticles[index] = replacement;
          setArticleStates((states) => {
            const newStates = { ...states };
            delete newStates[article.id];
            newStates[replacement.id] = {
              isFollowing: false,
              followLoading: false,
              commentOpen: false,
              commentText: "",
              commentLoading: false,
              replacing: false,
            };
            return newStates;
          });
        } else {
          newArticles.splice(index, 1);
          setArticleStates((states) => {
            const newStates = { ...states };
            delete newStates[article.id];
            return newStates;
          });
        }

        return newArticles;
      });

      toast.success(`You're now following ${article.author?.name || "this author"}`);
    } catch (err: any) {
      console.error("[SuggestedForYou] Follow failed:", err);
      toast.error(err.message || "Failed to follow author");
      setArticleStates((prev) => ({
        ...prev,
        [article.id]: { ...prev[article.id], followLoading: false, replacing: false },
      }));
    }
  };

  const handleLike = (article: Article) => {
    if (!isAuthenticated) {
      promptLogin("like this article");
      return;
    }
    toggleLike(article.slug);
  };

  const handleBookmark = (article: Article) => {
    if (!isAuthenticated) {
      promptLogin("bookmark this article");
      return;
    }
    toggleBookmark(article.slug);
  };

  const handleShare = (article: Article) => {
    shareArticle(article.slug);
    navigator.clipboard
      .writeText(window.location.origin + "/article/" + article.slug)
      .then(() => toast.success("Link copied to clipboard"))
      .catch(() => toast.success("Article shared"));
  };

  const toggleComment = (articleId: string) => {
    if (!isAuthenticated) {
      promptLogin("comment on this article");
      return;
    }
    setArticleStates((prev) => ({
      ...prev,
      [articleId]: { ...prev[articleId], commentOpen: !prev[articleId]?.commentOpen },
    }));
  };

  const submitComment = async (article: Article) => {
    const state = articleStates[article.id];
    if (!state || !state.commentText.trim() || state.commentLoading) return;

    setArticleStates((prev) => ({
      ...prev,
      [article.id]: { ...prev[article.id], commentLoading: true },
    }));

    try {
      const comment = await apiClient.createComment({
        body: state.commentText.trim(),
        articleSlug: article.slug,
      });

      console.log("[SuggestedForYou] Comment created:", comment);

      setArticleStates((prev) => ({
        ...prev,
        [article.id]: { ...prev[article.id], commentText: "", commentLoading: false, commentOpen: false },
      }));

      toast.success("Comment posted");
    } catch (err: any) {
      console.error("[SuggestedForYou] Comment failed:", err);
      toast.error(err.message || "Failed to post comment");
      setArticleStates((prev) => ({
        ...prev,
        [article.id]: { ...prev[article.id], commentLoading: false },
      }));
    }
  };

  if (loadingState === "loading") {
    return (
      <section className="mb-8">
        <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-amber-600 mb-4">
          Suggested for you
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].slice(0, limit).map((i) => (
            <div
              key={i}
              className="bg-card border border-border rounded-2xl overflow-hidden animate-pulse"
            >
              <div className="aspect-[16/10] bg-muted" />
              <div className="p-4 space-y-3">
                <div className="h-3 w-20 bg-muted rounded" />
                <div className="h-5 w-3/4 bg-muted rounded" />
                <div className="h-3 w-full bg-muted rounded" />
                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2">
                    <div className="size-8 rounded-full bg-muted" />
                    <div className="h-3 w-16 bg-muted rounded" />
                  </div>
                  <div className="flex gap-3">
                    <div className="size-4 bg-muted rounded" />
                    <div className="size-4 bg-muted rounded" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <LoginPromptComponent />
      </section>
    );
  }

  if (loadingState === "error") {
    return (
      <section className="mb-8">
        <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-amber-600 mb-4">
          Suggested for you
        </h3>
        <div className="bg-card border border-border rounded-2xl p-8 text-center">
          <div className="size-12 rounded-full bg-red-500/10 grid place-items-center mx-auto mb-4">
            <AlertCircle className="size-6 text-red-500" />
          </div>
          <h4 className="font-semibold mb-1">Couldn't load suggestions</h4>
          <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">
            {error || "Something went wrong. Please try again."}
          </p>
          <button
            onClick={handleRetry}
            disabled={false}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-foreground text-background font-medium text-sm hover:opacity-90 transition-opacity"
          >
            <RefreshCw className={`size-4 ${retryCount > 0 ? "animate-spin" : ""}`} />
            Try again
          </button>
        </div>
        <LoginPromptComponent />
      </section>
    );
  }

  if (articles.length === 0) {
    return (
      <section className="mb-8">
        <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-amber-600 mb-4">
          Suggested for you
        </h3>
        <div className="bg-card border border-border rounded-2xl p-8 text-center">
          <p className="text-muted-foreground">
            No suggestions available right now. Check back soon!
          </p>
        </div>
        <LoginPromptComponent />
      </section>
    );
  }

  return (
    <section className="mb-8">
      <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-amber-600 mb-4">
        Suggested for you
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {articles.map((article) => {
          const state = articleStates[article.id] || {
            isFollowing: false,
            followLoading: false,
            commentOpen: false,
            commentText: "",
            commentLoading: false,
            replacing: false,
          };
          const liked = isLiked(article.slug);
          const saved = isSaved(article.slug);
          const likes = liked ? article.likesCount + 1 : article.likesCount;

          return (
            <article
              key={article.id}
              className={`bg-card border border-border rounded-2xl overflow-hidden transition-opacity duration-300 ${
                state.replacing ? "opacity-40 pointer-events-none" : ""
              }`}
            >
              <Link to="/article/$slug" params={{ slug: article.slug }} className="block">
                <div className="aspect-[16/10] bg-muted overflow-hidden">
                  <img
                    src={article.cover || undefined}
                    alt={article.title}
                    className="size-full object-cover hover:scale-[1.02] transition-transform duration-500"
                    loading="lazy"
                  />
                </div>
              </Link>

              <div className="p-4">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] text-amber-600 mb-2">
                  <span>{article.category?.name || "Article"}</span>
                  <span className="opacity-50">·</span>
                  <span>{article.readMinutes} min</span>
                </div>

                <Link to="/article/$slug" params={{ slug: article.slug }} className="block">
                  <h4 className="font-display italic text-xl leading-snug hover:text-amber-600 transition-colors mb-2 line-clamp-2">
                    {article.title}
                  </h4>
                </Link>

                <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                  {article.excerpt}
                </p>

                <div className="flex items-center justify-between">
                  <Link
                    to="/author/$id"
                    params={{ id: article.author?.handle || article.authorId }}
                    className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                  >
                    <img
                      src={article.author?.avatar || undefined}
                      alt={article.author?.name}
                      className="size-8 rounded-full object-cover"
                    />
                    <div>
                      <p className="text-xs font-semibold leading-tight">
                        {article.author?.name || "Unknown"}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatRelativeTime(article.publishedAt)}
                      </p>
                    </div>
                  </Link>

                  <button
                    onClick={() => handleFollow(article)}
                    disabled={state.followLoading}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                      state.isFollowing
                        ? "bg-muted text-foreground"
                        : "bg-amber-600 text-white hover:bg-amber-700"
                    } disabled:opacity-50`}
                  >
                    <UserPlus className="size-3.5" />
                    {state.followLoading ? "..." : "Follow"}
                  </button>
                </div>

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => handleLike(article)}
                      className="flex items-center gap-1.5 text-xs font-semibold hover:text-amber-600 transition-colors"
                    >
                      <Heart
                        className="size-4"
                        strokeWidth={1.8}
                        fill={liked ? "#d97706" : "none"}
                        color={liked ? "#d97706" : "currentColor"}
                      />
                      <span>{likes.toLocaleString()}</span>
                    </button>
                    <button
                      onClick={() => toggleComment(article.id)}
                      className="flex items-center gap-1.5 text-xs font-semibold hover:text-amber-600 transition-colors"
                    >
                      <MessageCircle className="size-4" strokeWidth={1.8} />
                      <span>{article.commentsCount || article.commentCount || 0}</span>
                    </button>
                    <button
                      onClick={() => handleShare(article)}
                      className="hover:text-amber-600 transition-colors"
                    >
                      <Share2 className="size-4" strokeWidth={1.8} />
                    </button>
                  </div>
                  <button
                    onClick={() => handleBookmark(article)}
                    className="hover:text-amber-600 transition-colors"
                  >
                    <Bookmark
                      className="size-4"
                      strokeWidth={1.8}
                      fill={saved ? "#d97706" : "none"}
                      color={saved ? "#d97706" : "currentColor"}
                    />
                  </button>
                </div>

                {state.commentOpen && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={state.commentText}
                        onChange={(e) =>
                          setArticleStates((prev) => ({
                            ...prev,
                            [article.id]: { ...prev[article.id], commentText: e.target.value },
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            submitComment(article);
                          }
                        }}
                        placeholder="Add a comment..."
                        className="flex-1 px-3 py-2 rounded-xl bg-muted text-sm focus:outline-none focus:ring-2 focus:ring-amber-600/20"
                        disabled={state.commentLoading}
                      />
                      <button
                        onClick={() => submitComment(article)}
                        disabled={state.commentLoading || !state.commentText.trim()}
                        className="px-3 py-2 rounded-xl bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <Send className="size-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
      <LoginPromptComponent />
    </section>
  );
}
