import { createFileRoute } from "@tanstack/react-router";
import { HardDrive, Film, Image as ImageIcon, FileText, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { SectionCard } from "@/components/dashboard/section-card";
import { useStorageStats, useMedia } from "@/lib/api/hooks";
import { ChartSkeleton } from "@/components/dashboard/skeletons";
import { format } from "date-fns";

export const Route = createFileRoute("/_app/storage")({
  head: () => ({ meta: [{ title: "Storage · Vellum Admin" }] }),
  component: StoragePage,
});

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function StoragePage() {
  const { data, isLoading } = useStorageStats();
  const { data: mediaData } = useMedia({ pageSize: 5 });

  const byType = data?.byType ?? [];
  const totalSize = data?.totalSize ?? 0;
  const totalFiles = data?.totalFiles ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Platform"
        title="Storage"
        description="Media assets, usage and file management."
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total used" value={formatBytes(totalSize)} icon={HardDrive} tone="primary" />
        <StatCard label="Total files" value={totalFiles.toLocaleString()} icon={ImageIcon} tone="info" />
        <StatCard label="Videos" value={byType.find((t) => t.type === "VIDEO")?.count.toLocaleString() ?? "0"} icon={Film} tone="success" />
        <StatCard label="Documents" value={byType.find((t) => t.type === "DOCUMENT")?.count.toLocaleString() ?? "0"} icon={FileText} tone="warning" />
      </div>

      <SectionCard title="By type" padded={false}>
        {isLoading ? (
          <div className="p-5"><ChartSkeleton height={160} /></div>
        ) : byType.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">No media uploaded yet.</div>
        ) : (
          <ul className="divide-y">
            {byType.map((t) => (
              <li key={t.type} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4 px-5 py-4">
                <div>
                  <div className="font-mono text-sm capitalize">{t.type}</div>
                  <div className="text-xs text-muted-foreground">{t.count.toLocaleString()} files</div>
                </div>
                <div className="text-sm tabular-nums">{formatBytes(t.size)}</div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="Recent uploads" padded={false}>
        {(mediaData?.data ?? []).length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">No recent uploads.</div>
        ) : (
          <ul className="divide-y">
            {(mediaData?.data ?? []).map((m) => (
              <li key={m.id} className="flex items-center gap-4 px-5 py-3 text-sm">
                <div className="grid size-10 place-items-center rounded-md bg-muted text-xs font-medium">
                  {m.type[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{m.originalName}</div>
                  <div className="text-xs text-muted-foreground">{formatBytes(m.size)} · {m.mimeType}</div>
                </div>
                <div className="text-xs text-muted-foreground">{format(new Date(m.createdAt), "MMM d, HH:mm")}</div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
