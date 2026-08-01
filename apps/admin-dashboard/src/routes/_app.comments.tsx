// routes/_app/comments/index.tsx
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  MessageSquare,
  Heart,
  Flag,
  Reply,
  Eye,
  EyeOff,
  Trash2,
  Ban,
  CheckCircle2,
  ArrowUpRight,
  Loader2,
  ChevronDown,
  X,
  Check,
  User,
  FileText,
  TrendingUp,
} from "lucide-react";
import { ListPage } from "@/components/dashboard/list-page";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { StatCard } from "@/components/dashboard/stat-card";
import { PermissionGuard, PermissionGate } from "@/components/dashboard/permission-guard";
import { ReadOnlyBanner } from "@/components/dashboard/read-only-banner";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useComments,
  useUsers,
  useArticles,
  useDeleteComment,
  type Comment,
} from "@/lib/api/hooks";
import { useAuth } from "@/lib/auth/context";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_app/comments")({
  head: () => ({ meta: [{ title: "Comments · Vellum Admin" }] }),
  component: CommentsPage,
});

function CommentsPage() {
  const { data, isLoading, error } = useComments();
  const { data: users } = useUsers();
  const { data: articles } = useArticles();
  const { can } = useAuth();
  const deleteComment = useDeleteComment();
  const rows = data?.data ?? [];

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [authorFilter, setAuthorFilter] = useState<string>("all");
  const [articleFilter, setArticleFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingComment, setDeletingComment] = useState<Comment | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const getAuthor = (authorId: string) => {
    return users?.data?.find((u) => u.id === authorId);
  };

  const getAuthorName = (authorId: string) => {
    return getAuthor(authorId)?.name ?? "Unknown";
  };

  const getAuthorAvatar = (authorId: string) => {
    return getAuthor(authorId)?.avatar ?? null;
  };

  const getArticleTitle = (articleSlug: string) => {
    return articles?.data?.find((a) => a.slug === articleSlug)?.title ?? "Unknown article";
  };

  const totalComments = rows.length;
  const visibleComments = rows.filter((c) => c.status === "visible" || !c.status).length;
  const flaggedComments = rows.filter((c) => c.status === "flagged").length;
  const hiddenComments = rows.filter((c) => c.status === "hidden").length;

  const filteredRows = useMemo(() => {
    let result = rows;

    if (statusFilter !== "all") {
      result = result.filter((c) => (c.status ?? "visible") === statusFilter);
    }

    if (authorFilter !== "all") {
      result = result.filter((c) => c.authorId === authorFilter);
    }

    if (articleFilter !== "all") {
      result = result.filter((c) => c.articleSlug === articleFilter);
    }

    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "oldest":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        default:
          return 0;
      }
    });

    return result;
  }, [rows, statusFilter, authorFilter, articleFilter, sortBy]);

  const hasActiveFilters = statusFilter !== "all" || authorFilter !== "all" || articleFilter !== "all";

  const clearFilters = useCallback(() => {
    setStatusFilter("all");
    setAuthorFilter("all");
    setArticleFilter("all");
  }, []);

  const openDeleteDialog = (comment: Comment) => {
    setDeletingComment(comment);
    setDeleteDialogOpen(true);
  };

  const handleDelete = () => {
    if (!deletingComment) return;
    deleteComment.mutate(deletingComment.id, {
      onSuccess: () => {
        setDeleteDialogOpen(false);
        setDeletingComment(null);
        toast.success("Comment deleted successfully");
      },
      onError: () => {
        toast.error("Failed to delete comment");
      },
    });
  };

  const handleModerationAction = async (comment: Comment, action: string, label: string) => {
    const actionKey = `${action}-${comment.id}`;
    setPendingAction(actionKey);
    await new Promise((resolve) => setTimeout(resolve, 600));
    setPendingAction(null);
    toast.success(`${label} action performed`);
  };

  const isActionPending = (commentId: string, action: string) => {
    return pendingAction === `${action}-${commentId}`;
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total comments"
          value={totalComments.toLocaleString()}
          icon={MessageSquare}
          tone="primary"
        />
        <StatCard
          label="Visible"
          value={visibleComments.toLocaleString()}
          icon={Eye}
          tone="success"
        />
        <StatCard
          label="Flagged"
          value={flaggedComments.toLocaleString()}
          icon={Flag}
          tone="warning"
        />
        <StatCard
          label="Hidden"
          value={hiddenComments.toLocaleString()}
          icon={Ban}
          tone="destructive"
        />
      </div>

      <div className="flex items-center gap-2">
        {[
          { key: "all", label: "All", count: totalComments },
          { key: "visible", label: "Visible", count: visibleComments },
          { key: "flagged", label: "Flagged", count: flaggedComments },
          { key: "hidden", label: "Hidden", count: hiddenComments },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all",
              statusFilter === tab.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground",
            )}
          >
            {tab.label}
            <Badge
              variant={statusFilter === tab.key ? "secondary" : "outline"}
              className="h-5 px-1.5 text-[10px]"
            >
              {tab.count}
            </Badge>
          </button>
        ))}
      </div>

      <PermissionGuard resource="comments" action="read" showReadOnlyBanner>
        <ListPage<Comment>
          title="Comments"
          description="All community comments and replies with moderation state."
          eyebrow="Community"
          rows={filteredRows}
          isLoading={isLoading}
          error={error}
        searchKeys={["body"]}
        pageSize={15}
        enableSelection={true}
        enableExport={true}
        enablePagination={true}
        emptyTitle="No comments found"
        emptyDescription={
          statusFilter === "all" && authorFilter === "all" && articleFilter === "all"
            ? "There are no comments yet. Check back later."
            : "No comments match your filters. Try adjusting them."
        }
        filters={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 h-8">
                  <User className="size-3.5" />
                  Author
                  <ChevronDown className="size-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>Filter by author</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setAuthorFilter("all")}
                  className={cn(authorFilter === "all" && "bg-accent")}
                >
                  All authors
                  {authorFilter === "all" && <Check className="ml-2 size-3.5" />}
                </DropdownMenuItem>
                {users?.data?.map((u) => (
                  <DropdownMenuItem
                    key={u.id}
                    onClick={() => setAuthorFilter(u.id)}
                    className={cn(authorFilter === u.id && "bg-accent")}
                  >
                    {u.name}
                    {authorFilter === u.id && <Check className="ml-2 size-3.5" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 h-8">
                  <FileText className="size-3.5" />
                  Article
                  <ChevronDown className="size-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>Filter by article</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setArticleFilter("all")}
                  className={cn(articleFilter === "all" && "bg-accent")}
                >
                  All articles
                  {articleFilter === "all" && <Check className="ml-2 size-3.5" />}
                </DropdownMenuItem>
                {articles?.data?.map((a) => (
                  <DropdownMenuItem
                    key={a.id}
                    onClick={() => setArticleFilter(a.slug)}
                    className={cn(articleFilter === a.slug && "bg-accent")}
                  >
                    {a.title}
                    {articleFilter === a.slug && <Check className="ml-2 size-3.5" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 h-8">
                  <TrendingUp className="size-3.5" />
                  Sort
                  <ChevronDown className="size-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {([
                  { value: "newest", label: "Newest first" },
                  { value: "oldest", label: "Oldest first" },
                ] as const).map(({ value, label }) => (
                  <DropdownMenuItem
                    key={value}
                    onClick={() => setSortBy(value)}
                    className={cn(sortBy === value && "bg-accent")}
                  >
                    {label}
                    {sortBy === value && <Check className="ml-2 size-3.5" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {hasActiveFilters && (
              <>
                <div className="h-6 w-px bg-border" />
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground">Active filters:</span>
                  {statusFilter !== "all" && (
                    <Badge variant="secondary" className="gap-1 h-5 text-xs cursor-pointer hover:bg-muted" onClick={() => setStatusFilter("all")}>
                      Status: {statusFilter}
                      <X className="size-3" />
                    </Badge>
                  )}
                  {authorFilter !== "all" && (
                    <Badge variant="secondary" className="gap-1 h-5 text-xs cursor-pointer hover:bg-muted" onClick={() => setAuthorFilter("all")}>
                      Author: {getAuthorName(authorFilter)}
                      <X className="size-3" />
                    </Badge>
                  )}
                  {articleFilter !== "all" && (
                    <Badge variant="secondary" className="gap-1 h-5 text-xs cursor-pointer hover:bg-muted" onClick={() => setArticleFilter("all")}>
                      Article: {getArticleTitle(articleFilter)}
                      <X className="size-3" />
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 text-xs text-muted-foreground hover:text-foreground"
                    onClick={clearFilters}
                  >
                    Clear all
                  </Button>
                </div>
              </>
            )}
          </>
        }
        columns={[
          {
            key: "comment",
            header: "Comment",
            cell: (c) => {
              const author = getAuthor(c.authorId);
              const isReply = !!c.parentId;
              return (
                <div className="flex items-start gap-3 min-w-0">
                  <div className="relative">
                    <Avatar className="size-8 shrink-0">
                      <AvatarImage
                        src={getAuthorAvatar(c.authorId) ?? ""}
                        alt={getAuthorName(c.authorId)}
                      />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                        {getAuthorName(c.authorId)[0]?.toUpperCase() ?? "?"}
                      </AvatarFallback>
                    </Avatar>
                    {isReply && (
                      <div className="absolute -bottom-1 -right-1 size-4 rounded-full bg-muted border border-background flex items-center justify-center">
                        <Reply className="size-2.5 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold">{getAuthorName(c.authorId)}</span>
                      <span className="text-xs text-muted-foreground">
                        @{author?.handle ?? "unknown"}
                      </span>
                      <span className="text-muted-foreground/40">·</span>
                      <Link
                        to="/articles/$articleId"
                        params={{ articleId: c.articleSlug }}
                        className="text-xs text-muted-foreground hover:text-primary hover:underline truncate max-w-[200px]"
                      >
                        {getArticleTitle(c.articleSlug ?? "")}
                      </Link>
                    </div>
                    <div
                      className={cn(
                        "text-sm leading-relaxed",
                        c.status === "hidden" && "line-through text-muted-foreground/60",
                      )}
                    >
                      {c.body}
                    </div>
                    {c.updatedAt && (
                      <div className="mt-1 text-[11px] text-muted-foreground/60">
                        Edited {formatDistanceToNow(new Date(c.updatedAt), { addSuffix: true })}
                      </div>
                    )}
                  </div>
                </div>
              );
            },
          },
          {
            key: "engagement",
            header: "Engagement",
            cell: (c) => (
              <div className="flex items-center gap-3">
                <span
                  className="inline-flex items-center gap-1 text-sm text-muted-foreground"
                  title="Likes"
                >
                  <Heart className="size-3.5 text-rose-500/60" />
                  <span className="tabular-nums font-medium text-foreground">
                    {c.likesCount ?? 0}
                  </span>
                </span>
                <span
                  className="inline-flex items-center gap-1 text-sm text-muted-foreground"
                  title="Replies"
                >
                  <Reply className="size-3.5 text-sky-500/60" />
                  <span className="tabular-nums font-medium text-foreground">
                    {c.repliesCount ?? 0}
                  </span>
                </span>
              </div>
            ),
            className: "hidden md:table-cell w-32",
          },
          {
            key: "status",
            header: "Status",
            cell: (c) => <StatusBadge status={c.status ?? "visible"} />,
            className: "w-24",
          },
          {
            key: "when",
            header: "When",
            cell: (c) => (
              <div className="text-right">
                <div className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
                </div>
              </div>
            ),
            className: "w-28",
            headerClassName: "text-right",
          },
        ]}
        renderRowActions={(c) => (
          <div className="flex items-center justify-end gap-0.5 opacity-100 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="icon" className="size-8 hover:text-primary" asChild>
              <Link to="/comments/$commentId" params={{ commentId: c.id }}>
                <ArrowUpRight className="size-4" />
              </Link>
            </Button>
            {can("comments", "moderate") && c.status !== "visible" && (
              <Button
                variant="ghost"
                size="icon"
                className="size-8 hover:text-emerald-500"
                title="Approve"
                onClick={() => handleModerationAction(c, "approve", "Approve")}
                disabled={isActionPending(c.id, "approve")}
              >
                {isActionPending(c.id, "approve") ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-4" />
                )}
              </Button>
            )}
            {can("comments", "moderate") && c.status !== "hidden" && (
              <Button
                variant="ghost"
                size="icon"
                className="size-8 hover:text-amber-500"
                title="Hide"
                onClick={() => handleModerationAction(c, "hide", "Hide")}
                disabled={isActionPending(c.id, "hide")}
              >
                {isActionPending(c.id, "hide") ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <EyeOff className="size-4" />
                )}
              </Button>
            )}
            {can("comments", "moderate") && c.status !== "flagged" && (
              <Button
                variant="ghost"
                size="icon"
                className="size-8 hover:text-rose-500"
                title="Flag as spam"
                onClick={() => handleModerationAction(c, "flag", "Flag")}
                disabled={isActionPending(c.id, "flag")}
              >
                {isActionPending(c.id, "flag") ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Flag className="size-4" />
                )}
              </Button>
            )}
            {can("comments", "delete") && (
              <Button
                variant="ghost"
                size="icon"
                className="size-8 hover:text-destructive"
                title="Delete"
                onClick={() => openDeleteDialog(c)}
                disabled={deleteComment.isPending && deletingComment?.id === c.id}
              >
                {deleteComment.isPending && deletingComment?.id === c.id ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
              </Button>
            )}
          </div>
        )}
      />
      </PermissionGuard>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete comment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this comment? This action cannot be undone and the
              comment will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deletingComment && (
            <div className="rounded-md border bg-muted/30 p-3">
              <div className="flex items-start gap-3">
                <Avatar className="size-8 shrink-0">
                  <AvatarImage
                    src={getAuthorAvatar(deletingComment.authorId) ?? ""}
                    alt={getAuthorName(deletingComment.authorId)}
                  />
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                    {getAuthorName(deletingComment.authorId)[0]?.toUpperCase() ?? "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">
                    {getAuthorName(deletingComment.authorId)}
                  </div>
                  <div className="text-sm text-muted-foreground line-clamp-2">
                    {deletingComment.body}
                  </div>
                </div>
              </div>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteComment.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleteComment.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteComment.isPending ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete comment"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
