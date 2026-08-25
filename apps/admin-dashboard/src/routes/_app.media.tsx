import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import {
  Upload,
  Image as ImageIcon,
  Film,
  FileText,
  Music2,
  Trash2,
  Loader2,
  FileQuestion,
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useMedia, useDeleteMedia, useStorageStats, type MediaAsset } from "@/lib/api/hooks";

export const Route = createFileRoute("/_app/media")({
  head: () => ({ meta: [{ title: "Media Library · Vellbase Admin" }] }),
  component: MediaPage,
});

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function MediaPage() {
  const [activeTab, setActiveTab] = useState("all");
  const [page, setPage] = useState(1);
  const [allItems, setAllItems] = useState<MediaAsset[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<MediaAsset | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  const { data: storageStats, isLoading: statsLoading } = useStorageStats();
  const { data: mediaData, isLoading: mediaLoading, isFetching: mediaFetching } = useMedia({
    page,
    pageSize: 40,
  });
  const deleteMutation = useDeleteMedia();

  const byType = storageStats?.byType ?? [];

  const getTypeCount = (type: string) =>
    byType.find((t) => t.type.toLowerCase() === type.toLowerCase())?.count ?? 0;

  const filteredItems =
    activeTab === "all"
      ? allItems
      : allItems.filter((item) => item.type.toLowerCase() === activeTab.toLowerCase());

  const totalPages = mediaData ? Math.ceil(mediaData.total / mediaData.pageSize) : 0;
  const hasMore = mediaData ? page < totalPages : false;

  useEffect(() => {
    if (mediaData && mediaData.data && allItems.length === 0) {
      setAllItems(mediaData.data);
    }
  }, [mediaData, allItems.length]);

  const handleLoadMore = () => {
    if (mediaData && mediaData.data) {
      setAllItems((prev) => {
        const existingIds = new Set(prev.map((item) => item.id));
        const newItems = mediaData.data.filter((item) => !existingIds.has(item.id));
        return [...prev, ...newItems];
      });
      if (page < totalPages) {
        setPage((p) => p + 1);
      }
    }
  };

  const handleDelete = async () => {
    if (!selectedAsset) return;
    await deleteMutation.mutateAsync(selectedAsset.id);
    setAllItems((prev) => prev.filter((item) => item.id !== selectedAsset.id));
    setDeleteConfirmOpen(false);
    setSelectedAsset(null);
  };

  const getTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case "image":
        return ImageIcon;
      case "video":
        return Film;
      case "audio":
        return Music2;
      case "document":
        return FileText;
      default:
        return FileQuestion;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Content"
        title="Media Library"
        description="All uploaded assets across images, video, audio and documents."
        actions={
          <Button size="sm" className="gap-1.5" onClick={() => setUploadDialogOpen(true)}>
            <Upload className="size-4" /> Upload
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Images"
          value={statsLoading ? "" : getTypeCount("image").toLocaleString()}
          icon={ImageIcon}
          tone="primary"
          loading={statsLoading}
        />
        <StatCard
          label="Videos"
          value={statsLoading ? "" : getTypeCount("video").toLocaleString()}
          icon={Film}
          tone="info"
          loading={statsLoading}
        />
        <StatCard
          label="Audio"
          value={statsLoading ? "" : getTypeCount("audio").toLocaleString()}
          icon={Music2}
          tone="success"
          loading={statsLoading}
        />
        <StatCard
          label="Documents"
          value={statsLoading ? "" : getTypeCount("document").toLocaleString()}
          icon={FileText}
          tone="warning"
          loading={statsLoading}
        />
      </div>

      <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          {["all", "images", "videos", "audio", "documents"].map((t) => (
            <TabsTrigger key={t} value={t} className="capitalize">
              {t}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="all" className="mt-4">
          <MediaGrid
            items={filteredItems}
            loading={mediaLoading && allItems.length === 0}
            onSelect={setSelectedAsset}
            getTypeIcon={getTypeIcon}
          />
          {!mediaLoading && allItems.length > 0 && hasMore && (
            <div className="mt-6 flex justify-center">
              <Button variant="outline" onClick={handleLoadMore} disabled={mediaFetching}>
                {mediaFetching ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  "Load more"
                )}
              </Button>
            </div>
          )}
        </TabsContent>

        {["images", "videos", "audio", "documents"].map((t) => (
          <TabsContent key={t} value={t} className="mt-4">
            <MediaGrid
              items={filteredItems}
              loading={mediaLoading && allItems.length === 0}
              onSelect={setSelectedAsset}
              getTypeIcon={getTypeIcon}
            />
            {!mediaLoading && allItems.length > 0 && hasMore && (
              <div className="mt-6 flex justify-center">
                <Button variant="outline" onClick={handleLoadMore} disabled={mediaFetching}>
                  {mediaFetching ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    "Load more"
                  )}
                </Button>
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={!!selectedAsset} onOpenChange={(open) => !open && setSelectedAsset(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="truncate">{selectedAsset?.originalName}</DialogTitle>
            <DialogDescription className="truncate">{selectedAsset?.filename}</DialogDescription>
          </DialogHeader>
          {selectedAsset && (
            <div className="space-y-4">
              <div className="flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-muted">
                {selectedAsset.thumbnailUrl || selectedAsset.type.toLowerCase() === "image" ? (
                  <img
                    src={selectedAsset.thumbnailUrl ?? selectedAsset.url}
                    alt={selectedAsset.originalName}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    {(() => {
                      const Icon = getTypeIcon(selectedAsset.type);
                      return <Icon className="size-12" />;
                    })()}
                    <span className="text-sm">No preview available</span>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Type</div>
                  <div className="font-medium capitalize">{selectedAsset.type.toLowerCase()}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Size</div>
                  <div className="font-medium">{formatBytes(selectedAsset.size)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">MIME Type</div>
                  <div className="font-medium">{selectedAsset.mimeType}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Dimensions</div>
                  <div className="font-medium">
                    {selectedAsset.width && selectedAsset.height
                      ? `${selectedAsset.width} × ${selectedAsset.height}`
                      : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Uploaded by</div>
                  <div className="font-medium">
                    {selectedAsset.uploader?.name ?? selectedAsset.uploadedBy}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Upload date</div>
                  <div className="font-medium">
                    {format(new Date(selectedAsset.createdAt), "MMM d, yyyy HH:mm")}
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="destructive"
              onClick={() => setDeleteConfirmOpen(true)}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="mr-2 size-4" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete media asset</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this media asset? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload media</DialogTitle>
            <DialogDescription>Upload functionality coming soon.</DialogDescription>
          </DialogHeader>
          <div className="py-8 text-center text-sm text-muted-foreground">
            <Upload className="mx-auto mb-3 size-10 text-muted-foreground/50" />
            <p>Drag and drop files here, or click to browse.</p>
            <p className="mt-1 text-xs">Upload functionality is coming in a future update.</p>
          </div>
          <DialogFooter>
            <Button onClick={() => setUploadDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MediaGrid({
  items,
  loading,
  onSelect,
  getTypeIcon,
}: {
  items: MediaAsset[];
  loading: boolean;
  onSelect: (asset: MediaAsset) => void;
  getTypeIcon: (type: string) => any;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
        {Array.from({ length: 24 }).map((_, i) => (
          <div key={i} className="surface-card overflow-hidden">
            <Skeleton className="aspect-square" />
            <Skeleton className="m-2 h-3 w-3/4" />
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-16 text-center">
        <FileQuestion className="mx-auto mb-3 size-10 text-muted-foreground/50" />
        <div className="text-sm font-medium">No media assets</div>
        <div className="mt-1 text-xs text-muted-foreground">
          Upload files to see them appear here.
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
      {items.map((asset) => (
        <button
          key={asset.id}
          onClick={() => onSelect(asset)}
          className="surface-card group overflow-hidden text-left transition hover:ring-2 hover:ring-primary/30"
        >
          <div className="relative aspect-square overflow-hidden bg-muted">
            {asset.thumbnailUrl || asset.type.toLowerCase() === "image" ? (
              <img
                src={asset.thumbnailUrl ?? asset.url}
                alt={asset.originalName}
                className="h-full w-full object-cover transition group-hover:scale-105"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground/50">
                {(() => {
                  const Icon = getTypeIcon(asset.type);
                  return <Icon className="size-8" />;
                })()}
              </div>
            )}
          </div>
          <div className="truncate p-2 text-[11px] text-muted-foreground">
            {asset.originalName}
          </div>
        </button>
      ))}
    </div>
  );
}
