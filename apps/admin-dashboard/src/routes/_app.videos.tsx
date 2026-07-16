import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Upload,
  Play,
  Eye,
  Heart,
  Share2,
  Clock,
  MoreHorizontal,
  Pencil,
  Trash2,
  ArrowUpRight,
  Film,
} from "lucide-react";
import { ListPage } from "@/components/dashboard/list-page";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  useVideos,
  useCreateHighlight,
  useUpdateHighlight,
  useDeleteHighlight,
  type Highlight,
} from "@/lib/api/hooks";
import { useAuth } from "@/lib/auth/context";
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
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_app/videos")({
  head: () => ({ meta: [{ title: "Videos · Vellum Admin" }] }),
  component: VideosPage,
});

function VideosPage() {
  const { data, isLoading, error, refetch } = useVideos({ pageSize: 50 });
  const createHighlight = useCreateHighlight();
  const updateHighlight = useUpdateHighlight();
  const deleteHighlight = useDeleteHighlight();
  const { can } = useAuth();
  const rows = data?.data ?? [];

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingVideo, setEditingVideo] = useState<Highlight | null>(null);
  const [deletingVideo, setDeletingVideo] = useState<Highlight | null>(null);

  const [formTitle, setFormTitle] = useState("");
  const [formHandle, setFormHandle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formVideoUrl, setFormVideoUrl] = useState("");
  const [formThumbnailUrl, setFormThumbnailUrl] = useState("");
  const [formCover, setFormCover] = useState("");
  const [formDurationStr, setFormDurationStr] = useState("");
  const [formIsPublished, setFormIsPublished] = useState(false);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const resetCreateForm = () => {
    setFormTitle("");
    setFormHandle("");
    setFormDescription("");
    setFormVideoUrl("");
    setFormThumbnailUrl("");
    setFormCover("");
    setFormDurationStr("");
    setFormIsPublished(false);
  };

  const handleCreate = () => {
    if (!formTitle.trim() || !formHandle.trim()) return;
    createHighlight.mutate(
      {
        title: formTitle.trim(),
        handle: formHandle.trim(),
        description: formDescription.trim() || null,
        videoUrl: formVideoUrl.trim() || null,
        thumbnailUrl: formThumbnailUrl.trim() || null,
        cover: formCover.trim() || null,
        duration: formDurationStr ? parseInt(formDurationStr, 10) : null,
        isPublished: formIsPublished,
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

  const openEdit = (video: Highlight) => {
    setEditingVideo(video);
    setFormTitle(video.title);
    setFormHandle(video.handle);
    setFormDescription(video.description || "");
    setFormVideoUrl(video.videoUrl || "");
    setFormThumbnailUrl(video.thumbnailUrl || "");
    setFormCover(video.cover || "");
    setFormDurationStr(video.duration?.toString() || "");
    setFormIsPublished(video.isPublished);
    setIsEditOpen(true);
  };

  const handleEdit = () => {
    if (!editingVideo || !formTitle.trim() || !formHandle.trim()) return;
    updateHighlight.mutate(
      {
        id: editingVideo.id,
        title: formTitle.trim(),
        handle: formHandle.trim(),
        description: formDescription.trim() || null,
        videoUrl: formVideoUrl.trim() || null,
        thumbnailUrl: formThumbnailUrl.trim() || null,
        cover: formCover.trim() || null,
        duration: formDurationStr ? parseInt(formDurationStr, 10) : null,
        isPublished: formIsPublished,
      },
      {
        onSuccess: () => {
          setIsEditOpen(false);
          setEditingVideo(null);
          resetCreateForm();
          refetch();
        },
      }
    );
  };

  const openDelete = (video: Highlight) => {
    setDeletingVideo(video);
    setIsDeleteOpen(true);
  };

  const handleDelete = () => {
    if (!deletingVideo) return;
    deleteHighlight.mutate(deletingVideo.id, {
      onSuccess: () => {
        setIsDeleteOpen(false);
        setDeletingVideo(null);
        refetch();
      },
    });
  };

  const togglePublish = (video: Highlight) => {
    updateHighlight.mutate(
      {
        id: video.id,
        isPublished: !video.isPublished,
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
      <ListPage<Highlight>
        title="Videos"
        description="Highlight videos uploaded across the platform."
        eyebrow="Content"
        rows={rows}
        isLoading={isLoading}
        error={error}
        searchKeys={["title", "handle", "description"]}
        pageSize={15}
        enableSelection={true}
        enableExport={true}
        enablePagination={true}
        actions={
          can("videos", "write") ? (
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5">
                  <Upload className="size-4" /> Upload
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Upload video</DialogTitle>
                  <DialogDescription>
                    Add a new short-form video highlight.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="create-title">Title</Label>
                    <Input
                      id="create-title"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      placeholder="e.g. Amazing sunset timelapse"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="create-handle">Handle</Label>
                    <Input
                      id="create-handle"
                      value={formHandle}
                      onChange={(e) => setFormHandle(e.target.value)}
                      placeholder="e.g. amazing-sunset"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="create-description">Description</Label>
                    <Textarea
                      id="create-description"
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      placeholder="Brief description of the video..."
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="create-video-url">Video URL</Label>
                    <Input
                      id="create-video-url"
                      value={formVideoUrl}
                      onChange={(e) => setFormVideoUrl(e.target.value)}
                      placeholder="https://..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="create-thumbnail-url">Thumbnail URL</Label>
                    <Input
                      id="create-thumbnail-url"
                      value={formThumbnailUrl}
                      onChange={(e) => setFormThumbnailUrl(e.target.value)}
                      placeholder="https://..."
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
                  <div className="space-y-2">
                    <Label htmlFor="create-duration">Duration (seconds)</Label>
                    <Input
                      id="create-duration"
                      type="number"
                      value={formDurationStr}
                      onChange={(e) => setFormDurationStr(e.target.value)}
                      placeholder="15"
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <Label htmlFor="create-published">Published</Label>
                      <p className="text-xs text-muted-foreground">
                        Make this video visible to users
                      </p>
                    </div>
                    <Switch
                      id="create-published"
                      checked={formIsPublished}
                      onCheckedChange={setFormIsPublished}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsCreateOpen(false);
                      resetCreateForm();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreate}
                    disabled={createHighlight.isPending || !formTitle.trim() || !formHandle.trim()}
                  >
                    {createHighlight.isPending ? "Uploading..." : "Upload video"}
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
              Status
              <span className="rotate-90 text-xs">›</span>
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5">
              <span className="text-muted-foreground">◎</span>
              Duration
              <span className="rotate-90 text-xs">›</span>
            </Button>
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
              + Add filter
            </Button>
          </>
        }
        columns={[
          {
            key: "video",
            header: "Video",
            cell: (c) => (
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative size-16 shrink-0 rounded-lg overflow-hidden bg-muted group/video">
                  {c.thumbnailUrl ? (
                    <img
                      src={c.thumbnailUrl}
                      alt=""
                      className="size-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="size-full flex items-center justify-center bg-muted">
                      <Film className="size-5 text-muted-foreground/30" />
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-100 group-hover/video:opacity-100 transition-opacity">
                    <div className="size-7 rounded-full bg-white/90 flex items-center justify-center">
                      <Play className="size-3.5 text-foreground fill-foreground ml-0.5" />
                    </div>
                  </div>
                  {c.duration && (
                    <div className="absolute bottom-1 right-1 px-1 py-0.5 rounded bg-black/60 text-[10px] font-medium text-white">
                      {formatDuration(c.duration)}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <Link
                    to="/videos/$videoId"
                    params={{ videoId: c.id }}
                    className="block truncate text-sm font-semibold hover:text-primary transition-colors"
                  >
                    {c.title}
                  </Link>
                  <div className="mt-1 flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground">
                      @{c.handle}
                    </span>
                    {c.isPublished && (
                      <>
                        <span className="text-muted-foreground/40">·</span>
                        <Badge
                          variant="outline"
                          className="text-[10px] font-medium px-1.5 py-0 h-4 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                        >
                          Live
                        </Badge>
                      </>
                    )}
                    <span className="text-muted-foreground/40">·</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              </div>
            ),
          },
          {
            key: "author",
            header: "Author",
            cell: (c) => (
              <div className="flex items-center gap-2">
                <Avatar className="size-7">
                  <AvatarImage src={c.author?.avatar ?? ""} alt={c.author?.name} />
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                    {c.author?.name?.split(" ").map((w) => w[0]).join("").toUpperCase() ?? c.handle[0]?.toUpperCase() ?? "?"}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm">{c.author?.name ?? c.handle}</span>
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
            cell: (c) => (
              <div className="flex items-center gap-4">
                <span className="inline-flex items-center gap-1.5 text-sm" title="Views">
                  <Eye className="size-3.5 text-muted-foreground/50" />
                  <span className="tabular-nums font-medium">{c.viewsCount?.toLocaleString() ?? "0"}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 text-sm" title="Likes">
                  <Heart className="size-3.5 text-rose-500/60" />
                  <span className="tabular-nums font-medium">{c.likesCount?.toLocaleString() ?? "0"}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 text-sm" title="Shares">
                  <Share2 className="size-3.5 text-sky-500/60" />
                  <span className="tabular-nums font-medium">{c.shares?.toLocaleString() ?? "0"}</span>
                </span>
              </div>
            ),
            className: "hidden md:table-cell",
          },
          {
            key: "performance",
            header: "Performance",
            cell: (c) => {
              const engagementRate = c.viewsCount > 0
                ? (((c.likesCount + c.shares) / c.viewsCount) * 100).toFixed(1)
                : "0.0";
              const isHigh = parseFloat(engagementRate) > 5;
              return (
                <div className="text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <span className="text-sm font-semibold tabular-nums">{engagementRate}%</span>
                    <span className={cn(
                      "text-[10px] font-medium",
                      isHigh ? "text-emerald-500" : "text-muted-foreground"
                    )}>
                      {isHigh ? "High" : "Avg"}
                    </span>
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
          <div className="flex items-center justify-end gap-0.5 opacity-100 ms-8 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="icon" className="size-8 hover:text-primary" asChild>
              <Link to="/videos/$videoId" params={{ videoId: c.id }}>
                <ArrowUpRight className="size-4" />
              </Link>
            </Button>
            {can("videos", "write") && (
              <Button
                variant="ghost"
                size="icon"
                className="size-8 hover:text-primary"
                onClick={() => togglePublish(c)}
                title={c.isPublished ? "Unpublish" : "Publish"}
                disabled={updateHighlight.isPending}
              >
                <StatusBadge status={c.isPublished ? "published" : "draft"} size="sm" />
              </Button>
            )}
            {can("videos", "write") && (
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
            {can("videos", "delete") && (
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
            <DialogTitle>Edit video</DialogTitle>
            <DialogDescription>
              Update the video details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-handle">Handle</Label>
              <Input
                id="edit-handle"
                value={formHandle}
                onChange={(e) => setFormHandle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-video-url">Video URL</Label>
              <Input
                id="edit-video-url"
                value={formVideoUrl}
                onChange={(e) => setFormVideoUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-thumbnail-url">Thumbnail URL</Label>
              <Input
                id="edit-thumbnail-url"
                value={formThumbnailUrl}
                onChange={(e) => setFormThumbnailUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-cover">Cover URL</Label>
              <Input
                id="edit-cover"
                value={formCover}
                onChange={(e) => setFormCover(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-duration">Duration (seconds)</Label>
              <Input
                id="edit-duration"
                type="number"
                value={formDurationStr}
                onChange={(e) => setFormDurationStr(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="edit-published">Published</Label>
                <p className="text-xs text-muted-foreground">
                  Make this video visible to users
                </p>
              </div>
              <Switch
                id="edit-published"
                checked={formIsPublished}
                onCheckedChange={setFormIsPublished}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditOpen(false);
                setEditingVideo(null);
                resetCreateForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleEdit}
              disabled={updateHighlight.isPending || !formTitle.trim() || !formHandle.trim()}
            >
              {updateHighlight.isPending ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete video</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <strong>{deletingVideo?.title}</strong>? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteHighlight.isPending}
            >
              {deleteHighlight.isPending ? "Deleting..." : "Delete video"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
