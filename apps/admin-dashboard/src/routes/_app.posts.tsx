import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Plus,
  Heart,
  MessageSquare,
  Eye,
  ArrowUpRight,
  Pencil,
  Trash2,
  MoreHorizontal,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  X,
  Check,
  Tag,
  FileText,
  Clock,
  Calendar,
  BarChart3,
  Send,
  Bookmark,
  Share2,
  Copy,
  ExternalLink,
} from "lucide-react";
import { ListPage } from "@/components/dashboard/list-page";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  usePosts,
  useCreateArticle,
  useUpdateArticle,
  useDeleteArticle,
  type Article,
} from "@/lib/api/hooks";
import { useAuth } from "@/lib/auth/context";
import { useUsers, useCategories } from "@/lib/api/hooks";
import { formatDistanceToNow, format } from "date-fns";
import { cn } from "@/lib/utils";
import { useState, useMemo, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/posts")({
  head: () => ({ meta: [{ title: "Posts · Vellbase Admin" }] }),
  component: PostsPage,
});

type CategoryFilter = "all" | string;
type StatusFilter = "all" | "published" | "draft";
type SortOption = "newest" | "oldest" | "mostViews" | "mostLikes" | "title";

function PostsPage() {
  const { data, isLoading, error, refetch } = usePosts({ pageSize: 50 });
  const { data: users } = useUsers();
  const { data: categories } = useCategories();
  const createArticle = useCreateArticle();
  const updateArticle = useUpdateArticle();
  const deleteArticle = useDeleteArticle();
  const { can } = useAuth();
  const rows = data?.data ?? [];

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [deletingArticle, setDeletingArticle] = useState<Article | null>(null);

  // Sheet states
  const [selectedPost, setSelectedPost] = useState<Article | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const [formTitle, setFormTitle] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formExcerpt, setFormExcerpt] = useState("");
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formAuthorId, setFormAuthorId] = useState("");
  const [formIsPublished, setFormIsPublished] = useState(false);
  const [formFeatured, setFormFeatured] = useState(false);
  const [formReadMinutes, setFormReadMinutes] = useState<number>(3);
  const [formCover, setFormCover] = useState("");

  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("newest");

  const getCategoryName = (categoryId: string) => {
    return categories?.find((c) => c.id === categoryId)?.name ?? "Uncategorized";
  };

  const getCategoryColor = (categoryId: string) => {
    const colors: Record<string, string> = {
      culture: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
      design: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
      environment: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      music: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
      architecture: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
      technology: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
    };
    return colors[categoryId?.toLowerCase()] ?? "bg-muted text-muted-foreground border-transparent";
  };

  const getAuthorName = (authorId: string) => {
    return users?.data?.find((u) => u.id === authorId)?.name ?? "Unknown";
  };

  const getAuthorAvatar = (authorId: string) => {
    return users?.data?.find((u) => u.id === authorId)?.avatar ?? null;
  };

  const getAuthorHandle = (authorId: string) => {
    return users?.data?.find((u) => u.id === authorId)?.handle ?? "";
  };

  const getEngagementTrend = (c: Article) => {
    const rate = c.views > 0 ? (c.likesCount + c.commentsCount) / c.views : 0;
    if (rate > 0.08) return { icon: TrendingUp, color: "text-emerald-500", label: "High", bgColor: "bg-emerald-500/10" };
    if (rate > 0.04) return { icon: Minus, color: "text-amber-500", label: "Avg", bgColor: "bg-amber-500/10" };
    return { icon: TrendingDown, color: "text-rose-500", label: "Low", bgColor: "bg-rose-500/10" };
  };

  const filteredRows = useMemo(() => {
    let result = rows;

    if (categoryFilter !== "all") {
      result = result.filter((article) => article.categoryId === categoryFilter);
    }

    if (statusFilter !== "all") {
      result = result.filter((article) =>
        statusFilter === "published" ? article.isPublished : !article.isPublished
      );
    }

    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "oldest":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case "mostViews":
          return (b.views || 0) - (a.views || 0);
        case "mostLikes":
          return (b.likesCount || 0) - (a.likesCount || 0);
        case "title":
          return a.title.localeCompare(b.title);
        default:
          return 0;
      }
    });

    return result;
  }, [rows, categoryFilter, statusFilter, sortBy]);

  const hasActiveFilters = categoryFilter !== "all" || statusFilter !== "all";

  const clearFilters = useCallback(() => {
    setCategoryFilter("all");
    setStatusFilter("all");
  }, []);

  const resetCreateForm = () => {
    setFormTitle("");
    setFormSlug("");
    setFormExcerpt("");
    setFormCategoryId("");
    setFormAuthorId("");
    setFormIsPublished(false);
    setFormFeatured(false);
    setFormReadMinutes(3);
    setFormCover("");
  };

  const handleCreate = () => {
    if (!formTitle.trim() || !formCategoryId || !formAuthorId) return;

    const slug = formSlug.trim()
      ? formSlug.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
      : formTitle.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

    createArticle.mutate(
      {
        title: formTitle.trim(),
        slug,
        excerpt: formExcerpt.trim(),
        body: [formExcerpt.trim() || formTitle.trim()],
        categoryId: formCategoryId,
        authorId: formAuthorId,
        isPublished: formIsPublished,
        featured: formFeatured,
        readMinutes: formReadMinutes,
        cover: formCover.trim() || null,
      },
      {
        onSuccess: () => {
          setIsCreateOpen(false);
          resetCreateForm();
          refetch();
          toast.success("Post created successfully");
        },
        onError: (error: any) => {
          toast.error("Failed to create post: " + (error?.message || "Unknown error"));
        },
      }
    );
  };

  const openEdit = (article: Article) => {
    setEditingArticle(article);
    setFormTitle(article.title);
    setFormSlug(article.slug);
    setFormExcerpt(article.excerpt ?? "");
    setFormCategoryId(article.categoryId);
    setFormAuthorId(article.authorId);
    setFormIsPublished(article.isPublished ?? false);
    setFormFeatured(article.featured ?? false);
    setFormReadMinutes(article.readMinutes ?? 3);
    setFormCover(article.cover ?? "");
    setIsEditOpen(true);
  };

  const handleEdit = () => {
    if (!editingArticle || !formTitle.trim() || !formCategoryId || !formAuthorId) return;

    const slug = formSlug.trim()
      ? formSlug.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
      : formTitle.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

    updateArticle.mutate(
      {
        id: editingArticle.id,
        title: formTitle.trim(),
        slug,
        excerpt: formExcerpt.trim(),
        body: [formExcerpt.trim() || formTitle.trim()],
        categoryId: formCategoryId,
        authorId: formAuthorId,
        isPublished: formIsPublished,
        featured: formFeatured,
        readMinutes: formReadMinutes,
        cover: formCover.trim() || null,
      },
      {
        onSuccess: () => {
          setIsEditOpen(false);
          setEditingArticle(null);
          resetCreateForm();
          refetch();
          toast.success("Post updated successfully");
        },
        onError: (error: any) => {
          toast.error("Failed to update post: " + (error?.message || "Unknown error"));
        },
      }
    );
  };

  const openDelete = (article: Article) => {
    setDeletingArticle(article);
    setIsDeleteOpen(true);
  };

  const handleDelete = () => {
    if (!deletingArticle) return;
    deleteArticle.mutate(deletingArticle.id, {
      onSuccess: () => {
        setIsDeleteOpen(false);
        setDeletingArticle(null);
        refetch();
        toast.success("Post deleted successfully");
      },
      onError: (error: any) => {
        toast.error("Failed to delete post: " + (error?.message || "Unknown error"));
      },
    });
  };

  const togglePublish = (article: Article) => {
    updateArticle.mutate(
      {
        id: article.id,
        isPublished: !article.isPublished,
      },
      {
        onSuccess: () => {
          refetch();
          toast.success(article.isPublished ? "Post unpublished" : "Post published");
        },
        onError: (error: any) => {
          toast.error("Failed to update post status: " + (error?.message || "Unknown error"));
        },
      }
    );
  };

  const openPostSheet = (post: Article) => {
    setSelectedPost(post);
    setIsSheetOpen(true);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  return (
    <>
      <ListPage<Article>
        title="Posts"
        description="Articles published across the platform."
        eyebrow="Content"
        rows={filteredRows}
        isLoading={isLoading}
        error={error}
        searchKeys={["title", "slug", "excerpt"]}
        pageSize={15}
        enableSelection={true}
        enableExport={true}
        enablePagination={true}
        actions={
          can("posts", "write") ? (
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5">
                  <Plus className="size-4" /> New post
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create post</DialogTitle>
                  <DialogDescription>
                    Create a new post for your publication.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="create-title">Title</Label>
                    <Input
                      id="create-title"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      placeholder="Post title"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="create-slug">Slug</Label>
                    <Input
                      id="create-slug"
                      value={formSlug}
                      onChange={(e) => setFormSlug(e.target.value)}
                      placeholder="auto-generated from title"
                    />
                    <p className="text-xs text-muted-foreground">
                      Leave blank to auto-generate from title
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="create-excerpt">Excerpt</Label>
                    <Textarea
                      id="create-excerpt"
                      value={formExcerpt}
                      onChange={(e) => setFormExcerpt(e.target.value)}
                      placeholder="Brief summary of the post"
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="create-cover">Cover URL</Label>
                    <Input
                      id="create-cover"
                      value={formCover}
                      onChange={(e) => setFormCover(e.target.value)}
                      placeholder="https://..."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Select value={formCategoryId} onValueChange={setFormCategoryId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories?.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Author</Label>
                      <Select value={formAuthorId} onValueChange={setFormAuthorId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select author" />
                        </SelectTrigger>
                        <SelectContent>
                          {users?.data?.map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="create-read-minutes">Read minutes</Label>
                      <Input
                        id="create-read-minutes"
                        type="number"
                        min={1}
                        value={formReadMinutes}
                        onChange={(e) => setFormReadMinutes(parseInt(e.target.value) || 1)}
                      />
                    </div>
                    <div className="flex items-end justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <Switch
                          id="create-published"
                          checked={formIsPublished}
                          onCheckedChange={setFormIsPublished}
                        />
                        <Label htmlFor="create-published" className="cursor-pointer">
                          Published
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          id="create-featured"
                          checked={formFeatured}
                          onCheckedChange={setFormFeatured}
                        />
                        <Label htmlFor="create-featured" className="cursor-pointer">
                          Featured
                        </Label>
                      </div>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => { setIsCreateOpen(false); resetCreateForm(); }}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreate}
                    disabled={createArticle.isPending || !formTitle.trim() || !formCategoryId || !formAuthorId}
                  >
                    {createArticle.isPending ? "Creating..." : "Create post"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : null
        }
        filters={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 h-8">
                  <Tag className="size-3.5" />
                  Category
                  <ChevronDown className="size-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>Filter by category</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setCategoryFilter("all")}
                  className={cn(categoryFilter === "all" && "bg-accent")}
                >
                  All categories
                  {categoryFilter === "all" && <Check className="ml-2 size-3.5" />}
                </DropdownMenuItem>
                {categories?.map((c) => (
                  <DropdownMenuItem
                    key={c.id}
                    onClick={() => setCategoryFilter(c.id)}
                    className={cn(categoryFilter === c.id && "bg-accent")}
                  >
                    {c.name}
                    {categoryFilter === c.id && <Check className="ml-2 size-3.5" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 h-8">
                  <FileText className="size-3.5" />
                  Status
                  <ChevronDown className="size-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>Filter by status</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {(["all", "published", "draft"] as const).map((status) => (
                  <DropdownMenuItem
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={cn(statusFilter === status && "bg-accent")}
                  >
                    {status === "all" ? "All statuses" : status.charAt(0).toUpperCase() + status.slice(1)}
                    {statusFilter === status && <Check className="ml-2 size-3.5" />}
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
                  { value: "mostViews", label: "Most views" },
                  { value: "mostLikes", label: "Most likes" },
                  { value: "title", label: "Title" },
                ] as const).map(({ value, label }) => (
                  <DropdownMenuItem
                    key={value}
                    onClick={() => setSortBy(value as SortOption)}
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
                  {categoryFilter !== "all" && (
                    <Badge variant="secondary" className="gap-1 h-5 text-xs cursor-pointer hover:bg-muted" onClick={() => setCategoryFilter("all")}>
                      Category: {getCategoryName(categoryFilter)}
                      <X className="size-3" />
                    </Badge>
                  )}
                  {statusFilter !== "all" && (
                    <Badge variant="secondary" className="gap-1 h-5 text-xs cursor-pointer hover:bg-muted" onClick={() => setStatusFilter("all")}>
                      Status: {statusFilter}
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
            key: "post",
            header: "Post",
            cell: (c) => (
              <div className="flex items-start gap-3 min-w-0">
                <div className="size-12 shrink-0 rounded-lg overflow-hidden bg-muted cursor-pointer group" onClick={() => openPostSheet(c)}>
                  {c.cover ? (
                    <img
                      src={c.cover}
                      alt={c.title}
                      className="size-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  ) : (
                    <div className="size-full flex items-center justify-center text-muted-foreground/30">
                      <Eye className="size-5" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <button
                    onClick={() => openPostSheet(c)}
                    className="block truncate text-sm font-semibold hover:text-primary transition-colors text-left"
                  >
                    {c.title?.slice(0, 60)}
                  </button>
                  <div className="mt-1 flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground">
                      {getAuthorName(c.authorId)}
                    </span>
                    <span className="text-muted-foreground/40">·</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] font-medium px-1.5 py-0 h-4 border",
                        getCategoryColor(c.categoryId)
                      )}
                    >
                      {getCategoryName(c.categoryId)}
                    </Badge>
                    <span className="text-muted-foreground/40">·</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(c.updatedAt), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              </div>
            ),
          },
          {
            key: "status",
            header: "Status",
            cell: (c) => <StatusBadge status={c.isPublished ? "published" : "draft"} />,
            className: "w-24",
          },
          {
            key: "engagement",
            header: "Engagement",
            cell: (c) => {
              const trend = getEngagementTrend(c);
              const TrendIcon = trend.icon;
              return (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <Eye className="size-3.5 text-muted-foreground/50" />
                    <span className="text-sm tabular-nums font-medium">{c.views.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Heart className="size-3.5 text-rose-500/60" />
                    <span className="text-sm tabular-nums font-medium">{c.likesCount.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MessageSquare className="size-3.5 text-sky-500/60" />
                    <span className="text-sm tabular-nums font-medium">{c.commentsCount.toLocaleString()}</span>
                  </div>
                  <div className={cn("flex items-center gap-1 ml-1", trend.color)}>
                    <TrendIcon className="size-3" />
                    <span className="text-[11px] font-medium">{trend.label}</span>
                  </div>
                </div>
              );
            },
            className: "hidden md:table-cell",
          },
          {
            key: "performance",
            header: "Performance",
            cell: (c) => {
              const engagementRate = c.views > 0
                ? (((c.likesCount + c.commentsCount) / c.views) * 100).toFixed(1)
                : "0.0";
              const trend = getEngagementTrend(c);
              return (
                <div className="text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <span className="text-sm font-semibold tabular-nums">{engagementRate}%</span>
                    <span className={cn("text-[10px] font-medium", trend.color)}>{trend.label}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">engagement rate</div>
                </div>
              );
            },
            className: "hidden lg:table-cell w-28",
            headerClassName: "text-right",
          },
        ]}
        renderRowActions={(c) => (
          <div className="flex items-center justify-end gap-0.5 opacity-100 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="icon" className="size-8 hover:text-primary" onClick={() => openPostSheet(c)}>
              <ArrowUpRight className="size-4" />
            </Button>
            {can("posts", "write") && (
              <Button
                variant="ghost"
                size="icon"
                className="size-8 hover:text-primary"
                onClick={(e) => { e.stopPropagation(); openEdit(c); }}
                aria-label="Edit"
              >
                <Pencil className="size-4" />
              </Button>
            )}
            {can("posts", "delete") && (
              <Button
                variant="ghost"
                size="icon"
                className="size-8 hover:text-destructive"
                onClick={(e) => { e.stopPropagation(); openDelete(c); }}
                aria-label="Delete"
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        )}
        onRowClick={(c) => openPostSheet(c)}
      />

      {/* Post Details Sheet */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="sm:max-w-xl w-full md:max-w-2xl overflow-hidden p-0">
          {selectedPost && (
            <>
              {/* Cover Image */}
              <div className="relative h-56 shrink-0">
                {selectedPost.cover ? (
                  <img
                    src={selectedPost.cover}
                    alt={selectedPost.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-muted flex items-center justify-center">
                    <FileText className="size-12 text-muted-foreground/30" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
                <SheetClose asChild>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute top-4 right-4 size-8 rounded-full bg-background/80 backdrop-blur-sm"
                  >
                    <X className="size-4" />
                  </Button>
                </SheetClose>
                <div className="absolute bottom-4 left-6 right-6">
                  <Badge
                    variant="outline"
                    className={cn(
                      "mb-2 text-[10px] font-medium border",
                      getCategoryColor(selectedPost.categoryId)
                    )}
                  >
                    {getCategoryName(selectedPost.categoryId)}
                  </Badge>
                  <h2 className="text-xl font-semibold leading-tight line-clamp-2">
                    {selectedPost.title}
                  </h2>
                </div>
              </div>

              <ScrollArea className="flex-1 h-[calc(100vh-14rem)]">
                <div className="p-6 space-y-6">
                  {/* Author & Meta */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="size-10">
                        <AvatarImage src={getAuthorAvatar(selectedPost.authorId) || ""} />
                        <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                          {getAuthorName(selectedPost.authorId)[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="text-sm font-medium">{getAuthorName(selectedPost.authorId)}</div>
                        <div className="text-xs text-muted-foreground">@{getAuthorHandle(selectedPost.authorId)}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={selectedPost.isPublished ? "published" : "draft"} />
                    </div>
                  </div>

                  <Separator />

                  {/* Quick Stats */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="rounded-lg border bg-card p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5 mb-1">
                        <Eye className="size-3.5 text-muted-foreground" />
                        <span className="text-lg font-semibold tabular-nums">{selectedPost.views.toLocaleString()}</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Views</div>
                    </div>
                    <div className="rounded-lg border bg-card p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5 mb-1">
                        <Heart className="size-3.5 text-rose-500" />
                        <span className="text-lg font-semibold tabular-nums">{selectedPost.likesCount.toLocaleString()}</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Likes</div>
                    </div>
                    <div className="rounded-lg border bg-card p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5 mb-1">
                        <MessageSquare className="size-3.5 text-sky-500" />
                        <span className="text-lg font-semibold tabular-nums">{selectedPost.commentsCount.toLocaleString()}</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Comments</div>
                    </div>
                  </div>

                  {/* Engagement Rate */}
                  {(() => {
                    const rate = selectedPost.views > 0
                      ? (((selectedPost.likesCount + selectedPost.commentsCount) / selectedPost.views) * 100).toFixed(1)
                      : "0.0";
                    const trend = getEngagementTrend(selectedPost);
                    const TrendIcon = trend.icon;
                    return (
                      <div className="rounded-lg border bg-card p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <BarChart3 className="size-4 text-muted-foreground" />
                            <span className="text-sm font-medium">Engagement Rate</span>
                          </div>
                          <div className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", trend.bgColor, trend.color)}>
                            <TrendIcon className="size-3" />
                            {trend.label}
                          </div>
                        </div>
                        <div className="flex items-end gap-2">
                          <span className="text-3xl font-bold tabular-nums">{rate}%</span>
                          <span className="text-xs text-muted-foreground mb-1">of total views</span>
                        </div>
                        <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className={cn("h-full rounded-full transition-all duration-500", trend.color.replace("text-", "bg-"))}
                            style={{ width: `${Math.min(parseFloat(rate) * 5, 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })()}

                  <Separator />

                  {/* Excerpt */}
                  <div>
                    <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <FileText className="size-3.5 text-muted-foreground" />
                      Excerpt
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {selectedPost.excerpt || "No excerpt provided."}
                    </p>
                  </div>

                  {/* Meta Info */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium flex items-center gap-2">
                      <Calendar className="size-3.5 text-muted-foreground" />
                      Timeline
                    </h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="size-3.5" />
                        <span>Created {formatDistanceToNow(new Date(selectedPost.createdAt), { addSuffix: true })}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="size-3.5" />
                        <span>Updated {formatDistanceToNow(new Date(selectedPost.updatedAt), { addSuffix: true })}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="size-3.5" />
                        <span>{selectedPost.readMinutes} min read</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Tag className="size-3.5" />
                        <span>Slug: {selectedPost.slug}</span>
                      </div>
                    </div>
                  </div>

                  {selectedPost.featured && (
                    <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
                      Featured Post
                    </Badge>
                  )}
                </div>
              </ScrollArea>

              {/* Footer Actions */}
              <SheetFooter className="border-t p-4 gap-2 shrink-0">
                <div className="flex items-center gap-2 w-full">
                  <Button variant="outline" size="sm" className="gap-1.5 flex-1" onClick={() => copyToClipboard(`${window.location.origin}/posts/${selectedPost.id}`)}>
                    <Copy className="size-3.5" />
                    Copy Link
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1.5 flex-1" asChild>
                    <Link to="/posts/$postId" params={{ postId: selectedPost.id }}>
                      <ExternalLink className="size-3.5" />
                      View
                    </Link>
                  </Button>
                  {can("posts", "write") && (
                    <Button size="sm" className="gap-1.5 flex-1" onClick={() => { setIsSheetOpen(false); openEdit(selectedPost); }}>
                      <Pencil className="size-3.5" />
                      Edit
                    </Button>
                  )}
                </div>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit post</DialogTitle>
            <DialogDescription>
              Update post details and settings.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Post title"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-slug">Slug</Label>
              <Input
                id="edit-slug"
                value={formSlug}
                onChange={(e) => setFormSlug(e.target.value)}
                placeholder="auto-generated from title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-excerpt">Excerpt</Label>
              <Textarea
                id="edit-excerpt"
                value={formExcerpt}
                onChange={(e) => setFormExcerpt(e.target.value)}
                placeholder="Brief summary of the post"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-cover">Cover URL</Label>
              <Input
                id="edit-cover"
                value={formCover}
                onChange={(e) => setFormCover(e.target.value)}
                placeholder="https://..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={formCategoryId} onValueChange={setFormCategoryId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Author</Label>
                <Select value={formAuthorId} onValueChange={setFormAuthorId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select author" />
                  </SelectTrigger>
                  <SelectContent>
                    {users?.data?.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-read-minutes">Read minutes</Label>
                <Input
                  id="edit-read-minutes"
                  type="number"
                  min={1}
                  value={formReadMinutes}
                  onChange={(e) => setFormReadMinutes(parseInt(e.target.value) || 1)}
                />
              </div>
              <div className="flex items-end justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    id="edit-published"
                    checked={formIsPublished}
                    onCheckedChange={setFormIsPublished}
                  />
                  <Label htmlFor="edit-published" className="cursor-pointer">
                    Published
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="edit-featured"
                    checked={formFeatured}
                    onCheckedChange={setFormFeatured}
                  />
                  <Label htmlFor="edit-featured" className="cursor-pointer">
                    Featured
                  </Label>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsEditOpen(false); setEditingArticle(null); }}>
              Cancel
            </Button>
            <Button
              onClick={handleEdit}
              disabled={updateArticle.isPending || !formTitle.trim() || !formCategoryId || !formAuthorId}
            >
              {updateArticle.isPending ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete post</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <strong>{deletingArticle?.title}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setIsDeleteOpen(false); setDeletingArticle(null); }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteArticle.isPending}
            >
              {deleteArticle.isPending ? "Deleting..." : "Delete post"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}