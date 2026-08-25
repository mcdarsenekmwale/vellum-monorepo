import { createFileRoute } from "@tanstack/react-router";
import { ListPage } from "@/components/dashboard/list-page";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { useJobs, type BackgroundJob } from "@/lib/api/hooks";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_app/jobs")({
  head: () => ({ meta: [{ title: "Background Jobs · Vellbase Admin" }] }),
  component: JobsPage,
});

function JobsPage() {
  const { data, isLoading, error } = useJobs({ pageSize: 50 });
  const rows = data?.data ?? [];

  return (
    <ListPage<BackgroundJob>
      title="Background jobs"
      description="Async work executed across every queue."
      eyebrow="Platform"
      rows={rows}
      isLoading={isLoading}
      error={error}
      searchKeys={["name", "queue", "status"]}
      columns={[
        { key: "name", header: "Job", cell: (j) => <span className="font-mono text-xs">{j.name}</span> },
        { key: "queue", header: "Queue", cell: (j) => <span className="text-sm">{j.queue}</span> },
        { key: "status", header: "Status", cell: (j) => <StatusBadge status={j.status} /> },
        { key: "duration", header: "Duration", cell: (j) => <span className="tabular-nums">{j.duration != null ? `${(j.duration / 1000).toFixed(1)}s` : "—"}</span> },
        { key: "ranAt", header: "Ran", cell: (j) => <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(j.ranAt), { addSuffix: true })}</span> },
      ]}
    />
  );
}
