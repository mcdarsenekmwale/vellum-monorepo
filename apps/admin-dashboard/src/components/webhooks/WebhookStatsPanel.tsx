import { useMemo, useState } from "react";
import type { WebhookStats } from "@/lib/api/services";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  LayoutDashboard,
  Inbox,
  Send,
  Activity,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Clock,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface WebhookStatsPanelProps {
  stats?: WebhookStats | null;
  loading?: boolean;
  onRefresh?: () => void;
  scope?: "overview" | "single";
  className?: string;
}

const AXIS_STYLE = { stroke: "hsl(var(--muted-foreground))", fontSize: 10 };
const TICK_LINE = { stroke: "hsl(var(--border))" };

function KpiCard(props: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value?: string | number | null;
  subtext?: string;
  tone?: "indigo" | "emerald" | "rose" | "amber" | "purple" | "sky" | "slate";
  loading?: boolean;
}) {
  const { icon: Icon, label, value, subtext, tone = "slate", loading } = props;
  const toneClass = (
    {
      indigo: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
      emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
      amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
      purple: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
      sky: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
      slate: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
    } as const
  )[tone];

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground truncate">
              {label}
            </div>
            {loading ? (
              <Skeleton className="mt-1 h-7 w-20" />
            ) : (
              <div className="mt-1 text-2xl font-semibold tabular-nums truncate">
                {value ?? "—"}
              </div>
            )}
            {subtext && (
              <div className="text-xs text-muted-foreground mt-0.5 truncate">{subtext}</div>
            )}
          </div>
          <div className={cn("grid size-9 place-items-center rounded-lg shrink-0", toneClass)}>
            <Icon className="size-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function WebhookStatsPanel({
  stats,
  loading,
  onRefresh,
  scope = "overview",
  className,
}: WebhookStatsPanelProps) {
  const [range, setRange] = useState<"7" | "30">("30");
  const series = useMemo(() => {
    const raw = range === "30" ? stats?.last30Days : stats?.last7Days;
    if (!raw || raw.length === 0) return [];
    return raw.map((p) => ({
      date: p.date.slice(5),
      Triggers: p.triggers,
      Success: p.success,
      Failed: p.failure,
    }));
  }, [range, stats]);

  const total = stats?.total ?? 0;
  const totalIn = stats?.totalIncoming ?? 0;
  const totalOut = stats?.totalOutgoing ?? 0;
  const active = stats?.active ?? 0;
  const triggers = stats?.totalTriggers ?? 0;
  const success = stats?.successCount ?? 0;
  const failure = stats?.failureCount ?? 0;
  const sr = stats?.successRate ?? 0;
  const avg = stats?.averageDurationMs ?? 0;

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">Delivery & performance</h3>
          {loading && (
            <Badge variant="outline" className="text-[10px] gap-1">
              <RefreshCw className="size-2.5 animate-spin" />
              Loading
            </Badge>
          )}
        </div>
        {onRefresh && (
          <Button variant="ghost" size="sm" onClick={onRefresh} className="gap-1 h-7">
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
            Refresh
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {scope === "overview" ? (
          <>
            <KpiCard
              icon={LayoutDashboard}
              label="Total webhooks"
              value={total.toLocaleString()}
              subtext={`${active.toLocaleString()} active`}
              tone="indigo"
              loading={loading}
            />
            <KpiCard
              icon={Inbox}
              label="Incoming"
              value={totalIn.toLocaleString()}
              subtext="receive external"
              tone="sky"
              loading={loading}
            />
            <KpiCard
              icon={Send}
              label="Outgoing"
              value={totalOut.toLocaleString()}
              subtext="send outbound"
              tone="purple"
              loading={loading}
            />
            <KpiCard
              icon={Activity}
              label="Triggers"
              value={triggers.toLocaleString()}
              subtext="total events"
              tone="amber"
              loading={loading}
            />
            <KpiCard
              icon={TrendingUp}
              label="Success rate"
              value={triggers === 0 ? "—" : `${sr}%`}
              subtext={`${success.toLocaleString()} ok / ${failure.toLocaleString()} fail`}
              tone={sr >= 95 ? "emerald" : sr >= 80 ? "amber" : "rose"}
              loading={loading}
            />
          </>
        ) : (
          <>
            <KpiCard
              icon={Activity}
              label="Triggers"
              value={triggers.toLocaleString()}
              subtext="total events"
              tone="indigo"
              loading={loading}
            />
            <KpiCard
              icon={CheckCircle2}
              label="Success"
              value={success.toLocaleString()}
              subtext="2xx / 3xx"
              tone="emerald"
              loading={loading}
            />
            <KpiCard
              icon={XCircle}
              label="Failed"
              value={failure.toLocaleString()}
              subtext="errors/timeouts"
              tone="rose"
              loading={loading}
            />
            <KpiCard
              icon={TrendingUp}
              label="Success rate"
              value={triggers === 0 ? "—" : `${sr}%`}
              subtext="last 30d"
              tone={sr >= 95 ? "emerald" : sr >= 80 ? "amber" : "rose"}
              loading={loading}
            />
            <KpiCard
              icon={Clock}
              label="Avg duration"
              value={avg === 0 ? "—" : `${avg.toLocaleString()}ms`}
              subtext="round-trip"
              tone="purple"
              loading={loading}
            />
          </>
        )}
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="text-sm font-medium">Event volume</div>
            <Tabs value={range} onValueChange={(v) => setRange(v as "7" | "30")}>
              <TabsList className="h-8">
                <TabsTrigger value="7" className="text-xs h-7 px-3">
                  7d
                </TabsTrigger>
                <TabsTrigger value="30" className="text-xs h-7 px-3">
                  30d
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {loading || series.length === 0 ? (
            <div className="w-full h-56 relative">
              <Skeleton className="absolute inset-0 rounded-md" />
              {!loading && series.length === 0 && (
                <div className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">
                  No data in the selected range yet.
                </div>
              )}
            </div>
          ) : (
            <div className="w-full h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series} margin={{ top: 6, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gs" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gf" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    {...AXIS_STYLE}
                    tickLine={TICK_LINE}
                    axisLine={TICK_LINE}
                    interval="preserveStartEnd"
                    minTickGap={18}
                  />
                  <YAxis {...AXIS_STYLE} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    cursor={{ stroke: "hsl(var(--border))", strokeDasharray: "3 3" }}
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid hsl(var(--border))",
                      background: "hsl(var(--popover))",
                      color: "hsl(var(--popover-foreground))",
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
                  <Area
                    type="monotone"
                    dataKey="Success"
                    stroke="hsl(var(--chart-1))"
                    fill="url(#gs)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="Failed"
                    stroke="hsl(var(--destructive))"
                    fill="url(#gf)"
                    strokeWidth={1.5}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {stats?.byEvent && stats.byEvent.length > 0 && (
            <div className="grid gap-2 max-h-40 overflow-y-auto border-t pt-3">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Top events
              </div>
              {stats.byEvent.slice(0, 6).map((row) => {
                const pct = row.count === 0 ? 0 : Math.round((row.success / row.count) * 100);
                return (
                  <div
                    key={row.event}
                    className="grid grid-cols-[1.5fr_5fr_auto] items-center gap-3"
                  >
                    <code className="font-mono text-[11px] truncate min-w-0">{row.event}</code>
                    <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 dark:from-emerald-500 dark:to-emerald-400 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="text-[11px] tabular-nums text-muted-foreground">
                      {row.success}/{row.count}
                      <span className="ml-1 opacity-70">({pct}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
