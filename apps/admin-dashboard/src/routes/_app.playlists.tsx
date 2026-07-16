import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Plus,
  ListMusic,
  Play,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  MoreHorizontal,
  Music,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_app/playlists")({
  head: () => ({ meta: [{ title: "Playlists · Vellum Admin" }] }),
  component: PlaylistsPage,
});

interface Playlist {
  id: string;
  name: string;
  description: string;
  coverUrl: string;
  isPublic: boolean;
  trackCount: number;
  createdAt: string;
}

const SAMPLE_PLAYLISTS: Playlist[] = [
  {
    id: "pl-001",
    name: "Morning Vibes",
    description: "Calm and uplifting tracks to start your day right.",
    coverUrl: "",
    isPublic: true,
    trackCount: 24,
    createdAt: "2024-11-12",
  },
  {
    id: "pl-002",
    name: "Deep Focus",
    description: "Ambient and instrumental music for deep work sessions.",
    coverUrl: "",
    isPublic: true,
    trackCount: 18,
    createdAt: "2024-10-28",
  },
  {
    id: "pl-003",
    name: "Workout Energy",
    description: "High-energy beats to power through your training.",
    coverUrl: "",
    isPublic: false,
    trackCount: 32,
    createdAt: "2024-12-03",
  },
  {
    id: "pl-004",
    name: "Late Night Jazz",
    description: "Smooth jazz for quiet evenings and relaxation.",
    coverUrl: "",
    isPublic: true,
    trackCount: 15,
    createdAt: "2024-09-20",
  },
  {
    id: "pl-005",
    name: "Road Trip Mix",
    description: "Diverse tracks perfect for long drives and adventures.",
    coverUrl: "",
    isPublic: false,
    trackCount: 47,
    createdAt: "2024-08-15",
  },
  {
    id: "pl-006",
    name: "Acoustic Sessions",
    description: "Stripped-down acoustic performances across genres.",
    coverUrl: "",
    isPublic: true,
    trackCount: 21,
    createdAt: "2024-12-10",
  },
];

const COVER_GRADIENTS = [
  "linear-gradient(135deg, #f97316 0%, #db2777 100%)",
  "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
  "linear-gradient(135deg, #10b981 0%, #059669 100%)",
  "linear-gradient(135deg, #3b82f6 0%, #0ea5e9 100%)",
  "linear-gradient(135deg, #ef4444 0%, #f97316 100%)",
  "linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)",
];

function PlaylistsPage() {
  const [playlists, setPlaylists] = useState<Playlist[]>(SAMPLE_PLAYLISTS);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
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

  const getGradient = (index: number) => COVER_GRADIENTS[index % COVER_GRADIENTS.length];

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
    };
    setPlaylists((prev) => [newPlaylist, ...prev]);
    setIsCreateOpen(false);
    resetForm();
    toast.success("Playlist created (demo mode)");
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
            }
          : p
      )
    );
    setIsEditOpen(false);
    setSelectedPlaylist(null);
    resetForm();
    toast.success("Playlist updated (demo mode)");
  };

  const handleDelete = () => {
    if (!selectedPlaylist) return;
    setPlaylists((prev) => prev.filter((p) => p.id !== selectedPlaylist.id));
    setIsDeleteOpen(false);
    setSelectedPlaylist(null);
    toast.success("Playlist deleted (demo mode)");
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

  const publicCount = playlists.filter((p) => p.isPublic).length;
  const privateCount = playlists.filter((p) => !p.isPublic).length;
  const totalTracks = playlists.reduce((sum, p) => sum + p.trackCount, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Content"
        title="Playlists"
        description="Curated collections of music available across all clients."
        actions={
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="size-4" /> New playlist
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create playlist</DialogTitle>
                <DialogDescription>
                  Create a new playlist to organize your music tracks.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Playlist name</Label>
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
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="What's this playlist about?"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, description: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="coverUrl">Cover image URL (optional)</Label>
                  <Input
                    id="coverUrl"
                    placeholder="https://..."
                    value={formData.coverUrl}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, coverUrl: e.target.value }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <Label htmlFor="visibility">Visibility</Label>
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
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={!formData.name.trim()}>
                  Create playlist
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {/* Stats Overview */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SectionCard className="flex items-center gap-4">
          <div className="grid size-10 shrink-0 place-items-center rounded-md bg-primary/10">
            <ListMusic className="size-5 text-primary" />
          </div>
          <div>
            <div className="text-2xl font-semibold">{playlists.length}</div>
            <div className="text-xs text-muted-foreground">Total playlists</div>
          </div>
        </SectionCard>
        <SectionCard className="flex items-center gap-4">
          <div className="grid size-10 shrink-0 place-items-center rounded-md bg-emerald-500/10">
            <Eye className="size-5 text-emerald-500" />
          </div>
          <div>
            <div className="text-2xl font-semibold">{publicCount}</div>
            <div className="text-xs text-muted-foreground">Public</div>
          </div>
        </SectionCard>
        <SectionCard className="flex items-center gap-4">
          <div className="grid size-10 shrink-0 place-items-center rounded-md bg-amber-500/10">
            <EyeOff className="size-5 text-amber-500" />
          </div>
          <div>
            <div className="text-2xl font-semibold">{privateCount}</div>
            <div className="text-xs text-muted-foreground">Private</div>
          </div>
        </SectionCard>
        <SectionCard className="flex items-center gap-4">
          <div className="grid size-10 shrink-0 place-items-center rounded-md bg-sky-500/10">
            <Music className="size-5 text-sky-500" />
          </div>
          <div>
            <div className="text-2xl font-semibold">{totalTracks}</div>
            <div className="text-xs text-muted-foreground">Total tracks</div>
          </div>
        </SectionCard>
      </div>

      {/* Playlists Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            All playlists
          </h3>
          <span className="text-xs text-muted-foreground">
            {playlists.length} playlists
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <SectionCard key={i} className="animate-pulse">
                <div className="aspect-square w-full rounded-md bg-muted mb-3" />
                <div className="h-4 w-24 bg-muted rounded mb-1.5" />
                <div className="h-3 w-16 bg-muted rounded" />
              </SectionCard>
            ))
          ) : playlists.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
              <ListMusic className="size-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-medium">No playlists yet</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Create your first playlist to start organizing music.
              </p>
              <Button
                size="sm"
                className="mt-4 gap-1.5"
                onClick={() => setIsCreateOpen(true)}
              >
                <Plus className="size-4" /> New playlist
              </Button>
            </div>
          ) : (
            playlists.map((playlist, i) => (
              <SectionCard
                key={playlist.id}
                className="group relative hover:shadow-md transition-shadow"
              >
                {/* Cover Art */}
                <div className="relative aspect-square w-full overflow-hidden rounded-md mb-3">
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
                      <ListMusic className="size-10 text-white/80" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <Button
                      size="icon"
                      className="size-10 rounded-full bg-white text-black hover:bg-white/90 shadow-lg"
                    >
                      <Play className="size-5 ml-0.5" />
                    </Button>
                  </div>
                  <div className="absolute top-2 right-2">
                    <Badge
                      variant={playlist.isPublic ? "default" : "secondary"}
                      className={
                        playlist.isPublic
                          ? "bg-emerald-500/90 text-white hover:bg-emerald-500"
                          : ""
                      }
                    >
                      {playlist.isPublic ? "Public" : "Private"}
                    </Badge>
                  </div>
                </div>

                {/* Title & Actions */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-semibold truncate">{playlist.name}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {playlist.description || "No description"}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-7 -mt-1 -mr-1">
                        <MoreHorizontal className="size-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-36">
                      <DropdownMenuItem onClick={() => openEdit(playlist)}>
                        <Pencil className="size-3.5 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => openDelete(playlist)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="size-3.5 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Track count */}
                <div className="mt-3 pt-3 border-t flex items-center justify-between">
                  <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                    <Music className="size-3" />
                    {playlist.trackCount} tracks
                  </span>
                  <span className="text-xs text-muted-foreground">{playlist.createdAt}</span>
                </div>
              </SectionCard>
            ))
          )}
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit playlist</DialogTitle>
            <DialogDescription>Update playlist details and visibility.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Playlist name</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, description: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-coverUrl">Cover image URL</Label>
              <Input
                id="edit-coverUrl"
                value={formData.coverUrl}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, coverUrl: e.target.value }))
                }
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="edit-visibility">Visibility</Label>
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={!formData.name.trim()}>
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete playlist</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <strong>{selectedPlaylist?.name}</strong>? This will remove the playlist
              but not the tracks within it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 className="size-4 mr-2" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
