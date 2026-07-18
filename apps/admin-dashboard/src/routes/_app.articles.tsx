// routes/_app/articles/index.tsx
import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Pencil, Eye, ArrowUpRight, Trash2 } from "lucide-react";
import { ListPage } from "@/components/dashboard/list-page";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { format } from "date-fns";
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

export const Route = createFileRoute("/_app/articles")({
  head: () => ({ meta: [{ title: "Articles · Vellum Admin" }] }),
  component: ArticlesPage,
});

function ArticlesPage() {
  const { data, isLoading, refetch } = useArticles();
  const { data: categories } = useCategories();
  const { data: users } = useUsers();
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

  const getCategoryName = (categoryId: string) => {
    return categories?.find((c) => c.id === categoryId)?.name ?? "Unknown";
  };

  const getCategoryColor = (categoryId: string) => {
    const colors: Record<string, string> = {
      culture: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
      design: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
      environment: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      music: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
      architecture: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
      technology: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
    };
    return colors[categoryId?.toLowerCase()] ?? "bg-muted text-muted-foreground";
  };

  const getAuthorName = (authorId: string) => {
    return users?.data?.find((u) => u.id === authorId)?.name ?? "Unknown";
  };

  const getAuthorInitials = (authorId: string) => {
    const name = getAuthorName(authorId);
    return name.split(" ").map((w) => w[0]).join("").toUpperCase();
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
      <ListPage
        title="Articles"
        description="Long-form written content across all authors."
        eyebrow="Content"
        rows={rows}
        searchKeys={["title", "excerpt"]}
        pageSize={15}
        isLoading={isLoading}
        enableSelection={true}
        enableExport={true}
        enablePagination={true}
        actions={
          can("articles", "write") ? (
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5">
                  <Plus className="size-4" /> New article
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create article</DialogTitle>
                  <DialogDescription>
                    Create a new article for your publication.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="create-title">Title</Label>
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
                    {createArticle.isPending ? "Creating..." : "Create article"}
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
            key: "title",
            header: "Title",
            cell: (c) => (
              <Link
                to="/articles/$articleId"
                params={{ articleId: c.id }}
                className="group flex items-start gap-3 hover:opacity-80 transition-opacity"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium group-hover:text-primary transition-colors">
                    {c.title}
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
                    <AvatarFallback className="bg-secondary text-secondary-foreground text-xs font-medium">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm">{authorName}</span>
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
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Eye className="size-3.5" />
                  {c.views.toLocaleString()}
                </span>
                <span className="flex items-center gap-1 text-muted-foreground">
                  <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  {c.likesCount.toLocaleString()}
                </span>
              </div>
            ),
          },
          {
            key: "updated",
            header: "Updated",
            cell: (c) => (
              <span className="text-xs text-muted-foreground">
                {format(new Date(c.updatedAt), "MMM d, yyyy")}
              </span>
            ),
          },
        ]}
        renderRowActions={(c) => (
          <div className="flex items-center justify-end gap-1">
            <Button variant="ghost" size="icon" className="size-8 hover:text-primary" asChild>
              <Link to="/articles/$articleId" params={{ articleId: c.id }}>
                <ArrowUpRight className="size-4" />
              </Link>
            </Button>
            {can("articles", "write") && (
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
            {can("articles", "write") && (
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
            {can("articles", "delete") && (
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
          // Optional: Navigate to article detail
          // router.navigate({ to: "/articles/$articleId", params: { articleId: c.id } });
        }}
      />

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit article</DialogTitle>
            <DialogDescription>
              Update article details and settings.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Title</Label>
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete article</DialogTitle>
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
              {deleteArticle.isPending ? "Deleting..." : "Delete article"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
