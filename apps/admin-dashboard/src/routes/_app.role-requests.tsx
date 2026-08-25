import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useCallback } from "react";
import {
  RefreshCw,
  Download,
  Check,
  X,
  Copy,
  CheckCheck,
  Shield,
  Clock,
  AlertCircle,
  History,
  User,
  Loader2,
  Search,
  Ban,
  UserCheck,
  Users,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

import { ListPage } from "@/components/dashboard/list-page";
import { StatusBadge } from "@/components/dashboard/status-badge";
import {
  useRoleRequests,
  useRoleRequest,
  useApproveRoleRequest,
  useRejectRoleRequest,
  useBulkApproveRoleRequests,
  useBulkRejectRoleRequests,
  type RoleRequest,
  type RoleRequestStatus,
  type RoleRequestType,
} from "@/lib/api/hooks";
import { useAuth } from "@/lib/auth/context";
import { cn } from "@/lib/utils";

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/stat-card";

export const Route = createFileRoute("/_app/role-requests")({
  head: () => ({
    meta: [{ title: "Role Requests · Vellbase Admin" }],
  }),
  component: RoleRequestsAdminPage,
});

type StatusFilter = RoleRequestStatus | "ALL";
type TypeFilter = RoleRequestType | "ALL";
type SortKey = "requestedRoleKey" | "createdAt" | "status";
type SortDir = "asc" | "desc";

const JUSTIFICATION_MIN = 5;
const JUSTIFICATION_PREVIEW = 60;

function mapStatusToBadgeVariant(s: RoleRequestStatus): string {
  switch (s) {
    case "PENDING":
      return "invited";
    case "APPROVED":
      return "active";
    case "REJECTED":
      return "revoked";
    case "EXPIRED":
      return "suspended";
  }
}

function formatRoleKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function truncate(text: string, n: number): string {
  if (text.length <= n) return text;
  return text.slice(0, n - 1).trimEnd() + "\u2026";
}

type ListPageColumn = {
  key: string;
  header: React.ReactNode;
  cell: (row: RoleRequest) => React.ReactNode;
  className?: string;
  headerClassName?: string;
  sortable?: SortKey;
};

function RoleRequestsAdminPage() {
  const { user: currentUser } = useAuth();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");

  const [sortKey, setSortKey] = useState<SortKey | null>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const [detailRequest, setDetailRequest] = useState<RoleRequest | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const detailQuery = useRoleRequest(detailRequest?.id ?? "");

  const [approveTarget, setApproveTarget] = useState<RoleRequest | null>(null);
  const [rejectTarget, setRejectTarget] = useState<RoleRequest | null>(null);
  const [approveJustification, setApproveJustification] = useState("");
  const [rejectJustification, setRejectJustification] = useState("");

  const [bulkApproveOpen, setBulkApproveOpen] = useState(false);
  const [bulkRejectOpen, setBulkRejectOpen] = useState(false);
  const [bulkApproveJustification, setBulkApproveJustification] = useState("");
  const [bulkRejectJustification, setBulkRejectJustification] = useState("");

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const params = useMemo(() => {
    const p: Parameters<typeof useRoleRequests>[0] = {
      page: 1,
      limit: 200,
    };
    if (statusFilter !== "ALL") p.status = statusFilter;
    return p;
  }, [statusFilter]);

  const { data, isLoading, refetch, error } = useRoleRequests(params);

  const rows = data?.data ?? [];

  const approveMutation = useApproveRoleRequest();
  const rejectMutation = useRejectRoleRequest();
  const bulkApproveMutation = useBulkApproveRoleRequests();
  const bulkRejectMutation = useBulkRejectRoleRequests();

  const pendingCount = useMemo(() => rows.filter((r) => r.status === "PENDING").length, [rows]);

  const processedRows = useMemo(() => {
    let result = rows;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((r) => {
        const requesterName = r.requester?.name?.toLowerCase() ?? "";
        const requesterEmail = r.requester?.email?.toLowerCase() ?? "";
        const role = r.requestedRoleKey.toLowerCase();
        return requesterName.includes(q) || requesterEmail.includes(q) || role.includes(q);
      });
    }

    if (typeFilter !== "ALL") {
      result = result.filter((r) => r.type === typeFilter);
    }

    if (sortKey) {
      const sorted = [...result].sort((a, b) => {
        let cmp = 0;
        switch (sortKey) {
          case "requestedRoleKey":
            cmp = a.requestedRoleKey.localeCompare(b.requestedRoleKey);
            break;
          case "createdAt":
            cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            break;
          case "status":
            cmp = a.status.localeCompare(b.status);
            break;
        }
        return sortDir === "asc" ? cmp : -cmp;
      });
      result = sorted;
    }

    return result;
  }, [rows, searchQuery, typeFilter, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const handleCopy = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      setCopiedId(id);
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500);
      toast.success("Copied request ID");
    } catch {
      toast.error("Copy failed");
    }
  };

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refetch();
      toast.success("Refreshed requests");
    } catch {
      toast.error("Failed to refresh");
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch]);

  const handleExport = useCallback(() => {
    if (processedRows.length === 0) {
      toast.error("No data to export");
      return;
    }
    setIsExporting(true);
    try {
      const headers = [
        "Request ID",
        "Requester Name",
        "Requester Email",
        "Requested Role",
        "Type",
        "Status",
        "Submitted At",
        "Starts At",
        "Expires At",
        "Justification",
        "Admin Justification",
      ];
      const csvRows = [headers.join(",")];
      for (const r of processedRows) {
        const line = [
          r.id,
          `"${(r.requester?.name ?? "").replace(/"/g, '""')}"`,
          r.requester?.email ?? "",
          r.requestedRoleKey,
          r.type,
          r.status,
          r.createdAt,
          r.startsAt ?? "",
          r.expiresAt ?? "",
          `"${r.justification.replace(/"/g, '""')}"`,
          `"${(r.adminJustification ?? "").replace(/"/g, '""')}"`,
        ];
        csvRows.push(line.join(","));
      }
      const blob = new Blob([csvRows.join("\n")], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `role-requests-${format(new Date(), "yyyy-MM-dd-HHmmss")}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${processedRows.length} requests`);
    } catch {
      toast.error("Export failed");
    } finally {
      setIsExporting(false);
    }
  }, [processedRows]);

  const openApproveDialog = (r: RoleRequest) => {
    setApproveTarget(r);
    setApproveJustification("");
  };

  const openRejectDialog = (r: RoleRequest) => {
    setRejectTarget(r);
    setRejectJustification("");
  };

  const handleConfirmApprove = () => {
    if (!approveTarget) return;
    approveMutation.mutate(
      {
        id: approveTarget.id,
        adminJustification: approveJustification.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success(`Approved ${approveTarget.requester?.name ?? "user"}'s role request`);
          setApproveTarget(null);
          setApproveJustification("");
        },
        onError: (e) => {
          toast.error("Failed to approve: " + ((e as Error).message ?? "Unknown error"));
        },
      },
    );
  };

  const rejectValid = rejectJustification.trim().length >= JUSTIFICATION_MIN;

  const handleConfirmReject = () => {
    if (!rejectTarget || !rejectValid) return;
    rejectMutation.mutate(
      {
        id: rejectTarget.id,
        adminJustification: rejectJustification.trim(),
      },
      {
        onSuccess: () => {
          toast.success("Rejected role request");
          setRejectTarget(null);
          setRejectJustification("");
        },
        onError: (e) => {
          toast.error("Failed to reject: " + ((e as Error).message ?? "Unknown error"));
        },
      },
    );
  };

  const handleBulkApproveConfirm = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    bulkApproveMutation.mutate(
      {
        ids,
        adminJustification: bulkApproveJustification.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success(`Approved ${ids.length} role requests`);
          setBulkApproveOpen(false);
          setBulkApproveJustification("");
          setSelectedIds(new Set());
        },
        onError: (e) => {
          toast.error("Bulk approve failed: " + ((e as Error).message ?? "Unknown error"));
        },
      },
    );
  };

  const bulkRejectValid = bulkRejectJustification.trim().length >= JUSTIFICATION_MIN;

  const handleBulkRejectConfirm = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0 || !bulkRejectValid) return;
    bulkRejectMutation.mutate(
      {
        ids,
        adminJustification: bulkRejectJustification.trim(),
      },
      {
        onSuccess: () => {
          toast.success(`Rejected ${ids.length} role requests`);
          setBulkRejectOpen(false);
          setBulkRejectJustification("");
          setSelectedIds(new Set());
        },
        onError: (e) => {
          toast.error("Bulk reject failed: " + ((e as Error).message ?? "Unknown error"));
        },
      },
    );
  };

  const openDetail = (r: RoleRequest) => {
    setDetailRequest(r);
    setDetailOpen(true);
  };

  const resolvedDetail =
    detailQuery.data && detailQuery.data.history ? detailQuery.data : detailRequest;
  const history = resolvedDetail?.history ?? [];
  const detailLoading = detailQuery.isFetching;

  const isSelf = (r: RoleRequest) => currentUser?.id === r.requesterId;
  const isActable = (r: RoleRequest) => r.status === "PENDING";

  const SortIndicator = ({ column }: { column: SortKey }) => {
    const active = sortKey === column;
    const dir = active ? sortDir : null;
    return (
      <span
        className={cn(
          "ml-1 inline-flex text-[10px]",
          active ? "text-foreground" : "text-muted-foreground/40",
        )}
      >
        {dir === "asc" ? "\u25B2" : dir === "desc" ? "\u25BC" : "\u25BD"}
      </span>
    );
  };

  const columns: ListPageColumn[] = [
    {
      key: "id",
      header: "Request ID",
      headerClassName: "w-36",
      cell: (r) => (
        <div className="flex items-center gap-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <code className="font-mono text-[11px] text-muted-foreground block max-w-[110px] truncate">
                {r.id.slice(0, 8)}&hellip;
              </code>
            </TooltipTrigger>
            <TooltipContent className="font-mono text-xs">{r.id}</TooltipContent>
          </Tooltip>
          <Button
            variant="ghost"
            size="icon"
            className="size-6 opacity-60 hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              void handleCopy(r.id);
            }}
          >
            {copiedId === r.id ? (
              <CheckCheck className="size-3 text-success" />
            ) : (
              <Copy className="size-3" />
            )}
          </Button>
        </div>
      ),
    },
    {
      key: "requester",
      header: "Requester",
      cell: (r) => (
        <div className="flex items-center gap-3 min-w-0">
          <Avatar className="size-8 shrink-0">
            <AvatarImage src={r.requester?.avatar ?? ""} alt={r.requester?.name ?? "?"} />
            <AvatarFallback className="bg-primary/10 text-primary text-[11px] font-medium">
              {r.requester?.name?.[0]?.toUpperCase() ?? "?"}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium truncate">{r.requester?.name ?? "Unknown"}</span>
              {isSelf(r) && (
                <Badge
                  variant="outline"
                  className="h-4 text-[10px] px-1 border-dashed text-muted-foreground"
                >
                  you
                </Badge>
              )}
            </div>
            <div className="truncate text-xs text-muted-foreground">{r.requester?.email ?? ""}</div>
          </div>
        </div>
      ),
    },
    {
      key: "requestedRoleKey",
      sortable: "requestedRoleKey",
      header: (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleSort("requestedRoleKey");
          }}
          className="inline-flex items-center text-left font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
        >
          Requested Role
          <SortIndicator column="requestedRoleKey" />
        </button>
      ),
      cell: (r) => (
        <Badge variant="outline" className="text-xs rounded-sm">
          {formatRoleKey(r.requestedRoleKey)}
        </Badge>
      ),
    },
    {
      key: "type",
      header: "Type",
      cell: (r) => (
        <div className="space-y-0.5">
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
              r.type === "PERMANENT"
                ? "bg-primary/10 text-primary"
                : "bg-amber-500/15 text-amber-600 dark:text-amber-500",
            )}
          >
            <span className="mr-1 inline-flex">
              {r.type === "PERMANENT" ? (
                <Shield className="size-2.5" />
              ) : (
                <Clock className="size-2.5" />
              )}
            </span>
            {r.type === "PERMANENT" ? "Permanent" : "Temporary"}
          </span>
          {r.type === "TEMPORARY" && (r.startsAt || r.expiresAt) && (
            <div className="text-[11px] text-muted-foreground leading-snug">
              {r.startsAt && format(new Date(r.startsAt), "MMM d, HH:mm")}
              {" \u2192 "}
              {r.expiresAt && format(new Date(r.expiresAt), "MMM d, HH:mm")}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "createdAt",
      sortable: "createdAt",
      header: (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleSort("createdAt");
          }}
          className="inline-flex items-center text-left font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
        >
          Submitted
          <SortIndicator column="createdAt" />
        </button>
      ),
      cell: (r) => (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-xs text-muted-foreground cursor-help tabular-nums whitespace-nowrap">
              {formatDistanceToNow(new Date(r.createdAt), {
                addSuffix: true,
              })}
            </span>
          </TooltipTrigger>
          <TooltipContent>{format(new Date(r.createdAt), "PPP p")}</TooltipContent>
        </Tooltip>
      ),
    },
    {
      key: "status",
      sortable: "status",
      header: (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleSort("status");
          }}
          className="inline-flex items-center text-left font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
        >
          Status
          <SortIndicator column="status" />
        </button>
      ),
      cell: (r) => <StatusBadge status={mapStatusToBadgeVariant(r.status)} />,
    },
    {
      key: "justification",
      header: "Justification",
      cell: (r) => (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-xs text-muted-foreground block max-w-[200px] truncate cursor-help">
              {truncate(r.justification, JUSTIFICATION_PREVIEW)}
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs whitespace-normal">{r.justification}</TooltipContent>
        </Tooltip>
      ),
    },
  ];

  const listPageColumns = columns as unknown as NonNullable<
    Parameters<typeof ListPage<RoleRequest>>[0]["columns"]
  >;

  const filtersBar = (
    <>
      <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
        <SelectTrigger className="w-[160px] h-8 text-xs">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All statuses</SelectItem>
          <SelectItem value="PENDING">Pending</SelectItem>
          <SelectItem value="APPROVED">Approved</SelectItem>
          <SelectItem value="REJECTED">Rejected</SelectItem>
          <SelectItem value="EXPIRED">Expired</SelectItem>
        </SelectContent>
      </Select>

      <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as TypeFilter)}>
        <SelectTrigger className="w-[160px] h-8 text-xs">
          <SelectValue placeholder="Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All types</SelectItem>
          <SelectItem value="PERMANENT">Permanent</SelectItem>
          <SelectItem value="TEMPORARY">Temporary</SelectItem>
        </SelectContent>
      </Select>
    </>
  );

  const headerActions = (
    <div className="flex items-center gap-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="relative inline-flex">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => void handleRefresh()}
              disabled={isRefreshing}
            >
              <RefreshCw className={cn("size-4", isRefreshing && "animate-spin")} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            {pendingCount > 0 && (
              <Badge className="absolute -top-1.5 -right-1.5 h-5 min-w-[20px] p-0 flex items-center justify-center rounded-full text-[10px] bg-info text-info-foreground border-info-foreground/20">
                {pendingCount > 99 ? "99+" : pendingCount}
              </Badge>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          Refresh requests
          {pendingCount > 0 && ` (${pendingCount} pending)`}
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => void handleExport()}
            disabled={isExporting || processedRows.length === 0}
          >
            {isExporting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            <span className="hidden sm:inline">{isExporting ? "Exporting..." : "Export CSV"}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Export filtered results to CSV</TooltipContent>
      </Tooltip>
    </div>
  );

  const finalBulkActions = [
    {
      label: `Approve ${selectedIds.size}`,
      icon: Check,
      variant: "default" as const,
      onClick: () => {
        setBulkApproveJustification("");
        setBulkApproveOpen(true);
      },
    },
    {
      label: `Reject ${selectedIds.size}`,
      icon: X,
      variant: "destructive" as const,
      onClick: () => {
        setBulkRejectJustification("");
        setBulkRejectOpen(true);
      },
    },
  ];

  const headerSection = (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-6">
      <StatCard
        label="Total Requests"
        value={rows.length}
        icon={Users}
        tone="primary"
      />
      <StatCard
        label="Pending Review"
        value={pendingCount}
        icon={Clock}
        tone="warning"
        delta={pendingCount > 0 ? "Action required" : undefined}
      />
      <StatCard
        label="Approved"
        value={rows.filter((r) => r.status === "APPROVED").length}
        icon={UserCheck}
        tone="success"
      />
      <StatCard
        label="Rejected"
        value={rows.filter((r) => r.status === "REJECTED").length}
        icon={Ban}
        tone="destructive"
      />
    </div>
  );

  return (
    <div className="space-y-6">

      <ListPage<RoleRequest>
        title="Role & Permission Requests"
        description="Review and act on requests for role and permission changes across the organization."
        eyebrow="Access Control"
        rows={processedRows}
        columns={listPageColumns}
        isLoading={isLoading}
        error={error ?? null}
        pageSize={20}
        enableSelection={true}
        enableSearch={false}
        enablePagination={true}
        selectedRows={selectedIds}
        onSelectionChange={setSelectedIds}
        onRowClick={openDetail}
        bulkActions={finalBulkActions}
        actions={headerActions}
        renderHeader={headerSection}
        filters={
          <>
            <div className="relative">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search requester or role&hellip;"
                className="w-64 h-8 text-xs pl-9 focus-visible:ring-offset-0"
              />
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            </div>
            {filtersBar}
          </>
        }
        renderRowActions={(r) => {
          const self = isSelf(r);
          const actable = isActable(r);
          const disabled = !actable || self;
          const approveTooltip = self
            ? "Self-review not allowed"
            : !actable
              ? `Already ${r.status.toLowerCase()}`
              : "Approve request";
          const rejectTooltip = self
            ? "Self-review not allowed"
            : !actable
              ? `Already ${r.status.toLowerCase()}`
              : "Reject request";

          return (
            <div className="flex items-center justify-end gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn("h-8 gap-1 px-2 md:px-2", !disabled && "hover:text-success")}
                    disabled={disabled}
                    onClick={(e) => {
                      e.stopPropagation();
                      openApproveDialog(r);
                    }}
                  >
                    <Check className="size-4" />
                    <span className="hidden md:inline text-xs">Approve</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{approveTooltip}</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn("h-8 gap-1 px-2 md:px-2", !disabled && "hover:text-destructive")}
                    disabled={disabled}
                    onClick={(e) => {
                      e.stopPropagation();
                      openRejectDialog(r);
                    }}
                  >
                    <X className="size-4" />
                    <span className="hidden md:inline text-xs">Reject</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{rejectTooltip}</TooltipContent>
              </Tooltip>
            </div>
          );
        }}
      />

      {/* List of Dialogs */}
      <Dialog open={!!approveTarget} onOpenChange={(o) => !o && setApproveTarget(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="size-5 text-success" />
              Approve role change
            </DialogTitle>
            <DialogDescription>
              Approve change to{" "}
              <span className="font-semibold text-foreground">
                {approveTarget && formatRoleKey(approveTarget.requestedRoleKey)}
              </span>{" "}
              for{" "}
              <span className="font-semibold text-foreground">
                {approveTarget?.requester?.name ?? "user"}
              </span>
              .
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label
                htmlFor="approve-justification"
                className="text-xs uppercase tracking-wider text-muted-foreground"
              >
                Admin justification{" "}
                <span className="text-muted-foreground normal-case">(optional)</span>
              </Label>
              <Textarea
                id="approve-justification"
                rows={3}
                value={approveJustification}
                onChange={(e) => setApproveJustification(e.target.value)}
                placeholder="Optionally record a note for the audit log"
                className="resize-none focus-visible:ring-offset-0"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setApproveTarget(null)}
              disabled={approveMutation.isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleConfirmApprove} disabled={approveMutation.isPending}>
              {approveMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Approving&hellip;
                </>
              ) : (
                <>
                  <Check className="size-4" /> Confirm approve
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejectTarget} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <X className="size-5 text-destructive" />
              Reject role change
            </DialogTitle>
            <DialogDescription>
              Reject{" "}
              <span className="font-semibold text-foreground">
                {rejectTarget?.requester?.name ?? "user"}
              </span>
              's request for{" "}
              <span className="font-semibold text-foreground">
                {rejectTarget && formatRoleKey(rejectTarget.requestedRoleKey)}
              </span>
              .
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label
                htmlFor="reject-justification"
                className="text-xs uppercase tracking-wider text-muted-foreground"
              >
                Admin justification{" "}
                <span className="text-rose-500 normal-case">
                  (required, min {JUSTIFICATION_MIN} chars)
                </span>
              </Label>
              <Textarea
                id="reject-justification"
                rows={3}
                value={rejectJustification}
                onChange={(e) => setRejectJustification(e.target.value)}
                placeholder="Explain the reason for rejection — this will be recorded and shared with the requester"
                className={cn(
                  "resize-none focus-visible:ring-offset-0",
                  !rejectValid &&
                  rejectJustification.length > 0 &&
                  "border-rose-500 focus-visible:ring-rose-500",
                )}
              />
              {!rejectValid && rejectJustification.length > 0 && (
                <p className="flex items-center gap-1 text-xs text-rose-500">
                  <AlertCircle className="size-3" /> Justification must be at least{" "}
                  {JUSTIFICATION_MIN} characters
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectTarget(null)}
              disabled={rejectMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmReject}
              disabled={!rejectValid || rejectMutation.isPending}
            >
              {rejectMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Rejecting&hellip;
                </>
              ) : (
                <>
                  <X className="size-4" /> Confirm reject
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkApproveOpen} onOpenChange={(o) => !o && setBulkApproveOpen(false)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="size-5 text-success" />
              Bulk approve role requests
            </DialogTitle>
            <DialogDescription>
              You are approving{" "}
              <span className="font-semibold text-foreground">{selectedIds.size}</span> selected
              request{selectedIds.size === 1 ? "" : "s"}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label
                htmlFor="bulk-approve-j"
                className="text-xs uppercase tracking-wider text-muted-foreground"
              >
                Admin justification{" "}
                <span className="text-muted-foreground normal-case">(optional)</span>
              </Label>
              <Textarea
                id="bulk-approve-j"
                rows={3}
                value={bulkApproveJustification}
                onChange={(e) => setBulkApproveJustification(e.target.value)}
                placeholder="Optional — shared reason across all approvals"
                className="resize-none focus-visible:ring-offset-0"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBulkApproveOpen(false)}
              disabled={bulkApproveMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkApproveConfirm}
              disabled={bulkApproveMutation.isPending || selectedIds.size === 0}
            >
              {bulkApproveMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Approving&hellip;
                </>
              ) : (
                <>
                  <Check className="size-4" /> Approve {selectedIds.size}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkRejectOpen} onOpenChange={(o) => !o && setBulkRejectOpen(false)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <X className="size-5 text-destructive" />
              Bulk reject role requests
            </DialogTitle>
            <DialogDescription>
              You are rejecting{" "}
              <span className="font-semibold text-foreground">{selectedIds.size}</span> selected
              request{selectedIds.size === 1 ? "" : "s"}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label
                htmlFor="bulk-reject-j"
                className="text-xs uppercase tracking-wider text-muted-foreground"
              >
                Admin justification{" "}
                <span className="text-rose-500 normal-case">
                  (required, min {JUSTIFICATION_MIN} chars)
                </span>
              </Label>
              <Textarea
                id="bulk-reject-j"
                rows={3}
                value={bulkRejectJustification}
                onChange={(e) => setBulkRejectJustification(e.target.value)}
                placeholder="Reason for rejection — recorded and shared with each requester"
                className={cn(
                  "resize-none focus-visible:ring-offset-0",
                  !bulkRejectValid &&
                  bulkRejectJustification.length > 0 &&
                  "border-rose-500 focus-visible:ring-rose-500",
                )}
              />
              {!bulkRejectValid && bulkRejectJustification.length > 0 && (
                <p className="flex items-center gap-1 text-xs text-rose-500">
                  <AlertCircle className="size-3" /> Justification must be at least{" "}
                  {JUSTIFICATION_MIN} characters
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBulkRejectOpen(false)}
              disabled={bulkRejectMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleBulkRejectConfirm}
              disabled={!bulkRejectValid || bulkRejectMutation.isPending || selectedIds.size === 0}
            >
              {bulkRejectMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Rejecting&hellip;
                </>
              ) : (
                <>
                  <X className="size-4" /> Reject {selectedIds.size}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={(o) => !o && setDetailOpen(false)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="size-5 text-muted-foreground" />
              Role request details
            </DialogTitle>
            <DialogDescription>
              Request{" "}
              <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                {detailRequest?.id}
              </code>{" "}
              &mdash; {detailRequest && formatRoleKey(detailRequest.requestedRoleKey)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg border p-4 text-sm">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-0.5">
                  Requester
                </div>
                <div className="font-medium">{detailRequest?.requester?.name ?? "Unknown"}</div>
                <div className="text-xs text-muted-foreground">
                  {detailRequest?.requester?.email ?? ""}
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-0.5">
                  Role
                </div>
                <div className="font-medium flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-xs rounded-sm">
                    {detailRequest && formatRoleKey(detailRequest.requestedRoleKey)}
                  </Badge>
                  {detailRequest && (
                    <StatusBadge status={mapStatusToBadgeVariant(detailRequest.status)} />
                  )}
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-0.5">
                  Type
                </div>
                <div className="flex items-center gap-1.5">
                  {detailRequest?.type === "PERMANENT" ? (
                    <Shield className="size-3.5 text-primary" />
                  ) : (
                    <Clock className="size-3.5 text-amber-500" />
                  )}
                  <span className="font-medium">
                    {detailRequest?.type === "PERMANENT" ? "Permanent" : "Temporary"}
                  </span>
                </div>
                {detailRequest?.type === "TEMPORARY" &&
                  (detailRequest.startsAt || detailRequest.expiresAt) && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {detailRequest.startsAt && format(new Date(detailRequest.startsAt), "PPP p")}
                      {" \u2192 "}
                      {detailRequest.expiresAt &&
                        format(new Date(detailRequest.expiresAt), "PPP p")}
                    </div>
                  )}
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-0.5">
                  Submitted
                </div>
                <div className="font-medium tabular-nums">
                  {detailRequest && format(new Date(detailRequest.createdAt), "PPP p")}
                </div>
                {detailRequest?.reviewedAt && (
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Reviewed: {format(new Date(detailRequest.reviewedAt), "PPP p")}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Requester justification
              </div>
              <Card>
                <CardContent className="p-4 text-sm whitespace-pre-wrap">
                  {detailRequest?.justification}
                </CardContent>
              </Card>
              {detailRequest?.adminJustification && (
                <>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground mt-2">
                    Admin note
                  </div>
                  <Card>
                    <CardContent className="p-4 text-sm whitespace-pre-wrap">
                      {detailRequest.adminJustification}
                    </CardContent>
                  </Card>
                </>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  History
                </div>
                {detailLoading && (
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" /> Loading events&hellip;
                  </span>
                )}
              </div>

              {history.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No history events recorded yet
                </div>
              ) : (
                <ol className="relative border-l border-border ml-3 space-y-5">
                  {history.map((evt) => (
                    <li key={evt.id} className="ml-5">
                      <span className="absolute -left-[5px] flex size-2.5 items-center justify-center rounded-full bg-border ring-4 ring-background">
                        <span
                          className={cn(
                            "size-2 rounded-full",
                            evt.transition === "APPROVED" && "bg-success",
                            evt.transition === "REJECTED" && "bg-destructive",
                            evt.transition === "EXPIRED" && "bg-warning",
                            evt.transition === "PENDING" && "bg-info",
                          )}
                        />
                      </span>
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <StatusBadge status={mapStatusToBadgeVariant(evt.transition)} />
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {format(new Date(evt.createdAt), "PPP p")}
                          </span>
                        </div>
                        <div className="text-sm">
                          {evt.actor ? (
                            <span className="flex items-center gap-2 flex-wrap">
                              <span className="inline-flex items-center gap-1">
                                <User className="size-3.5 text-muted-foreground" />
                                <span className="font-medium">{evt.actor.name}</span>
                              </span>
                              <span className="text-muted-foreground text-xs">
                                &middot; {evt.actor.email}
                              </span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs flex items-center gap-1">
                              <User className="size-3.5 opacity-50" />
                              System action
                            </span>
                          )}
                        </div>
                        {evt.reason && (
                          <div className="rounded-md bg-muted/60 border px-3 py-2 text-sm whitespace-pre-wrap">
                            {evt.reason}
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
