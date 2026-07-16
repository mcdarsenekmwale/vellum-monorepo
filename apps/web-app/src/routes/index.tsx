import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart, Bookmark, MessageCircle, Share2, Eye } from "lucide-react";
import { toast } from "sonner";
import { WebShell } from "@/components/WebShell";
import { useSocial } from "@/lib/social-store";
import { useArticles, useHighlights, useStories, useAuthState } from "@/hooks/useApi";
import { useMemo } from "react";
import type { Article, Highlight, Story } from "@/lib/api";
import { useLoginPrompt } from "@/components/LoginPrompt";

const STORY_24H = 24 * 60 * 60 * 1000;

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

export const Route = createFileRoute("/")({
  component: FeedPage,
});

function FeedPage() {
  const { data: articlesData, isLoading: articlesLoading, error: articlesError } = useArticles(1, 10);
  const { data: highlightsData, isLoading: highlightsLoading } = useHighlights(1, 10);
  const { data: storiesData, isLoading: storiesLoading } = useStories();
  const { user, isAuthenticated } = useAuthState();
  const { promptLogin, LoginPromptComponent } = useLoginPrompt();

  const articles = articlesData?.data || [];
  const highlights = highlightsData?.data || [];
  const stories = storiesData || [];

  const featured = useMemo(() => {
    return articles.find((a) => a.featured) || articles[0];
  }, [articles]);

  const rest = useMemo(() => {
    if (!featured) return articles;
    return articles.filter((a) => a.id !== featured.id);
  }, [articles, featured]);

  const activeStoryAuthors = useMemo(() => {
    const authorMap = new Map<string, { id: string; name: string; handle: string; avatar?: string }>();
    stories.forEach((story) => {
      if (Date.now() - new Date(story.createdAt).getTime() < STORY_24H) {
        const author = story.author || { id: story.authorId || story.id, name: story.caption || "Story", handle: "" };
        if (!authorMap.has(author.id)) {
          authorMap.set(author.id, author);
        }
      }
    });
    return Array.from(authorMap.values());
  }, [stories]);

  const getStoriesByAuthor = (authorId: string): Story[] => {
    return stories.filter((s) => {
      const sid = s.author?.id || s.authorId;
      return sid === authorId;
    });
  };

  const { isStoryViewed } = useSocial();

  const hasUnviewedStories = (authorId: string): boolean => {
    const authorStories = getStoriesByAuthor(authorId).filter(
      (s) => Date.now() - new Date(s.createdAt).getTime() < STORY_24H
    );
    return authorStories.some((s) => !isStoryViewed(s.id));
  };

  if (articlesError) {
    return (
      <WebShell>
        <div className="max-w-[680px] mx-auto py-20 text-center">
          <p className="text-muted-foreground">Failed to load feed. Please try again later.</p>
        </div>
      </WebShell>
    );
  }

  console.log(isAuthenticated, user)

  return (
    <WebShell>
      <LoginPromptComponent />
      <div className="max-w-[680px] mx-auto">
        {/* Stories Row */}
        <section className="mb-8">
          <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-amber-600 mb-3">
            Stories
          </h3>
          <div className="flex gap-3 overflow-x-auto no-scrollbar ">
            {isAuthenticated && user && (
              <Link to="/profile" className="flex-none flex flex-col items-center gap-1.5 w-16">
                <div className="size-16 rounded-full p-0.5 ring-3 ring-amber-600 ring-offset-2 ring-offset-background">
                  <img src={user.avatar || undefined} alt="You" className="size-full rounded-full object-cover" />
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground truncate w-full text-center">
                  You
                </span>
              </Link>
            )}
            {storiesLoading ? (
              <div className="flex gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex-none flex flex-col items-center gap-1.5 w-16">
                    <div className="size-16 rounded-full bg-muted animate-pulse" />
                    <div className="w-10 h-2 bg-muted animate-pulse rounded" />
                  </div>
                ))}
              </div>
            ) : (
              activeStoryAuthors.map((author) => {
                const unviewed = hasUnviewedStories(author.id);
                const authorStories = getStoriesByAuthor(author.id).filter(
                  (s) => Date.now() - new Date(s.createdAt).getTime() < STORY_24H
                );
                const firstStory = authorStories[0];
                if (!firstStory) return null;
                return (
                  <Link
                    key={author.id}
                    to="/story/$authorId/$storyId"
                    params={{ authorId: author.id, storyId: firstStory.id }}
                    className="flex-none flex flex-col items-center gap-1.5 w-16"
                  >
                    <div className={`size-16 rounded-full p-0.5 ring-3 ring-offset-2 ring-offset-background transition-all ${
                      unviewed ? "ring-amber-600" : "ring-muted-foreground/20"
                    }`}>
                      <img src={author.avatar || undefined} alt={author.name} className="size-full rounded-full object-cover" />
                    </div>
                    <span className={`text-[10px] font-semibold uppercase tracking-wider truncate w-full text-center ${
                      unviewed ? "text-foreground" : "text-muted-foreground"
                    }`}>
                      {author.name.split(" ")[0]}
                    </span>
                  </Link>
                );
              })
            )}
          </div>
        </section>

        {/* Featured Post */}
        <section className="mb-12">
          <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-amber-600 mb-4">
            Featured
          </h3>
          {articlesLoading || !featured ? (
            <div className="space-y-4 animate-pulse">
              <div className="aspect-[4/5] bg-muted rounded-[2rem]" />
              <div className="h-4 w-24 bg-muted rounded" />
              <div className="h-10 w-3/4 bg-muted rounded" />
              <div className="h-6 w-full bg-muted rounded" />
            </div>
          ) : (
            <FeaturedPost article={featured} />
          )}
        </section>

        {/* Reels / Atmospherics */}
        <section className="mb-8">
          <div className="flex justify-between items-end mb-3">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-amber-600">
              Atmospherics
            </h3>
            <Link to="/highlights" className="text-xs font-semibold text-amber-600 hover:opacity-70">
              Watch All →
            </Link>
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
            {highlightsLoading ? (
              [1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex-none w-[140px] aspect-[9/16] bg-muted rounded-2xl animate-pulse" />
              ))
            ) : (
              highlights.slice(0, 5).map((r) => (
                <Link
                  key={r.id}
                  to="/highlights"
                  className="flex-none w-[140px] aspect-[9/16] bg-muted rounded-2xl overflow-hidden relative group"
                >
                  <img src={r.cover || r.thumbnailUrl || undefined} alt={r.title} className="size-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3 text-white">
                    <p className="text-[10px] font-medium opacity-80">{r.author?.handle || r.handle}</p>
                    <p className="text-xs font-bold leading-tight truncate">{r.title}</p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>

        {/* Latest Articles */}
        <section className="mb-8">
          <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-amber-600 mb-4">
            Latest
          </h3>
          <div className="space-y-6">
            {articlesLoading ? (
              [1, 2, 3].map((i) => (
                <div key={i} className="space-y-3 animate-pulse">
                  <div className="aspect-[16/10] bg-muted rounded-[1.5rem]" />
                  <div className="h-3 w-20 bg-muted rounded" />
                  <div className="h-8 w-2/3 bg-muted rounded" />
                  <div className="h-4 w-full bg-muted rounded" />
                </div>
              ))
            ) : (
              rest.map((a) => (
                <ArticleCard key={a.slug} article={a} />
              ))
            )}
          </div>
        </section>
      </div>
    </WebShell>
  );
}

function FeaturedPost({ article }: { article: Article }) {
  const { isLiked, isSaved, toggleLike, toggleBookmark, commentsFor } = useSocial();
  const { isAuthenticated } = useAuthState();
  const { promptLogin } = useLoginPrompt();
  const slug = article.slug;
  const liked = isLiked(slug);
  const saved = isSaved(slug);
  const likes = liked ? article.likesCount + 1 : article.likesCount;
  const commentCount = commentsFor(slug).length;

  const handleLike = () => {
    if (!isAuthenticated) {
      promptLogin("like this article");
      return;
    }
    toggleLike(slug);
  };

  const handleBookmark = () => {
    if (!isAuthenticated) {
      promptLogin("bookmark this article");
      return;
    }
    toggleBookmark(slug);
  };

  return (
    <article>
      {/* Hero image with Feature badge */}
      <Link to="/article/$slug" params={{ slug }} className="block">
        <div className="relative overflow-hidden rounded-[2rem] bg-muted mb-6">
          <img
            src={article.cover || undefined}
            alt={article.title}
            className="size-full object-cover aspect-[4/5]"
          />
          <div className="absolute top-6 left-6">
            <span className="inline-block bg-white text-foreground px-6 py-2.5 rounded-full text-xs font-bold uppercase tracking-[0.2em] shadow-sm">
              Feature
            </span>
          </div>
        </div>
      </Link>

      {/* Meta: category + read time */}
      <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.2em] text-amber-600 mb-4">
        <span>{article.category?.name || "Article"}</span>
        <span className="opacity-50">·</span>
        <span>{article.readMinutes} min read</span>
      </div>

      {/* Title */}
      <Link to="/article/$slug" params={{ slug }} className="block">
        <h2 className="font-display italic text-4xl md:text-5xl leading-[1.1] text-balance hover:text-amber-600 transition-colors mb-4">
          {article.title}
        </h2>
      </Link>

      {/* Excerpt */}
      <p className="text-lg text-muted-foreground leading-relaxed text-balance mb-6">
        {article.excerpt}
      </p>

      {/* Author row */}
      <div className="flex items-center justify-between">
        <Link
          to="/author/$id"
          params={{ id: article.author?.id || article.authorId }}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
        >
          <img
            src={article.author?.avatar || undefined}
            alt=""
            className="size-12 rounded-full object-cover"
          />
          <div>
            <p className="text-base font-semibold">
              By {article.author?.name || "Unknown"}
            </p>
            <p className="text-sm text-muted-foreground">
              {formatRelativeTime(article.publishedAt)}
            </p>
          </div>
        </Link>

        <div className="flex items-center gap-5">
          <button
            onClick={handleLike}
            className="flex items-center gap-2 text-base font-semibold hover:text-amber-600 transition-colors"
          >
            <Heart
              className="size-6"
              strokeWidth={1.8}
              fill={liked ? "#d97706" : "none"}
              color={liked ? "#d97706" : "currentColor"}
            />
            <span>{likes.toLocaleString()}</span>
          </button>
          <Link
            to="/article/$slug"
            params={{ slug }}
            className="flex items-center gap-2 text-base font-semibold hover:text-amber-600 transition-colors"
          >
            <MessageCircle className="size-6" strokeWidth={1.8} />
            <span>{commentCount}</span>
          </Link>
          <button
            onClick={() => {
              navigator.clipboard.writeText(window.location.origin + "/article/" + slug);
              toast.success("Link copied to clipboard");
            }}
            className="hover:text-amber-600 transition-colors"
          >
            <Share2 className="size-6" strokeWidth={1.8} />
          </button>
          <button
            onClick={handleBookmark}
            className="hover:text-amber-600 transition-colors"
          >
            <Bookmark
              className="size-6"
              strokeWidth={1.8}
              fill={saved ? "#d97706" : "none"}
              color={saved ? "#d97706" : "currentColor"}
            />
          </button>
        </div>
      </div>

      {/* View count */}
      <div className="flex items-center gap-2 mt-4 text-muted-foreground">
        <Eye className="size-4" strokeWidth={1.8} />
        <span className="text-sm font-medium">{article.views.toLocaleString()} views</span>
      </div>
    </article>
  );
}

function ArticleCard({ article }: { article: Article }) {
  const { isLiked, isSaved, toggleLike, toggleBookmark, commentsFor } = useSocial();
  const { isAuthenticated } = useAuthState();
  const { promptLogin } = useLoginPrompt();
  const slug = article.slug;
  const liked = isLiked(slug);
  const saved = isSaved(slug);
  const likes = liked ? article.likesCount + 1 : article.likesCount;
  const commentCount = commentsFor(slug).length;

  const handleLike = () => {
    if (!isAuthenticated) {
      promptLogin("like this article");
      return;
    }
    toggleLike(slug);
  };

  const handleBookmark = () => {
    if (!isAuthenticated) {
      promptLogin("bookmark this article");
      return;
    }
    toggleBookmark(slug);
  };

  return (
    <article>
      {/* Cover image */}
      <Link to="/article/$slug" params={{ slug }} className="block">
        <div className="overflow-hidden rounded-[1.5rem] bg-muted mb-5">
          <img
            src={article.cover || undefined}
            alt={article.title}
            className="size-full object-cover aspect-[16/10] hover:scale-[1.02] transition-transform duration-500"
          />
        </div>
      </Link>

      {/* Meta */}
      <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.2em] text-amber-600 mb-3">
        <span>{article.category?.name || "Article"}</span>
        <span className="opacity-50">·</span>
        <span>{article.readMinutes} min read</span>
      </div>

      {/* Title */}
      <Link to="/article/$slug" params={{ slug }} className="block">
        <h3 className="font-display italic text-3xl leading-[1.15] text-balance hover:text-amber-600 transition-colors mb-3">
          {article.title}
        </h3>
      </Link>

      {/* Excerpt */}
      <p className="text-base text-muted-foreground leading-relaxed line-clamp-2 mb-4">
        {article.excerpt}
      </p>

      {/* Author + actions */}
      <div className="flex items-center justify-between">
        <Link
          to="/author/$id"
          params={{ id: article.author?.id || article.authorId }}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
        >
          <img
            src={article.author?.avatar || undefined}
            alt=""
            className="size-10 rounded-full object-cover"
          />
          <div>
            <p className="text-sm font-semibold">
              By {article.author?.name || "Unknown"}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatRelativeTime(article.publishedAt)}
            </p>
          </div>
        </Link>

        <div className="flex items-center gap-4">
          <button
            onClick={handleLike}
            className="flex items-center gap-1.5 text-sm font-semibold hover:text-amber-600 transition-colors"
          >
            <Heart
              className="size-5"
              strokeWidth={1.8}
              fill={liked ? "#d97706" : "none"}
              color={liked ? "#d97706" : "currentColor"}
            />
            <span>{likes.toLocaleString()}</span>
          </button>
          <Link
            to="/article/$slug"
            params={{ slug }}
            className="flex items-center gap-1.5 text-sm font-semibold hover:text-amber-600 transition-colors"
          >
            <MessageCircle className="size-5" strokeWidth={1.8} />
            <span>{commentCount}</span>
          </Link>
          <button
            onClick={() => {
              navigator.clipboard.writeText(window.location.origin + "/article/" + slug);
              toast.success("Link copied to clipboard");
            }}
            className="hover:text-amber-600 transition-colors"
          >
            <Share2 className="size-5" strokeWidth={1.8} />
          </button>
          <button
            onClick={handleBookmark}
            className="hover:text-amber-600 transition-colors"
          >
            <Bookmark
              className="size-5"
              strokeWidth={1.8}
              fill={saved ? "#d97706" : "none"}
              color={saved ? "#d97706" : "currentColor"}
            />
          </button>
        </div>
      </div>

      {/* View count */}
      <div className="flex items-center gap-2 mt-3 text-muted-foreground">
        <Eye className="size-3.5" strokeWidth={1.8} />
        <span className="text-xs font-medium">{article.views.toLocaleString()} views</span>
      </div>
    </article>
  );
}
