import * as React from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  Copy,
  Check,
  XCircle,
  RefreshCw,
  BookOpen,
  User,
  Bookmark,
  MoreHorizontal,
  AtSign,
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useArticleById,
  useArticles,
  useCategories,
  useUsers,
  useDeleteArticle,
} from "@/lib/api/hooks";
import { avatarUrl } from "@/lib/avatar";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/articles/$articleId")({
  head: () => ({ meta: [{ title: "Article · Vellum Admin" }] }),
  component: ArticleDetailPage,
});

function ArticleDetailPage() {
  const { articleId } = Route.useParams();
  const navigate = useNavigate();
  const { data: article, isLoading, error, refetch } = useArticleById(articleId);
  const { data: articlesData } = useArticles({ limit: 12 });
  const { data: categories } = useCategories();
  const { data: users } = useUsers({ limit: 50 });
  const deleteArticle = useDeleteArticle();

  const [copied, setCopied] = React.useState(false);
  const [shareOpen, setShareOpen] = React.useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);

  if (isLoading) {
    return <ArticleDetailSkeleton />;
  }

  if (error || !article) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Content"
          title="Article not found"
          description="This article could not be loaded or may have been deleted."
          actions={
            <div className="flex items-center gap-2">
              <Button variant="outline" className="gap-1.5" onClick={() => refetch()}>
                <RefreshCw className="size-4" /> Retry
              </Button>
              <Button asChild>
                <Link to="/articles">
                  <ArrowLeft className="size-4 mr-2" />
                  Back to articles
                </Link>
              </Button>
            </div>
          }
        />
        <SectionCard>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="size-20 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <XCircle className="size-10 text-destructive" />
            </div>
            <h3 className="text-xl font-semibold">Unable to load article</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-md">
              {error instanceof Error ? error.message : "The requested article could not be found or an unexpected error occurred."}
            </p>
            <div className="flex items-center gap-3 mt-6">
              <Button variant="outline" onClick={() => refetch()}>
                <RefreshCw className="size-4 mr-2" /> Try again
              </Button>
              <Button asChild>
                <Link to="/articles">View all articles</Link>
              </Button>
            </div>
          </div>
        </SectionCard>
      </div>
    );
  }

  const author =
    article.author ?? users?.data?.find((u: { id: string }) => u.id === article.authorId);
  const category =
    article.category ?? categories?.find((c: { id: string }) => c.id === article.categoryId);
  const relatedArticles = (articlesData?.data ?? [])
    .filter(
      (a) =>
        a.id !== article.id &&
        (a.categoryId === article.categoryId ||
          a.authorId === article.authorId)
    )
    .slice(0, 4);

  const copyLink = async () => {
    try {
      const url = `${window.location.origin}/articles/${article.id}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const shareOnTwitter = () => {
    const url = `${window.location.origin}/articles/${article.id}`;
    const text = `Check out "${article.title}" on Vellum`;
    window.open(
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
      "_blank",
      "width=600,height=400"
    );
  };

  const handleDelete = () => {
    deleteArticle.mutate(article.id, {
      onSuccess: () => {
        toast.success("Article deleted");
        navigate({ to: "/articles" });
      },
      onError: () => {
        toast.error("Failed to delete article");
      },
    });
  };

  const categoryColors: Record<string, string> = {
    Technology: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    Business: "bg-purple-500/10 text-purple-500 border-purple-500/20",
    Science: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    Culture: "bg-rose-500/10 text-rose-500 border-rose-500/20",
    News: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Content"
        title={article.title}
        description={article.excerpt || "View and manage article content."}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/articles">
                <ArrowLeft className="size-4 mr-2" />
                Back
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="size-9">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => navigator.clipboard.writeText(article.slug)}
                >
                  <Copy className="size-4 mr-2" />
                  Copy slug
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShareOpen(true)}>
                  <Share2 className="size-4 mr-2" />
                  Share article
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => setShowDeleteDialog(true)}
                >
                  <XCircle className="size-4 mr-2" />
                  Delete article
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <SectionCard>
            {article.cover && (
              <div className="relative rounded-xl overflow-hidden mb-6">
                <img
                  src={article.cover}
                  alt={article.title}
                  className="w-full h-64 md:h-80 object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
                {article.featured && (
                  <Badge className="absolute top-3 left-3 bg-yellow-500 text-yellow-950 hover:bg-yellow-500">
                    <Bookmark className="size-3 mr-1" />
                    Featured
                  </Badge>
                )}
              </div>
            )}

            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                {category && (
                  <Badge
                    variant="outline"
                    className={cn(
                      categoryColors[category.name] ||
                        "bg-primary/10 text-primary border-primary/20"
                    )}
                  >
                    {category.name}
                  </Badge>
                )}
                <Badge
                  variant={article.isPublished ? "default" : "secondary"}
                  className={cn(
                    article.isPublished
                      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20"
                      : ""
                  )}
                >
                  {article.isPublished ? "Published" : "Draft"}
                </Badge>
                {article.featured && !article.cover && (
                  <Badge className="bg-yellow-500 text-yellow-950">
                    <Bookmark className="size-3 mr-1" />
                    Featured
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Clock className="size-4" />
                  <span>{article.readMinutes} min read</span>
                </div>
                {article.publishedAt && (
                  <div className="flex items-center gap-1.5">
                    <Calendar className="size-4" />
                    <span>{format(new Date(article.publishedAt), "MMM d, yyyy")}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <RefreshCw className="size-4" />
                  <span>Updated {formatDistanceToNow(new Date(article.updatedAt), { addSuffix: true })}</span>
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {author ? (
                    <>
                      <Link to="/users/$userId" params={{ userId: author.id }}>
                        <Avatar className="size-10">
                          <AvatarImage src={avatarUrl(author.handle)} />
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {author.name?.[0]?.toUpperCase() || author.handle?.[0]?.toUpperCase() || "?"}
                          </AvatarFallback>
                        </Avatar>
                      </Link>
                      <div>
                        <Link
                          to="/users/$userId"
                          params={{ userId: author.id }}
                          className="font-medium hover:underline"
                        >
                          {author.name}
                        </Link>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <User className="size-3" />@{author.handle}
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <Avatar className="size-10">
                        <AvatarFallback className="bg-muted">
                          <User className="size-4" />
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <span className="font-medium text-muted-foreground">Unknown Author</span>
                      </div>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-9"
                    onClick={() => setShareOpen(true)}
                  >
                    <Share2 className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard>
            <div className="prose prose-slate dark:prose-invert max-w-none">
              {article.body && article.body.length > 0 ? (
                <div className="space-y-4">
                  {article.body.map((paragraph, index) => (
                    <p key={index} className="text-sm leading-relaxed text-foreground/90">
                      {paragraph}
                    </p>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <BookOpen className="size-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No content yet.</p>
                </div>
              )}
            </div>
          </SectionCard>

          {relatedArticles.length > 0 && (
            <SectionCard>
              <div className="flex items-center gap-2 mb-4">
                <BookOpen className="size-5 text-primary" />
                <h3 className="font-semibold">Related Articles</h3>
                <Badge variant="secondary" className="ml-auto">
                  {relatedArticles.length}
                </Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {relatedArticles.map((related) => {
                  const relatedCategory = categories?.find((c) => c.id === related.categoryId);
                  return (
                    <Link
                      key={related.id}
                      to="/articles/$articleId"
                      params={{ articleId: related.id }}
                      className="group block rounded-lg border p-4 hover:border-primary/50 hover:shadow-md transition-all"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        {relatedCategory && (
                          <Badge variant="outline" className="text-[10px]">
                            {relatedCategory.name}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="size-3" />
                          {related.readMinutes} min
                        </span>
                      </div>
                      <h4 className="font-medium text-sm group-hover:text-primary transition-colors line-clamp-2">
                        {related.title}
                      </h4>
                      {related.excerpt && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {related.excerpt}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Eye className="size-3" />
                          {related.views}
                        </span>
                        <span className="flex items-center gap-1">
                          <Heart className="size-3" />
                          {related.likesCount}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </SectionCard>
          )}
        </div>

        <div className="space-y-6">
          <SectionCard>
            <h3 className="font-semibold mb-4">Article Stats</h3>
            <div className="grid grid-cols-2 gap-3">
              <StatItem icon={Eye} label="Views" value={article.views} color="text-blue-500" />
              <StatItem icon={Heart} label="Likes" value={article.likesCount} color="text-rose-500" />
              <StatItem
                icon={MessageCircle}
                label="Comments"
                value={article.commentsCount}
                color="text-emerald-500"
              />
              <StatItem icon={Clock} label="Read time" value={`${article.readMinutes}m`} color="text-amber-500" />
            </div>
            <Separator className="my-4" />
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <span className={cn(article.isPublished ? "text-emerald-500" : "text-muted-foreground")}>
                  {article.isPublished ? "Published" : "Draft"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Featured</span>
                <span className={cn(article.featured ? "text-yellow-500" : "text-muted-foreground")}>
                  {article.featured ? "Yes" : "No"}
                </span>
              </div>
              {article.publishedAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Published</span>
                  <span>{format(new Date(article.publishedAt), "MMM d, yyyy")}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span>{format(new Date(article.createdAt), "MMM d, yyyy")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last updated</span>
                <span>{format(new Date(article.updatedAt), "MMM d, yyyy")}</span>
              </div>
            </div>
          </SectionCard>

          <SectionCard>
            <h3 className="font-semibold mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <Button variant="outline" className="w-full justify-start gap-2" onClick={copyLink}>
                {copied ? (
                  <Check className="size-4 text-emerald-500" />
                ) : (
                  <Copy className="size-4" />
                )}
                {copied ? "Copied!" : "Copy article link"}
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={shareOnTwitter}
              >
                <AtSign className="size-4" />
              Share on X
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={() => setShareOpen(true)}
              >
                <Share2 className="size-4" />
                Open share menu
              </Button>
            </div>
          </SectionCard>

          <SectionCard>
            <h3 className="font-semibold mb-4">Identifier</h3>
            <div className="space-y-3 text-sm">
              <div>
                <label className="text-xs text-muted-foreground">ID</label>
                <p className="font-mono text-xs bg-muted rounded px-2 py-1.5 truncate">
                  {article.id}
                </p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Slug</label>
                <p className="font-mono text-xs bg-muted rounded px-2 py-1.5 truncate">
                  {article.slug}
                </p>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share article</DialogTitle>
            <DialogDescription>
              Share "{article.title}" with your audience.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={`${window.location.origin}/articles/${article.id}`}
                className="flex-1 rounded-md border px-3 py-2 text-sm bg-muted"
              />
              <Button onClick={copyLink} size="sm">
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="gap-2" onClick={shareOnTwitter}>
                <AtSign className="size-4" />
                X / Twitter
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => {
                  const url = encodeURIComponent(`${window.location.origin}/articles/${article.id}`);
                  window.open(
                    `https://www.facebook.com/sharer/sharer.php?u=${url}`,
                    "_blank",
                    "width=600,height=400"
                  );
                }}
              >
                <Share2 className="size-4" />
                Facebook
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="size-5" />
              Delete article
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{article.title}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteArticle.isPending}
            >
              {deleteArticle.isPending ? "Deleting..." : "Delete article"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatItem({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string; size?: number }>;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border p-2.5">
      <div className={cn("size-8 rounded-lg flex items-center justify-center bg-opacity-10", color.replace("text-", "bg-"))}>
        <Icon className={cn("size-4", color)} />
      </div>
      <div>
        <p className="text-sm font-medium leading-tight">{typeof value === "number" ? value.toLocaleString() : value}</p>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
      </div>
    </div>
  );
}

function ArticleDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-8 w-96" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-9 rounded-md" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <SectionCard>
            <Skeleton className="h-64 w-full rounded-xl mb-6" />
            <div className="space-y-3">
              <div className="flex gap-2">
                <Skeleton className="h-5 w-16 rounded-md" />
                <Skeleton className="h-5 w-20 rounded-md" />
              </div>
              <div className="flex gap-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-28" />
              </div>
              <Separator />
              <div className="flex items-center gap-3">
                <Skeleton className="size-10 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard>
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
            </div>
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard>
            <Skeleton className="h-5 w-24 mb-4" />
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
            </div>
          </SectionCard>

          <SectionCard>
            <Skeleton className="h-5 w-24 mb-4" />
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full rounded-md" />
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
