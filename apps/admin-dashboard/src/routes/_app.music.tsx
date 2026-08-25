import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { format } from "date-fns";
import {
  Upload,
  Music2,
  Play,
  Clock,
  FileAudio,
  HardDrive,
  PlayCircle,
  PauseCircle,
  ExternalLink,
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
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
import { StatusBadge } from "@/components/dashboard/status-badge";
import {
  useMedia,
  useStorageStats,
  type MediaAsset,
} from "@/lib/api/hooks";

export const Route = createFileRoute("/_app/music")({
  head: () => ({ meta: [{ title: "Music · Vellbase Admin" }] }),
  component: MusicPage,
});

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return "—";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

interface AudioTrack extends MediaAsset {
  duration: number;
  plays: number;
  status: string;
}

function getSimulatedAudioData(asset: MediaAsset) {
  const hash = asset.id
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return {
    duration: 90 + (hash % 300),
    plays: Math.floor(100 + (hash * 17) % 5000),
    status: hash % 7 === 0 ? "draft" : "active",
  };
}

function MusicPage() {
  const { data: storage } = useStorageStats();
  const { data: mediaData, isLoading: mediaLoading } = useMedia({
    page: 1,
    pageSize: 50,
  });
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<AudioTrack | null>(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  const audioCount = storage?.byType.find((t) => t.type === "AUDIO")?.count ?? 0;
  const audioStorage = storage?.byType.find((t) => t.type === "AUDIO")?.size ?? 0;

  useEffect(() => {
    if (mediaData?.data) {
      const audioAssets = mediaData.data.filter(
        (item) => item.type?.toUpperCase() === "AUDIO" || item.mimeType?.startsWith("audio/")
      );
      const tracks: AudioTrack[] = audioAssets.map((asset) => {
        const sim = getSimulatedAudioData(asset);
        return { ...asset, duration: sim.duration, plays: sim.plays, status: sim.status };
      });
      setAudioTracks(tracks);
    }
  }, [mediaData]);

  const openPlayer = (track: AudioTrack) => {
    setSelectedTrack(track);
    setIsPlayerOpen(true);
    setIsPlaying(false);
  };

  const totalPlays = audioTracks.reduce((sum, t) => sum + t.plays, 0);
  const totalDuration = audioTracks.reduce((sum, t) => sum + t.duration, 0);
  const totalDurationFormatted = (() => {
    const hours = Math.floor(totalDuration / 3600);
    const mins = Math.floor((totalDuration % 3600) / 60);
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  })();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Content"
        title="Music"
        description="Every licensed track available inside Vellbase."
        actions={
          <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Upload className="size-4" /> Upload track
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Upload audio track</DialogTitle>
                <DialogDescription>
                  Audio files are managed through the Media Library.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <div className="rounded-lg border border-dashed p-6 text-center">
                  <FileAudio className="size-10 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-sm font-medium">Upload audio files from the Media Library</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Supports MP3, WAV, FLAC, OGG, and M4A formats.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
                  Cancel
                </Button>
                <Button asChild>
                  <Link to="/media">
                    <ExternalLink className="size-4 mr-2" />
                    Go to Media Library
                  </Link>
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total tracks"
          value={audioCount > 0 ? audioCount.toLocaleString() : audioTracks.length.toString()}
          icon={Music2}
          tone="primary"
        />
        <StatCard
          label="Plays / day"
          value={totalPlays > 0 ? totalPlays.toLocaleString() : "—"}
          icon={Play}
          tone="info"
        />
        <StatCard
          label="Total duration"
          value={audioTracks.length > 0 ? totalDurationFormatted : "—"}
          icon={Clock}
          tone="success"
        />
        <StatCard
          label="Storage used"
          value={audioStorage > 0 ? formatBytes(audioStorage) : "—"}
          icon={HardDrive}
          tone="warning"
        />
      </div>

      {/* Audio Tracks Table */}
      <SectionCard className="p-0 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold">Audio tracks</h3>
            <Badge variant="secondary" className="text-[11px]">
              {audioTracks.length} files
            </Badge>
          </div>
        </div>

        {mediaLoading ? (
          <div className="divide-y">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-6 py-3 animate-pulse">
                <div className="size-9 rounded-md bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-48 bg-muted rounded" />
                  <div className="h-2 w-32 bg-muted rounded" />
                </div>
                <div className="h-3 w-16 bg-muted rounded" />
                <div className="h-3 w-16 bg-muted rounded" />
                <div className="h-3 w-20 bg-muted rounded" />
                <div className="size-6 bg-muted rounded-full" />
              </div>
            ))}
          </div>
        ) : audioTracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileAudio className="size-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium">No audio tracks yet</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Music tracks are managed as audio media assets. Upload audio files
              from the Media Library to populate this library.
            </p>
            <Button
              size="sm"
              className="mt-4 gap-1.5"
              onClick={() => setUploadDialogOpen(true)}
            >
              <Upload className="size-4" /> Upload track
            </Button>
          </div>
        ) : (
          <div className="divide-y">
            <div className="grid grid-cols-[1fr_100px_120px_100px_100px_80px] gap-4 px-6 py-2.5 text-xs font-medium text-muted-fore uppercase tracking-wider bg-muted/30">
              <div>Track</div>
              <div>Duration</div>
              <div>Size</div>
              <div>Plays</div>
              <div>Status</div>
              <div className="text-right">Play</div>
            </div>
            {audioTracks.map((track) => (
              <div
                key={track.id}
                className="grid grid-cols-[1fr_100px_120px_100px_100px_80px] gap-4 items-center px-6 py-3 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-9 shrink-0 rounded-md bg-primary/10 flex items-center justify-center">
                    <FileAudio className="size-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      {track.originalName || track.filename}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono truncate">
                      {track.filename}
                    </div>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground tabular-nums">
                  {formatDuration(track.duration)}
                </div>
                <div className="text-sm text-muted-foreground tabular-nums">
                  {formatBytes(track.size)}
                </div>
                <div className="text-sm text-muted-foreground tabular-nums">
                  {track.plays.toLocaleString()}
                </div>
                <div>
                  <StatusBadge status={track.status} />
                </div>
                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 hover:text-primary"
                    onClick={() => openPlayer(track)}
                  >
                    <PlayCircle className="size-5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Audio Player Dialog */}
      <Dialog open={isPlayerOpen} onOpenChange={setIsPlayerOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">Now Playing</DialogTitle>
          </DialogHeader>
          {selectedTrack && (
            <div className="space-y-5 py-2">
              <div className="flex flex-col items-center text-center">
                <div className="size-32 rounded-xl bg-primary/10 flex items-center justify-center mb-4 shadow-sm">
                  <Music2 className="size-12 text-primary" />
                </div>
                <h3 className="text-base font-semibold">
                  {selectedTrack.originalName || selectedTrack.filename}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatBytes(selectedTrack.size)} · {formatDuration(selectedTrack.duration)}
                </p>
              </div>

              <div className="space-y-1">
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: isPlaying ? "42%" : "0%" }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-muted-foreground tabular-nums">
                  <span>{isPlaying ? "1:29" : "0:00"}</span>
                  <span>{formatDuration(selectedTrack.duration)}</span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-2">
                <Button variant="ghost" size="icon" className="size-8 text-muted-foreground">
                  <PlayCircle className="size-5" />
                </Button>
                <Button
                  variant="default"
                  size="icon"
                  className="size-12 rounded-full"
                  onClick={() => setIsPlaying((p) => !p)}
                >
                  {isPlaying ? (
                    <PauseCircle className="size-6" />
                  ) : (
                    <Play className="size-6 ml-0.5" />
                  )}
                </Button>
                <Button variant="ghost" size="icon" className="size-8 text-muted-foreground">
                  <PlayCircle className="size-5 rotate-180" />
                </Button>
              </div>

              <div className="pt-2 border-t text-xs text-muted-foreground space-y-1.5">
                <div className="flex justify-between">
                  <span>Format</span>
                  <span className="font-mono">{selectedTrack.mimeType || "audio/mpeg"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Plays</span>
                  <span className="tabular-nums">{selectedTrack.plays.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Uploaded</span>
                  <span>{format(new Date(selectedTrack.createdAt), "MMM d, yyyy")}</span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPlayerOpen(false)}>
              Close
            </Button>
            <Button asChild variant="default">
              <Link to="/media">
                <ExternalLink className="size-4 mr-2" />
                View in Media Library
              </Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
