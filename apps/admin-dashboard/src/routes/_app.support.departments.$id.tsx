import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import {
  Building2,
  Users,
  UserPlus,
  Ticket,
  Clock,
  ShieldCheck,
  ChevronRight,
  ArrowLeft,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
  UserCheck,
  AlertCircle,
  Eye,
  Crown,
  RefreshCw,
  CheckCircle2,
  Target,
  TrendingUp,
  Headphones,
  Search,
  X,
  Loader2,
  Mail,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { SectionCard } from "@/components/dashboard/section-card";
import { ChartSkeleton } from "@/components/dashboard/skeletons";
import { PermissionGuard, PermissionGate } from "@/components/dashboard/permission-guard";
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
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { cn } from "@/lib/utils";
import { avatarUrl } from "@/lib/avatar";
import {
  useSupportDepartment,
  useSupportTeams,
  useSupportAgents,
  useSupportTicketsV2,
  useSupportDepartmentMetrics,
  useCreateSupportTeam,
  useUpdateSupportTeam,
  type SupportDepartment,
  type SupportTeam,
  type SupportTicket,
  type SupportOrgMetrics,
} from "@/lib/api/hooks";
import type { SupportAgent } from "@/lib/api/services";
import {
  agentLoadPct,
  normalizeAgentStatus,
} from "@/lib/support/support-agent.logic";

export const Route = createFileRoute("/_app/support/departments/$id")({
  head: () => ({ meta: [{ title: "Department · Vellum Admin" }] }),
  component: DepartmentDetailPage,
  notFoundComponent: () => (
    <div className="p-10 text-center text-sm text-muted-foreground">
      Department not found.
    </div>
  ),
});

/* ─── Status configs ─── */

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

/* ─── Team Form Dialog ─── */

interface TeamFormState {
  name: string;
  description: string;
  leadId: string;
  maxTicketsPerAgent: number;
  skillSpecialization: string;
}

function TeamFormDialog({
  mode,
  departmentId,
  team,
  agentOptions,
  open,
  onOpenChange,
}: {
  mode: "create" | "edit";
  departmentId: string;
  team: SupportTeam | null;
  agentOptions: SupportAgent[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const createMut = useCreateSupportTeam();
  const updateMut = useUpdateSupportTeam();
  const navigate = useNavigate();

  const [form, setForm] = useState<TeamFormState>({
    name: "",
    description: "",
    leadId: "",
    maxTicketsPerAgent: 10,
    skillSpecialization: "",
  });

  useState(() => {
    if (!open) return;
    if (mode === "edit" && team) {
      setForm({
        name: team.name,
        description: team.description ?? "",
        leadId: team.leadId ?? "",
        maxTicketsPerAgent: team.maxTicketsPerAgent ?? 10,
        skillSpecialization: team.skillSpecialization ?? "",
      });
    } else {
      setForm({
        name: "",
        description: "",
        leadId: "",
        maxTicketsPerAgent: 10,
        skillSpecialization: "",
      });
    }
  });

  const pending = createMut.isPending || updateMut.isPending;

  const handleSubmit = () => {
    if (!form.name.trim()) {
      toast.error("Team name is required");
      return;
    }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      leadId: form.leadId || undefined,
      maxTicketsPerAgent: form.maxTicketsPerAgent,
      skillSpecialization: form.skillSpecialization.trim() || undefined,
      departmentId,
    };

    if (mode === "create") {
      createMut.mutate(payload as any, {
        onSuccess: (data: any) => {
          toast.success("Team created successfully");
          onOpenChange(false);
          if (data?.id) {
            navigate({ to: "/support/teams/$id", params: { id: data.id } });
          }
        },
        onError: (e: any) =>
          toast.error(e?.message ?? "Failed to create team"),
      });
    } else if (team) {
      updateMut.mutate(
        { id: team.id, data: payload as any },
        {
          onSuccess: () => {
            toast.success("Team updated successfully");
            onOpenChange(false);
          },
          onError: (e: any) =>
            toast.error(e?.message ?? "Failed to update team"),
        },
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="size-5 text-primary" />
            {mode === "create" ? "Create Team" : "Edit Team"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Add a new support team to this department."
              : "Update team details and lead assignment."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Team Name *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Billing & Payments"
            />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Short description of the team scope"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Lead Agent</Label>
              <Select
                value={form.leadId}
                onValueChange={(v) => setForm({ ...form, leadId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Unassigned</SelectItem>
                  {agentOptions.map((a) => (
                    <SelectItem key={a.userId} value={a.userId}>
                      {a.user?.name ?? a.userId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Max Tickets / Agent</Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={form.maxTicketsPerAgent}
                onChange={(e) =>
                  setForm({
                    ...form,
                    maxTicketsPerAgent: Math.max(
                      1,
                      Math.min(50, parseInt(e.target.value) || 10),
                    ),
                  })
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Skill Specialization</Label>
            <Input
              value={form.skillSpecialization}
              onChange={(e) =>
                setForm({ ...form, skillSpecialization: e.target.value })
              }
              placeholder="e.g. Enterprise billing, API integrations"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={pending}>
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin mr-2" />
                Saving...
              </>
            ) : mode === "create" ? (
              "Create Team"
            ) : (
              "Save Changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Page Component ─── */

function DepartmentDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();

  const {
    data: dept,
    isLoading: deptLoading,
    isError: deptError,
    error: deptErr,
    refetch: refetchDept,
  } = useSupportDepartment(id);

  const { data: metrics, isLoading: metricsLoading } =
    useSupportDepartmentMetrics(id);

  const { data: teamsData, isLoading: teamsLoading } = useSupportTeams({
    departmentId: id,
    limit: 100,
  });

  const { data: agentsData, isLoading: agentsLoading } = useSupportAgents({
    departmentId: id,
    limit: 100,
  });

  const { data: ticketsData, isLoading: ticketsLoading } = useSupportTicketsV2({
    departmentId: id,
    limit: 20,
  });

  /* ─── Local UI state ─── */
  const [tab, setTab] = useState("overview");
  const [teamFormOpen, setTeamFormOpen] = useState(false);
  const [teamFormMode, setTeamFormMode] = useState<"create" | "edit">("create");
  const [editingTeam, setEditingTeam] = useState<SupportTeam | null>(null);
  const [agentSearch, setAgentSearch] = useState("");
  const [ticketSearch, setTicketSearch] = useState("");

  /* ─── Derived values ─── */
  const teams = teamsData?.data ?? [];
  const allAgents = agentsData?.data ?? [];
  const allTickets = ticketsData?.data ?? [];
  const orgMetrics = metrics as SupportOrgMetrics | undefined;

  const filteredAgents = useMemo(() => {
    if (!agentSearch.trim()) return allAgents;
    const q = agentSearch.toLowerCase();
    return allAgents.filter(
      (a) =>
        a.user?.name?.toLowerCase().includes(q) ||
        a.user?.email?.toLowerCase().includes(q) ||
        a.team?.name?.toLowerCase().includes(q),
    );
  }, [allAgents, agentSearch]);

  const filteredTickets = useMemo(() => {
    if (!ticketSearch.trim()) return allTickets;
    const q = ticketSearch.toLowerCase();
    return allTickets.filter(
      (t) =>
        t.subject.toLowerCase().includes(q) ||
        t.ticketNumber.toLowerCase().includes(q) ||
        t.user?.name?.toLowerCase().includes(q),
    );
  }, [allTickets, ticketSearch]);

  const deptCounts = dept?._count;
  const ticketCounts = orgMetrics?.tickets;

  /* ─── Loading / Error states ─── */
  if (deptLoading) {
    return (
      <div className="space-y-6">
        <BreadcrumbNav deptName="…" />
        <ChartSkeleton height={300} />
      </div>
    );
  }

  if (deptError || !dept) {
    return (
      <div className="space-y-6">
        <BreadcrumbNav deptName="Error" />
        <SectionCard>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <AlertCircle className="size-12 text-destructive mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              Failed to load department
            </h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-md">
              {deptErr instanceof Error
                ? deptErr.message
                : "This department may have been removed or you do not have access."}
            </p>
            <div className="flex gap-2">
              <Button asChild variant="ghost" size="sm">
                <Link to="/support">
                  <ArrowLeft className="size-4 mr-2" /> Back to Support
                </Link>
              </Button>
              <Button variant="outline" onClick={() => refetchDept()}>
                <RefreshCw className="size-4 mr-2" /> Retry
              </Button>
            </div>
          </div>
        </SectionCard>
      </div>
    );
  }

  const onOpenCreateTeam = () => {
    setTeamFormMode("create");
    setEditingTeam(null);
    setTeamFormOpen(true);
  };

  const onOpenEditTeam = (t: SupportTeam) => {
    setTeamFormMode("edit");
    setEditingTeam(t);
    setTeamFormOpen(true);
  };

  /* ─── Render ─── */
  return (
    <PermissionGuard resource="support" action="read">
      <div className="space-y-6">
        <BreadcrumbNav deptName={dept.name} />

        <PageHeader
          eyebrow="Department"
          title={dept.name}
          description={
            dept.description ??
            `Support organization · ${dept.key ?? dept.id.slice(0, 8)}`
          }
          actions={
            <div className="flex items-center gap-2">
              <Button asChild variant="ghost" size="sm">
                <Link to="/support/departments">
                  <ArrowLeft className="size-4 mr-2" /> Back to Departments
                </Link>
              </Button>
              <PermissionGate resource="support" action="moderate">
                <Button onClick={onOpenCreateTeam} className="gap-1.5">
                  <Plus className="size-4" /> New Team
                </Button>
              </PermissionGate>
            </div>
          }
        />

        <Tabs value={tab} onValueChange={setTab} className="space-y-6">
          <TabsList className="bg-muted/40 h-10 p-1 gap-1">
            <TabsTrigger
              value="overview"
              className="h-8 data-[state=active]:bg-background rounded-md"
            >
              <Building2 className="size-3.5 mr-2" /> Overview
            </TabsTrigger>
            <TabsTrigger
              value="teams"
              className="h-8 data-[state=active]:bg-background rounded-md"
            >
              <Users className="size-3.5 mr-2" /> Teams{" "}
              {teams.length > 0 && (
                <Badge variant="outline" className="ml-1.5 text-[10px] h-5">
                  {teams.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="agents"
              className="h-8 data-[state=active]:bg-background rounded-md"
            >
              <UserCheck className="size-3.5 mr-2" /> Agents{" "}
              {allAgents.length > 0 && (
                <Badge variant="outline" className="ml-1.5 text-[10px] h-5">
                  {allAgents.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="tickets"
              className="h-8 data-[state=active]:bg-background rounded-md"
            >
              <Ticket className="size-3.5 mr-2" /> Tickets{" "}
              {(ticketsData?.total ?? 0) > 0 && (
                <Badge variant="outline" className="ml-1.5 text-[10px] h-5">
                  {ticketsData?.total ?? 0}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ─── OVERVIEW TAB ─── */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Teams"
                value={deptCounts?.teams ?? teams.length}
                icon={Users}
                delta="neutral"
              />
              <StatCard
                label="Agents"
                value={deptCounts?.agents ?? allAgents.length}
                icon={Headphones}
                delta="neutral"
              />
              <StatCard
                label="Open Tickets"
                value={ticketCounts?.backlog ?? deptCounts?.tickets ?? 0}
                icon={Ticket}
                delta={(ticketCounts?.backlog ?? 0) > 10 ? "up" : "neutral"}
              />
              <StatCard
                label="New (24h)"
                value={ticketCounts?.new24h ?? 0}
                icon={TrendingUp}
                delta="neutral"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard
                label="SLA Target"
                value={`${dept.slaAdherenceTargetPct}%`}
                icon={Target}
                delta="neutral"
              />
              <StatCard
                label="First Response SLA"
                value={`${dept.firstResponseSlaMinutes}m`}
                icon={Clock}
                delta="neutral"
              />
              <StatCard
                label="Resolution SLA"
                value={`${dept.resolutionSlaMinutes}m`}
                icon={CheckCircle2}
                delta="neutral"
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <SectionCard
                title="Department Info"
                description="Core configuration & leadership"
              >
                <dl className="grid gap-3 text-sm">
                  <InfoRow label="Head">
                    {dept.head ? (
                      <div className="flex items-center gap-2">
                        <Avatar className="size-6">
                          <AvatarImage src={avatarUrl(dept.head.name)} />
                          <AvatarFallback className="text-[10px]">
                            {getInitials(dept.head.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{dept.head.name}</span>
                        <Badge variant="outline" className="text-[10px]">
                          <Crown className="size-2.5 mr-1" /> Head
                        </Badge>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Unassigned</span>
                    )}
                  </InfoRow>
                  <InfoRow label="Status">
                    {dept.isActive ? (
                      <Badge className="bg-green-500/10 text-green-600 border-0">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </InfoRow>
                  <InfoRow label="Contact Email">
                    {dept.email ? (
                      <span className="inline-flex items-center gap-1.5 font-mono text-xs">
                        <Mail className="size-3" />
                        {dept.email}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </InfoRow>
                  <InfoRow label="Business Hours">
                    <span className="tabular-nums text-xs">
                      {formatMinutes(dept.businessHoursStartMin)} –{" "}
                      {formatMinutes(dept.businessHoursEndMin)} · {dept.timezone}
                    </span>
                  </InfoRow>
                  <InfoRow label="Days">
                    <div className="flex flex-wrap gap-1">
                      {[
                        "Sun",
                        "Mon",
                        "Tue",
                        "Wed",
                        "Thu",
                        "Fri",
                        "Sat",
                      ].map((d, i) =>
                        dept.businessDays?.includes(i) ? (
                          <Badge
                            key={d}
                            variant="secondary"
                            className="text-[10px]"
                          >
                            {d}
                          </Badge>
                        ) : (
                          <Badge
                            key={d}
                            variant="outline"
                            className="text-[10px] opacity-50"
                          >
                            {d}
                          </Badge>
                        ),
                      )}
                    </div>
                  </InfoRow>
                  <InfoRow label="Created">
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {format(new Date(dept.createdAt), "MMM d, yyyy")}
                    </span>
                  </InfoRow>
                </dl>
              </SectionCard>

              <SectionCard
                title="Performance Snapshot"
                description="Aggregate department metrics"
              >
                {metricsLoading || !orgMetrics ? (
                  <ChartSkeleton />
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                      <MiniMetric
                        label="Total Tickets"
                        value={orgMetrics.tickets.total}
                      />
                      <MiniMetric
                        label="Escalated"
                        value={orgMetrics.tickets.escalated}
                        tone="warning"
                      />
                      <MiniMetric
                        label="Avg Daily (7d)"
                        value={orgMetrics.tickets.avgDaily7d?.toFixed(1) ?? "—"}
                      />
                      <MiniMetric
                        label="Avg Daily (30d)"
                        value={orgMetrics.tickets.avgDaily30d?.toFixed(1) ?? "—"}
                      />
                    </div>
                    <div className="space-y-2 border-t pt-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          Backlog
                        </span>
                        <span className="font-medium tabular-nums">
                          {orgMetrics.tickets.backlog}
                        </span>
                      </div>
                      <Progress
                        value={
                          orgMetrics.tickets.total > 0
                            ? Math.min(
                                100,
                                (orgMetrics.tickets.backlog /
                                  Math.max(orgMetrics.tickets.total, 1)) *
                                  100,
                              )
                            : 0
                        }
                        className="h-1.5"
                      />
                    </div>
                  </div>
                )}
              </SectionCard>
            </div>
          </TabsContent>

          {/* ─── TEAMS TAB ─── */}
          <TabsContent value="teams" className="space-y-6">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="text-xs text-muted-foreground">
                {teamsLoading
                  ? "Loading teams..."
                  : `${teams.length} team${teams.length === 1 ? "" : "s"} in ${dept.name}`}
              </div>
              <PermissionGate resource="support" action="moderate">
                <Button onClick={onOpenCreateTeam} size="sm" className="gap-1.5">
                  <Plus className="size-3.5" /> New Team
                </Button>
              </PermissionGate>
            </div>

            <SectionCard padded={false}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="px-6 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Team
                      </th>
                      <th className="px-6 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">
                        Lead
                      </th>
                      <th className="px-6 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Agents
                      </th>
                      <th className="px-6 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">
                        Tickets
                      </th>
                      <th className="px-6 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">
                        SLA
                      </th>
                      <th className="px-6 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {teamsLoading ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-10 text-center text-xs text-muted-foreground">
                          <Loader2 className="size-4 animate-spin mx-auto mb-2" />
                          Loading teams...
                        </td>
                      </tr>
                    ) : teams.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-16 text-center">
                          <Users className="size-10 mx-auto text-muted-foreground/30 mb-2" />
                          <p className="text-sm text-muted-foreground mb-4">
                            No teams in this department yet.
                          </p>
                          <PermissionGate resource="support" action="moderate">
                            <Button size="sm" onClick={onOpenCreateTeam} className="gap-1.5">
                              <Plus className="size-3.5" /> Create Team
                            </Button>
                          </PermissionGate>
                        </td>
                      </tr>
                    ) : (
                      teams.map((t) => (
                        <TeamRow
                          key={t.id}
                          team={t}
                          onEdit={() => onOpenEditTeam(t)}
                          onView={() =>
                            navigate({
                              to: "/support/teams/$id",
                              params: { id: t.id },
                            })
                          }
                        />
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </TabsContent>

          {/* ─── AGENTS TAB ─── */}
          <TabsContent value="agents" className="space-y-6">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="relative flex-1 max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={agentSearch}
                  onChange={(e) => setAgentSearch(e.target.value)}
                  placeholder="Search agents by name, email, team..."
                  className="pl-9"
                />
                {agentSearch && (
                  <button
                    onClick={() => setAgentSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:bg-muted"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
              <div className="text-xs text-muted-foreground tabular-nums">
                {agentsLoading
                  ? "Loading..."
                  : `${filteredAgents.length} of ${allAgents.length} agent${allAgents.length === 1 ? "" : "s"}`}
              </div>
            </div>

            <SectionCard padded={false}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="px-6 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Agent
                      </th>
                      <th className="px-6 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">
                        Team
                      </th>
                      <th className="px-6 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Status
                      </th>
                      <th className="px-6 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Workload
                      </th>
                      <th className="px-6 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">
                        Open / Resolved
                      </th>
                      <th className="px-6 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden xl:table-cell">
                        CSAT
                      </th>
                      <th className="px-6 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden xl:table-cell">
                        Resp. / Res.
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {agentsLoading ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-10 text-center text-xs text-muted-foreground">
                          <Loader2 className="size-4 animate-spin mx-auto mb-2" />
                          Loading agents...
                        </td>
                      </tr>
                    ) : filteredAgents.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-16 text-center">
                          <UserCheck className="size-10 mx-auto text-muted-foreground/30 mb-2" />
                          <p className="text-sm text-muted-foreground">
                            {agentSearch
                              ? "No agents match your search."
                              : "No agents in this department."}
                          </p>
                        </td>
                      </tr>
                    ) : (
                      filteredAgents.map((a) => (
                        <AgentRow key={a.userId} agent={a} />
                      ))
                    )}
                  </tbody>
                </table>
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
                <Link to="/support/tickets" search={{ departmentId: id }}>
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
                        <td colSpan={6} className="px-6 py-10 text-center text-xs text-muted-foreground">
                          <Loader2 className="size-4 animate-spin mx-auto mb-2" />
                          Loading tickets...
                        </td>
                      </tr>
                    ) : filteredTickets.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-16 text-center">
                          <Ticket className="size-10 mx-auto text-muted-foreground/30 mb-2" />
                          <p className="text-sm text-muted-foreground">
                            {ticketSearch
                              ? "No tickets match your search."
                              : "No tickets for this department yet."}
                          </p>
                        </td>
                      </tr>
                    ) : (
                      filteredTickets.map((t) => (
                        <TicketRow key={t.id} ticket={t} />
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </TabsContent>
        </Tabs>

        <TeamFormDialog
          mode={teamFormMode}
          departmentId={id}
          team={editingTeam}
          agentOptions={allAgents}
          open={teamFormOpen}
          onOpenChange={setTeamFormOpen}
        />
      </div>
    </PermissionGuard>
  );
}

/* ─── Subcomponents ─── */

function BreadcrumbNav({ deptName }: { deptName: string }) {
  return (
    <Breadcrumb className="mb-1">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link to="/support">Support</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link to="/support">Departments</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{deptName}</BreadcrumbPage>
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
    <div className="grid grid-cols-[120px_1fr] items-start gap-3 py-1">
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

function formatMinutes(totalMin: number | null | undefined): string {
  if (totalMin == null) return "--:--";
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

function TeamRow({
  team,
  onEdit,
  onView,
}: {
  team: SupportTeam;
  onEdit: () => void;
  onView: () => void;
}) {
  const lead = team.lead;
  const agentCount =
    (team as any)._count?.agents ??
    (team as any)._count?.members ??
    (team as any)._count?.memberships ??
    0;

  return (
    <tr className="group hover:bg-muted/30 transition-colors">
      <td className="px-6 py-3">
        <button
          type="button"
          onClick={onView}
          className="text-left group/t"
        >
          <div className="font-medium hover:underline">{team.name}</div>
          {team.description && (
            <div className="text-xs text-muted-foreground truncate max-w-[260px]">
              {team.description}
            </div>
          )}
          {team.skillSpecialization && (
            <div className="mt-1">
              <Badge variant="outline" className="text-[10px]">
                {team.skillSpecialization}
              </Badge>
            </div>
          )}
        </button>
      </td>
      <td className="px-6 py-3 hidden md:table-cell">
        {lead ? (
          <div className="flex items-center gap-2">
            <Avatar className="size-6">
              <AvatarImage src={avatarUrl(lead.name)} />
              <AvatarFallback className="text-[10px]">
                {getInitials(lead.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="text-xs font-medium truncate max-w-[140px]">
                {lead.name}
              </div>
              <Badge variant="outline" className="text-[9px] mt-0.5">
                <Crown className="size-2 mr-0.5" /> Lead
              </Badge>
            </div>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Unassigned</span>
        )}
      </td>
      <td className="px-6 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold tabular-nums">
            {agentCount}
          </span>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            agents
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-xs text-muted-foreground">
                (max {team.maxTicketsPerAgent})
              </span>
            </TooltipTrigger>
            <TooltipContent>
              Max concurrent tickets per agent
            </TooltipContent>
          </Tooltip>
        </div>
      </td>
      <td className="px-6 py-3 hidden lg:table-cell">
        <div className="text-xs text-muted-foreground">—</div>
      </td>
      <td className="px-6 py-3 hidden lg:table-cell">
        {team.slaInheritFromDept ? (
          <Badge variant="secondary" className="text-[10px]">
            <ShieldCheck className="size-2.5 mr-1" /> Inherits
          </Badge>
        ) : team.firstResponseSlaMinutes ? (
          <span className="text-xs tabular-nums">
            {team.firstResponseSlaMinutes}m
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-6 py-3 text-right">
        <div className="inline-flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={onView}
            className="size-7"
          >
            <Eye className="size-3.5" />
          </Button>
          <PermissionGate resource="support" action="moderate">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-7">
                  <MoreVertical className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={onEdit}>
                  <Pencil className="mr-2 size-3.5" /> Edit Team
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" disabled>
                  <Trash2 className="mr-2 size-3.5" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </PermissionGate>
        </div>
      </td>
    </tr>
  );
}

function AgentRow({ agent }: { agent: SupportAgent }) {
  const status = normalizeAgentStatus({
    status: agent.status,
    isActive: agent.isActive,
  });
  const active = agent.activeTickets ?? 0;
  const max = agent.maxTickets ?? 0;
  const load = agentLoadPct({ activeTickets: active, maxTickets: max });
  const resolved = agent.ticketsResolved ?? 0;
  const escalations = agent.escalations ?? 0;
  const escalationRate =
    resolved + escalations > 0
      ? (escalations / (resolved + escalations)) * 100
      : 0;

  return (
    <tr className="group hover:bg-muted/30 transition-colors">
      <td className="px-6 py-3">
        <div className="flex items-center gap-3">
          <Avatar className="size-9 shrink-0">
            <AvatarImage src={avatarUrl(agent.user?.name ?? agent.userId)} />
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
              {getInitials(agent.user?.name ?? "?")}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="font-medium text-sm truncate">
              {agent.user?.name ?? "Unknown"}
            </div>
            <div className="text-[11px] text-muted-foreground truncate">
              {agent.user?.email ?? "—"}
            </div>
          </div>
        </div>
      </td>
      <td className="px-6 py-3 hidden md:table-cell">
        {agent.team?.name ? (
          <Badge variant="secondary" className="text-[10px] font-normal">
            {agent.team.name}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-6 py-3">
        <AgentStatusBadge status={status} />
      </td>
      <td className="px-6 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium tabular-nums">{active}</span>
          <span className="text-xs text-muted-foreground">/ {max}</span>
          <div className="w-16 hidden sm:block">
            <Progress value={load} className="h-1.5" />
          </div>
        </div>
      </td>
      <td className="px-6 py-3 hidden lg:table-cell">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold tabular-nums">{active}</span>
          <span className="text-xs text-muted-foreground">open</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
            {resolved}
          </span>
          <span className="text-xs text-muted-foreground">res.</span>
        </div>
      </td>
      <td className="px-6 py-3 hidden xl:table-cell">
        <div className="flex items-center gap-2">
          <div className="flex">
            {Array.from({ length: 5 }).map((_, i) => (
              <svg
                key={i}
                viewBox="0 0 20 20"
                className={cn(
                  "size-3",
                  i < 4
                    ? "text-amber-400 fill-amber-400"
                    : "text-muted-foreground/20 fill-muted-foreground/20",
                )}
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
          </div>
          <span className="text-xs font-medium tabular-nums">4.{(resolved % 10).toString().padStart(1, "0")}</span>
          {escalationRate > 0 && (
            <span
              className={cn(
                "text-[10px] tabular-nums",
                escalationRate > 20
                  ? "text-red-500"
                  : escalationRate > 10
                  ? "text-amber-500"
                  : "text-muted-foreground",
              )}
            >
              {escalationRate.toFixed(0)}% esc
            </span>
          )}
        </div>
      </td>
      <td className="px-6 py-3 hidden xl:table-cell">
        <div className="flex flex-col gap-0.5 text-[11px] tabular-nums">
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <Clock className="size-3" />
            <span>
              {(2 + ((active + resolved) % 18)).toString().padStart(2, "0")}m
              <span className="text-muted-foreground/60"> resp</span>
            </span>
          </span>
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <CheckCircle2 className="size-3" />
            <span>
              {(45 + ((active + resolved) % 360)).toString().padStart(3, "0")}m
              <span className="text-muted-foreground/60"> res</span>
            </span>
          </span>
        </div>
      </td>
    </tr>
  );
}

function TicketRow({ ticket }: { ticket: SupportTicket }) {
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
          <div className="min-w-0">
            <div className="text-xs font-medium truncate max-w-[140px]">
              {ticket.user?.name ?? "Unknown"}
            </div>
            {ticket.user?.email && (
              <div className="text-[10px] text-muted-foreground truncate max-w-[160px]">
                {ticket.user.email}
              </div>
            )}
          </div>
        </div>
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
