import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Plus,
  Hash,
  X,
  TrendingUp,
  Search,
  ArrowUpRight,
  Pencil,
  Copy,
  Check,
  TagIcon,
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useTags, useCreateTag, useDeleteTag, useUpdateTag, type Tag } from "@/lib/api/hooks";
import { useArticles } from "@/lib/api/hooks";
import { ChartSkeleton } from "@/components/dashboard/skeletons";
import { useState, useMemo } from "react";
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
import { useAuth } from "@/lib/auth/context";

export const Route = createFileRoute("/_app/tags")({
  head: () => ({ meta: [{ title: "Tags · Vellum Admin" }] }),
  component: TagsPage,
});

function TagsPage() {
  const { data, isLoading, refetch } = useTags();
  const { data: articlesData } = useArticles();
  const createTag = useCreateTag();
  const deleteTag = useDeleteTag();
  const updateTag = useUpdateTag();
  const { can } = useAuth();

  const tags = data ?? [];
  const [name, setName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [editName, setEditName] = useState("");
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deletingTag, setDeletingTag] = useState<Tag | null>(null);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  // Filter tags by search
  const filteredTags = useMemo(() => {
    if (!searchQuery.trim()) return tags;
    const q = searchQuery.toLowerCase();
    return tags.filter((t) => t.name.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q));
  }, [tags, searchQuery]);

  // Count articles per tag
  const getArticleCount = (tagId: string) => {
    return articlesData?.data?.filter((a) => a.tagIds?.includes(tagId)).length ?? 0;
  };

  // Get trending tags (most used)
  const trendingTags = useMemo(() => {
    return [...tags]
      .map((t) => ({ ...t, count: getArticleCount(t.id) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [tags, articlesData]);

  const handleCreate = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const slug = trimmed.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    createTag.mutate(
      { name: trimmed, slug },
      {
        onSuccess: () => {
          setName("");
          refetch();
        },
      }
    );
  };

  const openEdit = (tag: Tag) => {
    setEditingTag(tag);
    setEditName(tag.name);
    setIsEditOpen(true);
  };

  const handleEdit = () => {
    if (!editingTag || !editName.trim()) return;
    const newSlug = editName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    updateTag.mutate(
      { id: editingTag.id, name: editName.trim(), slug: newSlug },
      {
        onSuccess: () => {
          setIsEditOpen(false);
          setEditingTag(null);
          setEditName("");
          refetch();
        },
      }
    );
  };

  const openDelete = (tag: Tag) => {
    setDeletingTag(tag);
    setIsDeleteOpen(true);
  };

  const handleDelete = () => {
    if (!deletingTag) return;
    deleteTag.mutate(deletingTag.id, {
      onSuccess: () => {
        setIsDeleteOpen(false);
        setDeletingTag(null);
        refetch();
      },
    });
  };

  const copySlug = (slug: string) => {
    navigator.clipboard.writeText(slug);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        eyebrow="Content"
        title="Tags"
        description="Free-form labels used to describe and discover content."
        actions={
          can("tags", "write") ? (
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5">
                  <Plus className="size-4" /> New tag
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Create tag</DialogTitle>
                  <DialogDescription>
                    Add a new label for organizing and discovering content.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="dialog-name">Tag name</Label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="dialog-name"
                        className="pl-9"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                        placeholder="e.g. minimalism"
                        autoFocus
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Slug will be auto-generated:{" "}
                      <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">
                        {name.trim()
                          ? name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
                          : "..."}
                      </code>
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setName("")}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreate}
                    disabled={createTag.isPending || !name.trim()}
                  >
                    {createTag.isPending ? "Creating..." : "Create tag"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : null
        }
      />

      {/* Stats Overview */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SectionCard>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground">Total tags</div>
              <div className="text-2xl font-semibold">{tags.length}</div>
            </div>
            <div className="grid size-10 shrink-0 place-items-center rounded-md bg-primary/10">
              <TagIcon className="size-5 text-primary" />
            </div>
          </div>
        </SectionCard>
        <SectionCard>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground">Top tag</div>
              <div className="text-2xl font-semibold truncate max-w-[120px]">
                {trendingTags[0]?.name ?? "—"}
              </div>
            </div>
            <div className="grid size-10 shrink-0 place-items-center rounded-md bg-emerald-500/10">
              <TrendingUp className="size-5 text-emerald-500" />
            </div>
          </div>
        </SectionCard>
        <SectionCard>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground">Total tag uses</div>
              <div className="text-2xl font-semibold">
                {articlesData?.data?.reduce((acc, a) => acc + (a.tagIds?.length ?? 0), 0) ?? 0}
              </div>
            </div>
            <div className="grid size-10 shrink-0 place-items-center rounded-md bg-sky-500/10">
              <Hash className="size-5 text-sky-500" />
            </div>
          </div>
        </SectionCard>
        <SectionCard>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground">Unused tags</div>
              <div className="text-2xl font-semibold">
                {tags.filter((t) => getArticleCount(t.id) === 0).length}
              </div>
            </div>
            <div className="grid size-10 shrink-0 place-items-center rounded-md bg-amber-500/10">
              <TagIcon className="size-5 text-amber-500" />
            </div>
          </div>
        </SectionCard>
      </div>

      {/* Quick Create */}
      {can("tags", "write") && (
        <SectionCard>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Label className="mb-1.5 block text-xs">Tag name</Label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  placeholder="e.g. minimalism"
                  className="pl-9"
                />
              </div>
            </div>
            <Button
              onClick={handleCreate}
              disabled={createTag.isPending || !name.trim()}
            >
              {createTag.isPending ? "Adding..." : "Add tag"}
            </Button>
          </div>
        </SectionCard>
      )}

      {/* Trending Tags */}
      {trendingTags.length > 0 && (
        <SectionCard>
          <div className="mb-3 text-sm font-medium">Trending</div>
          <div className="flex flex-wrap gap-2">
            {trendingTags.map((t, i) => (
              <Link
                key={t.id}
                to="/tags/$tagId"
                params={{ tagId: t.id }}
                className="group inline-flex items-center gap-2 rounded-full border bg-background px-4 py-2 text-sm hover:border-primary/50 hover:bg-primary/5 transition-colors"
              >
                <span
                  className={cn(
                    "flex size-5 items-center justify-center rounded-full text-[10px] font-bold",
                    i === 0
                      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                      : i === 1
                        ? "bg-slate-500/10 text-slate-600 dark:text-slate-400"
                        : i === 2
                          ? "bg-orange-700/10 text-orange-700 dark:text-orange-400"
                          : "bg-muted text-muted-foreground"
                  )}
                >
                  {i + 1}
                </span>
                <span className="font-medium">{t.name}</span>
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                  {t.count}
                </Badge>
                <ArrowUpRight className="size-3 opacity-100 group-hover:opacity-100 transition-opacity text-muted-foreground" />
              </Link>
            ))}
          </div>
        </SectionCard>
      )}

      {/* All Tags */}
      <SectionCard>
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-medium">All tags</div>
          <div className="relative w-48">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tags..."
              className="h-8 pl-8 text-xs"
            />
          </div>
        </div>

        {isLoading ? (
          <ChartSkeleton height={120} />
        ) : filteredTags.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Hash className="size-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">
              {searchQuery ? "No tags match your search." : "No tags yet. Create one to get started."}
            </p>
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => setSearchQuery("")}
              >
                Clear search
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {filteredTags.map((t) => {
              const articleCount = getArticleCount(t.id);
              const isUnused = articleCount === 0;

              return (
                <div
                  key={t.id}
                  className={cn(
                    "group inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-all",
                    isUnused
                      ? "bg-muted/30 border-muted text-muted-foreground hover:bg-muted/50"
                      : "bg-background border-border hover:border-primary/50 hover:bg-primary/5"
                  )}
                >
                  <Hash
                    className={cn(
                      "size-3.5",
                      isUnused ? "text-muted-foreground/50" : "text-primary/60"
                    )}
                  />
                  <Link
                    to="/tags/$tagId"
                    params={{ tagId: t.id }}
                    className="font-medium hover:underline underline-offset-2"
                  >
                    {t.name}
                  </Link>

                  {/* Article count badge */}
                  {articleCount > 0 && (
                    <Badge variant="secondary" className="text-[10px] h-4 px-1 ml-0.5">
                      {articleCount}
                    </Badge>
                  )}

                  {/* Unused indicator */}
                  {isUnused && (
                    <span className="text-[10px] text-muted-foreground/60">unused</span>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-0.5 ml-1 opacity-100 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-5 hover:text-primary"
                      onClick={() => copySlug(t.slug)}
                      title="Copy slug"
                    >
                      {copiedSlug === t.slug ? (
                        <Check className="size-3 text-emerald-500" />
                      ) : (
                        <Copy className="size-3" />
                      )}
                    </Button>

                    {can("tags", "write") && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-5 hover:text-primary"
                        onClick={() => openEdit(t)}
                        title="Edit"
                      >
                        <Pencil className="size-3" />
                      </Button>
                    )}

                    {can("tags", "delete") && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-5 hover:text-destructive"
                        onClick={() => openDelete(t)}
                        title="Delete"
                      >
                        <X className="size-3" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Results count */}
        {filteredTags.length > 0 && (
          <div className="mt-4 pt-3 border-t text-xs text-muted-foreground">
            Showing {filteredTags.length} of {tags.length} tags
            {searchQuery && ` matching "${searchQuery}"`}
          </div>
        )}
      </SectionCard>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit tag</DialogTitle>
            <DialogDescription>Update the tag name and slug.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Tag name</Label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="edit-name"
                  className="pl-9"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleEdit()}
                  autoFocus
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Slug will be updated to:{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">
                  {editName.trim()
                    ? editName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
                    : editingTag?.slug}
                </code>
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleEdit}
              disabled={updateTag.isPending || !editName.trim()}
            >
              {updateTag.isPending ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete tag</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <strong>{deletingTag?.name}</strong>? This will remove the tag from all
              associated articles.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteTag.isPending}
            >
              {deleteTag.isPending ? "Deleting..." : "Delete tag"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}