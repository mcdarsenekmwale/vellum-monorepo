"use client";

import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Users,
  FileText,
  Flag,
  Eye,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { LargeAreaChart, MultiLine, Donut, BarSeries } from "@/components/dashboard/charts";
import { ChartSkeleton, Shimmer } from "@/components/dashboard/skeletons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({
    meta: [{ title: "Overview · Vellum Admin" }],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: usersData, isLoading: usersLoading } = useUsers({ limit: 6, except: "ADMIN" });
  const { data: articlesData, isLoading: articlesLoading } = useArticles({ limit: 6 });
  const { data: highlightsData } = useHighlights({ limit: 6 });
  const { data: timeseries } = useAnalyticsTimeseries(30);
  const { data: traffic } = useTrafficSources();
  const { data: jobsData } = useJobs({ limit: 5 });
  const { data: reportsData } = useReports({ limit: 5 });
  const { data: storage } = useStorageStats();

  const loading = statsLoading || usersLoading || articlesLoading;

  const growth = (timeseries ?? []).map((p) => ({ date: p.date, value: p.users }));
  const engagement = (timeseries ?? []).map((p) => ({
    date: p.date,
    views: p.articles,
    watch: p.highlights,
    likes: p.comments,
  }));
  const uploads = (timeseries ?? []).map((p) => ({ date: p.date, value: p.articles + p.highlights }));
  const trafficData = Array.isArray(traffic) ? traffic.map((t, i) => ({ name: t.source, value: Math.round(t.percentage) })) : [];
  const articles = articlesData?.data ?? [];
  const highlights = highlightsData?.data ?? [];
  const users = usersData?.data ?? [];
  const jobs = jobsData?.data ?? [];
  const openReports = reportsData?.data ?? [];

  const totalContent = (stats?.totalArticles || 0) + (stats?.totalHighlights || 0);
  
  // Greeting
  const greeting = () => {
    const now = new Date();
    const hour = now.getHours();
    if (hour < 12) {
      return "Good morning, Admin";
    } else if (hour < 18) {
      return "Good afternoon, Admin";
    } else {
      return "Good evening, Admin";
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Overview"
        title={greeting()}
        description="Here's what's happening across the platform today."
        actions={
          <>
            <Button variant="outline" size="sm">Last 30 days</Button>
            <Button size="sm" className="gap-1.5">
              <Sparkles className="size-4" /> Insights
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard loading={loading} label="Active users" value={(stats?.activeUsers ?? 0).toLocaleString()} delta={12.4} icon={Users} tone="primary" hint="vs. last 30 days" />
        <StatCard loading={loading} label="Content published" value={totalContent.toLocaleString()} delta={3.8} icon={FileText} tone="info" hint={`${stats?.totalHighlights ?? 0} highlights`} />
        <StatCard loading={loading} label="Total views" value={(stats?.totalViews ?? 0).toLocaleString()} delta={8.2} icon={Eye} tone="success" hint="all time" />
        <StatCard loading={loading} label="Open reports" value={openReports.length} delta={-14.6} icon={Flag} tone="warning" hint={`${openReports.filter((r) => r.priority === "critical").length} critical`} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <SectionCard
          className="lg:col-span-2"
          title="Platform growth"
          description="Daily active users across all surfaces"
        >
          {loading ? <ChartSkeleton height={260} /> : <LargeAreaChart data={growth.length ? growth : [{ date: "—", value: 0 }]} />}
        </SectionCard>

        <SectionCard title="Traffic sources" description="Where visits come from">
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <SectionCard title="Engagement" description="Articles, highlights and comments" className="lg:col-span-2">
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

        <SectionCard title="Uploads / day" description="Content created platform-wide">
          {loading ? <ChartSkeleton height={220} /> : <BarSeries data={uploads.length ? uploads : [{ date: "—", value: 0 }]} />}
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <SectionCard
          className="lg:col-span-2"
          title="Trending content"
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
                <li key={c.id} className="flex items-center gap-3 px-5 py-3">
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

        <SectionCard title="Top creators" description="By recent activity" padded={false}>
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
                <li key={u.id} className="flex items-center gap-3 px-5 py-3">
                  <Avatar className="size-9 shrink-0">
                    <AvatarImage src={resolveAvatar(u.avatar, u.handle)} />
                    <AvatarFallback>{u.name[0]}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{u.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{u.handle}</div>
                  </div>
                  <StatusBadge status={u.isActive ? "active" : "suspended"} />
                </li>
              ))
            )}
          </ul>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <SectionCard title="System health" description="Database status">
          <div className="space-y-3">
            <div>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-medium">Database</span>
                <span className="tabular-nums text-muted-foreground">{stats ? "online" : "—"}</span>
              </div>
              <Progress value={stats ? 100 : 0} className="h-1.5" />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Storage" description="Across all media">
          <div className="flex items-baseline gap-2">
            <div className="text-2xl font-semibold tabular-nums">{(storage?.totalFiles ?? 0).toLocaleString()}</div>
            <span className="text-xs text-muted-foreground">files</span>
          </div>
          <Progress value={Math.min(100, (storage?.totalSize ?? 0) / 1e10)} className="mt-3 h-1.5" />
        </SectionCard>

        <SectionCard title="Background jobs" description="Recent" padded={false}>
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

        <SectionCard title="Recent reports" description="Awaiting review" padded={false}>
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
                  <StatusBadge status={r.priority} />
                </li>
              ))
            )}
          </ul>
        </SectionCard>
      </div>
    </div>
  );
}
