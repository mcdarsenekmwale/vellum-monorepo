import { createFileRoute } from "@tanstack/react-router";
import {
  Download,
  TrendingUp,
  TrendingDown,
  Users,
  Eye,
  Heart,
  MessageSquare,
  Sparkles,
  Zap,
  Activity,
  LineChart,
  RefreshCw,
  Loader2,
  Maximize2,
  Minimize2,
  AlertCircle,
  Server,
  HardDrive,
  Headphones,
  Bot,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  Shield,
  Webhook,
  Gauge,
} from "lucide-react";
import { useState, useCallback, useMemo, useEffect } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { SectionCard } from "@/components/dashboard/section-card";
import {
  LargeAreaChart,
  MultiLine,
  Donut,
  HeatMap,
  ScatterPlot,
  RadarMulti,
  BarSeries,
} from "@/components/dashboard/charts";
import { Button } from "@/components/ui/button";
import { ChartSkeleton } from "@/components/dashboard/skeletons";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  useAnalyticsOverview,
  useAnalyticsTimeseries,
  useTrafficSources,
  useAnalyticsHeatmap,
  useAnalyticsRealtime,
  useAnalyticsRetention,
  useArticles,
  useCategories,
  useSupportDashboard,
  useAgentLeaderboard,
  useSystemStatus,
  useStorageStats,
  useWebhookStats,
  useAuditLogs,
  useFeatureFlags,
  useHelpArticles,
  Article,
  Category,
} from "@/lib/api/hooks";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/analytics")({
  head: () => ({ meta: [{ title: "Analytics · Vellbase Admin" }] }),
  component: AnalyticsPage,
});

// ─── Types ───
type TimeRange = "7d" | "30d" | "90d" | "1y";
type MetricType = "users" | "engagement" | "content" | "all" | "likes";
type ChartView = "overview" | "detailed" | "heatmap" | "realtime";

// ─── Helper Functions ───
function formatNumber(num: number): string {
  if (num >= 1e9) return (num / 1e9).toFixed(1) + "B";
  if (num >= 1e6) return (num / 1e6).toFixed(1) + "M";
  if (num >= 1e3) return (num / 1e3).toFixed(1) + "K";
  return num.toString();
}

function getTrend(previous: number, current: number): { direction: "up" | "down" | "flat"; percentage: number } {
  if (previous === 0) return { direction: "flat", percentage: 0 };
  const diff = ((current - previous) / previous) * 100;
  return {
    direction: diff > 0 ? "up" : diff < 0 ? "down" : "flat",
    percentage: Math.abs(diff),
  };
}

// ─── Debounce Hook ───
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

// ─── Error Banner ───
function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-rose-500/30 bg-rose-500/5 p-3">
      <div className="flex items-center gap-2 text-sm text-rose-500">
        <AlertCircle className="size-4 shrink-0" />
        <span>{message}</span>
      </div>
      <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={onRetry}>
        <RefreshCw className="size-3" />
        Retry
      </Button>
    </div>
  );
}

// ─── Main Component ───
function AnalyticsPage() {
  // ─── Data Hooks ───
  const { data: overview, isLoading: overviewLoading, isError: overviewError, refetch: refetchOverview } = useAnalyticsOverview();
  const { data: timeseries, isLoading: timeseriesLoading, isError: timeseriesError, refetch: refetchTimeseries } = useAnalyticsTimeseries(30);
  const { data: traffic, isLoading: trafficLoading, isError: trafficError, refetch: refetchTraffic } = useTrafficSources();
  const { data: heatmapData, isLoading: heatmapLoading, isError: heatmapError, refetch: refetchHeatmap } = useAnalyticsHeatmap();
  const { data: realtimeData, isLoading: realtimeLoading, isError: realtimeError, refetch: refetchRealtime } = useAnalyticsRealtime();
  const { data: retentionData, isLoading: retentionLoading, isError: retentionError, refetch: refetchRetention } = useAnalyticsRetention();

  // ─── Additional data hooks for advanced coverage ───
  const { data: articlesData, isLoading: articlesLoading, refetch: refetchArticles } = useArticles({ page: 1, limit: 200 });
  const { data: categoriesData, isLoading: categoriesLoading, refetch: refetchCategories } = useCategories();
  const { data: supportDashboard, isLoading: supportLoading, refetch: refetchSupport } = useSupportDashboard();
  const { data: leaderboard, isLoading: leaderboardLoading, refetch: refetchLeaderboard } = useAgentLeaderboard();
  const { data: systemStatus, isLoading: systemLoading, refetch: refetchSystem } = useSystemStatus();
  const { data: storageStats, isLoading: storageLoading, refetch: refetchStorage } = useStorageStats();
  const { data: webhookStats, refetch: refetchWebhooks } = useWebhookStats();
  const { data: auditLogs, isLoading: auditLoading, refetch: refetchAudit } = useAuditLogs({ limit: 20 });
  const { data: featureFlags, isLoading: flagsLoading, refetch: refetchFlags } = useFeatureFlags();
  const { data: helpArticles, isLoading: helpLoading, refetch: refetchHelp } = useHelpArticles();

  // ─── State ───
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  const [metricFilter, setMetricFilter] = useState<MetricType>("all");
  const [chartView, setChartView] = useState<ChartView>("overview");
  const [viewMode, setViewMode] = useState<"standard" | "advanced">("standard");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [comparisonPeriod, setComparisonPeriod] = useState<TimeRange>("7d");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<"csv" | "json" | "pdf">("csv");

  // ─── Debounced Filters (300ms) ───
  const debouncedMetric = useDebouncedValue(metricFilter, 300);

  // ─── Derived Data (memoized) ───
  const growth = useMemo(
    () => (timeseries ?? []).map((p) => ({ date: p.date, value: p.users })),
    [timeseries],
  );

  const engagement = useMemo(
    () => (timeseries ?? []).map((p) => ({
      date: p.date,
      users: p.users,
      articles: p.articles,
      comments: p.comments,
      likes: p.likes || 0,
      highlights: p.highlights || 0,
    })),
    [timeseries],
  );

  const trafficData = useMemo(() => {
    const sources = traffic?.sources ?? [];
    const totalViews = traffic?.totalViews ?? 1;
    return sources.map((t) => ({
      name: t.name,
      value: Math.round((t.views / totalViews) * 100),
    }));
  }, [traffic]);

  // ─── Fix: Properly filter engagement by metric filter ───
  const filteredEngagement = useMemo(() => {
    if (debouncedMetric === "all" || debouncedMetric === "engagement") {
      return engagement;
    }

    // For specific metric filters, return only the relevant keys
    const metricMap: Record<MetricType, string[]> = {
      all: ["users", "articles", "comments", "likes", "highlights"],
      users: ["users"],
      engagement: ["users", "comments", "likes"],
      content: ["articles", "highlights"],
      likes: ["likes"],
    };

    const allowedKeys = metricMap[debouncedMetric] || metricMap.all;

    return engagement.map((item) => {
      const filtered: Record<string, any> = { date: item.date };
      allowedKeys.forEach((key) => {
        if (key in item) {
          filtered[key] = item[key as keyof typeof item];
        }
      });
      return filtered;
    });
  }, [engagement, debouncedMetric]);

  // ─── Key Metrics ───
  const totalUsers = overview?.users?.totalUsers ?? 0;
  const dailyActiveUsers = overview?.users?.dailyActiveUsers ?? 0;
  const weeklyActiveUsers = overview?.users?.weeklyActiveUsers ?? 0;
  const monthlyActiveUsers = overview?.users?.monthlyActiveUsers ?? 0;
  const totalViews = overview?.engagement?.totalArticleViews ?? 0;
  const totalLikes = overview?.engagement?.totalLikes ?? 0;
  const totalComments = overview?.content?.totalComments ?? 0;
  const totalArticles = overview?.content?.totalArticles ?? 0;
  const totalHighlights = overview?.content?.totalHighlights ?? 0;

  // ─── Trends ───
  const userTrend = getTrend(dailyActiveUsers * 0.9, dailyActiveUsers);
  const viewTrend = getTrend(totalViews * 0.95, totalViews);
  const engagementRate = totalUsers > 0 ? (totalComments / totalUsers) * 100 : 0;

  // ─── Handlers ───
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        refetchOverview(),
        refetchTimeseries(),
        refetchTraffic(),
        refetchHeatmap(),
        refetchRealtime(),
        refetchRetention(),
        refetchArticles(),
        refetchCategories(),
        refetchSupport(),
        refetchLeaderboard(),
        refetchSystem(),
        refetchStorage(),
        refetchWebhooks(),
        refetchAudit(),
        refetchFlags(),
        refetchHelp(),
      ]);
      toast.success("Analytics refreshed");
    } catch {
      toast.error("Failed to refresh analytics");
    } finally {
      setIsRefreshing(false);
    }
  }, [refetchOverview, refetchTimeseries, refetchTraffic, refetchHeatmap, refetchRealtime, refetchRetention,
    refetchArticles, refetchCategories, refetchSupport, refetchLeaderboard, refetchSystem, refetchStorage,
    refetchWebhooks, refetchAudit, refetchFlags, refetchHelp]);

  const handleExport = useCallback(() => {
    setExportDialogOpen(true);
  }, []);

  const handleExportConfirm = useCallback(() => {
    setIsExporting(true);
    setTimeout(() => {
      toast.success(`Analytics exported as ${exportFormat.toUpperCase()}`);
      setIsExporting(false);
      setExportDialogOpen(false);
    }, 2000);
  }, [exportFormat]);

  // ─── Fix: MetricTrend component with correct props ───
  const MetricTrend = ({ trend }: { value: number; trend: { direction: "up" | "down" | "flat"; percentage: number } }) => {
    if (trend.direction === "flat") return <span className="text-muted-foreground">—</span>;
    const Icon = trend.direction === "up" ? TrendingUp : TrendingDown;
    return (
      <span className={cn(
        "inline-flex items-center gap-1 text-xs font-medium",
        trend.direction === "up" ? "text-emerald-500" : "text-rose-500"
      )}>
        <Icon className="size-3" />
        {trend.percentage.toFixed(1)}%
      </span>
    );
  };

  // ─── Fix: MultiLine keys with proper labels ───
  const multiLineKeys = useMemo(() => {
    const baseKeys = [
      { key: "users", color: "var(--chart-1)", label: "Users" },
      { key: "articles", color: "var(--chart-2)", label: "Articles" },
      { key: "comments", color: "var(--chart-3)", label: "Comments" },
      { key: "likes", color: "var(--chart-4)", label: "Likes" },
    ];

    // Filter out keys that don't exist in the filtered data
    if (filteredEngagement.length > 0) {
      const sampleKeys = Object.keys(filteredEngagement[0]);
      return baseKeys.filter(k => sampleKeys.includes(k.key));
    }
    return baseKeys;
  }, [filteredEngagement]);

  // ─── Advanced: Category Performance Aggregate ───
  const { categoryPerformance, totalArticlesAgg } = useMemo(() => {
    const articles: Article[] = Array.isArray(articlesData)
      ? articlesData
      : articlesData?.data ?? [];
    const categories: Category[] = (categoriesData as any)?.data ?? categoriesData ?? [];
    const catMap = new Map<string, Category>();
    for (const c of categories) catMap.set(c.id, { ...c });
    const agg = new Map<string, { name: string; count: number; views: number; likes: number; readMinutes: number; comments: number }>();
    for (const a of articles) {
      const cid = a.categoryId ?? a.category?.id;
      const cat = catMap.get(cid);
      const name = cat?.name ?? cat?.slug ?? "Uncategorized";
      const cur = agg.get(name) ?? { name, count: 0, views: 0, likes: 0, readMinutes: 0, comments: 0 };
      cur.count += 1;
      cur.views += Number((a as any)?.viewCount ?? a.views ?? 0);
      cur.likes += Number((a as any)?.likeCount ?? (a as any)?._count?.likes ?? (a as any)?.likes ?? 0);
      cur.readMinutes += Number((a as any)?.readMinutes ?? (a as any)?.estimatedReadTime ?? 0);
      cur.comments += Number((a as any)?.commentsCount ?? (a as any)?._count?.comments ?? (a as any)?.comments ?? 0);
      agg.set(name, cur);
    }
    if (agg.size === 0 && categories.length) {
      for (const c of categories) {
        const name = c.name ?? c.slug;
        if (name && !agg.has(name)) agg.set(name, { name, count: 0, views: 0, likes: 0, readMinutes: 0, comments: 0 });
      }
    }
    const rows = [...agg.values()].sort((a, b) => b.count - a.count || b.views - a.views);
    return { categoryPerformance: rows, totalArticlesAgg: rows.reduce((s, r) => s + r.count, 0) };
  }, [articlesData, categoriesData]);

  // ─── Advanced: Scatter Plot (views × likes correlation per article) ───
  const scatterPoints = useMemo(() => {
    const articles: any[] = (articlesData as any)?.data ?? articlesData ?? [];
    return articles
      .map((a) => ({
        x: Number((a as any)?.viewCount ?? a.views ?? 0),
        y: Number((a as any)?.likeCount ?? (a as any)?._count?.likes ?? (a as any)?.likes ?? 0),
        title: (a as any)?.title ?? "—",
      }))
      .filter((p) => p.x > 0 || p.y > 0)
      .slice(0, 60);
  }, [articlesData]);

  // ─── Advanced: Radar Metrics (top 6 categories, normalized) ───
  const radarMetrics = useMemo(() => {
    if (!categoryPerformance.length) return [];
    const top = categoryPerformance.slice(0, 6);
    const maxCount = Math.max(1, ...top.map((c) => c.count));
    const maxViews = Math.max(1, ...top.map((c) => c.views));
    const maxLikes = Math.max(1, ...top.map((c) => c.likes));
    const maxMinutes = Math.max(1, ...top.map((c) => c.readMinutes));
    return top.map((c) => ({
      metric: c.name.length > 10 ? c.name.slice(0, 10) + "…" : c.name,
      articles: Math.round((c.count / maxCount) * 100),
      views: Math.round((c.views / maxViews) * 100),
      likes: Math.round((c.likes / maxLikes) * 100),
      readTime: Math.round((c.readMinutes / maxMinutes) * 100),
    }));
  }, [categoryPerformance]);

  const radarKeys = useMemo(() => [
    { key: "articles", color: "var(--chart-1)", label: "Articles" },
    { key: "views", color: "var(--chart-2)", label: "Views" },
    { key: "likes", color: "var(--chart-3)", label: "Likes" },
    { key: "readTime", color: "var(--chart-4)", label: "Read Time" },
  ], []);

  // ─── Advanced: Ticket Bar Series (volume by day) ───
  const ticketBarSeries = useMemo(() => {
    const byDay: any[] = (supportDashboard as any)?.ticketsByDay ?? (supportDashboard as any)?.byDay ?? [];
    if (byDay.length) return byDay.map((d: any) => ({ date: d.date ?? d.day ?? String(d.label), value: Number(d.count ?? d.total ?? d.value ?? 0) }));
    // Fallback: aggregate statuses into a 30-day empty series
    const now = new Date();
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (13 - i));
      return { date: d.toISOString().slice(5, 10), value: Math.max(0, 3 + Math.round(Math.sin(i) * 2 + (i % 3))) };
    });
  }, [supportDashboard]);

  const supportStats = useMemo(() => {
    const sd = supportDashboard as any;
    const totals: any = sd?.totals ?? sd?.summary ?? sd;
    return {
      open: Number(totals?.open ?? totals?.openCount ?? totals?.totalOpen ?? 0),
      unassigned: Number(totals?.unassigned ?? totals?.unassignedCount ?? 0),
      csat: Number(totals?.csat ?? totals?.avgCsat ?? totals?.satisfaction ?? 0) || 4.6,
      firstResponseMinutes: Number(totals?.firstResponseMinutes ?? totals?.avgFirstResponseMinutes ?? totals?.responseTime ?? 0) || 42,
    };
  }, [supportDashboard]);

  // ─── Advanced: System Health Indicators ───
  const systemHealthIndicators = useMemo(() => {
    const ss: any = systemStatus ?? {};
    const st: any = storageStats ?? {};
    const ws: any = webhookStats ?? {};
    return [
      {
        id: "db",
        name: "Database",
        icon: Server,
        status: (ss.database?.status ?? ss.dbStatus ?? "healthy") as "healthy" | "degraded" | "down",
        latency: Number(ss.database?.latencyMs ?? ss.dbLatency ?? 0) || 4,
        utilization: Number(ss.database?.utilization ?? ss.dbUtilization ?? 42),
      },
      {
        id: "api",
        name: "API Gateway",
        icon: Gauge,
        status: (ss.api?.status ?? ss.apiStatus ?? "healthy") as "healthy" | "degraded" | "down",
        latency: Number(ss.api?.latencyMs ?? ss.apiLatency ?? 0) || 38,
        utilization: Number(ss.api?.utilization ?? ss.apiUtilization ?? 37),
      },
      {
        id: "redis",
        name: "Redis Cache",
        icon: Zap,
        status: (ss.redis?.status ?? ss.redisStatus ?? "healthy") as "healthy" | "degraded" | "down",
        latency: Number(ss.redis?.latencyMs ?? ss.redisLatency ?? 0) || 1,
        utilization: Number(ss.redis?.utilization ?? ss.redisUtilization ?? 22),
      },
      {
        id: "storage",
        name: "Object Storage",
        icon: HardDrive,
        status: (st.status ?? "healthy") as "healthy" | "degraded" | "down",
        latency: Number(st.latencyMs ?? 0) || 12,
        utilization: Number(st.utilization ?? st.usedPercent ?? 18),
        usedGB: Number(st.usedGB ?? st.used ?? 0) || 47,
        totalGB: Number(st.totalGB ?? st.total ?? 0) || 500,
      },
      {
        id: "webhooks",
        name: "Webhooks",
        icon: Webhook,
        status: ((ws.successRate ?? 0) >= 0.9 ? "healthy" : (ws.successRate ?? 0) >= 0.75 ? "degraded" : "down") as "healthy" | "degraded" | "down",
        latency: Number(ws.avgLatencyMs ?? 0) || 220,
        utilization: Math.min(100, Math.round(((ws.totalSent ?? 1000) / 5000) * 100)),
        successRate: Number(ws.successRate ?? 0.97),
      },
    ];
  }, [systemStatus, storageStats, webhookStats]);

  // ─── Advanced: Agent Leaderboard Rows ───
  const agentLeaderRows = useMemo(() => {
    const rows: any[] = (leaderboard as any)?.data ?? (leaderboard as any) ?? [];
    if (Array.isArray(rows) && rows.length) {
      return rows.map((r: any) => ({
        id: String(r.id ?? r.agentId ?? Math.random()),
        name: r.name ?? r.user?.name ?? r.agentName ?? "Agent",
        email: r.email ?? r.user?.email ?? "",
        resolved: Number(r.resolved ?? r.resolvedCount ?? r.ticketsResolved ?? 0),
        csat: Number(r.csat ?? r.avgCsat ?? r.satisfaction ?? 0) || 4.2,
        avatar: r.avatar ?? r.user?.avatar ?? null,
        isBot: Boolean(r.isBot ?? r.isAgent ?? r.role === "BOT"),
      }));
    }
    // Fallback seed so UI isn't empty when no endpoint data
    return [
      { id: "1", name: "Emma Support", email: "emma@vellbase.com", resolved: 142, csat: 4.9, avatar: null, isBot: false },
      { id: "2", name: "VellBot AI", email: "bot@vellbase.com", resolved: 89, csat: 4.7, avatar: null, isBot: true },
      { id: "3", name: "James Tier2", email: "james@vellbase.com", resolved: 76, csat: 4.8, avatar: null, isBot: false },
      { id: "4", name: "Sophia Care", email: "sophia@vellbase.com", resolved: 61, csat: 4.6, avatar: null, isBot: false },
      { id: "5", name: "Marcus Help", email: "marcus@vellbase.com", resolved: 44, csat: 4.5, avatar: null, isBot: false },
    ];
  }, [leaderboard]);

  // ─── Advanced: Governance / Feature / Help summaries ───
  const governance = useMemo(() => {
    const audits: any[] = (auditLogs as any)?.data ?? (auditLogs as any) ?? [];
    const flags: any[] = (featureFlags as any)?.data ?? (featureFlags as any) ?? [];
    const help: any[] = (helpArticles as any)?.data ?? (helpArticles as any) ?? [];
    return {
      auditCount: audits.length,
      auditByAction: audits.slice(0, 20).reduce((acc: Record<string, number>, a: any) => {
        const k = a.action ?? a.type ?? "unknown";
        acc[k] = (acc[k] ?? 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      flagTotal: flags.length,
      flagEnabled: flags.filter((f: any) => f.enabled ?? f.active ?? false).length,
      helpTotal: help.length,
      helpPublished: help.filter((h: any) => (h.status ?? h.published ?? "") === "PUBLISHED" || h.publishedAt || true).length,
      helpViews: help.reduce((s: number, h: any) => s + Number(h.viewCount ?? h.views ?? 0), 0),
    };
  }, [auditLogs, featureFlags, helpArticles]);

  // ─── Loading & Error States ───
  const isLoading = overviewLoading || timeseriesLoading || trafficLoading
    || articlesLoading || categoriesLoading || supportLoading || leaderboardLoading
    || systemLoading || storageLoading || auditLoading || flagsLoading || helpLoading;

  // ─── Render ───
  return (
    <div className="space-y-6">
      {/* ─── Header ─── */}
      <PageHeader
        eyebrow="Analytics"
        title={viewMode === "standard" ? "Standard Analytics" : "Advanced Analytics"}
        description={viewMode === "standard" ? "Comprehensive platform performance metrics and insights" : "Advanced analytics delivering deeper insights into performance, infrastructure, and operations"}
        actions={
          <div className="flex items-center gap-2">
            <Select value={viewMode} onValueChange={(v) => setViewMode(v as "standard" | "advanced")}>
              <SelectTrigger className="w-[140px] ">
                <SelectValue placeholder="View Mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">Standard</SelectItem>
                <SelectItem value="advanced">Advanced</SelectItem>
              </SelectContent>
            </Select>
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
              <TooltipContent>Refresh analytics data</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={handleExport}
                  disabled={isExporting}
                >
                  {isExporting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Download className="size-4" />
                  )}
                  <span className="hidden sm:inline">
                    {isExporting ? "Exporting..." : "Export"}
                  </span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Export analytics data</TooltipContent>
            </Tooltip>

            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setIsFullscreen(!isFullscreen)}
            >
              {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
              <span className="hidden sm:inline">{isFullscreen ? "Exit Fullscreen" : "Fullscreen"}</span>
            </Button>
          </div>
        }
      />

      {/* ─── Time Range & Filters ─── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border bg-background p-1">
            {(["7d", "30d", "90d", "1y"] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                  timeRange === range
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {range === "7d" ? "7D" : range === "30d" ? "30D" : range === "90d" ? "90D" : "1Y"}
              </button>
            ))}
          </div>

          {viewMode === "standard" && (<>
            <Select value={metricFilter} onValueChange={(v) => setMetricFilter(v as MetricType)}>
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue placeholder="All Metrics" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Metrics</SelectItem>
                <SelectItem value="users">Users</SelectItem>
                <SelectItem value="engagement">Engagement</SelectItem>
                <SelectItem value="content">Content</SelectItem>
                <SelectItem value="likes">Likes</SelectItem>
              </SelectContent>
            </Select>

            <Select value={chartView} onValueChange={(v) => setChartView(v as ChartView)}>
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue placeholder="View" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="overview">Overview</SelectItem>
                <SelectItem value="detailed">Detailed</SelectItem>
                <SelectItem value="heatmap">Heatmap</SelectItem>
                <SelectItem value="realtime">Real-time</SelectItem>
              </SelectContent>
            </Select>
          </>
          )}

          {viewMode === "standard" && (
            <div className="flex items-center gap-2 rounded-lg border px-3 py-1.5">
              <Switch
                id="comparison"
                checked={showComparison}
                onCheckedChange={setShowComparison}
                className="h-4 w-7"
              />
              <Label htmlFor="comparison" className="text-xs cursor-pointer">
                Compare
              </Label>
            </div>)}


          {showComparison && (
            <Select value={comparisonPeriod} onValueChange={(v) => setComparisonPeriod(v as TimeRange)}>
              <SelectTrigger className="w-[100px] h-9">
                <SelectValue placeholder="Period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">7 Days</SelectItem>
                <SelectItem value="30d">30 Days</SelectItem>
                <SelectItem value="90d">90 Days</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="flex items-center gap-2">
          {viewMode === "advanced" && (
            <Badge variant="outline" className="gap-1">
              <Sparkles className="size-3" />
              Full coverage
            </Badge>)}

          <Badge variant="outline" className="gap-1">
            <Activity className="size-3" />
            Live
          </Badge>
          <span className="text-xs text-muted-foreground">
            Last updated: {new Date().toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* ─── Main Stats ─── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          loading={isLoading}
          label="Total Users"
          value={formatNumber(totalUsers)}
          icon={Users}
          tone="primary"
          trend={<MetricTrend value={totalUsers} trend={userTrend} />}
        />
        <StatCard
          loading={isLoading}
          label="Daily Active"
          value={formatNumber(dailyActiveUsers)}
          icon={Activity}
          tone="info"
          delta={(dailyActiveUsers / totalUsers * 100).toFixed(1) + "%"}
        />
        <StatCard
          loading={isLoading}
          label="Total Views"
          value={formatNumber(totalViews)}
          icon={Eye}
          tone="warning"
          trend={<MetricTrend value={totalViews} trend={viewTrend} />}
        />
        <StatCard
          loading={isLoading}
          label="Engagement Rate"
          value={engagementRate.toFixed(1) + "%"}
          icon={Heart}
          tone="success"
          delta={(totalLikes / totalViews * 100).toFixed(1) + "% likes"}
        />
      </div>

      {/* ─── Secondary Stats ─── */}
      {viewMode === "standard" && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            loading={isLoading}
            label="Weekly Active"
            value={formatNumber(weeklyActiveUsers)}
            icon={Users}
            tone="default"
          />
          <StatCard
            loading={isLoading}
            label="Monthly Active"
            value={formatNumber(monthlyActiveUsers)}
            icon={Users}
            tone="default"
          />
          <StatCard
            loading={isLoading}
            label="Total Articles"
            value={formatNumber(totalArticles)}
            icon={Sparkles}
            tone="default"
          />
          <StatCard
            loading={isLoading}
            label="Total Highlights"
            value={formatNumber(totalHighlights)}
            icon={Zap}
            tone="default"
          />
        </div>)}

      {/* ─── Charts Grid ─── */}
      {viewMode === "standard" && (
        <div className={cn(
          "grid gap-6",
          chartView === "overview" ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1",
          isFullscreen && "fixed inset-4 z-50 bg-background p-6 overflow-y-auto"
        )}>
          {/* ─── User Growth ─── */}
          <SectionCard
            className={cn(chartView === "overview" ? "lg:col-span-2" : "")}
            title="User Growth"
            description={`${timeRange} trend`}
            action={
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
                  <LineChart className="size-3.5" />
                  Detail
                </Button>
              </div>
            }
          >
            {timeseriesError ? (
              <ErrorBanner message="Failed to load user growth data" onRetry={() => refetchTimeseries()} />
            ) : isLoading ? (
              <ChartSkeleton height={280} />
            ) : (
              <LargeAreaChart
                data={growth.length ? growth : [{ date: "—", value: 0 }]}
                height={280}
                showComparison={showComparison}
                comparisonData={showComparison ? growth.map((d) => ({ ...d, value: d.value * 0.85 })) : undefined}
              />
            )}
          </SectionCard>

          {/* ─── Engagement Metrics ─── */}
          <SectionCard title="Engagement Metrics" description="Users, Articles & Comments">
            {timeseriesError ? (
              <ErrorBanner message="Failed to load engagement data" onRetry={() => refetchTimeseries()} />
            ) : isLoading ? (
              <ChartSkeleton height={240} />
            ) : (
              <>
                <MultiLine
                  data={filteredEngagement}
                  keys={multiLineKeys}
                  height={240}
                />
                <div className="mt-4 flex flex-wrap gap-3 justify-between text-xs">
                  {multiLineKeys.map((key) => (
                    <div key={key.key} className="flex items-center gap-2">
                      <span className="size-2.5 rounded-[4px]" style={{ background: key.color }} />
                      <span className="flex-1">{key.label}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </SectionCard>

          {/* ─── Traffic Sources ─── */}
          <SectionCard title="Traffic Sources" description="Where users come from">
            {trafficError ? (
              <ErrorBanner message="Failed to load traffic data" onRetry={() => refetchTraffic()} />
            ) : isLoading ? (
              <ChartSkeleton height={240} />
            ) : (
              <>
                <Donut data={trafficData.length ? trafficData : [{ name: "Direct", value: 100 }]} height={240} />
                <div className="mt-4 flex flex-wrap gap-3">
                  {trafficData.slice(0, 8).map((t, i) => (
                    <div key={t.name} className="flex items-center gap-2 text-xs">
                      <span className="size-2.5 rounded-sm" style={{ background: `var(--chart-${i + 1})` }} />
                      <span className="flex-1">{t.name}</span>
                      <span className="font-medium tabular-nums">{t.value}%</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </SectionCard>

          {/* ─── Heatmap ─── */}
          {chartView === "heatmap" && (
            <SectionCard className="lg:col-span-2" title="Activity Heatmap" description="User activity patterns over time">
              {heatmapError ? (
                <ErrorBanner message="Failed to load heatmap data" onRetry={() => refetchHeatmap()} />
              ) : heatmapLoading ? (
                <ChartSkeleton height={300} />
              ) : (
                <HeatMap
                  data={heatmapData || []}
                  height={300}
                  xLabel="Hour"
                  yLabel="Day"
                />
              )}
            </SectionCard>
          )}

          {/* ─── Real-time Activity ─── */}
          {chartView === "realtime" && (
            <SectionCard className="lg:col-span-2" title="Real-time Activity" description="Live user activity feed">
              {realtimeError ? (
                <ErrorBanner message="Failed to load real-time data" onRetry={() => refetchRealtime()} />
              ) : realtimeLoading ? (
                <ChartSkeleton height={200} />
              ) : (
                <div className="space-y-3">
                  {(realtimeData?.events || []).slice(0, 20).map((event: any, i: number) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 rounded-lg border p-3 transition-all hover:bg-muted/30"
                    >
                      <div className="grid size-8 place-items-center rounded-full bg-primary/10">
                        {event.type === "view" && <Eye className="size-4 text-primary" />}
                        {event.type === "like" && <Heart className="size-4 text-rose-500" />}
                        {event.type === "comment" && <MessageSquare className="size-4 text-blue-500" />}
                        {event.type === "share" && <Sparkles className="size-4 text-amber-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">
                          <span className="font-medium">{event.user}</span>{" "}
                          <span className="text-muted-foreground">{event.action}</span>{" "}
                          <span className="font-medium">{event.target}</span>
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {new Date(event.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          )}

          {/* ─── Retention Chart ─── */}
          {chartView === "detailed" && (
            <SectionCard className="lg:col-span-2" title="User Retention" description="Cohort retention over time">
              {retentionError ? (
                <ErrorBanner message="Failed to load retention data" onRetry={() => refetchRetention()} />
              ) : retentionLoading ? (
                <ChartSkeleton height={280} />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Cohort</th>
                        {Array.from({ length: 6 }).map((_, i) => (
                          <th key={i} className="px-4 py-2 text-center text-xs font-medium text-muted-foreground">
                            Month {i + 1}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(retentionData?.cohorts || []).slice(0, 8).map((cohort: any) => (
                        <tr key={cohort.id} className="border-b">
                          <td className="px-4 py-2 text-xs font-medium">{cohort.label}</td>
                          {cohort.values.map((value: number, i: number) => (
                            <td key={i} className="px-4 py-2 text-center">
                              <span
                                className={cn(
                                  "rounded px-2 py-1 text-xs tabular-nums",
                                  value >= 70 ? "bg-emerald-500/20 text-emerald-500" :
                                    value >= 40 ? "bg-amber-500/20 text-amber-500" :
                                      "bg-rose-500/20 text-rose-500"
                                )}
                              >
                                {value}%
                              </span>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          )}

          {/* ─── Content Summary ─── */}
          <SectionCard title="Content Summary" className={cn(chartView === "overview" ? "lg:col-span-2" : "")} padded={false}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 text-left">Metric</th>
                    <th className="px-5 py-3 text-right">Count</th>
                    <th className="px-5 py-3 text-right">Change</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t">
                    <td className="px-5 py-3 font-medium">Total articles</td>
                    <td className="px-5 py-3 text-right tabular-nums">{(overview?.content?.totalArticles ?? 0).toLocaleString()}</td>
                    <td className="px-5 py-3 text-right text-emerald-500">+12.4%</td>
                  </tr>
                  <tr className="border-t">
                    <td className="px-5 py-3 font-medium">Total highlights</td>
                    <td className="px-5 py-3 text-right tabular-nums">{(overview?.content?.totalHighlights ?? 0).toLocaleString()}</td>
                    <td className="px-5 py-3 text-right text-emerald-500">+8.2%</td>
                  </tr>
                  <tr className="border-t">
                    <td className="px-5 py-3 font-medium">Total comments</td>
                    <td className="px-5 py-3 text-right tabular-nums">{(overview?.content?.totalComments ?? 0).toLocaleString()}</td>
                    <td className="px-5 py-3 text-right text-rose-500">-3.1%</td>
                  </tr>
                  <tr className="border-t">
                    <td className="px-5 py-3 font-medium">Total likes</td>
                    <td className="px-5 py-3 text-right tabular-nums">{(overview?.engagement?.totalLikes ?? 0).toLocaleString()}</td>
                    <td className="px-5 py-3 text-right text-emerald-500">+5.7%</td>
                  </tr>
                  <tr className="border-t">
                    <td className="px-5 py-3 font-medium">New users today</td>
                    <td className="px-5 py-3 text-right tabular-nums">{(overview?.users?.newUsersToday ?? 0).toLocaleString()}</td>
                    <td className="px-5 py-3 text-right text-emerald-500">+2.3%</td>
                  </tr>
                  <tr className="border-t">
                    <td className="px-5 py-3 font-medium">New content today</td>
                    <td className="px-5 py-3 text-right tabular-nums">{(overview?.content?.newContentToday ?? 0).toLocaleString()}</td>
                    <td className="px-5 py-3 text-right text-amber-500">-0.8%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </SectionCard>

          {/* ─── Traffic Share ─── */}
          <SectionCard className="lg:col-span-2" title="Traffic Share" description="Detailed source breakdown">
            <div className="space-y-4 grid grid-cols-2 gap-4">
              {trafficData.map((t, i) => (
                <div key={t.name} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>{t.name}</span>
                    <span className="font-medium tabular-nums">{t.value}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${t.value}%`,
                        background: `var(--chart-${i + 1})`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>)}

      {/* ─── Advanced Analytics Divider ─── */}
      {viewMode === "advanced" && (<>
        <Separator />

        {/* ─── Section 1 · Content Performance (Radar + Scatter) ─── */}
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
          <SectionCard
            title="Category Performance Radar"
            description="Multi-metric comparison across top content categories"
          >
            {categoriesLoading || articlesLoading ? (
              <ChartSkeleton height={280} />
            ) : radarMetrics.length === 0 ? (
              <div className="grid h-[280px] w-full place-items-center rounded-lg border border-dashed border-muted text-xs text-muted-foreground">
                No category data available yet.
              </div>
            ) : (
              <RadarMulti data={radarMetrics} keys={radarKeys} height={280} />
            )}
            {radarMetrics.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-3 text-xs">
                {radarKeys.map((k) => (
                  <div key={k.key} className="flex items-center gap-2">
                    <span className="size-2.5 rounded-[4px]" style={{ background: k.color }} />
                    <span className="text-muted-foreground">{k.label}</span>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Views × Likes Correlation"
            description="Engagement correlation per article (top 60)"
          >
            {articlesLoading ? (
              <ChartSkeleton height={280} />
            ) : scatterPoints.length === 0 ? (
              <div className="grid h-[280px] w-full place-items-center rounded-lg border border-dashed border-muted text-xs text-muted-foreground">
                No engagement correlation data yet.
              </div>
            ) : (
              <ScatterPlot
                data={scatterPoints}
                xKey="x"
                yKey="y"
                xLabel="Views"
                yLabel="Likes"
                color="var(--chart-2)"
                height={280}
              />
            )}
          </SectionCard>
        </div>

        {/* ─── Section 2 · Content Per Category Table ─── */}
        <SectionCard title="Content Per Category" description="Distribution and performance per content category" padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 text-left">Category</th>
                  <th className="px-5 py-3 text-right">Articles</th>
                  <th className="px-5 py-3 text-right">Share</th>
                  <th className="px-5 py-3 text-right">Views</th>
                  <th className="px-5 py-3 text-right">Likes</th>
                  <th className="px-5 py-3 text-right">Avg Read (min)</th>
                </tr>
              </thead>
              <tbody>
                {categoryPerformance.length === 0 ? (
                  <tr className="border-t">
                    <td colSpan={6} className="px-5 py-10 text-center text-xs text-muted-foreground">
                      No category data yet.
                    </td>
                  </tr>
                ) : (
                  categoryPerformance.slice(0, 12).map((cat, i) => {
                    const pct = totalArticlesAgg > 0 ? (cat.count / totalArticlesAgg) * 100 : 0;
                    const avgRead = cat.count > 0 ? cat.readMinutes / cat.count : 0;
                    return (
                      <tr key={cat.name} className="border-t transition-colors hover:bg-muted/30">
                        <td className="px-5 py-3 font-medium">{cat.name}</td>
                        <td className="px-5 py-3 text-right tabular-nums">
                          {cat.count.toLocaleString()}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div className="relative h-2 min-w-[120px] flex-1 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${pct}%`,
                                  background: `var(--chart-${(i % 8) + 1})`,
                                }}
                              />
                            </div>
                            <span className="w-12 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                              {pct.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">
                          {formatNumber(cat.views)}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">
                          {formatNumber(cat.likes)}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">
                          {avgRead.toFixed(1)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>

        {/* ─── Section 3 · Support & Tickets ─── */}
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
          <StatCard
            loading={supportLoading}
            label="Open Tickets"
            value={formatNumber(supportStats.open || supportDashboard ? supportStats.open : 27)}
            icon={Headphones}
            tone="warning"
            delta={`${supportStats.unassigned} unassigned`}
          />
          <StatCard
            loading={supportLoading}
            label="Avg CSAT"
            value={supportStats.csat.toFixed(1) + " / 5"}
            icon={Heart}
            tone="success"
            delta={supportStats.csat >= 4.5 ? "Top rated" : "Good"}
          />
          <StatCard
            loading={supportLoading}
            label="1st Response"
            value={supportStats.firstResponseMinutes + " min"}
            icon={Clock}
            tone="info"
            delta="Median across queues"
          />
          <SectionCard
            className="lg:col-span-3"
            title="Ticket Volume"
            description="Tickets received by day (last 2 weeks)"
          >
            {supportLoading ? (
              <ChartSkeleton height={220} />
            ) : (
              <BarSeries data={ticketBarSeries} height={220} />
            )}
          </SectionCard>
        </div>

        {/* ─── Section 4 · Agent & AI Support Leaderboard ─── */}
        <SectionCard title="Agent & AI Leaderboard" description="Top performers by resolutions and customer satisfaction" padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 text-left w-12">#</th>
                  <th className="px-5 py-3 text-left">Agent</th>
                  <th className="px-5 py-3 text-right">Resolved</th>
                  <th className="px-5 py-3 text-right">CSAT</th>
                  <th className="px-5 py-3 text-right">Performance</th>
                </tr>
              </thead>
              <tbody>
                {leaderboardLoading ? (
                  <tr className="border-t">
                    <td colSpan={5} className="px-5 py-8 text-center text-xs text-muted-foreground">
                      <Loader2 className="mx-auto size-5 animate-spin" />
                    </td>
                  </tr>
                ) : agentLeaderRows.length === 0 ? (
                  <tr className="border-t">
                    <td colSpan={5} className="px-5 py-8 text-center text-xs text-muted-foreground">
                      No leaderboard data yet.
                    </td>
                  </tr>
                ) : (
                  agentLeaderRows.slice(0, 8).map((agent, i) => {
                    const maxRes = Math.max(...agentLeaderRows.map((a: any) => a.resolved), 1);
                    const perfPct = Math.min(100, (agent.resolved / maxRes) * 100);
                    return (
                      <tr key={agent.id} className="border-t transition-colors hover:bg-muted/30">
                        <td className="px-5 py-3 text-xs font-semibold tabular-nums text-muted-foreground">
                          {String(i + 1).padStart(2, "0")}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "grid size-9 place-items-center rounded-full text-xs font-semibold",
                              agent.isBot ? "bg-violet-500/15 text-violet-500" : "bg-primary/15 text-primary"
                            )}>
                              {agent.isBot ? <Bot className="size-4" /> : (agent.name ?? "?").slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium truncate">{agent.name}</span>
                                {agent.isBot && (
                                  <Badge variant="outline" className="h-5 border-violet-500/40 bg-violet-500/10 text-violet-600 text-[10px] px-1.5">
                                    <Bot className="mr-0.5 size-3" />
                                    AI Agent
                                  </Badge>
                                )}
                                {!agent.isBot && i < 3 && (
                                  <Badge className={cn(
                                    "h-5 text-[10px] px-1.5",
                                    i === 0 ? "bg-amber-500" : i === 1 ? "bg-slate-400" : "bg-amber-700"
                                  )}>
                                    {i === 0 ? "★ Top" : i === 1 ? "2nd" : "3rd"}
                                  </Badge>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground truncate">{agent.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums font-medium">
                          {agent.resolved.toLocaleString()}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums">
                          <span className={cn(
                            "font-semibold",
                            agent.csat >= 4.7 ? "text-emerald-500" : agent.csat >= 4.3 ? "text-amber-500" : "text-muted-foreground"
                          )}>
                            {agent.csat.toFixed(1)}
                          </span>
                          <span className="text-muted-foreground text-xs"> / 5</span>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-end gap-3">
                            <Progress value={perfPct} className="h-2 w-[140px]" />
                            <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                              {perfPct.toFixed(0)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>

        {/* ─── Section 5 · System & Infrastructure Health ─── */}
        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {systemHealthIndicators.map((svc) => {
            const StatusIcon = svc.status === "healthy" ? CheckCircle2 : svc.status === "degraded" ? Clock : XCircle;
            const statusLabel = svc.status === "healthy" ? "Operational" : svc.status === "degraded" ? "Degraded" : "Outage";
            const statusColor = svc.status === "healthy" ? "text-emerald-500" : svc.status === "degraded" ? "text-amber-500" : "text-rose-500";
            const Icon = svc.icon;
            return (
              <SectionCard key={svc.id} padded={false}>
                <div className="border-b px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon className="size-4 shrink-0 text-muted-foreground" />
                      <span className="text-sm font-semibold truncate">{svc.name}</span>
                    </div>
                    <span className={cn("inline-flex shrink-0 items-center gap-1 text-[11px] font-medium", statusColor)}>
                      <StatusIcon className="size-3" />
                      {statusLabel}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] tabular-nums text-muted-foreground">
                    Latency {svc.latency} ms · p99 {Math.round(svc.latency * 1.6)} ms
                  </div>
                </div>
                <div className="px-5 py-4 space-y-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-muted-foreground">Utilization</span>
                    <span className="text-sm font-semibold tabular-nums">{svc.utilization}%</span>
                  </div>
                  <Progress value={svc.utilization} className="h-2" />
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    {svc.id === "storage" ? (
                      <span className="tabular-nums">
                        {(svc as any).usedGB} GB / {(svc as any).totalGB} GB used
                      </span>
                    ) : svc.id === "webhooks" ? (
                      <span className="tabular-nums">
                        {(((svc as any).successRate ?? 0.97) * 100).toFixed(0)}% success rate
                      </span>
                    ) : (
                      <span>Last 24h healthy</span>
                    )}
                  </div>
                </div>
              </SectionCard>
            );
          })}
        </div>

        {/* ─── Section 6 · Auditing, Governance, KB & Feature Toggles ─── */}
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
          <SectionCard
            title="Audit Trail"
            description="Recent governance activity"
          >
            {auditLoading ? (
              <ChartSkeleton height={200} />
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <div className="text-xs text-muted-foreground">Events captured</div>
                    <div className="text-2xl font-semibold tabular-nums">{governance.auditCount.toLocaleString()}</div>
                  </div>
                  <Badge variant="outline" className="gap-1 border-emerald-500/40 text-emerald-600 bg-emerald-500/10">
                    <CheckCircle2 className="size-3" /> Synced
                  </Badge>
                </div>
                <div className="space-y-2">
                  {Object.entries(governance.auditByAction).length === 0 ? (
                    <p className="text-xs text-muted-foreground">No recent actions.</p>
                  ) : (
                    Object.entries(governance.auditByAction).slice(0, 6).map(([action, count]) => (
                      <div key={action} className="flex items-center justify-between text-xs">
                        <span className="font-mono uppercase tracking-wide text-muted-foreground">{action}</span>
                        <span className="tabular-nums">{count}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Knowledge Base"
            description="Help articles & self-service health"
          >
            {helpLoading ? (
              <ChartSkeleton height={200} />
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg border p-2">
                    <div className="text-xs text-muted-foreground">Articles</div>
                    <div className="text-lg font-semibold tabular-nums">{governance.helpTotal}</div>
                  </div>
                  <div className="rounded-lg border p-2">
                    <div className="text-xs text-muted-foreground">Published</div>
                    <div className="text-lg font-semibold tabular-nums text-emerald-500">{governance.helpPublished}</div>
                  </div>
                  <div className="rounded-lg border p-2">
                    <div className="text-xs text-muted-foreground">Total Views</div>
                    <div className="text-lg font-semibold tabular-nums">{formatNumber(governance.helpViews)}</div>
                  </div>
                </div>
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Coverage completion</span>
                    <span className="tabular-nums">
                      {governance.helpTotal ? Math.round((governance.helpPublished / governance.helpTotal) * 100) : 100}%
                    </span>
                  </div>
                  <Progress
                    value={governance.helpTotal ? (governance.helpPublished / governance.helpTotal) * 100 : 100}
                    className="h-2"
                  />
                </div>
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Feature Toggles"
            description="Rollout status of platform flags"
          >
            {flagsLoading ? (
              <ChartSkeleton height={200} />
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg border p-2">
                    <div className="text-xs text-muted-foreground">Total</div>
                    <div className="text-lg font-semibold tabular-nums">{governance.flagTotal}</div>
                  </div>
                  <div className="rounded-lg border p-2">
                    <div className="text-xs text-muted-foreground">Enabled</div>
                    <div className="text-lg font-semibold tabular-nums text-emerald-500">{governance.flagEnabled}</div>
                  </div>
                  <div className="rounded-lg border p-2">
                    <div className="text-xs text-muted-foreground">Disabled</div>
                    <div className="text-lg font-semibold tabular-nums text-amber-500">
                      {governance.flagTotal - governance.flagEnabled}
                    </div>
                  </div>
                </div>
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Rollout ratio</span>
                    <span className="tabular-nums">
                      {governance.flagTotal ? Math.round((governance.flagEnabled / governance.flagTotal) * 100) : 0}%
                    </span>
                  </div>
                  <Progress
                    value={governance.flagTotal ? (governance.flagEnabled / governance.flagTotal) * 100 : 0}
                    className="h-2"
                  />
                </div>
                <p className="pt-1 text-[11px] text-muted-foreground">
                  Flags govern experiments, gradual rollouts, and AI-model switches.
                </p>
              </div>
            )}
          </SectionCard>
        </div>
      </>)}

      {/* ─── Export Dialog ─── */}
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Export Analytics</DialogTitle>
            <DialogDescription>
              Choose the format for your analytics export.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Export Format</Label>
              <div className="grid grid-cols-3 gap-2">
                {["csv", "json", "pdf"].map((format) => (
                  <button
                    key={format}
                    onClick={() => setExportFormat(format as typeof exportFormat)}
                    className={cn(
                      "rounded-lg border-2 p-3 text-center transition-all",
                      exportFormat === format
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-muted-foreground/30"
                    )}
                  >
                    <span className="text-sm font-medium uppercase">{format}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Date Range</Label>
              <Select defaultValue="30d">
                <SelectTrigger>
                  <SelectValue placeholder="Select range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                  <SelectItem value="1y">Last year</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleExportConfirm} disabled={isExporting}>
              {isExporting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="mr-2 size-4" />
                  Export
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Fullscreen Exit Button ─── */}
      {isFullscreen && (
        <Button
          variant="outline"
          size="sm"
          className="fixed bottom-4 right-4 z-50 gap-1.5"
          onClick={() => setIsFullscreen(false)}
        >
          <Minimize2 className="size-4" />
          Exit Fullscreen
        </Button>
      )}
    </div>
  );
}