// routes/_app/support/agents.tsx

import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Users,
  Search,
  Plus,
  Pencil,
  Trash2,
  MoreVertical,
  Mail,
  Clock,
  CheckCircle2,
  UserCheck,
  UserX,
  ShieldCheck,
  RefreshCw,
  Download,
  Loader2,
  Eye,
  UserPlus,
  UserCog,
  Activity,
  BarChart3,
  Crown,
  X,
  AlertCircle,
  Ticket,
  History,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Filter,
  TrendingUp,
  Power,
} from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
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
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { avatarUrl } from "@/lib/avatar";
import {
  PermissionGuard,
  PermissionGate,
} from "@/components/dashboard/permission-guard";
import { Donut, BarSeries, AreaSpark } from "@/components/dashboard/charts";
import { ChartSkeleton } from "@/components/dashboard/skeletons";
import {
  useSupportAgents,
  useAgentStats,
  useAgentDetail,
  useAgentTickets,
  useAgentActivity,
  useCreateSupportAgent,
  useUpdateSupportAgent,
  useDeleteSupportAgent,
  useToggleAgentStatus,
  useUsers,
  useSupportDepartments,
  useSupportTeams,
} from "@/lib/api/hooks";
import type {
  SupportAgent,
  SupportAgentTicket,
  SupportAgentActivity,
} from "@/lib/api/services";
import {
  agentLoadPct,
  normalizeAgentStatus,
  normalizeAgentRole,
  agentToCsvRow,
  csvEscape,
} from "@/lib/support/support-agent.logic";

export const Route = createFileRoute("/_app/support/agents")({
  head: () => ({ meta: [{ title: "Support Agents · Vellum Admin" }] }),
  component: SupportAgentsPage,
});

// ─── Status Configuration ───

const STATUS_CONFIG: Record<
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

const ROLE_CONFIG: Record<
  string,
  { label: string; icon: any; color: string; bg: string }
> = {
  SUPPORT_ADMIN: {
    label: "Support Admin",
    icon: ShieldCheck,
    color: "text-blue-600",
    bg: "bg-blue-100 dark:bg-blue-950/40",
  },
  MODERATOR: {
    label: "Support Agent",
    icon: UserCog,
    color: "text-purple-600",
    bg: "bg-purple-100 dark:bg-purple-950/40",
  },
  ADMIN: {
    label: "Admin",
    icon: Crown,
    color: "text-amber-600",
    bg: "bg-amber-100 dark:bg-amber-950/40",
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

const PAGE_SIZE = 10;

// ─── Helpers ───

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function resolveStatus(agent: SupportAgent): string {
  return normalizeAgentStatus({ status: agent.status, isActive: agent.isActive });
}

function resolveRole(agent: SupportAgent): string {
  return normalizeAgentRole(agent);
}

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.OFFLINE;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        config.bg,
        config.color,
      )}
    >
      <span className={cn("size-1.5 rounded-full", config.dot)} />
      {config.label}
    </span>
  );
}

function RoleBadge({ role }: { role: string }) {
  const config = ROLE_CONFIG[role] ?? ROLE_CONFIG.MODERATOR;
  const Icon = config.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium",
        config.bg,
        config.color,
      )}
    >
      <Icon className="size-3" />
      {config.label}
    </span>
  );
}

function TicketStatusBadge({ status }: { status: string }) {
  const config = TICKET_STATUS_CONFIG[status] ?? {
    label: status,
    variant: "outline" as const,
  };
  return (
    <Badge variant={config.variant} className="text-[10px]">
      {config.label}
    </Badge>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const config = PRIORITY_CONFIG[priority] ?? {
    label: priority,
    variant: "outline" as const,
  };
  return (
    <Badge variant={config.variant} className="text-[10px]">
      {config.label}
    </Badge>
  );
}

// ─── Pagination ───

function AgentsPagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (p: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-muted-foreground">
      <span>
        Showing {from}–{to} of {total.toLocaleString()} agents
      </span>
      <div className="flex items-center gap-2">
        <span className="text-xs">
          Page {page} of {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >
          <ChevronLeft className="size-3.5" /> Prev
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
        >
          Next <ChevronRight className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ─── Agents Table Skeleton ───

function AgentsTableSkeleton() {
  return (
    <div className="divide-y">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <div className="size-9 animate-pulse rounded-full bg-muted" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 w-40 animate-pulse rounded bg-muted" />
            <div className="h-3 w-56 animate-pulse rounded bg-muted/70" />
          </div>
          <div className="h-5 w-20 animate-pulse rounded bg-muted" />
          <div className="h-5 w-16 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

// ─── User Search Select (for Create form) ───

function UserSearchSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (userId: string, label: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [selectedLabel, setSelectedLabel] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data, isLoading } = useUsers({
    filter: debounced || undefined,
    pageSize: 10,
    page: 1,
  });

  const users = data?.data ?? [];

  return (
    <div className="space-y-2">
      <Label>User *</Label>
      {value ? (
        <div className="flex items-center justify-between rounded-md border px-3 py-2">
          <span className="text-sm font-medium">{selectedLabel || value}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => {
              onChange("", "");
              setSelectedLabel("");
              setQuery("");
            }}
          >
            Change
          </Button>
        </div>
      ) : (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
            placeholder="Search users by name or email..."
          />
        </div>
      )}

      {!value && query && (
        <div className="max-h-48 overflow-y-auto rounded-md border">
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          ) : users.length === 0 ? (
            <div className="py-4 text-center text-xs text-muted-foreground">
              No users found
            </div>
          ) : (
            users.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => {
                  onChange(u.id, `${u.name} (${u.email})`);
                  setSelectedLabel(`${u.name} (${u.email})`);
                  setQuery("");
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/50"
              >
                <Avatar className="size-6">
                  <AvatarImage src={avatarUrl(u.name)} />
                  <AvatarFallback className="text-[10px]">
                    {getInitials(u.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{u.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {u.email}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Agent Row ───

function AgentRow({
  agent,
  onView,
  onTickets,
  onEdit,
  onToggle,
  onDelete,
  onAnalytics,
}: {
  agent: SupportAgent;
  onView: (agent: SupportAgent) => void;
  onTickets: (agent: SupportAgent) => void;
  onEdit: (agent: SupportAgent) => void;
  onToggle: (agent: SupportAgent) => void;
  onDelete: (agent: SupportAgent) => void;
  onAnalytics: (agent: SupportAgent) => void;
}) {
  const status = resolveStatus(agent);
  const role = resolveRole(agent);
  const skills = agent.skills ?? [];
  const active = agent.activeTickets ?? 0;
  const max = agent.maxTickets ?? 0;
  const loadPct = agentLoadPct({ activeTickets: active, maxTickets: max });

  return (
    <tr className="group hover:bg-muted/30 transition-colors">
      <td className="px-4 py-3">
        <button
          type="button"
          onClick={() => onView(agent)}
          className="flex items-center gap-3 text-left"
        >
          <Avatar className="size-9">
            <AvatarImage src={avatarUrl(agent.user?.name ?? agent.userId)} />
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
              {getInitials(agent.user?.name ?? "?")}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="font-medium text-sm hover:underline">
              {agent.user?.name ?? "Unknown"}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {agent.user?.email ?? "—"}
            </p>
          </div>
        </button>
      </td>
      <td className="px-4 py-3">
        <RoleBadge role={role} />
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={status} />
      </td>
      <td className="px-4 py-3 hidden md:table-cell">
        {agent.department ? (
          <Badge variant="secondary" className="text-[10px] font-normal">
            {agent.department.name}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-4 py-3 hidden lg:table-cell">
        <div className="flex flex-wrap gap-1 max-w-[200px]">
          {skills.length === 0 ? (
            <span className="text-xs text-muted-foreground">—</span>
          ) : (
            skills.slice(0, 3).map((s) => (
              <Badge key={s} variant="outline" className="text-[10px]">
                {s}
              </Badge>
            ))
          )}
          {skills.length > 3 && (
            <Badge variant="outline" className="text-[10px]">
              +{skills.length - 3}
            </Badge>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium tabular-nums">{active}</span>
          <span className="text-xs text-muted-foreground">/ {max}</span>
          <div className="w-12">
            <Progress value={loadPct} className="h-1.5" />
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-7">
              <MoreVertical className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => onView(agent)}>
              <Eye className="mr-2 size-3.5" /> Quick View
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onTickets(agent)}>
              <Ticket className="mr-2 size-3.5" /> View Tickets
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAnalytics(agent)}>
              <BarChart3 className="mr-2 size-3.5" /> Analytics
            </DropdownMenuItem>
            <PermissionGate resource="support" action="moderate">
              <DropdownMenuItem onClick={() => onEdit(agent)}>
                <Pencil className="mr-2 size-3.5" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onToggle(agent)}>
                {agent.isActive ? (
                  <>
                    <UserX className="mr-2 size-3.5" /> Deactivate
                  </>
                ) : (
                  <>
                    <UserCheck className="mr-2 size-3.5" /> Activate
                  </>
                )}
              </DropdownMenuItem>
            </PermissionGate>
            <PermissionGate resource="support" action="moderate">
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => onDelete(agent)}
              >
                <Trash2 className="mr-2 size-3.5" /> Delete
              </DropdownMenuItem>
            </PermissionGate>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
}

// ─── Agent Quick View Sheet ───

function AgentQuickViewSheet({
  agent,
  open,
  onOpenChange,
  onTickets,
  onAnalytics,
  onEdit,
}: {
  agent: SupportAgent | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onTickets: (agent: SupportAgent) => void;
  onAnalytics: (agent: SupportAgent) => void;
  onEdit: (agent: SupportAgent) => void;
}) {
  const { data: detail, isLoading } = useAgentDetail(
    open ? agent?.userId : undefined,
  );
  const toggleMut = useToggleAgentStatus();

  const role = agent ? resolveRole(agent) : "MODERATOR";
  const status = agent ? resolveStatus(agent) : "OFFLINE";
  const loadPct = agent ? agentLoadPct({ activeTickets: agent.activeTickets, maxTickets: agent.maxTickets }) : 0;
  const metrics = detail?.metrics;

  const handleToggle = useCallback(() => {
    if (!agent) return;
    toggleMut.mutate(agent.userId, {
      onSuccess: () => toast.success(`${agent.user?.name ?? "Agent"} ${agent.isActive ? "deactivated" : "activated"}`),
      onError: (e: any) => toast.error(e?.message ?? "Failed to toggle status"),
    });
  }, [agent, toggleMut]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[520px] sm:max-w-[560px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Avatar className="size-9">
              <AvatarImage src={avatarUrl(agent?.user?.name ?? "")} />
              <AvatarFallback className="bg-primary/10 text-primary font-medium text-xs">
                {getInitials(agent?.user?.name ?? "?")}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="text-base font-semibold truncate">{agent?.user?.name ?? "Agent"}</div>
              <div className="text-[11px] text-muted-foreground truncate flex items-center gap-1.5">
                <Mail className="size-2.5" /> {agent?.user?.email ?? "—"}
              </div>
            </div>
          </SheetTitle>
          <div className="flex items-center gap-1.5 pt-1">
            <StatusBadge status={status} />
            <RoleBadge role={role} />
          </div>
          <SheetDescription className="sr-only">
            Quick view for {agent?.user?.name ?? "agent"} — contact, stats, and shortcuts.
          </SheetDescription>
        </SheetHeader>

        <div className="grid grid-cols-3 gap-2 py-4">
          <div className="rounded-lg border p-3 text-center">
            <div className="text-lg font-bold tabular-nums">{agent?.activeTickets ?? 0}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Active</div>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <div className="text-lg font-bold tabular-nums">{detail?.ticketsResolved ?? agent?.ticketsResolved ?? 0}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Resolved</div>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <div className="text-lg font-bold tabular-nums">{detail?.escalations ?? agent?.escalations ?? metrics?.escalated ?? 0}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Escalations</div>
          </div>
        </div>

        {/* Workload */}
        <div className="space-y-1.5 pb-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Workload</span>
            <span className="font-medium tabular-nums">
              {agent?.activeTickets ?? 0} / {agent?.maxTickets ?? 0} ({loadPct}%)
            </span>
          </div>
          <Progress
            value={loadPct}
            className={cn(
              "h-1.5",
              loadPct >= 90 ? "[&>div]:bg-destructive" : loadPct >= 70 ? "[&>div]:bg-amber-500" : "[&>div]:bg-emerald-500",
            )}
          />
        </div>

        <Separator />

        {/* Agent Info */}
        <div className="space-y-3 py-4 text-sm">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Information
          </h4>
          <dl className="space-y-2">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Department</dt>
              <dd className="font-medium truncate">{agent?.department?.name ?? "Unassigned"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Team</dt>
              <dd className="font-medium truncate">{detail?.team?.name ?? agent?.team?.name ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Max Tickets</dt>
              <dd className="font-medium tabular-nums">{agent?.maxTickets ?? 0}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Member Since</dt>
              <dd className="font-medium">
                {agent ? format(new Date(agent.createdAt), "MMM d, yyyy") : "—"}
              </dd>
            </div>
            {agent?.vacationUntil && (
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">On Vacation Until</dt>
                <dd className="font-medium">
                  {format(new Date(agent.vacationUntil), "MMM d, yyyy")}
                </dd>
              </div>
            )}
          </dl>
        </div>

        {/* Skills */}
        <div className="space-y-2 pb-4">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Skills
          </h4>
          {(agent?.skills ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground">No skills listed</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {(agent?.skills ?? []).map((s) => (
                <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>
              ))}
            </div>
          )}
        </div>

        {/* Performance summary */}
        <div className="space-y-3 pb-4">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Performance Snapshot
          </h4>
          {isLoading ? (
            <ChartSkeleton />
          ) : metrics ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border p-2.5">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Escalation Rate</div>
                  <div className="text-base font-semibold tabular-nums">{metrics.escalationRate.toFixed(1)}%</div>
                </div>
                <div className="rounded-lg border p-2.5">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Reopen Rate</div>
                  <div className="text-base font-semibold tabular-nums">{metrics.reopenRate.toFixed(1)}%</div>
                </div>
              </div>
              <div className="space-y-2 pt-1">
                <MetricBar label="Total Assigned" value={metrics.totalAssigned} max={Math.max(metrics.totalAssigned, 1)} />
                <MetricBar label="Resolved" value={metrics.resolved} max={Math.max(metrics.totalAssigned, 1)} tone="success" />
                <MetricBar label="Escalated" value={metrics.escalated} max={Math.max(metrics.totalAssigned, 1)} tone="warning" />
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Metrics unavailable</p>
          )}
        </div>

        <Separator />

        <SheetFooter className="flex flex-col gap-2 pt-4 sm:space-y-0">
          <div className="grid grid-cols-2 gap-2 w-full">
            <Button variant="default" size={'sm'} onClick={() => agent && onTickets(agent)} className="gap-1.5">
              <Ticket className="size-3.5" /> View Tickets
            </Button>
            <Button variant="outline" size={'sm'} onClick={() => agent && onAnalytics(agent)} className="gap-1.5">
              <BarChart3 className="size-3.5" /> Analytics
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2 w-full">
            <PermissionGate resource="support" action="moderate">
              <Button variant="outline" size={'sm'} onClick={() => agent && onEdit(agent)} className="gap-1.5">
                <Pencil className="size-3.5" /> Edit
              </Button>
            </PermissionGate>
            <PermissionGate resource="support" action="moderate">
              <Button
                variant={agent?.isActive ? "outline" : "secondary"}
                size={'sm'}
                onClick={handleToggle}
                disabled={toggleMut.isPending}
                className="gap-1.5"
              >
                <Power className="size-3.5" />
                {agent?.isActive ? "Deactivate" : "Activate"}
              </Button>
            </PermissionGate>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ─── Agent Tickets Dialog (Large / near-full-screen) ───

const TICKET_TABS = [
  { key: "ALL", label: "All Tickets", filter: null as null | ((t: SupportAgentTicket) => boolean) },
  { key: "OPEN", label: "Open", filter: (t: SupportAgentTicket) => ["NEW", "ASSIGNED", "IN_PROGRESS", "WAITING_ON_CUSTOMER", "ESCALATED"].includes(t.status) },
  { key: "CLOSED", label: "Closed", filter: (t: SupportAgentTicket) => ["RESOLVED", "CLOSED"].includes(t.status) },
  { key: "ESCALATED", label: "Escalated", filter: (t: SupportAgentTicket) => t.status === "ESCALATED" },
] as const;

function AgentTicketsDialog({
  agent,
  open,
  onOpenChange,
}: {
  agent: SupportAgent | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [ticketPage, setTicketPage] = useState(1);
  const [activityPage, setActivityPage] = useState(1);
  const [activeTab, setActiveTab] = useState<(typeof TICKET_TABS)[number]["key"]>("ALL");

  const { data: detail } = useAgentDetail(open ? agent?.userId : undefined);

  const { data: ticketsData, isLoading: ticketsLoading } = useAgentTickets(
    open ? agent?.userId : undefined,
    { page: ticketPage, limit: PAGE_SIZE },
  );

  const { data: activityData, isLoading: activityLoading } = useAgentActivity(
    open ? agent?.userId : undefined,
    { page: activityPage, limit: PAGE_SIZE },
  );

  useEffect(() => {
    if (open) {
      setTicketPage(1);
      setActivityPage(1);
      setActiveTab("ALL");
    }
  }, [open, agent?.userId]);

  const allTickets = ticketsData?.data ?? [];
  const tabCfg = TICKET_TABS.find((t) => t.key === activeTab) ?? TICKET_TABS[0];
  const tickets = tabCfg.filter ? allTickets.filter(tabCfg.filter) : allTickets;

  // Count each bucket (across loaded page of tickets)
  const tabCounts = useMemo(() => {
    const out: Record<string, number> = { ALL: allTickets.length };
    for (const t of allTickets) {
      const openBool = ["NEW", "ASSIGNED", "IN_PROGRESS", "WAITING_ON_CUSTOMER", "ESCALATED"].includes(t.status);
      const closedBool = ["RESOLVED", "CLOSED"].includes(t.status);
      if (openBool) out.OPEN = (out.OPEN ?? 0) + 1;
      if (closedBool) out.CLOSED = (out.CLOSED ?? 0) + 1;
      if (t.status === "ESCALATED") out.ESCALATED = (out.ESCALATED ?? 0) + 1;
    }
    return out;
  }, [allTickets]);

  const activities = activityData?.data ?? [];
  const role = agent ? resolveRole(agent) : "MODERATOR";
  const status = agent ? resolveStatus(agent) : "OFFLINE";
  const total = ticketsData?.total ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[96vw] max-h-[95vh] p-0 overflow-hidden flex flex-col !rounded-xl">
        {/* Sticky header */}
        <div className="flex flex-col md:flex-row md:items-center gap-4 border-b px-6 py-4">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <Avatar className="size-12 shrink-0">
              <AvatarImage src={avatarUrl(agent?.user?.name ?? "")} />
              <AvatarFallback className="bg-primary/10 text-primary font-medium">
                {getInitials(agent?.user?.name ?? "?")}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle className="text-lg font-semibold truncate">
                  {agent?.user?.name ?? "Agent"} — Tickets & Activity
                </DialogTitle>
                <StatusBadge status={status} />
                <RoleBadge role={role} />
              </div>
              <DialogDescription className="flex items-center gap-1.5 text-xs flex-wrap">
                <Mail className="size-3" />
                {agent?.user?.email ?? "—"}
                {agent?.department && (
                  <>
                    <Separator orientation="vertical" className="mx-1 h-3" />
                    <Briefcase className="size-3" />
                    {agent.department.name}
                  </>
                )}
              </DialogDescription>
            </div>
          </div>

          {/* Quick stats strip */}
          <div className="grid grid-cols-4 md:w-auto gap-2 md:gap-3 shrink-0">
            <div className="rounded-lg border p-2.5 text-center">
              <div className="text-base font-bold tabular-nums">{agent?.activeTickets ?? 0}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Active</div>
            </div>
            <div className="rounded-lg border p-2.5 text-center">
              <div className="text-base font-bold tabular-nums">{detail?.ticketsResolved ?? agent?.ticketsResolved ?? 0}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Resolved</div>
            </div>
            <div className="rounded-lg border p-2.5 text-center">
              <div className="text-base font-bold tabular-nums">{detail?.escalations ?? agent?.escalations ?? 0}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Escalations</div>
            </div>
            <div className="rounded-lg border p-2.5 text-center">
              <div className="text-base font-bold tabular-nums">{total}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] flex-1 min-h-0">
          {/* LEFT: Tickets table */}
          <div className="flex flex-col min-h-0 border-r">
            <div className="flex items-center justify-between border-b px-6 py-3 gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Ticket className="size-4 text-muted-foreground" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Assigned Tickets
                </h4>
              </div>
              <Tabs
                value={activeTab}
                onValueChange={(v) => {
                  setActiveTab(v as (typeof TICKET_TABS)[number]["key"]);
                  setTicketPage(1);
                }}
              >
                <TabsList className="bg-transparent h-9 p-0 gap-1">
                  {TICKET_TABS.map((t) => (
                    <TabsTrigger
                      key={t.key}
                      value={t.key}
                      className="h-8 px-3 gap-1.5 data-[state=active]:bg-muted rounded-md"
                    >
                      {t.label}
                      <span className="ml-1 rounded-sm bg-muted px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground data-[state=active]:bg-background">
                        {tabCounts[t.key] ?? 0}
                      </span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>

            <ScrollArea className="flex-1">
              {ticketsLoading ? (
                <div className="p-6"><ChartSkeleton /></div>
              ) : tickets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Ticket className="size-10 text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">No tickets in this status</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-background">
                      <tr className="border-b bg-muted/40">
                        <th className="px-6 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground w-[110px]">Ticket</th>
                        <th className="px-6 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Subject</th>
                        <th className="px-6 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground w-[110px]">Status</th>
                        <th className="px-6 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground w-[95px]">Priority</th>
                        <th className="px-6 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground w-[150px]">Created</th>
                        <th className="px-6 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground w-[150px]">Updated</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {tickets.map((t: SupportAgentTicket) => (
                        <tr key={t.id} className="hover:bg-muted/30">
                          <td className="px-6 py-2.5 font-mono text-xs text-muted-foreground whitespace-nowrap">
                            {t.ticketNumber}
                          </td>
                          <td className="px-6 py-2.5">
                            <div className="font-medium line-clamp-1">{t.subject}</div>
                            {t.category?.name && (
                              <div className="text-[10px] text-muted-foreground">{t.category.name}</div>
                            )}
                          </td>
                          <td className="px-6 py-2.5"><TicketStatusBadge status={t.status} /></td>
                          <td className="px-6 py-2.5"><PriorityBadge priority={t.priority} /></td>
                          <td className="px-6 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                            {formatDistanceToNow(new Date(t.createdAt), { addSuffix: true })}
                          </td>
                          <td className="px-6 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                            {formatDistanceToNow(new Date(t.updatedAt), { addSuffix: true })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </ScrollArea>

            {ticketsData && ticketsData.total > PAGE_SIZE && (
              <AgentsPagination
                page={ticketPage}
                pageSize={PAGE_SIZE}
                total={ticketsData.total}
                onPageChange={setTicketPage}
              />
            )}
          </div>

          {/* RIGHT: Activity timeline */}
          <div className="flex flex-col min-h-0">
            <div className="flex items-center gap-2 border-b px-6 py-3">
              <Activity className="size-4 text-muted-foreground" />
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Recent Activity
              </h4>
            </div>
            <ScrollArea className="flex-1">
              {activityLoading ? (
                <div className="p-6"><ChartSkeleton /></div>
              ) : activities.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <History className="size-10 text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">No recent activity</p>
                </div>
              ) : (
                <div className="space-y-3 p-6">
                  {activities.map((a: SupportAgentActivity) => (
                    <ActivityTimelineItem key={a.id} activity={a} />
                  ))}
                </div>
              )}
            </ScrollArea>
            {activityData && activityData.total > PAGE_SIZE && (
              <AgentsPagination
                page={activityPage}
                pageSize={PAGE_SIZE}
                total={activityData.total}
                onPageChange={setActivityPage}
              />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MetricBar({
  label,
  value,
  max,
  tone = "primary",
}: {
  label: string;
  value: number;
  max: number;
  tone?: "primary" | "success" | "warning" | "destructive";
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
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
        <span className="font-medium tabular-nums">{value.toLocaleString()}</span>
      </div>
      <Progress value={pct} className={cn("h-2", colorClass[tone])} />
    </div>
  );
}

function ActivityTimelineItem({ activity }: { activity: SupportAgentActivity }) {
  const type = (activity.resourceType || "").toLowerCase();
  const iconMap: Record<string, { icon: any; color: string }> = {
    ticket: { icon: Ticket, color: "bg-blue-500" },
    note: { icon: History, color: "bg-amber-500" },
    assignment: { icon: UserCheck, color: "bg-purple-500" },
    status: { icon: RefreshCw, color: "bg-emerald-500" },
    escalation: { icon: AlertCircle, color: "bg-rose-500" },
    message: { icon: Mail, color: "bg-cyan-500" },
  };
  const cfg = iconMap[type] ?? { icon: Activity, color: "bg-muted-foreground" };
  const Icon = cfg.icon;
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className={cn("grid size-7 place-items-center rounded-full text-white", cfg.color)}>
          <Icon className="size-3.5" />
        </div>
        <div className="w-px flex-1 bg-border" />
      </div>
      <div className="flex-1 pb-4">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-sm">{activity.action}</span>
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
            {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
          </span>
        </div>
        {activity.resourceType && (
          <p className="text-xs text-muted-foreground">
            {activity.resourceType}
            {activity.resourceId ? ` · ${activity.resourceId}` : ""}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Agent Analytics Dialog ───

function AgentAnalyticsDialog({
  agent,
  open,
  onOpenChange,
}: {
  agent: SupportAgent | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { data: detail, isLoading } = useAgentDetail(
    open ? agent?.userId : undefined,
  );

  const tickets = detail?.tickets ?? [];

  const statusDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of tickets) {
      counts[t.status] = (counts[t.status] ?? 0) + 1;
    }
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [tickets]);

  const priorityDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of tickets) {
      counts[t.priority] = (counts[t.priority] ?? 0) + 1;
    }
    return Object.entries(counts).map(([date, value]) => ({ date, value }));
  }, [tickets]);

  // Satisfaction trend is not provided by the API; show a neutral sparkline
  // placeholder derived from resolution counts when available.
  const satisfactionTrend = useMemo(() => {
    if (tickets.length === 0) return [];
    // Build a lightweight ascending series based on created dates for visualization.
    const byDay: Record<string, number> = {};
    for (const t of tickets) {
      const d = format(new Date(t.createdAt), "yyyy-MM-dd");
      byDay[d] = (byDay[d] ?? 0) + 1;
    }
    return Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14)
      .map(([date, value]) => ({ date, value }));
  }, [tickets]);

  const metrics = detail?.metrics;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] p-0 overflow-hidden flex flex-col">
        <div className="flex items-center gap-3 border-b px-6 py-4">
          <BarChart3 className="size-5 text-primary" />
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-lg font-semibold truncate">
              Activity Analytics — {agent?.user?.name ?? "Agent"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Performance breakdown and ticket distribution
            </DialogDescription>
          </div>
        </div>

        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="p-6 space-y-4">
              <ChartSkeleton />
              <ChartSkeleton />
            </div>
          ) : (
            <div className="space-y-6 p-6">
              {/* Metrics grid */}
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="rounded-lg border p-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="size-3" /> Response Time
                  </div>
                  <div className="mt-1 text-lg font-semibold">—</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CheckCircle2 className="size-3" /> Resolution Time
                  </div>
                  <div className="mt-1 text-lg font-semibold">—</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <TrendingUp className="size-3" /> Satisfaction
                  </div>
                  <div className="mt-1 text-lg font-semibold">—</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <AlertCircle className="size-3" /> Escalation Rate
                  </div>
                  <div className="mt-1 text-lg font-semibold">
                    {metrics ? `${metrics.escalationRate.toFixed(1)}%` : "—"}
                  </div>
                </div>
              </div>

              {/* Charts */}
              <div className="grid gap-4 md:grid-cols-2">
                <SectionCard title="Ticket Status Distribution" padded={false}>
                  <div className="p-4">
                    {statusDistribution.length === 0 ? (
                      <div className="flex h-[220px] items-center justify-center text-xs text-muted-foreground">
                        No ticket data
                      </div>
                    ) : (
                      <Donut data={statusDistribution} height={220} />
                    )}
                    {statusDistribution.length > 0 && (
                      <div className="mt-3 flex flex-wrap justify-center gap-3">
                        {statusDistribution.map((s, i) => (
                          <div key={s.name} className="flex items-center gap-1.5 text-xs">
                            <span
                              className="size-2 rounded-full"
                              style={{ background: `var(--chart-${(i % 5) + 1})` }}
                            />
                            {s.name} ({s.value})
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </SectionCard>

                <SectionCard title="Tickets by Priority" padded={false}>
                  <div className="p-4">
                    {priorityDistribution.length === 0 ? (
                      <div className="flex h-[220px] items-center justify-center text-xs text-muted-foreground">
                        No priority data
                      </div>
                    ) : (
                      <BarSeries data={priorityDistribution} height={220} />
                    )}
                  </div>
                </SectionCard>
              </div>

              <SectionCard title="Activity Trend" padded={false}>
                <div className="p-4">
                  {satisfactionTrend.length === 0 ? (
                    <div className="flex h-[64px] items-center justify-center text-xs text-muted-foreground">
                      No trend data
                    </div>
                  ) : (
                    <AreaSpark data={satisfactionTrend} />
                  )}
                </div>
              </SectionCard>

              {/* Shift schedule */}
              <SectionCard title="Shift Schedule" padded={false}>
                <div className="p-4 flex flex-wrap items-center gap-4 text-sm">
                  <div className="flex items-center gap-1.5">
                    <Clock className="size-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Hours:</span>
                    <span className="font-medium">09:00 – 17:00</span>
                  </div>
                  <Separator orientation="vertical" className="h-4" />
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">Timezone:</span>
                    <span className="font-medium">
                      {Intl.DateTimeFormat().resolvedOptions().timeZone}
                    </span>
                  </div>
                </div>
              </SectionCard>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// ─── Create / Edit Agent Dialog with Department & Team Dropdowns ───

interface AgentFormState {
  userId: string;
  userLabel: string;
  departmentId: string;
  teamId: string;
  skills: string;
  maxTickets: number;
}

function AgentFormDialog({
  mode,
  agent,
  open,
  onOpenChange,
}: {
  mode: "create" | "edit";
  agent: SupportAgent | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const createMut = useCreateSupportAgent();
  const updateMut = useUpdateSupportAgent();

  // ── Fetch departments and teams for dropdowns ──
  const { data: {data: departments} = {data: []}, isLoading: deptsLoading } = useSupportDepartments({
    limit: 100,
  });
  const { data: {data: teams} = {data: []}, isLoading: teamsLoading } = useSupportTeams({
    limit: 100,
  });

  const [form, setForm] = useState<AgentFormState>({
    userId: "",
    userLabel: "",
    departmentId: "",
    teamId: "",
    skills: "",
    maxTickets: 10,
  });

  // ── Populate form when editing ──
  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && agent) {
      setForm({
        userId: agent.userId,
        userLabel: `${agent.user?.name ?? ""} (${agent.user?.email ?? ""})`,
        departmentId: agent.department?.id ?? "",
        teamId: agent.team?.id ?? "",
        skills: (agent.skills ?? []).join(", "),
        maxTickets: agent.maxTickets ?? 10,
      });
    } else {
      setForm({
        userId: "",
        userLabel: "",
        departmentId: "",
        teamId: "",
        skills: "",
        maxTickets: 10,
      });
    }
  }, [open, mode, agent]);

  // ── Filter teams based on selected department ──
  const filteredTeams = useMemo(() => {
    if (!teams) return [];
    if (!form.departmentId) return teams;
    return teams.filter((t: any) => t.departmentId === form.departmentId);
  }, [teams, form.departmentId]);

  const pending = createMut.isPending || updateMut.isPending;

  const handleSubmit = useCallback(() => {
    if (mode === "create" && !form.userId) {
      toast.error("Please select a user");
      return;
    }
    if (form.maxTickets < 1 || form.maxTickets > 50) {
      toast.error("Max tickets must be between 1 and 50");
      return;
    }

    const skills = form.skills
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const payload = {
      departmentId: form.departmentId || undefined,
      teamId: form.teamId || undefined,
      skills,
      maxTickets: form.maxTickets,
    };

    if (mode === "create") {
      createMut.mutate(
        { userId: form.userId, ...payload },
        {
          onSuccess: () => {
            toast.success("Agent created successfully");
            onOpenChange(false);
          },
          onError: (e: any) =>
            toast.error(e?.message ?? "Failed to create agent"),
        },
      );
    } else if (agent) {
      updateMut.mutate(
        { userId: agent.userId, data: payload },
        {
          onSuccess: () => {
            toast.success("Agent updated successfully");
            onOpenChange(false);
          },
          onError: (e: any) =>
            toast.error(e?.message ?? "Failed to update agent"),
        },
      );
    }
  }, [mode, form, agent, createMut, updateMut, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === "create" ? (
              <>
                <UserPlus className="size-5 text-primary" /> Add Support Agent
              </>
            ) : (
              <>
                <UserCog className="size-5 text-primary" /> Edit Agent
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Select a user and configure their support agent profile."
              : "Update agent details and configuration."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {mode === "create" ? (
            <UserSearchSelect
              value={form.userId}
              onChange={(userId, label) =>
                setForm((p) => ({ ...p, userId, userLabel: label }))
              }
            />
          ) : (
            <div className="space-y-2">
              <Label>Agent</Label>
              <div className="rounded-md border px-3 py-2 text-sm font-medium">
                {form.userLabel || agent?.user?.name}
              </div>
            </div>
          )}

          {/* ── Department Dropdown ── */}
          <div className="space-y-2">
            <Label htmlFor="agent-department">Department</Label>
            <Select
              value={form.departmentId}
              onValueChange={(value) =>
                setForm((p) => ({ ...p, departmentId: value, teamId: "" }))
              }
              disabled={deptsLoading}
            >
              <SelectTrigger id="agent-department">
                <SelectValue placeholder="Select a department..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {departments?.map((dept: any) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {deptsLoading && (
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            )}
          </div>

          {/* ── Team Dropdown (filtered by department) ── */}
          <div className="space-y-2">
            <Label htmlFor="agent-team">Team</Label>
            <Select
              value={form.teamId}
              onValueChange={(value) =>
                setForm((p) => ({ ...p, teamId: value }))
              }
              disabled={teamsLoading || !form.departmentId}
            >
              <SelectTrigger id="agent-team">
                <SelectValue
                  placeholder={
                    form.departmentId
                      ? "Select a team..."
                      : "Select a department first"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {filteredTeams.map((team: any) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {teamsLoading && (
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            )}
            {form.departmentId && filteredTeams.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No teams found for this department
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="agent-skills">Skills (comma-separated)</Label>
            <Input
              id="agent-skills"
              value={form.skills}
              onChange={(e) =>
                setForm((p) => ({ ...p, skills: e.target.value }))
              }
              placeholder="API, Billing, Authentication"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="agent-max-tickets">Max Tickets (1–50)</Label>
            <Input
              id="agent-max-tickets"
              type="number"
              min={1}
              max={50}
              value={form.maxTickets}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  maxTickets: Number(e.target.value) || 0,
                }))
              }
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={pending}>
            {pending && <Loader2 className="mr-1.5 size-4 animate-spin" />}
            {mode === "create" ? "Create Agent" : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Delete Agent Dialog ───

function DeleteAgentDialog({
  agent,
  open,
  onOpenChange,
}: {
  agent: SupportAgent | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const deleteMut = useDeleteSupportAgent();

  const handleConfirm = useCallback(() => {
    if (!agent) return;
    deleteMut.mutate(agent.userId, {
      onSuccess: () => {
        toast.success("Agent deleted successfully");
        onOpenChange(false);
      },
      onError: (e: any) => toast.error(e?.message ?? "Failed to delete agent"),
    });
  }, [agent, deleteMut, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="size-5" />
            Delete Agent
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete{" "}
            <strong>{agent?.user?.name ?? "this agent"}</strong>? This will
            remove the agent from the support system.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
          <AlertCircle className="mb-1 inline size-4" /> Any tickets currently
          assigned to this agent will need to be reassigned.
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={deleteMut.isPending}
          >
            {deleteMut.isPending && (
              <Loader2 className="mr-1.5 size-4 animate-spin" />
            )}
            Delete Agent
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ───

function SupportAgentsPage() {
  // Filters / pagination state
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [sort, setSort] = useState<string>("recent");
  const [page, setPage] = useState(1);

  // Dialog / Sheet state
  const [sheetAgent, setSheetAgent] = useState<SupportAgent | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [ticketsAgent, setTicketsAgent] = useState<SupportAgent | null>(null);
  const [ticketsOpen, setTicketsOpen] = useState(false);
  const [analyticsAgent, setAnalyticsAgent] = useState<SupportAgent | null>(null);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editAgent, setEditAgent] = useState<SupportAgent | null>(null);
  const [deleteAgent, setDeleteAgent] = useState<SupportAgent | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const toggleMut = useToggleAgentStatus();

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Map UI sort enum to backend query params
  const { sortBy, sortDir } = useMemo<{
    sortBy: NonNullable<Parameters<typeof useSupportAgents>[0]>["sortBy"];
    sortDir: "asc" | "desc";
  }>(() => {
    switch (sort) {
      case "name":
        return { sortBy: "name", sortDir: "asc" };
      case "tickets":
        return { sortBy: "activeTickets", sortDir: "desc" };
      case "active":
        return { sortBy: "ticketsResolved", sortDir: "desc" };
      case "load":
        return { sortBy: "activeTickets", sortDir: "desc" };
      case "recent":
      default:
        return { sortBy: "createdAt", sortDir: "desc" };
    }
  }, [sort]);

  const agentsQuery = useSupportAgents({
    search: search || undefined,
    status: statusFilter === "ALL" ? undefined : statusFilter,
    page,
    limit: PAGE_SIZE,
    sortBy,
    sortDir,
  });

  const statsQuery = useAgentStats();

  const agents = agentsQuery.data?.data ?? [];
  const total = agentsQuery.data?.total ?? 0;
  const stats = statsQuery.data;

  const handleRefresh = useCallback(() => {
    agentsQuery.refetch();
    statsQuery.refetch();
    toast.success("Agents refreshed");
  }, [agentsQuery, statsQuery]);

  const handleExport = useCallback(() => {
    if (agents.length === 0 && total === 0) {
      toast.error("No data to export");
      return;
    }
    try {
      const headers = [
        "Name",
        "Email",
        "Role",
        "Status",
        "Department",
        "Skills",
        "Active Tickets",
        "Max Tickets",
        "Resolved",
        "Escalations",
      ];
      const rows = agents.map((a) => agentToCsvRow(a));
      const csv = [headers, ...rows]
        .map((r) => r.map((c) => csvEscape(c)).join(","))
        .join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `support-agents-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${rows.length} agents`);
    } catch {
      toast.error("Export failed");
    }
  }, [agents, total]);

  const openSheet = useCallback((a: SupportAgent) => {
    setSheetAgent(a);
    setSheetOpen(true);
  }, []);

  const openTickets = useCallback((a: SupportAgent) => {
    setTicketsAgent(a);
    setTicketsOpen(true);
    // Close the quick-view sheet when drilling down to the large ticket dialog
    setSheetOpen(false);
  }, []);

  const openAnalytics = useCallback((a: SupportAgent) => {
    setAnalyticsAgent(a);
    setAnalyticsOpen(true);
    setSheetOpen(false);
  }, []);

  const openCreate = useCallback(() => {
    setFormMode("create");
    setEditAgent(null);
    setFormOpen(true);
  }, []);

  const openEdit = useCallback((a: SupportAgent) => {
    setFormMode("edit");
    setEditAgent(a);
    setFormOpen(true);
    setSheetOpen(false);
  }, []);

  const openDelete = useCallback((a: SupportAgent) => {
    setDeleteAgent(a);
    setDeleteOpen(true);
    setSheetOpen(false);
  }, []);

  const handleToggle = useCallback(
    (a: SupportAgent) => {
      toggleMut.mutate(a.userId, {
        onSuccess: () =>
          toast.success(
            `${a.user?.name ?? "Agent"} ${a.isActive ? "deactivated" : "activated"}`,
          ),
        onError: (e: any) =>
          toast.error(e?.message ?? "Failed to toggle status"),
      });
    },
    [toggleMut],
  );

  const clearFilters = useCallback(() => {
    setSearchInput("");
    setStatusFilter("ALL");
    setSort("recent");
    setPage(1);
  }, []);

  const hasFilters = search || statusFilter !== "ALL";

  return (
    <PermissionGuard resource="support" action="read">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Support"
          title="Support Agents"
          description="Manage your support team members, roles, and performance metrics."
          actions={
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={handleRefresh}
                    disabled={agentsQuery.isFetching}
                  >
                    <RefreshCw
                      className={cn(
                        "size-4",
                        agentsQuery.isFetching && "animate-spin",
                      )}
                    />
                    <span className="hidden sm:inline">Refresh</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Refresh agents</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={handleExport}
                  >
                    <Download className="size-4" />
                    <span className="hidden sm:inline">Export CSV</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Export agents to CSV</TooltipContent>
              </Tooltip>

              <PermissionGate resource="support" action="moderate">
                <Button size="sm" className="gap-1.5" onClick={openCreate}>
                  <Plus className="size-4" /> Add Agent
                </Button>
              </PermissionGate>
            </div>
          }
        />

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          <StatCard
            label="Total Agents"
            value={stats?.total ?? 0}
            icon={Users}
            tone="primary"
            loading={statsQuery.isLoading}
          />
          <StatCard
            label="Active"
            value={stats?.active ?? 0}
            icon={UserCheck}
            tone="success"
            loading={statsQuery.isLoading}
          />
          <StatCard
            label="Online Now"
            value={stats?.online ?? 0}
            icon={Activity}
            tone="info"
            loading={statsQuery.isLoading}
          />
          <StatCard
            label="Avg Resolution Rate"
            value={stats ? `${stats.resolutionRate.toFixed(1)}%` : "—"}
            icon={TrendingUp}
            tone="warning"
            loading={statsQuery.isLoading}
          />
          <StatCard
            label="Total Tickets"
            value={stats?.totalTickets ?? 0}
            icon={Ticket}
            tone="default"
            loading={statsQuery.isLoading}
          />
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative min-w-0 flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9 h-9"
              placeholder="Search by name or email..."
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[140px] h-9">
                <Filter className="mr-2 size-4" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="ONLINE">Online</SelectItem>
                <SelectItem value="BUSY">Busy</SelectItem>
                <SelectItem value="AWAY">Away</SelectItem>
                <SelectItem value="OFFLINE">Offline</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="w-[150px] h-9">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Most Recent</SelectItem>
                <SelectItem value="name">Name (A–Z)</SelectItem>
                <SelectItem value="tickets">Most Tickets</SelectItem>
                <SelectItem value="active">Most Active</SelectItem>
              </SelectContent>
            </Select>

            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="gap-1.5 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Agents Table */}
        <SectionCard padded={false} className="overflow-hidden">
          {agentsQuery.error ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <AlertCircle className="size-12 text-destructive/50 mb-4" />
              <p className="text-sm font-medium text-destructive">
                Failed to load agents
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {agentsQuery.error instanceof Error
                  ? agentsQuery.error.message
                  : "An unexpected error occurred"}
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => agentsQuery.refetch()}
              >
                Try again
              </Button>
            </div>
          ) : agentsQuery.isLoading ? (
            <AgentsTableSkeleton />
          ) : agents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 grid size-16 place-items-center rounded-full bg-primary/10">
                <Users className="size-8 text-primary/50" />
              </div>
              <p className="text-sm font-medium">No agents found</p>
              <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                {hasFilters
                  ? "Try adjusting your search or filters to find what you're looking for."
                  : "Add your first support agent to get started."}
              </p>
              {hasFilters ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 gap-1.5"
                  onClick={clearFilters}
                >
                  <X className="size-3.5" /> Clear filters
                </Button>
              ) : (
                <PermissionGate resource="support" action="moderate">
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 gap-1.5"
                    onClick={openCreate}
                  >
                    <Plus className="size-3.5" /> Add Agent
                  </Button>
                </PermissionGate>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Agent
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Role
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">
                      Department
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">
                      Skills
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Active / Max
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {agents.map((agent) => (
                    <AgentRow
                      key={agent.id}
                      agent={agent}
                      onView={openSheet}
                      onTickets={openTickets}
                      onEdit={openEdit}
                      onToggle={handleToggle}
                      onDelete={openDelete}
                      onAnalytics={openAnalytics}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!agentsQuery.isLoading && !agentsQuery.error && agents.length > 0 && (
            <AgentsPagination
              page={page}
              pageSize={PAGE_SIZE}
              total={total}
              onPageChange={setPage}
            />
          )}
        </SectionCard>

        {/* Dialogs + Sheet */}
        <AgentQuickViewSheet
          agent={sheetAgent}
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          onTickets={openTickets}
          onAnalytics={openAnalytics}
          onEdit={openEdit}
        />
        <AgentTicketsDialog
          agent={ticketsAgent}
          open={ticketsOpen}
          onOpenChange={setTicketsOpen}
        />
        <AgentAnalyticsDialog
          agent={analyticsAgent}
          open={analyticsOpen}
          onOpenChange={setAnalyticsOpen}
        />
        <AgentFormDialog
          mode={formMode}
          agent={editAgent}
          open={formOpen}
          onOpenChange={setFormOpen}
        />
        <DeleteAgentDialog
          agent={deleteAgent}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
        />
      </div>
    </PermissionGuard>
  );
}