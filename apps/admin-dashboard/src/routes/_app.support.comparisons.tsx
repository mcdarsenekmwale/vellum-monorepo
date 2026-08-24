import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Trophy,
  BarChart2,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  RefreshCw,
  BarChart3,
  Users,
  Clock,
  ShieldCheck,
  Smile,
  Activity,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { useSupportDepartmentScorecard } from "@/lib/api/hooks";
import type { SupportDepartmentScorecard, SupportOrgHealthGrade } from "@/lib/api/services";
import { cn } from "@/lib/utils";
import {
  ChartContainer,
  ChartTooltipContent,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";

export const Route = createFileRoute("/_app/support/comparisons")({
  head: () => ({ meta: [{ title: "Department Comparisons · Vellum Admin" }] }),
  component: SupportComparisonsPage,
});

const WINDOW_OPTIONS = [7, 14, 30, 60, 90];

const GRADE_TINTS: Record<SupportOrgHealthGrade, string> = {
  A: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 ring-emerald-500/20",
  B: "bg-green-500/15 text-green-400 border-green-500/30 ring-green-500/20",
  C: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30 ring-yellow-500/20",
  D: "bg-orange-500/20 text-orange-400 border-orange-500/30 ring-orange-500/20",
  F: "bg-red-500/20 text-red-400 border-red-500/30 ring-red-500/20",
};

const RANK_MEDALS = [
  "bg-yellow-500/20 text-yellow-400 ring-yellow-500/30",
  "bg-gray-300/15 text-gray-300 ring-gray-300/30",
  "bg-orange-600/20 text-orange-400 ring-orange-500/30",
];

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

type MetricKey =
  | "totalTickets"
  | "slaResponseAdherencePct"
  | "slaResolutionAdherencePct"
  | "avgSatisfaction"
  | "avgInteractionsPerTicket"
  | "agentUtilizationPct";

interface MetricDef {
  key: MetricKey;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  format: (v: number | null) => string;
  max?: number;
  lowerIsBetter?: boolean;
}

const METRICS: MetricDef[] = [
  {
    key: "totalTickets",
    label: "Ticket Volume",
    description: "Total tickets handled in window",
    icon: BarChart3,
    format: (v) => (v == null ? "—" : v.toLocaleString()),
  },
  {
    key: "slaResponseAdherencePct",
    label: "Response SLA",
    description: "% of tickets with first-response within SLA",
    icon: Clock,
    format: (v) => (v == null ? "—" : `${v.toFixed(1)}%`),
    max: 100,
  },
  {
    key: "slaResolutionAdherencePct",
    label: "Resolution SLA",
    description: "% of tickets fully resolved within SLA",
    icon: ShieldCheck,
    format: (v) => (v == null ? "—" : `${v.toFixed(1)}%`),
    max: 100,
  },
  {
    key: "avgSatisfaction",
    label: "Avg CSAT",
    description: "Average customer satisfaction 1–5",
    icon: Smile,
    format: (v) => (v == null ? "—" : `${v.toFixed(2)} / 5`),
    max: 5,
  },
  {
    key: "avgInteractionsPerTicket",
    label: "Interactions / Ticket",
    description: "Average number of touches per ticket",
    icon: Activity,
    format: (v) => (v == null ? "—" : v.toFixed(2)),
    lowerIsBetter: true,
  },
  {
    key: "agentUtilizationPct",
    label: "Agent Utilization",
    description: "% of active agent capacity in use",
    icon: Users,
    format: (v) => (v == null ? "—" : `${v.toFixed(1)}%`),
    max: 100,
  },
];

function gradeBadgeVariant(g: SupportOrgHealthGrade) {
  if (g === "A" || g === "B") return "success";
  if (g === "C") return "warning";
  return "destructive";
}

function HealthBadge({ grade }: { grade: SupportOrgHealthGrade }) {
  return (
    <Badge variant="outline" className={cn("px-2 py-0.5 text-xs font-bold tracking-wider ring-1 ring-inset", GRADE_TINTS[grade])}>
      Grade {grade}
    </Badge>
  );
}

function VarianceCell({ value }: { value: number | null | undefined }) {
  if (value == null) return <span className="text-muted-foreground text-xs">—</span>;
  const pos = value >= 0;
  const cls = pos
    ? "text-emerald-400"
    : "text-red-400";
  const Icon = pos ? ArrowUpRight : value === 0 ? Minus : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-medium tabular-nums", cls)}>
      <Icon className="size-3" />
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

function buildMetricChartData(cards: SupportDepartmentScorecard[], key: MetricKey) {
  return cards
    .map((c) => ({
      name: c.name,
      value: c.metrics[key] ?? 0,
    }))
    .sort((a, b) => b.value - a.value);
}

function SupportComparisonsPage() {
  const [windowDays, setWindowDays] = useState<number>(30);

  const { data, isLoading, isError, error, refetch } = useSupportDepartmentScorecard({
    windowDays,
  });

  const scorecards = useMemo(() => {
    if (!data) return [];
    return [...data].sort((a, b) => b.compositeScore - a.compositeScore);
  }, [data]);

  const bestScore = scorecards[0]?.compositeScore ?? 100;
  const generatedAt = scorecards[0]?.generatedAt;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Department Comparisons"
        description={
          generatedAt
            ? `Side-by-side performance across departments · window: ${windowDays} days · generated ${new Date(generatedAt).toLocaleString()}`
            : "Compare composite scores, health grades, and per-metric trends across departments"
        }
        eyebrow="Support / Comparisons"
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Window</Label>
              <Select
                value={String(windowDays)}
                onValueChange={(v) => setWindowDays(Number(v))}
              >
                <SelectTrigger className="h-9 w-[110px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WINDOW_OPTIONS.map((d) => (
                    <SelectItem key={d} value={String(d)}>{d} days</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="size-3.5 mr-1.5" /> Refresh
            </Button>
          </div>
        }
      />

      {isError && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Failed to load scorecards</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>{error instanceof Error ? error.message : "Unexpected error"}</span>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              <RefreshCw className="size-3.5 mr-1.5" /> Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="grid gap-6">
          <Skeleton className="h-[260px] rounded-xl" />
          <div className="grid gap-6 lg:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[260px] rounded-xl" />
            ))}
          </div>
        </div>
      ) : scorecards.length === 0 ? (
        <SectionCard title="No department data">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Target className="size-10 text-muted-foreground mb-3" />
            <p className="text-sm font-medium">No department scorecards yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              Composite scorecards are generated once departments have ticket history.
              Make sure at least one support department is active.
            </p>
          </div>
        </SectionCard>
      ) : (
        <>
          <SectionCard
            title="Ranking — by composite score"
            description={`${scorecards.length} department${scorecards.length === 1 ? "" : "s"} · Health grade + variance vs org average`}
            padded={false}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[70px]">Rank</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead className="w-[110px]">Grade</TableHead>
                  <TableHead className="tabular-nums w-[140px]">Composite</TableHead>
                  <TableHead className="w-[260px]">Score distribution</TableHead>
                  <TableHead className="tabular-nums w-[120px]">vs Avg</TableHead>
                  <TableHead className="tabular-nums w-[110px]">Tickets</TableHead>
                  <TableHead className="tabular-nums w-[120px]">CSAT</TableHead>
                  <TableHead className="w-[120px] text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scorecards.map((card, idx) => {
                  const pctOfBest = (card.compositeScore / Math.max(1, bestScore)) * 100;
                  return (
                    <TableRow key={card.id}>
                      <TableCell>
                        <div
                          className={cn(
                            "grid size-7 place-items-center rounded-full text-xs font-bold ring-1 ring-inset",
                            idx < 3
                              ? RANK_MEDALS[idx]
                              : "bg-muted/60 text-muted-foreground ring-border"
                          )}
                        >
                          {idx < 3 ? (
                            <Trophy className="size-3.5" />
                          ) : (
                            idx + 1
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{card.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {card.id.slice(0, 8)} · window {card.windowDays}d
                        </div>
                      </TableCell>
                      <TableCell>
                        <HealthBadge grade={card.healthGrade} />
                      </TableCell>
                      <TableCell className="tabular-nums">
                        <div className="flex flex-col">
                          <span className="font-semibold text-sm">
                            {card.compositeScore.toFixed(0)}
                          </span>
                          <span className="text-[10px] text-muted-foreground">/ 100</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                            <span>Score vs best</span>
                            <span className="tabular-nums">{pctOfBest.toFixed(0)}%</span>
                          </div>
                          <Progress value={pctOfBest} className="h-2" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <VarianceCell value={card.varianceVsAvgPct} />
                      </TableCell>
                      <TableCell className="tabular-nums text-sm">
                        {card.metrics.totalTickets.toLocaleString()}
                      </TableCell>
                      <TableCell className="tabular-nums text-sm">
                        {card.metrics.avgSatisfaction != null
                          ? card.metrics.avgSatisfaction.toFixed(2)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="outline">
                          <Link to={`/support/analytics/${card.id}`}>
                            View
                            <BarChart2 className="size-3.5 ml-1.5" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </SectionCard>

          <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
            {METRICS.map((metric) => {
              const chartData = buildMetricChartData(scorecards, metric.key);
              const chartMax = metric.max ?? Math.max(...chartData.map((d) => d.value), 1);
              const chartConfig: ChartConfig = chartData.reduce<ChartConfig>((acc, row, i) => {
                acc[row.name] = { label: row.name, color: CHART_COLORS[i % CHART_COLORS.length] };
                return acc;
              }, {});
              const Icon = metric.icon;
              return (
                <Card key={metric.key}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-[15px]">
                      <Icon className="size-4 text-muted-foreground" /> {metric.label}
                    </CardTitle>
                    <CardDescription className="text-xs">{metric.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ChartContainer config={chartConfig} className="h-[220px] w-full">
                      <BarChart
                        layout="vertical"
                        data={chartData}
                        margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                        <XAxis type="number" domain={[0, chartMax]} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                        <YAxis dataKey="name" type="category" width={100} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                        <RechartsTooltip
                          content={
                            <ChartTooltipContent
                              hideLabel
                              formatter={(value: any) => (
                                <div className="font-mono tabular-nums">{metric.format(Number(value))}</div>
                              )}
                            />
                          }
                        />
                        <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={16}>
                          {chartData.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ChartContainer>

                    <div className="mt-4 grid gap-2">
                      {chartData.map((row, i) => {
                        const pct = (row.value / Math.max(1, chartMax)) * 100;
                        return (
                          <div key={row.name} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="flex items-center gap-1.5">
                                <span
                                  className="size-2 rounded-full"
                                  style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                                />
                                {row.name}
                              </span>
                              <span className="font-mono tabular-nums text-muted-foreground">
                                {metric.format(row.value || null)}
                              </span>
                            </div>
                            <Progress value={pct} className="h-1.5" />
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <SectionCard
            title="Health grade legend"
            description="Composite thresholds used to assign each department a letter grade"
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {(["A", "B", "C", "D", "F"] as SupportOrgHealthGrade[]).map((g) => (
                <div key={g} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <HealthBadge grade={g} />
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {g === "A" ? "≥ 90" : g === "B" ? "80–89" : g === "C" ? "70–79" : g === "D" ? "60–69" : "< 60"}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {g === "A" && "Top tier · All KPIs healthy, minimal risk"}
                    {g === "B" && "Strong · Minor room to improve"}
                    {g === "C" && "Fair · Several metrics need attention"}
                    {g === "D" && "At risk · Significant gaps expected"}
                    {g === "F" && "Critical · Immediate intervention required"}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
}

export default SupportComparisonsPage;
