import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Headphones,
  Ticket,
  Users,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  Minus,
  Inbox,
  Shield,
  Zap,
  BarChart3,
  ChevronRight,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { SectionCard } from "@/components/dashboard/section-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChartSkeleton } from "@/components/dashboard/skeletons";
import { PermissionGuard } from "@/components/dashboard/permission-guard";
import { getSupportDashboard, getAgentLeaderboard } from "@/lib/api/services";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

export const Route = createFileRoute("/_app/support/")({
  head: () => ({ meta: [{ title: "Support Dashboard · Vellum Admin" }] }),
  component: SupportDashboardPage,
});

/* ---------- Types ---------- */

interface StatusItem {
  status: string;
  _count: number;
}

interface PriorityItem {
  priority: string;
  _count: number;
}

interface AgentLeaderboardItem {
  userId: string;
  user: { name: string; avatar?: string | null };
  resolved: number;
  escalationRate: number;
}

interface DashboardSummary {
  openTickets: number;
  unassigned: number;
  inProgress: number;
  onlineAgents: number;
  resolved: number;
  escalated: number;
  closed: number;
}

interface DashboardData {
  summary: DashboardSummary;
  byStatus: StatusItem[];
  byPriority: PriorityItem[];
}

/* ---------- Constants ---------- */

const PRIORITY_COLORS: Record<string, string> = {
  EMERGENCY: "bg-red-500",
  CRITICAL: "bg-orange-500",
  HIGH: "bg-yellow-500",
  MEDIUM: "bg-blue-500",
  LOW: "bg-gray-500",
};

const PRIORITY_TEXT: Record<string, string> = {
  EMERGENCY: "text-red-400",
  CRITICAL: "text-orange-400",
  HIGH: "text-yellow-400",
  MEDIUM: "text-blue-400",
  LOW: "text-gray-400",
};

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-blue-500",
  ASSIGNED: "bg-purple-500",
  IN_PROGRESS: "bg-yellow-500",
  WAITING_ON_CUSTOMER: "bg-orange-500",
  WAITING_ON_INTERNAL: "bg-amber-500",
  ESCALATED: "bg-red-500",
  RESOLVED: "bg-green-500",
  CLOSED: "bg-gray-500",
  REOPENED: "bg-blue-400",
};

const STATUS_ORDER = [
  "NEW",
  "ASSIGNED",
  "IN_PROGRESS",
  "WAITING_ON_CUSTOMER",
  "WAITING_ON_INTERNAL",
  "ESCALATED",
  "RESOLVED",
  "CLOSED",
  "REOPENED",
];

/* ---------- Components ---------- */

function SupportDashboardPage() {
  const { data: dashboard, isLoading } = useQuery<DashboardData>({
    queryKey: ["support-dashboard"],
    queryFn: getSupportDashboard,
  });
  const { data: leaderboard, isLoading: isLeaderboardLoading } = useQuery<AgentLeaderboardItem[]>({
    queryKey: ["agent-leaderboard"],
    queryFn: async () => (await getAgentLeaderboard()) as AgentLeaderboardItem[],
  });

  const summary = dashboard?.summary;

  const totalTickets =
    (dashboard?.byStatus?.reduce((sum, s) => sum + s._count, 0) ?? 0) || 1;

  const sortedByStatus = useMemo(() => {
    if (!dashboard?.byStatus) return [];
    const map = new Map(dashboard.byStatus.map((s) => [s.status, s]));
    return STATUS_ORDER.map((status) => map.get(status)).filter(
      (s): s is StatusItem => !!s
    );
  }, [dashboard?.byStatus]);

  const sortedByPriority = useMemo(() => {
    if (!dashboard?.byPriority) return [];
    const order = ["EMERGENCY", "CRITICAL", "HIGH", "MEDIUM", "LOW"];
    const map = new Map(dashboard.byPriority.map((p) => [p.priority, p]));
    return order.map((p) => map.get(p)).filter((p): p is PriorityItem => !!p);
  }, [dashboard?.byPriority]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Support Center"
          description="Monitor tickets, agent performance, and SLA compliance"
        />
        <ChartSkeleton />
      </div>
    );
  }

  return (
    <PermissionGuard resource="support" action="read">
      <div className="space-y-6">
        {/* Header */}
        <PageHeader
          title="Support Center"
          description="Monitor tickets, agent performance, and SLA compliance"
          actions={
            <Button
              asChild
              className="gap-1.5 "
            >
              <Link to="/support/tickets">
                View All Tickets
                <ChevronRight className="size-4" />
              </Link>
            </Button>
          }
        />

        {/* Stats Row */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Open Tickets"
            value={summary?.openTickets ?? 0}
            icon={Inbox}
            delta="neutral"
          />
          <StatCard
            label="Unassigned"
            value={summary?.unassigned ?? 0}
            icon={AlertTriangle}
            delta={summary && summary.unassigned > 5 ? "up" : "neutral"}
          />
          <StatCard
            label="In Progress"
            value={summary?.inProgress ?? 0}
            icon={Clock}
            delta="neutral"
          />
          <StatCard
            label="Online Agents"
            value={summary?.onlineAgents ?? 0}
            icon={Users}
            delta="neutral"

          />
        </div>

        {/* Distribution Charts */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* By Status */}
          <SectionCard
            title="Tickets by Status"
            description="Current ticket distribution"
            className=" "
          >
            <div className="space-y-4">
              {sortedByStatus.length === 0 ? (
                <p className="text-sm  text-center py-6">
                  No ticket data available
                </p>
              ) : (
                sortedByStatus.map((item) => {
                  const pct = Math.round((item._count / totalTickets) * 100);
                  return (
                    <div key={item.status} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 ">
                          <span
                            className={cn(
                              "size-2 rounded-full",
                              STATUS_COLORS[item.status] ?? "bg-gray-500"
                            )}
                          />
                          {item.status.replace(/_/g, " ")}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold ">
                            {item._count}
                          </span>
                          <span className="text-xs w-8 text-right">
                            {pct}%
                          </span>
                        </div>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full ">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            STATUS_COLORS[item.status] ?? "bg-gray-500"
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </SectionCard>

          {/* By Priority */}
          <SectionCard
            title="Tickets by Priority"
            description="Open tickets by priority level"
            className=" "
          >
            <div className="space-y-4">
              {sortedByPriority.length === 0 ? (
                <p className="text-sm  text-center py-6">
                  No priority data available
                </p>
              ) : (
                sortedByPriority.map((item) => {
                  const pct = Math.round((item._count / totalTickets) * 100);
                  return (
                    <div key={item.priority} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 ">
                          <span
                            className={cn(
                              "size-2 rounded-full",
                              PRIORITY_COLORS[item.priority] ?? "bg-gray-500"
                            )}
                          />
                          <span
                            className={cn(
                              "uppercase text-xs font-semibold tracking-wider",
                              PRIORITY_TEXT[item.priority] ?? "text-gray-400"
                            )}
                          >
                            {item.priority}
                          </span>
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold ">
                            {item._count}
                          </span>
                          <span className="text-xs  w-8 text-right">
                            {pct}%
                          </span>
                        </div>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full ">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            PRIORITY_COLORS[item.priority] ?? "bg-gray-500"
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </SectionCard>
        </div>

        {/* Quick Actions + Leaderboard */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Quick Actions */}
          <SectionCard
            title="Quick Actions"
            className="  lg:col-span-1"
          >
            <div className="flex flex-col gap-2">
              <QuickActionLink
                to="/support/tickets"
                search={{ status: "NEW" }}
                icon={Ticket}
                label="New Tickets"
                count={dashboard?.byStatus?.find((s) => s.status === "NEW")?._count}
                color="text-blue-400"
              />
              <QuickActionLink
                to="/support/tickets"
                search={{ unassigned: "true" }}
                icon={AlertTriangle}
                label="Unassigned Queue"
                count={summary?.unassigned}
                color="text-orange-400"
              />
              <QuickActionLink
                to="/support/tickets"
                search={{ status: "ESCALATED" }}
                icon={Zap}
                label="Escalated"
                count={
                  dashboard?.byStatus?.find((s) => s.status === "ESCALATED")
                    ?._count
                }
                color="text-red-400"
              />
              <QuickActionLink
                to="/support/kb"
                icon={Headphones}
                label="Knowledge Base"
                color="text-purple-400"
              />
            </div>
          </SectionCard>

          {/* Agent Leaderboard */}
          <SectionCard
            title="Agent Leaderboard"
            description="Top performers by resolved tickets"
            className="  lg:col-span-2"
          >
            <div className="space-y-3">
              {isLeaderboardLoading ? (
                <div className="py-6 text-center text-sm ">
                  Loading leaderboard...
                </div>
              ) : !leaderboard || (leaderboard as AgentLeaderboardItem[]).length === 0 ? (
                <div className="flex flex-col items-center py-8 text-center">
                  <Users className="size-10  mb-3" />
                  <p className="text-sm ">No agent data yet</p>
                  <p className="text-xs  mt-1">
                    Agent performance metrics will appear here
                  </p>
                </div>
              ) : (
                (leaderboard as AgentLeaderboardItem[]).slice(0, 5).map((agent, i) => {
                  const maxResolved = Math.max(
                    ...(leaderboard as AgentLeaderboardItem[]).map((a) => a.resolved),
                    1
                  );
                  const progress = (agent.resolved / maxResolved) * 100;
                  return (
                    <div
                      key={agent.userId}
                      className="flex items-center gap-4 rounded-lg border   p-3 transition-colors "
                    >
                      <span
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                          i === 0
                            ? "bg-yellow-500/20 text-yellow-400"
                            : i === 1
                            ? "bg-gray-400/20 text-gray-300"
                            : i === 2
                            ? "bg-orange-600/20 text-orange-400"
                            : ""
                        )}
                      >
                        {i + 1}
                      </span>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-medium text-sm  truncate">
                            {agent.user.name}
                          </p>
                          <div className="flex items-center gap-3 text-right">
                            <span className="text-sm font-semibold ">
                              {agent.resolved}
                            </span>
                            <span className="text-xs ">
                              resolved
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full ">
                            <div
                              className="h-full rounded-full bg-emerald-500 transition-all"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span
                            className={cn(
                              "text-xs font-medium shrink-0",
                              agent.escalationRate > 20
                                ? "text-red-400"
                                : agent.escalationRate > 10
                                ? "text-yellow-400"
                                : "text-emerald-400"
                            )}
                          >
                            {agent.escalationRate.toFixed(1)}% esc.
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </SectionCard>
        </div>

        {/* Bottom Stats */}
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Resolved"
            value={summary?.resolved ?? 0}
            icon={CheckCircle2}
            delta="up"
            
          />
          <StatCard
            label="Escalated"
            value={summary?.escalated ?? 0}
            icon={ArrowUpRight}
            delta={summary && summary.escalated > 0 ? "up" : "neutral"}
            
          />
          <StatCard
            label="Closed"
            value={summary?.closed ?? 0}
            icon={Shield}
            delta="neutral"
            
          />
        </div>
      </div>
    </PermissionGuard>
  );
}

/* ---------- Subcomponents ---------- */

function QuickActionLink({
  to,
  search,
  icon: Icon,
  label,
  count,
  color,
}: {
  to: string;
  search?: Record<string, string>;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count?: number;
  color: string;
}) {
  return (
    <Button
      variant="outline"
      asChild
      className="justify-between  bg-transparent  h-11"
    >
      <Link to={to} search={search}>
        <span className="flex items-center gap-2.5">
          <Icon className={cn("size-4", color)} />
          <span className="">{label}</span>
        </span>
        {count !== undefined && count > 0 && (
          <Badge
            variant="secondary"
            className=" border-none"
          >
            {count}
          </Badge>
        )}
        <ChevronRight className="size-4  ml-auto" />
      </Link>
    </Button>
  );
}

/* ---------- Export ---------- */

export default SupportDashboardPage;