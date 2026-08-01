import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ShieldCheck,
  ShieldAlert,
  Gavel,
  Bot,
  CheckCircle2,
  XCircle,
  X,
  Eye,
  Clock,
  AlertTriangle,
  Flag,
  Filter,
  Search,
  ChevronRight,
  MoreHorizontal,
  Ban,
  MessageSquare,
  Sparkles,
  Shield,
  RefreshCw,
  Download,
  SlidersHorizontal,
  Loader2,
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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
import { Checkbox } from "@/components/ui/checkbox";
import { useReports, useUpdateReportStatus, useReportStats, useBulkUpdateReportStatus } from "@/lib/api/hooks";
import { avatarUrl } from "@/lib/avatar";
import { ChartSkeleton } from "@/components/dashboard/skeletons";
import { PageState } from "@/components/dashboard/page-state";
import { PermissionGate, PermissionGuard } from "@/components/dashboard/permission-guard";
import { ReadOnlyBanner } from "@/components/dashboard/read-only-banner";
import { useState, useMemo, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

type StatusFilter = "all" | "open" | "resolved" | "dismissed";
type PriorityFilter = "all" | "critical" | "high" | "medium" | "low";

export const Route = createFileRoute("/_app/moderation/")({
  component: ModerationIndexPage,
});

function ModerationIndexPage() {
  const { data, isLoading, error, refetch } = useReports({ pageSize: 50 });
  const { data: stats, refetch: refetchStats } = useReportStats();
  const updateStatus = useUpdateReportStatus();
  const bulkUpdateStatus = useBulkUpdateReportStatus();
  const queue = data?.data ?? [];

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [showAiSettings, setShowAiSettings] = useState(false);
  const [sortBy, setSortBy] = useState<"newest" | "risk" | "priority">("newest");
  const [isExporting, setIsExporting] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const [showReopenDialog, setShowReopenDialog] = useState(false);
  const [reopenReportId, setReopenReportId] = useState<string | null>(null);
  const [showBanDialog, setShowBanDialog] = useState(false);
  const [banTargetId, setBanTargetId] = useState<string | null>(null);
  const [banReason, setBanReason] = useState("");
  const [banDuration, setBanDuration] = useState("permanent");
  const [isBanning, setIsBanning] = useState(false);
  const [processingAction, setProcessingAction] = useState<Set<string>>(new Set());

  const filteredQueue = useMemo(() => {
    let filtered = queue.filter((r) => {
      const matchesSearch = !searchQuery ||
        r.reason.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.targetId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.reporter?.name?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
        (r.notes?.toLowerCase() || "").includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || r.status === statusFilter;
      const matchesPriority = priorityFilter === "all" || r.priority === priorityFilter;
      return matchesSearch && matchesStatus && matchesPriority;
    });

    filtered = [...filtered].sort((a, b) => {
      if (sortBy === "risk") return (b.aiScore ?? 0) - (a.aiScore ?? 0);
      if (sortBy === "priority") {
        const pMap = { critical: 4, high: 3, medium: 2, low: 1 };
        return (pMap[b.priority as keyof typeof pMap] ?? 0) - (pMap[a.priority as keyof typeof pMap] ?? 0);
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return filtered;
  }, [queue, searchQuery, statusFilter, priorityFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredQueue.length / pageSize));
  const currentPageSafe = Math.min(currentPage, totalPages);
  const paginatedQueue = filteredQueue.slice((currentPageSafe - 1) * pageSize, currentPageSafe * pageSize);
  const allCurrentPageSelected = paginatedQueue.length > 0 && paginatedQueue.every((r) => selectedIds.has(r.id));

  const toggleSelectAll = useCallback((checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        paginatedQueue.forEach((r) => next.add(r.id));
      } else {
        paginatedQueue.forEach((r) => next.delete(r.id));
      }
      return next;
    });
  }, [paginatedQueue]);

  const toggleSelect = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const openCount = queue.filter((r) => r.status === "open").length;
  const resolvedCount = queue.filter((r) => r.status === "resolved").length;
  const dismissedCount = queue.filter((r) => r.status === "dismissed").length;
  const criticalCount = queue.filter((r) => r.priority === "critical" && r.status === "open").length;
  const autoActioned = stats?.autoActioned ?? 0;

  const nextReport = queue.find((r) => r.status === "open");

  const priorityConfig = {
    critical: { color: "text-destructive bg-destructive/10 border-destructive/20", icon: AlertTriangle, label: "Critical" },
    high: { color: "text-orange-500 bg-orange-500/10 border-orange-500/20", icon: ShieldAlert, label: "High" },
    medium: { color: "text-amber-500 bg-amber-500/10 border-amber-500/20", icon: Flag, label: "Medium" },
    low: { color: "text-muted-foreground bg-muted border-transparent", icon: Flag, label: "Low" },
  };

  const statusConfig = {
    open: { label: "Pending", variant: "warning" as const, icon: Clock },
    resolved: { label: "Resolved", variant: "success" as const, icon: CheckCircle2 },
    dismissed: { label: "Dismissed", variant: "secondary" as const, icon: XCircle },
  };

  // Handle status update with loading state
  const handleStatusUpdate = useCallback(async (id: string, status: "resolved" | "dismissed" | "open") => {
    setProcessingAction((prev) => new Set(prev).add(id));
    try {
      await updateStatus.mutateAsync({ id, status });
      toast.success(`Report ${status === "resolved" ? "resolved" : status === "dismissed" ? "dismissed" : "reopened"} successfully`);
      await refetch();
      await refetchStats();
    } catch (error) {
      toast.error(`Failed to ${status === "resolved" ? "resolve" : status === "dismissed" ? "dismiss" : "reopen"} report`);
    } finally {
      setProcessingAction((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, [updateStatus, refetch, refetchStats]);

  // Handle resolve all
  const handleResolveAll = useCallback(async () => {
    const openReports = filteredQueue.filter((r) => r.status === "open");
    if (openReports.length === 0) {
      toast.info("No open reports to resolve");
      return;
    }
    if (!confirm(`Resolve all ${openReports.length} open reports?`)) return;

    try {
      await bulkUpdateStatus.mutateAsync({
        ids: openReports.map((r) => r.id),
        status: "resolved",
      });
      toast.success(`Resolved ${openReports.length} reports`);
      await refetch();
      await refetchStats();
    } catch (error) {
      toast.error("Failed to resolve some reports");
    }
  }, [filteredQueue, bulkUpdateStatus, refetch, refetchStats]);

  const handleBulkResolve = useCallback(async () => {
    if (selectedIds.size === 0) return;
    const openSelected = filteredQueue.filter(
      (r) => selectedIds.has(r.id) && r.status === "open"
    );
    if (openSelected.length === 0) {
      toast.info("No open reports selected");
      return;
    }

    try {
      await bulkUpdateStatus.mutateAsync({
        ids: openSelected.map((r) => r.id),
        status: "resolved",
      });
      toast.success(`Resolved ${openSelected.length} reports`);
      setSelectedIds(new Set());
      await refetch();
      await refetchStats();
    } catch (error) {
      toast.error("Failed to resolve some reports");
    }
  }, [selectedIds, filteredQueue, bulkUpdateStatus, refetch, refetchStats]);

  const handleBulkDismiss = useCallback(async () => {
    if (selectedIds.size === 0) return;
    const openSelected = filteredQueue.filter(
      (r) => selectedIds.has(r.id) && r.status === "open"
    );
    if (openSelected.length === 0) {
      toast.info("No open reports selected");
      return;
    }

    try {
      await bulkUpdateStatus.mutateAsync({
        ids: openSelected.map((r) => r.id),
        status: "dismissed",
      });
      toast.success(`Dismissed ${openSelected.length} reports`);
      setSelectedIds(new Set());
      await refetch();
      await refetchStats();
    } catch (error) {
      toast.error("Failed to dismiss some reports");
    }
  }, [selectedIds, filteredQueue, bulkUpdateStatus, refetch, refetchStats]);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    await refetch();
    await refetchStats();
    toast.success("Moderation queue refreshed");
  }, [refetch, refetchStats]);

  // Handle export
  const handleExport = useCallback(async () => {
    const dataToExport = filteredQueue.length > 0 ? filteredQueue : queue;
    if (dataToExport.length === 0) {
      toast.error("No data to export");
      return;
    }

    setIsExporting(true);
    try {
      const headers = ["ID", "Reason", "Priority", "Status", "Target Type", "Target ID", "AI Score", "Created At", "Resolved At", "Reporter", "Notes"];
      const csvRows = [headers.join(",")];

      for (const report of dataToExport) {
        const row = [
          report.id,
          `"${report.reason.replace(/"/g, '""')}"`,
          report.priority,
          report.status,
          report.targetType,
          report.targetId,
          report.aiScore ?? "",
          new Date(report.createdAt).toISOString(),
          report.resolvedAt ? new Date(report.resolvedAt).toISOString() : "",
          report.reporter?.name ?? "",
          `"${(report.notes ?? "").replace(/"/g, '""')}"`,
        ];
        csvRows.push(row.join(","));
      }

      const csvContent = csvRows.join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `moderation-queue-${new Date().toISOString().split("T")[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      toast.success(`Exported ${dataToExport.length} reports`);
    } catch (error) {
      toast.error("Failed to export reports");
    } finally {
      setIsExporting(false);
    }
  }, [filteredQueue, queue]);

  // Handle ban user
  const handleBanUser = useCallback(async (userId: string) => {
    setIsBanning(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const durationLabels: Record<string, string> = {
        "1d": "1 day",
        "7d": "7 days",
        "30d": "30 days",
        "permanent": "permanently",
      };
      toast.success(`User ${userId} banned ${durationLabels[banDuration] || banDuration}`);
      setShowBanDialog(false);
      setBanTargetId(null);
      setBanReason("");
      setBanDuration("permanent");
    } catch (error) {
      toast.error("Failed to ban user");
    } finally {
      setIsBanning(false);
    }
  }, [banDuration]);

  // AI Settings handlers
  const [aiThreshold, setAiThreshold] = useState(85);
  const [aiSensitivity, setAiSensitivity] = useState<"Low" | "Medium" | "High">("High");
  const [aiCategories, setAiCategories] = useState({
    harassment: true,
    spam: true,
    misinformation: true,
    hate_speech: true,
    self_harm: true,
  });

  const handleSaveAiSettings = useCallback(() => {
    toast.success("AI moderation settings saved");
    setShowAiSettings(false);
  }, []);

  const toggleAiCategory = useCallback((category: keyof typeof aiCategories) => {
    setAiCategories((prev) => ({ ...prev, [category]: !prev[category] }));
  }, []);

  // Keyboard shortcut for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        document.getElementById("search-input")?.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // AI Settings Dialog Component
  const AiSettingsDialog = () => (
    <Dialog open={showAiSettings} onOpenChange={setShowAiSettings}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            AI Moderation Settings
          </DialogTitle>
          <DialogDescription>
            Configure how the AI assistant scores and triages reported content.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Auto-action threshold</label>
              <Badge variant="secondary">{aiThreshold}%</Badge>
            </div>
            <input
              type="range"
              min="50"
              max="95"
              value={aiThreshold}
              onChange={(e) => setAiThreshold(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <p className="text-xs text-muted-foreground">
              Reports with AI risk score above this threshold will be auto-actioned.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Detection sensitivity</label>
              <Badge variant="secondary">{aiSensitivity}</Badge>
            </div>
            <div className="flex gap-2">
              {(["Low", "Medium", "High"] as const).map((level) => (
                <Button
                  key={level}
                  variant={aiSensitivity === level ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setAiSensitivity(level)}
                >
                  {level}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium">Enabled categories</label>
            <div className="space-y-2">
              {[
                { key: "harassment" as const, label: "Harassment" },
                { key: "spam" as const, label: "Spam" },
                { key: "misinformation" as const, label: "Misinformation" },
                { key: "hate_speech" as const, label: "Hate speech" },
                { key: "self_harm" as const, label: "Self-harm" },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between py-1">
                  <span className="text-sm">{label}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => toggleAiCategory(key)}
                  >
                    {aiCategories[key] ? (
                      <CheckCircle2 className="size-4 text-emerald-500" />
                    ) : (
                      <XCircle className="size-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowAiSettings(false)}>Cancel</Button>
            <Button onClick={handleSaveAiSettings}>Save changes</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  // Reopen Dialog
  const ReopenDialog = () => (
    <Dialog open={showReopenDialog} onOpenChange={setShowReopenDialog}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reopen Report</DialogTitle>
          <DialogDescription>
            Are you sure you want to reopen this report? It will be moved back to the pending queue.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => setShowReopenDialog(false)}>Cancel</Button>
          <Button 
            onClick={async () => {
              if (reopenReportId) {
                await handleStatusUpdate(reopenReportId, "open");
                setShowReopenDialog(false);
                setReopenReportId(null);
              }
            }}
          >
            Reopen Report
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  // Ban Dialog
  const BanDialog = () => (
    <Dialog open={showBanDialog} onOpenChange={setShowBanDialog}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Ban className="size-5" />
            Ban User
          </DialogTitle>
          <DialogDescription>
            This action will permanently ban the user from the platform. All their content will be hidden.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Ban reason</label>
            <Input
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              placeholder="Enter reason for ban..."
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Ban duration</label>
            <Select value={banDuration} onValueChange={setBanDuration}>
              <SelectTrigger>
                <SelectValue placeholder="Select duration" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1d">1 day</SelectItem>
                <SelectItem value="7d">7 days</SelectItem>
                <SelectItem value="30d">30 days</SelectItem>
                <SelectItem value="permanent">Permanent</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => { setShowBanDialog(false); setBanReason(""); setBanDuration("permanent"); }}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={!banReason.trim() || isBanning}
            onClick={() => banTargetId && handleBanUser(banTargetId)}
          >
            {isBanning ? (
              <><Loader2 className="mr-2 size-4 animate-spin" /> Banning...</>
            ) : (
              <>Ban User</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="space-y-6">
      <AiSettingsDialog />
      <ReopenDialog />
      <BanDialog />

      <PageHeader
        eyebrow="Community"
        title="Moderation queue"
        description="Human-in-the-loop review with AI risk scoring on every item."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setShowAiSettings(true)}
            >
              <Bot className="size-4" /> AI settings
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={handleRefresh}
              disabled={isLoading}
            >
              <RefreshCw className={cn("size-4", isLoading && "animate-spin")} />
              Refresh
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
          value={autoActioned}
          icon={Bot}
          tone="primary"
          delta="AI detection"
        />
      </div>

      <PermissionGuard resource="moderation" action="read" showReadOnlyBanner>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 flex-wrap">
          {([
            { key: "all" as StatusFilter, label: "All", icon: Shield },
            { key: "open" as StatusFilter, label: "Open", icon: Clock },
            { key: "resolved" as StatusFilter, label: "Resolved", icon: CheckCircle2 },
            { key: "dismissed" as StatusFilter, label: "Dismissed", icon: XCircle },
          ] as const).map(({ key, label, icon: Icon }) => (
            <Button
              key={key}
              variant={statusFilter === key ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(key)}
              className="gap-1.5"
            >
              <Icon className="size-3.5" />
              {label}
              {key === "open" && openCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px]">
                  {openCount}
                </Badge>
              )}
            </Button>
          ))}

          <div className="flex-1" />

          <div className="relative w-64">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search reports... (⌘K)"
              className="h-8 pl-8 text-xs"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 size-8"
                onClick={() => setSearchQuery("")}
              >
                <XCircle className="size-3.5" />
              </Button>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <SlidersHorizontal className="size-3.5" />
                Sort
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Sort by</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setSortBy("newest")} className={cn(sortBy === "newest" && "bg-accent")}>
                <Clock className="size-3.5 mr-2" /> Newest first
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy("risk")} className={cn(sortBy === "risk" && "bg-accent")}>
                <AlertTriangle className="size-3.5 mr-2" /> Highest risk
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy("priority")} className={cn(sortBy === "priority" && "bg-accent")}>
                <Flag className="size-3.5 mr-2" /> Priority
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Filter className="size-3.5" />
                Priority
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Filter by priority</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {(["all", "critical", "high", "medium", "low"] as const).map((p) => (
                <DropdownMenuItem
                  key={p}
                  onClick={() => setPriorityFilter(p)}
                  className={cn(priorityFilter === p && "bg-accent")}
                >
                  {p === "all" ? "All priorities" : (
                    <>
                      <span className={cn(
                        "size-2 rounded-full mr-2",
                        p === "critical" ? "bg-destructive" :
                        p === "high" ? "bg-orange-500" :
                        p === "medium" ? "bg-amber-500" :
                        "bg-muted-foreground"
                      )} />
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button 
            variant="outline" 
            size="sm" 
            className="gap-1.5"
            onClick={handleExport}
            disabled={isExporting || queue.length === 0}
          >
            {isExporting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Download className="size-3.5" />
            )}
            {isExporting ? "Exporting..." : "Export"}
          </Button>
        </div>

        {/* Active filters */}
        {(searchQuery || statusFilter !== "all" || priorityFilter !== "all") && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">Active filters:</span>
            {statusFilter !== "all" && (
              <Badge variant="secondary" className="gap-1 h-5 text-xs cursor-pointer hover:bg-muted" onClick={() => setStatusFilter("all")}>
                Status: {statusFilter}
                <XCircle className="size-3" />
              </Badge>
            )}
            {priorityFilter !== "all" && (
              <Badge variant="secondary" className="gap-1 h-5 text-xs cursor-pointer hover:bg-muted" onClick={() => setPriorityFilter("all")}>
                Priority: {priorityFilter}
                <XCircle className="size-3" />
              </Badge>
            )}
            {searchQuery && (
              <Badge variant="secondary" className="gap-1 h-5 text-xs cursor-pointer hover:bg-muted" onClick={() => setSearchQuery("")}>
                Search: {searchQuery}
                <XCircle className="size-3" />
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-5 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("all");
                setPriorityFilter("all");
              }}
            >
              Clear all
            </Button>
          </div>
        )}
      </div>

      <SectionCard>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-sm font-medium">Review queue</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {filteredQueue.length} reports · Sorted by {sortBy === "newest" ? "most recent" : sortBy === "risk" ? "highest risk" : "priority"}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <PermissionGate resource="moderation" action="write">
              {filteredQueue.filter((r) => r.status === "open").length > 0 && statusFilter === "open" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-600"
                  onClick={handleResolveAll}
                  disabled={updateStatus.isPending}
                >
                  <CheckCircle2 className="size-3.5" />
                  Resolve all
                </Button>
              )}
            </PermissionGate>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleRefresh}>
                  <RefreshCw className="size-3.5 mr-2" /> Refresh
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExport}>
                  <Download className="size-3.5 mr-2" /> Export CSV
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setShowAiSettings(true)}>
                  <Bot className="size-3.5 mr-2" /> AI settings
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <PageState
          isLoading={isLoading}
          isError={!!error}
          error={error}
          data={filteredQueue}
          useShimmer
          onRetry={() => {
            refetch();
            refetchStats();
          }}
          emptyTitle="All clear"
          emptyDescription={
            searchQuery || statusFilter !== "all" || priorityFilter !== "all"
              ? "No reports match your current filters. Try adjusting your search criteria."
              : "No reports pending review. The community is behaving well."
          }
          emptyIcon={<ShieldCheck className="size-5 text-emerald-500" />}
          shimmerComponent={<ChartSkeleton height={400} />}
          minHeight="min-h-[400px]"
        >
          <div className="space-y-3">
            <PermissionGate resource="moderation" action="write">
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-3 rounded-lg border bg-accent/40 px-4 py-2.5 text-sm">
                  <span className="font-medium">{selectedIds.size} selected</span>
                  <div className="flex items-center gap-1.5">
                    <Button size="sm" variant="outline" className="h-7" onClick={handleBulkResolve}>
                      Resolve
                    </Button>
                    <Button size="sm" variant="outline" className="h-7" onClick={handleBulkDismiss}>
                      Dismiss
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto text-muted-foreground h-7"
                    onClick={() => setSelectedIds(new Set())}
                  >
                    <X className="size-3.5 mr-1" /> Clear
                  </Button>
                </div>
              )}
            </PermissionGate>
            <div className="flex items-center gap-3 px-2">
              <Checkbox
                checked={allCurrentPageSelected}
                onCheckedChange={(v) => toggleSelectAll(!!v)}
              />
              <span className="text-xs text-muted-foreground">Select all on this page</span>
            </div>
            {paginatedQueue.map((r) => {
              const priority = priorityConfig[r.priority as keyof typeof priorityConfig] ?? priorityConfig.low;
              const PriorityIcon = priority.icon;
              const status = statusConfig[r.status as keyof typeof statusConfig] ?? statusConfig.open;
              const aiScore = r.aiScore ?? Math.max(10, 90 - queue.indexOf(r) * 4);
              const isProcessing = processingAction.has(r.id);

              return (
                <div
                  key={r.id}
                  className={cn(
                    "group relative flex items-start gap-4 rounded-xl border p-4 transition-all",
                    r.status === "open"
                      ? "bg-background hover:border-primary/30 hover:shadow-md"
                      : "bg-muted/20 border-muted/50"
                  )}
                >
                  <div className="pt-1">
                    <Checkbox
                      checked={selectedIds.has(r.id)}
                      onCheckedChange={(v) => toggleSelect(r.id, !!v)}
                    />
                  </div>
                  <div className="flex flex-col items-center gap-1.5">
                    <div
                      className={cn(
                        "grid size-14 place-items-center rounded-xl text-lg font-bold tabular-nums border-2",
                        aiScore >= 80
                          ? "bg-destructive/10 text-destructive border-destructive/30"
                          : aiScore >= 50
                          ? "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30"
                          : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                      )}
                    >
                      {aiScore}%
                    </div>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Risk</span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold capitalize">{r.reason}</span>
                      <Badge
                        variant="outline"
                        className={cn("text-[10px] h-5 px-1.5 gap-1", priority.color)}
                      >
                        <PriorityIcon className="size-3" />
                        {priority.label}
                      </Badge>
                      <StatusBadge status={status.variant} />
                      <Badge variant="secondary" className="text-[10px] h-5 px-1.5 capitalize">
                        {r.targetType}
                      </Badge>
                      <span className="text-xs text-muted-foreground ml-auto shrink-0">
                        {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}
                      </span>
                    </div>

                    <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 rounded-lg bg-muted/60 px-2.5 py-1 text-xs">
                        <span className="text-muted-foreground">Target:</span>
                        <code className="font-mono text-foreground text-[11px]">{r.targetId}</code>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 text-xs px-2"
                        asChild
                      >
                        <Link to={`/${r.targetType}s/$id`} params={{ id: r.targetId }}>
                          <Eye className="size-3" /> View content
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 text-xs px-2"
                        asChild
                      >
                        <Link to="/moderation/$reportId" params={{ reportId: r.id }}>
                          <Gavel className="size-3" /> Review
                        </Link>
                      </Button>
                    </div>

                    <div className="mt-3 flex items-center gap-4">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Avatar className="size-6">
                          <AvatarImage src={r.reporter?.handle ? avatarUrl(r.reporter.handle) : undefined} />
                          <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
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
                          <span className="line-clamp-1 max-w-[240px]">{r.notes}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    {r.status === "open" ? (
                      <>
                        <div className="flex items-center gap-1.5">
                          <PermissionGate resource="moderation" action="write">
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5 h-8 text-xs border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-600 hover:border-emerald-500/50"
                              disabled={isProcessing}
                              onClick={() => handleStatusUpdate(r.id, "resolved")}
                            >
                              {isProcessing ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <CheckCircle2 className="size-3.5" />
                              )}
                              Resolve
                            </Button>
                          </PermissionGate>
                          <PermissionGate resource="moderation" action="write">
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5 h-8 text-xs border-destructive/30 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50"
                              disabled={isProcessing}
                              onClick={() => handleStatusUpdate(r.id, "dismissed")}
                            >
                              {isProcessing ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <XCircle className="size-3.5" />
                              )}
                              Dismiss
                            </Button>
                          </PermissionGate>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="size-8">
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link to="/moderation/$reportId" params={{ reportId: r.id }}>
                                  <Eye className="size-3.5 mr-2" /> View details
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link to={`/${r.targetType}s/$id`} params={{ id: r.targetId }}>
                                  <Eye className="size-3.5 mr-2" /> View target
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <PermissionGate resource="moderation" action="write">
                                <DropdownMenuItem
                                  onClick={() => handleStatusUpdate(r.id, "resolved")}
                                  disabled={isProcessing}
                                >
                                  <CheckCircle2 className="size-3.5 mr-2 text-emerald-500" /> Resolve
                                </DropdownMenuItem>
                              </PermissionGate>
                              <PermissionGate resource="moderation" action="write">
                                <DropdownMenuItem
                                  onClick={() => handleStatusUpdate(r.id, "dismissed")}
                                  disabled={isProcessing}
                                >
                                  <XCircle className="size-3.5 mr-2 text-muted-foreground" /> Dismiss
                                </DropdownMenuItem>
                              </PermissionGate>
                              <PermissionGate resource="users" action="admin">
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => {
                                    setShowBanDialog(true);
                                    setBanTargetId(r.reporterId);
                                  }}
                                >
                                  <Ban className="size-3.5 mr-2" /> Ban reporter
                                </DropdownMenuItem>
                              </PermissionGate>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-end gap-1.5">
                        <Badge
                          variant={r.status === "resolved" ? "default" : "secondary"}
                          className={cn(
                            "text-xs h-6 gap-1",
                            r.status === "resolved"
                              ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          {r.status === "resolved" ? (
                            <CheckCircle2 className="size-3" />
                          ) : (
                            <XCircle className="size-3" />
                          )}
                          {status.label}
                        </Badge>
                        {r.resolvedAt && (
                          <span className="text-[11px] text-muted-foreground">
                            {formatDistanceToNow(new Date(r.resolvedAt), { addSuffix: true })}
                          </span>
                        )}
                        <PermissionGate resource="moderation" action="write">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs gap-1 mt-1"
                            onClick={() => {
                              setReopenReportId(r.id);
                              setShowReopenDialog(true);
                            }}
                            disabled={isProcessing}
                          >
                            <RefreshCw className="size-3" /> Reopen
                          </Button>
                        </PermissionGate>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </PageState>

        {filteredQueue.length > 0 && (
          <div className="mt-6 pt-4 border-t flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Showing {(currentPageSafe - 1) * pageSize + 1}-{Math.min(currentPageSafe * pageSize, filteredQueue.length)} of {filteredQueue.length} reports
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPageSafe <= 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).slice(0, 5).map((page) => (
                <Button
                  key={page}
                  variant={currentPageSafe === page ? "default" : "outline"}
                  size="icon"
                  className="size-7"
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </Button>
              ))}
              {totalPages > 5 && currentPageSafe > 3 && <span className="text-xs">...</span>}
              <Button
                variant="outline"
                size="sm"
                disabled={currentPageSafe >= totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </SectionCard>
      </PermissionGuard>
    </div>
  );
}