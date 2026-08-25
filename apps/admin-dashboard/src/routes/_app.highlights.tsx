import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useCallback } from "react";
import {
  Play,
  Heart,
  Eye,
  Sparkles,
  Upload,
  X,
  Volume2,
  VolumeX,
  Maximize,
  Pause,
  MoreHorizontal,
  Flag,
  Pencil,
  Trash2,
  Share2,
  Clock,
  TrendingUp,
  Plus,
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { AreaSpark } from "@/components/dashboard/charts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth/context";
import {
  useHighlights,
  useUsers,
  useDashboardStats,
  useAnalyticsTimeseries,
  useCreateHighlight,
  useUpdateHighlight,
  useDeleteHighlight,
  type Highlight,
} from "@/lib/api/hooks";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/highlights")({
  head: () => ({ meta: [{ title: "Highlights · Vellbase Admin" }] }),
  component: HighlightsPage,
});

function VideoPlayerModal({
  highlight,
  isOpen,
  onClose,
  authorName,
}: {
  highlight: Highlight | null;
  isOpen: boolean;
  onClose: () => void;
  authorName: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const toggleMute = useCallback(() => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  }, [isMuted]);

  const handleTimeUpdate = useCallback(() => {
    if (!videoRef.current) return;
    const { currentTime: ct, duration } = videoRef.current;
    setCurrentTime(ct);
    setProgress(duration ? (ct / duration) * 100 : 0);
  }, []);

  const handleSeek = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!videoRef.current) return;
      const newTime = (parseFloat(e.target.value) / 100) * (videoRef.current.duration || 0);
      videoRef.current.currentTime = newTime;
      setProgress(parseFloat(e.target.value));
    },
    []
  );

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (!highlight) return null;

  const canPlay = !!highlight.videoUrl;
  const duration = highlight.duration || 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()} >
      <DialogContent className="max-w-md overflow-hidden border-0 bg-black p-0 shadow-2xl [&>button]:hidden ">
        {/* Video Container */}
        <div className="relative aspect-[4/5] bg-black">
          {canPlay ? (
            <video
              ref={videoRef}
              src={highlight.videoUrl!}
              className="h-full w-full object-cover"
              playsInline
              loop
              muted={isMuted}
              onTimeUpdate={handleTimeUpdate}
              onEnded={() => setIsPlaying(false)}
              poster={highlight.thumbnailUrl || undefined}
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-gradient-to-br from-muted/20 to-muted/40">
              <div className="grid size-16 place-items-center rounded-full bg-white/10 backdrop-blur-sm">
                <Play className="size-8 text-white/60" />
              </div>
              <p className="text-sm text-white/60">Video not available</p>
            </div>
          )}

          {/* Top overlay */}
          <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4 bg-gradient-to-b from-black/60 to-transparent">
            <DialogHeader className="space-y-0">
              <DialogTitle className="text-sm font-medium text-white">
                {highlight.title}
              </DialogTitle>
            </DialogHeader>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-white hover:bg-white/20"
              onClick={onClose}
            >
              <X className="size-5" />
            </Button>
          </div>

          {/* Play/Pause overlay (click to toggle) */}
          {canPlay && (
            <div
              className="absolute inset-0 cursor-pointer"
              onClick={togglePlay}
            />
          )}

          {/* Center play button when paused */}
          {canPlay && !isPlaying && (
            <div className="absolute inset-0 grid place-items-center pointer-events-none">
              <div className="grid size-16 place-items-center rounded-full bg-black/40 backdrop-blur-sm">
                <Play className="size-7 fill-white text-white" />
              </div>
            </div>
          )}

          {/* Bottom controls */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4">
            {/* Progress bar */}
            <div className="mb-3">
              <input
                type="range"
                min={0}
                max={100}
                value={progress}
                onChange={handleSeek}
                className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/30 accent-white"
                style={{
                  background: `linear-gradient(to right, white ${progress}%, rgba(255,255,255,0.3) ${progress}%)`,
                }}
              />
              <div className="mt-1 flex justify-between text-[11px] text-white/70">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Control buttons */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-white hover:bg-white/20"
                  onClick={togglePlay}
                >
                  {isPlaying ? (
                    <Pause className="size-5 fill-current" />
                  ) : (
                    <Play className="size-5 fill-current" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-white hover:bg-white/20"
                  onClick={toggleMute}
                >
                  {isMuted ? (
                    <VolumeX className="size-5" />
                  ) : (
                    <Volume2 className="size-5" />
                  )}
                </Button>
              </div>

              <div className="flex items-center gap-3 text-xs text-white/80">
                <span className="flex items-center gap-1">
                  <Eye className="size-3.5" />
                  {highlight?.viewsCount?.toLocaleString() || "0"}
                </span>
                <span className="flex items-center gap-1">
                  <Heart className="size-3.5" />
                  {highlight?.likesCount?.toLocaleString() || "0"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Info section below video */}
        <div className="bg-background p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold">{highlight.title}</h3>
              <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                <Avatar className="size-5">
                  <AvatarFallback className="text-[10px]">
                    {authorName[0]}
                  </AvatarFallback>
                </Avatar>
                <span>{authorName}</span>
                <span>·</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="size-8">
                <Heart className="size-4" />
              </Button>
              <Button variant="ghost" size="icon" className="size-8">
                <Share2 className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function HighlightsPage() {
  const { data, isLoading, refetch } = useHighlights({ pageSize: 12 });
  const { data: users } = useUsers();
  const { data: stats } = useDashboardStats();
  const { data: timeseries } = useAnalyticsTimeseries(30);
  const { can } = useAuth();

  const createHighlight = useCreateHighlight();
  const updateHighlight = useUpdateHighlight();
  const deleteHighlight = useDeleteHighlight();

  const [selectedHighlight, setSelectedHighlight] = useState<Highlight | null>(
    null
  );
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingHighlight, setEditingHighlight] = useState<Highlight | null>(null);
  const [deletingHighlight, setDeletingHighlight] = useState<Highlight | null>(null);

  const [title, setTitle] = useState("");
  const [handle, setHandle] = useState("");
  const [description, setDescription] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [cover, setCover] = useState("");
  const [durationStr, setDurationStr] = useState("");
  const [isPublished, setIsPublished] = useState(false);

  const clips = (data?.data ?? []) as unknown as Highlight[];

  const getAuthorName = (authorId: string | null) => {
    if (!authorId) return "Unknown";
    return users?.data?.find((u) => u.id === authorId)?.name ?? "Unknown";
  };

  const getAuthorAvatar = (authorId: string | null) => {
    if (!authorId) return null;
    return users?.data?.find((u) => u.id === authorId)?.avatar ?? null;
  };

  const sparkData = (timeseries ?? []).map((p) => ({
    date: p.date,
    value: p.highlights,
  }));

  const handlePlay = (clip: Highlight) => {
    if (!can("highlights", "read")) {
      return;
    }
    setSelectedHighlight(clip);
    setIsPlayerOpen(true);
  };

  const handleClosePlayer = () => {
    setIsPlayerOpen(false);
    setSelectedHighlight(null);
  };

  const resetCreateForm = () => {
    setTitle("");
    setHandle("");
    setDescription("");
    setVideoUrl("");
    setThumbnailUrl("");
    setCover("");
    setDurationStr("");
    setIsPublished(false);
  };

  const handleCreate = () => {
    if (!title.trim() || !handle.trim()) return;
    createHighlight.mutate(
      {
        title: title.trim(),
        handle: handle.trim(),
        description: description.trim() || null,
        videoUrl: videoUrl.trim() || null,
        thumbnailUrl: thumbnailUrl.trim() || null,
        cover: cover.trim() || null,
        duration: durationStr ? parseInt(durationStr, 10) : null,
        isPublished,
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

  const openEdit = (highlight: Highlight) => {
    setEditingHighlight(highlight);
    setTitle(highlight.title);
    setHandle(highlight.handle);
    setDescription(highlight.description || "");
    setVideoUrl(highlight.videoUrl || "");
    setThumbnailUrl(highlight.thumbnailUrl || "");
    setCover(highlight.cover || "");
    setDurationStr(highlight.duration?.toString() || "");
    setIsPublished(highlight.isPublished);
    setIsEditOpen(true);
  };

  const handleEdit = () => {
    if (!editingHighlight || !title.trim() || !handle.trim()) return;
    updateHighlight.mutate(
      {
        id: editingHighlight.id,
        title: title.trim(),
        handle: handle.trim(),
        description: description.trim() || null,
        videoUrl: videoUrl.trim() || null,
        thumbnailUrl: thumbnailUrl.trim() || null,
        cover: cover.trim() || null,
        duration: durationStr ? parseInt(durationStr, 10) : null,
        isPublished,
      },
      {
        onSuccess: () => {
          setIsEditOpen(false);
          setEditingHighlight(null);
          resetCreateForm();
          refetch();
        },
      }
    );
  };

  const openDelete = (highlight: Highlight) => {
    setDeletingHighlight(highlight);
    setIsDeleteOpen(true);
  };

  const handleDelete = () => {
    if (!deletingHighlight) return;
    deleteHighlight.mutate(deletingHighlight.id, {
      onSuccess: () => {
        setIsDeleteOpen(false);
        setDeletingHighlight(null);
        refetch();
      },
    });
  };

  const togglePublish = (highlight: Highlight) => {
    updateHighlight.mutate(
      {
        id: highlight.id,
        isPublished: !highlight.isPublished,
      },
      {
        onSuccess: () => {
          refetch();
        },
      }
    );
  };

  const canUpload = can("highlights", "write");
  const canModerate = can("highlights", "moderate");
  const canDelete = can("highlights", "delete");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Content · Highlights"
        title="Highlights"
        description="Short-form vertical videos with performance and moderation signals."
        actions={
          <>
            <Button variant="outline" size="sm">
              <TrendingUp className="mr-1.5 size-4" />
              Trending
            </Button>
            {canUpload && (
              <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1.5">
                    <Plus className="size-4" /> New highlight
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Create highlight</DialogTitle>
                    <DialogDescription>
                      Add a new short-form video highlight.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="create-title">Title</Label>
                      <Input
                        id="create-title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g. Amazing sunset timelapse"
                        autoFocus
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="create-handle">Handle</Label>
                      <Input
                        id="create-handle"
                        value={handle}
                        onChange={(e) => setHandle(e.target.value)}
                        placeholder="e.g. amazing-sunset"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="create-description">Description</Label>
                      <Textarea
                        id="create-description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Brief description of the highlight..."
                        rows={3}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="create-video-url">Video URL</Label>
                      <Input
                        id="create-video-url"
                        value={videoUrl}
                        onChange={(e) => setVideoUrl(e.target.value)}
                        placeholder="https://..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="create-thumbnail-url">Thumbnail URL</Label>
                      <Input
                        id="create-thumbnail-url"
                        value={thumbnailUrl}
                        onChange={(e) => setThumbnailUrl(e.target.value)}
                        placeholder="https://..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="create-cover">Cover URL</Label>
                      <Input
                        id="create-cover"
                        value={cover}
                        onChange={(e) => setCover(e.target.value)}
                        placeholder="https://..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="create-duration">Duration (seconds)</Label>
                      <Input
                        id="create-duration"
                        type="number"
                        value={durationStr}
                        onChange={(e) => setDurationStr(e.target.value)}
                        placeholder="15"
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <Label htmlFor="create-published">Published</Label>
                        <p className="text-xs text-muted-foreground">
                          Make this highlight visible to users
                        </p>
                      </div>
                      <Switch
                        id="create-published"
                        checked={isPublished}
                        onCheckedChange={setIsPublished}
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
                      disabled={createHighlight.isPending || !title.trim() || !handle.trim()}
                    >
                      {createHighlight.isPending ? "Creating..." : "Create highlight"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          loading={isLoading}
          label="Total highlights"
          value={stats?.totalHighlights?.toLocaleString() ?? "0"}
          delta={8.4}
          icon={Play}
          tone="primary"
        />
        <StatCard
          loading={isLoading}
          label="Total views"
          value={stats?.totalViews?.toLocaleString() ?? "0"}
          delta={12.1}
          icon={Eye}
          tone="info"
        />
        <StatCard
          loading={isLoading}
          label="Total likes"
          value={stats?.totalLikes?.toLocaleString() ?? "0"}
          delta={2.4}
          icon={Heart}
          tone="success"
        />
        <StatCard
          loading={isLoading}
          label="Comments"
          value={stats?.totalComments?.toLocaleString() ?? "0"}
          delta={-11.2}
          icon={Sparkles}
          tone="warning"
        />
      </div>

      {/* Highlights Grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {clips.map((c) => {
          const authorName = getAuthorName(c.authorId);
          const authorAvatar = getAuthorAvatar(c.authorId);
          const durationFormatted = c.duration
            ? `${Math.floor(c.duration / 60)}:${(c.duration % 60)
                .toString()
                .padStart(2, "0")}`
            : "0:15";

          return (
            <div
              key={c.id}
              className="group relative overflow-hidden rounded-xl border bg-card shadow-sm transition-all hover:shadow-md"
            >
              {/* Thumbnail */}
              <div
                className="relative aspect-[9/16] cursor-pointer overflow-hidden bg-muted"
                onClick={() => handlePlay(c)}
              >
                {c.thumbnailUrl ? (
                  <img
                    src={c.thumbnailUrl}
                    alt={c.title}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 via-secondary/10 to-muted">
                    <Play className="size-8 text-muted-foreground/40" />
                  </div>
                )}

                {/* Play overlay */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/20">
                  <div className="grid size-12 translate-y-4 place-items-center rounded-full bg-black/50 text-white opacity-100 backdrop-blur-sm transition-all group-hover:translate-y-0 group-hover:opacity-100">
                    <Play className="size-5 fill-current" />
                  </div>
                </div>

                {/* Top badges */}
                <div className="absolute left-2 top-2 flex items-center gap-1.5">
                  <StatusBadge
                    status={c.isPublished ? "published" : "draft"}
                    size="sm"
                  />
                </div>

                {/* Duration badge */}
                <div className="absolute right-2 top-2">
                  <Badge
                    variant="secondary"
                    className="bg-black/60 text-[10px] text-white backdrop-blur-sm hover:bg-black/60"
                  >
                    <Clock className="mr-0.5 size-2.5" />
                    {durationFormatted}
                  </Badge>
                </div>

                {/* Bottom author overlay */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2.5 pt-8">
                  <div className="flex items-center gap-2">
                    <Avatar className="size-6 ring-1 ring-white/30">
                      <AvatarImage src={authorAvatar || ""} alt={authorName} />
                      <AvatarFallback className="bg-primary/80 text-[10px] text-white">
                        {authorName[0]}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate text-xs font-medium text-white">
                      {authorName}
                    </span>
                  </div>
                </div>

                {/* Moderation menu (permission-gated) */}
                {(canModerate || canDelete) && (
                  <div className="absolute right-2 top-10 opacity-100 transition-opacity group-hover:opacity-100">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 bg-black/40 text-white hover:bg-black/60"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        {canModerate && (
                          <>
                            <DropdownMenuItem onClick={() => openEdit(c)}>
                              <Pencil className="mr-2 size-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => togglePublish(c)}>
                              {c.isPublished ? (
                                <>
                                  <Eye className="mr-2 size-4" />
                                  Unpublish
                                </>
                              ) : (
                                <>
                                  <Eye className="mr-2 size-4" />
                                  Publish
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Flag className="mr-2 size-4" />
                              Moderate
                            </DropdownMenuItem>
                          </>
                        )}
                        {canDelete && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => openDelete(c)}
                            >
                              <Trash2 className="mr-2 size-4" />
                              Delete
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </div>

              {/* Info below thumbnail */}
              <div className="p-3">
                <h4 className="line-clamp-2 text-xs font-medium leading-snug">
                  {c.title}
                </h4>
                <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Eye className="size-3" />
                    {c.viewsCount?.toLocaleString() ?? "0"}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Heart className="size-3" />
                    {c.likesCount?.toLocaleString() ?? "0"}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Sparkles className="size-3" />
                    {c.commentsCount?.toLocaleString() ?? "0"}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {clips.length === 0 && !isLoading && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
          <div className="grid size-16 place-items-center rounded-full bg-muted">
            <Play className="size-8 text-muted-foreground/50" />
          </div>
          <h3 className="mt-4 text-lg font-medium">No highlights yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload your first short-form video to get started.
          </p>
          {canUpload && (
            <Button className="mt-4 gap-1.5" onClick={() => setIsCreateOpen(true)}>
              <Plus className="size-4" />
              New Highlight
            </Button>
          )}
        </div>
      )}

      {/* Analytics */}
      <SectionCard title="Highlights created (last 30 days)">
        <AreaSpark
          data={sparkData.length ? sparkData : [{ date: "—", value: 0 }]}
        />
      </SectionCard>

      {/* Video Player Modal */}
      <VideoPlayerModal
        highlight={selectedHighlight}
        isOpen={isPlayerOpen}
        onClose={handleClosePlayer}
        authorName={selectedHighlight ? getAuthorName(selectedHighlight.authorId) : ""}
      />

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit highlight</DialogTitle>
            <DialogDescription>
              Update the highlight details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-handle">Handle</Label>
              <Input
                id="edit-handle"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-video-url">Video URL</Label>
              <Input
                id="edit-video-url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-thumbnail-url">Thumbnail URL</Label>
              <Input
                id="edit-thumbnail-url"
                value={thumbnailUrl}
                onChange={(e) => setThumbnailUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-cover">Cover URL</Label>
              <Input
                id="edit-cover"
                value={cover}
                onChange={(e) => setCover(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-duration">Duration (seconds)</Label>
              <Input
                id="edit-duration"
                type="number"
                value={durationStr}
                onChange={(e) => setDurationStr(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="edit-published">Published</Label>
                <p className="text-xs text-muted-foreground">
                  Make this highlight visible to users
                </p>
              </div>
              <Switch
                id="edit-published"
                checked={isPublished}
                onCheckedChange={setIsPublished}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditOpen(false);
                setEditingHighlight(null);
                resetCreateForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleEdit}
              disabled={updateHighlight.isPending || !title.trim() || !handle.trim()}
            >
              {updateHighlight.isPending ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete highlight</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <strong>{deletingHighlight?.title}</strong>? This action cannot be
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
              {deleteHighlight.isPending ? "Deleting..." : "Delete highlight"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
