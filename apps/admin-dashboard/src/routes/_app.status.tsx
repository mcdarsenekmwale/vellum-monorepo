import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { ChartSkeleton } from "@/components/dashboard/skeletons";
import { useSystemStatus } from "@/lib/api/hooks";
import type { SystemStatus } from "@/lib/api/services";

export const Route = createFileRoute("/_app/status")({
  head: () => ({ meta: [{ title: "System Status · Vellbase Admin" }] }),
  component: StatusPage,
});

function StatusPage() {
  const { data, isLoading } = useSystemStatus();
  const counts = data?.counts ?? ({
    activeSessions: 0,
    totalArticles: 0,
    totalHighlights: 0,
    totalComments: 0,
    totalMedia: 0,
    pendingJobs: 0,
    openReports: 0,
  } as SystemStatus["counts"]);

  const services = [
    { name: "Database", region: "primary", up: data?.database === "ok" },
    { name: "Active sessions", region: "live", count: counts.activeSessions },
    { name: "Articles", region: "content", count: counts.totalArticles },
    { name: "Highlights", region: "content", count: counts.totalHighlights },
    { name: "Comments", region: "content", count: counts.totalComments },
    { name: "Media assets", region: "storage", count: counts.totalMedia },
    { name: "Pending jobs", region: "queue", count: counts.pendingJobs },
    { name: "Open reports", region: "moderation", count: counts.openReports },
  ];

  const allOk = data?.database === "ok";

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="System" title="System status" description="Live health of every service Vellbase depends on." />

      {isLoading ? (
        <ChartSkeleton height={80} />
      ) : (
        <div className="surface-card flex items-center gap-3 p-5">
          <div className={`grid size-10 place-items-center rounded-full ${allOk ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
            {allOk ? <CheckCircle2 className="size-5" /> : <AlertCircle className="size-5" />}
          </div>
          <div>
            <div className="text-sm font-semibold">{allOk ? "All systems operational" : "Issues detected"}</div>
            <div className="text-xs text-muted-foreground">Auto-refreshing every 30s</div>
          </div>
        </div>
      )}

      <SectionCard title="Services" padded={false}>
        {isLoading ? (
          <div className="p-5"><ChartSkeleton height={200} /></div>
        ) : (
          <ul className="divide-y">
            {services.map((s) => (
              <li key={s.name} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4 px-5 py-3">
                <div>
                  <div className="text-sm font-medium">{s.name}</div>
                  <div className="text-xs text-muted-foreground">{s.region}</div>
                </div>
                <div className="flex gap-0.5">
                  {Array.from({ length: 60 }).map((_, i) => (
                    <span
                      key={i}
                      className={`h-6 w-1 rounded-sm ${s.up === false ? "bg-destructive/70" : "bg-success/70"}`}
                    />
                  ))}
                </div>
                <div className="text-right text-sm tabular-nums">
                  {s.count !== undefined ? s.count.toLocaleString() : s.up === false ? "error" : "ok"}
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="Recent incidents" padded={false}>
        <div className="p-10 text-center text-sm text-muted-foreground">
          No incidents recorded. Incident tracking will appear here when issues are detected.
        </div>
      </SectionCard>
    </div>
  );
}
