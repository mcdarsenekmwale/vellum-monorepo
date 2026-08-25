import { createFileRoute } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { SectionCard } from "@/components/dashboard/section-card";
import { LargeAreaChart, MultiLine, Donut } from "@/components/dashboard/charts";
import { Button } from "@/components/ui/button";
import { ChartSkeleton } from "@/components/dashboard/skeletons";
import { useAnalyticsOverview, useAnalyticsTimeseries, useTrafficSources } from "@/lib/api/hooks";

export const Route = createFileRoute("/_app/analytics")({
  head: () => ({ meta: [{ title: "Analytics · Vellbase Admin" }] }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const { data: overview, isLoading } = useAnalyticsOverview();
  const { data: timeseries } = useAnalyticsTimeseries(30);
  const { data: traffic } = useTrafficSources();

  const growth = (timeseries ?? []).map((p) => ({ date: p.date, value: p.users }));
  const engagement = (timeseries ?? []).map((p) => ({
    date: p.date,
    users: p.users,
    articles: p.articles,
    comments: p.comments,
  }));
  const trafficSources = traffic?.sources ?? [];
  const totalTrafficViews = traffic?.totalViews ?? 1;
  const trafficData = trafficSources.map((t) => ({
    name: t.name,
    value: Math.round((t.views / totalTrafficViews) * 100),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Growth"
        title="Analytics"
        description="Cross-platform performance across users, content and consumption."
        actions={<Button variant="outline" size="sm" className="gap-1.5"><Download className="size-4" /> Export CSV</Button>}
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard loading={isLoading} label="Total users" value={(overview?.totalUsers ?? 0).toLocaleString()} tone="primary" />
        <StatCard loading={isLoading} label="Active users (24h)" value={(overview?.dailyActiveUsers ?? 0).toLocaleString()} tone="info" />
        <StatCard loading={isLoading} label="Weekly active" value={(overview?.weeklyActiveUsers ?? 0).toLocaleString()} tone="success" />
        <StatCard loading={isLoading} label="Total views" value={(overview?.totalViews ?? 0).toLocaleString()} tone="warning" />
      </div>
      <SectionCard title="User growth" description="Daily active over 30 days">
        {isLoading ? <ChartSkeleton height={300} /> : <LargeAreaChart data={growth.length ? growth : [{ date: "—", value: 0 }]} height={300} />}
      </SectionCard>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard title="Engagement">
          {isLoading ? <ChartSkeleton height={240} /> : (
            <MultiLine
              data={engagement}
              keys={[
                { key: "users", color: "var(--chart-1)", label: "Users" },
                { key: "articles", color: "var(--chart-2)", label: "Articles" },
                { key: "comments", color: "var(--chart-3)", label: "Comments" },
              ]}
            />
          )}
        </SectionCard>
        <SectionCard title="Traffic sources">
          {isLoading ? <ChartSkeleton height={240} /> : <Donut data={trafficData.length ? trafficData : [{ name: "Direct", value: 100 }]} />}
        </SectionCard>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <SectionCard title="Content summary" className="lg:col-span-2" padded={false}>
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3 text-left">Metric</th>
                <th className="px-5 py-3 text-right">Count</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t"><td className="px-5 py-3 font-medium">Total articles</td><td className="px-5 py-3 text-right tabular-nums">{(overview?.totalArticles ?? 0).toLocaleString()}</td></tr>
              <tr className="border-t"><td className="px-5 py-3 font-medium">Total highlights</td><td className="px-5 py-3 text-right tabular-nums">{(overview?.totalHighlights ?? 0).toLocaleString()}</td></tr>
              <tr className="border-t"><td className="px-5 py-3 font-medium">Total comments</td><td className="px-5 py-3 text-right tabular-nums">{(overview?.totalComments ?? 0).toLocaleString()}</td></tr>
              <tr className="border-t"><td className="px-5 py-3 font-medium">Total likes</td><td className="px-5 py-3 text-right tabular-nums">{(overview?.totalLikes ?? 0).toLocaleString()}</td></tr>
              <tr className="border-t"><td className="px-5 py-3 font-medium">New users today</td><td className="px-5 py-3 text-right tabular-nums">{(overview?.newUsersToday ?? 0).toLocaleString()}</td></tr>
              <tr className="border-t"><td className="px-5 py-3 font-medium">New content today</td><td className="px-5 py-3 text-right tabular-nums">{(overview?.newContentToday ?? 0).toLocaleString()}</td></tr>
            </tbody>
          </table>
        </SectionCard>
        <SectionCard title="Traffic share">
          <Donut data={trafficData.length ? trafficData : [{ name: "Direct", value: 100 }]} />
        </SectionCard>
      </div>
    </div>
  );
}
