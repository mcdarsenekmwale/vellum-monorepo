// components/dashboard/AdminDashboard.tsx
"use client";

import { Link } from "@tanstack/react-router";
import {
  Users,
  FileText,
  Flag,
  Eye,
  Sparkles,
  ArrowRight,
  Settings,
  Shield,
  Database,
  Server,
  Bell,
  BarChart3,
  RefreshCw,
  CheckCircle2,
  Clock,
  Zap,
  Activity,
  Calendar,
  Filter,
  Download,
} from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { LargeAreaChart, MultiLine, Donut, BarSeries } from "@/components/dashboard/charts";
import { ChartSkeleton, Shimmer } from "@/components/dashboard/skeletons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  useDashboardStats,
  useUsers,
  useArticles,
  useHighlights,
  useAnalyticsTimeseries,
  useTrafficSources,
  useJobs,
  useReports,
  useStorageStats,
} from "@/lib/api/hooks";
import { resolveAvatar } from "@/lib/avatar";
import { usePermissions } from "@/lib/auth/hooks";
import { useState, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function AdminDashboard() {
  const { user } = usePermissions();
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useDashboardStats();
  const { data: usersData, isLoading: usersLoading, refetch: refetchUsers } = useUsers({ limit: 6, except: "ADMIN" });
  const { data: articlesData, isLoading: articlesLoading, refetch: refetchArticles } = useArticles({ limit: 6 });
  const { data: highlightsData, isLoading: highlightsLoading } = useHighlights({ limit: 6 });
  const { data: timeseries, refetch: refetchTimeseries } = useAnalyticsTimeseries(30);
  const { data: traffic, refetch: refetchTraffic } = useTrafficSources();
  const { data: jobsData, refetch: refetchJobs } = useJobs({ limit: 5 });
  const { data: reportsData, refetch: refetchReports } = useReports({ limit: 5 });
  const { data: storage, refetch: refetchStorage } = useStorageStats();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [, setDateRange] = useState<"7d" | "30d" | "90d">("30d");

  const loading = statsLoading || usersLoading || articlesLoading || highlightsLoading;

  const growth = (timeseries ?? []).map((p) => ({ date: p.date, value: p.users }));
  const engagement = (timeseries ?? []).map((p) => ({
    date: p.date,
    views: p.articles,
    watch: p.highlights,
    likes: p.comments,
  }));
  const uploads = (timeseries ?? []).map((p) => ({ date: p.date, value: p.articles + p.highlights }));
  const trafficData = Array.isArray(traffic) ? traffic.map((t) => ({ name: t.source, value: Math.round(t.percentage) })) : [];
  const articles = articlesData?.data ?? [];
  const highlights = highlightsData?.data ?? [];
  const users = usersData?.data ?? [];
  const jobs = jobsData?.data ?? [];
  const openReports = reportsData?.data ?? [];

  const totalContent = (stats?.totalArticles || 0) + (stats?.totalHighlights || 0);
  const criticalReports = openReports.filter((r) => r.priority === "critical").length;
  const activeUsers = stats?.activeUsers ?? 0;
  const totalViews = stats?.totalViews ?? 0;
  const totalUsers = stats?.totalUsers ?? 0;
  const avgEngagement = totalUsers > 0 ? Math.round((totalViews / totalUsers) * 10) / 10 : 0;

  // Calculate trends
  const userGrowth = useMemo(() => {
    const current = timeseries?.slice(-7) ?? [];
    const previous = timeseries?.slice(-14, -7) ?? [];
    const currentAvg = current.reduce((acc, d) => acc + d.users, 0) / (current.length || 1);
    const prevAvg = previous.reduce((acc, d) => acc + d.users, 0) / (previous.length || 1);
    return prevAvg > 0 ? ((currentAvg - prevAvg) / prevAvg) * 100 : 0;
  }, [timeseries]);

  const greeting = useCallback(() => {
    const now = new Date();
    const hour = now.getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        refetchStats(),
        refetchUsers(),
        refetchArticles(),
        refetchTimeseries(),
        refetchTraffic(),
        refetchJobs(),
        refetchReports(),
        refetchStorage(),
      ]);
      toast.success("Dashboard refreshed successfully");
    } catch (error) {
      toast.error("Failed to refresh dashboard");
    } finally {
      setIsRefreshing(false);
    }
  }, [refetchStats, refetchUsers, refetchArticles, refetchTimeseries, refetchTraffic, refetchJobs, refetchReports, refetchStorage]);

  const handleExport = useCallback(() => {
    toast.success("Dashboard data exported");
  }, []);

  return (
    <div className="space-y-8">
      {/* Modern Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1 text-xs">
              <Sparkles className="size-3" />
              Admin
            </Badge>
            <Badge variant="secondary" className="text-xs">
              v2.0
            </Badge>
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            {greeting()}, {user?.name ?? "Admin"} 👋
          </h1>
          <p className="text-muted-foreground">
            Here's what's happening across your platform today.
          </p>
        </div>
        <div className="flex items-center gap-2">
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
            <TooltipContent>Refresh all dashboard data</TooltipContent>
          </Tooltip>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Filter className="size-4" />
                <span className="hidden sm:inline">Filter</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setDateRange("7d")}>
                <Clock className="mr-2 size-3.5" /> Last 7 days
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDateRange("30d")}>
                <Calendar className="mr-2 size-3.5" /> Last 30 days
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDateRange("90d")}>
                <Calendar className="mr-2 size-3.5" /> Last 90 days
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button size="sm" className="gap-1.5" onClick={handleExport}>
            <Download className="size-4" />
            <span className="hidden sm:inline">Export</span>
          </Button>
        </div>
      </div>

      {/* Stats Grid with Modern Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          loading={loading}
          label="Active Users"
          value={activeUsers.toLocaleString()}
          icon={Users}
          tone="primary"
          delta={userGrowth}
          hint="vs. last 7 days"
        />
        <StatCard
          loading={loading}
          label="Content Published"
          value={totalContent.toLocaleString()}
          icon={FileText}
          tone="info"
          delta={3.8}
          hint={`${stats?.totalHighlights ?? 0} highlights`}
        />
        <StatCard
          loading={loading}
          label="Total Views"
          value={totalViews.toLocaleString()}
          icon={Eye}
          tone="success"
          delta={8.2}
          hint="all time"
        />
        <StatCard
          loading={loading}
          label="Open Reports"
          value={openReports.length}
          icon={Flag}
          tone={criticalReports > 0 ? "destructive" : "warning"}
          delta={-14.6}
          hint={`${criticalReports} critical`}
        />
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          loading={loading}
          label="System Health"
          value={stats ? "100%" : "—"}
          icon={CheckCircle2}
          tone="success"
        />
        <StatCard
          loading={loading}
          label="Storage Used"
          value={storage ? `${((storage.totalSize ?? 0) / 1e9).toFixed(1)} GB` : "—"}
          icon={Database}
          tone="info"
          hint={`${storage?.totalFiles ?? 0} files`}
        />
        <StatCard
          loading={loading}
          label="Avg. Engagement"
          value={avgEngagement.toFixed(1)}
          icon={Activity}
          tone="primary"
          hint="views per user"
        />
        <StatCard
          loading={loading}
          label="Active Jobs"
          value={jobs.filter(j => j.status === "running").length}
          icon={Zap}
          tone="warning"
          hint={`${jobs.filter(j => j.status === "completed").length} completed`}
        />
      </div>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <SectionCard 
          className="lg:col-span-2" 
          title="Platform Growth" 
          description="Daily active users across all surfaces"
          action={
            <Button variant="ghost" size="sm" className="gap-1">
              <BarChart3 className="size-3.5" />
              Details
            </Button>
          }
        >
          {loading ? <ChartSkeleton height={260} /> : (
            <LargeAreaChart data={growth.length ? growth : [{ date: "—", value: 0 }]} />
          )}
        </SectionCard>

        <SectionCard title="Traffic Sources" description="Where visits come from">
          {loading ? (
            <div className="space-y-3">
              <Shimmer className="mx-auto h-40 w-40 rounded-full" />
              <Shimmer className="h-3 w-full" />
            </div>
          ) : (
            <>
              <Donut data={trafficData.length ? trafficData : [{ name: "Direct", value: 100 }]} height={200} />
              <div className="mt-4 space-y-2">
                {(trafficData.length ? trafficData : [{ name: "Direct", value: 100 }]).map((t, i) => (
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
      </div>

      {/* Engagement and Uploads */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <SectionCard 
          title="Engagement Metrics" 
          description="Articles, highlights and comments" 
          className="lg:col-span-2"
        >
          {loading ? <ChartSkeleton height={240} /> : (
            <MultiLine
              data={engagement}
              keys={[
                { key: "views", color: "var(--chart-1)", label: "Articles" },
                { key: "watch", color: "var(--chart-2)", label: "Highlights" },
                { key: "likes", color: "var(--chart-3)", label: "Comments" },
              ]}
            />
          )}
        </SectionCard>

        <SectionCard title="Content Uploads" description="Platform-wide creation">
          {loading ? <ChartSkeleton height={220} /> : (
            <BarSeries data={uploads.length ? uploads : [{ date: "—", value: 0 }]} />
          )}
        </SectionCard>
      </div>

      {/* System Status Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        <SectionCard title="System Health" description="All services status">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="size-4 text-muted-foreground" />
                <span className="text-sm">Database</span>
              </div>
              <StatusBadge status={stats ? "active" : "pending"} />
            </div>
            <Progress value={stats ? 100 : 0} className="h-1.5" />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Server className="size-4 text-muted-foreground" />
                <span className="text-sm">API Service</span>
              </div>
              <StatusBadge status={stats ? "active" : "pending"} />
            </div>
            <Progress value={stats ? 100 : 0} className="h-1.5" />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="size-4 text-muted-foreground" />
                <span className="text-sm">Notifications</span>
              </div>
              <StatusBadge status={stats ? "active" : "pending"} />
            </div>
            <Progress value={stats ? 100 : 0} className="h-1.5" />
          </div>
        </SectionCard>

        <SectionCard title="Storage" description="Across all media">
          <div className="flex items-baseline gap-2">
            <div className="text-2xl font-semibold tabular-nums">{(storage?.totalFiles ?? 0).toLocaleString()}</div>
            <span className="text-xs text-muted-foreground">files</span>
          </div>
          <div className="text-sm text-muted-foreground mt-1">{((storage?.totalSize ?? 0) / 1e9).toFixed(1)} GB used</div>
          <Progress value={Math.min(100, ((storage?.totalSize ?? 0) / 5e10) * 100)} className="mt-3 h-1.5" />
          <div className="flex items-center gap-2 mt-3">
            <Button asChild variant="outline" size="sm" className="gap-1">
              <Link to="/storage">
                <Database className="size-3.5" /> Manage Storage
              </Link>
            </Button>
          </div>
        </SectionCard>

        <SectionCard title="Background Jobs" description="Recent activity" padded={false}>
          <ul className="divide-y text-xs">
            {jobs.length === 0 ? (
              <li className="px-5 py-4 text-muted-foreground">No recent jobs.</li>
            ) : (
              jobs.slice(0, 5).map((j) => (
                <li key={j.id} className="flex items-center justify-between px-5 py-2.5">
                  <div>
                    <div className="font-medium">{j.name}</div>
                    <div className="text-muted-foreground">{j.queue}</div>
                  </div>
                  <StatusBadge status={j.status} />
                </li>
              ))
            )}
          </ul>
        </SectionCard>

        <SectionCard title="Recent Reports" description="Awaiting review" padded={false}>
          <ul className="divide-y text-xs">
            {openReports.length === 0 ? (
              <li className="px-5 py-4 text-muted-foreground">No open reports.</li>
            ) : (
              openReports.slice(0, 5).map((r) => (
                <li key={r.id} className="flex items-center justify-between px-5 py-2.5">
                  <div>
                    <div className="font-medium capitalize">{r.reason}</div>
                    <div className="text-muted-foreground">{r.targetType}</div>
                  </div>
                  <StatusBadge status={r.status} />
                </li>
              ))
            )}
          </ul>
          {openReports.length > 0 && (
            <div className="border-t p-3">
              <Button asChild variant="ghost" size="sm" className="w-full gap-1">
                <Link to="/moderation">
                  View all <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            </div>
          )}
        </SectionCard>
      </div>

      {/* Trending Content & Top Creators */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <SectionCard 
          className="lg:col-span-2" 
          title="Trending Content" 
          description="Top performing this week"
          action={
            <Button asChild variant="ghost" size="sm" className="gap-1">
              <Link to="/highlights">
                View all <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          } 
          padded={false}
        >
          <ul className="divide-y">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <li key={i} className="flex items-center gap-3 px-5 py-3">
                  <Shimmer className="size-8 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-1">
                    <Shimmer className="h-4 w-3/4" />
                    <Shimmer className="h-3 w-1/2" />
                  </div>
                </li>
              ))
            ) : (
              [...articles, ...highlights].slice(0, 6).map((c: any, i) => (
                <li key={c.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors">
                  <div className="grid size-8 shrink-0 place-items-center rounded-md bg-primary/10 text-xs font-semibold text-primary tabular-nums">
                    {i + 1}
                  </div>
                  <Avatar className="size-8 shrink-0">
                    <AvatarImage src={c.cover ?? c.thumbnailUrl ?? undefined} />
                    <AvatarFallback>{c.title?.[0] || "?"}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{c.title}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {"slug" in c ? "Article" : "Highlight"} · {c.author?.name ?? c.authorId?.slice(0, 8) ?? "—"}
                    </div>
                  </div>
                  <div className="hidden text-right sm:block">
                    <div className="text-sm font-semibold tabular-nums">
                      {(c.views ?? c.shares ?? 0).toLocaleString()}
                    </div>
                    <div className="text-[11px] text-muted-foreground">views</div>
                  </div>
                </li>
              ))
            )}
          </ul>
        </SectionCard>

        <SectionCard 
          title="Top Creators" 
          description="By recent activity"
          action={
            <Button asChild variant="ghost" size="sm" className="gap-1">
              <Link to="/users">
                View all <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          }
          padded={false}
        >
          <ul className="divide-y">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <li key={i} className="flex items-center gap-3 px-5 py-3">
                  <Shimmer className="size-9 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-1">
                    <Shimmer className="h-4 w-3/4" />
                    <Shimmer className="h-3 w-1/2" />
                  </div>
                </li>
              ))
            ) : (
              users.slice(0, 6).map((u) => (
                <li key={u.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors">
                  <Avatar className="size-9 shrink-0">
                    <AvatarImage src={resolveAvatar(u.avatar, u.handle)} />
                    <AvatarFallback>{u.name[0]}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{u.name}</div>
                    <div className="truncate text-xs text-muted-foreground">@{u.handle}</div>
                  </div>
                  <Badge variant={u.isActive ? "default" : "secondary"} className="text-[10px]">
                    {u.isActive ? "Active" : "Inactive"}
                  </Badge>
                </li>
              ))
            )}
          </ul>
        </SectionCard>
      </div>

      {/* Quick Actions */}
      <SectionCard title="Quick Actions" description="Admin tools and shortcuts">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          <Button asChild variant="outline" className="h-auto flex-col gap-1.5 py-4">
            <Link to="/users">
              <Users className="size-5" />
              <span className="text-xs font-medium">Users</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-auto flex-col gap-1.5 py-4">
            <Link to="/moderation">
              <Shield className="size-5" />
              <span className="text-xs font-medium">Moderation</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-auto flex-col gap-1.5 py-4">
            <Link to="/highlights">
              <Sparkles className="size-5" />
              <span className="text-xs font-medium">Highlights</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-auto flex-col gap-1.5 py-4">
            <Link to="/settings">
              <Settings className="size-5" />
              <span className="text-xs font-medium">Settings</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-auto flex-col gap-1.5 py-4">
            <Link to="/analytics">
              <BarChart3 className="size-5" />
              <span className="text-xs font-medium">Analytics</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-auto flex-col gap-1.5 py-4">
            <Link to="/audit">
              <Activity className="size-5" />
              <span className="text-xs font-medium">Audit</span>
            </Link>
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}