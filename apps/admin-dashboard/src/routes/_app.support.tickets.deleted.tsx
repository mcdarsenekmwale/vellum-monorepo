// routes/_app/support/tickets/deleted.tsx

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import {
  Search,
  Filter,
  User,
  Clock,
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronFirst,
  ChevronLast,
  RefreshCw,
  Download,
  Loader2,
  X,
  ArrowUpDown,
  AlertTriangle,
  Trash2,
  RotateCcw,
  UserX,
  MoreVertical,
  Ban,
  ArrowLeftIcon,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/page-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatCard } from "@/components/dashboard/stat-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ChartSkeleton } from "@/components/dashboard/skeletons";
import { PermissionGuard } from "@/components/dashboard/permission-guard";
import { useDeletedSupportTickets, useRestoreSupportTicket, usePermanentlyDeleteSupportTicket } from "@/lib/api/hooks";
import { avatarUrl } from "@/lib/avatar";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/support/tickets/deleted")({
  head: () => ({ meta: [{ title: "Deleted Tickets · Vellbase Admin" }] }),
  component: DeletedTicketsPage,
});

// ─── Constants ───

const STATUS_CONFIG: Record<
  string,
  { label: string; dot: string; bg: string; text: string; border: string }
> = {
  NEW: {
    label: "New",
    dot: "bg-blue-500",
    bg: "bg-blue-500/10",
    text: "text-blue-400",
    border: "border-blue-500/20",
  },
  ASSIGNED: {
    label: "Assigned",
    dot: "bg-purple-500",
    bg: "bg-purple-500/10",
    text: "text-purple-400",
    border: "border-purple-500/20",
  },
  IN_PROGRESS: {
    label: "In Progress",
    dot: "bg-yellow-500",
    bg: "bg-yellow-500/10",
    text: "text-yellow-400",
    border: "border-yellow-500/20",
  },
  WAITING_ON_CUSTOMER: {
    label: "Waiting Customer",
    dot: "bg-orange-500",
    bg: "bg-orange-500/10",
    text: "text-orange-400",
    border: "border-orange-500/20",
  },
  WAITING_ON_INTERNAL: {
    label: "Waiting Internal",
    dot: "bg-amber-500",
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    border: "border-amber-500/20",
  },
  ESCALATED: {
    label: "Escalated",
    dot: "bg-red-500",
    bg: "bg-red-500/10",
    text: "text-red-400",
    border: "border-red-500/20",
  },
  RESOLVED: {
    label: "Resolved",
    dot: "bg-emerald-500",
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    border: "border-emerald-500/20",
  },
  CLOSED: {
    label: "Closed",
    dot: "bg-gray-500",
    bg: "bg-gray-500/10",
    text: "text-gray-400",
    border: "border-gray-500/20",
  },
  REOPENED: {
    label: "Reopened",
    dot: "bg-sky-500",
    bg: "bg-sky-500/10",
    text: "text-sky-400",
    border: "border-sky-500/20",
  },
};

const PRIORITY_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; dot: string }
> = {
  EMERGENCY: { label: "Emergency", bg: "bg-red-600", text: "text-white", dot: "bg-red-600" },
  CRITICAL: { label: "Critical", bg: "bg-orange-600", text: "text-white", dot: "bg-orange-600" },
  HIGH: { label: "High", bg: "bg-yellow-600", text: "text-white", dot: "bg-yellow-600" },
  MEDIUM: { label: "Medium", bg: "bg-blue-600", text: "text-white", dot: "bg-blue-600" },
  LOW: { label: "Low", bg: "bg-gray-600", text: "text-white", dot: "bg-gray-600" },
};

// ─── Delete Reason Badge ───

function DeleteReasonBadge({ reason }: { reason: string }) {
  const config: Record<string, { label: string; variant: any; icon: any }> = {
    ADMIN_DELETED: { label: "Admin Deleted", variant: "destructive", icon: Trash2 },
    USER_REQUESTED: { label: "User Requested", variant: "secondary", icon: UserX },
    SYSTEM_ACTION: { label: "System Action", variant: "outline", icon: AlertCircle },
    EXPIRED: { label: "Expired", variant: "warning", icon: Clock },
    DUPLICATE: { label: "Duplicate", variant: "secondary", icon: Ban },
  };

  const cfg = config[reason] || config.SYSTEM_ACTION;
  const Icon = cfg.icon;

  return (
    <Badge variant={cfg.variant} className="gap-1 text-[10px]">
      <Icon className="size-3" />
      {cfg.label}
    </Badge>
  );
}

// ─── Restore Dialog ───

function RestoreDialog({
  open,
  onOpenChange,
  ticket,
  onRestore,
  isRestoring,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ticket: any;
  onRestore: () => void;
  isRestoring: boolean;
}) {
  if (!ticket) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="size-5 text-primary" />
            Restore Ticket
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to restore <strong>{ticket.ticketNumber}</strong>?
            This will move the ticket back to active status.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">{ticket.subject}</span>
              <StatusBadge status={ticket.status.toLowerCase()} />
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="font-mono">{ticket.ticketNumber}</span>
              <span>·</span>
              <span>Deleted {formatDistanceToNow(new Date(ticket.deletedAt), { addSuffix: true })}</span>
            </div>
          </div>
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-sm text-amber-600 dark:text-amber-400 flex items-start gap-2">
            <AlertTriangle className="size-4 shrink-0 mt-0.5" />
            <p>Restoring this ticket will make it active again and visible to all support staff.</p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onRestore} disabled={isRestoring} className="gap-1.5">
            {isRestoring ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Restoring...
              </>
            ) : (
              <>
                <RotateCcw className="size-4" />
                Restore Ticket
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Permanent Delete Dialog ───

function PermanentDeleteDialog({
  open,
  onOpenChange,
  ticket,
  onDelete,
  isDeleting,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ticket: any;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  if (!ticket) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="size-5" />
            Permanently Delete Ticket
          </DialogTitle>
          <DialogDescription>
            This action <strong>cannot be undone</strong>. Are you sure you want to permanently
            delete <strong>{ticket.ticketNumber}</strong>?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">{ticket.subject}</span>
              <StatusBadge status={ticket.status.toLowerCase()} />
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="font-mono">{ticket.ticketNumber}</span>
              <span>·</span>
              <span>Deleted {formatDistanceToNow(new Date(ticket.deletedAt), { addSuffix: true })}</span>
            </div>
          </div>
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive flex items-start gap-2">
            <AlertTriangle className="size-4 shrink-0 mt-0.5" />
            <p>This will permanently remove all ticket data, messages, and history.</p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onDelete} disabled={isDeleting} className="gap-1.5">
            {isDeleting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="size-4" />
                Delete Permanently
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ───

function DeletedTicketsPage() {
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [priorityFilter, setPriorityFilter] = useState<string>("");
  const [deletedByFilter, setDeletedByFilter] = useState<string>("");
  const [sortBy, setSortBy] = useState<"deletedAt" | "createdAt" | "status">("deletedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // ─── Dialog states ───
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);

  const navigate = useNavigate();

  const pageSize = 15;

  // ─── Data fetching ───
  const { data, isLoading, refetch, error } = useDeletedSupportTickets({
    page,
    limit: pageSize,
    search: debouncedSearch || undefined,
    status: statusFilter || undefined,
    priority: priorityFilter || undefined,
    deletedBy: deletedByFilter || undefined,
    sortBy,
    sortDir,
  });

  const restoreMutation = useRestoreSupportTicket();
  const permanentDeleteMutation = usePermanentlyDeleteSupportTicket();

  const tickets = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // ─── Stats ───
  const stats = useMemo(() => {
    const totalDeleted = total;
    const resolvedDeleted = tickets.filter((t: any) => t.status === "RESOLVED").length;
    const criticalDeleted = tickets.filter((t: any) => t.priority === "CRITICAL").length;
    const todayDeleted = tickets.filter(
      (t: any) => new Date(t.deletedAt).toDateString() === new Date().toDateString()
    ).length;

    return { totalDeleted, resolvedDeleted, criticalDeleted, todayDeleted };
  }, [tickets, total]);

  // ─── Handlers ───
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
      toast.success("Deleted tickets refreshed");
    } catch {
      toast.error("Failed to refresh deleted tickets");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleExport = () => {
    if (tickets.length === 0) {
      toast.error("No data to export");
      return;
    }
    setIsExporting(true);
    try {
      const csv = [
        ["Ticket", "Subject", "Priority", "Status", "Deleted By", "Deleted At", "Original Created", "Reason"],
        ...tickets.map((t: any) => [
          t.ticketNumber,
          `"${t.subject.replace(/"/g, '""')}"`,
          t.priority,
          t.status,
          t.deletedBy?.name || "System",
          t.deletedAt,
          t.createdAt,
          t.deleteReason || "—",
        ]),
      ]
        .map((row) => row.join(","))
        .join("\n");

      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `deleted-tickets-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${tickets.length} deleted tickets`);
    } catch {
      toast.error("Export failed");
    } finally {
      setIsExporting(false);
    }
  };

  const handleRestore = async () => {
    if (!selectedTicket) return;

    restoreMutation.mutate(selectedTicket.id, {
      onSuccess: () => {
        toast.success(`Ticket ${selectedTicket.ticketNumber} restored successfully`);
        setRestoreDialogOpen(false);
        setSelectedTicket(null);
        refetch();
      },
      onError: (error: any) => {
        toast.error(`Failed to restore ticket: ${error?.message || "Unknown error"}`);
      },
    });
  };

  const handlePermanentDelete = async () => {
    if (!selectedTicket) return;

    permanentDeleteMutation.mutate(selectedTicket.id, {
      onSuccess: () => {
        toast.success(`Ticket ${selectedTicket.ticketNumber} permanently deleted`);
        setDeleteDialogOpen(false);
        setSelectedTicket(null);
        refetch();
      },
      onError: (error: any) => {
        toast.error(`Failed to delete ticket permanently: ${error?.message || "Unknown error"}`);
      },
    });
  };

  const openRestoreDialog = (ticket: any) => {
    setSelectedTicket(ticket);
    setRestoreDialogOpen(true);
  };

  const openDeleteDialog = (ticket: any) => {
    setSelectedTicket(ticket);
    setDeleteDialogOpen(true);
  };

  const toggleSort = (field: "deletedAt" | "createdAt" | "status") => {
    if (sortBy === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortDir("desc");
    }
  };

  const clearFilters = () => {
    setSearchQuery("");
    setDebouncedSearch("");
    setStatusFilter("");
    setPriorityFilter("");
    setDeletedByFilter("");
    setSortBy("deletedAt");
    setSortDir("desc");
    setPage(1);
  };

  const hasFilters = debouncedSearch || statusFilter || priorityFilter || deletedByFilter;

  // ─── Debounce search ───
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    const timer = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  };

  const getPageNumbers = () => {
    const nums: (number | string)[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) nums.push(i);
    } else if (page <= 3) {
      nums.push(1, 2, 3, "...", totalPages);
    } else if (page >= totalPages - 2) {
      nums.push(1, "...", totalPages - 2, totalPages - 1, totalPages);
    } else {
      nums.push(1, "...", page, "...", totalPages);
    }
    return nums;
  };

  return (
    <PermissionGuard resource="support" action="read">
      <div className="space-y-6">
        {/* ─── Page Header ─── */}
        <PageHeader
          eyebrow="Support"
          title="Deleted Tickets"
          description="View and manage tickets that have been soft-deleted. Tickets remain here for 30 days before permanent deletion."
          actions={
            <div className="flex items-center gap-2">
  {/* Back button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 "
                    onClick={() => navigate({
                      to: '/support/tickets',
                      replace: true,
                    })}
                  >
                    <ArrowLeftIcon className="size-4" />
                    Back
                  </Button>
                </TooltipTrigger>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                  >
                    <RefreshCw className={cn("size-4", isRefreshing && "animate-spin")} />
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
                    onClick={handleExport}
                    disabled={isExporting || tickets.length === 0}
                  >
                    {isExporting ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Download className="size-4" />
                    )}
                    <span className="hidden sm:inline">
                      {isExporting ? "Exporting..." : "Export"}
                    </span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Export to CSV</TooltipContent>
              </Tooltip>
            </div>
          }
        />

        {/* ─── Stats Row ─── */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard
            label="Deleted Tickets"
            value={stats.totalDeleted}
            icon={Trash2}
            tone="destructive"
            loading={isLoading}
          />
          <StatCard
            label="Resolved Deleted"
            value={stats.resolvedDeleted}
            icon={CheckCircle2}
            tone="success"
            loading={isLoading}
          />
          <StatCard
            label="Critical Deleted"
            value={stats.criticalDeleted}
            icon={AlertTriangle}
            tone="destructive"
            loading={isLoading}
          />
          <StatCard
            label="Deleted Today"
            value={stats.todayDeleted}
            icon={Clock}
            tone="warning"
            loading={isLoading}
          />
        </div>

        {/* ─── Filters ─── */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-wrap items-end gap-2 w-full">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search ticket #, subject, customer..."
                className="pl-9 h-9"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setDebouncedSearch("");
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[150px] h-9">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Status</SelectItem>
                {Object.keys(STATUS_CONFIG).map((s) => (
                  <SelectItem key={s} value={s}>
                    <span className="flex items-center gap-2">
                      <span className={cn("size-1.5 rounded-full", STATUS_CONFIG[s].dot)} />
                      {STATUS_CONFIG[s].label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={priorityFilter} onValueChange={(v) => { setPriorityFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[150px] h-9">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Priorities</SelectItem>
                {Object.keys(PRIORITY_CONFIG).map((p) => (
                  <SelectItem key={p} value={p}>
                    <span className="flex items-center gap-2">
                      <span className={cn("size-1.5 rounded-full", PRIORITY_CONFIG[p].dot)} />
                      {PRIORITY_CONFIG[p].label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={deletedByFilter} onValueChange={(v) => { setDeletedByFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[170px] h-9">
                <User className="mr-2 size-4 opacity-70" />
                <SelectValue placeholder="Deleted By" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All</SelectItem>
                <SelectItem value="system">System</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="user">User</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end gap-2">
            {hasFilters && (
              <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={clearFilters}>
                <X className="size-3.5" />
                Reset
              </Button>
            )}
          </div>
        </div>

        {/* ─── Tickets Table ─── */}
        <SectionCard
          title={`${total} Deleted Tickets`}
          description="Soft-deleted tickets awaiting permanent deletion or restoration"
          padded={false}
        >
          {error ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <AlertCircle className="size-12 text-destructive/50 mb-4" />
              <p className="text-sm font-medium text-destructive">Failed to load deleted tickets</p>
              <p className="text-xs text-muted-foreground mt-1">
                {error instanceof Error ? error.message : "An unexpected error occurred"}
              </p>
              <Button variant="outline" className="mt-4" onClick={() => refetch()}>
                Try again
              </Button>
            </div>
          ) : isLoading ? (
            <div className="p-5">
              <ChartSkeleton />
            </div>
          ) : tickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 grid size-16 place-items-center rounded-full bg-primary/10">
                <Trash2 className="size-8 text-primary/50" />
              </div>
              <p className="text-sm font-medium">No deleted tickets found</p>
              <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                {hasFilters
                  ? "Try adjusting your search or filters to find what you're looking for."
                  : "Tickets that are soft-deleted will appear here."}
              </p>
              {hasFilters && (
                <Button size="sm" variant="outline" className="mt-4 gap-1.5" onClick={clearFilters}>
                  <X className="size-3.5" />
                  Clear filters
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground w-28">
                      Ticket
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground min-w-[150px]">
                      Subject
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground w-20">
                      Priority
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground w-36">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground w-40">
                      Deleted By
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground w-32"
                      onClick={() => toggleSort("deletedAt")}
                    >
                      <div className="flex items-center gap-1">
                        Deleted At
                        <ArrowUpDown className="size-3" />
                        {sortBy === "deletedAt" && (
                          <span className="text-[10px]">{sortDir === "asc" ? "↑" : "↓"}</span>
                        )}
                      </div>
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground w-24">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {tickets.map((ticket: any) => {
                    const priorityCfg = PRIORITY_CONFIG[ticket.priority];
                    const statusCfg = STATUS_CONFIG[ticket.status];

                    return (
                      <tr key={ticket.id} className="group hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs text-muted-foreground">
                            {ticket.ticketNumber}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-[12px] truncate max-w-[260px]">
                            {ticket.subject}
                          </p>
                          <p className="text-xs text-muted-foreground truncate max-w-[260px]">
                            {ticket.message}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          {priorityCfg && (
                            <span
                              className={cn(
                                "inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                                priorityCfg.bg,
                                priorityCfg.text
                              )}
                            >
                              {priorityCfg.label}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {statusCfg && (
                            <span
                              className={cn(
                                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
                                statusCfg.bg,
                                statusCfg.text,
                                statusCfg.border
                              )}
                            >
                              <span className={cn("size-1.5 rounded-full", statusCfg.dot)} />
                              {statusCfg.label}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {ticket.deletedBy ? (
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={avatarUrl(ticket.deletedBy.avatar || "")} />
                                <AvatarFallback className="text-[10px]">
                                  {ticket.deletedBy.name?.charAt(0) ?? "?"}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="text-xs font-medium truncate max-w-[80px]">
                                  {ticket.deletedBy.name}
                                </p>
                                <p className="text-[10px] text-muted-foreground truncate max-w-[80px]">
                                  {ticket.deletedBy.email}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <Badge variant="secondary" className="text-[10px]">
                              System
                            </Badge>
                          )}
                          {ticket.deleteReason && (
                            <div className="mt-1">
                              <DeleteReasonBadge reason={ticket.deleteReason} />
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Clock className="size-3" />
                            {formatDistanceToNow(new Date(ticket.deletedAt), { addSuffix: true })}
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            Original: {formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true })}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0 opacity-100 group-hover:opacity-100 transition-opacity"
                                  onClick={() => openRestoreDialog(ticket)}
                                >
                                  <RotateCcw className="size-4 text-emerald-500" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Restore ticket</TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0 opacity-100 group-hover:opacity-100 transition-opacity"
                                  onClick={() => openDeleteDialog(ticket)}
                                >
                                  <Trash2 className="size-4 text-destructive" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Permanently delete</TooltipContent>
                            </Tooltip>

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7">
                                  <MoreVertical className="size-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem onClick={() => openRestoreDialog(ticket)}>
                                  <RotateCcw className="mr-2 size-3.5 text-emerald-500" />
                                  Restore
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => openDeleteDialog(ticket)}
                                  className="text-destructive"
                                >
                                  <Trash2 className="mr-2 size-3.5" />
                                  Delete Permanently
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ─── Pagination ─── */}
          {total > pageSize && (
            <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-3">
                <span>
                  {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8"
                      disabled={page <= 1}
                      onClick={() => setPage(1)}
                    >
                      <ChevronFirst className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>First page</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8"
                      disabled={page <= 1}
                      onClick={() => setPage(page - 1)}
                    >
                      <ChevronLeft className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Previous page</TooltipContent>
                </Tooltip>
                {getPageNumbers().map((num, idx) =>
                  num === "..." ? (
                    <span key={idx} className="px-2 text-muted-foreground">
                      ...
                    </span>
                  ) : (
                    <Button
                      key={idx}
                      variant="outline"
                      size="icon"
                      className={cn(
                        "size-8",
                        page === num
                          ? "bg-primary text-primary-foreground hover:bg-primary/90"
                          : ""
                      )}
                      onClick={() => setPage(num as number)}
                    >
                      {num}
                    </Button>
                  )
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8"
                      disabled={page >= totalPages}
                      onClick={() => setPage(page + 1)}
                    >
                      <ChevronRight className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Next page</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8"
                      disabled={page >= totalPages}
                      onClick={() => setPage(totalPages)}
                    >
                      <ChevronLast className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Last page</TooltipContent>
                </Tooltip>
              </div>
            </div>
          )}
        </SectionCard>
      </div>

      {/* ─── Restore Dialog ─── */}
      <RestoreDialog
        open={restoreDialogOpen}
        onOpenChange={setRestoreDialogOpen}
        ticket={selectedTicket}
        onRestore={handleRestore}
        isRestoring={restoreMutation.isPending}
      />

      {/* ─── Permanent Delete Dialog ─── */}
      <PermanentDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        ticket={selectedTicket}
        onDelete={handlePermanentDelete}
        isDeleting={permanentDeleteMutation.isPending}
      />
    </PermissionGuard>
  );
}