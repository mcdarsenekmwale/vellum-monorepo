// routes/_app/support/departments.tsx

import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Building2,
  Users,
  Ticket,
  Clock,
  Target,
  Plus,
  Pencil,
  Trash2,
  Archive,
  RefreshCw,
  Undo2,
  Download,
  Loader2,
  Search,
  ChevronDown,
  ArrowUpDown,
  Mail,
  Check,
  X,
  Filter,
  Eye,
  Crown,
  UserPlus,
  UserMinus,
  MoreHorizontal,
  AlertCircle,
  Shield,
  ClipboardList,
  UsersRound,
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
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useSupportDepartments,
  useSupportTeams,
  useSupportAgents,
  useCreateSupportDepartment,
  useUpdateSupportDepartment,
  useDeleteSupportDepartment,
  useRestoreSupportDepartment,
  useSupportDepartmentScorecard,
  useAssignDepartmentHead,
  useRemoveDepartmentHead,
  useAssignTeamLead,
  useRemoveTeamLead,
  useBulkAssignTeamLeads,
  useBulkRemoveTeamLeads,
  type SupportDepartment,
} from "@/lib/api/hooks";
import { useAuth } from "@/lib/auth/context";
import { can } from "@/lib/auth/rbac";
import { getSupportTicketsReportCsvUrl } from "@/lib/api/services";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_app/support/departments/")({
  head: () => ({ meta: [{ title: "Support Departments · Vellbase Admin" }] }),
  component: DepartmentsPage,
});

type StatusFilter = "all" | "active" | "archived";
type SortBy =
  | "name"
  | "createdAt"
  | "firstResponseSlaMinutes"
  | "slaAdherenceTargetPct";
type SortDir = "asc" | "desc";

// ─── Department Quick Preview Sheet ───

function DepartmentPreviewSheet({
  department,
  open,
  onOpenChange,
  onAssignLead,
}: {
  department: SupportDepartment | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAssignLead: () => void;
}) {
  const [activeTab, setActiveTab] = useState("overview");

  const { data: teams } = useSupportTeams({
    departmentId: department?.id,
    limit: 50,
  });

  const { data: agents } = useSupportAgents({
    departmentId: department?.id,
    limit: 50,
  });

  if (!department) return null;

  const teamCount = teams?.data?.length ?? 0;
  const agentCount = agents?.data?.length ?? 0;
  const head = department.head;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <div className="grid size-12 place-items-center rounded-lg bg-primary/10 text-primary">
              <Building2 className="size-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <SheetTitle className="text-lg font-semibold truncate">
                  {department.name}
                </SheetTitle>
                <Badge variant="outline" className="font-mono text-[10px]">
                  {department.key}
                </Badge>
              </div>
              <SheetDescription className="flex items-center gap-2 text-xs">
                <Clock className="size-3" />
                Created {formatDistanceToNow(new Date(department.createdAt), { addSuffix: true })}
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
            <TabsTrigger value="teams" className="gap-1.5">
              <Users className="size-3.5" />
              Teams ({teamCount})
            </TabsTrigger>
            <TabsTrigger value="agents" className="gap-1.5">
              <UserPlus className="size-3.5" />
              Agents ({agentCount})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4 space-y-4">
            {/* Department Head */}
            <div className="rounded-lg border p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Crown className="size-3.5" />
                  Department Head
                </span>
                {!head && (
                  <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={onAssignLead}>
                    <UserPlus className="size-3" />
                    Assign
                  </Button>
                )}
              </div>
              {head ? (
                <div className="flex items-center gap-3">
                  <Avatar className="size-9">
                    <AvatarImage src={head.avatar ?? ""} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {head.name?.[0]?.toUpperCase() ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{head.name}</p>
                    <p className="text-xs text-muted-foreground">{head.email}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">No department head assigned</p>
              )}
            </div>

            {/* SLA Metrics */}
            <div className="rounded-lg border p-4">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Target className="size-3.5" />
                SLA Configuration
              </span>
              <div className="mt-3 grid grid-cols-3 gap-3">
                <div className="text-center">
                  <div className="text-sm font-medium tabular-nums">
                    {department.firstResponseSlaMinutes}m
                  </div>
                  <div className="text-[10px] text-muted-foreground">Response SLA</div>
                </div>
                <div className="text-center">
                  <div className="text-sm font-medium tabular-nums">
                    {department.resolutionSlaMinutes}m
                  </div>
                  <div className="text-[10px] text-muted-foreground">Resolution SLA</div>
                </div>
                <div className="text-center">
                  <div className="text-sm font-medium tabular-nums">
                    {department.slaAdherenceTargetPct}%
                  </div>
                  <div className="text-[10px] text-muted-foreground">Target</div>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg border p-3 text-center">
                <div className="text-lg font-bold">{teamCount}</div>
                <div className="text-[10px] text-muted-foreground">Teams</div>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <div className="text-lg font-bold">{agentCount}</div>
                <div className="text-[10px] text-muted-foreground">Agents</div>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <div className="text-lg font-bold">
                  {department.isActive ? "Active" : "Inactive"}
                </div>
                <div className="text-[10px] text-muted-foreground">Status</div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="teams" className="mt-4">
            {teamCount === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Users className="size-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground mt-2">No teams in this department</p>
              </div>
            ) : (
              <div className="space-y-2">
                {teams?.data?.map((team) => (
                  <div key={team.id} className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/30">
                    <div className="grid size-8 place-items-center rounded-md bg-primary/10 text-primary">
                      <Users className="size-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{team.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {team.skillSpecialization || "General"}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {team.maxTicketsPerAgent} max
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="agents" className="mt-4">
            {agentCount === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <UserPlus className="size-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground mt-2">No agents in this department</p>
              </div>
            ) : (
              <div className="space-y-2">
                {agents?.data?.map((agent) => (
                  <div key={agent.id} className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/30">
                    <Avatar className="size-8">
                      <AvatarImage src={agent.user?.avatar ?? ""} />
                      <AvatarFallback className="text-[10px]">
                        {agent.user?.name?.[0]?.toUpperCase() ?? "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{agent.user?.name}</p>
                      <p className="text-xs text-muted-foreground">{agent.user?.email}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {agent.activeTickets} active
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <SheetFooter className="border-t pt-4 mt-4">
          <div className="flex items-center justify-between w-full">
            <span className="text-xs text-muted-foreground">
              ID: {department.id.slice(0, 8)}...
            </span>
            <Button variant="outline" size="sm" asChild>
              <Link to="/support/departments/$departmentId" params={{ departmentId: department.id }}>
                <Eye className="size-3.5 mr-1.5" />
                Full Details
              </Link>
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ─── Assign Head Dialog ───

export function AssignHeadDialog({
  department,
  open,
  onOpenChange,
  onAssign,
  onRemove,
}: {
  department: SupportDepartment | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAssign: (departmentId: string, agentId: string) => void;
  onRemove: (departmentId: string) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: agents, isLoading } = useSupportAgents({
    search: searchQuery || undefined,
    limit: 50,
  });

  const handleAssign = () => {
    try {
      setIsSubmitting(true);
      if (!department || !selectedAgentId) return;
      onAssign(department.id, selectedAgentId);
    } finally {
      setSelectedAgentId("");
      setIsSubmitting(false);
      onOpenChange(false);
    }
   };

  const handleRemove = () => {
    if (!department) return;
    onRemove(department.id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="size-5 text-primary" />
            {department?.head ? "Change" : "Assign"} Department Head
          </DialogTitle>
          <DialogDescription>
            {department?.head
              ? `Replace ${department.head.name} as the head of ${department.name}.`
              : `Select an agent to lead ${department?.name}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
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

          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto rounded-md border divide-y">
              {agents?.data?.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No agents found
                </div>
              ) : (
                agents?.data?.map((agent) => (
                  <button
                    key={agent.id}
                    onClick={() => setSelectedAgentId(agent.userId || agent.user.id || agent.id)}
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

          {department?.head && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
              <p className="text-sm text-destructive flex items-center gap-2">
                <AlertCircle className="size-4" />
                Current head: {department.head.name}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {department?.head && (
            <Button variant="destructive" onClick={handleRemove}>
              Remove Head
            </Button>
          )}
          <Button onClick={handleAssign} disabled={!selectedAgentId || isSubmitting}>
            {
              isSubmitting ? "Assigning..." : `${department?.head ? "Replace" : "Assign"} Head`
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Team Lead Management Dialog ───

export function TeamLeadManagementDialog({
  department,
  open,
  onOpenChange,
  onAssignLead,
  onRemoveLead,
  onBulkAssign,
  onBulkRemove,
  canManage,
}: {
  department: SupportDepartment | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAssignLead: (teamId: string, userId: string) => void;
  onRemoveLead: (teamId: string) => void;
  onBulkAssign: (assignments: Array<{ teamId: string; userId: string }>) => void;
  onBulkRemove: (teamIds: string[]) => void;
  canManage: boolean;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [selectedTeamIds, setSelectedTeamIds] = useState<Set<string>>(new Set());
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);

  const { data: teamsData, isLoading: teamsLoading } = useSupportTeams({
    departmentId: department?.id,
    limit: 100,
  });

  const { data: agentsData, isLoading: agentsLoading } = useSupportAgents({
    search: searchQuery || undefined,
    departmentId: department?.id,
    limit: 50,
  });

  const teams = teamsData?.data ?? [];
  const agents = agentsData?.data ?? [];

  const toggleTeamSelection = (teamId: string) => {
    setSelectedTeamIds((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) next.delete(teamId);
      else next.add(teamId);
      return next;
    });
  };

  const handleAssignToSelected = () => {
    if (!selectedAgentId || selectedTeamIds.size === 0) return;
    const assignments = Array.from(selectedTeamIds).map((teamId) => ({
      teamId,
      userId: selectedAgentId,
    }));
    onBulkAssign(assignments);
    setSelectedTeamIds(new Set());
    setSelectedAgentId("");
  };

  const handleRemoveFromSelected = () => {
    if (selectedTeamIds.size === 0) return;
    onBulkRemove(Array.from(selectedTeamIds));
    setSelectedTeamIds(new Set());
  };

  const handleAssignSingle = (teamId: string, userId: string) => {
    onAssignLead(teamId, userId);
    setActiveTeamId(null);
    setSelectedAgentId("");
  };

  const handleRemoveSingle = (teamId: string) => {
    onRemoveLead(teamId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UsersRound className="size-5 text-primary" />
            Team Lead Management
          </DialogTitle>
          <DialogDescription>
            Assign or remove team leads for {department?.name ?? "department"}.
            Select multiple teams for bulk operations.
          </DialogDescription>
        </DialogHeader>

        {!canManage && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
            <p className="text-sm text-destructive flex items-center gap-2">
              <Shield className="size-4" />
              You do not have permission to manage team leads.
            </p>
          </div>
        )}

        <div className="space-y-4 py-2">
          {/* Agent search */}
          <div className="space-y-2">
            <Label>Select Agent for Assignment</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search agents..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                disabled={!canManage}
              />
            </div>
            {agentsLoading && (
              <div className="flex justify-center py-2">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              </div>
            )}
            {!agentsLoading && agents.length > 0 && (
              <div className="max-h-32 overflow-y-auto rounded-md border divide-y">
                {agents.map((agent) => (
                  <button
                    key={agent.id}
                    onClick={() => canManage && setSelectedAgentId(agent.id)}
                    disabled={!canManage}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-muted/50 disabled:opacity-50",
                      selectedAgentId === agent.id && "bg-primary/10"
                    )}
                  >
                    <Avatar className="size-6">
                      <AvatarImage src={agent.user?.avatar ?? ""} />
                      <AvatarFallback className="text-[10px]">
                        {agent.user?.name?.[0]?.toUpperCase() ?? "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{agent.user?.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{agent.user?.email}</p>
                    </div>
                    {selectedAgentId === agent.id && (
                      <Check className="size-3.5 text-primary shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Bulk actions */}
          {selectedTeamIds.size > 0 && (
            <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-2">
              <span className="text-xs text-muted-foreground">
                {selectedTeamIds.size} team{selectedTeamIds.size === 1 ? "" : "s"} selected
              </span>
              <div className="flex-1" />
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1 text-xs"
                onClick={handleAssignToSelected}
                disabled={!canManage || !selectedAgentId}
              >
                <UserPlus className="size-3" />
                Assign Lead
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1 text-xs text-destructive"
                onClick={handleRemoveFromSelected}
                disabled={!canManage}
              >
                <UserMinus className="size-3" />
                Remove Leads
              </Button>
            </div>
          )}

          {/* Teams list */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Teams ({teams.length})</Label>
              {teamsLoading && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
            </div>
            {teams.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <Users className="size-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground mt-2">No teams in this department</p>
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto rounded-md border divide-y">
                {teams.map((team) => (
                  <div key={team.id} className="flex items-center gap-2 px-3 py-2.5">
                    <Checkbox
                      checked={selectedTeamIds.has(team.id)}
                      onCheckedChange={() => canManage && toggleTeamSelection(team.id)}
                      disabled={!canManage}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{team.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {(team._count as any)?.agents ?? (team._count as any)?.members ?? 0} agents · {team.skillSpecialization ?? "General"}
                      </p>
                    </div>
                    {team.lead ? (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Avatar className="size-5">
                            <AvatarImage src={team.lead.avatar ?? ""} />
                            <AvatarFallback className="text-[9px]">
                              {team.lead.name?.[0]?.toUpperCase() ?? "?"}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs truncate max-w-[100px]">{team.lead.name}</span>
                        </div>
                        {canManage && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-6 hover:text-destructive"
                                onClick={() => handleRemoveSingle(team.id)}
                              >
                                <X className="size-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Remove lead</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        {activeTeamId === team.id && selectedAgentId ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 text-xs gap-1"
                              onClick={() => handleAssignSingle(team.id, selectedAgentId)}
                            >
                              <Check className="size-3" />
                              Assign
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 text-xs"
                              onClick={() => setActiveTeamId(null)}
                            >
                              Cancel
                            </Button>
                          </>
                        ) : (
                          canManage && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-xs gap-1 text-muted-foreground hover:text-primary"
                              onClick={() => setActiveTeamId(team.id)}
                              disabled={!selectedAgentId}
                            >
                              <UserPlus className="size-3" />
                              Assign
                            </Button>
                          )
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Leadership Report Dialog ───

export function LeadershipReportDialog({
  open,
  onOpenChange,
  departments,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  departments: SupportDepartment[];
}) {
  const allTeams = departments.flatMap((d) => d.teams ?? []);
  const filledHeads = departments.filter((d) => d.head).length;
  const filledLeads = allTeams.filter((t) => t.lead).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="size-5 text-primary" />
            Leadership Report
          </DialogTitle>
          <DialogDescription>
            Organization-wide overview of department heads and team leads.
          </DialogDescription>
        </DialogHeader>

        {/* Summary stats */}
        <div className="grid grid-cols-4 gap-3 py-2">
          <div className="rounded-lg border p-3 text-center">
            <div className="text-lg font-bold">{departments.length}</div>
            <div className="text-[10px] text-muted-foreground">Departments</div>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <div className="text-lg font-bold text-primary">{filledHeads}</div>
            <div className="text-[10px] text-muted-foreground">Heads Assigned</div>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <div className="text-lg font-bold text-primary">{filledLeads}</div>
            <div className="text-[10px] text-muted-foreground">Leads Assigned</div>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <div className="text-lg font-bold">{allTeams.length}</div>
            <div className="text-[10px] text-muted-foreground">Total Teams</div>
          </div>
        </div>

        {/* Department → Head → Teams/Leads tree */}
        <div className="space-y-3">
          {departments.map((dept) => (
            <div key={dept.id} className="rounded-lg border p-3">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="size-4 text-primary shrink-0" />
                <span className="text-sm font-medium">{dept.name}</span>
                <code className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                  {dept.key}
                </code>
              </div>

              {/* Department Head */}
              <div className="flex items-center gap-2 pl-6 pb-2">
                <Crown className="size-3.5 text-amber-500 shrink-0" />
                {dept.head ? (
                  <>
                    <Avatar className="size-5">
                      <AvatarImage src={dept.head.avatar ?? ""} />
                      <AvatarFallback className="text-[9px]">
                        {dept.head.name?.[0]?.toUpperCase() ?? "?"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs font-medium">{dept.head.name}</span>
                    <span className="text-[10px] text-muted-foreground">{dept.head.email}</span>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground italic">No head assigned</span>
                )}
              </div>

              {/* Teams and their leads */}
              {(dept.teams ?? []).length > 0 && (
                <div className="pl-6 space-y-1">
                  {(dept.teams ?? []).map((team) => (
                    <div key={team.id} className="flex items-center gap-2">
                      <Users className="size-3 text-muted-foreground shrink-0" />
                      <span className="text-xs">{team.name}</span>
                      {team.lead ? (
                        <div className="flex items-center gap-1 ml-2">
                          <Avatar className="size-4">
                            <AvatarImage src={team.lead.avatar ?? ""} />
                            <AvatarFallback className="text-[8px]">
                              {team.lead.name?.[0]?.toUpperCase() ?? "?"}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-[10px] text-muted-foreground">{team.lead.name}</span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-muted-foreground italic ml-2">
                          No lead
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ───

function DepartmentsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortBy, setSortBy] = useState<SortBy>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Sheet/Dialog states
  const [previewDept, setPreviewDept] = useState<SupportDepartment | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignDept, setAssignDept] = useState<SupportDepartment | null>(null);
  const [teamLeadOpen, setTeamLeadOpen] = useState(false);
  const [teamLeadDept, setTeamLeadDept] = useState<SupportDepartment | null>(null);
  const [leadershipReportOpen, setLeadershipReportOpen] = useState(false);

  // CRUD dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [isRestoreOpen, setIsRestoreOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<SupportDepartment | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Form state
  const [formKey, setFormKey] = useState("");
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formFirstResponseSla, setFormFirstResponseSla] = useState<number>(60);
  const [formResolutionSla, setFormResolutionSla] = useState<number>(1440);
  const [formSlaTarget, setFormSlaTarget] = useState<number>(95);

  // ── Data fetching ──
  const includeDeleted = statusFilter === "archived";
  const isActiveParam = statusFilter === "all" ? undefined : statusFilter === "active";

  const {
    data,
    isLoading,
    refetch,
  } = useSupportDepartments({
    page,
    limit: pageSize,
    search: searchQuery || undefined,
    isActive: isActiveParam,
    includeDeleted,
    sortBy,
    sortDir,
  });

  const { data: scorecard, isLoading: scorecardLoading } =
    useSupportDepartmentScorecard({ windowDays: 30 });

  const createDept = useCreateSupportDepartment();
  const updateDept = useUpdateSupportDepartment();
  const deleteDept = useDeleteSupportDepartment();
  const restoreDept = useRestoreSupportDepartment();
  const assignHead = useAssignDepartmentHead();
  const removeHead = useRemoveDepartmentHead();
  const assignLead = useAssignTeamLead();
  const removeLead = useRemoveTeamLead();
  const bulkAssignLeads = useBulkAssignTeamLeads();
  const bulkRemoveLeads = useBulkRemoveTeamLeads();

  // ── RBAC ──
  const { user } = useAuth();
  const canManageLeadership = can(user?.role as any, "support", "write");
  const canViewLeadershipReport = can(user?.role as any, "support", "read");

  const rows = data?.data ?? [];
  const total = data?.total ?? 0;

  // ── Stats ──
  const stats = useMemo(() => {
    if (!scorecard || scorecard.length === 0) {
      return {
        totalDepartments: total,
        avgSlaAdherence: 0,
        totalTickets: 0,
        avgCsat: 0,
      };
    }
    const totalTickets = scorecard.reduce(
      (sum, s) => sum + (s.metrics.totalTickets ?? 0),
      0,
    );
    const adherenceValues = scorecard
      .map((s) => s.metrics.slaResponseAdherencePct)
      .filter((v): v is number => v !== null);
    const csatValues = scorecard
      .map((s) => s.metrics.avgSatisfaction)
      .filter((v): v is number => v !== null);
    return {
      totalDepartments: total,
      avgSlaAdherence:
        adherenceValues.length > 0
          ? adherenceValues.reduce((a, b) => a + b, 0) / adherenceValues.length
          : 0,
      totalTickets,
      avgCsat:
        csatValues.length > 0
          ? csatValues.reduce((a, b) => a + b, 0) / csatValues.length
          : 0,
    };
  }, [scorecard, total]);

  // ── Handlers ──
  const clearFilters = useCallback(() => {
    setSearchQuery("");
    setStatusFilter("all");
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refetch();
      toast.success("Departments refreshed");
    } catch {
      toast.error("Failed to refresh departments");
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch]);

  const handleExportCsv = useCallback(() => {
    setIsExporting(true);
    try {
      const url = getSupportTicketsReportCsvUrl();
      const link = document.createElement("a");
      link.href = url;
      link.download = `support-tickets-report-${format(new Date(), "yyyy-MM-dd-HHmmss")}.csv`;
      link.target = "_blank";
      link.click();
      toast.success("CSV export initiated");
    } catch {
      toast.error("Failed to export CSV");
    } finally {
      setIsExporting(false);
    }
  }, []);

  const resetForm = () => {
    setFormKey("");
    setFormName("");
    setFormDescription("");
    setFormEmail("");
    setFormFirstResponseSla(60);
    setFormResolutionSla(1440);
    setFormSlaTarget(95);
  };

  const openPreview = (dept: SupportDepartment) => {
    setPreviewDept(dept);
    setPreviewOpen(true);
  };

  const openAssignHead = (dept: SupportDepartment) => {
    if (!canManageLeadership) {
      toast.error("You do not have permission to manage department heads");
      return;
    }
    setAssignDept(dept);
    setAssignOpen(true);
  };

  const handleAssignHead = (departmentId: string, agentId: string) => {
    if (!canManageLeadership) {
      toast.error("Permission denied");
      return;
    }
    assignHead.mutate(
      { departmentId, userId: agentId },
      {
        onSuccess: () => {
          toast.success("Department head assigned successfully");
          refetch();
        },
        onError: (error: any) => {
          toast.error("Failed to assign department head: " + (error?.message ?? "Unknown error"));
        },
      }
    );
  };

  const handleRemoveHead = (departmentId: string) => {
    if (!canManageLeadership) {
      toast.error("Permission denied");
      return;
    }
    removeHead.mutate(
      { departmentId },
      {
        onSuccess: () => {
          toast.success("Department head removed");
          refetch();
        },
        onError: (error: any) => {
          toast.error("Failed to remove department head: " + (error?.message ?? "Unknown error"));
        },
      }
    );
  };

  const openTeamLeads = (dept: SupportDepartment) => {
    setTeamLeadDept(dept);
    setTeamLeadOpen(true);
  };

  const handleAssignTeamLead = (teamId: string, userId: string) => {
    if (!canManageLeadership) {
      toast.error("Permission denied");
      return;
    }
    assignLead.mutate(
      { teamId, userId },
      {
        onSuccess: () => {
          toast.success("Team lead assigned successfully");
          refetch();
        },
        onError: (error: any) => {
          toast.error("Failed to assign team lead: " + (error?.message ?? "Unknown error"));
        },
      }
    );
  };

  const handleRemoveTeamLead = (teamId: string) => {
    if (!canManageLeadership) {
      toast.error("Permission denied");
      return;
    }
    removeLead.mutate(
      { teamId },
      {
        onSuccess: () => {
          toast.success("Team lead removed");
          refetch();
        },
        onError: (error: any) => {
          toast.error("Failed to remove team lead: " + (error?.message ?? "Unknown error"));
        },
      }
    );
  };

  const handleBulkAssignLeads = (assignments: Array<{ teamId: string; userId: string }>) => {
    if (!canManageLeadership) {
      toast.error("Permission denied");
      return;
    }
    bulkAssignLeads.mutate(assignments, {
      onSuccess: () => {
        toast.success(`Assigned lead to ${assignments.length} team${assignments.length === 1 ? "" : "s"}`);
        refetch();
      },
      onError: (error: any) => {
        toast.error("Failed to bulk assign team leads: " + (error?.message ?? "Unknown error"));
      },
    });
  };

  const handleBulkRemoveLeads = (teamIds: string[]) => {
    if (!canManageLeadership) {
      toast.error("Permission denied");
      return;
    }
    bulkRemoveLeads.mutate(teamIds, {
      onSuccess: () => {
        toast.success(`Removed leads from ${teamIds.length} team${teamIds.length === 1 ? "" : "s"}`);
        refetch();
      },
      onError: (error: any) => {
        toast.error("Failed to bulk remove team leads: " + (error?.message ?? "Unknown error"));
      },
    });
  };

  const openCreate = () => {
    resetForm();
    setIsCreateOpen(true);
  };

  const openEdit = (dept: SupportDepartment) => {
    setSelected(dept);
    setFormKey(dept.key);
    setFormName(dept.name);
    setFormDescription(dept.description ?? "");
    setFormEmail(dept.email ?? "");
    setFormFirstResponseSla(dept.firstResponseSlaMinutes);
    setFormResolutionSla(dept.resolutionSlaMinutes);
    setFormSlaTarget(dept.slaAdherenceTargetPct);
    setIsEditOpen(true);
  };

  const openArchive = (dept: SupportDepartment) => {
    setSelected(dept);
    setIsArchiveOpen(true);
  };

  const openRestore = (dept: SupportDepartment) => {
    setSelected(dept);
    setIsRestoreOpen(true);
  };

  const openDelete = (dept: SupportDepartment) => {
    setSelected(dept);
    setIsDeleteOpen(true);
  };

  const handleCreate = useCallback(() => {
    if (!formKey.trim() || !formName.trim()) {
      toast.error("Key and name are required");
      return;
    }

    createDept.mutate(
      {
        key: formKey.trim(),
        name: formName.trim(),
        description: formDescription.trim() || null,
        email: formEmail.trim() || null,
        firstResponseSlaMinutes: formFirstResponseSla,
        resolutionSlaMinutes: formResolutionSla,
        slaAdherenceTargetPct: formSlaTarget,
      },
      {
        onSuccess: () => {
          setIsCreateOpen(false);
          resetForm();
          refetch();
          toast.success("Department created successfully");
        },
        onError: (error) => {
          toast.error(
            "Failed to create department: " +
              ((error as any)?.message ?? "Unknown error"),
          );
        },
      },
    );
  }, [
    formKey,
    formName,
    formDescription,
    formEmail,
    formFirstResponseSla,
    formResolutionSla,
    formSlaTarget,
    createDept,
    refetch,
  ]);

  const handleUpdate = useCallback(() => {
    if (!selected) return;
    if (!formName.trim()) {
      toast.error("Name is required");
      return;
    }

    updateDept.mutate(
      {
        id: selected.id,
        data: {
          name: formName.trim(),
          description: formDescription.trim() || null,
          email: formEmail.trim() || null,
          firstResponseSlaMinutes: formFirstResponseSla,
          resolutionSlaMinutes: formResolutionSla,
          slaAdherenceTargetPct: formSlaTarget,
        },
      },
      {
        onSuccess: () => {
          setIsEditOpen(false);
          setSelected(null);
          resetForm();
          refetch();
          toast.success("Department updated successfully");
        },
        onError: (error) => {
          toast.error(
            "Failed to update department: " +
              ((error as any)?.message ?? "Unknown error"),
          );
        },
      },
    );
  }, [
    selected,
    formName,
    formDescription,
    formEmail,
    formFirstResponseSla,
    formResolutionSla,
    formSlaTarget,
    updateDept,
    refetch,
  ]);

  const handleArchive = useCallback(() => {
    if (!selected) return;

    deleteDept.mutate(selected.id, {
      onSuccess: () => {
        setIsArchiveOpen(false);
        setSelected(null);
        refetch();
        toast.success("Department archived");
      },
      onError: (error) => {
        toast.error(
          "Failed to archive department: " +
            ((error as any)?.message ?? "Unknown error"),
        );
      },
    });
  }, [selected, deleteDept, refetch]);

  const handleRestore = useCallback(() => {
    if (!selected) return;

    restoreDept.mutate(selected.id, {
      onSuccess: () => {
        setIsRestoreOpen(false);
        setSelected(null);
        refetch();
        toast.success("Department restored");
      },
      onError: (error) => {
        toast.error(
          "Failed to restore department: " +
            ((error as any)?.message ?? "Unknown error"),
        );
      },
    });
  }, [selected, restoreDept, refetch]);

  const handleDelete = useCallback(() => {
    if (!selected) return;

    deleteDept.mutate(selected.id, {
      onSuccess: () => {
        setIsDeleteOpen(false);
        setSelected(null);
        refetch();
        toast.success("Department permanently deleted");
      },
      onError: (error) => {
        toast.error(
          "Failed to delete department: " +
            ((error as any)?.message ?? "Unknown error"),
        );
      },
    });
  }, [selected, deleteDept, refetch]);

  const toggleSort = (key: SortBy) => {
    if (sortBy === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(key);
      setSortDir("asc");
    }
  };

  const renderHeader = () => (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mt-2 mb-6">
      <StatCard
        label="Departments"
        value={stats.totalDepartments.toLocaleString()}
        icon={Building2}
        tone="primary"
        loading={isLoading}
      />
      <StatCard
        label="Tickets (30d)"
        value={stats.totalTickets.toLocaleString()}
        icon={Ticket}
        tone="info"
        loading={scorecardLoading}
      />
      <StatCard
        label="Avg SLA Adherence"
        value={stats.avgSlaAdherence ? `${stats.avgSlaAdherence.toFixed(1)}%` : "—"}
        icon={Target}
        tone={stats.avgSlaAdherence >= 90 ? "success" : stats.avgSlaAdherence >= 70 ? "warning" : "destructive"}
        loading={scorecardLoading}
      />
      <StatCard
        label="Avg CSAT"
        value={stats.avgCsat ? stats.avgCsat.toFixed(2) : "—"}
        icon={Users}
        tone="success"
        loading={scorecardLoading}
      />
    </div>
  );

  const hasActiveFilters = searchQuery || statusFilter !== "all";

  return (
    <div className="space-y-6">
      {/* ─── Dialogs ─── */}
      
      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="size-5 text-primary" />
              Create Department
            </DialogTitle>
            <DialogDescription>
              Create a new support department to organize teams and routing.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="dept-key">
                  Key <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="dept-key"
                  placeholder="e.g. billing"
                  value={formKey}
                  onChange={(e) => setFormKey(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dept-name">
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="dept-name"
                  placeholder="e.g. Billing Support"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dept-email">Contact Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="dept-email"
                  type="email"
                  className="pl-9"
                  placeholder="support@example.com"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dept-desc">Description</Label>
              <Textarea
                id="dept-desc"
                rows={2}
                placeholder="Short description of the department's purpose"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="dept-frst-sla">
                  1st Response SLA (min)
                </Label>
                <Input
                  id="dept-frst-sla"
                  type="number"
                  min={1}
                  value={formFirstResponseSla}
                  onChange={(e) =>
                    setFormFirstResponseSla(
                      parseInt(e.target.value || "0", 10),
                    )
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dept-res-sla">
                  Resolution SLA (min)
                </Label>
                <Input
                  id="dept-res-sla"
                  type="number"
                  min={1}
                  value={formResolutionSla}
                  onChange={(e) =>
                    setFormResolutionSla(
                      parseInt(e.target.value || "0", 10),
                    )
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dept-sla-tgt">
                  SLA Target (%)
                </Label>
                <Input
                  id="dept-sla-tgt"
                  type="number"
                  min={0}
                  max={100}
                  value={formSlaTarget}
                  onChange={(e) =>
                    setFormSlaTarget(parseInt(e.target.value || "0", 10))
                  }
                />
              </div>
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
              disabled={createDept.isPending || !formKey.trim() || !formName.trim()}
              className="gap-1.5"
            >
              {createDept.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              {createDept.isPending ? "Creating..." : "Create Department"}
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
              Edit Department
            </DialogTitle>
            <DialogDescription>
              Update department details and SLA configuration.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Key</Label>
                <div className="rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground font-mono">
                  {selected?.key}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-dept-name">
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="edit-dept-name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-dept-email">Contact Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="edit-dept-email"
                  type="email"
                  className="pl-9"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-dept-desc">Description</Label>
              <Textarea
                id="edit-dept-desc"
                rows={2}
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="edit-dept-frst-sla">
                  1st Response SLA (min)
                </Label>
                <Input
                  id="edit-dept-frst-sla"
                  type="number"
                  min={1}
                  value={formFirstResponseSla}
                  onChange={(e) =>
                    setFormFirstResponseSla(
                      parseInt(e.target.value || "0", 10),
                    )
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-dept-res-sla">
                  Resolution SLA (min)
                </Label>
                <Input
                  id="edit-dept-res-sla"
                  type="number"
                  min={1}
                  value={formResolutionSla}
                  onChange={(e) =>
                    setFormResolutionSla(
                      parseInt(e.target.value || "0", 10),
                    )
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-dept-sla-tgt">
                  SLA Target (%)
                </Label>
                <Input
                  id="edit-dept-sla-tgt"
                  type="number"
                  min={0}
                  max={100}
                  value={formSlaTarget}
                  onChange={(e) =>
                    setFormSlaTarget(parseInt(e.target.value || "0", 10))
                  }
                />
              </div>
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
              disabled={updateDept.isPending || !formName.trim()}
              className="gap-1.5"
            >
              {updateDept.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              {updateDept.isPending ? "Saving..." : "Save Changes"}
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
              Archive Department
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to archive <strong>{selected?.name}</strong>?
              The department will no longer appear in active lists but can be
              restored later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsArchiveOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleArchive}
              disabled={deleteDept.isPending}
              className="gap-1.5"
            >
              {deleteDept.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Archive className="size-4" />
              )}
              {deleteDept.isPending ? "Archiving..." : "Archive"}
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
              Restore Department
            </DialogTitle>
            <DialogDescription>
              Restore <strong>{selected?.name}</strong> to active status? Teams
              and routing will resume normal operation.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsRestoreOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleRestore}
              disabled={restoreDept.isPending}
              className="gap-1.5"
            >
              {restoreDept.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Undo2 className="size-4" />
              )}
              {restoreDept.isPending ? "Restoring..." : "Restore"}
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
                <strong>{selected?.name}</strong> will be permanently removed
                along with all associated configuration.
              </p>
              <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive">
                Deleting a department may break routing rules assigned to its
                teams.
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
              disabled={deleteDept.isPending}
              className="gap-1.5"
            >
              {deleteDept.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              {deleteDept.isPending ? "Deleting..." : "Delete Permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Head Dialog */}
      <AssignHeadDialog
        department={assignDept}
        open={assignOpen}
        onOpenChange={setAssignOpen}
        onAssign={handleAssignHead}
        onRemove={handleRemoveHead}
      />

      {/* Team Lead Management Dialog */}
      <TeamLeadManagementDialog
        department={teamLeadDept}
        open={teamLeadOpen}
        onOpenChange={setTeamLeadOpen}
        onAssignLead={handleAssignTeamLead}
        onRemoveLead={handleRemoveTeamLead}
        onBulkAssign={handleBulkAssignLeads}
        onBulkRemove={handleBulkRemoveLeads}
        canManage={canManageLeadership}
      />

      {/* Leadership Report Dialog */}
      <LeadershipReportDialog
        open={leadershipReportOpen}
        onOpenChange={setLeadershipReportOpen}
        departments={rows}
      />

      {/* Department Preview Sheet */}
        <DepartmentPreviewSheet
        department={previewDept}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        onAssignLead={() => openAssignHead(previewDept!)}
      />



      <ListPage
        title="Support Departments"
        description="Organize support teams by function, set SLA targets, and manage routing scope."
        eyebrow="Support Organization"
        rows={rows}
        searchKeys={["name", "key", "description", "email"]}
        pageSize={pageSize}
        isLoading={isLoading}
        enableSelection={false}
        enablePagination={false}
        searchPlaceholder="Search departments..."
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

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={handleExportCsv}
                  disabled={isExporting}
                >
                  {isExporting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Download className="size-4" />
                  )}
                  <span className="hidden sm:inline">
                    {isExporting ? "Exporting..." : "Export CSV"}
                  </span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Export tickets report CSV</TooltipContent>
            </Tooltip>

            {canViewLeadershipReport && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setLeadershipReportOpen(true)}
                  >
                    <ClipboardList className="size-4" />
                    <span className="hidden sm:inline">Leadership Report</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>View all department heads and team leads</TooltipContent>
              </Tooltip>
            )}

            <Button size="sm" className="gap-1.5" onClick={openCreate}>
              <Plus className="size-4" />
              <span className="hidden sm:inline">New Department</span>
              <span className="sm:hidden">New</span>
            </Button>
          </div>
        }
        renderHeader={renderHeader()}
        filters={
          <>
            <div className="flex items-center gap-2">
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
                      [
                        "firstResponseSlaMinutes",
                        "1st Response SLA",
                      ],
                      [
                        "slaAdherenceTargetPct",
                        "SLA Target",
                      ],
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
            header: "Department",
            cell: (d) => (
              <button
                onClick={() => openPreview(d)}
                className="flex min-w-0 items-center gap-3 hover:opacity-80 transition-opacity"
              >
                <div className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                  <Building2 className="size-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">
                      {d.name?.substring(0, 18) ?? "…"}
                    </span>
                    <code className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                      {d.key}
                    </code>
                  </div>
                  {d.email && (
                    <div className="truncate text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Mail className="size-3" />
                      {d.email}
                    </div>
                  )}
                </div>
              </button>
            ),
          },
          {
            key: "head",
            header: "Head",
            cell: (d) => {
              const head = d.head;
              if (!head)
                return (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 text-xs text-muted-foreground hover:text-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      openAssignHead(d);
                    }}
                  >
                    <UserPlus className="size-3" />
                    Assign Head
                  </Button>
                );
              return (
                <div className="flex items-center gap-2 min-w-0">
                  <Avatar className="size-7 shrink-0">
                    <AvatarImage src={head.avatar ?? ""} />
                    <AvatarFallback className="text-[10px] bg-muted text-muted-foreground">
                      {head.name?.[0]?.toUpperCase() ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="text-xs font-medium truncate">
                      {head.name}
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      {head.email}
                    </div>
                  </div>
                </div>
              );
            },
          },
          {
            key: "teams",
            header: "Teams",
            cell: (d) => {
              const teamCount = d._count?.teams ?? d.teams?.length ?? 0;
              const agentCount = d._count?.agents ?? 0;
              return (
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="text-xs rounded-sm gap-1">
                    <Users className="size-3" />
                    {teamCount} team{teamCount === 1 ? "" : "s"}
                  </Badge>
                  {agentCount > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {agentCount} agent{agentCount === 1 ? "" : "s"}
                    </span>
                  )}
                </div>
              );
            },
          },
          {
            key: "sla",
            header: "SLA Targets",
            cell: (d) => (
              <div className="space-y-1 min-w-[120px]">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Clock className="size-3" />
                    Response
                  </span>
                  <span className="font-medium tabular-nums">
                    {d.firstResponseSlaMinutes}m
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Target className="size-3" />
                    Adherence
                  </span>
                  <span className="font-medium tabular-nums">
                    {d.slaAdherenceTargetPct}%
                  </span>
                </div>
              </div>
            ),
          },
          {
            key: "status",
            header: "Status",
            cell: (d) => (
              d.deletedAt
                ? <StatusBadge status="archived" />
                : d.isActive
                ? <StatusBadge status="active" />
                : <StatusBadge status="paused" />
            ),
          },
          {
            key: "created",
            header: "Created",
            cell: (d) => (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-xs text-muted-foreground cursor-help whitespace-nowrap">
                    {formatDistanceToNow(new Date(d.createdAt), {
                      addSuffix: true,
                    })}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {format(new Date(d.createdAt), "PPP p")}
                </TooltipContent>
              </Tooltip>
            ),
          },
        ]}
        renderRowActions={(d) => (
          <div className="flex items-center justify-end gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 hover:text-primary"
                  onClick={() => openPreview(d)}
                >
                  <Eye className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Preview</TooltipContent>
            </Tooltip>

            {d.deletedAt ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 hover:text-success"
                    onClick={() => openRestore(d)}
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
                      className="size-8 hover:text-primary"
                      onClick={() => openEdit(d)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Edit</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 hover:text-warning"
                      onClick={() => openArchive(d)}
                    >
                      <Archive className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Archive</TooltipContent>
                </Tooltip>
              </>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground"
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>More actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => openPreview(d)}>
                  <Eye className="mr-2 size-3.5" /> Preview
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openAssignHead(d)}>
                  <Crown className="mr-2 size-3.5" /> {d.head ? "Change" : "Assign"} Head
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openTeamLeads(d)}>
                  <UsersRound className="mr-2 size-3.5" /> Manage Team Leads
                </DropdownMenuItem>
                {!d.deletedAt ? (
                  <>
                    <DropdownMenuItem onClick={() => openEdit(d)}>
                      <Pencil className="mr-2 size-3.5" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openArchive(d)} className="text-warning">
                      <Archive className="mr-2 size-3.5" /> Archive
                    </DropdownMenuItem>
                  </>
                ) : (
                  <DropdownMenuItem onClick={() => openRestore(d)} className="text-success">
                    <Undo2 className="mr-2 size-3.5" /> Restore
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => openDelete(d)}
                  className="text-destructive"
                >
                  <Trash2 className="mr-2 size-3.5" /> Delete Permanently
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      />
    </div>
  );
}