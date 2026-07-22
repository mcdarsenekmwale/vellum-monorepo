"use client";

import { Link } from "@tanstack/react-router";
import {
  FileText,
  Eye,
  Heart,
  Share2,
  Bookmark,
  ArrowRight,
  Calendar,
  TrendingUp,
  Clock,
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { LargeAreaChart, MultiLine } from "@/components/dashboard/charts";
import { ChartSkeleton, Shimmer } from "@/components/dashboard/skeletons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  useDashboardStats,
  useArticles,
  useHighlights,
  useAnalyticsTimeseries,
} from "@/lib/api/hooks";
import { usePermissions } from "@/lib/auth/hooks";

export function CreatorDashboard() {
  const { user } = usePermissions();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: articlesData, isLoading: articlesLoading } = useArticles({ limit: 6 });
  const { data: highlightsData, isLoading: highlightsLoading } = useHighlights({ limit: 6 });
  const { data: timeseries } = useAnalyticsTimeseries(30);

  const loading = statsLoading || articlesLoading || highlightsLoading;

  const engagement = (timeseries ?? []).map((p) => ({
    date: p.date,
    views: p.articles,
    likes: p.comments,
    shares: p.highlights,
  }));

  const articles = articlesData?.data ?? [];
  const highlights = highlightsData?.data ?? [];

  const greeting = () => {
    const now = new Date();
    const hour = now.getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Creator Dashboard"
        title={`${greeting()}, ${user?.name ?? "Creator"}`}
        description="Track your content performance and engagement metrics."
        actions={
          <>
            <Button variant="outline" size="sm">Last 30 days</Button>
            <Button size="sm" className="gap-1.5">
              <FileText className="size-4" /> New Post
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard loading={loading} label="Total articles" value={(stats?.totalArticles || 0).toLocaleString()} delta={5.2} icon={FileText} tone="primary" hint="this month" />
        <StatCard loading={loading} label="Total highlights" value={(stats?.totalHighlights || 0).toLocaleString()} delta={12.8} icon={Share2} tone="info" hint="this month" />
        <StatCard loading={loading} label="Total views" value={(stats?.totalViews || 0).toLocaleString()} delta={8.2} icon={Eye} tone="success" hint="all time" />
        <StatCard loading={loading} label="Total likes" value={(stats?.totalLikes || 0).toLocaleString()} delta={15.4} icon={Heart} tone="warning" hint="vs. last month" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard title="Content engagement" description="Your content performance over time">
          {loading ? <ChartSkeleton height={260} /> : (
            <MultiLine
              data={engagement}
              keys={[
                { key: "views", color: "var(--chart-1)", label: "Views" },
                { key: "likes", color: "var(--chart-2)", label: "Likes" },
                { key: "shares", color: "var(--chart-3)", label: "Shares" },
              ]}
            />
          )}
        </SectionCard>

        <SectionCard title="Content overview" description="Your recent publications">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="size-4 text-primary" />
                <span className="text-sm font-medium">Articles</span>
              </div>
              <Badge variant="secondary">{articles.length}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Share2 className="size-4 text-info" />
                <span className="text-sm font-medium">Highlights</span>
              </div>
              <Badge variant="secondary">{highlights.length}</Badge>
            </div>
            <div className="pt-2">
              <Button asChild variant="outline" className="w-full">
                <Link to="/articles">View all content</Link>
              </Button>
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard title="Recent articles" description="Your latest publications" action={
          <Button asChild variant="ghost" size="sm" className="gap-1">
            <Link to="/articles">
              View all <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        } padded={false}>
          <ul className="divide-y">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <li key={i} className="flex items-center gap-3 px-5 py-3">
                  <Shimmer className="size-10 rounded-md" />
                  <div className="min-w-0 flex-1 space-y-1">
                    <Shimmer className="h-4 w-3/4" />
                    <Shimmer className="h-3 w-1/2" />
                  </div>
                </li>
              ))
            ) : (
              articles.slice(0, 4).map((article: any) => (
                <li key={article.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="relative size-10 shrink-0 rounded-md overflow-hidden bg-muted">
                    {article.cover && <AvatarImage src={article.cover} className="size-full object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{article.title}</div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Eye className="size-3" />
                        {(article.views ?? 0).toLocaleString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Heart className="size-3" />
                        {(article.likesCount ?? 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <StatusBadge status={article.status || "published"} />
                </li>
              ))
            )}
          </ul>
        </SectionCard>

        <SectionCard title="Recent highlights" description="Your latest highlights" action={
          <Button asChild variant="ghost" size="sm" className="gap-1">
            <Link to="/highlights">
              View all <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        } padded={false}>
          <ul className="divide-y">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <li key={i} className="flex items-center gap-3 px-5 py-3">
                  <Shimmer className="size-10 rounded-md" />
                  <div className="min-w-0 flex-1 space-y-1">
                    <Shimmer className="h-4 w-3/4" />
                    <Shimmer className="h-3 w-1/2" />
                  </div>
                </li>
              ))
            ) : (
              highlights.slice(0, 4).map((highlight: any) => (
                <li key={highlight.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="relative size-10 shrink-0 rounded-md overflow-hidden bg-muted">
                    {highlight.thumbnailUrl && <AvatarImage src={highlight.thumbnailUrl} className="size-full object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{highlight.title}</div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Eye className="size-3" />
                        {(highlight.views ?? 0).toLocaleString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Share2 className="size-3" />
                        {(highlight.shares ?? 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <StatusBadge status="published" />
                </li>
              ))
            )}
          </ul>
        </SectionCard>
      </div>

      <SectionCard title="Quick actions" description="Create and manage your content">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Button asChild variant="outline" className="h-14 flex-col gap-1">
            <Link to="/articles">
              <FileText className="size-5" />
              <span className="text-xs">Manage Articles</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-14 flex-col gap-1">
            <Link to="/highlights">
              <Share2 className="size-5" />
              <span className="text-xs">Manage Highlights</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-14 flex-col gap-1">
            <Link to="/profile">
              <Bookmark className="size-5" />
              <span className="text-xs">My Profile</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-14 flex-col gap-1">
            <Link to="/analytics">
              <TrendingUp className="size-5" />
              <span className="text-xs">Analytics</span>
            </Link>
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}
