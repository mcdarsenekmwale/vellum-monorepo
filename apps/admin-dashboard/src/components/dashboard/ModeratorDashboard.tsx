"use client";

import { Link } from "@tanstack/react-router";
import {
  Flag,
  Eye,
  Shield,
  MessageSquare,
  ArrowRight,
  AlertTriangle,
  CheckCircle,
  Clock,
  Ban,
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { ChartSkeleton, Shimmer } from "@/components/dashboard/skeletons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  useReports,
  useComments,
  useArticles,
  useHighlights,
} from "@/lib/api/hooks";
import { usePermissions } from "@/lib/auth/hooks";

export function ModeratorDashboard() {
  const { user } = usePermissions();
  const { data: reportsData, isLoading: reportsLoading } = useReports({ limit: 10 });
  const { data: commentsData, isLoading: commentsLoading } = useComments({ limit: 6 });
  const { data: articlesData } = useArticles({ limit: 6 });
  const { data: highlightsData } = useHighlights({ limit: 6 });

  const loading = reportsLoading || commentsLoading;

  const reports = reportsData?.data ?? [];
  const comments = commentsData?.data ?? [];
  const articles = articlesData?.data ?? [];
  const highlights = highlightsData?.data ?? [];

  const openReports = reports.filter((r) => r.status === "pending").length;
  const criticalReports = reports.filter((r) => r.priority === "critical").length;
  const resolvedReports = reports.filter((r) => r.status === "resolved").length;

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
        eyebrow="Moderation Dashboard"
        title={`${greeting()}, ${user?.name ?? "Moderator"}`}
        description="Review and moderate content across the platform."
        actions={
          <>
            <Button variant="outline" size="sm">Pending reports</Button>
            <Button size="sm" className="gap-1.5">
              <Shield className="size-4" /> Review Queue
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard loading={loading} label="Open reports" value={openReports} delta={-12.5} icon={Flag} tone={criticalReports > 0 ? "destructive" : "warning"} hint={`${criticalReports} critical`} />
        <StatCard loading={loading} label="Resolved today" value={resolvedReports} delta={8.3} icon={CheckCircle} tone="success" hint="this week" />
        <StatCard loading={loading} label="Total content" value={(articles.length + highlights.length).toLocaleString()} icon={Eye} tone="info" hint="pending review" />
        <StatCard loading={loading} label="Comments" value={comments.length} icon={MessageSquare} tone="primary" hint="awaiting moderation" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <SectionCard className="lg:col-span-2" title="Open reports" description="Content requiring moderation review" action={
          <Button asChild variant="ghost" size="sm" className="gap-1">
            <Link to="/moderation">
              View all <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        } padded={false}>
          <ul className="divide-y">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <li key={i} className="flex items-center gap-3 px-5 py-3">
                  <Shimmer className="size-10 rounded-md" />
                  <div className="min-w-0 flex-1 space-y-1">
                    <Shimmer className="h-4 w-3/4" />
                    <Shimmer className="h-3 w-1/2" />
                  </div>
                  <Shimmer className="h-6 w-16 rounded" />
                </li>
              ))
            ) : (
              reports.slice(0, 6).map((report) => (
                <li key={report.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="relative size-10 shrink-0 rounded-md overflow-hidden bg-muted">
                    {report.targetType === "article" && articles.find((a) => a.id === report.targetId)?.cover && (
                      <AvatarImage src={articles.find((a) => a.id === report.targetId)?.cover ?? undefined} className="size-full object-cover" />
                    )}
                    {report.targetType === "highlight" && highlights.find((h) => h.id === report.targetId)?.thumbnailUrl && (
                      <AvatarImage src={highlights.find((h) => h.id === report.targetId)?.thumbnailUrl ?? undefined} className="size-full object-cover" />
                    )}
                    {!(report.targetType === "article" && articles.find((a) => a.id === report.targetId)?.cover) &&
                     !(report.targetType === "highlight" && highlights.find((h) => h.id === report.targetId)?.thumbnailUrl) && (
                      <div className="grid size-full place-items-center text-muted-foreground">
                        <AlertTriangle className="size-5" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={report.priority === "critical" ? "destructive" : "secondary"} className="text-[10px]">
                        {report.priority}
                      </Badge>
                      <span className="text-sm font-medium capitalize">{report.reason}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{report.targetType}</span>
                      <span>•</span>
                      <span>Reported by: {report.reporterId?.slice(0, 8)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={report.status} />
                    <Button asChild size="sm" variant="outline">
                      <Link to={`/moderation/${report.id}`}>Review</Link>
                    </Button>
                  </div>
                </li>
              ))
            )}
          </ul>
        </SectionCard>

        <SectionCard title="Moderation stats" description="Your performance metrics">
          <div className="space-y-4">
            <div>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-medium">Resolution rate</span>
                <span className="tabular-nums text-muted-foreground">87%</span>
              </div>
              <Progress value={87} className="h-2" />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-medium">Pending reviews</span>
                <span className="tabular-nums text-muted-foreground">{openReports}</span>
              </div>
              <Progress value={Math.min(100, (resolvedReports / (resolvedReports + openReports)) * 100)} className="h-2" />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-medium">Average time</span>
                <span className="tabular-nums text-muted-foreground">2.4h</span>
              </div>
              <Progress value={75} className="h-2" />
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard title="Recent comments" description="Comments requiring review" action={
          <Button asChild variant="ghost" size="sm" className="gap-1">
            <Link to="/comments">
              View all <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        } padded={false}>
          <ul className="divide-y">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <li key={i} className="flex items-center gap-3 px-5 py-3">
                  <Shimmer className="size-8 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-1">
                    <Shimmer className="h-4 w-3/4" />
                    <Shimmer className="h-3 w-1/2" />
                  </div>
                </li>
              ))
            ) : (
              comments.slice(0, 4).map((comment: any) => (
                <li key={comment.id} className="flex items-center gap-3 px-5 py-3">
                  <Avatar className="size-8 shrink-0">
                    <AvatarImage src={comment.author?.avatar} />
                    <AvatarFallback>{comment.author?.name?.[0] || "?"}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{comment.content}</div>
                    <div className="text-xs text-muted-foreground">
                      {comment.author?.name} on {comment.articleId?.slice(0, 8)}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="gap-1">
                    <Ban className="size-3" />
                  </Button>
                </li>
              ))
            )}
          </ul>
        </SectionCard>

        <SectionCard title="Content pending review" description="New content submissions">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-warning" />
                <span className="text-sm font-medium">Articles</span>
              </div>
              <Badge variant="secondary">{articles.length}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="size-4 text-info" />
                <span className="text-sm font-medium">Highlights</span>
              </div>
              <Badge variant="secondary">{highlights.length}</Badge>
            </div>
            <div className="pt-2 space-y-2">
              <Button asChild variant="outline" className="w-full gap-2">
                <Link to="/articles">
                  <Eye className="size-4" /> Review Articles
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full gap-2">
                <Link to="/highlights">
                  <Eye className="size-4" /> Review Highlights
                </Link>
              </Button>
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Moderation tools" description="Quick access to moderation actions">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Button asChild variant="outline" className="h-14 flex-col gap-1">
            <Link to="/moderation">
              <Flag className="size-5" />
              <span className="text-xs">Reports</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-14 flex-col gap-1">
            <Link to="/comments">
              <MessageSquare className="size-5" />
              <span className="text-xs">Comments</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-14 flex-col gap-1">
            <Link to="/articles">
              <Eye className="size-5" />
              <span className="text-xs">Content</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-14 flex-col gap-1">
            <Link to="/users">
              <Shield className="size-5" />
              <span className="text-xs">Users</span>
            </Link>
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}
