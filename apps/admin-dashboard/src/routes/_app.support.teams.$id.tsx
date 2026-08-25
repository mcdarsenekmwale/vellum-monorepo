import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import {
  Users2,
  Building2,
  UserPlus,
  UserMinus,
  Crown,
  Ticket,
  ChevronRight,
  ArrowLeft,
  MoreVertical,
  Eye,
  Search,
  X,
  Loader2,
  AlertCircle,
  RefreshCw,
  Target,
  ShieldCheck,
  Mail,
  Clock,
  CheckCircle2,
  TrendingUp,
  Check,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { SectionCard } from "@/components/dashboard/section-card";
import { ChartSkeleton } from "@/components/dashboard/skeletons";
import {
  PermissionGuard,
  PermissionGate,
} from "@/components/dashboard/permission-guard";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { avatarUrl } from "@/lib/avatar";
import {
  useSupportTeam,
  useSupportTeams,
  useSupportTicketsV2,
  useSupportTeamMetrics,
  useSupportTeamKpis,
  useSupportAgents,
  useAddAgentToTeam,
  useRemoveAgentFromTeam,
  useSetPrimaryTeam,
  type SupportTeam,
  type SupportAgentTeamMembership,
  type SupportTicket,
  type SupportOrgMetrics,
  type SupportTeamKpis,
} from "@/lib/api/hooks";
import type { SupportAgent } from "@/lib/api/services";
import {
  agentLoadPct,
  normalizeAgentStatus,
} from "@/lib/support/support-agent.logic";

export const Route = createFileRoute("/_app/support/teams/$id")({
  head: () => ({ meta: [{ title: "Team · Vellbase Admin" }] }),
  component: TeamDetailPage,
  notFoundComponent: () => (
    <div className="p-10 text-center text-sm text-muted-foreground">
      Team not found.
    </div>
  ),
});

/* ─── Reusable constants/configs ─── */

const AGENT_STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; dot: string }
> = {
  ONLINE: {
    label: "Online",
    color: "text-green-600",
    bg: "bg-green-100 dark:bg-green-950/40",
    dot: "bg-green-500",
  },
  BUSY: {
    label: "Busy",
    color: "text-yellow-600",
    bg: "bg-yellow-100 dark:bg-yellow-950/40",
    dot: "bg-yellow-500",
  },
  AWAY: {
    label: "Away",
    color: "text-orange-600",
    bg: "bg-orange-100 dark:bg-orange-950/40",
    dot: "bg-orange-500",
  },
  OFFLINE: {
    label: "Offline",
    color: "text-gray-500",
    bg: "bg-gray-100 dark:bg-gray-800/40",
    dot: "bg-gray-400",
  },
};

const TICKET_STATUS_CONFIG: Record<string, { label: string; variant: any }> = {
  NEW: { label: "New", variant: "default" },
  ASSIGNED: { label: "Assigned", variant: "secondary" },
  IN_PROGRESS: { label: "In Progress", variant: "secondary" },
  WAITING_ON_CUSTOMER: { label: "Waiting", variant: "outline" },
  WAITING_ON_INTERNAL: { label: "Internal", variant: "outline" },
  ESCALATED: { label: "Escalated", variant: "destructive" },
  RESOLVED: { label: "Resolved", variant: "default" },
  CLOSED: { label: "Closed", variant: "secondary" },
  REOPENED: { label: "Reopened", variant: "destructive" },
};

const PRIORITY_CONFIG: Record<string, { label: string; variant: any }> = {
  LOW: { label: "Low", variant: "outline" },
  MEDIUM: { label: "Medium", variant: "secondary" },
  HIGH: { label: "High", variant: "default" },
  CRITICAL: { label: "Critical", variant: "destructive" },
  EMERGENCY: { label: "Emergency", variant: "destructive" },
};

/* ─── Helpers ─── */

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function AgentStatusBadge({ status }: { status: string }) {
  const cfg = AGENT_STATUS_CONFIG[status] ?? AGENT_STATUS_CONFIG.OFFLINE;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        cfg.bg,
        cfg.color,
      )}
    >
      <span className={cn("size-1.5 rounded-full", cfg.dot)} />
      {cfg.label}
    </span>
  );
}

function TicketStatusBadge({ status }: { status: string }) {
  const cfg = TICKET_STATUS_CONFIG[status] ?? {
    label: status,
    variant: "outline" as const,
  };
  return (
    <Badge variant={cfg.variant} className="text-[10px]">
      {cfg.label}
    </Badge>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const cfg = PRIORITY_CONFIG[priority] ?? {
    label: priority,
    variant: "outline" as const,
  };
  return (
    <Badge variant={cfg.variant} className="text-[10px]">
      {cfg.label}
    </Badge>
  );
}

/* ─── Add Member Dialog (search + pick) ─── */

function AddMemberDialog({
  team,
  open,
  onOpenChange,
}: {
  team: SupportTeam | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const addMut = useAddAgentToTeam();

  const memberIds = useMemo(() => {
    const ids = new Set<string>();
    (team?.memberships ?? []).forEach((m) => ids.add(m.agentId));
    return ids;
  }, [team]);

  const { data } = useSupportAgents({
    departmentId: team?.departmentId,
    limit: 100,
    isActive: true,
  });
  const allAgents = data?.data ?? [];

  const candidates = useMemo(() => {
    const base = allAgents.filter((a) => !memberIds.has(a.userId));
    if (!query.trim()) return base;
    const q = query.toLowerCase();
    return base.filter(
      (a) =>
        a.user?.name?.toLowerCase().includes(q) ||
        a.user?.email?.toLowerCase().includes(q),
    );
  }, [allAgents, memberIds, query]);

  const handleAdd = (agent: SupportAgent, asPrimary: boolean) => {
    if (!team) return;
    addMut.mutate(
      {
        agentId: agent.userId,
        teamId: team.id,
        data: { isPrimary: asPrimary },
      },
      {
        onSuccess: () => {
          toast.success(`${agent.user?.name ?? "Agent"} added to team`);
          setQuery("");
        },
        onError: (e: any) =>
          toast.error(e?.message ?? "Failed to add agent to team"),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden flex flex-col">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="size-5 text-primary" />
            Add Team Member
          </DialogTitle>
          <DialogDescription>
            Search support agents to add to <strong>{team?.name ?? "this team"}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pt-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search agents by name or email..."
              className="pl-9"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:bg-muted"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="max-h-[360px] overflow-y-auto px-6 py-3 space-y-1.5">
          {candidates.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center">
              <Users2 className="size-10 text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">
                {allAgents.length === 0
                  ? "No agents available in this department."
                  : query
                  ? "No agents match your search."
                  : "All eligible agents are already in this team."}
              </p>
            </div>
          ) : (
            candidates.map((a) => (
              <div
                key={a.userId}
                className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/40 transition-colors"
              >
                <Avatar className="size-9 shrink-0">
                  <AvatarImage src={avatarUrl(a.user?.name ?? a.userId)} />
                  <AvatarFallback className="text-xs">
                    {getInitials(a.user?.name ?? "?")}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm truncate">
                    {a.user?.name ?? "Unknown"}
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {a.user?.email ?? "—"}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        disabled={addMut.isPending}
                        onClick={() => handleAdd(a, false)}
                        className="size-8"
                        title="Add to team"
                      >
                        <UserPlus className="size-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Add as member</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        disabled={addMut.isPending}
                        onClick={() => handleAdd(a, true)}
                        className="size-8"
                      >
                        <Crown className="size-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Add as primary team</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            ))
          )}
        </div>

        <DialogFooter className="border-t px-6 py-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Page Component ─── */

function TeamDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();

  const {
    data: team,
    isLoading: teamLoading,
    isError: teamError,
    error: teamErr,
    refetch: refetchTeam,
  } = useSupportTeam(id);

  const { data: metrics, isLoading: metricsLoading } = useSupportTeamMetrics(id);
  const { data: kpis, isLoading: kpisLoading } = useSupportTeamKpis(id);
  const { data: ticketsData, isLoading: ticketsLoading } = useSupportTicketsV2({
    teamId: id,
    limit: 20,
  });

  const { data: allAgentsData } = useSupportAgents({
    departmentId: team?.departmentId,
    limit: 100,
  });
  const allAgents = allAgentsData?.data ?? [];

  /* ─── State ─── */
  const [tab, setTab] = useState("overview");
  const [addOpen, setAddOpen] = useState(false);
  const [ticketSearch, setTicketSearch] = useState("");
  const [memberSearch, setMemberSearch] = useState("");

  const orgMetrics = metrics as SupportOrgMetrics | undefined;
  const teamKpis = kpis as SupportTeamKpis | undefined;

  /* ─── Derived members ─── */
  const memberships = useMemo(() => {
    const fromTeam = team?.memberships ?? [];
    if (fromTeam.length > 0) return fromTeam;
    return [] as SupportAgentTeamMembership[];
  }, [team]);

  const filteredMembers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return memberships;
    return memberships.filter((m) => {
      const n = m.agent?.user?.name ?? "";
      const e = m.agent?.user?.email ?? "";
      return n.toLowerCase().includes(q) || e.toLowerCase().includes(q);
    });
  }, [memberships, memberSearch]);

  const allTickets = ticketsData?.data ?? [];
  const filteredTickets = useMemo(() => {
    const q = ticketSearch.trim().toLowerCase();
    if (!q) return allTickets;
    return allTickets.filter(
      (t) =>
        t.subject.toLowerCase().includes(q) ||
        t.ticketNumber.toLowerCase().includes(q) ||
        t.user?.name?.toLowerCase().includes(q),
    );
  }, [allTickets, ticketSearch]);

  /* ─── Mutations for members ─── */
  const removeMut = useRemoveAgentFromTeam();
  const primaryMut = useSetPrimaryTeam();

  const handleRemove = (membership: SupportAgentTeamMembership) => {
    if (!team) return;
    const name = membership.agent?.user?.name ?? "Agent";
    removeMut.mutate(
      { agentId: membership.agentId, teamId: team.id },
      {
        onSuccess: () => toast.success(`${name} removed from team`),
        onError: (e: any) =>
          toast.error(e?.message ?? "Failed to remove member"),
      },
    );
  };

  const handleMakePrimary = (membership: SupportAgentTeamMembership) => {
    if (!team) return;
    const name = membership.agent?.user?.name ?? "Agent";
    primaryMut.mutate(
      { agentId: membership.agentId, teamId: team.id },
      {
        onSuccess: () => toast.success(`${name} set to primary for this team`),
        onError: (e: any) =>
          toast.error(e?.message ?? "Failed to set primary team"),
      },
    );
  };

  /* ─── Loading / Error ─── */
  if (teamLoading) {
    return (
      <div className="space-y-6">
        <BreadcrumbNav teamName="…" deptName="…" deptId={undefined} />
        <ChartSkeleton height={300} />
      </div>
    );
  }

  if (teamError || !team) {
    return (
      <div className="space-y-6">
        <BreadcrumbNav teamName="Error" deptName="…" deptId={undefined} />
        <SectionCard>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <AlertCircle className="size-12 text-destructive mb-4" />
            <h3 className="text-lg font-semibold mb-2">Failed to load team</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-md">
              {teamErr instanceof Error
                ? teamErr.message
                : "This team may have been removed or you do not have access."}
            </p>
            <div className="flex gap-2">
              <Button asChild variant="ghost" size="sm">
                <Link to="/support">
                  <ArrowLeft className="size-4 mr-2" /> Back to Support
                </Link>
              </Button>
              <Button variant="outline" onClick={() => refetchTeam()}>
                <RefreshCw className="size-4 mr-2" /> Retry
              </Button>
            </div>
          </div>
        </SectionCard>
      </div>
    );
  }

  /* ─── Render ─── */
  return (
    <PermissionGuard resource="support" action="read">
      <div className="space-y-6">
        <BreadcrumbNav
          teamName={team.name}
          deptName={team.department?.name}
          deptId={team.departmentId}
        />

        <PageHeader
          eyebrow="Team"
          title={team.name}
          description={
            team.description ??
            `Belongs to ${team.department?.name ?? "support"} · ${team.id.slice(0, 8)}`
          }
          actions={
            <div className="flex items-center gap-2">
              <Button asChild variant="ghost" size="sm">
                <Link to="/support/teams">
                  <ArrowLeft className="size-4 mr-2" /> Back to Teams
                </Link>
              </Button>
              {team.departmentId && (
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="gap-1.5 hidden sm:inline-flex"
                >
                  <Link
                    to="/support/departments/$id"
                    params={{ id: team.departmentId }}
                  >
                    <Building2 className="size-3.5" />{" "}
                    {team.department?.name ?? "Department"}
                  </Link>
                </Button>
              )}
            </div>
          }
        />

        <Tabs value={tab} onValueChange={setTab} className="space-y-6">
          <TabsList className="bg-muted/40 h-10 p-1 gap-1">
            <TabsTrigger
              value="overview"
              className="h-8 data-[state=active]:bg-background rounded-md gap-2"
            >
              <Target className="size-3.5" /> Overview
            </TabsTrigger>
            <TabsTrigger
              value="members"
              className="h-8 data-[state=active]:bg-background rounded-md gap-2"
            >
              <Users2 className="size-3.5" /> Members
              {memberships.length > 0 && (
                <Badge variant="outline" className="text-[10px] h-5">
                  {memberships.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="tickets"
              className="h-8 data-[state=active]:bg-background rounded-md gap-2"
            >
              <Ticket className="size-3.5" /> Tickets
              {(ticketsData?.total ?? 0) > 0 && (
                <Badge variant="outline" className="text-[10px] h-5">
                  {ticketsData?.total ?? 0}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ─── OVERVIEW TAB ─── */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Members"
                value={memberships.length}
                icon={Users2}
                delta="neutral"
              />
              <StatCard
                label="Open Tickets"
                value={teamKpis?.volume?.backlog ?? orgMetrics?.tickets?.backlog ?? 0}
                icon={Ticket}
                delta="neutral"
              />
              <StatCard
                label="Resolved"
                value={teamKpis?.volume?.resolved ?? 0}
                icon={CheckCircle2}
                delta="up"
              />
              <StatCard
                label="Escalated"
                value={teamKpis?.volume?.escalated ?? orgMetrics?.tickets?.escalated ?? 0}
                icon={TrendingUp}
                delta={(teamKpis?.volume?.escalated ?? 0) > 0 ? "up" : "neutral"}
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <SectionCard
                title="Team Info"
                description="Department, lead, status, creation"
              >
                <dl className="grid gap-3 text-sm">
                  <InfoRow label="Department">
                    {team.department ? (
                      <Badge variant="secondary" className="gap-1.5">
                        <Building2 className="size-2.5" />
                        {team.department.name}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </InfoRow>
                  <InfoRow label="Lead">
                    {team.lead ? (
                      <div className="flex items-center gap-2">
                        <Avatar className="size-6">
                          <AvatarImage src={avatarUrl(team.lead.name)} />
                          <AvatarFallback className="text-[10px]">
                            {getInitials(team.lead.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{team.lead.name}</span>
                        <Badge variant="outline" className="text-[10px]">
                          <Crown className="size-2.5 mr-1" /> Lead
                        </Badge>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Unassigned</span>
                    )}
                  </InfoRow>
                  <InfoRow label="Status">
                    {team.isActive ? (
                      <Badge className="bg-green-500/10 text-green-600 border-0">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </InfoRow>
                  <InfoRow label="Created">
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {format(new Date(team.createdAt), "MMM d, yyyy")} ·{" "}
                      {formatDistanceToNow(new Date(team.createdAt), {
                        addSuffix: true,
                      })}
                    </span>
                  </InfoRow>
                  {team.skillSpecialization && (
                    <InfoRow label="Specialization">
                      <Badge variant="outline">
                        {team.skillSpecialization}
                      </Badge>
                    </InfoRow>
                  )}
                </dl>
              </SectionCard>

              <SectionCard
                title="SLA & Capacity"
                description="Service targets and per-agent limits"
              >
                <dl className="grid gap-3 text-sm">
                  <InfoRow label="SLA Policy">
                    {team.slaInheritFromDept ? (
                      <Badge variant="secondary" className="gap-1.5">
                        <ShieldCheck className="size-2.5" /> Inherits from dept
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1.5">
                        <Target className="size-2.5" /> Custom
                      </Badge>
                    )}
                  </InfoRow>
                  <InfoRow label="First Response">
                    <span className="tabular-nums">
                      {team.firstResponseSlaMinutes != null
                        ? `${team.firstResponseSlaMinutes}m`
                        : "Inherited"}
                    </span>
                  </InfoRow>
                  <InfoRow label="Resolution">
                    <span className="tabular-nums">
                      {team.resolutionSlaMinutes != null
                        ? `${team.resolutionSlaMinutes}m`
                        : "Inherited"}
                    </span>
                  </InfoRow>
                  <InfoRow label="Max / Agent">
                    <span className="tabular-nums text-sm">
                      {team.maxTicketsPerAgent} concurrent
                      {team.concurrentTicketLimitPerAgent &&
                      team.concurrentTicketLimitPerAgent !==
                        team.maxTicketsPerAgent
                        ? ` · hard cap ${team.concurrentTicketLimitPerAgent}`
                        : ""}
                    </span>
                  </InfoRow>
                  {teamKpis ? (
                    <InfoRow label="SLA Adherence">
                      <div className="space-y-1 w-full max-w-xs">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Response</span>
                          <span className="font-medium tabular-nums">
                            {teamKpis?.sla?.responseAdherencePct?.toFixed(1) ??
                              "—"}%
                          </span>
                        </div>
                        <Progress
                          value={teamKpis?.sla?.responseAdherencePct ?? 0}
                          className="h-1.5"
                        />
                        <div className="flex items-center justify-between text-xs pt-1">
                          <span className="text-muted-foreground">Resolution</span>
                          <span className="font-medium tabular-nums">
                            {teamKpis?.sla?.resolutionAdherencePct?.toFixed(1) ??
                              "—"}%
                          </span>
                        </div>
                        <Progress
                          value={teamKpis?.sla?.resolutionAdherencePct ?? 0}
                          className="h-1.5"
                        />
                      </div>
                    </InfoRow>
                  ) : null}
                </dl>
              </SectionCard>
            </div>

            {/* Performance / KPIs */}
            <SectionCard
              title="Team Performance"
              description={
                teamKpis
                  ? `Window: last ${teamKpis.windowDays} days · generated ${formatDistanceToNow(new Date(teamKpis.generatedAt), { addSuffix: true })}`
                  : "Aggregate KPIs for this team"
              }
            >
              {kpisLoading || !teamKpis ? (
                metricsLoading ? (
                  <ChartSkeleton />
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <MiniMetric
                      label="Total Tickets"
                      value={orgMetrics?.tickets?.total ?? "—"}
                    />
                    <MiniMetric
                      label="New (24h)"
                      value={orgMetrics?.tickets?.new24h ?? "—"}
                    />
                    <MiniMetric
                      label="Avg Daily (7d)"
                      value={orgMetrics?.tickets?.avgDaily7d?.toFixed(1) ?? "—"}
                    />
                    <MiniMetric
                      label="Avg Daily (30d)"
                      value={orgMetrics?.tickets?.avgDaily30d?.toFixed(1) ?? "—"}
                    />
                  </div>
                )
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <MiniMetric
                      label="Total Volume"
                      value={teamKpis?.volume?.total}
                    />
                    <MiniMetric
                      label="New This Window"
                      value={teamKpis?.volume?.new}
                    />
                    <MiniMetric
                      label="Avg Interactions"
                      value={teamKpis?.volume?.avgInteractionsPerTicket?.toFixed(
                        1,
                      ) ?? "—"}
                    />
                    <MiniMetric
                      label="CSAT"
                      value={
                        teamKpis?.satisfaction?.csatAvg != null
                          ? `${teamKpis?.satisfaction?.csatAvg.toFixed(2)} / 5`
                          : "—"
                      }
                      tone={
                        (teamKpis?.satisfaction?.csatAvg ?? 0) >= 4.2
                          ? "success"
                          : (teamKpis?.satisfaction?.csatAvg ?? 0) >= 3.5
                          ? "primary"
                          : "warning"
                      }
                    />
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="rounded-lg border p-4 space-y-3">
                      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Efficiency
                      </div>
                      <div className="space-y-2">
                        <MetricBar
                          label="FCR (First Contact)"
                          valuePct={teamKpis?.efficiency?.fcrRatePct ?? 0}
                          tone="success"
                        />
                        <MetricBar
                          label="Reopen Rate"
                          valuePct={teamKpis?.efficiency?.reopenRatePct ?? 0}
                          tone={
                            (teamKpis?.efficiency?.reopenRatePct ?? 0) > 15 
                              ? "warning"
                              : "primary"
                          }
                        />
                        <MetricBar
                          label="Backlog : Resolved"
                          valuePct={
                            Math.min(
                              100,
                              (teamKpis.backlogToResolvedRatio ?? 0) * 100,
                            ) || 0
                          }
                        />
                      </div>
                    </div>
                    <div className="rounded-lg border p-4 space-y-3">
                      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        SLA Breaches
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <MiniMetric
                          label="Response Breaches"
                          value={teamKpis?.sla?.breachResponseCount}
                          tone={
                            teamKpis?.sla?.breachResponseCount > 5
                              ? "warning"
                              : "primary"
                          }
                        />
                        <MiniMetric
                          label="Resolution Breaches"
                          value={teamKpis?.sla?.breachResolutionCount}
                          tone={
                            teamKpis?.sla?.breachResolutionCount > 5
                              ? "warning"
                              : "primary"
                          }
                        />
                      </div>
                      {teamKpis?.satisfaction?.csatSampleSize > 0 && (
                        <div className="pt-2 border-t text-xs text-muted-foreground">
                          CSAT sample:{" "}
                          <span className="font-medium text-foreground tabular-nums">
                            {teamKpis?.satisfaction?.csatSampleSize}
                          </span>{" "}
                          survey responses
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </SectionCard>
          </TabsContent>

          {/* ─── MEMBERS TAB ─── */}
          <TabsContent value="members" className="space-y-6">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="relative flex-1 max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  placeholder="Search team members..."
                  className="pl-9"
                />
                {memberSearch && (
                  <button
                    onClick={() => setMemberSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:bg-muted"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
              <PermissionGate resource="support" action="moderate">
                <Button
                  onClick={() => setAddOpen(true)}
                  size="sm"
                  className="gap-1.5"
                >
                  <UserPlus className="size-3.5" /> Add Member
                </Button>
              </PermissionGate>
            </div>

            <SectionCard padded={false}>
              <div className="divide-y">
                {metricsLoading === false &&
                !teamLoading &&
                filteredMembers.length === 0 ? (
                  <div className="px-6 py-16 text-center">
                    <Users2 className="size-10 mx-auto text-muted-foreground/30 mb-2" />
                    <p className="text-sm text-muted-foreground mb-4">
                      {memberSearch
                        ? "No members match your search."
                        : "No members on this team yet."}
                    </p>
                    <PermissionGate resource="support" action="moderate">
                      <Button
                        size="sm"
                        onClick={() => setAddOpen(true)}
                        className="gap-1.5"
                      >
                        <UserPlus className="size-3.5" /> Add First Member
                      </Button>
                    </PermissionGate>
                  </div>
                ) : teamLoading && memberships.length === 0 ? (
                  <div className="px-6 py-10 text-center text-xs text-muted-foreground">
                    <Loader2 className="size-4 animate-spin mx-auto mb-2" />
                    Loading members...
                  </div>
                ) : (
                  filteredMembers.map((m) => (
                    <MemberRow
                      key={m.id}
                      membership={m}
                      isPending={
                        (primaryMut.variables?.agentId === m.agentId &&
                          primaryMut.isPending) ||
                        (removeMut.variables?.agentId === m.agentId &&
                          removeMut.isPending)
                      }
                      onMakePrimary={() => handleMakePrimary(m)}
                      onRemove={() => handleRemove(m)}
                    />
                  ))
                )}
              </div>
            </SectionCard>
          </TabsContent>

          {/* ─── TICKETS TAB ─── */}
          <TabsContent value="tickets" className="space-y-6">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="relative flex-1 max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={ticketSearch}
                  onChange={(e) => setTicketSearch(e.target.value)}
                  placeholder="Search tickets by #, subject, customer..."
                  className="pl-9"
                />
                {ticketSearch && (
                  <button
                    onClick={() => setTicketSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:bg-muted"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link to="/support/tickets" search={{ teamId: id }}>
                  View all <ChevronRight className="size-4 ml-1" />
                </Link>
              </Button>
            </div>

            <SectionCard padded={false}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="px-6 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground w-[120px]">
                        Ticket
                      </th>
                      <th className="px-6 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Subject
                      </th>
                      <th className="px-6 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">
                        Customer
                      </th>
                      <th className="px-6 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">
                        Assignee
                      </th>
                      <th className="px-6 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground w-[110px]">
                        Status
                      </th>
                      <th className="px-6 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground w-[95px]">
                        Priority
                      </th>
                      <th className="px-6 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden lg:table-cell w-[150px]">
                        Updated
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {ticketsLoading ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-10 text-center text-xs text-muted-foreground">
                          <Loader2 className="size-4 animate-spin mx-auto mb-2" />
                          Loading tickets...
                        </td>
                      </tr>
                    ) : filteredTickets.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-16 text-center">
                          <Ticket className="size-10 mx-auto text-muted-foreground/30 mb-2" />
                          <p className="text-sm text-muted-foreground">
                            {ticketSearch
                              ? "No tickets match your search."
                              : "No tickets assigned to this team yet."}
                          </p>
                        </td>
                      </tr>
                    ) : (
                      filteredTickets.map((t) => (
                        <TeamTicketRow key={t.id} ticket={t} />
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </TabsContent>
        </Tabs>

        <AddMemberDialog
          team={team}
          open={addOpen}
          onOpenChange={(v) => {
            setAddOpen(v);
            if (!v) setMemberSearch("");
          }}
        />
      </div>
    </PermissionGuard>
  );
}

/* ─── Subcomponents ─── */

function BreadcrumbNav({
  teamName,
  deptName,
  deptId,
}: {
  teamName: string;
  deptName?: string | null;
  deptId?: string | null;
}) {
  return (
    <Breadcrumb className="mb-1">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link to="/support">Support</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        {deptId ? (
          <>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/support/departments/$id" params={{ id: deptId }}>
                  {deptName ?? "Department"}
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
          </>
        ) : null}
        <BreadcrumbItem>
          <BreadcrumbPage>{teamName}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}

function InfoRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[140px_1fr] items-start gap-3 py-1">
      <dt className="text-xs text-muted-foreground pt-0.5 uppercase tracking-wider">
        {label}
      </dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

function MiniMetric({
  label,
  value,
  tone = "primary",
}: {
  label: string;
  value: number | string;
  tone?: "primary" | "warning" | "success";
}) {
  const toneCls =
    tone === "warning"
      ? "text-amber-600 dark:text-amber-400"
      : tone === "success"
      ? "text-emerald-600 dark:text-emerald-400"
      : "";
  return (
    <div className="rounded-lg border p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className={cn("text-lg font-semibold tabular-nums mt-0.5", toneCls)}>
        {value}
      </div>
    </div>
  );
}

function MetricBar({
  label,
  valuePct,
  tone = "primary",
}: {
  label: string;
  valuePct: number;
  tone?: "primary" | "success" | "warning" | "destructive";
}) {
  const colorClass: Record<string, string> = {
    primary: "[&>div]:bg-primary",
    success: "[&>div]:bg-green-500",
    warning: "[&>div]:bg-yellow-500",
    destructive: "[&>div]:bg-destructive",
  };
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">{valuePct.toFixed(1)}%</span>
      </div>
      <Progress
        value={Math.min(100, Math.max(0, valuePct))}
        className={cn("h-2", colorClass[tone])}
      />
    </div>
  );
}

function MemberRow({
  membership,
  isPending,
  onMakePrimary,
  onRemove,
}: {
  membership: SupportAgentTeamMembership;
  isPending: boolean;
  onMakePrimary: () => void;
  onRemove: () => void;
}) {
  const agent = membership.agent as SupportAgent | undefined;
  const name = agent?.user?.name ?? membership.agentId;
  const email = agent?.user?.email ?? "";
  const status = agent
    ? normalizeAgentStatus({ status: agent.status, isActive: agent.isActive })
    : "OFFLINE";
  const load = agent
    ? agentLoadPct({
        activeTickets: agent.activeTickets,
        maxTickets: agent.maxTickets,
      })
    : 0;

  return (
    <div className="group px-6 py-3 flex items-center gap-4 hover:bg-muted/30 transition-colors">
      <Avatar className="size-10 shrink-0">
        <AvatarImage src={avatarUrl(name)} />
        <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
          {getInitials(name)}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm truncate">{name}</span>
          {membership.isPrimary && (
            <Badge className="text-[10px] gap-1 bg-amber-500/10 text-amber-600 border-0">
              <Crown className="size-2.5" /> Primary
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap mt-0.5">
          {email && (
            <span className="inline-flex items-center gap-1 truncate max-w-[240px]">
              <Mail className="size-2.5 shrink-0" />
              <span className="truncate">{email}</span>
            </span>
          )}
          <span className="tabular-nums">
            Joined {format(new Date(membership.startDate), "MMM d, yyyy")}
          </span>
        </div>
      </div>

      <div className="hidden md:flex items-center gap-3 shrink-0">
        <AgentStatusBadge status={status} />
        {agent && (
          <div className="flex items-center gap-2 text-xs tabular-nums">
            <span className="font-medium">{agent.activeTickets ?? 0}</span>
            <span className="text-muted-foreground">/</span>
            <span className="text-muted-foreground">{agent.maxTickets ?? 0}</span>
            <div className="w-14">
              <Progress value={load} className="h-1.5" />
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {!membership.isPrimary && agent && (
          <PermissionGate resource="support" action="moderate">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={onMakePrimary}
                  disabled={isPending}
                >
                  {isPending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Crown className="size-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Set as primary team</TooltipContent>
            </Tooltip>
          </PermissionGate>
        )}
        <PermissionGate resource="support" action="moderate">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-destructive hover:text-destructive"
                onClick={onRemove}
                disabled={isPending}
              >
                <UserMinus className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Remove from team</TooltipContent>
          </Tooltip>
        </PermissionGate>
      </div>
    </div>
  );
}

function TeamTicketRow({ ticket }: { ticket: SupportTicket }) {
  const navigate = useNavigate();
  return (
    <tr
      className="hover:bg-muted/30 cursor-pointer transition-colors"
      onClick={() =>
        navigate({
          to: "/support/tickets/$ticketId",
          params: { ticketId: ticket.id },
        })
      }
    >
      <td className="px-6 py-2.5 font-mono text-xs text-muted-foreground whitespace-nowrap">
        {ticket.ticketNumber}
      </td>
      <td className="px-6 py-2.5">
        <div className="font-medium line-clamp-1">{ticket.subject}</div>
        {ticket.category?.name && (
          <div className="text-[10px] text-muted-foreground">
            {ticket.category.name}
          </div>
        )}
      </td>
      <td className="px-6 py-2.5 hidden md:table-cell">
        <div className="flex items-center gap-2">
          <Avatar className="size-6">
            <AvatarImage src={avatarUrl(ticket.user?.name ?? "")} />
            <AvatarFallback className="text-[10px]">
              {getInitials(ticket.user?.name ?? "?")}
            </AvatarFallback>
          </Avatar>
          <div className="text-xs font-medium truncate max-w-[140px]">
            {ticket.user?.name ?? "Unknown"}
          </div>
        </div>
      </td>
      <td className="px-6 py-2.5 hidden md:table-cell">
        {ticket.assignee ? (
          <div className="flex items-center gap-2">
            <Avatar className="size-6">
              <AvatarImage src={avatarUrl(ticket.assignee.name ?? "")} />
              <AvatarFallback className="text-[10px]">
                {getInitials(ticket.assignee.name ?? "?")}
              </AvatarFallback>
            </Avatar>
            <div className="text-xs font-medium truncate max-w-[130px]">
              {ticket.assignee.name}
            </div>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground italic">
            Unassigned
          </span>
        )}
      </td>
      <td className="px-6 py-2.5">
        <TicketStatusBadge status={ticket.status} />
      </td>
      <td className="px-6 py-2.5">
        <PriorityBadge priority={ticket.priority} />
      </td>
      <td className="px-6 py-2.5 hidden lg:table-cell">
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {formatDistanceToNow(new Date(ticket.updatedAt), {
            addSuffix: true,
          })}
        </span>
      </td>
    </tr>
  );
}
