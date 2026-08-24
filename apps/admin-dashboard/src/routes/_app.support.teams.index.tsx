import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Users,
  UserPlus,
  Building2,
  Ticket,
  Plus,
  Pencil,
  Trash2,
  Archive,
  RefreshCw,
  Undo2,
  Loader2,
  Search,
  ChevronDown,
  ArrowUpDown,
  Shield,
  Check,
  X,
  Filter,
  Gauge,
  Crown,
  Eye,
  AlertCircle,
  Clock,
  Target,
  MoreHorizontal,
} from "lucide-react";
import { useState, useMemo, useCallback } from "react";
import { ListPage } from "@/components/dashboard/list-page";
import { StatCard } from "@/components/dashboard/stat-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  useSupportDepartments,
  useSupportTeams,
  useSupportAgents,
  useCreateSupportTeam,
  useUpdateSupportTeam,
  useDeleteSupportTeam,
  useRestoreSupportTeam,
  useAssignTeamLead,
  useRemoveTeamLead,
  type SupportTeam,
  type SupportDepartment,
} from "@/lib/api/hooks";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/support/teams/")({
  head: () => ({ meta: [{ title: "Support Teams · Vellum Admin" }] }),
  component: TeamsPage,
});

type StatusFilter = "all" | "active" | "archived";
type SortBy = "name" | "createdAt" | "maxTicketsPerAgent";
type SortDir = "asc" | "desc";

// ─── Team Preview Sheet ───

export function TeamPreviewSheet({
  team,
  open,
  onOpenChange,
  onAssignLead,
}: {
  team: SupportTeam | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAssignLead: (team: SupportTeam) => void;
}) {
  const [activeTab, setActiveTab] = useState("overview");

  const { data: agentsData, isLoading: agentsLoading } = useSupportAgents({
    teamId: team?.id,
    limit: 50,
  });

  if (!team) return null;

  const agents = agentsData?.data ?? [];
  const agentCount = agents.length;
  const lead = team.lead;
  const memberCount =
    (team._count as any)?.members ??
    (team._count as any)?.agents ??
    0;
  const dept = team.department;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <div className="grid size-12 place-items-center rounded-lg bg-info/15 text-info">
              <Users className="size-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <SheetTitle className="text-lg font-semibold truncate">
                  {team.name}
                </SheetTitle>
                {team.skillSpecialization && (
                  <Badge variant="outline" className="text-[10px]">
                    {team.skillSpecialization}
                  </Badge>
                )}
              </div>
              <SheetDescription className="flex items-center gap-2 text-xs">
                <Clock className="size-3" />
                Created {formatDistanceToNow(new Date(team.createdAt), { addSuffix: true })}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview" className="gap-1.5">
              <Eye className="size-3.5" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="members" className="gap-1.5">
              <Users className="size-3.5" />
              Members ({agentCount})
            </TabsTrigger>
            <TabsTrigger value="capacity" className="gap-1.5">
              <Gauge className="size-3.5" />
              Capacity
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="mt-4 space-y-4">
            {/* Team Lead */}
            <div className="rounded-lg border p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Crown className="size-3.5 text-warning" />
                  Team Lead
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs gap-1"
                  onClick={() => onAssignLead(team)}
                >
                  <UserPlus className="size-3" />
                  {lead ? "Change" : "Assign"}
                </Button>
              </div>
              {lead ? (
                <div className="flex items-center gap-3">
                  <Avatar className="size-9">
                    <AvatarImage src={lead.avatar ?? ""} />
                    <AvatarFallback className="bg-warning/10 text-warning">
                      {lead.name?.[0]?.toUpperCase() ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{lead.name}</p>
                    <p className="text-xs text-muted-foreground">{lead.email}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">No team lead assigned</p>
              )}
            </div>

            {/* Department */}
            <div className="rounded-lg border p-4">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Building2 className="size-3.5" />
                Department
              </span>
              {dept ? (
                <div className="mt-2 flex items-center gap-2">
                  <div className="grid size-8 place-items-center rounded-md bg-primary/10 text-primary">
                    <Building2 className="size-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{dept.name}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">{dept.key}</p>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground italic">No department linked</p>
              )}
            </div>

            {/* SLA */}
            <div className="rounded-lg border p-4">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Target className="size-3.5" />
                SLA Configuration
              </span>
              <div className="mt-3 grid grid-cols-3 gap-3">
                <div className="text-center">
                  <div className="text-sm font-medium tabular-nums">
                    {team.slaInheritFromDept
                      ? "Inherit"
                      : team.firstResponseSlaMinutes
                        ? `${team.firstResponseSlaMinutes}m`
                        : "—"}
                  </div>
                  <div className="text-[10px] text-muted-foreground">Response SLA</div>
                </div>
                <div className="text-center">
                  <div className="text-sm font-medium tabular-nums">
                    {team.slaInheritFromDept
                      ? "Inherit"
                      : team.resolutionSlaMinutes
                        ? `${team.resolutionSlaMinutes}m`
                        : "—"}
                  </div>
                  <div className="text-[10px] text-muted-foreground">Resolution SLA</div>
                </div>
                <div className="text-center">
                  <Badge variant={team.slaInheritFromDept ? "outline" : "secondary"} className="text-[10px]">
                    {team.slaInheritFromDept ? "Inherited" : "Custom"}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg border p-3 text-center">
                <div className="text-lg font-bold">{memberCount}</div>
                <div className="text-[10px] text-muted-foreground">Members</div>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <div className="text-lg font-bold">{team.maxTicketsPerAgent}</div>
                <div className="text-[10px] text-muted-foreground">Max/Agent</div>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <div className="text-lg font-bold">{team.concurrentTicketLimitPerAgent}</div>
                <div className="text-[10px] text-muted-foreground">Concurrent</div>
              </div>
            </div>
          </TabsContent>

          {/* Members Tab */}
          <TabsContent value="members" className="mt-4">
            {agentsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : agentCount === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Users className="size-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground mt-2">No agents in this team</p>
              </div>
            ) : (
              <div className="space-y-2">
                {agents.map((agent) => (
                  <div key={agent.id} className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/30">
                    <Avatar className="size-8">
                      <AvatarImage src={agent.user?.avatar ?? ""} />
                      <AvatarFallback className="text-[10px]">
                        {agent.user?.name?.[0]?.toUpperCase() ?? "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{agent.user?.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{agent.user?.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {lead && agent.userId === lead.id && (
                        <Badge variant="outline" className="text-[10px] gap-1 text-warning border-warning/30">
                          <Crown className="size-2.5" />
                          Lead
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-[10px]">
                        {agent.activeTickets} active
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Capacity Tab */}
          <TabsContent value="capacity" className="mt-4 space-y-4">
            <div className="rounded-lg border p-4 space-y-3">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Gauge className="size-3.5" />
                Capacity Metrics
              </span>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Max Tickets per Agent</span>
                  <span className="text-sm font-medium tabular-nums">{team.maxTicketsPerAgent}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Concurrent Ticket Limit</span>
                  <span className="text-sm font-medium tabular-nums">{team.concurrentTicketLimitPerAgent}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Agents</span>
                  <span className="text-sm font-medium tabular-nums">{memberCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Theoretical Max Tickets</span>
                  <span className="text-sm font-medium tabular-nums">
                    {memberCount * team.maxTicketsPerAgent}
                  </span>
                </div>
              </div>
            </div>

            {team.description && (
              <div className="rounded-lg border p-4">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Description
                </span>
                <p className="mt-2 text-sm text-muted-foreground">{team.description}</p>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <SheetFooter className="border-t pt-4 mt-4">
          <div className="flex items-center justify-between w-full">
            <span className="text-xs text-muted-foreground">
              ID: {team.id.slice(0, 8)}...
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => onAssignLead(team)}
              >
                <Crown className="size-3.5" />
                {lead ? "Change Lead" : "Assign Lead"}
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to="/support/teams/$teamId" params={{ teamId: team.id }}>
                  <Eye className="size-3.5 mr-1.5" />
                  Full Details
                </Link>
              </Button>
            </div>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ─── Assign Lead Dialog ───

export function AssignLeadDialog({
  team,
  open,
  onOpenChange,
  onAssign,
  onRemove,
}: {
  team: SupportTeam | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAssign: (teamId: string, agentId: string) => void;
  onRemove: (teamId: string) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState("");

  // Filter agents to the team's department
  const { data: agentsData, isLoading } = useSupportAgents({
    search: searchQuery || undefined,
    departmentId: team?.departmentId,
    limit: 50,
  });

  const handleAssign = () => {
    if (!team || !selectedAgentId) return;
    onAssign(team.id, selectedAgentId);
    onOpenChange(false);
    setSelectedAgentId("");
  };

  const handleRemove = () => {
    if (!team) return;
    onRemove(team.id);
    onOpenChange(false);
  };

  const agents = agentsData?.data ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="size-5 text-warning" />
            {team?.lead ? "Change" : "Assign"} Team Lead
          </DialogTitle>
          <DialogDescription>
            {team?.lead
              ? `Replace ${team.lead.name} as the lead of ${team.name}.`
              : `Select an agent to lead ${team?.name}. Only agents from the same department are shown.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Search */}
          <div className="space-y-2">
            <Label>Search Agents</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Agent list */}
          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto rounded-md border divide-y">
              {agents.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No agents found in this department
                </div>
              ) : (
                agents.map((agent) => (
                  <button
                    key={agent.id}
                    onClick={() => setSelectedAgentId( agent.userId || agent.user.id || agent.id)}
                    className={cn(
                      "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/50",
                      [agent.userId, agent.user.id, agent.id].includes(selectedAgentId) && "bg-primary/10"
                    )}
                  >
                    <Avatar className="size-8">
                      <AvatarImage src={agent.user?.avatar ?? ""} />
                      <AvatarFallback className="text-[10px]">
                        {agent.user?.name?.[0]?.toUpperCase() ?? "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{agent.user?.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{agent.user?.email}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {agent.activeTickets} active
                    </Badge>
                    {[agent.userId, agent.user.id, agent.id].includes(selectedAgentId) && (
                      <Check className="size-4 text-primary shrink-0" />
                    )}
                  </button>
                ))
              )}
            </div>
          )}

          {/* Current lead warning */}
          {team?.lead && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
              <p className="text-sm text-destructive flex items-center gap-2">
                <AlertCircle className="size-4" />
                Current lead: {team.lead.name}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {team?.lead && (
            <Button variant="destructive" onClick={handleRemove}>
              Remove Lead
            </Button>
          )}
          <Button onClick={handleAssign} disabled={!selectedAgentId}>
            {team?.lead ? "Replace" : "Assign"} Lead
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ───

function TeamsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortBy>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const includeDeleted = statusFilter === "archived";
  const isActiveParam =
    statusFilter === "all" ? undefined : statusFilter === "active";

  const {
    data: teamsData,
    isLoading,
    refetch: refetchTeams,
  } = useSupportTeams({
    page,
    limit: pageSize,
    departmentId: departmentFilter === "all" ? undefined : departmentFilter,
    search: searchQuery || undefined,
    isActive: isActiveParam,
    includeDeleted,
    sortBy,
    sortDir,
  });

  const navigate = useNavigate();

  const { data: deptData, isLoading: deptsLoading } = useSupportDepartments({
    limit: 100,
  });

  const departments: SupportDepartment[] = deptData?.data ?? [];
  const teams: SupportTeam[] = teamsData?.data ?? [];
  const total = teamsData?.total ?? 0;

  const createTeam = useCreateSupportTeam();
  const updateTeam = useUpdateSupportTeam();
  const deleteTeam = useDeleteSupportTeam();
  const restoreTeam = useRestoreSupportTeam();
  const assignLead = useAssignTeamLead();
  const removeLead = useRemoveTeamLead();

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [isRestoreOpen, setIsRestoreOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<SupportTeam | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Preview & Lead dialog states
  const [previewTeam, setPreviewTeam] = useState<SupportTeam | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [assignLeadOpen, setAssignLeadOpen] = useState(false);
  const [assignLeadTeam, setAssignLeadTeam] = useState<SupportTeam | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDeptId, setFormDeptId] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formMaxTickets, setFormMaxTickets] = useState<number>(8);
  const [formConcurrentLimit, setFormConcurrentLimit] = useState<number>(3);
  const [formSkillSpecialization, setFormSkillSpecialization] = useState("");

  // Stats
  const stats = useMemo(() => {
    const activeDepts = departments.filter((d) => !d.deletedAt && d.isActive).length;
    const activeTeams = teams.filter((t) => !t.deletedAt && t.isActive).length;
    const totalAgents = teams.reduce(
      (sum, t) => sum + ((t._count as any)?.members ?? (t._count as any)?.agents ?? 0),
      0,
    );
    return {
      totalTeams: total,
      activeTeams,
      activeDepts,
      totalAgents,
    };
  }, [teams, total, departments]);

  const hasActiveFilters =
    searchQuery || statusFilter !== "all" || departmentFilter !== "all";

  const clearFilters = useCallback(() => {
    setSearchQuery("");
    setStatusFilter("all");
    setDepartmentFilter("all");
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refetchTeams();
      toast.success("Teams refreshed");
    } catch {
      toast.error("Failed to refresh teams");
    } finally {
      setIsRefreshing(false);
    }
  }, [refetchTeams]);

  const resetForm = () => {
    setFormName("");
    setFormDeptId(departments[0]?.id ?? "");
    setFormDescription("");
    setFormMaxTickets(8);
    setFormConcurrentLimit(3);
    setFormSkillSpecialization("");
  };

  const openCreate = () => {
    resetForm();
    setIsCreateOpen(true);
  };

  const openEdit = (team: SupportTeam) => {
    setSelected(team);
    setFormName(team.name);
    setFormDeptId(team.departmentId);
    setFormDescription(team.description ?? "");
    setFormMaxTickets(team.maxTicketsPerAgent);
    setFormConcurrentLimit(team.concurrentTicketLimitPerAgent);
    setFormSkillSpecialization(team.skillSpecialization ?? "");
    setIsEditOpen(true);
  };

  const openArchive = (team: SupportTeam) => {
    setSelected(team);
    setIsArchiveOpen(true);
  };

  const openRestore = (team: SupportTeam) => {
    setSelected(team);
    setIsRestoreOpen(true);
  };

  const openDelete = (team: SupportTeam) => {
    setSelected(team);
    setIsDeleteOpen(true);
  };

  const handleCreate = useCallback(() => {
    if (!formName.trim() || !formDeptId) {
      toast.error("Name and department are required");
      return;
    }

    createTeam.mutate(
      {
        departmentId: formDeptId,
        name: formName.trim(),
        description: formDescription.trim() || null,
        maxTicketsPerAgent: formMaxTickets,
        concurrentTicketLimitPerAgent: formConcurrentLimit,
        skillSpecialization: formSkillSpecialization.trim() || null,
      },
      {
        onSuccess: () => {
          setIsCreateOpen(false);
          resetForm();
          refetchTeams();
          toast.success("Team created successfully");
        },
        onError: (error) => {
          toast.error(
            "Failed to create team: " +
            ((error as any)?.message ?? "Unknown error"),
          );
        },
      },
    );
  }, [
    formName,
    formDeptId,
    formDescription,
    formMaxTickets,
    formConcurrentLimit,
    formSkillSpecialization,
    createTeam,
    refetchTeams,
    departments,
  ]);

  const handleUpdate = useCallback(() => {
    if (!selected) return;
    if (!formName.trim() || !formDeptId) {
      toast.error("Name and department are required");
      return;
    }

    updateTeam.mutate(
      {
        id: selected.id,
        data: {
          name: formName.trim(),
          departmentId: formDeptId,
          description: formDescription.trim() || null,
          maxTicketsPerAgent: formMaxTickets,
          concurrentTicketLimitPerAgent: formConcurrentLimit,
          skillSpecialization: formSkillSpecialization.trim() || null,
        },
      },
      {
        onSuccess: () => {
          setIsEditOpen(false);
          setSelected(null);
          resetForm();
          refetchTeams();
          toast.success("Team updated successfully");
        },
        onError: (error) => {
          toast.error(
            "Failed to update team: " +
            ((error as any)?.message ?? "Unknown error"),
          );
        },
      },
    );
  }, [
    selected,
    formName,
    formDeptId,
    formDescription,
    formMaxTickets,
    formConcurrentLimit,
    formSkillSpecialization,
    updateTeam,
    refetchTeams,
  ]);

  const handleArchive = useCallback(() => {
    if (!selected) return;

    deleteTeam.mutate(selected.id, {
      onSuccess: () => {
        setIsArchiveOpen(false);
        setSelected(null);
        refetchTeams();
        toast.success("Team archived");
      },
      onError: (error) => {
        toast.error(
          "Failed to archive team: " +
          ((error as any)?.message ?? "Unknown error"),
        );
      },
    });
  }, [selected, deleteTeam, refetchTeams]);

  const handleRestore = useCallback(() => {
    if (!selected) return;

    restoreTeam.mutate(selected.id, {
      onSuccess: () => {
        setIsRestoreOpen(false);
        setSelected(null);
        refetchTeams();
        toast.success("Team restored");
      },
      onError: (error) => {
        toast.error(
          "Failed to restore team: " +
          ((error as any)?.message ?? "Unknown error"),
        );
      },
    });
  }, [selected, restoreTeam, refetchTeams]);

  const handleDelete = useCallback(() => {
    if (!selected) return;

    deleteTeam.mutate(selected.id, {
      onSuccess: () => {
        setIsDeleteOpen(false);
        setSelected(null);
        refetchTeams();
        toast.success("Team permanently deleted");
      },
      onError: (error) => {
        toast.error(
          "Failed to delete team: " +
          ((error as any)?.message ?? "Unknown error"),
        );
      },
    });
  }, [selected, deleteTeam, refetchTeams]);

  // ── Lead management handlers ──

  const openPreview = (team: SupportTeam) => {
    setPreviewTeam(team);
    setPreviewOpen(true);
  };

  const openAssignLead = (team: SupportTeam) => {
    setAssignLeadTeam(team);
    setAssignLeadOpen(true);
  };

  const openAssignLeadFromPreview = (team: SupportTeam) => {
    setPreviewOpen(false);
    setAssignLeadTeam(team);
    setAssignLeadOpen(true);
  };

  const handleAssignLead = useCallback(
    (teamId: string, agentId: string) => {
      assignLead.mutate(
        { teamId, userId: agentId },
        {
          onSuccess: () => {
            toast.success("Team lead assigned successfully");
            refetchTeams();
            setAssignLeadTeam(null);
          },
          onError: (error) => {
            toast.error(
              "Failed to assign team lead: " +
              ((error as any)?.message ?? "Unknown error"),
            );
          },
        },
      );
    },
    [assignLead, refetchTeams],
  );

  const handleRemoveLead = useCallback(
    (teamId: string) => {
      removeLead.mutate(
        { teamId },
        {
          onSuccess: () => {
            toast.success("Team lead removed");
            refetchTeams();
            setAssignLeadTeam(null);
          },
          onError: (error) => {
            toast.error(
              "Failed to remove team lead: " +
              ((error as any)?.message ?? "Unknown error"),
            );
          },
        },
      );
    },
    [removeLead, refetchTeams],
  );

  const toggleSort = (key: SortBy) => {
    if (sortBy === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(key);
      setSortDir("asc");
    }
  };

  const getDeptById = (id: string) => departments.find((d) => d.id === id);

  const renderHeader = () => (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mt-2 mb-6">
      <StatCard
        label="Teams"
        value={stats.totalTeams.toLocaleString()}
        icon={Users}
        tone="primary"
        loading={isLoading}
      />
      <StatCard
        label="Active Teams"
        value={stats.activeTeams.toLocaleString()}
        icon={Shield}
        tone="success"
        loading={isLoading}
      />
      <StatCard
        label="Departments"
        value={stats.activeDepts.toLocaleString()}
        icon={Building2}
        tone="info"
        loading={deptsLoading}
      />
      <StatCard
        label="Team Members"
        value={stats.totalAgents.toLocaleString()}
        icon={UserPlus}
        tone="warning"
        loading={isLoading}
      />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="size-5 text-primary" />
              Create Team
            </DialogTitle>
            <DialogDescription>
              Create a new support team under an existing department.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="team-dept">
                Department <span className="text-destructive">*</span>
              </Label>
              <Select value={formDeptId} onValueChange={setFormDeptId}>
                <SelectTrigger id="team-dept" className="gap-2">
                  {formDeptId && (
                    <Building2 className="size-4 text-muted-foreground shrink-0" />
                  )}
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments
                    .filter((d) => !d.deletedAt && d.isActive)
                    .map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        <div className="flex items-center gap-2">
                          <Building2 className="size-3.5 text-muted-foreground" />
                          {d.name}
                          <code className="text-[10px] px-1 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                            {d.key}
                          </code>
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="team-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="team-name"
                placeholder="e.g. Billing Tier 1"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="team-desc">Description</Label>
              <Textarea
                id="team-desc"
                rows={2}
                placeholder="Short description of the team's scope"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="team-max-tickets">
                  Max Tickets / Agent
                </Label>
                <Input
                  id="team-max-tickets"
                  type="number"
                  min={1}
                  value={formMaxTickets}
                  onChange={(e) =>
                    setFormMaxTickets(parseInt(e.target.value || "0", 10))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="team-conc-limit">
                  Concurrent Limit
                </Label>
                <Input
                  id="team-conc-limit"
                  type="number"
                  min={1}
                  value={formConcurrentLimit}
                  onChange={(e) =>
                    setFormConcurrentLimit(
                      parseInt(e.target.value || "0", 10),
                    )
                  }
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="team-skill">
                Skill Specialization
              </Label>
              <Input
                id="team-skill"
                placeholder="e.g. Refunds, VIP, Mobile Apps"
                value={formSkillSpecialization}
                onChange={(e) => setFormSkillSpecialization(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateOpen(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={
                createTeam.isPending || !formName.trim() || !formDeptId
              }
              className="gap-1.5"
            >
              {createTeam.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              {createTeam.isPending ? "Creating..." : "Create Team"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="size-5 text-primary" />
              Edit Team
            </DialogTitle>
            <DialogDescription>
              Update team configuration and routing behavior.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-team-dept">
                Department <span className="text-destructive">*</span>
              </Label>
              <Select value={formDeptId} onValueChange={setFormDeptId}>
                <SelectTrigger id="edit-team-dept" className="gap-2">
                  {formDeptId && (
                    <Building2 className="size-4 text-muted-foreground shrink-0" />
                  )}
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments
                    .filter((d) => !d.deletedAt && d.isActive)
                    .map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        <div className="flex items-center gap-2">
                          <Building2 className="size-3.5 text-muted-foreground" />
                          {d.name}
                          <code className="text-[10px] px-1 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                            {d.key}
                          </code>
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-team-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-team-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-team-desc">Description</Label>
              <Textarea
                id="edit-team-desc"
                rows={2}
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="edit-team-max-tickets">
                  Max Tickets / Agent
                </Label>
                <Input
                  id="edit-team-max-tickets"
                  type="number"
                  min={1}
                  value={formMaxTickets}
                  onChange={(e) =>
                    setFormMaxTickets(parseInt(e.target.value || "0", 10))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-team-conc-limit">
                  Concurrent Limit
                </Label>
                <Input
                  id="edit-team-conc-limit"
                  type="number"
                  min={1}
                  value={formConcurrentLimit}
                  onChange={(e) =>
                    setFormConcurrentLimit(
                      parseInt(e.target.value || "0", 10),
                    )
                  }
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-team-skill">
                Skill Specialization
              </Label>
              <Input
                id="edit-team-skill"
                value={formSkillSpecialization}
                onChange={(e) => setFormSkillSpecialization(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsEditOpen(false);
                setSelected(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={
                updateTeam.isPending || !formName.trim() || !formDeptId
              }
              className="gap-1.5"
            >
              {updateTeam.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              {updateTeam.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archive Dialog */}
      <Dialog open={isArchiveOpen} onOpenChange={setIsArchiveOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Archive className="size-5 text-warning" />
              Archive Team
            </DialogTitle>
            <DialogDescription>
              Archive <strong>{selected?.name}</strong>? The team will no
              longer receive new tickets but can be restored later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsArchiveOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleArchive}
              disabled={deleteTeam.isPending}
              className="gap-1.5"
            >
              {deleteTeam.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Archive className="size-4" />
              )}
              {deleteTeam.isPending ? "Archiving..." : "Archive"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore Dialog */}
      <Dialog open={isRestoreOpen} onOpenChange={setIsRestoreOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Undo2 className="size-5 text-success" />
              Restore Team
            </DialogTitle>
            <DialogDescription>
              Restore <strong>{selected?.name}</strong> to active status so it
              can resume receiving tickets.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsRestoreOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleRestore}
              disabled={restoreTeam.isPending}
              className="gap-1.5"
            >
              {restoreTeam.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Undo2 className="size-4" />
              )}
              {restoreTeam.isPending ? "Restoring..." : "Restore"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="size-5 text-destructive" />
              Permanently Delete
            </DialogTitle>
            <DialogDescription className="space-y-2">
              <p>
                This action <strong>cannot be undone</strong>.{" "}
                <strong>{selected?.name}</strong> will be permanently removed.
              </p>
              <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive">
                All team memberships will be disassociated. Agents assigned
                only to this team may become unassigned.
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteTeam.isPending}
              className="gap-1.5"
            >
              {deleteTeam.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              {deleteTeam.isPending ? "Deleting..." : "Delete Permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Team Preview Sheet */}
      <TeamPreviewSheet
        team={previewTeam}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        onAssignLead={openAssignLeadFromPreview}
      />

      {/* Assign Lead Dialog */}
      <AssignLeadDialog
        team={assignLeadTeam}
        open={assignLeadOpen}
        onOpenChange={setAssignLeadOpen}
        onAssign={handleAssignLead}
        onRemove={handleRemoveLead}
      />

      <ListPage
        title="Support Teams"
        description="Manage support teams, their department assignment, capacity limits, and specializations."
        eyebrow="Support Organization"
        rows={teams}
        searchKeys={["name", "description", "skillSpecialization"]}
        pageSize={pageSize}
        isLoading={isLoading}
        enableSelection={false}
        enablePagination={false}
        searchPlaceholder="Search teams..."
        actions={
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
                  <RefreshCw
                    className={cn("size-4", isRefreshing && "animate-spin")}
                  />
                  <span className="hidden sm:inline">Refresh</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh list</TooltipContent>
            </Tooltip>

            <Button size="sm" className="gap-1.5" onClick={openCreate}>
              <Plus className="size-4" />
              <span className="hidden sm:inline">New Team</span>
              <span className="sm:hidden">New</span>
            </Button>
          </div>
        }
        renderHeader={renderHeader()}
        filters={
          <>
            <div className="flex items-center gap-2 flex-wrap">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5 h-8">
                    <Building2 className="size-3.5" />
                    Department
                    <ChevronDown className="size-3" />
                    {departmentFilter !== "all" && (
                      <Badge
                        variant="secondary"
                        className="ml-1 rounded-sm text-[10px] h-4 px-1.5"
                      >
                        {getDeptById(departmentFilter)?.name?.slice(0, 10) ??
                          "Filtered"}
                      </Badge>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
                  <DropdownMenuLabel>Filter by department</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setDepartmentFilter("all")}
                    className={cn(departmentFilter === "all" && "bg-accent")}
                  >
                    All departments
                    {departmentFilter === "all" && (
                      <Check className="ml-2 size-3.5" />
                    )}
                  </DropdownMenuItem>
                  {departments
                    .filter((d) => !d.deletedAt)
                    .map((d) => (
                      <DropdownMenuItem
                        key={d.id}
                        onClick={() => setDepartmentFilter(d.id)}
                        className={cn(
                          departmentFilter === d.id && "bg-accent",
                          "flex justify-between",
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Building2 className="size-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate">{d.name}</span>
                        </div>
                        {departmentFilter === d.id && (
                          <Check className="ml-2 size-3.5 shrink-0" />
                        )}
                      </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5 h-8">
                    <Filter className="size-3.5" />
                    Status
                    <ChevronDown className="size-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuLabel>Filter by status</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {(["all", "active", "archived"] as const).map((st) => (
                    <DropdownMenuItem
                      key={st}
                      onClick={() => setStatusFilter(st)}
                      className={cn(statusFilter === st && "bg-accent")}
                    >
                      {st === "all"
                        ? "All"
                        : st.charAt(0).toUpperCase() + st.slice(1)}
                      {statusFilter === st && (
                        <Check className="ml-2 size-3.5" />
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5 h-8">
                    <ArrowUpDown className="size-3.5" />
                    Sort
                    <ChevronDown className="size-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {(
                    [
                      ["name", "Name"],
                      ["createdAt", "Created"],
                      ["maxTicketsPerAgent", "Max Capacity"],
                    ] as [SortBy, string][]
                  ).map(([key, label]) => (
                    <DropdownMenuItem
                      key={key}
                      onClick={() => toggleSort(key)}
                      className={cn(
                        sortBy === key && "bg-accent",
                        "flex justify-between items-center",
                      )}
                    >
                      <span>{label}</span>
                      {sortBy === key && (
                        <span className="text-xs text-muted-foreground">
                          {sortDir === "asc" ? "Asc" : "Desc"}
                        </span>
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {hasActiveFilters && (
              <>
                <div className="h-6 w-px bg-border" />
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground">
                    Active filters:
                  </span>
                  {searchQuery && (
                    <Badge
                      variant="secondary"
                      className="gap-1 h-5 text-xs cursor-pointer hover:bg-muted"
                      onClick={() => setSearchQuery("")}
                    >
                      <Search className="size-3" />
                      {searchQuery.length > 20
                        ? searchQuery.slice(0, 20) + "…"
                        : searchQuery}
                      <X className="size-3" />
                    </Badge>
                  )}
                  {departmentFilter !== "all" && (
                    <Badge
                      variant="secondary"
                      className="gap-1 h-5 text-xs cursor-pointer hover:bg-muted"
                      onClick={() => setDepartmentFilter("all")}
                    >
                      <Building2 className="size-3" />
                      Dept: {getDeptById(departmentFilter)?.name?.slice(0, 12) ?? "?"}
                      <X className="size-3" />
                    </Badge>
                  )}
                  {statusFilter !== "all" && (
                    <Badge
                      variant="secondary"
                      className="gap-1 h-5 text-xs cursor-pointer hover:bg-muted"
                      onClick={() => setStatusFilter("all")}
                    >
                      Status: {statusFilter}
                      <X className="size-3" />
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 text-xs text-muted-foreground hover:text-foreground"
                    onClick={clearFilters}
                  >
                    Clear all
                  </Button>
                </div>
              </>
            )}
          </>
        }
        columns={[
          {
            key: "name",
            header: "Team",
            cell: (t) => (
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid size-9 shrink-0 place-items-center rounded-md bg-info/15 text-info">
                  <Users className="size-4" />
                </div>
                <div className="min-w-0" onClick={() => openPreview(t)}>
                  <span className="truncate text-sm font-medium cursor-pointer">
                    {t.name}
                  </span>
                  {t.skillSpecialization && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <Gauge className="size-3 text-muted-foreground shrink-0" />
                      <span className="text-[11px] text-muted-foreground truncate">
                        {t.skillSpecialization}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ),
          },
          {
            key: "department",
            header: "Department",
            cell: (t) => {
              const dept = t.department ?? getDeptById(t.departmentId);
              if (!dept)
                return (
                  <span className="text-xs text-muted-foreground italic">
                    —
                  </span>
                );
              return (
                <div className="flex items-center gap-2 min-w-0">
                  <div className="grid size-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                    <Building2 className="size-3.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-medium truncate">
                      {dept.name}
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono truncate">
                      {dept.key}
                    </div>
                  </div>
                </div>
              );
            },
          },
          {
            key: "lead",
            header: "Lead",
            cell: (t) => {
              const lead = t.lead;
              if (!lead)
                return (
                  <span className="text-xs text-muted-foreground italic">
                    Unassigned
                  </span>
                );
              return (
                <div className="flex items-center gap-2 min-w-0">
                  <Avatar className="size-7 shrink-0">
                    <AvatarImage src={lead.avatar ?? ""} />
                    <AvatarFallback className="text-[10px] bg-muted text-muted-foreground">
                      {lead.name?.[0]?.toUpperCase() ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex items-center gap-1">
                    <Crown className="size-3 text-warning shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs font-medium truncate">
                        {lead.name}
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate">
                        {lead.email}
                      </div>
                    </div>
                  </div>
                </div>
              );
            },
          },
          {
            key: "members",
            header: "Capacity",
            cell: (t) => {
              const members =
                (t._count as any)?.members ??
                (t._count as any)?.agents ??
                0;
              return (
                <div className="space-y-1 min-w-[140px]">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Users className="size-3" />
                      Agents
                    </span>
                    <span className="font-medium tabular-nums">
                      {members}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Ticket className="size-3" />
                      Max / Agent
                    </span>
                    <span className="font-medium tabular-nums">
                      {t.maxTicketsPerAgent}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Gauge className="size-3" />
                      Concurrent
                    </span>
                    <span className="font-medium tabular-nums">
                      {t.concurrentTicketLimitPerAgent}
                    </span>
                  </div>
                </div>
              );
            },
          },
          {
            key: "sla",
            header: "SLA",
            cell: (t) => {
              const inherited = t.slaInheritFromDept;
              const hasCustomSla =
                !t.slaInheritFromDept &&
                (t.firstResponseSlaMinutes ?? t.resolutionSlaMinutes);
              return (
                <div className="space-y-1">
                  <Badge
                    variant={inherited ? "outline" : "secondary"}
                    className="text-[10px] rounded-sm"
                  >
                    {inherited ? "Inherit" : "Custom"}
                  </Badge>
                  {hasCustomSla && (
                    <div className="text-[10px] text-muted-foreground tabular-nums">
                      {t.firstResponseSlaMinutes
                        ? `${t.firstResponseSlaMinutes}m response`
                        : ""}
                      {t.resolutionSlaMinutes
                        ? ` · ${t.resolutionSlaMinutes}m res`
                        : ""}
                    </div>
                  )}
                </div>
              );
            },
          },
          {
            key: "status",
            header: "Status",
            cell: (t) =>
              t.deletedAt ? (
                <StatusBadge status="archived" />
              ) : t.isActive ? (
                <StatusBadge status="active" />
              ) : (
                <StatusBadge status="paused" />
              ),
          },
          {
            key: "created",
            header: "Created",
            cell: (t) => (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-xs text-muted-foreground cursor-help whitespace-nowrap">
                    {formatDistanceToNow(new Date(t.createdAt), {
                      addSuffix: true,
                    })}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {format(new Date(t.createdAt), "PPP p")}
                </TooltipContent>
              </Tooltip>
            ),
          },
        ]}
        renderRowActions={(t) => (
          <div className="flex items-center justify-end gap-0.5">
            {/* ─── Quick Actions ─── */}
            {t.deletedAt ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 hover:text-success"
                    onClick={() => openRestore(t)}
                  >
                    <Undo2 className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Restore</TooltipContent>
              </Tooltip>
            ) : (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 hover:text-info"
                      onClick={() => openPreview(t)}
                    >
                      <Eye className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Quick view</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 hover:text-warning"
                      onClick={() => openAssignLead(t)}
                    >
                      <Crown className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {t.lead ? "Change lead" : "Assign lead"}
                  </TooltipContent>
                </Tooltip>
              </>
            )}

            {/* ─── Ellipsis Menu (consolidated actions) ─── */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground hover:text-foreground"
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />

                {/* View Actions */}
                <DropdownMenuItem className=" cursor-pointer" onClick={
                  ()=>navigate({to:`/support/teams/${t.id}`, })
                }>
                    <Eye className="mr-2 size-3.5" />
                    Full Details
                </DropdownMenuItem>

                {/* Leadership Actions */}
                {!t.deletedAt && (
                  <DropdownMenuItem onClick={() => openAssignLead(t)}>
                    <Crown className="mr-2 size-3.5" />
                    {t.lead ? "Change Lead" : "Assign Lead"}
                  </DropdownMenuItem>
                )}

                <DropdownMenuSeparator />

                {/* Edit Actions */}
                {!t.deletedAt && (
                  <DropdownMenuItem onClick={() => openEdit(t)}>
                    <Pencil className="mr-2 size-3.5" />
                    Edit
                  </DropdownMenuItem>
                )}

                {/* Status Actions */}
                {!t.deletedAt ? (
                  <>
                    <DropdownMenuItem onClick={() => openArchive(t)} className="text-warning">
                      <Archive className="mr-2 size-3.5" />
                      Archive
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openDelete(t)} className="text-destructive">
                      <Trash2 className="mr-2 size-3.5" />
                      Delete Permanently
                    </DropdownMenuItem>
                  </>
                ) : (
                  <>
                    <DropdownMenuItem onClick={() => openRestore(t)} className="text-success">
                      <Undo2 className="mr-2 size-3.5" />
                      Restore
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openDelete(t)} className="text-destructive">
                      <Trash2 className="mr-2 size-3.5" />
                      Delete Permanently
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      />
    </div>
  );
}
