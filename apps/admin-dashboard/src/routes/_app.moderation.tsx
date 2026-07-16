import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ShieldCheck,
  ShieldAlert,
  Gavel,
  Bot,
  CheckCircle2,
  XCircle,
  Eye,
  Clock,
  AlertTriangle,
  User,
  Flag,
  Filter,
  Search,
  ChevronRight,
  MoreHorizontal,
  Ban,
  MessageSquare,
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useReports, useUpdateReportStatus } from "@/lib/api/hooks";
import { avatarUrl } from "@/lib/avatar";
import { ChartSkeleton } from "@/components/dashboard/skeletons";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_app/moderation")({
  head: () => ({ meta: [{ title: "Moderation · Vellum Admin" }] }),
  component: ModerationPage,
});

function ModerationPage() {
  const { data, isLoading } = useReports({ pageSize: 50 });
  const updateStatus = useUpdateReportStatus();
  const queue = data?.data ?? [];

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "resolved" | "dismissed">("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | "critical" | "high" | "medium" | "low">("all");

  // Filter reports
  const filteredQueue = useMemo(() => {
    return queue.filter((r) => {
      const matchesSearch = !searchQuery || 
        r.reason.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.targetId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.reporter?.name?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || r.status === statusFilter;
      const matchesPriority = priorityFilter === "all" || r.priority === priorityFilter;
      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [queue, searchQuery, statusFilter, priorityFilter]);

  // Stats
  const openCount = queue.filter((r) => r.status === "open").length;
  const resolvedCount = queue.filter((r) => r.status === "resolved").length;
  const dismissedCount = queue.filter((r) => r.status === "dismissed").length;
  const criticalCount = queue.filter((r) => r.priority === "critical" && r.status === "open").length;

  // Get next unreviewed report
  const nextReport = queue.find((r) => r.status === "open");

  // Priority color mapping
  const priorityConfig = {
    critical: { color: "text-destructive bg-destructive/10 border-destructive/20", icon: AlertTriangle },
    high: { color: "text-orange-500 bg-orange-500/10 border-orange-500/20", icon: ShieldAlert },
    medium: { color: "text-amber-500 bg-amber-500/10 border-amber-500/20", icon: Flag },
    low: { color: "text-muted-foreground bg-muted border-transparent", icon: Flag },
  };

  // Status config
  const statusConfig = {
    open: { label: "Pending", variant: "warning" as const },
    resolved: { label: "Resolved", variant: "success" as const },
    dismissed: { label: "Dismissed", variant: "secondary" as const },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        eyebrow="Community"
        title="Moderation queue"
        description="Human-in-the-loop review with AI risk scoring on every item."
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Bot className="size-4" /> AI settings
            </Button>
            {nextReport && (
              <Button size="sm" className="gap-1.5" asChild>
                <Link
                  to="/moderation/$reportId"
                  params={{ reportId: nextReport.id }}
                >
                  Take next <ChevronRight className="size-4" />
                </Link>
              </Button>
            )}
          </>
        }
      />

      {/* Stats Overview */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Pending"
          value={openCount}
          icon={ShieldAlert}
          tone="warning"
          delta={openCount > 0 ? `${openCount} need review` : undefined}
        />
        <StatCard
          label="Critical"
          value={criticalCount}
          icon={AlertTriangle}
          tone="destructive"
          delta={criticalCount > 0 ? "Requires immediate action" : undefined}
        />
        <StatCard
          label="Resolved"
          value={resolvedCount}
          icon={ShieldCheck}
          tone="success"
          delta={dismissedCount > 0 ? `${dismissedCount} dismissed` : undefined}
        />
        <StatCard
          label="Auto-actioned"
          value="—"
          icon={Bot}
          tone="primary"
          delta="AI detection"
        />
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant={statusFilter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("all")}
          >
            All
          </Button>
          <Button
            variant={statusFilter === "open" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("open")}
            className="gap-1.5"
          >
            <Clock className="size-3.5" />
            Open
            {openCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                {openCount}
              </Badge>
            )}
          </Button>
          <Button
            variant={statusFilter === "resolved" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("resolved")}
            className="gap-1.5"
          >
            <CheckCircle2 className="size-3.5" />
            Resolved
          </Button>
          <Button
            variant={statusFilter === "dismissed" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("dismissed")}
            className="gap-1.5"
          >
            <XCircle className="size-3.5" />
            Dismissed
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-56">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search reports..."
              className="h-8 pl-8 text-xs"
            />
          </div>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Filter className="size-3.5" />
            Priority
          </Button>
        </div>
      </div>

      {/* Priority Filter Pills */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground uppercase tracking-wider">Priority:</span>
        {(["all", "critical", "high", "medium", "low"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPriorityFilter(p)}
            className={cn(
              "text-xs px-2.5 py-1 rounded-full border transition-colors",
              priorityFilter === p
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border hover:border-primary/50"
            )}
          >
            {p === "all" ? "All" : p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      {/* Review Queue */}
      <SectionCard>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-sm font-medium">Review queue</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {filteredQueue.length} reports · Most recent first
            </div>
          </div>
          {filteredQueue.length > 0 && statusFilter === "open" && (
            <Button size="sm" variant="outline" className="gap-1.5">
              <CheckCircle2 className="size-3.5" />
              Resolve all
            </Button>
          )}
        </div>

        {isLoading ? (
          <ChartSkeleton height={300} />
        ) : filteredQueue.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ShieldCheck className="size-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium">All clear</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {searchQuery || statusFilter !== "all" || priorityFilter !== "all"
                ? "No reports match your filters."
                : "No reports pending review. The community is behaving well."}
            </p>
            {(searchQuery || statusFilter !== "all" || priorityFilter !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-4"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                  setPriorityFilter("all");
                }}
              >
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredQueue.map((r) => {
              const priority = priorityConfig[r.priority as keyof typeof priorityConfig] ?? priorityConfig.low;
              const PriorityIcon = priority.icon;
              const status = statusConfig[r.status as keyof typeof statusConfig] ?? statusConfig.open;

              return (
                <div
                  key={r.id}
                  className={cn(
                    "group relative flex items-start gap-4 rounded-lg border p-4 transition-all hover:shadow-sm",
                    r.status === "open"
                      ? "bg-background hover:border-primary/20"
                      : "bg-muted/30 border-muted"
                  )}
                >
                  {/* AI Risk Score */}
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className={cn(
                        "grid size-12 place-items-center rounded-lg text-sm font-bold tabular-nums",
                        r.aiScore >= 80
                          ? "bg-destructive/10 text-destructive"
                          : r.aiScore >= 50
                          ? "bg-orange-500/10 text-orange-600 dark:text-orange-400"
                          : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      )}
                    >
                      {r.aiScore ?? Math.max(10, 90 - queue.indexOf(r) * 4)}%
                    </div>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Risk</span>
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    {/* Header row */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold capitalize">{r.reason}</span>
                      <Badge
                        variant="outline"
                        className={cn("text-[10px] h-5 px-1.5", priority.color)}
                      >
                        <PriorityIcon className="size-3 mr-1" />
                        {r.priority}
                      </Badge>
                      <StatusBadge status={status.variant} />
                      <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                        {r.targetType}
                      </Badge>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}
                      </span>
                    </div>

                    {/* Target info */}
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs">
                        <span className="text-muted-foreground">Target:</span>
                        <code className="font-mono text-foreground">{r.targetId}</code>
                      </div>
                      <Button variant="ghost" size="sm" className="h-6 gap-1 text-xs" asChild>
                        <Link to={`/${r.targetType}s/$id`} params={{ id: r.targetId }}>
                          <Eye className="size-3" /> View
                        </Link>
                      </Button>
                    </div>

                    {/* Reporter info */}
                    <div className="mt-3 flex items-center gap-3">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Avatar className="size-6">
                          <AvatarImage src={avatarUrl(r.reporter?.handle ?? r.reporterId)} />
                          <AvatarFallback className="text-[10px]">
                            {r.reporter?.name?.[0] ?? "?"}
                          </AvatarFallback>
                        </Avatar>
                        <span>
                          Reported by <span className="font-medium text-foreground">{r.reporter?.name ?? "Unknown"}</span>
                        </span>
                      </div>
                      {r.notes && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MessageSquare className="size-3" />
                          <span className="line-clamp-1 max-w-[200px]">{r.notes}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    {r.status === "open" ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 h-8 border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-600"
                          disabled={updateStatus.isPending}
                          onClick={() => updateStatus.mutate({ id: r.id, status: "resolved" })}
                        >
                          <CheckCircle2 className="size-3.5" /> Resolve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 h-8 border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                          disabled={updateStatus.isPending}
                          onClick={() => updateStatus.mutate({ id: r.id, status: "dismissed" })}
                        >
                          <XCircle className="size-3.5" /> Dismiss
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="size-8 p-0"
                          asChild
                        >
                          <Link to="/moderation/$reportId" params={{ reportId: r.id }}>
                            <MoreHorizontal className="size-4" />
                          </Link>
                        </Button>
                      </>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={r.status === "resolved" ? "default" : "secondary"}
                          className={cn(
                            "text-xs h-6",
                            r.status === "resolved"
                              ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          {r.status === "resolved" ? (
                            <CheckCircle2 className="size-3 mr-1" />
                          ) : (
                            <XCircle className="size-3 mr-1" />
                          )}
                          {status.label}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {r.resolvedAt && formatDistanceToNow(new Date(r.resolvedAt), { addSuffix: true })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Load more */}
        {filteredQueue.length > 0 && filteredQueue.length >= 12 && (
          <div className="mt-4 pt-4 border-t text-center">
            <Button variant="ghost" size="sm">
              Load more reports
            </Button>
          </div>
        )}
      </SectionCard>
    </div>
  );
}