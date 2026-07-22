// routes/_app/reports/index.tsx
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ShieldCheck,
  ShieldAlert,
  Gavel,
  Bot,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Eye,
  ArrowUpRight,
  Filter,
  Clock,
  User,
  Flag,
  MoreHorizontal,
  Pencil,
  Trash2,
  RefreshCw,
  Ban,
  MessageSquare,
  ChevronDown,
  Sparkles,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
  Download,
  Mail,
  Check,
  X,
} from "lucide-react";
import { ListPage } from "@/components/dashboard/list-page";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  useReports,
  useUpdateReportStatus,
  useDeleteReport,
  useReportStats,
  useBulkUpdateReportStatus,
  useReportTrends,
  type Report,
} from "@/lib/api/hooks";
import { useAuth } from "@/lib/auth/context";
import { avatarUrl } from "@/lib/avatar";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { AISettingsPanel } from "@/components/dashboard/ai-settings-panel";

export const Route = createFileRoute("/_app/reports")({
  head: () => ({ meta: [{ title: "Reports · Vellum Admin" }] }),
  component: ReportsPage,
});

type StatusFilter = "all" | "pending" | "resolved" | "dismissed";
type PriorityFilter = "all" | "low" | "medium" | "high" | "critical";
type TargetTypeFilter = "all" | "article" | "comment" | "user" | "highlight";
type SortOption = "newest" | "oldest" | "priority";

function ReportsPage() {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useReports({ pageSize: 50 });
  const updateStatus = useUpdateReportStatus();
  const bulkUpdateStatus = useBulkUpdateReportStatus();
  const deleteReport = useDeleteReport();
  const { data: statsData } = useReportStats();
  const { data: trendsData } = useReportTrends(30);
  const { can } = useAuth();
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false);

  const rows = data?.data ?? [];
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [bulkActionOpen, setBulkActionOpen] = useState(false);
  const [bulkActionType, setBulkActionType] = useState<"resolve" | "dismiss" | "delete" | null>(null);
  const [moderationNote, setModerationNote] = useState("");
  const [detailReportId, setDetailReportId] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [targetTypeFilter, setTargetTypeFilter] = useState<TargetTypeFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("newest");

  // ─── Stats ───────────────────────────────────────────────────────────
  const openCount = rows.filter((r) => r.status === "open").length;
  const resolvedCount = rows.filter((r) => r.status === "resolved").length;
  const dismissedCount = rows.filter((r) => r.status === "dismissed").length;
  const criticalCount = rows.filter((r) => r.priority === "critical").length;
  const underReviewCount = rows.filter((r) => r.status === "under_review").length;
  const totalCount = rows.length;

  const avgAiScore = rows.length > 0
    ? Math.round(rows.reduce((sum, r) => sum + (r.aiScore ?? 0), 0) / rows.length)
    : 0;

  // ─── Filtering ───────────────────────────────────────────────────────
  const filteredRows = useMemo(() => {
    let result = [...rows];

    if (statusFilter !== "all") {
      if (statusFilter === "pending") {
        result = result.filter((r) => r.status === "open" || r.status === "under_review");
      } else {
        result = result.filter((r) => r.status === statusFilter);
      }
    }

    if (priorityFilter !== "all") {
      result = result.filter((r) => r.priority === priorityFilter);
    }

    if (targetTypeFilter !== "all") {
      result = result.filter((r) => r.targetType === targetTypeFilter);
    }

    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "oldest":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case "priority": {
          const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
          return (
            (priorityOrder[b.priority as keyof typeof priorityOrder] || 0) -
            (priorityOrder[a.priority as keyof typeof priorityOrder] || 0)
          );
        }
        default:
          return 0;
      }
    });

    return result;
  }, [rows, statusFilter, priorityFilter, targetTypeFilter, sortBy]);

  const hasActiveFilters = statusFilter !== "all" || priorityFilter !== "all" || targetTypeFilter !== "all";

  const clearFilters = useCallback(() => {
    setStatusFilter("all");
    setPriorityFilter("all");
    setTargetTypeFilter("all");
    setSortBy("newest");
    setSelectedRows(new Set());
  }, []);

  // ─── AI Risk Helpers ─────────────────────────────────────────────────
  const getRiskColor = (score: number) => {
    if (score >= 80) return "text-destructive bg-destructive/10 border-destructive/20";
    if (score >= 50) return "text-amber-600 bg-amber-500/10 border-amber-500/20 dark:text-amber-400";
    return "text-emerald-600 bg-emerald-500/10 border-emerald-500/20 dark:text-emerald-400";
  };

  const getRiskLabel = (score: number) => {
    if (score >= 80) return "High";
    if (score >= 50) return "Medium";
    return "Low";
  };

  const getRiskIcon = (score: number) => {
    if (score >= 80) return AlertTriangle;
    if (score >= 50) return ShieldAlert;
    return ShieldCheck;
  };

  // ─── Action Handlers ─────────────────────────────────────────────────
  const handleResolve = useCallback(
    (id: string, note?: string) => {
      updateStatus.mutate(
        { id, status: "resolved", note },
        {
          onSuccess: () => {
            toast.success("Report resolved", { description: "The report has been marked as resolved." });
            setModerationNote("");
          },
          onError: (err) => toast.error("Failed to resolve", { description: err.message }),
        }
      );
    },
    [updateStatus]
  );

  const handleDismiss = useCallback(
    (id: string, note?: string) => {
      updateStatus.mutate(
        { id, status: "dismissed", note },
        {
          onSuccess: () => {
            toast.success("Report dismissed", { description: "The report has been dismissed." });
            setModerationNote("");
          },
          onError: (err) => toast.error("Failed to dismiss", { description: err.message }),
        }
      );
    },
    [updateStatus]
  );

  const handleBulkAction = useCallback(() => {
    if (!bulkActionType || selectedRows.size === 0) return;

    const ids = Array.from(selectedRows);
    const status = bulkActionType === "resolve" ? "resolved" : bulkActionType === "dismiss" ? "dismissed" : null;

    if (bulkActionType === "delete") {
      Promise.all(ids.map((id) => deleteReport.mutateAsync(id)))
        .then(() => {
          toast.success(`${ids.length} reports deleted`);
          setSelectedRows(new Set());
          setBulkActionOpen(false);
        })
        .catch((err) => toast.error("Bulk delete failed", { description: err.message }));
      return;
    }

    if (status) {
      bulkUpdateStatus.mutate(
        { ids, status, note: moderationNote || undefined },
        {
          onSuccess: () => {
            toast.success(`${ids.length} reports ${status}`, {
              description: `All selected reports have been ${status}.`,
            });
            setSelectedRows(new Set());
            setModerationNote("");
            setBulkActionOpen(false);
          },
          onError: (err) => toast.error("Bulk action failed", { description: err.message }),
        }
      );
    }
  }, [bulkActionType, selectedRows, bulkUpdateStatus, deleteReport, moderationNote]);

  const handleExport = useCallback(() => {
    const csv = [
      ["ID", "Target", "Type", "Reason", "Priority", "Status", "AI Score", "Reporter", "Created"].join(","),
      ...filteredRows.map((r) =>
        [
          r.id,
          r.targetId,
          r.targetType,
          r.reason,
          r.priority,
          r.status,
          r.aiScore ?? "N/A",
          r.reporter?.name ?? r.reporterId,
          r.createdAt,
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reports-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Reports exported", { description: "CSV file downloaded." });
  }, [filteredRows]);

  // ─── Report Detail Modal ─────────────────────────────────────────────
  const detailReport = useMemo(
    () => rows.find((r) => r.id === detailReportId),
    [rows, detailReportId]
  );

  const renderHeader = () => (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          loading={isLoading}
          label="Pending"
          value={openCount.toLocaleString()}
          delta={statsData?.openTrend}
          tone="warning"
          icon={ShieldAlert}
        />
        <StatCard
          loading={isLoading}
          label="Critical"
          value={criticalCount.toLocaleString()}
          delta={statsData?.criticalTrend}
          tone="destructive"
          icon={Gavel}
        />
        <StatCard
          loading={isLoading}
          label="Resolved"
          value={resolvedCount.toLocaleString()}
          delta={statsData?.resolvedTrend}
          tone="success"
          icon={ShieldCheck}
        />
        <StatCard
          loading={isLoading}
          label="Avg AI Score"
          value={`${avgAiScore}%`}
          delta={statsData?.aiScoreTrend}
          tone={avgAiScore > 60 ? "destructive" : avgAiScore > 40 ? "warning" : "success"}
          icon={Sparkles}
        />
      </div>
      {/* Trend Chart */}
      <SectionCard className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold">Report Trends</h3>
            <p className="text-xs text-muted-foreground">Reports filed over the last 30 days</p>
          </div>
          <div className="flex items-center gap-2">
            {trendsData ? (
              <Badge variant="outline" className="gap-1">
                {trendsData.trend > 0 ? (
                  <TrendingUp className="size-3 text-emerald-500" />
                ) : trendsData.trend < 0 ? (
                  <TrendingDown className="size-3 text-destructive" />
                ) : (
                  <Minus className="size-3 text-muted-foreground" />
                )}
                {trendsData.trend > 0 ? "+" : ""}{trendsData.trend}% vs last week
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1">
                <RefreshCw className="size-3 text-muted-foreground" />
                Loading...
              </Badge>
            )}
          </div>
        </div>
        <div className="h-32 flex items-end gap-1">
          {trendsData?.daily ? (
            trendsData.daily.map((day, i) => {
              const maxValue = Math.max(...trendsData.daily.map(d => d.total), 1);
              const height = maxValue > 0 ? (day.total / maxValue) * 100 : 10;
              return (
                <div
                  key={i}
                  className="flex-1 rounded-sm bg-primary/10 hover:bg-primary/20 transition-colors relative group"
                  style={{ height: `${Math.max(10, height)}%` }}
                  title={`${day.date}: ${day.total} reports`}
                >
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 text-[10px] bg-popover border rounded px-1.5 py-0.5 whitespace-nowrap z-10">
                    {day.total} reports
                  </div>
                </div>
              );
            })
          ) : (
            Array.from({ length: 30 }).map((_, i) => (
              <div
                key={i}
                className="flex-1 rounded-sm bg-muted/30 animate-pulse"
                style={{ height: `${Math.max(10, Math.random() * 40)}%` }}
              />
            ))
          )}
        </div>
        <div className="flex items-center justify-center gap-4 mt-3 text-[10px] text-muted-foreground">
          <span>30 days ago</span>
          <span>Today</span>
        </div>
      </SectionCard>
    </>
  )

  // ─── Render ──────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Stats Overview */}

      {/* Reports Table */}
      <ListPage<Report>
        title="Reports"
        description="Content and user reports awaiting review."
        eyebrow="Community"
        rows={filteredRows}
        isLoading={isLoading}
        error={error}
        searchKeys={["targetId", "reason", "targetType"]}
        pageSize={15}
        enableSelection={true}
        enableExport={false}
        enablePagination={true}
        emptyTitle="No reports found"
        emptyDescription="All clear! No reports match your current filters."
        renderHeader={renderHeader()}
        actions={
          <div className="flex items-center gap-2">
            {can("reports", "moderate") && (
              <Button size="sm" variant="outline" className="gap-1.5" onClick={handleExport}>
                <Download className="size-4" /> Export
              </Button>
            )}
            {can("reports", "admin") && (
              <Button size="sm" className="gap-1.5"
                onClick={() => setAiSettingsOpen(true)}
              >
                <Bot className="size-4" /> AI Settings
              </Button>
            )}
          </div>
        }
        filters={
          <div className="flex items-center gap-2 flex-wrap">
            {/* Status Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant={statusFilter !== "all" ? "default" : "outline"} size="sm" className="gap-1.5 h-8">
                  <Clock className="size-3.5" />
                  Status
                  <ChevronDown className="size-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>Filter by status</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {(["all", "pending", "resolved", "dismissed"] as const).map((status) => (
                  <DropdownMenuItem
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={cn(statusFilter === status && "bg-accent")}
                  >
                    {status === "all" ? "All statuses" : status.charAt(0).toUpperCase() + status.slice(1)}
                    {statusFilter === status && <Check className="ml-2 size-3.5" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Priority Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant={priorityFilter !== "all" ? "default" : "outline"} size="sm" className="gap-1.5 h-8">
                  <AlertTriangle className="size-3.5" />
                  Priority
                  <ChevronDown className="size-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>Filter by priority</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {(["all", "low", "medium", "high", "critical"] as const).map((priority) => (
                  <DropdownMenuItem
                    key={priority}
                    onClick={() => setPriorityFilter(priority)}
                    className={cn(priorityFilter === priority && "bg-accent")}
                  >
                    {priority === "all" ? "All priorities" : priority.charAt(0).toUpperCase() + priority.slice(1)}
                    {priorityFilter === priority && <Check className="ml-2 size-3.5" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Target Type Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant={targetTypeFilter !== "all" ? "default" : "outline"} size="sm" className="gap-1.5 h-8">
                  <Flag className="size-3.5" />
                  Type
                  <ChevronDown className="size-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>Filter by type</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {(["all", "article", "comment", "user", "highlight"] as const).map((type) => (
                  <DropdownMenuItem
                    key={type}
                    onClick={() => setTargetTypeFilter(type)}
                    className={cn(targetTypeFilter === type && "bg-accent", "capitalize")}
                  >
                    {type === "all" ? "All types" : type}
                    {targetTypeFilter === type && <Check className="ml-2 size-3.5" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Sort */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 h-8">
                  <TrendingUp className="size-3.5" />
                  Sort
                  <ChevronDown className="size-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {([
                  { value: "newest", label: "Newest first" },
                  { value: "oldest", label: "Oldest first" },
                  { value: "priority", label: "Priority" },
                ] as const).map(({ value, label }) => (
                  <DropdownMenuItem
                    key={value}
                    onClick={() => setSortBy(value)}
                    className={cn(sortBy === value && "bg-accent")}
                  >
                    {label}
                    {sortBy === value && <Check className="ml-2 size-3.5" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Active filter badges */}
            {hasActiveFilters && (
              <>
                <div className="h-6 w-px bg-border" />
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground">Active filters:</span>
                  {statusFilter !== "all" && (
                    <Badge variant="secondary" className="gap-1 h-5 text-xs cursor-pointer hover:bg-muted" onClick={() => setStatusFilter("all")}>
                      Status: {statusFilter}
                      <X className="size-3" />
                    </Badge>
                  )}
                  {priorityFilter !== "all" && (
                    <Badge variant="secondary" className="gap-1 h-5 text-xs cursor-pointer hover:bg-muted" onClick={() => setPriorityFilter("all")}>
                      Priority: {priorityFilter}
                      <X className="size-3" />
                    </Badge>
                  )}
                  {targetTypeFilter !== "all" && (
                    <Badge variant="secondary" className="gap-1 h-5 text-xs cursor-pointer hover:bg-muted" onClick={() => setTargetTypeFilter("all")}>
                      Type: {targetTypeFilter}
                      <X className="size-3" />
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 text-xs text-muted-foreground hover:text-foreground"
                    onClick={clearFilters}
                  >
                    Clear all
                  </Button>
                </div>
              </>
            )}
          </div>
        }
        columns={[
          {
            key: "risk",
            header: "Risk",
            className: "w-16",
            cell: (r) => {
              const score = r.aiScore ?? 0;
              const RiskIcon = getRiskIcon(score);
              if (score === 0) {
                return (
                  <div className="flex flex-col items-center gap-0.5">
                    <div
                      className="inline-flex items-center justify-center rounded-md border px-2 py-1 text-xs font-semibold tabular-nums text-muted-foreground bg-muted/50 border-muted"
                      title="AI Risk Score: Not scored"
                    >
                      N/A
                    </div>
                    <span className="text-[10px] text-muted-foreground">Not scored</span>
                  </div>
                );
              }
              return (
                <div className="flex flex-col items-center gap-0.5">
                  <div
                    className={cn(
                      "inline-flex items-center justify-center rounded-md border px-2 py-1 text-xs font-semibold tabular-nums",
                      getRiskColor(score)
                    )}
                    title={`AI Risk Score: ${score}% — ${getRiskLabel(score)}`}
                  >
                    {score}%
                  </div>
                  <span className="text-[10px] text-muted-foreground">{getRiskLabel(score)}</span>
                </div>
              );
            },
          },
          {
            key: "target",
            header: "Target",
            cell: (r) => (
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="line-clamp-1 text-sm font-medium">{r.targetId}</span>
                  <Badge variant="outline" className="text-[10px] h-4 px-1 shrink-0 capitalize">
                    {r.targetType}
                  </Badge>
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="capitalize">{r.reason.replace(/_/g, " ")}</span>
                  <span className="text-muted-foreground/30">·</span>
                  <span>{formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}</span>
                </div>
                {r.description && (
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-1 italic">
                    "{r.description}"
                  </p>
                )}
              </div>
            ),
          },
          {
            key: "reporter",
            header: "Reporter",
            cell: (r) => (
              <div className="flex items-center gap-2">
                <Avatar className="size-6">
                  <AvatarImage
                    src={avatarUrl(r.reporter?.handle ?? r.reporterId)}
                    alt={r.reporter?.name}
                  />
                  <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-medium">
                    {r.reporter?.name?.[0] ?? "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <span className="text-sm truncate block">{r.reporter?.name ?? "Unknown"}</span>
                  <span className="text-[10px] text-muted-foreground">@{r.reporter?.handle ?? r.reporterId}</span>
                </div>
              </div>
            ),
          },
          {
            key: "priority",
            header: "Priority",
            className: "w-20",
            cell: (r) => (
              <div className="flex items-center gap-1.5">
                {r.priority === "critical" && <AlertTriangle className="size-3 text-destructive" />}
                <StatusBadge status={r.priority} />
              </div>
            ),
          },
          {
            key: "status",
            header: "Status",
            className: "w-24",
            cell: (r) => (
              <div className="flex items-center gap-1.5">
                {r.status === "resolved" && <CheckCircle2 className="size-3.5 text-emerald-500" />}
                {r.status === "dismissed" && <XCircle className="size-3.5 text-muted-foreground" />}
                {r.status === "open" && <Clock className="size-3.5 text-amber-500" />}
                {r.status === "under_review" && <Eye className="size-3.5 text-blue-500" />}
                <StatusBadge status={r.status} />
              </div>
            ),
          },
          {
            key: "moderator",
            header: "Moderator",
            className: "hidden lg:table-cell w-28",
            cell: (r) =>
              r.moderator ? (
                <div className="flex items-center gap-2">
                  <Avatar className="size-5">
                    <AvatarFallback className="text-[8px] bg-muted">
                      {r.moderator.name?.[0] ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs truncate">{r.moderator.name}</span>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground italic">Unassigned</span>
              ),
          },
        ]}
        renderRowActions={(r) => (
          <div className="flex items-center justify-end gap-0.5">
            {/* Quick View */}
            <Button
              variant="ghost"
              size="icon"
              className="size-8 hover:text-primary"
              onClick={() => setDetailReportId(r.id)}
              title="Quick view"
            >
              <Eye className="size-4" />
            </Button>

            {/* Resolve / Dismiss for open reports */}
            {can("reports", "moderate") && r.status === "open" && (
              <>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 hover:text-emerald-500"
                      title="Resolve with note"
                    >
                      <CheckCircle2 className="size-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Resolve Report</DialogTitle>
                      <DialogDescription>
                        Add an optional moderation note before resolving this report.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-3">
                      <div className="rounded-md bg-muted p-3 text-sm">
                        <span className="font-medium">Target:</span> {r.targetId} ({r.targetType})
                        <br />
                        <span className="font-medium">Reason:</span> {r.reason}
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`note-resolve-${r.id}`}>Moderation Note</Label>
                        <Textarea
                          id={`note-resolve-${r.id}`}
                          placeholder="Explain your decision..."
                          value={moderationNote}
                          onChange={(e) => setModerationNote(e.target.value)}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setModerationNote("")}>
                        Cancel
                      </Button>
                      <Button
                        onClick={() => handleResolve(r.id, moderationNote)}
                        disabled={updateStatus.isPending}
                        className="gap-1.5"
                      >
                        <CheckCircle2 className="size-4" />
                        Resolve Report
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 hover:text-destructive"
                  onClick={() => handleDismiss(r.id)}
                  disabled={updateStatus.isPending}
                  title="Dismiss"
                >
                  <XCircle className="size-4" />
                </Button>
              </>
            )}

            {/* More Actions Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link to="/reports/$reportId" params={{ reportId: r.id }}>
                    <Eye className="size-4 mr-2" /> View Details
                  </Link>
                </DropdownMenuItem>
                {r.targetType === "article" && (
                  <DropdownMenuItem asChild>
                    <Link to="/articles/$articleId" params={{ articleId: r.targetId }}>
                      <ArrowUpRight className="size-4 mr-2" /> View Target
                    </Link>
                  </DropdownMenuItem>
                )}
                {r.targetType === "user" && (
                  <DropdownMenuItem asChild>
                    <Link to="/users/$userId" params={{ userId: r.targetId }}>
                      <User className="size-4 mr-2" /> View User
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                {can("reports", "moderate") && r.status === "open" && (
                  <>
                    <DropdownMenuItem onClick={() => handleResolve(r.id)}>
                      <CheckCircle2 className="size-4 mr-2 text-emerald-500" /> Resolve
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDismiss(r.id)}>
                      <XCircle className="size-4 mr-2 text-muted-foreground" /> Dismiss
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        updateStatus.mutate({ id: r.id, status: "under_review" })
                      }
                    >
                      <Eye className="size-4 mr-2 text-blue-500" /> Mark Under Review
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                {can("reports", "admin") && (
                  <DropdownMenuItem
                    onClick={() => {
                      if (confirm("Permanently delete this report?")) {
                        deleteReport.mutate(r.id, {
                          onSuccess: () => toast.success("Report deleted"),
                          onError: (err) => toast.error("Delete failed", { description: err.message }),
                        });
                      }
                    }}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="size-4 mr-2" /> Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
        onRowClick={(r) => setDetailReportId(r.id)}
        selectedRows={selectedRows}
        onSelectionChange={setSelectedRows}
        bulkActions={
          selectedRows.size > 0
            ? [
              {
                label: "Resolve",
                icon: CheckCircle2,
                variant: "default" as const,
                onClick: () => {
                  setBulkActionType("resolve");
                  setBulkActionOpen(true);
                },
              },
              {
                label: "Dismiss",
                icon: XCircle,
                variant: "outline" as const,
                onClick: () => {
                  setBulkActionType("dismiss");
                  setBulkActionOpen(true);
                },
              },
              {
                label: "Delete",
                icon: Trash2,
                variant: "destructive" as const,
                onClick: () => {
                  setBulkActionType("delete");
                  setBulkActionOpen(true);
                },
              },
            ]
            : undefined
        }
      />

      {/* ─── Bulk Action Dialog ───────────────────────────────────────── */}
      <Dialog open={bulkActionOpen} onOpenChange={setBulkActionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="capitalize">
              {bulkActionType} {selectedRows.size} Report{selectedRows.size > 1 ? "s" : ""}
            </DialogTitle>
            <DialogDescription>
              {bulkActionType === "delete"
                ? "This action cannot be undone. The selected reports will be permanently removed."
                : `Add an optional note before ${bulkActionType}ing the selected reports.`}
            </DialogDescription>
          </DialogHeader>
          {bulkActionType !== "delete" && (
            <div className="space-y-1.5 py-3">
              <Label htmlFor="bulk-note">Moderation Note (optional)</Label>
              <Textarea
                id="bulk-note"
                placeholder="Explain your decision..."
                value={moderationNote}
                onChange={(e) => setModerationNote(e.target.value)}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkActionOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={bulkActionType === "delete" ? "destructive" : "default"}
              onClick={handleBulkAction}
              disabled={bulkUpdateStatus.isPending || deleteReport.isPending}
              className="gap-1.5"
            >
              {bulkActionType === "resolve" && <CheckCircle2 className="size-4" />}
              {bulkActionType === "dismiss" && <XCircle className="size-4" />}
              {bulkActionType === "delete" && <Trash2 className="size-4" />}
              {bulkActionType === "delete" ? "Permanently Delete" : `Confirm ${bulkActionType}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Quick View Detail Drawer/Modal ───────────────────────────── */}
      <Dialog open={!!detailReportId} onOpenChange={() => setDetailReportId(null)}>
        <DialogContent className="max-w-lg">
          {detailReport && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="capitalize">
                    {detailReport.targetType}
                  </Badge>
                  <StatusBadge status={detailReport.status} />
                  {detailReport.priority === "critical" && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="size-3" /> Critical
                    </Badge>
                  )}
                </div>
                <DialogTitle className="mt-2">Report on {detailReport.targetId}</DialogTitle>
                <DialogDescription>
                  Filed {formatDistanceToNow(new Date(detailReport.createdAt), { addSuffix: true })}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                {/* AI Score */}
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-4 text-primary" />
                    <span className="text-sm font-medium">AI Risk Score</span>
                  </div>
                  <div
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm font-semibold",
                      getRiskColor(detailReport.aiScore ?? 50)
                    )}
                  >
                    {detailReport.aiScore ?? "N/A"}%
                    <span className="text-[10px] font-normal">
                      {getRiskLabel(detailReport.aiScore ?? 50)}
                    </span>
                  </div>
                </div>

                {/* Reporter */}
                <div className="flex items-center gap-3">
                  <Avatar className="size-10">
                    <AvatarImage
                      src={avatarUrl(detailReport.reporter?.handle ?? detailReport.reporterId)}
                    />
                    <AvatarFallback>
                      {detailReport.reporter?.name?.[0] ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="text-sm font-medium">
                      {detailReport.reporter?.name ?? "Unknown"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      @{detailReport.reporter?.handle ?? detailReport.reporterId}
                    </div>
                  </div>
                </div>

                {/* Reason & Description */}
                <div className="space-y-2">
                  <div className="text-sm">
                    <span className="font-medium">Reason:</span>{" "}
                    <span className="capitalize">{detailReport.reason.replace(/_/g, " ")}</span>
                  </div>
                  {detailReport.description && (
                    <div className="rounded-md bg-muted p-3 text-sm italic">
                      "{detailReport.description}"
                    </div>
                  )}
                </div>

                {/* Moderation History */}
                {detailReport.moderationNote && (
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                      Moderation Note
                    </Label>
                    <div className="rounded-md bg-emerald-500/5 border border-emerald-500/10 p-3 text-sm">
                      {detailReport.moderationNote}
                    </div>
                    {detailReport.moderator && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>By {detailReport.moderator.name}</span>
                        {detailReport.resolvedAt && (
                          <>
                            <span>·</span>
                            <span>
                              {formatDistanceToNow(new Date(detailReport.resolvedAt), {
                                addSuffix: true,
                              })}
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2">
                {detailReport.targetType === "article" && (
                  <Button variant="outline" asChild>
                    <Link to="/articles/$articleId" params={{ articleId: detailReport.targetId }}>
                      <ArrowUpRight className="size-4 mr-1.5" /> View Target
                    </Link>
                  </Button>
                )}
                {can("reports", "moderate") && detailReport.status === "open" && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => handleDismiss(detailReport.id)}
                      disabled={updateStatus.isPending}
                    >
                      <XCircle className="size-4 mr-1.5" /> Dismiss
                    </Button>
                    <Button
                      onClick={() => handleResolve(detailReport.id)}
                      disabled={updateStatus.isPending}
                      className="gap-1.5"
                    >
                      <CheckCircle2 className="size-4" /> Resolve
                    </Button>
                  </>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

     
      <AISettingsPanel
        open={aiSettingsOpen}
        onOpenChange={setAiSettingsOpen}
      />
    </div>
  );
}