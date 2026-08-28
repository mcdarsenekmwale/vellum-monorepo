import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  Play,
  Heart,
  Eye,
  Sparkles,
  X,
  Volume2,
  VolumeX,
  Pause,
  MoreHorizontal,
  Flag,
  Pencil,
  Trash2,
  Share2,
  Clock,
  Plus,
  Search,
  Loader2,
  ChevronDown,
  RefreshCw,
  Download,
  Filter,
  LayoutGrid,
  List,
  AlertCircle,
  Check,
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
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  User,
  useUserById,
} from "@/lib/api/hooks";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/highlights")({
  head: () => ({ meta: [{ title: "Highlights · Vellbase Admin" }] }),
  component: HighlightsPage,
});

// ─── Video Player Modal ───
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
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md overflow-hidden border-0 bg-black p-0 shadow-2xl [&>button]:hidden">
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

          {/* Play/Pause overlay */}
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

// ─── Publisher Lookup Cell ───
function PublisherLookupCell({ publisherId, avatar }: { publisherId: string; avatar?: string }) {
  const { data: user, isLoading } = useUserById(publisherId);
  const name = user?.name ?? "Unknown";
  const initials = name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 1);

  return (
    <div className="flex items-center gap-2">
      <Avatar className="size-6 ring-1 ring-white/30">
        <AvatarImage src={avatar || ""} alt={name} />
        <AvatarFallback className="bg-primary/80 text-[10px] text-white">
          {initials}
        </AvatarFallback>
      </Avatar>
      <span className="truncate text-xs font-medium text-white">
        {isLoading ? "Loading…" : name}
      </span>
    </div>
  );
}

function PublisherCell({ publisherId, publishers, avatar }: { publisherId: string; publishers: User[]; avatar?: string }) {
  const pub = publishers?.find((u) => u.id === publisherId);

  if (pub) {
    const initials = pub.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 1);
    return (
      <div className="flex items-center gap-2">
        <Avatar className="size-6 ring-1 ring-white/30">
          <AvatarImage src={avatar || ""} alt={pub.name} />
          <AvatarFallback className="bg-primary/80 text-[10px] text-white">
            {initials}
          </AvatarFallback>
        </Avatar>
        <span className="truncate text-xs font-medium text-white">
          {pub.name}
        </span>
      </div>
    );
  }

  return <PublisherLookupCell publisherId={publisherId} avatar={avatar} />;
}

// ─── Highlights Page ───
function HighlightsPage() {
  const { data, isLoading, refetch } = useHighlights({ pageSize: 50 });
  const { data: users } = useUsers();
  const { data: stats } = useDashboardStats();
  const { data: timeseries } = useAnalyticsTimeseries(30);
  const { can } = useAuth();

  const createHighlight = useCreateHighlight();
  const updateHighlight = useUpdateHighlight();
  const deleteHighlight = useDeleteHighlight();

  // ─── State ───
  const [selectedHighlight, setSelectedHighlight] = useState<Highlight | null>(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingHighlight, setEditingHighlight] = useState<Highlight | null>(null);
  const [deletingHighlight, setDeletingHighlight] = useState<Highlight | null>(null);
  const [publishers, setPublishers] = useState<User[]>([]);
  
  // ─── Infinite Scroll State ───
  const [visibleCount, setVisibleCount] = useState(12);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasLoadedAll, setHasLoadedAll] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // ─── Search & Filter State ───
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft">("all");
  const [publisherFilter, setPublisherFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "mostViews" | "mostLikes">("newest");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // ─── Form State ───
  const [title, setTitle] = useState("");
  const [handle, setHandle] = useState("");
  const [description, setDescription] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [cover, setCover] = useState("");
  const [durationStr, setDurationStr] = useState("");
  const [isPublished, setIsPublished] = useState(false);

  const clips = (data?.data ?? []) as unknown as Highlight[];

  // ─── Debounced Search ───
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setVisibleCount(12);
      setHasLoadedAll(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // ─── Filtered and Sorted Highlights ───
  const filteredClips = useMemo(() => {
    let result = [...clips];

    if (debouncedSearch) {
      const query = debouncedSearch.toLowerCase();
      result = result.filter(
        (c) =>
          c.title.toLowerCase().includes(query) ||
          c.description?.toLowerCase().includes(query) ||
          c.handle.toLowerCase().includes(query)
      );
    }

    if (statusFilter !== "all") {
      result = result.filter((c) =>
        statusFilter === "published" ? c.isPublished : !c.isPublished
      );
    }

    if (publisherFilter !== "all") {
      result = result.filter((c) => c.publisherId === publisherFilter || c.authorId === publisherFilter);
    }

    switch (sortBy) {
      case "newest":
        result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case "oldest":
        result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        break;
      case "mostViews":
        result.sort((a, b) => (b.viewsCount || 0) - (a.viewsCount || 0));
        break;
      case "mostLikes":
        result.sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0));
        break;
    }

    return result;
  }, [clips, debouncedSearch, statusFilter, publisherFilter, sortBy]);

  // ─── Reset visible count when filters change ───
  useEffect(() => {
    setVisibleCount(12);
    setHasLoadedAll(false);
  }, [debouncedSearch, statusFilter, publisherFilter, sortBy]);

  // ─── Visible Clips (Load More) ───
  const visibleClips = filteredClips.slice(0, visibleCount);
  const hasMore = visibleCount < filteredClips.length;

  // ─── Intersection Observer for Infinite Scroll ───
  useEffect(() => {
    if (isLoadingMore || !hasMore || isLoading) {
      return;
    }

    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore && !isLoading) {
          loadMore();
        }
      },
      {
        root: null,
        rootMargin: "200px",
        threshold: 0.1,
      }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, isLoadingMore, isLoading, visibleCount]);

  const loadMore = useCallback(() => {
    if (isLoadingMore || !hasMore || isLoading) return;
    
    setIsLoadingMore(true);
    setTimeout(() => {
      const nextCount = Math.min(visibleCount + 12, filteredClips.length);
      setVisibleCount(nextCount);
      setIsLoadingMore(false);
      if (nextCount >= filteredClips.length) {
        setHasLoadedAll(true);
      }
    }, 300);
  }, [filteredClips.length, hasMore, isLoading, isLoadingMore, visibleCount]);

  const resetFilters = useCallback(() => {
    setSearchQuery("");
    setDebouncedSearch("");
    setStatusFilter("all");
    setPublisherFilter("all");
    setSortBy("newest");
    setVisibleCount(12);
    setHasLoadedAll(false);
  }, []);

  const hasActiveFilters = searchQuery || statusFilter !== "all" || publisherFilter !== "all" || sortBy !== "newest";

  // ─── Get unique publishers for filter ───
  const uniquePublishers = useMemo(() => {
    const pubMap = new Map<string, User>();
    clips.forEach((c) => {
      const id = c.publisherId || c.authorId;
      if (id) {
        const user = users?.data?.find((u) => u.id === id);
        if (user && !pubMap.has(id)) {
          pubMap.set(id, user);
        }
      }
    });
    return Array.from(pubMap.values());
  }, [clips, users]);

  // ─── Actions ───
  const getAuthorName = (authorId: string | null) => {
    if (!authorId) return "Unknown";
    return users?.data?.find((u) => u.id === authorId)?.name ?? "Unknown";
  };

  const sparkData = (timeseries ?? []).map((p) => ({
    date: p.date,
    value: p.highlights,
  }));

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
    if (!title.trim() || !handle.trim()) {
      toast.error("Title and handle are required");
      return;
    }
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
          toast.success("Highlight created successfully");
        },
        onError: () => {
          toast.error("Failed to create highlight");
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
    if (!editingHighlight || !title.trim() || !handle.trim()) {
      toast.error("Title and handle are required");
      return;
    }
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
          toast.success("Highlight updated successfully");
        },
        onError: () => {
          toast.error("Failed to update highlight");
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
        toast.success("Highlight deleted successfully");
      },
      onError: () => {
        toast.error("Failed to delete highlight");
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
          toast.success(
            highlight.isPublished ? "Highlight unpublished" : "Highlight published"
          );
        },
        onError: () => {
          toast.error("Failed to update highlight status");
        },
      }
    );
  };

  const handlePlay = (clip: Highlight) => {
    if (!can("highlights", "read")) {
      toast.error("You don't have permission to view highlights");
      return;
    }
    setSelectedHighlight(clip);
    setIsPlayerOpen(true);
  };

  const handleClosePlayer = () => {
    setIsPlayerOpen(false);
    setTimeout(() => {
      setSelectedHighlight(null);
    }, 300);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
      toast.success("Highlights refreshed");
    } catch {
      toast.error("Failed to refresh highlights");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleExport = () => {
    if (filteredClips.length === 0) {
      toast.error("No data to export");
      return;
    }
    setIsExporting(true);
    try {
      const csv = [
        ["Title", "Handle", "Description", "Status", "Views", "Likes", "Comments", "Duration", "Created"],
        ...filteredClips.map((c) => [
          `"${c.title.replace(/"/g, '""')}"`,
          c.handle,
          `"${(c.description || "").replace(/"/g, '""')}"`,
          c.isPublished ? "Published" : "Draft",
          c.viewsCount || 0,
          c.likesCount || 0,
          c.commentsCount || 0,
          c.duration || 0,
          new Date(c.createdAt).toISOString().split("T")[0],
        ]),
      ]
        .map((row) => row.join(","))
        .join("\n");

      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `highlights-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${filteredClips.length} highlights`);
    } catch {
      toast.error("Export failed");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDropdownOpenChange = (open: boolean) => {
    if (open) {
      document.body.style.pointerEvents = "auto";
    }
  };

  // ─── Fetch publishers ───
  useEffect(() => {
    if (!users) return;
    setPublishers(users.data);
  }, [users]);

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
              <TooltipContent>Refresh highlights</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={handleExport}
                  disabled={isExporting || filteredClips.length === 0}
                >
                  {isExporting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Download className="size-4" />
                  )}
                  <span className="hidden sm:inline">
                    {isExporting ? "Exporting..." : "Export"}
                  </span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Export highlights</TooltipContent>
            </Tooltip>

            {canUpload && (
              <Button size="sm" className="gap-1.5" onClick={() => setIsCreateOpen(true)}>
                <Plus className="size-4" /> New highlight
              </Button>
            )}
          </div>
        }
      />

      {/* ─── Stats ─── */}
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

      {/* ─── Highlights Created (MOVED ABOVE SEARCH) ─── */}
      <SectionCard title="Highlights created (last 30 days)">
        <AreaSpark
          data={sparkData.length ? sparkData : [{ date: "—", value: 0 }]}
          height={120}
        />
      </SectionCard>

      {/* ─── Search & Filters ─── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search highlights..."
            className="pl-9 h-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 rounded-lg border bg-background p-1">
            <button
              onClick={() => setViewMode("grid")}
              className={cn(
                "rounded-md p-1.5 transition-colors cursor-pointer",
                viewMode === "grid"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "rounded-md p-1.5 transition-colors",
                viewMode === "list"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <List className="h-4 w-4" />
            </button>
          </div>

          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <SelectTrigger className="w-[130px] h-9">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
            </SelectContent>
          </Select>

          <Select value={publisherFilter} onValueChange={setPublisherFilter}>
            <SelectTrigger className="w-[150px] h-9">
              <SelectValue placeholder="Publisher" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Publishers</SelectItem>
              {uniquePublishers.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="oldest">Oldest</SelectItem>
              <SelectItem value="mostViews">Most Views</SelectItem>
              <SelectItem value="mostLikes">Most Likes</SelectItem>
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          Showing {visibleClips.length} of {filteredClips.length} highlights
          {hasActiveFilters && " (filtered)"}
          {!hasActiveFilters && filteredClips.length !== clips.length && " (filtered)"}
        </span>
        {visibleClips.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {Math.round((visibleClips.length / filteredClips.length) * 100)}% loaded
          </span>
        )}
      </div>

      {/* ─── Highlights Grid / List ─── */}
      {viewMode === "grid" ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-[9/16] rounded-lg bg-muted" />
                <div className="mt-2 h-3 w-3/4 rounded bg-muted" />
                <div className="mt-1 h-2 w-1/2 rounded bg-muted" />
              </div>
            ))
          ) : visibleClips.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
              <div className="grid size-16 place-items-center rounded-full bg-muted">
                <Play className="size-8 text-muted-foreground/50" />
              </div>
              <h3 className="mt-4 text-lg font-medium">
                {hasActiveFilters ? "No highlights match your filters" : "No highlights yet"}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {hasActiveFilters
                  ? "Try adjusting your search or filters"
                  : "Upload your first short-form video to get started."}
              </p>
              {hasActiveFilters ? (
                <Button variant="outline" className="mt-4" onClick={resetFilters}>
                  Clear filters
                </Button>
              ) : (
                canUpload && (
                  <Button className="mt-4 gap-1.5" onClick={() => setIsCreateOpen(true)}>
                    <Plus className="size-4" />
                    New Highlight
                  </Button>
                )
              )}
            </div>
          ) : (
            visibleClips.map((c) => {
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
                      <PublisherCell
                        publishers={publishers}
                        avatar={c.publisherAvatar}
                        publisherId={c.publisherId || c.authorId || ""}
                      />
                    </div>

                    {/* Moderation menu */}
                    {(canModerate || canDelete) && (
                      <div
                        className="absolute right-2 top-10 opacity-100 transition-opacity group-hover:opacity-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <DropdownMenu onOpenChange={handleDropdownOpenChange}>
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
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openEdit(c);
                                  }}
                                >
                                  <Pencil className="mr-2 size-4" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    togglePublish(c);
                                  }}
                                >
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
                                <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
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
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openDelete(c);
                                  }}
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
            })
          )}
        </div>
      ) : (
        /* ─── List View ─── */
        <div className="space-y-3">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="animate-pulse flex gap-4 rounded-lg border p-4">
                <div className="h-24 w-24 rounded-lg bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 rounded bg-muted" />
                  <div className="h-3 w-1/2 rounded bg-muted" />
                  <div className="h-3 w-1/3 rounded bg-muted" />
                </div>
              </div>
            ))
          ) : visibleClips.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="grid size-16 place-items-center rounded-full bg-muted">
                <Play className="size-8 text-muted-foreground/50" />
              </div>
              <h3 className="mt-4 text-lg font-medium">
                {hasActiveFilters ? "No highlights match your filters" : "No highlights yet"}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {hasActiveFilters
                  ? "Try adjusting your search or filters"
                  : "Upload your first short-form video to get started."}
              </p>
            </div>
          ) : (
            visibleClips.map((c) => (
              <div
                key={c.id}
                className="group flex items-center gap-4 rounded-lg border p-4 transition-all hover:shadow-md cursor-pointer"
                onClick={() => handlePlay(c)}
              >
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
                  {c.thumbnailUrl ? (
                    <img
                      src={c.thumbnailUrl}
                      alt={c.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-muted">
                      <Play className="size-6 text-muted-foreground/30" />
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/20">
                    <div className="grid size-8 translate-y-4 place-items-center rounded-full bg-black/50 text-white opacity-0 transition-all group-hover:translate-y-0 group-hover:opacity-100">
                      <Play className="size-3.5 fill-current" />
                    </div>
                  </div>
                  {!c.isPublished && (
                    <div className="absolute left-1 top-1">
                      <Badge variant="secondary" className="text-[8px] px-1 py-0">
                        Draft
                      </Badge>
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="truncate font-medium">{c.title}</h4>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="truncate">
                      {getAuthorName(c.authorId)}
                    </span>
                    <span>·</span>
                    <span>{c.duration ? `${Math.floor(c.duration / 60)}:${(c.duration % 60).toString().padStart(2, "0")}` : "0:15"}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-muted-foreground shrink-0">
                  <span className="flex items-center gap-1">
                    <Eye className="size-3" />
                    {c.viewsCount?.toLocaleString() ?? "0"}
                  </span>
                  <span className="flex items-center gap-1">
                    <Heart className="size-3" />
                    {c.likesCount?.toLocaleString() ?? "0"}
                  </span>
                  <span className="flex items-center gap-1">
                    <Sparkles className="size-3" />
                    {c.commentsCount?.toLocaleString() ?? "0"}
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePlay(c);
                    }}
                  >
                    <Play className="size-4" />
                  </Button>
                  {(canModerate || canDelete) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 opacity-0 group-hover:opacity-100 transition-opacity"
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
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ─── Infinite Scroll Trigger ─── */}
      {!isLoading && visibleClips.length > 0 && (
        <div ref={loadMoreRef} className="flex justify-center py-4">
          {isLoadingMore ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              <span className="text-sm">Loading more highlights...</span>
            </div>
          ) : hasMore ? (
            <div className="flex items-center gap-2 text-muted-foreground/50">
              <span className="text-sm">Scroll to load more</span>
              <ChevronDown className="size-4 animate-bounce" />
            </div>
          ) : hasLoadedAll && filteredClips.length > 0 ? (
            <div className="flex items-center gap-2 text-muted-foreground/50">
              <Check className="size-4" />
              <span className="text-sm">All {filteredClips.length} highlights loaded</span>
            </div>
          ) : null}
        </div>
      )}

      {/* ─── Modals ─── */}

      {/* Video Player Modal */}
      <VideoPlayerModal
        highlight={selectedHighlight}
        isOpen={isPlayerOpen}
        onClose={handleClosePlayer}
        authorName={selectedHighlight ? getAuthorName(selectedHighlight.authorId) : ""}
      />

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create highlight</DialogTitle>
            <DialogDescription>
              Add a new short-form video highlight.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="create-title">Title *</Label>
              <Input
                id="create-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Amazing sunset timelapse"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-handle">Handle *</Label>
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

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit highlight</DialogTitle>
            <DialogDescription>
              Update the highlight details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Title *</Label>
              <Input
                id="edit-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-handle">Handle *</Label>
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