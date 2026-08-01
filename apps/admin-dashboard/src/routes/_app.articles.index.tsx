import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { 
  Plus, 
  Pencil, 
  ArrowUpRight, 
  Trash2,
  Download,
  RefreshCw,
  X,
  Check,
  AlertCircle,
  Loader2,
  Tag,
  FileText,
  MoreHorizontal,
  Copy,
  Share2,
  EyeOff,
  Eye,
  TrendingUp,
  ChevronDown,
} from "lucide-react";
import { ListPage } from "@/components/dashboard/list-page";
import { PermissionGuard, PermissionGate } from "@/components/dashboard/permission-guard";
import { ReadOnlyBanner } from "@/components/dashboard/read-only-banner";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  useArticles,
  useCategories,
  useUsers,
  useCreateArticle,
  useUpdateArticle,
  useDeleteArticle,
  type Article,
} from "@/lib/api/hooks";
import { useAuth } from "@/lib/auth/context";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { useState, useMemo, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
import { toast } from "sonner";

export const Route = createFileRoute("/_app/articles/")({
  component: ArticlesPage,
});

type CategoryFilter = "all" | string;
type StatusFilter = "all" | "published" | "draft";
type SortOption = "newest" | "oldest" | "mostViews" | "mostLikes" | "title";

function ArticlesPage() {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useArticles();
  const { data: categories } = useCategories();
  const { data: users } = useUsers();
  const createArticle = useCreateArticle();
  const updateArticle = useUpdateArticle();
  const deleteArticle = useDeleteArticle();
  const { can } = useAuth();
  const rows = data?.data ?? [];

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [isDuplicateOpen, setIsDuplicateOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [deletingArticle, setDeletingArticle] = useState<Article | null>(null);
  const [duplicatingArticle, setDuplicatingArticle] = useState<Article | null>(null);

  // Form states
  const [formTitle, setFormTitle] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formExcerpt, setFormExcerpt] = useState("");
  const [formBody, setFormBody] = useState("");
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formAuthorId, setFormAuthorId] = useState("");
  const [formIsPublished, setFormIsPublished] = useState(false);
  const [formFeatured, setFormFeatured] = useState(false);
  const [formReadMinutes, setFormReadMinutes] = useState<number>(3);

  // UI states
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [processingAction, setProcessingAction] = useState<Set<string>>(new Set());

  // Memoized filtered and sorted data
  const filteredRows = useMemo(() => {
    let result = rows;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter((article) =>
        article.title.toLowerCase().includes(query) ||
        (article.excerpt?.toLowerCase() || "").includes(query) ||
        (article.slug?.toLowerCase() || "").includes(query)
      );
    }

    // Category filter
    if (categoryFilter !== "all") {
      result = result.filter((article) => article.categoryId === categoryFilter);
    }

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter((article) => 
        statusFilter === "published" ? article.isPublished : !article.isPublished
      );
    }

    // Sorting
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
  }, [rows, searchQuery, categoryFilter, statusFilter, sortBy]);

  const hasActiveFilters = searchQuery || categoryFilter !== "all" || statusFilter !== "all";

  // Helper functions
  const getCategoryName = (categoryId: string) => {
    return categories?.find((c) => c.id === categoryId)?.name ?? "Unknown";
  };

  const getCategoryColor = (categoryId: string) => {
    const colors: Record<string, string> = {
      culture: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
      design: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
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

  const getAuthorInitials = (authorId: string) => {
    const name = getAuthorName(authorId);
    return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 1);
  };

  // Reset form
  const resetForm = useCallback(() => {
    setFormTitle("");
    setFormSlug("");
    setFormExcerpt("");
    setFormBody("");
    setFormCategoryId("");
    setFormAuthorId("");
    setFormIsPublished(false);
    setFormFeatured(false);
    setFormReadMinutes(3);
  }, []);

  // CRUD handlers
  const handleCreate = useCallback(() => {
    if (!formTitle.trim() || !formCategoryId || !formAuthorId) {
      toast.error("Please fill in all required fields");
      return;
    }

    const slug = formSlug.trim()
      ? formSlug.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
      : formTitle.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

    createArticle.mutate(
      {
        title: formTitle.trim(),
        slug,
        excerpt: formExcerpt.trim(),
        body: [formBody.trim() || formExcerpt.trim() || formTitle.trim()],
        categoryId: formCategoryId,
        authorId: formAuthorId,
        isPublished: formIsPublished,
        featured: formFeatured,
        readMinutes: formReadMinutes,
      },
      {
        onSuccess: () => {
          setIsCreateOpen(false);
          resetForm();
          refetch();
          toast.success("Article created successfully");
        },
        onError: (error) => {
          toast.error("Failed to create article: " + (error.message || "Unknown error"));
        },
      }
    );
  }, [formTitle, formSlug, formExcerpt, formBody, formCategoryId, formAuthorId, formIsPublished, formFeatured, formReadMinutes, createArticle, refetch, resetForm]);

  const openEdit = useCallback((article: Article) => {
    setEditingArticle(article);
    setFormTitle(article.title);
    setFormSlug(article.slug || "");
    setFormExcerpt(article.excerpt ?? "");
    setFormBody(article.body?.join("\n") || "");
    setFormCategoryId(article.categoryId);
    setFormAuthorId(article.authorId);
    setFormIsPublished(article.isPublished ?? false);
    setFormFeatured(article.featured ?? false);
    setFormReadMinutes(article.readMinutes ?? 3);
    setIsEditOpen(true);
  }, []);

  const handleEdit = useCallback(() => {
    if (!editingArticle || !formTitle.trim() || !formCategoryId || !formAuthorId) {
      toast.error("Please fill in all required fields");
      return;
    }

    const slug = formSlug.trim()
      ? formSlug.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
      : formTitle.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

    updateArticle.mutate(
      {
        id: editingArticle.id,
        title: formTitle.trim(),
        slug,
        excerpt: formExcerpt.trim(),
        body: [formBody.trim() || formExcerpt.trim() || formTitle.trim()],
        categoryId: formCategoryId,
        authorId: formAuthorId,
        isPublished: formIsPublished,
        featured: formFeatured,
        readMinutes: formReadMinutes,
      },
      {
        onSuccess: () => {
          setIsEditOpen(false);
          setEditingArticle(null);
          resetForm();
          refetch();
          toast.success("Article updated successfully");
        },
        onError: (error) => {
          toast.error("Failed to update article: " + (error.message || "Unknown error"));
        },
      }
    );
  }, [editingArticle, formTitle, formSlug, formExcerpt, formBody, formCategoryId, formAuthorId, formIsPublished, formFeatured, formReadMinutes, updateArticle, refetch, resetForm]);

  const openDelete = useCallback((article: Article) => {
    setDeletingArticle(article);
    setIsDeleteOpen(true);
  }, []);

  const handleDelete = useCallback(() => {
    if (!deletingArticle) return;
    
    setProcessingAction((prev) => new Set(prev).add(deletingArticle.id));
    deleteArticle.mutate(deletingArticle.id, {
      onSuccess: () => {
        setIsDeleteOpen(false);
        setDeletingArticle(null);
        refetch();
        toast.success("Article deleted successfully");
      },
      onError: (error) => {
        toast.error("Failed to delete article: " + (error.message || "Unknown error"));
      },
      onSettled: () => {
        setProcessingAction((prev) => {
          const next = new Set(prev);
          next.delete(deletingArticle.id);
          return next;
        });
      },
    });
  }, [deletingArticle, deleteArticle, refetch]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.length === 0) return;

    try {
      toast.loading(`Deleting ${selectedIds.length} articles...`);
      const deletePromises = selectedIds.map((id) => 
        new Promise<void>((resolve, reject) => {
          deleteArticle.mutate(id, {
            onSuccess: () => resolve(),
            onError: () => reject(),
          });
        })
      );
      await Promise.all(deletePromises);
      toast.success(`${selectedIds.length} articles deleted`);
      setSelectedIds([]);
      setIsBulkDeleteOpen(false);
      refetch();
    } catch {
      toast.error("Failed to delete some articles");
    }
  }, [selectedIds, deleteArticle, refetch]);

  const handleDuplicate = useCallback(() => {
    if (!duplicatingArticle) return;

    createArticle.mutate(
      {
        title: `${duplicatingArticle.title} (Copy)`,
        slug: `${duplicatingArticle.slug || duplicatingArticle.id}-copy`,
        excerpt: duplicatingArticle.excerpt || "",
        body: duplicatingArticle.body || [duplicatingArticle.title],
        categoryId: duplicatingArticle.categoryId,
        authorId: duplicatingArticle.authorId,
        isPublished: false,
        featured: duplicatingArticle.featured || false,
        readMinutes: duplicatingArticle.readMinutes || 3,
      },
      {
        onSuccess: () => {
          setIsDuplicateOpen(false);
          setDuplicatingArticle(null);
          refetch();
          toast.success("Article duplicated successfully");
        },
        onError: (error) => {
          toast.error("Failed to duplicate article: " + (error.message || "Unknown error"));
        },
      }
    );
  }, [duplicatingArticle, createArticle, refetch]);

  const togglePublish = useCallback((article: Article) => {
    setProcessingAction((prev) => new Set(prev).add(article.id));
    updateArticle.mutate(
      {
        id: article.id,
        isPublished: !article.isPublished,
      },
      {
        onSuccess: () => {
          refetch();
          toast.success(article.isPublished ? "Article unpublished" : "Article published");
        },
        onError: (error) => {
          toast.error("Failed to update article status: " + (error.message || "Unknown error"));
        },
        onSettled: () => {
          setProcessingAction((prev) => {
            const next = new Set(prev);
            next.delete(article.id);
            return next;
          });
        },
      }
    );
  }, [updateArticle, refetch]);

  // Refresh handler
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refetch();
      toast.success("Articles refreshed");
    } catch (error) {
      toast.error("Failed to refresh articles");
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch]);

  // Export handler
  const handleExport = useCallback(async () => {
    const dataToExport = filteredRows.length > 0 ? filteredRows : rows;
    if (dataToExport.length === 0) {
      toast.error("No data to export");
      return;
    }

    setIsExporting(true);
    try {
      const headers = ["ID", "Title", "Slug", "Category", "Author", "Status", "Views", "Likes", "Read Minutes", "Created At", "Updated At"];
      const csvRows = [headers.join(",")];

      for (const article of dataToExport) {
        const row = [
          article.id,
          `"${article.title.replace(/"/g, '""')}"`,
          article.slug || "",
          getCategoryName(article.categoryId),
          getAuthorName(article.authorId),
          article.isPublished ? "Published" : "Draft",
          article.views || 0,
          article.likesCount || 0,
          article.readMinutes || 0,
          format(new Date(article.createdAt), "yyyy-MM-dd HH:mm:ss"),
          format(new Date(article.updatedAt), "yyyy-MM-dd HH:mm:ss"),
        ];
        csvRows.push(row.join(","));
      }

      const csvContent = csvRows.join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `articles-${format(new Date(), "yyyy-MM-dd-HHmmss")}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      toast.success(`Exported ${dataToExport.length} articles`);
    } catch (error) {
      toast.error("Failed to export articles");
    } finally {
      setIsExporting(false);
    }
  }, [filteredRows, rows]);

  const clearFilters = useCallback(() => {
    setSearchQuery("");
    setCategoryFilter("all");
    setStatusFilter("all");
  }, []);

  // Keyboard shortcut for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        document.getElementById("search-input")?.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      <PermissionGuard resource="articles" action="read" showReadOnlyBanner>
        <ListPage
          title="Articles"
          description="Long-form written content across all authors."
          eyebrow="Content"
          rows={filteredRows}
          searchKeys={["title", "excerpt"]}
          pageSize={15}
          isLoading={isLoading}
          error={error}
          enableSelection={true}
        searchPlaceholder="Search articles... (⌘K)"
        onSelectionChange={(selected) => setSelectedIds(Array.from(selected))}
        enableExport={true}
        enablePagination={true}
        actions={
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                >
                  <RefreshCw className={cn("size-4", isRefreshing && "animate-spin")} />
                  <span className="hidden sm:inline">Refresh</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh article list</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={handleExport}
                  disabled={isExporting || rows.length === 0}
                >
                  {isExporting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Download className="size-4" />
                  )}
                  <span className="hidden sm:inline">{isExporting ? "Exporting..." : "Export"}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Export articles to CSV</TooltipContent>
            </Tooltip>

            {selectedIds.length > 0 && (
              <Button
                variant="destructive"
                size="sm"
                className="gap-1.5"
                onClick={() => setIsBulkDeleteOpen(true)}
              >
                <Trash2 className="size-4" />
                <span className="hidden sm:inline">Delete {selectedIds.length}</span>
              </Button>
            )}

            {can("articles", "write") && (
              <Button size="sm" className="gap-1.5" onClick={() => setIsCreateOpen(true)}>
                <Plus className="size-4" /> New article
              </Button>
            )}
          </div>
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
                  {searchQuery && (
                    <Badge variant="secondary" className="gap-1 h-5 text-xs cursor-pointer hover:bg-muted" onClick={() => setSearchQuery("")}>
                      Search: {searchQuery}
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
            key: "title",
            header: "Title",
            cell: (c) => (
              <Link
                to="/articles/$articleId"
                params={{ articleId: c.id }}
                className="group flex items-start gap-3 hover:opacity-80 transition-opacity"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="truncate text-xs font-medium group-hover:text-primary transition-colors">
                      {c.title?.slice(0, 40)}
                    </div>
                    {c.featured && (
                      <Badge variant="default" className="text-[10px] h-4 px-1.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
                        Featured
                      </Badge>
                    )}
                  </div>
                  <div className="truncate text-xs text-muted-foreground mt-0.5">
                    {c.excerpt?.slice(0, 60)}...
                  </div>
                </div>
              </Link>
            ),
          },
          {
            key: "author",
            header: "Author",
            cell: (c) => {
              const authorName = getAuthorName(c.authorId);
              const initials = getAuthorInitials(c.authorId);
              return (
                <div className="flex items-center gap-2">
                  <Avatar className="size-7">
                    <AvatarImage src={(c.author as any).avatar} alt={authorName} />
                    <AvatarFallback className="bg-secondary text-secondary-foreground text-xs font-medium">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs">{authorName}</span>
                </div>
              );
            },
          },
          {
            key: "category",
            header: "Category",
            cell: (c) => (
              <Badge variant="secondary" className={cn("text-xs font-medium", getCategoryColor(c.categoryId))}>
                {getCategoryName(c.categoryId)}
              </Badge>
            ),
          },
          {
            key: "status",
            header: "Status",
            cell: (c) => <StatusBadge status={c.isPublished ? "published" : "draft"} />,
          },
          {
            key: "engagement",
            header: "Engagement",
            cell: (c) => (
              <div className="flex items-center gap-4 text-sm">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Eye className="size-3.5" />
                      {c.views.toLocaleString()}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Total views</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                      {c.likesCount.toLocaleString()}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Total likes</TooltipContent>
                </Tooltip>
              </div>
            ),
          },
          {
            key: "updated",
            header: "Updated",
            cell: (c) => (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-xs text-muted-foreground cursor-help">
                    {formatDistanceToNow(new Date(c.updatedAt), { addSuffix: true })}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {format(new Date(c.updatedAt), "PPP p")}
                </TooltipContent>
              </Tooltip>
            ),
          },
        ]}
        renderRowActions={(c) => (
          <div className="flex items-center justify-end gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8 hover:text-primary" asChild>
                  <Link to="/articles/$articleId" params={{ articleId: c.id }}>
                     <ArrowUpRight className="size-4" />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>View article</TooltipContent>
            </Tooltip>

            {can("articles", "write") && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 hover:text-primary"
                    onClick={() => openEdit(c)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Edit article</TooltipContent>
              </Tooltip>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link to="/articles/$articleId" params={{ articleId: c.id }}>
                    <Eye className="mr-2 size-3.5" /> View article
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  setDuplicatingArticle(c);
                  setIsDuplicateOpen(true);
                }}>
                  <Copy className="mr-2 size-3.5" /> Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem onClick={async () => {
                  try {
                    const url = `${window.location.origin}/articles/${c.id}`;
                    await navigator.clipboard.writeText(url);
                    toast.success("Article link copied to clipboard");
                  } catch {
                    toast.error("Failed to copy link");
                  }
                }}>
                  <Share2 className="mr-2 size-3.5" /> Share
                </DropdownMenuItem>
                {can("articles", "write") && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => togglePublish(c)} disabled={processingAction.has(c.id)}>
                      {c.isPublished ? (
                        <EyeOff className="mr-2 size-3.5" />
                      ) : (
                        <Eye className="mr-2 size-3.5" />
                      )}
                      {c.isPublished ? "Unpublish" : "Publish"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openEdit(c)}>
                      <Pencil className="mr-2 size-3.5" /> Edit article
                    </DropdownMenuItem>
                  </>
                )}
                {can("articles", "delete") && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => openDelete(c)}
                    >
                      <Trash2 className="mr-2 size-3.5" /> Delete article
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
        onRowClick={(c) => {
          navigate({ to: "/articles/$articleId", params: { articleId: c.id } });
        }}
      />
      </PermissionGuard>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="size-5 text-primary" />
              Create article
            </DialogTitle>
            <DialogDescription>
              Create a new article for your publication.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="create-title">Title *</Label>
              <Input
                id="create-title"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Article title"
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
                placeholder="Brief summary of the article"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-body">Body</Label>
              <Textarea
                id="create-body"
                value={formBody}
                onChange={(e) => setFormBody(e.target.value)}
                placeholder="Article content..."
                rows={5}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category *</Label>
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
                <Label>Author *</Label>
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
              <div className="flex flex-col gap-2 justify-end">
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
            <Button variant="outline" onClick={() => { setIsCreateOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createArticle.isPending || !formTitle.trim() || !formCategoryId || !formAuthorId}
            >
              {createArticle.isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create article"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="size-5 text-primary" />
              Edit article
            </DialogTitle>
            <DialogDescription>
              Update article details and settings.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Title *</Label>
              <Input
                id="edit-title"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Article title"
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
                placeholder="Brief summary of the article"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-body">Body</Label>
              <Textarea
                id="edit-body"
                value={formBody}
                onChange={(e) => setFormBody(e.target.value)}
                placeholder="Article content..."
                rows={5}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category *</Label>
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
                <Label>Author *</Label>
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
              <div className="flex flex-col gap-2 justify-end">
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
            <Button variant="outline" onClick={() => { setIsEditOpen(false); setEditingArticle(null); resetForm(); }}>
              Cancel
            </Button>
            <Button
              onClick={handleEdit}
              disabled={updateArticle.isPending || !formTitle.trim() || !formCategoryId || !formAuthorId}
            >
              {updateArticle.isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="size-5" />
              Delete article
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <strong>{deletingArticle?.title}</strong>? This action cannot be undone.
              {deletingArticle?.isPublished && (
                <div className="mt-2 flex items-center gap-2 rounded-lg bg-amber-500/10 p-3 text-sm text-amber-600 dark:text-amber-400">
                  <AlertCircle className="size-4 shrink-0" />
                  This article is currently published and will be removed from the site.
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setIsDeleteOpen(false); setDeletingArticle(null); }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteArticle.isPending || processingAction.has(deletingArticle?.id || "")}
            >
              {deleteArticle.isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete article"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Dialog */}
      <Dialog open={isBulkDeleteOpen} onOpenChange={setIsBulkDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="size-5" />
              Delete selected articles
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{selectedIds.length}</strong> articles? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsBulkDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleBulkDelete}>
              Delete articles
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate Dialog */}
      <Dialog open={isDuplicateOpen} onOpenChange={setIsDuplicateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Copy className="size-5 text-primary" />
              Duplicate article
            </DialogTitle>
            <DialogDescription>
              Create a copy of <strong>{duplicatingArticle?.title}</strong>? The new article will be created as a draft.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setIsDuplicateOpen(false); setDuplicatingArticle(null); }}>
              Cancel
            </Button>
            <Button onClick={handleDuplicate}>
              <Copy className="mr-2 size-4" />
              Duplicate article
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}