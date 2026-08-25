import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Plus,
  FolderTree,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  MoreHorizontal,
  ArrowUpRight,
  GripVertical,
  Hash,
  FileText,
  Image as ImageIcon,
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useCategories, useArticles, useCreateCategory, useUpdateCategory, useDeleteCategory, Category } from "@/lib/api/hooks";
import { useAuth } from "@/lib/auth/context";
import { useState } from "react";
import { cn } from "@/lib/utils";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_app/categories")({
  head: () => ({ meta: [{ title: "Categories · Vellbase Admin" }] }),
  component: CategoriesPage,
});

function CategoriesPage() {
  const { data, isLoading, refetch } = useCategories();
  const { data: articlesData } = useArticles();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();
  const { can } = useAuth();
  const categories = data ?? [];

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({ name: "", slug: "", description: "", tint: "" });

  const CHART_COLORS = [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
  ];

  // Count articles per category
  const getArticleCount = (categoryId: string) => {
    return articlesData?.data?.filter((a) => a.categoryId === categoryId).length ?? 0;
  };

  // Generate slug from name
  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  };

  const handleCreate = () => {
    if (!formData.name || !formData.slug) return;
    createCategory.mutate(
      { name: formData.name, slug: formData.slug, tint: formData.tint },
      {
        onSuccess: () => {
          setIsCreateOpen(false);
          setFormData({ name: "", slug: "", description: "", tint: "" });
          refetch();
        },
      }
    );
  };

  const handleEdit = () => {
    if (!selectedCategory) return;
    updateCategory.mutate(
      { id: selectedCategory.id, ...formData },
      {
        onSuccess: () => {
          setIsEditOpen(false);
          setSelectedCategory(null);
          refetch();
        },
      }
    );
  };

  const handleDelete = () => {
    if (!selectedCategory) return;
    deleteCategory.mutate(selectedCategory.id, {
      onSuccess: () => {
        setIsDeleteOpen(false);
        setSelectedCategory(null);
        refetch();
      },
    });
  };

  const openEdit = (category: Category) => {
    setSelectedCategory(category);
    setFormData({
      name: category.name,
      slug: category.slug,
      description: category.description ?? "",
      tint: category.tint ?? "",
    });
    setIsEditOpen(true);
  };

  const openDelete = (category: Category) => {
    setSelectedCategory(category);
    setIsDeleteOpen(true);
  };

  const getTintColor = (category: Category, index: number) => {
    return category.tint || CHART_COLORS[index % CHART_COLORS.length];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        eyebrow="Content"
        title="Categories"
        description="Top-level content taxonomy shown across web and mobile."
        actions={
          can("categories", "write") ? (
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5">
                  <Plus className="size-4" /> New category
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Create category</DialogTitle>
                  <DialogDescription>
                    Add a new top-level category for organizing content.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      placeholder="e.g. Culture"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          name: e.target.value,
                          slug: generateSlug(e.target.value),
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="slug">Slug</Label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="slug"
                        className="pl-9"
                        value={formData.slug}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, slug: e.target.value }))
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      placeholder="Brief description of this category..."
                      value={formData.description}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, description: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tint">Color tint</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="tint"
                        type="color"
                        className="w-16 h-9 p-1"
                        value={formData.tint || "#d4653a"}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, tint: e.target.value }))
                        }
                      />
                      <Input
                        className="flex-1"
                        value={formData.tint}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, tint: e.target.value }))
                        }
                        placeholder="#d4653a"
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreate}
                    disabled={createCategory.isPending || !formData.name || !formData.slug}
                  >
                    {createCategory.isPending ? "Creating..." : "Create category"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : null
        }
      />

      {/* Stats Overview */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SectionCard className="flex items-center gap-4">
          <div className="grid size-10 shrink-0 place-items-center rounded-md bg-primary/10">
            <FolderTree className="size-5 text-primary" />
          </div>
          <div>
            <div className="text-2xl font-semibold">{categories.length}</div>
            <div className="text-xs text-muted-foreground">Total categories</div>
          </div>
        </SectionCard>
        <SectionCard className="flex items-center gap-4">
          <div className="grid size-10 shrink-0 place-items-center rounded-md bg-emerald-500/10">
            <Eye className="size-5 text-emerald-500" />
          </div>
          <div>
            <div className="text-2xl font-semibold">
              {categories.filter((c) => c.isVisible !== false).length}
            </div>
            <div className="text-xs text-muted-foreground">Visible</div>
          </div>
        </SectionCard>
        <SectionCard className="flex items-center gap-4">
          <div className="grid size-10 shrink-0 place-items-center rounded-md bg-amber-500/10">
            <EyeOff className="size-5 text-amber-500" />
          </div>
          <div>
            <div className="text-2xl font-semibold">
              {categories.filter((c) => c.isVisible === false).length}
            </div>
            <div className="text-xs text-muted-foreground">Hidden</div>
          </div>
        </SectionCard>
        <SectionCard className="flex items-center gap-4">
          <div className="grid size-10 shrink-0 place-items-center rounded-md bg-sky-500/10">
            <FileText className="size-5 text-sky-500" />
          </div>
          <div>
            <div className="text-2xl font-semibold">
              {articlesData?.data?.length ?? 0}
            </div>
            <div className="text-xs text-muted-foreground">Total articles</div>
          </div>
        </SectionCard>
      </div>

      {/* Categories Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            All categories
          </h3>
          <span className="text-xs text-muted-foreground">
            {categories.length} categories
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {isLoading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <SectionCard key={i} className="animate-pulse">
                <div className="flex items-start gap-3">
                  <div className="grid size-10 shrink-0 place-items-center rounded-md bg-muted">
                    <FolderTree className="size-5 opacity-50" />
                  </div>
                  <div className="min-w-0 space-y-2">
                    <div className="h-4 w-24 bg-muted rounded" />
                    <div className="h-3 w-16 bg-muted rounded" />
                  </div>
                </div>
              </SectionCard>
            ))
          ) : categories.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
              <FolderTree className="size-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-medium">No categories yet</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Create your first category to start organizing content.
              </p>
              <Button
                size="sm"
                className="mt-4 gap-1.5"
                onClick={() => setIsCreateOpen(true)}
              >
                <Plus className="size-4" /> New category
              </Button>
            </div>
          ) : (
            categories.map((c, i) => {
              const tint = getTintColor(c, i);
              const articleCount = getArticleCount(c.id);
              const isVisible = c.isVisible !== false;

              return (
                <SectionCard
                  key={c.id}
                  className="group relative hover:shadow-md transition-shadow"
                >
                  {/* Drag handle */}
                  <div className="absolute top-2 right-2 opacity-100 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="size-6 cursor-grab">
                      <GripVertical className="size-3 text-muted-foreground" />
                    </Button>
                  </div>

                  {/* Main content */}
                  <div className="flex items-start gap-3">
                    <div
                      className="grid size-10 shrink-0 place-items-center rounded-md"
                      style={{
                        background: `color-mix(in oklab, ${tint} 15%, transparent)`,
                      }}
                    >
                      <FolderTree
                        className="size-5"
                        style={{ color: tint }}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold truncate">{c.name}</span>
                        {!isVisible && (
                          <Badge variant="outline" className="text-[10px] h-4 px-1">
                            Hidden
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono truncate">
                        {c.slug}
                      </div>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <FileText className="size-3" />
                      {articleCount} articles
                    </span>
                    {c.description && (
                      <span className="truncate">{c.description.slice(0, 40)}...</span>
                    )}
                  </div>

                  {/* Actions footer */}
                  <div className="mt-4 flex items-center justify-between pt-3 border-t">
                    <Badge
                      variant={isVisible ? "default" : "secondary"}
                      className={cn(
                        "text-[10px] h-5",
                        isVisible && "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400"
                      )}
                    >
                      {isVisible ? "Visible" : "Hidden"}
                    </Badge>

                    <div className="flex items-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 hover:text-primary"
                        asChild
                      >
                        <Link to="/categories/$categoryId" params={{ categoryId: c.id }}>
                          <ArrowUpRight className="size-3.5" />
                        </Link>
                      </Button>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-7">
                            <MoreHorizontal className="size-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem onClick={() => openEdit(c)}>
                            <Pencil className="size-3.5 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link
                              to="/categories/$categoryId"
                              params={{ categoryId: c.id }}
                            >
                              <Eye className="size-3.5 mr-2" />
                              View
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => openDelete(c)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="size-3.5 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </SectionCard>
              );
            })
          )}
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit category</DialogTitle>
            <DialogDescription>Update category details and visibility.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-slug">Slug</Label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="edit-slug"
                  className="pl-9"
                  value={formData.slug}
                  onChange={(e) => setFormData((prev) => ({ ...prev, slug: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-tint">Color tint</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="edit-tint"
                  type="color"
                  className="w-16 h-9 p-1"
                  value={formData.tint || "#d4653a"}
                  onChange={(e) => setFormData((prev) => ({ ...prev, tint: e.target.value }))}
                />
                <Input
                  className="flex-1"
                  value={formData.tint}
                  onChange={(e) => setFormData((prev) => ({ ...prev, tint: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleEdit}
              disabled={updateCategory.isPending}
            >
              {updateCategory.isPending ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete category</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{selectedCategory?.name}</strong>?
              This will not delete associated articles, but they will become uncategorized.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteCategory.isPending}
            >
              <Trash2 className="size-4 mr-2" />
              {deleteCategory.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Type definition (should be in your types file)
