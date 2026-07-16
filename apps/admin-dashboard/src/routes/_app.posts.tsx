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
} from "lucide-react";
import { ListPage } from "@/components/dashboard/list-page";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  usePosts,
  useCreateArticle,
  useUpdateArticle,
  useDeleteArticle,
  type Article,
} from "@/lib/api/hooks";
import { useAuth } from "@/lib/auth/context";
import { useUsers, useCategories } from "@/lib/api/hooks";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { useState } from "react";
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

export const Route = createFileRoute("/_app/posts")({
  head: () => ({ meta: [{ title: "Posts · Vellum Admin" }] }),
  component: PostsPage,
});

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

  const [formTitle, setFormTitle] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formExcerpt, setFormExcerpt] = useState("");
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formAuthorId, setFormAuthorId] = useState("");
  const [formIsPublished, setFormIsPublished] = useState(false);
  const [formFeatured, setFormFeatured] = useState(false);
  const [formReadMinutes, setFormReadMinutes] = useState<number>(3);
  const [formCover, setFormCover] = useState("");

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

  const getEngagementTrend = (c: Article) => {
    const rate = c.views > 0 ? (c.likesCount + c.commentsCount) / c.views : 0;
    if (rate > 0.08) return { icon: TrendingUp, color: "text-emerald-500", label: "High" };
    if (rate > 0.04) return { icon: Minus, color: "text-amber-500", label: "Avg" };
    return { icon: TrendingDown, color: "text-rose-500", label: "Low" };
  };

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
        },
      }
    );
  };

  return (
    <>
      <ListPage<Article>
        title="Posts"
        description="Articles published across the platform."
        eyebrow="Content"
        rows={rows}
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
            <Button variant="outline" size="sm" className="gap-1.5">
              <span className="text-muted-foreground">◎</span>
              Category
              <span className="rotate-90 text-xs">›</span>
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5">
              <span className="text-muted-foreground">◎</span>
              Status
              <span className="rotate-90 text-xs">›</span>
            </Button>
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
              + Add filter
            </Button>
          </>
        }
        columns={[
          {
            key: "post",
            header: "Post",
            cell: (c) => (
              <div className="flex items-start gap-3 min-w-0">
                <div className="size-12 shrink-0 rounded-lg overflow-hidden bg-muted">
                  {c.cover ? (
                    <img
                      src={c.cover}
                      alt=""
                      className="size-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="size-full flex items-center justify-center text-muted-foreground/30">
                      <Eye className="size-5" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <Link
                    to="/posts/$postId"
                    params={{ postId: c.id }}
                    className="block truncate text-sm font-semibold hover:text-primary transition-colors"
                  >
                    {c.title}
                  </Link>
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
            className: "w-24  me-8",
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
          <div className="flex items-center justify-end gap-0.5 group-hover:opacity-100 transition-opacity ms-8">
            <Button variant="ghost" size="icon" className="size-8 hover:text-primary" asChild>
              <Link to="/posts/$postId" params={{ postId: c.id }}>
                <ArrowUpRight className="size-4" />
              </Link>
            </Button>
            {can("posts", "write") && (
              <Button
                variant="ghost"
                size="icon"
                className="size-8 hover:text-primary"
                onClick={() => togglePublish(c)}
                title={c.isPublished ? "Unpublish" : "Publish"}
                disabled={updateArticle.isPending}
              >
                <StatusBadge status={c.isPublished ? "published" : "draft"} size="sm" />
              </Button>
            )}
            {can("posts", "write") && (
              <Button
                variant="ghost"
                size="icon"
                className="size-8 hover:text-primary"
                onClick={() => openEdit(c)}
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
                onClick={() => openDelete(c)}
                aria-label="Delete"
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        )}
        onRowClick={(c) => {
        }}
      />

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
