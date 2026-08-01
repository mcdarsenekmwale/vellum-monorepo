import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Info,
  BarChart3,
  Plus,
  ListMusic,
  Play,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  MoreHorizontal,
  Music,
  Heart,
  Share2,
  X,
  Copy,
  LayoutGrid,
  List,
  Filter,
  Search,
  Globe,
  Lock,
  Clock,
  Calendar,
  User,
  TrendingUp,
  Headphones,
  ChevronRight,
  Wand2,
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { Button } from "@/components/ui/button";
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { StatCard } from "@/components/dashboard/stat-card";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/playlists")({
  head: () => ({ meta: [{ title: "Playlists · Vellum Admin" }] }),
  component: PlaylistsPage,
});

/* ----------------- Types ----------------- */

interface Playlist {
  id: string;
  name: string;
  description: string;
  coverUrl: string;
  isPublic: boolean;
  trackCount: number;
  createdAt: string;
  updatedAt?: string;
  plays?: number;
  likes?: number;
  owner?: string;
}

interface Track {
  id: string;
  title: string;
  artist: string;
  duration: number;
  genre: string;
  plays: number;
}

/* ----------------- Sample Data ----------------- */

const SAMPLE_PLAYLISTS: Playlist[] = [
  {
    id: "pl-001",
    name: "Morning Vibes",
    description: "Calm and uplifting tracks to start your day right.",
    coverUrl: "",
    isPublic: true,
    trackCount: 24,
    createdAt: "2024-11-12",
    updatedAt: "2024-12-15",
    plays: 1247,
    likes: 89,
    owner: "Sarah Chen",
  },
  {
    id: "pl-002",
    name: "Deep Focus",
    description: "Ambient and instrumental music for deep work sessions.",
    coverUrl: "",
    isPublic: true,
    trackCount: 18,
    createdAt: "2024-10-28",
    updatedAt: "2024-12-10",
    plays: 856,
    likes: 67,
    owner: "Mike Johnson",
  },
  {
    id: "pl-003",
    name: "Workout Energy",
    description: "High-energy beats to power through your training.",
    coverUrl: "",
    isPublic: false,
    trackCount: 32,
    createdAt: "2024-12-03",
    updatedAt: "2024-12-18",
    plays: 2341,
    likes: 156,
    owner: "Alex Rivera",
  },
  {
    id: "pl-004",
    name: "Late Night Jazz",
    description: "Smooth jazz for quiet evenings and relaxation.",
    coverUrl: "",
    isPublic: true,
    trackCount: 15,
    createdAt: "2024-09-20",
    updatedAt: "2024-11-05",
    plays: 623,
    likes: 45,
    owner: "Emma Watson",
  },
  {
    id: "pl-005",
    name: "Road Trip Mix",
    description: "Diverse tracks perfect for long drives and adventures.",
    coverUrl: "",
    isPublic: false,
    trackCount: 47,
    createdAt: "2024-08-15",
    updatedAt: "2024-12-01",
    plays: 3156,
    likes: 234,
    owner: "David Kim",
  },
  {
    id: "pl-006",
    name: "Acoustic Sessions",
    description: "Stripped-down acoustic performances across genres.",
    coverUrl: "",
    isPublic: true,
    trackCount: 21,
    createdAt: "2024-12-10",
    updatedAt: "2024-12-20",
    plays: 934,
    likes: 78,
    owner: "Sarah Chen",
  },
];

const SAMPLE_TRACKS: Record<string, Track[]> = {
  "pl-001": [
    { id: "tr-001", title: "Sunrise", artist: "Luna Wave", duration: 215, genre: "Ambient", plays: 342 },
    { id: "tr-002", title: "Morning Light", artist: "Piano Flow", duration: 180, genre: "Piano", plays: 289 },
    { id: "tr-003", title: "Gentle Breeze", artist: "Nature Sounds", duration: 245, genre: "Ambient", plays: 156 },
  ],
  "pl-002": [
    { id: "tr-004", title: "Deep Focus", artist: "Study Beats", duration: 320, genre: "Lo-fi", plays: 567 },
    { id: "tr-005", title: "Concentration", artist: "Brain Waves", duration: 280, genre: "Electronic", plays: 423 },
  ],
};

const COVER_GRADIENTS = [
  "linear-gradient(135deg, #f97316 0%, #db2777 100%)",
  "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
  "linear-gradient(135deg, #10b981 0%, #059669 100%)",
  "linear-gradient(135deg, #3b82f6 0%, #0ea5e9 100%)",
  "linear-gradient(135deg, #ef4444 0%, #f97316 100%)",
  "linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)",
];

/* ----------------- Helpers ----------------- */

function getGradient(index: number) {
  return COVER_GRADIENTS[index % COVER_GRADIENTS.length];
}

function formatDuration(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/* ----------------- Main Component ----------------- */

function PlaylistsPage() {
  const [playlists, setPlaylists] = useState<Playlist[]>(SAMPLE_PLAYLISTS);
  const [tracks] = useState<Record<string, Track[]>>(SAMPLE_TRACKS);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPublic, setFilterPublic] = useState<"all" | "public" | "private">("all");
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    coverUrl: "",
    isPublic: true,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 600);
    return () => clearTimeout(timer);
  }, []);

  const filteredPlaylists = playlists.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter =
      filterPublic === "all" ||
      (filterPublic === "public" && p.isPublic) ||
      (filterPublic === "private" && !p.isPublic);
    return matchesSearch && matchesFilter;
  });

  const publicCount = playlists.filter((p) => p.isPublic).length;
  const privateCount = playlists.filter((p) => !p.isPublic).length;
  const totalPlays = playlists.reduce((sum, p) => sum + (p.plays || 0), 0);

  const resetForm = () => {
    setFormData({ name: "", description: "", coverUrl: "", isPublic: true });
  };

  const handleCreate = () => {
    if (!formData.name.trim()) return;
    const newPlaylist: Playlist = {
      id: `pl-${Date.now()}`,
      name: formData.name,
      description: formData.description,
      coverUrl: formData.coverUrl,
      isPublic: formData.isPublic,
      trackCount: 0,
      createdAt: new Date().toISOString().split("T")[0],
      updatedAt: new Date().toISOString().split("T")[0],
      plays: 0,
      likes: 0,
      owner: "Current User",
    };
    setPlaylists((prev) => [newPlaylist, ...prev]);
    setIsCreateOpen(false);
    resetForm();
    toast.success("Playlist created successfully");
  };

  const handleEdit = () => {
    if (!selectedPlaylist || !formData.name.trim()) return;
    setPlaylists((prev) =>
      prev.map((p) =>
        p.id === selectedPlaylist.id
          ? {
              ...p,
              name: formData.name,
              description: formData.description,
              coverUrl: formData.coverUrl,
              isPublic: formData.isPublic,
              updatedAt: new Date().toISOString().split("T")[0],
            }
          : p
      )
    );
    setIsEditOpen(false);
    setSelectedPlaylist(null);
    resetForm();
    toast.success("Playlist updated successfully");
  };

  const handleDelete = () => {
    if (!selectedPlaylist) return;
    setPlaylists((prev) => prev.filter((p) => p.id !== selectedPlaylist.id));
    setIsDeleteOpen(false);
    setSelectedPlaylist(null);
    toast.success("Playlist deleted successfully");
  };

  const openEdit = (playlist: Playlist) => {
    setSelectedPlaylist(playlist);
    setFormData({
      name: playlist.name,
      description: playlist.description,
      coverUrl: playlist.coverUrl,
      isPublic: playlist.isPublic,
    });
    setIsEditOpen(true);
  };

  const openDelete = (playlist: Playlist) => {
    setSelectedPlaylist(playlist);
    setIsDeleteOpen(true);
  };

  const openSheet = (playlist: Playlist) => {
    setSelectedPlaylist(playlist);
    setIsSheetOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Playlists</h1>
          <Badge variant="secondary" className="text-xs">
            {playlists.length}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Curated collections of music available across all clients.
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border bg-background p-1">
            <button
              onClick={() => setViewMode("grid")}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all",
                viewMode === "grid"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutGrid className="size-4" />
              Grid
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all",
                viewMode === "list"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <List className="size-4" />
              List
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search playlists..."
              className="w-64 pl-9"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="size-4" />
                New playlist
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create playlist</DialogTitle>
                <DialogDescription>
                  Create a new playlist to organize your music tracks.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-5 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <ListMusic className="size-3.5" />
                    Playlist name
                  </Label>
                  <Input
                    id="name"
                    placeholder="e.g. Chill Vibes"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, name: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description" className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <Info className="size-3.5" />
                    Description
                  </Label>
                  <Textarea
                    id="description"
                    placeholder="What's this playlist about?"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, description: e.target.value }))
                    }
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="coverUrl" className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <Wand2 className="size-3.5" />
                    Cover image URL
                  </Label>
                  <Input
                    id="coverUrl"
                    placeholder="https://..."
                    value={formData.coverUrl}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, coverUrl: e.target.value }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="visibility" className="text-sm">
                      Visibility
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {formData.isPublic
                        ? "Public — visible to all users"
                        : "Private — only visible to you"}
                    </p>
                  </div>
                  <Switch
                    id="visibility"
                    checked={formData.isPublic}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({ ...prev, isPublic: checked }))
                    }
                  />
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={!formData.name.trim()}
                >
                  Create playlist
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total playlists"
          value={playlists.length}
          icon={ListMusic}
          tone="primary"
        />
        <StatCard
          label="Public playlists"
          value={publicCount}
          icon={Eye}
          tone="success"
        />
        <StatCard
          label="Private playlists"
          value={privateCount}
          icon={EyeOff}
          tone="warning"
        />
        <StatCard
          label="Total plays"
          value={totalPlays.toLocaleString()}
          icon={Play}
          tone="info"
        />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 rounded-lg border bg-background p-1">
          {[
            { value: "all" as const, label: "All" },
            { value: "public" as const, label: "Public" },
            { value: "private" as const, label: "Private" },
          ].map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setFilterPublic(value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-all",
                filterPublic === value
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {(searchQuery || filterPublic !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchQuery("");
              setFilterPublic("all");
            }}
            className="gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <Filter className="h-3.5 w-3.5" />
            Clear
          </Button>
        )}
      </div>

      {/* Content */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            All playlists
          </h3>
          <span className="text-xs text-muted-foreground">
            {filteredPlaylists.length} playlists
          </span>
        </div>

        {isLoading ? (
          <div
            className={cn(
              "grid gap-4",
              viewMode === "grid"
                ? "sm:grid-cols-2 lg:grid-cols-4"
                : "grid-cols-1"
            )}
          >
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border bg-card p-4 animate-pulse"
              >
                <div className="aspect-square w-full rounded-lg bg-muted mb-3" />
                <div className="h-4 w-24 bg-muted rounded mb-2" />
                <div className="h-3 w-16 bg-muted rounded" />
              </div>
            ))}
          </div>
        ) : filteredPlaylists.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 grid size-16 place-items-center rounded-full bg-muted">
              <ListMusic className="size-8 text-muted-foreground/50" />
            </div>
            <p className="text-lg font-medium">
              {searchQuery || filterPublic !== "all"
                ? "No playlists match"
                : "No playlists yet"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {searchQuery || filterPublic !== "all"
                ? "Try adjusting your search or filters"
                : "Create your first playlist to start organizing music."}
            </p>
            {searchQuery || filterPublic !== "all" ? (
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => {
                  setSearchQuery("");
                  setFilterPublic("all");
                }}
              >
                Clear filters
              </Button>
            ) : (
              <Button
                size="sm"
                className="mt-4 gap-1.5"
                onClick={() => setIsCreateOpen(true)}
              >
                <Plus className="size-4" /> New playlist
              </Button>
            )}
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {filteredPlaylists.map((playlist, i) => (
              <div
                key={playlist.id}
                className="group relative rounded-xl border bg-card hover:shadow-md transition-all cursor-pointer overflow-hidden"
                onClick={() => openSheet(playlist)}
              >
                {/* Cover */}
                <div className="relative aspect-square w-full overflow-hidden">
                  {playlist.coverUrl ? (
                    <img
                      src={playlist.coverUrl}
                      alt={playlist.name}
                      className="size-full object-cover"
                    />
                  ) : (
                    <div
                      className="size-full flex items-center justify-center"
                      style={{ background: getGradient(i) }}
                    >
                      <ListMusic className="size-12 text-white/60" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <Button
                      size="icon"
                      className="size-12 rounded-full bg-white text-black hover:bg-white/90 shadow-lg"
                      onClick={(e) => {
                        e.stopPropagation();
                        toast.info(`Playing ${playlist.name}`);
                      }}
                    >
                      <Play className="size-5 ml-0.5" />
                    </Button>
                  </div>
                  <div className="absolute top-3 right-3">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] font-medium border-0 backdrop-blur-md",
                        playlist.isPublic
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-muted/80 text-muted-foreground"
                      )}
                    >
                      {playlist.isPublic ? (
                        <Globe className="size-2.5 mr-1" />
                      ) : (
                        <Lock className="size-2.5 mr-1" />
                      )}
                      {playlist.isPublic ? "Public" : "Private"}
                    </Badge>
                  </div>
                </div>

                {/* Info */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-semibold truncate">
                        {playlist.name}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                        {playlist.description || "No description"}
                      </p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 -mt-1 -mr-1 shrink-0 text-muted-foreground hover:text-foreground hover:bg-accent"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="size-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem
                          onClick={() => openSheet(playlist)}
                          className="text-xs"
                        >
                          <Eye className="size-3.5 mr-2" />
                          View details
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => openEdit(playlist)}
                          className="text-xs"
                        >
                          <Pencil className="size-3.5 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-xs">
                          <Copy className="size-3.5 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => openDelete(playlist)}
                          className="text-xs text-destructive focus:text-destructive"
                        >
                          <Trash2 className="size-3.5 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="mt-3 pt-3 border-t flex items-center justify-between text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Music className="size-3" />
                      {playlist.trackCount} tracks
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Play className="size-3" />
                      {(playlist.plays || 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* List View */
          <div className="rounded-xl border overflow-hidden">
            <div className="divide-y">
              {filteredPlaylists.map((playlist, i) => (
                <div
                  key={playlist.id}
                  className="group flex items-center gap-4 p-4 hover:bg-accent/30 transition-colors cursor-pointer"
                  onClick={() => openSheet(playlist)}
                >
                  <div
                    className="size-12 shrink-0 rounded-lg flex items-center justify-center"
                    style={{ background: getGradient(i) }}
                  >
                    <ListMusic className="size-5 text-white/70" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-sm">
                        {playlist.name}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px]",
                          playlist.isPublic
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                            : "text-muted-foreground"
                        )}
                      >
                        {playlist.isPublic ? "Public" : "Private"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {playlist.description || "No description"}
                    </p>
                  </div>

                  <div className="hidden sm:flex items-center gap-6 text-xs text-muted-foreground shrink-0">
                    <span className="flex items-center gap-1.5">
                      <Music className="size-3" />
                      {playlist.trackCount}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Play className="size-3" />
                      {(playlist.plays || 0).toLocaleString()}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Heart className="size-3" />
                      {playlist.likes || 0}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-foreground hover:bg-accent"
                      onClick={(e) => {
                        e.stopPropagation();
                        openSheet(playlist);
                      }}
                    >
                      <Eye className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-foreground hover:bg-accent"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEdit(playlist);
                      }}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        openDelete(playlist);
                      }}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ==================== DETAIL SHEET (Offcanvas) ==================== */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedPlaylist && (
            <>
              {/* Header Cover */}
              <div className="relative h-48 w-full overflow-hidden -mx-6 -ms-6 -mt-6">
                <div
                  className="absolute inset-0"
                  style={{
                    background: selectedPlaylist.coverUrl
                      ? `url(${selectedPlaylist.coverUrl}) center/cover`
                      : getGradient(playlists.indexOf(selectedPlaylist)),
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
               
                <div className="absolute bottom-4 left-6 right-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] font-medium border-0",
                        selectedPlaylist.isPublic
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-muted/80 text-muted-foreground"
                      )}
                    >
                      {selectedPlaylist.isPublic ? (
                        <Globe className="size-2.5 mr-1" />
                      ) : (
                        <Lock className="size-2.5 mr-1" />
                      )}
                      {selectedPlaylist.isPublic ? "Public" : "Private"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {selectedPlaylist.trackCount} tracks
                    </span>
                  </div>
                  <SheetTitle className="text-2xl font-bold">
                    {selectedPlaylist.name}
                  </SheetTitle>
                  <SheetDescription className="text-sm mt-1">
                    {selectedPlaylist.description || "No description"}
                  </SheetDescription>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-3 py-4 border-b">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 font-semibold">
                    <Play className="size-3.5 text-muted-foreground" />
                    {(selectedPlaylist.plays || 0).toLocaleString()}
                  </div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                    Plays
                  </div>
                </div>
                <div className="text-center border-x">
                  <div className="flex items-center justify-center gap-1 font-semibold">
                    <Heart className="size-3.5 text-muted-foreground" />
                    {selectedPlaylist.likes || 0}
                  </div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                    Likes
                  </div>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 font-semibold">
                    <Headphones className="size-3.5 text-muted-foreground" />
                    {selectedPlaylist.trackCount}
                  </div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                    Tracks
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <Tabs defaultValue="tracks" className="py-4">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="tracks" className="gap-1.5 text-xs">
                    <Music className="size-3.5" />
                    Tracks
                  </TabsTrigger>
                  <TabsTrigger value="details" className="gap-1.5 text-xs">
                    <Info className="size-3.5" />
                    Details
                  </TabsTrigger>
                  <TabsTrigger value="stats" className="gap-1.5 text-xs">
                    <BarChart3 className="size-3.5" />
                    Stats
                  </TabsTrigger>
                </TabsList>

                {/* Tracks Tab */}
                <TabsContent value="tracks" className="mt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {selectedPlaylist.trackCount} tracks
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs"
                    >
                      <Plus className="size-3.5" />
                      Add tracks
                    </Button>
                  </div>

                  {(tracks[selectedPlaylist.id] || []).length > 0 ? (
                    <div className="space-y-1.5">
                      {(tracks[selectedPlaylist.id] || []).map((track, idx) => (
                        <div
                          key={track.id}
                          className="flex items-center gap-3 rounded-lg border bg-card/50 p-3 hover:bg-accent/30 transition-colors group"
                        >
                          <span className="text-xs text-muted-foreground w-5 text-center font-mono">
                            {idx + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">
                              {track.title}
                            </div>
                            <div className="text-xs text-muted-foreground">{track.artist}</div>
                          </div>
                          <Badge
                            variant="outline"
                            className="text-[9px] text-muted-foreground"
                          >
                            {track.genre}
                          </Badge>
                          <span className="text-xs text-muted-foreground font-mono">
                            {formatDuration(track.duration)}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground hover:bg-accent"
                          >
                            <Play className="size-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <Music className="size-8 text-muted-foreground/30 mb-2" />
                      <p className="text-sm text-muted-foreground">No tracks in this playlist</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3 gap-1.5 text-xs"
                      >
                        <Plus className="size-3.5" />
                        Add tracks
                      </Button>
                    </div>
                  )}
                </TabsContent>

                {/* Details Tab */}
                <TabsContent value="details" className="mt-4 space-y-4">
                  <div className="space-y-1">
                    {[
                      {
                        icon: Calendar,
                        label: "Created",
                        value: new Date(selectedPlaylist.createdAt).toLocaleDateString(),
                      },
                      {
                        icon: Clock,
                        label: "Last updated",
                        value: selectedPlaylist.updatedAt
                          ? new Date(selectedPlaylist.updatedAt).toLocaleDateString()
                          : "Never",
                      },
                      {
                        icon: User,
                        label: "Owner",
                        value: selectedPlaylist.owner || "Unknown",
                      },
                      {
                        icon: selectedPlaylist.isPublic ? Globe : Lock,
                        label: "Visibility",
                        value: selectedPlaylist.isPublic ? "Public" : "Private",
                      },
                      {
                        icon: Music,
                        label: "Total tracks",
                        value: `${selectedPlaylist.trackCount}`,
                      },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="flex items-center justify-between py-2.5 border-b last:border-0"
                      >
                        <span className="flex items-center gap-2 text-sm text-muted-foreground">
                          <item.icon className="size-3.5" />
                          {item.label}
                        </span>
                        <span className="text-sm font-medium">
                          {item.value}
                        </span>
                      </div>
                    ))}
                  </div>

                  <Separator />

                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs"
                      onClick={() => {
                        setIsSheetOpen(false);
                        openEdit(selectedPlaylist);
                      }}
                    >
                      <Pencil className="size-3.5" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs"
                    >
                      <Share2 className="size-3.5" />
                      Share
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        setIsSheetOpen(false);
                        openDelete(selectedPlaylist);
                      }}
                    >
                      <Trash2 className="size-3.5" />
                      Delete
                    </Button>
                  </div>
                </TabsContent>

                {/* Stats Tab */}
                <TabsContent value="stats" className="mt-4 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      {
                        icon: Play,
                        label: "Total Plays",
                        value: (selectedPlaylist.plays || 0).toLocaleString(),
                      },
                      {
                        icon: Heart,
                        label: "Likes",
                        value: (selectedPlaylist.likes || 0).toLocaleString(),
                      },
                      {
                        icon: Music,
                        label: "Tracks",
                        value: selectedPlaylist.trackCount.toString(),
                      },
                      {
                        icon: TrendingUp,
                        label: "Engagement",
                        value:
                          selectedPlaylist.plays && selectedPlaylist.plays > 0
                            ? `${(
                                ((selectedPlaylist.likes || 0) /
                                  selectedPlaylist.plays) *
                                100
                              ).toFixed(1)}%`
                            : "0%",
                      },
                    ].map((stat) => (
                      <div
                        key={stat.label}
                        className="rounded-lg border bg-card/50 p-4 text-center"
                      >
                        <div className="flex items-center justify-center gap-1.5 mb-1">
                          <stat.icon className="size-4 text-muted-foreground" />
                          <div className="text-xl font-bold">
                            {stat.value}
                          </div>
                        </div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                          {stat.label}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-lg border bg-card/50 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium">
                        Engagement Rate
                      </span>
                      <span className="text-sm font-semibold">
                        {selectedPlaylist.plays && selectedPlaylist.plays > 0
                          ? `${(
                              ((selectedPlaylist.likes || 0) /
                                selectedPlaylist.plays) *
                              100
                            ).toFixed(1)}%`
                          : "0%"}
                      </span>
                    </div>
                    <Progress
                      value={
                        selectedPlaylist.plays && selectedPlaylist.plays > 0
                          ? ((selectedPlaylist.likes || 0) /
                              selectedPlaylist.plays) *
                            100
                          : 0
                      }
                      className="h-2"
                    />
                    <div className="mt-2 text-xs text-muted-foreground">
                      {selectedPlaylist.likes || 0} likes from{" "}
                      {selectedPlaylist.plays || 0} total plays
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              {/* Footer */}
              <SheetFooter className="border-t pt-4">
                <div className="flex items-center justify-between w-full text-xs text-muted-foreground">
                  <span>ID: {selectedPlaylist.id}</span>
                  <span className="flex items-center gap-1">
                    <Clock className="size-3" />
                    Updated{" "}
                    {selectedPlaylist.updatedAt
                      ? new Date(selectedPlaylist.updatedAt).toLocaleDateString()
                      : "Never"}
                  </span>
                </div>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ==================== EDIT DIALOG ==================== */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit playlist</DialogTitle>
            <DialogDescription>
              Update playlist details and visibility.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name" className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <ListMusic className="size-3.5" />
                Playlist name
              </Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description" className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <Info className="size-3.5" />
                Description
              </Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, description: e.target.value }))
                }
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-coverUrl" className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <Wand2 className="size-3.5" />
                Cover image URL
              </Label>
              <Input
                id="edit-coverUrl"
                value={formData.coverUrl}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, coverUrl: e.target.value }))
                }
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="edit-visibility" className="text-sm">
                  Visibility
                </Label>
                <p className="text-xs text-muted-foreground">
                  {formData.isPublic
                    ? "Public — visible to all users"
                    : "Private — only visible to you"}
                </p>
              </div>
              <Switch
                id="edit-visibility"
                checked={formData.isPublic}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, isPublic: checked }))
                }
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleEdit}
              disabled={!formData.name.trim()}
            >
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== DELETE DIALOG ==================== */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-destructive/10">
              <Trash2 className="size-5 text-destructive" />
            </div>
            <DialogTitle>Delete playlist</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <strong>{selectedPlaylist?.name}</strong>?
              This will remove the playlist but not the tracks within it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}