"use client";

import { useRouter } from "@tanstack/react-router";
import {
  Users,
  Ticket,
  Clock,
  CheckCircle2,
  AlertCircle,
  Building2,
  Shield,
  ChevronRight,
  RefreshCw,
  Loader2,
  Eye,
  Star,
  Target,
  Activity,
  BarChart3,
  Download,
} from "lucide-react";
import { useState, useMemo, useCallback, useEffect, type ComponentType } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/page-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatCard } from "@/components/dashboard/stat-card";
import { Shimmer, ChartSkeleton } from "@/components/dashboard/skeletons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePermissions } from "@/lib/auth/hooks";
import {
  useSupportDashboardStats,
  useSupportTickets,
  useSupportAgents,
  useSupportDepartments,
  useSupportTeams,
  useSupportTicketPriorities,
  useSupportSLAAdherence,
  useSupportAgentActivity,
  useSupportTicketStatusDistribution,
  useSupportDepartmentScorecard,
  useRecentSupportActivity,
  useSupportEscalationTrends,
  useSupportSatisfactionTrends,
} from "@/lib/api/hooks";
import { cn } from "@/lib/utils";



// ─── Configuration ───

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  NEW: { label: "New", color: "text-blue-600", bg: "bg-blue-100", dot: "bg-blue-500" },
  ASSIGNED: { label: "Assigned", color: "text-purple-600", bg: "bg-purple-100", dot: "bg-purple-500" },
  IN_PROGRESS: { label: "In Progress", color: "text-amber-600", bg: "bg-amber-100", dot: "bg-amber-500" },
  WAITING_ON_CUSTOMER: { label: "Waiting Customer", color: "text-orange-600", bg: "bg-orange-100", dot: "bg-orange-500" },
  WAITING_ON_INTERNAL: { label: "Waiting Internal", color: "text-cyan-600", bg: "bg-cyan-100", dot: "bg-cyan-500" },
  ESCALATED: { label: "Escalated", color: "text-rose-600", bg: "bg-rose-100", dot: "bg-rose-500" },
  RESOLVED: { label: "Resolved", color: "text-emerald-600", bg: "bg-emerald-100", dot: "bg-emerald-500" },
  CLOSED: { label: "Closed", color: "text-gray-600", bg: "bg-gray-100", dot: "bg-gray-500" },
  REOPENED: { label: "Reopened", color: "text-sky-600", bg: "bg-sky-100", dot: "bg-sky-500" },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  EMERGENCY: { label: "Emergency", color: "text-rose-600", bg: "bg-rose-100" },
  CRITICAL: { label: "Critical", color: "text-orange-600", bg: "bg-orange-100" },
  HIGH: { label: "High", color: "text-amber-600", bg: "bg-amber-100" },
  MEDIUM: { label: "Medium", color: "text-blue-600", bg: "bg-blue-100" },
  LOW: { label: "Low", color: "text-gray-600", bg: "bg-gray-100" },
};

// ─── Sub-components ───

function PriorityBadge({ priority }: { priority: string }) {
  const config = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.MEDIUM;
  return (
    <span className={cn("inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold uppercase", config.bg, config.color)}>
      {config.label}
    </span>
  );
}

function TicketStatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.NEW;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", config.bg, config.color)}>
      <span className={cn("size-1.5 rounded-full", config.dot)} />
      {config.label}
    </span>
  );
}

type QuickActionVariant = "default" | "primary" | "success" | "warning" | "destructive";

function QuickActionCard({
  icon: Icon,
  label,
  description,
  onClick,
  variant = "default",
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  description?: string;
  onClick?: () => void;
  variant?: QuickActionVariant;
}) {
  const variants: Record<QuickActionVariant, string> = {
    default: "border-muted/50 hover:border-foreground/30 hover:bg-muted/30",
    primary: "border-primary/30 hover:border-primary/60 hover:bg-primary/5",
    success: "border-emerald-500/30 hover:border-emerald-500/60 hover:bg-emerald-500/5",
    warning: "border-amber-500/30 hover:border-amber-500/60 hover:bg-amber-500/5",
    destructive: "border-rose-500/30 hover:border-rose-500/60 hover:bg-rose-500/5",
  };
  const iconVariants: Record<QuickActionVariant, string> = {
    default: "text-muted-foreground bg-muted/50",
    primary: "text-primary bg-primary/10",
    success: "text-emerald-500 bg-emerald-500/10",
    warning: "text-amber-500 bg-amber-500/10",
    destructive: "text-rose-500 bg-rose-500/10",
  };

  return (
    <button
      onClick={onClick}
      className={cn("flex items-center gap-4 rounded-xl border-2 p-4 transition-all text-left w-full", variants[variant])}
    >
      <div className={cn("grid size-10 place-items-center rounded-lg shrink-0", iconVariants[variant])}>
        <Icon className="size-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold">{label}</div>
        {description ? (
          <div className="text-xs text-muted-foreground">{description}</div>
        ) : null}
      </div>
      <ChevronRight className="size-4 text-muted-foreground shrink-0" />
    </button>
  );
}

type MetricTone = "primary" | "success" | "warning" | "destructive";

function MetricBar({
  label,
  value,
  max,
  tone = "primary",
}: {
  label: string;
  value: number;
  max: number;
  tone?: MetricTone;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const toneClasses: Record<MetricTone, string> = {
    primary: "[&>div]:bg-primary",
    success: "[&>div]:bg-emerald-500",
    warning: "[&>div]:bg-amber-500",
    destructive: "[&>div]:bg-rose-500",
  };
  const colorClass = toneClasses[tone];
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">{value.toLocaleString()}</span>
      </div>
      <Progress value={pct} className={cn("h-1.5", colorClass)} />
    </div>
  );
}

// ─── Main Component ───

const DATE_RANGE_TO_WINDOW_DAYS: Record<
  "today" | "week" | "month" | "quarter",
  number
> = { today: 1, week: 7, month: 30, quarter: 90 };

function SupportAdminDashboard() {
  const { user } = usePermissions();
  const router = useRouter();
  const [dateRange, setDateRange] = useState<"today" | "week" | "month" | "quarter">("week");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  const windowDays = DATE_RANGE_TO_WINDOW_DAYS[dateRange];

  // ─── Data Hooks ───
  const dashboardStats = useSupportDashboardStats({ range: dateRange });
  const ticketsQ = useSupportTickets({ limit: 10, status: "NEW" });
  const agentsQ = useSupportAgents({ limit: 6, isActive: true });
  const departmentsQ = useSupportDepartments({ limit: 100 });
  const teamsQ = useSupportTeams({ limit: 100 });
  const prioritiesQ = useSupportTicketPriorities();
  const slaQ = useSupportSLAAdherence({ windowDays });
  const agentActivityQ = useSupportAgentActivity({ limit: 10 });
  const statusDistQ = useSupportTicketStatusDistribution();
  const scorecardQ = useSupportDepartmentScorecard({ windowDays: 30 });
  const recentActivityQ = useRecentSupportActivity({ limit: 10 });
  const escalationQ = useSupportEscalationTrends({ windowDays: 30 });
  const satisfactionQ = useSupportSatisfactionTrends({ windowDays: 30 });

  const { data: stats, isLoading: statsLoading } = dashboardStats;
  const { data: tickets, isLoading: ticketsLoading } = ticketsQ;
  const { data: agents, isLoading: agentsLoading } = agentsQ;
  const { data: departments } = departmentsQ;
  const { data: teams } = teamsQ;
  const { data: priorities } = prioritiesQ;
  const { data: slaAdherence, isLoading: slaLoading } = slaQ;
  const { data: agentActivity, isLoading: activityLoading } = agentActivityQ;
  const { data: statusDistribution } = statusDistQ;
  const { data: scorecard, isLoading: scorecardLoading } = scorecardQ;
  const { data: recentActivity, isLoading: recentLoading } = recentActivityQ;
  const { data: escalationTrends } = escalationQ;
  const { data: satisfactionTrends } = satisfactionQ;

  const loading = statsLoading || ticketsLoading || agentsLoading || scorecardLoading || recentLoading || activityLoading;
  const hasErrors =
    dashboardStats.isError ||
    ticketsQ.isError ||
    agentsQ.isError ||
    departmentsQ.isError ||
    teamsQ.isError;

  // ─── Computed Values ───
  const totalTickets = stats?.totalTickets ?? 0;
  const openTickets = stats?.openTickets ?? 0;
  const resolvedToday = stats?.resolvedToday ?? 0;
  const avgResponseTimeMs = stats?.avgResponseTime ?? null;
  const avgResolutionTimeMs = stats?.avgResolutionTime ?? null;
  const slaAdherenceRate =
    slaAdherence?.resolutionAdherencePct ?? stats?.slaAdherenceRate ?? 0;
  const customerSatisfaction =
    scorecard && scorecard.length > 0
      ? scorecard.reduce((s, c) => s + (c.metrics.avgSatisfaction ?? 0), 0) /
        scorecard.length
      : 0;
  const escalatedTickets = stats?.escalatedTickets ?? 0;
  const unassignedTickets = stats?.unassignedTickets ?? 0;
  const reopenedTickets = stats?.reopenedTickets ?? 0;
  const activeAgents = stats?.activeAgents ?? 0;

  const avgResponseMinutes =
    avgResponseTimeMs != null ? Math.max(0, Math.round(avgResponseTimeMs / 60_000)) : 0;
  const avgResolutionHours =
    avgResolutionTimeMs != null
      ? Math.max(0, Math.round(avgResolutionTimeMs / 3_600_000))
      : 0;

  const recentTickets = tickets?.data ?? [];
  const topAgents = agents?.data ?? [];
  const departmentList = departments?.data ?? [];
  const teamList = teams?.data ?? [];

  const greeting = useCallback(() => {
    const now = new Date();
    const hour = now.getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  // Build a department-id -> scorecard map so the SLA card can use real data.
  const deptScorecardMap = useMemo(() => {
    const map = new Map<string, { slaPct: number | null; csat: number | null }>();
    if (!scorecard) return map;
    for (const sc of scorecard) {
      map.set(sc.id, {
        slaPct: sc.metrics.slaResolutionAdherencePct,
        csat: sc.metrics.avgSatisfaction,
      });
    }
    return map;
  }, [scorecard]);

  // Agent activity map for enrichment (ticketsResolved, escalations)
  const agentActivityMap = useMemo(() => {
    const map = new Map<string, { ticketsResolved: number; escalations: number; utilizationPct: number | null }>();
    if (!agentActivity) return map;
    for (const row of agentActivity) {
      map.set(row.agentId, {
        ticketsResolved: row.ticketsResolved,
        escalations: row.escalations,
        utilizationPct: row.utilizationPct,
      });
    }
    return map;
  }, [agentActivity]);

  // Derived deltas for stat cards. Semantics: positive delta renders as a
  // green "up" arrow, negative as a red "down" arrow. We therefore invert the
  // sign for metrics where "up" is bad (open tickets, escalations).
  const trends = useMemo(() => {
    const last24h = stats?.newLast24h ?? 0;
    const baseline = Math.max(1, (stats?.totalTickets ?? 0) / Math.max(windowDays, 1));
    const ticketPct =
      baseline > 0 ? Math.round(((last24h - baseline) / baseline) * 1000) / 10 : 0;
    // Open tickets: more is WORSE → invert so an increase shows red/down.
    const openRaw =
      stats?.totalTickets && stats.totalTickets > 0
        ? Math.round(((openTickets - totalTickets / 2) / Math.max(1, totalTickets)) * 1000) / 10
        : 0;
    const openTrendDelta = -openRaw;
    // SLA: higher adherence is BETTER → no inversion.
    const slaTrendDelta =
      slaAdherence?.responseAdherencePct != null
        ? Math.round((slaAdherence.responseAdherencePct - 90) * 10) / 10
        : 0;
    // Escalations: more is WORSE → invert.
    const lastEscalations = escalationTrends?.slice(-7).reduce((s, p) => s + p.escalations, 0) ?? 0;
    const prevEscalations = escalationTrends?.slice(-14, -7).reduce((s, p) => s + p.escalations, 0) ?? 0;
    const escRaw =
      prevEscalations > 0
        ? Math.round(((lastEscalations - prevEscalations) / prevEscalations) * 1000) / 10
        : 0;
    const escTrendDelta = -escRaw;
    // Resolved: more is BETTER → no inversion.
    const resolvedTrendDelta =
      baseline > 0 ? Math.round(((resolvedToday - baseline) / baseline) * 1000) / 10 : 0;
    return {
      totalTickets: ticketPct,
      openTickets: openTrendDelta,
      resolvedToday: resolvedTrendDelta,
      escalatedTickets: escTrendDelta,
      slaAdherence: slaTrendDelta,
    };
  }, [stats, totalTickets, openTickets, resolvedToday, slaAdherence, escalationTrends, windowDays]);

  // ─── Automatic refresh ───
  useEffect(() => {
    const id = window.setInterval(() => {
      // Best-effort background refresh; no spinner or toast so users don't
      // see spurious notifications. React Query dedupes concurrent calls.
      void dashboardStats.refetch();
      void ticketsQ.refetch();
      void agentsQ.refetch();
      void departmentsQ.refetch();
      void teamsQ.refetch();
      void statusDistQ.refetch();
      void recentActivityQ.refetch();
      void escalationQ.refetch();
      void satisfactionQ.refetch();
      void scorecardQ.refetch();
      void slaQ.refetch();
      void agentActivityQ.refetch();
      void prioritiesQ.refetch();
    }, 60_000);
    return () => window.clearInterval(id);
    // We intentionally refetch once per dateRange change only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        dashboardStats.refetch(),
        ticketsQ.refetch(),
        agentsQ.refetch(),
        departmentsQ.refetch(),
        teamsQ.refetch(),
        statusDistQ.refetch(),
        recentActivityQ.refetch(),
        escalationQ.refetch(),
        satisfactionQ.refetch(),
        scorecardQ.refetch(),
        slaQ.refetch(),
        agentActivityQ.refetch(),
        prioritiesQ.refetch(),
      ]);
      toast.success("Dashboard refreshed");
    } catch (error) {
      toast.error("Failed to refresh dashboard");
    } finally {
      setIsRefreshing(false);
    }
  }, [
    dashboardStats,
    ticketsQ,
    agentsQ,
    departmentsQ,
    teamsQ,
    statusDistQ,
    recentActivityQ,
    escalationQ,
    satisfactionQ,
    scorecardQ,
    slaQ,
    agentActivityQ,
    prioritiesQ,
  ]);

  const handleExport = useCallback(async () => {
    try {
      const url = "/support/dashboard/report?format=csv";
      // Use fetch first so we show a real error if there is one.
      const res = await fetch(url, { method: "HEAD" });
      if (!res.ok) throw new Error("Export failed");
      window.open(url, "_blank", "noopener,noreferrer");
      toast.success("Export started");
    } catch {
      toast.error("Failed to export dashboard");
    }
  }, []);

  const openTicketsRoute = () =>
    router.navigate({ to: "/support/tickets" });
  const openAgentsRoute = () => router.navigate({ to: "/support/agents" });
  const openDepartmentsRoute = () => router.navigate({ to: "/support/departments" });
  const openTicketRoute = (id: string) =>
    router.navigate({ to: "/support/tickets/$ticketId", params: { ticketId: id } });
  const openAgentRoute = (_userId: string) => router.navigate({ to: "/support/agents" });

  // ─── Render ───

  return (
    <div className="space-y-6">
      {hasErrors ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <div className="flex-1">
            <div className="font-semibold">Couldn't load some dashboard data</div>
            <div className="mt-0.5 text-xs text-rose-600/80">
              Some stats may be stale or missing. Click Refresh to try again, or check your
              connection.
            </div>
          </div>
          <Button variant="outline" size="sm" className="shrink-0" onClick={handleRefresh} disabled={isRefreshing}>
            {isRefreshing ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            <span className="ml-1.5">Retry</span>
          </Button>
        </div>
      ) : null}

      {/* ─── Page Header ─── */}
      <PageHeader
        eyebrow="Support Dashboard"
        title={`${greeting()}, ${user?.name ?? "Support Admin"} 👋`}
        description="Real-time overview of support operations, team performance, and customer satisfaction."
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg border bg-background p-1">
              {[
                { value: "today", label: "Today" },
                { value: "week", label: "Week" },
                { value: "month", label: "Month" },
                { value: "quarter", label: "Quarter" },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setDateRange(value as typeof dateRange)}
                  className={cn(
                    "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                    dateRange === value
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                >
                  <RefreshCw className={cn("size-4", isRefreshing && "animate-spin")} />
                  <span className="hidden sm:inline">Refresh</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh dashboard (auto-refreshes every minute)</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExport}>
                  <Download className="size-4" />
                  <span className="hidden sm:inline">Export</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Export data</TooltipContent>
            </Tooltip>
          </div>
        }
      />

      {/* ─── Stats Overview ─── */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <StatCard
          label="Total Tickets"
          value={totalTickets.toLocaleString()}
          icon={Ticket}
          tone="primary"
          loading={loading}
          delta={!loading ? trends.totalTickets : undefined}
        />
        <StatCard
          label="Open Tickets"
          value={openTickets.toLocaleString()}
          icon={Clock}
          tone="warning"
          loading={loading}
          delta={!loading ? trends.openTickets : undefined}
        />
        <StatCard
          label="Resolved Today"
          value={resolvedToday.toLocaleString()}
          icon={CheckCircle2}
          tone="success"
          loading={loading}
          delta={!loading ? trends.resolvedToday : undefined}
        />
        <StatCard
          label="Escalated"
          value={escalatedTickets.toLocaleString()}
          icon={AlertCircle}
          tone="destructive"
          loading={loading}
          delta={!loading ? trends.escalatedTickets : undefined}
        />
        <StatCard
          label="SLA Adherence"
          value={`${slaAdherenceRate ? slaAdherenceRate.toFixed(1) : "—"}%`}
          icon={Target}
          tone={slaAdherenceRate >= 90 ? "success" : "warning"}
          loading={slaLoading}
          delta={!slaLoading ? trends.slaAdherence : undefined}
        />
        <StatCard
          label="CSAT Score"
          value={customerSatisfaction ? customerSatisfaction.toFixed(1) : "—"}
          icon={Star}
          tone="success"
          loading={loading}
        />
      </div>

      {/* ─── Quick Actions ─── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <QuickActionCard
          icon={Ticket}
          label="New Tickets"
          description={`${openTickets} open · ${unassignedTickets} unassigned`}
          variant="primary"
          onClick={openTicketsRoute}
        />
        <QuickActionCard
          icon={Users}
          label="Agent Management"
          description={`${activeAgents} active · ${topAgents.length} online`}
          variant="success"
          onClick={openAgentsRoute}
        />
        <QuickActionCard
          icon={Building2}
          label="Departments"
          description={`${departmentList.length} departments · ${teamList.length} teams`}
          variant="warning"
          onClick={openDepartmentsRoute}
        />
        <QuickActionCard
          icon={Shield}
          label="SLA Settings"
          description="Configure SLA targets and policies"
          variant="destructive"
          onClick={() => router.navigate({ to: "/support/teams" })}
        />
      </div>

      {/* ─── Main Content Tabs ─── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full max-w-lg grid-cols-4">
          <TabsTrigger value="overview" className="gap-1.5">
            <BarChart3 className="size-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="tickets" className="gap-1.5">
            <Ticket className="size-4" />
            Tickets
          </TabsTrigger>
          <TabsTrigger value="agents" className="gap-1.5">
            <Users className="size-4" />
            Agents
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-1.5">
            <Activity className="size-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

        {/* ─── Overview Tab ─── */}
        <TabsContent value="overview" className="space-y-4">
          {/* SLA & Performance */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <SectionCard className="lg:col-span-2" title="SLA Adherence" description="Department SLA performance">
              {slaLoading || scorecardLoading ? (
                <ChartSkeleton height={160} />
              ) : departmentList.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  No departments configured yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {departmentList.slice(0, 5).map((dept) => {
                    const sc = deptScorecardMap.get(dept.id);
                    const slaPct = sc?.slaPct ?? null;
                    const pct = slaPct ?? 0;
                    const tone =
                      slaPct == null
                        ? "[&>div]:bg-muted-foreground/30"
                        : pct >= 90
                        ? "[&>div]:bg-emerald-500"
                        : pct >= 75
                        ? "[&>div]:bg-amber-500"
                        : "[&>div]:bg-rose-500";
                    const valueCls =
                      slaPct == null
                        ? "text-muted-foreground"
                        : pct >= 90
                        ? "text-emerald-500"
                        : pct >= 75
                        ? "text-amber-500"
                        : "text-rose-500";
                    return (
                      <div key={dept.id} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{dept.name}</span>
                          <span className={cn("font-medium tabular-nums", valueCls)}>
                            {slaPct == null ? "—" : `${slaPct.toFixed(1)}%`}
                          </span>
                        </div>
                        <Progress value={pct} className={cn("h-1.5", tone)} />
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>

            <SectionCard title="Quick Stats" description="Key performance indicators">
              {loading ? (
                <div className="space-y-3">
                  <Shimmer className="h-4 w-full" />
                  <Shimmer className="h-4 w-full" />
                  <Shimmer className="h-4 w-full" />
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Avg Response Time</span>
                    <span className="font-medium tabular-nums">{avgResponseMinutes}m</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Avg Resolution Time</span>
                    <span className="font-medium tabular-nums">{avgResolutionHours}h</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Active Agents</span>
                    <span className="font-medium tabular-nums">{activeAgents}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Unassigned Tickets</span>
                    <span className="font-medium tabular-nums text-amber-500">{unassignedTickets}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Reopened Tickets</span>
                    <span className="font-medium tabular-nums text-rose-500">{reopenedTickets}</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Departments</span>
                    <span className="font-medium tabular-nums">{departmentList.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Teams</span>
                    <span className="font-medium tabular-nums">{teamList.length}</span>
                  </div>
                </div>
              )}
            </SectionCard>
          </div>

          {/* Top Agents & Recent Tickets */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <SectionCard title="Top Agents" description="Most active support agents">
              {agentsLoading ? (
                <div className="space-y-3">
                  <Shimmer className="h-12 w-full" />
                  <Shimmer className="h-12 w-full" />
                  <Shimmer className="h-12 w-full" />
                </div>
              ) : topAgents.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  No active agents yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {topAgents.slice(0, 5).map((agent, index) => {
                    const enriched = agentActivityMap.get(agent.userId);
                    const resolved = enriched?.ticketsResolved ?? agent.ticketsResolved ?? 0;
                    const csatRaw = deptScorecardMap.get(agent.department?.id ?? "")?.csat;
                    const csat = csatRaw != null ? csatRaw : 0;
                    return (
                      <button
                        key={agent.id}
                        onClick={() => openAgentRoute(agent.userId)}
                        className="flex items-center gap-3 w-full text-left p-2 -mx-2 rounded-lg hover:bg-muted/40 transition-colors"
                      >
                        <span className="text-xs text-muted-foreground w-5">#{index + 1}</span>
                        <Avatar className="size-8">
                          <AvatarImage src={agent.user?.avatar ?? undefined} />
                          <AvatarFallback className="text-[10px]">
                            {(agent.user?.name ?? agent.user?.handle ?? "?").slice(0, 1).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {agent.user?.name ?? agent.user?.handle ?? agent.user?.email}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {agent.activeTickets} active · {resolved} resolved
                          </div>
                        </div>
                        <Badge variant="outline" className="text-[10px]">
                          {csat > 0 ? `${csat.toFixed(1)} ★` : "— ★"}
                        </Badge>
                      </button>
                    );
                  })}
                </div>
              )}
            </SectionCard>

            <SectionCard title="Recent Tickets" description="Latest incoming tickets">
              {ticketsLoading ? (
                <div className="space-y-3">
                  <Shimmer className="h-12 w-full" />
                  <Shimmer className="h-12 w-full" />
                  <Shimmer className="h-12 w-full" />
                </div>
              ) : recentTickets.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  No recent tickets.
                </div>
              ) : (
                <div className="space-y-3">
                  {recentTickets.slice(0, 5).map((ticket) => (
                    <div
                      key={ticket.id}
                      className="flex items-center gap-3 hover:bg-muted/30 p-2 rounded-lg transition-colors"
                    >
                      <Ticket className="size-4 text-muted-foreground shrink-0" />
                      <button
                        onClick={() => openTicketRoute(ticket.id)}
                        className="flex-1 min-w-0 text-left"
                      >
                        <div className="text-sm font-medium truncate">{ticket.subject}</div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                          <TicketStatusBadge status={ticket.status} />
                          <PriorityBadge priority={ticket.priority} />
                          <span>{formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true })}</span>
                        </div>
                      </button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 shrink-0"
                        onClick={() => openTicketRoute(ticket.id)}
                      >
                        <Eye className="size-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>
        </TabsContent>

        {/* ─── Tickets Tab ─── */}
        <TabsContent value="tickets" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <SectionCard className="lg:col-span-2" title="Ticket Distribution" description="Status breakdown">
              {statusDistribution && statusDistribution.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {statusDistribution.map((row) => {
                    const config = STATUS_CONFIG[row.status] || STATUS_CONFIG.NEW;
                    return (
                      <div key={row.status} className="rounded-lg border p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <span className={cn("size-1.5 rounded-full", config.dot)} />
                          <span className="text-xs text-muted-foreground">{row.label}</span>
                        </div>
                        <div className="mt-1 text-2xl font-bold tabular-nums">{row.count}</div>
                        <div className="text-[10px] text-muted-foreground">{row.percentage}%</div>
                      </div>
                    );
                  })}
                </div>
              ) : loading ? (
                <ChartSkeleton height={120} />
              ) : (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  No status data available.
                </div>
              )}
            </SectionCard>

            <SectionCard title="Priority Distribution">
              {priorities && priorities.length > 0 ? (
                <div className="space-y-3">
                  {priorities.map((row) => {
                    const config = PRIORITY_CONFIG[row.priority] || PRIORITY_CONFIG.MEDIUM;
                    return (
                      <div key={row.priority} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className={cn("font-medium", config.color)}>{row.label}</span>
                          <span className="font-medium tabular-nums">{row.count}</span>
                        </div>
                        <Progress
                          value={row.percentage}
                          className={cn("h-1.5", config.bg.replace("bg-", "[&>div]:bg-"))}
                        />
                      </div>
                    );
                  })}
                </div>
              ) : loading ? (
                <ChartSkeleton height={120} />
              ) : (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  No priority data available.
                </div>
              )}
            </SectionCard>
          </div>

          <SectionCard title="Recent Activity" padded={false}>
            {recentActivity && recentActivity.length > 0 ? (
              <div className="divide-y">
                {recentActivity.slice(0, 8).map((activity) => {
                  const toneDot =
                    activity.severity === "success"
                      ? "bg-emerald-500"
                      : activity.severity === "warning"
                      ? "bg-amber-500"
                      : activity.severity === "danger"
                      ? "bg-rose-500"
                      : "bg-muted-foreground/40";
                  return (
                    <div key={activity.id} className="flex items-center gap-4 px-5 py-3 hover:bg-muted/30 transition-colors">
                      <Avatar className="size-8 shrink-0">
                        {activity.agentAvatar ? (
                          <AvatarImage src={activity.agentAvatar} />
                        ) : null}
                        <AvatarFallback className="bg-muted text-[10px] font-medium">
                          {activity.agentName?.slice(0, 1).toUpperCase() || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm flex items-center gap-2 flex-wrap">
                          <span className={cn("size-1.5 rounded-full shrink-0", toneDot)} />
                          <span className="font-medium truncate">{activity.agentName}</span>
                          <span className="text-muted-foreground">
                            {activity.action}
                          </span>
                          {activity.ticketNumber && (
                            <span className="font-mono text-xs text-muted-foreground bg-muted/50 rounded px-1.5 py-0.5">
                              #{activity.ticketNumber}
                            </span>
                          )}
                        </div>
                        {activity.ticketSubject && (
                          <div className="mt-0.5 text-xs text-muted-foreground truncate">
                            {activity.ticketSubject}
                          </div>
                        )}
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : recentLoading ? (
              <div className="p-8 space-y-3">
                <Shimmer className="h-10 w-full" />
                <Shimmer className="h-10 w-full" />
                <Shimmer className="h-10 w-full" />
              </div>
            ) : (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No recent activity
              </div>
            )}
          </SectionCard>
        </TabsContent>

        {/* ─── Agents Tab ─── */}
        <TabsContent value="agents" className="space-y-4">
          {topAgents.length === 0 && !agentsLoading ? (
            <SectionCard>
              <div className="p-8 text-center text-sm text-muted-foreground">
                No agents to display.
              </div>
            </SectionCard>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {topAgents.slice(0, 6).map((agent) => {
                const enriched = agentActivityMap.get(agent.userId);
                const resolved = enriched?.ticketsResolved ?? agent.ticketsResolved ?? 0;
                const esc = enriched?.escalations ?? agent.escalations ?? 0;
                const util = enriched?.utilizationPct ?? null;
                const deptSc = deptScorecardMap.get(agent.department?.id ?? "");
                const csat = deptSc?.csat ?? null;
                return (
                  <SectionCard
                    key={agent.id}
                    className="hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => openAgentRoute(agent.userId)}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="size-12">
                        <AvatarImage src={agent.user?.avatar ?? undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary font-medium">
                          {(agent.user?.name ?? agent.user?.handle ?? "?")
                            .slice(0, 1)
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold truncate">
                          {agent.user?.name ?? agent.user?.handle ?? agent.user?.email}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <Ticket className="size-3" />
                            {agent.activeTickets} active
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="size-3" />
                            {resolved} resolved
                          </span>
                          {esc > 0 && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1 text-rose-500">
                                <AlertCircle className="size-3" />
                                {esc} escalations
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <Badge variant="outline" className="gap-1 shrink-0">
                        <Star className="size-3 fill-amber-400 text-amber-500" />
                        {csat != null ? csat.toFixed(1) : "—"}
                      </Badge>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg border p-2 text-center">
                        <div className="text-sm font-bold tabular-nums">
                          {avgResponseMinutes}m
                        </div>
                        <div className="text-muted-foreground">Avg Response</div>
                      </div>
                      <div className="rounded-lg border p-2 text-center">
                        <div className="text-sm font-bold tabular-nums">
                          {avgResolutionHours}h
                        </div>
                        <div className="text-muted-foreground">Avg Resolution</div>
                      </div>
                    </div>
                    {util != null && (
                      <div className="mt-3">
                        <MetricBar label="Utilization" value={util} max={100} tone={util >= 80 ? "warning" : "success"} />
                      </div>
                    )}
                  </SectionCard>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ─── Analytics Tab ─── */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <SectionCard title="Escalation Trends" description="Escalations over time">
              {escalationTrends && escalationTrends.length > 0 ? (
                <EscalationChart points={escalationTrends.slice(-14)} />
              ) : loading ? (
                <ChartSkeleton height={200} />
              ) : (
                <div className="h-[200px] grid place-items-center text-sm text-muted-foreground">
                  No escalation data available.
                </div>
              )}
            </SectionCard>

            <SectionCard title="Satisfaction Trends" description="CSAT score over time">
              {satisfactionTrends && satisfactionTrends.length > 0 ? (
                <SatisfactionChart points={satisfactionTrends.slice(-14)} />
              ) : loading ? (
                <ChartSkeleton height={200} />
              ) : (
                <div className="h-[200px] grid place-items-center text-sm text-muted-foreground">
                  No satisfaction data available.
                </div>
              )}
            </SectionCard>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Chart helpers ─── Extracted so bar heights are robust against
// all-zero datasets (division by zero would otherwise collapse to NaN/Infinity).

function EscalationChart({ points }: { points: Array<{ date: string; escalations: number }> }) {
  const maxVal = Math.max(1, ...points.map((p) => p.escalations));
  return (
    <div className="h-[200px] flex items-end justify-between gap-2 px-1">
      {points.map((point, index) => {
        const heightPct = Math.max(4, Math.round((point.escalations / maxVal) * 100));
        return (
          <Tooltip key={index}>
            <TooltipTrigger asChild>
              <div className="flex-1 flex flex-col items-center gap-1 group min-w-0">
                <div
                  className="w-full rounded-t bg-rose-500/30 transition-all group-hover:bg-rose-500/60"
                  style={{ height: `${(heightPct / 100) * 180}px` }}
                />
                <div className="text-[8px] text-muted-foreground truncate w-full text-center tabular-nums">
                  {format(new Date(point.date), "MMM d")}
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top">
              <div className="text-xs">
                <div className="font-semibold">{format(new Date(point.date), "MMMM do")}</div>
                <div className="text-muted-foreground">{point.escalations} escalations</div>
              </div>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

function SatisfactionChart({
  points,
}: {
  points: Array<{ date: string; avgRating: number; percentage: number }>;
}) {
  // Use percentage which is already bounded to [0, 100] derived from the
  // 5-star rating; avoids raw division issues.
  const maxPct = Math.max(1, ...points.map((p) => p.percentage));
  return (
    <div className="h-[200px] flex items-end justify-between gap-2 px-1">
      {points.map((point, index) => {
        const barHeight = Math.max(4, Math.round((point.percentage / maxPct) * 100));
        return (
          <Tooltip key={index}>
            <TooltipTrigger asChild>
              <div className="flex-1 flex flex-col items-center gap-1 group min-w-0">
                <div
                  className="w-full rounded-t bg-emerald-500/30 transition-all group-hover:bg-emerald-500/60"
                  style={{ height: `${(barHeight / 100) * 180}px` }}
                />
                <div className="text-[8px] text-muted-foreground truncate w-full text-center tabular-nums">
                  {format(new Date(point.date), "MMM d")}
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top">
              <div className="text-xs">
                <div className="font-semibold">{format(new Date(point.date), "MMMM do")}</div>
                <div className="text-muted-foreground">
                  {point.avgRating.toFixed(1)} ★ · {point.percentage}%
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

export { SupportAdminDashboard };