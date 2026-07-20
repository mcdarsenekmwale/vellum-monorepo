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
import { useReports, useUpdateReportStatus, useReportStats } from "@/lib/api/hooks";
import { avatarUrl } from "@/lib/avatar";
import { ChartSkeleton } from "@/components/dashboard/skeletons";
import { useState, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

type StatusFilter = "all" | "open" | "resolved" | "dismissed";
type PriorityFilter = "all" | "critical" | "high" | "medium" | "low";

export const Route = createFileRoute("/_app/moderation/")({
  component: ModerationIndexPage,
});

function ModerationIndexPage() {
  const { data, isLoading, refetch } = useReports({ pageSize: 50 });
  const { data: stats } = useReportStats();
  const updateStatus = useUpdateReportStatus();
  const queue = data?.data ?? [];

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [showAiSettings, setShowAiSettings] = useState(false);
  const [sortBy, setSortBy] = useState<"newest" | "risk" | "priority">("newest");

  const filteredQueue = useMemo(() => {
    let filtered = queue.filter((r) => {
      const matchesSearch = !searchQuery ||
        r.reason.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.targetId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.reporter?.name?.toLowerCase().includes(searchQuery.toLowerCase());
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

  const handleResolveAll = useCallback(() => {
    const openReports = filteredQueue.filter((r) => r.status === "open");
    if (openReports.length === 0) return;
    if (!confirm(`Resolve all ${openReports.length} open reports?`)) return;
    openReports.forEach((r) => updateStatus.mutate({ id: r.id, status: "resolved" }));
  }, [filteredQueue, updateStatus]);

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

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
              <Badge variant="secondary">85%</Badge>
            </div>
            <input
              type="range"
              min="50"
              max="95"
              defaultValue="85"
              className="w-full accent-primary"
            />
            <p className="text-xs text-muted-foreground">
              Reports with AI risk score above this threshold will be auto-actioned.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Detection sensitivity</label>
              <Badge variant="secondary">High</Badge>
            </div>
            <div className="flex gap-2">
              {(["Low", "Medium", "High"] as const).map((level) => (
                <Button
                  key={level}
                  variant={level === "High" ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                >
                  {level}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium">Enabled categories</label>
            <div className="space-y-2">
              {["Harassment", "Spam", "Misinformation", "Hate speech", "Self-harm"].map((cat) => (
                <div key={cat} className="flex items-center justify-between py-1">
                  <span className="text-sm">{cat}</span>
                  <CheckCircle2 className="size-4 text-emerald-500" />
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowAiSettings(false)}>Cancel</Button>
            <Button onClick={() => setShowAiSettings(false)}>Save changes</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="space-y-6">
      <AiSettingsDialog />

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
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search reports..."
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

          <Button variant="outline" size="sm" className="gap-1.5">
            <Download className="size-3.5" />
            Export
          </Button>
        </div>

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
                <DropdownMenuItem>
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

        {isLoading ? (
          <ChartSkeleton height={400} />
        ) : filteredQueue.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="size-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
              <ShieldCheck className="size-8 text-emerald-500" />
            </div>
            <h3 className="text-lg font-semibold">All clear</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              {searchQuery || statusFilter !== "all" || priorityFilter !== "all"
                ? "No reports match your current filters. Try adjusting your search criteria."
                : "No reports pending review. The community is behaving well."}
            </p>
            {(searchQuery || statusFilter !== "all" || priorityFilter !== "all") && (
              <Button
                variant="outline"
                size="sm"
                className="mt-6 gap-1.5"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                  setPriorityFilter("all");
                }}
              >
                <RefreshCw className="size-3.5" /> Clear filters
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredQueue.map((r) => {
              const priority = priorityConfig[r.priority as keyof typeof priorityConfig] ?? priorityConfig.low;
              const PriorityIcon = priority.icon;
              const status = statusConfig[r.status as keyof typeof statusConfig] ?? statusConfig.open;
              const aiScore = r.aiScore ?? Math.max(10, 90 - queue.indexOf(r) * 4);

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
                          <AvatarImage src={avatarUrl(r.reporter?.handle ?? r.reporterId)} />
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
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 h-8 text-xs border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-600 hover:border-emerald-500/50"
                            disabled={updateStatus.isPending}
                            onClick={() => updateStatus.mutate({ id: r.id, status: "resolved" })}
                          >
                            <CheckCircle2 className="size-3.5" /> Resolve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 h-8 text-xs border-destructive/30 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50"
                            disabled={updateStatus.isPending}
                            onClick={() => updateStatus.mutate({ id: r.id, status: "dismissed" })}
                          >
                            <XCircle className="size-3.5" /> Dismiss
                          </Button>
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
                              <DropdownMenuItem
                                onClick={() => updateStatus.mutate({ id: r.id, status: "resolved" })}
                              >
                                <CheckCircle2 className="size-3.5 mr-2 text-emerald-500" /> Resolve
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => updateStatus.mutate({ id: r.id, status: "dismissed" })}
                              >
                                <XCircle className="size-3.5 mr-2 text-muted-foreground" /> Dismiss
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive">
                                <Ban className="size-3.5 mr-2" /> Ban reporter
                              </DropdownMenuItem>
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
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs gap-1 mt-1"
                          onClick={() => updateStatus.mutate({ id: r.id, status: "open" })}
                          disabled={updateStatus.isPending}
                        >
                          <RefreshCw className="size-3" /> Reopen
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {filteredQueue.length > 0 && (
          <div className="mt-6 pt-4 border-t flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Showing {filteredQueue.length} of {queue.length} reports
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled>
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled>
                Next
              </Button>
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
