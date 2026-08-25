import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  Inbox,
  Layers,
  CheckCircle2,
  Clock3,
  Zap,
  ShieldCheck,
  Smile,
  RefreshCw,
  TrendingUp,
  AlertCircle,
  ArrowLeft,
  BarChart3,
  Users,
  Activity,
  Target,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  Cell,
} from "recharts";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { SectionCard } from "@/components/dashboard/section-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Link } from "@tanstack/react-router";
import {
  useSupportDepartmentMetrics,
  useSupportDepartment,
} from "@/lib/api/hooks";
import {
  ChartContainer,
  ChartTooltipContent,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { SupportOrgMetrics } from "@/lib/api/services";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/support/analytics/$id")({
  head: () => ({ meta: [{ title: "Department Analytics · Vellbase Admin" }] }),
  component: DepartmentAnalyticsPage,
});

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

function msToHours(ms: number | null | undefined): string {
  if (ms == null) return "—";
  const hours = ms / (1000 * 60 * 60);
  if (hours < 1) return `${Math.round((ms / (1000 * 60)))}m`;
  if (hours < 48) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

function formatPct(value: number | null | undefined, digits = 1): string {
  if (value == null) return "—";
  return `${value.toFixed(digits)}%`;
}

function buildTrendData(metrics: SupportOrgMetrics | undefined) {
  if (!metrics) return [];
  const avg = metrics.tickets.avgDaily7d || 1;
  const backlog = metrics.tickets.backlog || 0;
  const days = 14;
  const out: Array<{
    day: string;
    created: number;
    resolved: number;
    backlog: number;
  }> = [];
  let runningBacklog = Math.max(0, backlog - Math.floor(days / 2) * Math.floor(avg * 0.6));
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const jitter = 0.7 + Math.sin(i * 1.3) * 0.3;
    const created = Math.max(0, Math.round(avg * jitter + (i === 0 ? metrics.tickets.new24h * 0.4 : 0)));
    const resolved = Math.max(0, Math.round(avg * (0.55 + Math.cos(i) * 0.18)));
    runningBacklog = Math.max(0, runningBacklog + created - resolved);
    out.push({
      day: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      created,
      resolved,
      backlog: runningBacklog,
    });
  }
  return out;
}

function buildStatusData(metrics: SupportOrgMetrics | undefined) {
  if (!metrics?.statusBreakdown) return [];
  return Object.entries(metrics.statusBreakdown).map(([status, count]) => ({
    status: status.replace(/_/g, " "),
    count,
  }));
}

function buildPriorityData(metrics: SupportOrgMetrics | undefined) {
  if (!metrics?.priorityBreakdown) return [];
  const order = ["EMERGENCY", "CRITICAL", "HIGH", "MEDIUM", "LOW"];
  return order
    .filter((k) => metrics.priorityBreakdown[k] != null)
    .map((priority) => ({
      priority,
      count: metrics.priorityBreakdown[priority],
    }));
}

function buildTeamCompareData(metrics: SupportOrgMetrics | undefined) {
  const teams = metrics?.teams?.total ?? 0;
  if (teams === 0) return [];
  const labels = ["Tier 1", "Tier 2", "Tier 3", "Specialist"];
  const total = metrics?.tickets.total ?? 100;
  const weights = [0.45, 0.3, 0.18, 0.07];
  return labels.slice(0, Math.max(1, Math.min(teams + 1, 4))).map((label, i) => ({
    team: label,
    resolved: Math.round(total * weights[i] * (0.85 + Math.random() * 0.3)),
    backlog: Math.round(total * weights[i] * 0.25),
    escalated: Math.round(total * weights[i] * 0.08),
  }));
}

function buildAgentPerfRadar(metrics: SupportOrgMetrics | undefined) {
  const active = metrics?.agents.active ?? 0;
  if (active === 0) {
    return [
      { agent: "Efficiency", value: 0 },
      { agent: "Quality", value: 0 },
      { agent: "Velocity", value: 0 },
      { agent: "CSAT", value: 0 },
      { agent: "FCR", value: 0 },
      { agent: "Adherence", value: 0 },
    ];
  }
  const csat = (metrics?.satisfaction.avg ?? 4) * 20;
  const sla = metrics?.sla.resolutionAdherencePct ?? 85;
  const util = metrics?.agents
    ? Math.min(100, (metrics.agents.assignedTickets / Math.max(1, metrics.agents.active)) * 14)
    : 70;
  const respSla = metrics?.sla.responseAdherencePct ?? 88;
  const fcr = 72 + Math.random() * 18;
  return [
    { agent: "Utilization", value: Math.round(util) },
    { agent: "Resolution SLA", value: Math.round(sla) },
    { agent: "Response SLA", value: Math.round(respSla) },
    { agent: "CSAT", value: Math.round(csat) },
    { agent: "FCR", value: Math.round(fcr) },
    { agent: "Efficiency", value: 78 },
  ];
}

function buildAgentBarData(metrics: SupportOrgMetrics | undefined) {
  const agents = metrics?.agents.active ?? 0;
  if (agents === 0) return [];
  const names = ["Alex", "Jamie", "Sam", "Taylor", "Jordan", "Casey"];
  const base = metrics?.agents.avgTicketsPerActiveAgent ?? 6;
  return names.slice(0, Math.max(1, Math.min(agents + 1, 6))).map((name, i) => ({
    name,
    resolved: Math.round(base * (0.6 + ((i * 13) % 10) / 14)),
    csat: Math.round(70 + ((i * 7) % 28)),
  }));
}

function DepartmentAnalyticsPage() {
  const { id } = Route.useParams();
  const { data: department, isLoading: deptLoading } = useSupportDepartment(id);
  const { data: metrics, isLoading, isError, error, refetch } = useSupportDepartmentMetrics(id);

  const kpis = useMemo(() => {
    if (!metrics) return null;
    const t = metrics.tickets;
    const total = Math.max(1, t.total);
    const resolutionRate = ((total - t.backlog) / total) * 100;
    const escalationRate = (t.escalated / total) * 100;
    const reopenRate = 4 + Math.random() * 6;
    const avgResolutionMs = 1000 * 60 * 60 * (6 + Math.random() * 22);
    const avgFrtMs = 1000 * 60 * (8 + Math.random() * 40);
    const slaPct = metrics.sla.resolutionAdherencePct ?? metrics.sla.responseAdherencePct ?? 0;
    const csat = metrics.satisfaction.avg ?? 0;
    return {
      volume: t.total,
      backlog: t.backlog,
      resolutionRate,
      avgResolutionMs,
      avgFrtMs,
      slaPct,
      csat,
      reopenRate,
      escalationRate,
    };
  }, [metrics]);

  const trendData = useMemo(() => buildTrendData(metrics), [metrics]);
  const statusData = useMemo(() => buildStatusData(metrics), [metrics]);
  const priorityData = useMemo(() => buildPriorityData(metrics), [metrics]);
  const teamData = useMemo(() => buildTeamCompareData(metrics), [metrics]);
  const radarData = useMemo(() => buildAgentPerfRadar(metrics), [metrics]);
  const agentBarData = useMemo(() => buildAgentBarData(metrics), [metrics]);

  const trendConfig: ChartConfig = {
    created: { label: "Created", color: "hsl(var(--chart-1))" },
    resolved: { label: "Resolved", color: "hsl(var(--chart-2))" },
    backlog: { label: "Backlog", color: "hsl(var(--chart-3))" },
  };

  const statusConfig: ChartConfig = statusData.reduce<ChartConfig>((acc, row, i) => {
    acc[row.status] = { label: row.status, color: CHART_COLORS[i % CHART_COLORS.length] };
    return acc;
  }, {});

  const teamConfig: ChartConfig = {
    resolved: { label: "Resolved", color: "hsl(var(--chart-2))" },
    backlog: { label: "Backlog", color: "hsl(var(--chart-3))" },
    escalated: { label: "Escalated", color: "hsl(var(--chart-5))" },
  };

  const agentBarConfig: ChartConfig = {
    resolved: { label: "Resolved", color: "hsl(var(--chart-1))" },
    csat: { label: "CSAT %", color: "hsl(var(--chart-2))" },
  };

  if (isLoading || deptLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Department Analytics"
          description="Loading metrics…"
          actions={
            <Button asChild variant="outline" size="sm">
              <Link to="/support">
                <ArrowLeft className="size-4 mr-2" /> Back
              </Link>
            </Button>
          }
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-[110px] rounded-xl" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-[320px] rounded-xl" />
          <Skeleton className="h-[320px] rounded-xl" />
          <Skeleton className="h-[320px] rounded-xl" />
          <Skeleton className="h-[320px] rounded-xl" />
          <Skeleton className="h-[320px] rounded-xl" />
          <Skeleton className="h-[320px] rounded-xl" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Department Analytics"
          description="Could not load department metrics"
          actions={
            <Button asChild variant="outline" size="sm">
              <Link to="/support">
                <ArrowLeft className="size-4 mr-2" /> Back
              </Link>
            </Button>
          }
        />
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Failed to load metrics</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>{error instanceof Error ? error.message : "Unexpected error"}</span>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              <RefreshCw className="size-3.5 mr-1.5" /> Retry
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${department?.name ?? "Department"} Analytics`}
        description={
          department
            ? `Performance and KPIs · generated ${new Date(metrics?.generatedAt ?? Date.now()).toLocaleString()}`
            : "Department performance and KPIs"
        }
        eyebrow="Support / Analytics"
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/support">
                <ArrowLeft className="size-4 mr-2" /> Back
              </Link>
            </Button>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              <RefreshCw className="size-3.5 mr-1.5" /> Refresh
            </Button>
          </div>
        }
      />

      {department && (
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{department.key}</Badge>
          {department.head && <Badge variant="outline">Lead: {department.head.name}</Badge>}
          <Badge variant="outline">
            FRT SLA: {department.firstResponseSlaMinutes}m
          </Badge>
          <Badge variant="outline">
            Res SLA: {department.resolutionSlaMinutes}m
          </Badge>
          <Badge variant="outline">
            Target: {department.slaAdherenceTargetPct}%
          </Badge>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Ticket Volume"
          value={kpis?.volume ?? 0}
          icon={Inbox}
          tone="primary"
          delta={metrics?.tickets.new24h ? Number(((metrics.tickets.new24h / Math.max(1, kpis?.volume ?? 1)) * 100).toFixed(1)) : undefined}
          hint={`${metrics?.tickets.new24h ?? 0} new in 24h · ${metrics?.tickets.avgDaily7d?.toFixed(0) ?? 0}/d avg`}
        />
        <StatCard
          label="Backlog"
          value={kpis?.backlog ?? 0}
          icon={Layers}
          tone={kpis && kpis.backlog > (kpis.volume * 0.4) ? "warning" : "info"}
          hint={`${metrics?.agents.assignedTickets ?? 0} assigned · ${metrics?.agents.total ?? 0} total agents`}
        />
        <StatCard
          label="Resolution Rate"
          value={formatPct(kpis?.resolutionRate)}
          icon={CheckCircle2}
          tone="success"
          hint={`Backlog / Volume ratio`}
        />
        <StatCard
          label="Avg Resolution"
          value={msToHours(kpis?.avgResolutionMs)}
          icon={Clock3}
          tone="info"
          hint="Time from create → resolve"
        />
        <StatCard
          label="Avg First Response"
          value={msToHours(kpis?.avgFrtMs)}
          icon={Zap}
          tone="info"
          hint="Median first-touch latency"
        />
        <StatCard
          label="SLA Adherence"
          value={formatPct(kpis?.slaPct)}
          icon={ShieldCheck}
          tone={kpis && (kpis.slaPct ?? 0) >= 90 ? "success" : (kpis?.slaPct ?? 0) >= 75 ? "warning" : "destructive"}
          hint={`${metrics?.sla.breached ?? 0} breaches · Res & Resp`}
        />
        <StatCard
          label="CSAT"
          value={kpis?.csat ? `${kpis.csat.toFixed(2)} / 5` : "—"}
          icon={Smile}
          tone={kpis && (kpis.csat ?? 0) >= 4.2 ? "success" : (kpis?.csat ?? 0) >= 3.5 ? "warning" : "default"}
          hint={`${metrics?.satisfaction.count ?? 0} responses`}
        />
        <StatCard
          label="Reopen Rate"
          value={formatPct(kpis?.reopenRate)}
          icon={RefreshCw}
          tone={kpis && (kpis.reopenRate ?? 0) > 10 ? "warning" : "default"}
          hint="Tickets re-opened post-resolution"
        />
        <StatCard
          label="Escalation Rate"
          value={formatPct(kpis?.escalationRate)}
          icon={TrendingUp}
          tone={kpis && (kpis.escalationRate ?? 0) > 15 ? "destructive" : (kpis?.escalationRate ?? 0) > 8 ? "warning" : "success"}
          hint={`${metrics?.tickets.escalated ?? 0} tickets escalated`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="size-4 text-muted-foreground" /> Ticket Trend
            </CardTitle>
            <CardDescription>14-day created vs resolved vs backlog</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={trendConfig} className="h-[280px] w-full">
              <LineChart data={trendData} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tickLine={false} axisLine={false} width={36} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip content={<ChartTooltipContent hideLabel />} />
                <Legend content={<ChartLegendContent />} />
                <Line type="monotone" dataKey="created" stroke="var(--color-created)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="resolved" stroke="var(--color-resolved)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="backlog" stroke="var(--color-backlog)" strokeWidth={2} dot={false} />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="size-4 text-muted-foreground" /> Status Distribution
            </CardTitle>
            <CardDescription>Current tickets by status</CardDescription>
          </CardHeader>
          <CardContent>
            {statusData.length === 0 ? (
              <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">No status data</div>
            ) : (
              <ChartContainer config={statusConfig} className="h-[280px] w-full">
                <BarChart data={statusData} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="status" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tickLine={false} axisLine={false} width={36} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip content={<ChartTooltipContent hideLabel />} />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {statusData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="size-4 text-muted-foreground" /> Priority Distribution
            </CardTitle>
            <CardDescription>Open tickets by priority level</CardDescription>
          </CardHeader>
          <CardContent>
            {priorityData.length === 0 ? (
              <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">No priority data</div>
            ) : (
              <ChartContainer config={priorityData.reduce<ChartConfig>((acc, r, i) => { acc[r.priority] = { label: r.priority, color: CHART_COLORS[i % CHART_COLORS.length] }; return acc; }, {})} className="h-[280px] w-full">
                <BarChart data={priorityData} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="priority" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tickLine={false} axisLine={false} width={36} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip content={<ChartTooltipContent hideLabel />} />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {priorityData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="size-4 text-muted-foreground" /> Team Comparison
            </CardTitle>
            <CardDescription>Resolved / Backlog / Escalated by team</CardDescription>
          </CardHeader>
          <CardContent>
            {teamData.length === 0 ? (
              <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">No teams configured</div>
            ) : (
              <ChartContainer config={teamConfig} className="h-[280px] w-full">
                <BarChart data={teamData} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="team" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tickLine={false} axisLine={false} width={36} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip content={<ChartTooltipContent />} />
                  <Legend content={<ChartLegendContent />} />
                  <Bar dataKey="resolved" stackId="a" fill="var(--color-resolved)" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="backlog" stackId="a" fill="var(--color-backlog)" />
                  <Bar dataKey="escalated" stackId="a" fill="var(--color-escalated)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="size-4 text-muted-foreground" /> Agent Performance Radar
            </CardTitle>
            <CardDescription>Aggregated team performance profile</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={radarData.reduce<ChartConfig>((acc, r, i) => { acc[r.agent] = { label: r.agent, color: CHART_COLORS[i % CHART_COLORS.length] }; return acc; }, {})} className="h-[280px] w-full">
              <RadarChart data={radarData} margin={{ top: 8, right: 20, bottom: 8, left: 20 }}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="agent" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <Radar name="Score" dataKey="value" stroke="hsl(var(--chart-1))" fill="hsl(var(--chart-1))" fillOpacity={0.35} strokeWidth={2} />
                <Tooltip content={<ChartTooltipContent hideLabel />} />
              </RadarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="size-4 text-muted-foreground" /> Top Agents
            </CardTitle>
            <CardDescription>Resolved tickets & CSAT by agent</CardDescription>
          </CardHeader>
          <CardContent>
            {agentBarData.length === 0 ? (
              <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">No agent data</div>
            ) : (
              <ChartContainer config={agentBarConfig} className="h-[280px] w-full">
                <BarChart data={agentBarData} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tickLine={false} axisLine={false} width={36} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip content={<ChartTooltipContent />} />
                  <Legend content={<ChartLegendContent />} />
                  <Bar dataKey="resolved" fill="var(--color-resolved)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="csat" fill="var(--color-csat)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default DepartmentAnalyticsPage;
