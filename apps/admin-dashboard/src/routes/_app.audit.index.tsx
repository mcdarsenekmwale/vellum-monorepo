import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useCallback } from "react";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Eye,
  EyeOff,
  User,
  UserCog,
  Key,
  Lock,
  Unlock,
  Trash2,
  Pencil,
  Plus,
  Minus,
  ArrowRightLeft,
  Download,
  Filter,
  Calendar,
  MapPin,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  MoreHorizontal,
  ChevronRight,
  FileJson,
  Loader2,
  Copy,
  X,
} from "lucide-react";
import { ListPage } from "@/components/dashboard/list-page";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuditLogs, type AuditLogEntry } from "@/lib/api/hooks";
import { useAuth } from "@/lib/auth/context";
import { avatarUrl } from "@/lib/avatar";
import { format, formatDistanceToNow, subDays, subWeeks, subMonths } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/audit/")({
  head: () => ({ meta: [{ title: "Audit Logs · Vellum Admin" }] }),
  component: AuditPage,
});

/* ─── Action Icon Map ─── */

const ACTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  create: Plus,
  update: Pencil,
  delete: Trash2,
  login: Key,
  logout: Unlock,
  password_change: Lock,
  role_change: UserCog,
  view: Eye,
  export: Download,
  import: ArrowRightLeft,
  settings_change: Shield,
  api_key_create: Key,
  api_key_revoke: ShieldAlert,
  user_suspend: ShieldAlert,
  user_invite: Plus,
  mfa_enabled: ShieldCheck,
  default: Shield,
};

const STATUS_ICONS = {
  success: { icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10" },
  failure: { icon: XCircle, color: "text-rose-500", bg: "bg-rose-500/10" },
  warning: { icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-500/10" },
};

const ACTION_COLORS: Record<string, { bg: string; text: string; ring: string }> = {
  create: { bg: "bg-emerald-500/10", text: "text-emerald-600", ring: "ring-emerald-500/20" },
  update: { bg: "bg-sky-500/10", text: "text-sky-600", ring: "ring-sky-500/20" },
  delete: { bg: "bg-rose-500/10", text: "text-rose-600", ring: "ring-rose-500/20" },
  login: { bg: "bg-indigo-500/10", text: "text-indigo-600", ring: "ring-indigo-500/20" },
  logout: { bg: "bg-slate-500/10", text: "text-slate-600", ring: "ring-slate-500/20" },
  password_change: { bg: "bg-amber-500/10", text: "text-amber-600", ring: "ring-amber-500/20" },
  role_change: { bg: "bg-violet-500/10", text: "text-violet-600", ring: "ring-violet-500/20" },
  view: { bg: "bg-slate-500/10", text: "text-slate-600", ring: "ring-slate-500/20" },
  export: { bg: "bg-cyan-500/10", text: "text-cyan-600", ring: "ring-cyan-500/20" },
  import: { bg: "bg-cyan-500/10", text: "text-cyan-600", ring: "ring-cyan-500/20" },
  settings_change: { bg: "bg-amber-500/10", text: "text-amber-600", ring: "ring-amber-500/20" },
  api_key_create: { bg: "bg-violet-500/10", text: "text-violet-600", ring: "ring-violet-500/20" },
  api_key_revoke: { bg: "bg-rose-500/10", text: "text-rose-600", ring: "ring-rose-500/20" },
  user_suspend: { bg: "bg-rose-500/10", text: "text-rose-600", ring: "ring-rose-500/20" },
  user_invite: { bg: "bg-pink-500/10", text: "text-pink-600", ring: "ring-pink-500/20" },
  mfa_enabled: { bg: "bg-emerald-500/10", text: "text-emerald-600", ring: "ring-emerald-500/20" },
  default: { bg: "bg-slate-500/10", text: "text-slate-600", ring: "ring-slate-500/20" },
};

const dateRangeOptions = [
  { id: "24h", label: "Last 24 hours", fn: () => subDays(new Date(), 1) },
  { id: "7d", label: "Last 7 days", fn: () => subDays(new Date(), 7) },
  { id: "30d", label: "Last 30 days", fn: () => subDays(new Date(), 30) },
  { id: "90d", label: "Last 90 days", fn: () => subDays(new Date(), 90) },
  { id: "12w", label: "Last 12 weeks", fn: () => subWeeks(new Date(), 12) },
  { id: "12m", label: "Last 12 months", fn: () => subMonths(new Date(), 12) },
  { id: "all", label: "All time", fn: () => new Date(0) },
];

interface JsonDialogState {
  open: boolean;
  title: string;
  data: any;
}

function AuditPage() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState<string>("30d");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [actorFilter, setActorFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isExporting, setIsExporting] = useState(false);
  const [jsonDialog, setJsonDialog] = useState<JsonDialogState>({
    open: false,
    title: "",
    data: null,
  });

  const { data, isLoading, error } = useAuditLogs({ limit: 200 });
  const allRows: AuditLogEntry[] = data?.data ?? [];

  const actors: { id: string; label: string }[] = Array.from(
    new Map<string, { id: string; label: string }>(
      allRows
        .filter((r) => r.user?.id)
        .map((r) => [r.user!.id, { id: r.user!.id, label: r.user!.name || r.user!.handle }])
    ).values()
  );

  const actionTypes = Array.from(new Set(allRows.map((r) => r.action))).sort();

  const filteredRows = allRows.filter((row) => {
    if (actionFilter !== "all" && row.action !== actionFilter) return false;
    if (actorFilter !== "all" && row.user?.id !== actorFilter) return false;
    if (statusFilter === "success" && !row.success) return false;
    if (statusFilter === "failure" && row.success) return false;

    if (dateRange !== "all") {
      const range = dateRangeOptions.find((o) => o.id === dateRange);
      if (range) {
        const cutoff = range.fn();
        if (new Date(row.createdAt) < cutoff) return false;
      }
    }
    return true;
  });

  const handleRowClick = useCallback(
    (row: AuditLogEntry) => {
      navigate({ to: "/audit/$entryId", params: { entryId: row.id } });
    },
    [navigate]
  );

  const handleExportCSV = useCallback(async () => {
    setIsExporting(true);
    try {
      const headers = [
        "ID",
        "Timestamp",
        "Action",
        "Resource",
        "Resource ID",
        "Actor",
        "Success",
        "IP Address",
        "Location",
        "User Agent",
        "Description",
      ];

      const escapeCsv = (val: any): string => {
        if (val === null || val === undefined) return "";
        const str = String(val);
        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const rows = filteredRows.map((row) => [
        row.id,
        row.createdAt,
        row.action,
        row.resource,
        row.resourceId || "",
        row.user ? `${row.user.name} (${row.user.handle})` : "System",
        row.success ? "Yes" : "No",
        row.ipAddress || "",
        row.location || "",
        row.userAgent || "",
        (row.metadata as any)?.description || "",
      ]);

      const csv = [headers, ...rows]
        .map((r) => r.map(escapeCsv).join(","))
        .join("\n");

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`Exported ${filteredRows.length} audit log entries`);
    } catch (err) {
      toast.error("Failed to export audit logs");
    } finally {
      setIsExporting(false);
    }
  }, [filteredRows]);

  const handleDeleteEntry = async (entryId: string) => {
    toast.info("Delete functionality requires backend implementation");
  };

  return (
    <>
      <ListPage<AuditLogEntry>
        title="Audit logs"
        description="Every privileged action performed in the console."
        eyebrow="System"
        rows={filteredRows}
        isLoading={isLoading}
        error={error}
        searchKeys={["action", "resource", "ipAddress", "userAgent"]}
        pageSize={15}
        enableSelection={true}
        enableExport={true}
        enablePagination={true}
        actions={
          <div className="flex items-center gap-2">
            {can("audit", "export") && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" className="gap-1.5" disabled={isExporting}>
                    {isExporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleExportCSV} disabled={isExporting}>
                    <Download className="size-4 mr-2" />
                    Export as CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      setJsonDialog({
                        open: true,
                        title: `Audit logs JSON (${filteredRows.length} entries)`,
                        data: filteredRows,
                      })
                    }
                  >
                    <FileJson className="size-4 mr-2" />
                    View as JSON
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        }
        filters={
          <div className="flex flex-wrap items-center gap-2">
            <FilterDropdown
              icon={Calendar}
              label="Date range"
              value={dateRange}
              onChange={setDateRange}
              options={dateRangeOptions.map((o) => ({ id: o.id, label: o.label }))}
            />
            <FilterDropdown
              icon={Filter}
              label="Action type"
              value={actionFilter}
              onChange={setActionFilter}
              options={[{ id: "all", label: "All actions" }, ...actionTypes.map((a) => ({ id: a, label: a }))]}
            />
            <FilterDropdown
              icon={User}
              label="Actor"
              value={actorFilter}
              onChange={setActorFilter}
              options={[{ id: "all", label: "All actors" }, ...actors]}
            />
            <FilterDropdown
              icon={ShieldCheck}
              label="Status"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { id: "all", label: "All statuses" },
                { id: "success", label: "Success only" },
                { id: "failure", label: "Failed only" },
              ]}
            />
          </div>
        }
        columns={[
          {
            key: "event",
            header: "Event",
            cell: (row) => {
              const ActionIcon = ACTION_ICONS[row.action] || ACTION_ICONS.default;
              const colors = ACTION_COLORS[row.action] || ACTION_COLORS.default;
              return (
                <div className="flex items-start gap-3">
                  <div className={cn("size-9 rounded-lg flex items-center justify-center ring-1", colors.bg, colors.text, colors.ring)}>
                    <ActionIcon className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium capitalize text-sm">
                      {row.action.replace(/_/g, " ")} on {row.resource}
                    </div>
                    {(row.metadata as any)?.description && (
                      <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                        {(row.metadata as any).description}
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 mt-1">
                      <Badge
                        variant={row.success ? "default" : "destructive"}
                        className="text-[10px] h-5 px-1.5"
                      >
                        {row.success ? "Success" : "Failed"}
                      </Badge>
                      {(row.metadata as any)?.severity === "critical" && (
                        <Badge variant="destructive" className="text-[10px] h-5 px-1.5">
                          Critical
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              );
            },
          },
          {
            key: "actor",
            header: "Actor",
            cell: (row) =>
              row.user ? (
                <div className="flex items-center gap-2.5">
                  <Avatar className="size-8">
                    <AvatarImage src={avatarUrl(row.user.name || row.user.handle)} />
                    <AvatarFallback className="text-xs">
                      {row.user.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="font-medium text-sm">{row.user.name}</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {row.user.role}
                    </div>
                  </div>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground italic">System</span>
              ),
          },
          {
            key: "target",
            header: "Target",
            cell: (row) => (
              <div>
                <div className="font-medium text-sm">{row.resource}</div>
                {row.resourceId && (
                  <div className="text-xs text-muted-foreground font-mono mt-0.5 truncate max-w-[120px]">
                    {row.resourceId}
                  </div>
                )}
              </div>
            ),
          },
          {
            key: "origin",
            header: "Origin",
            cell: (row) => (
              <div className="space-y-0.5">
                <div className="text-xs font-mono flex items-center gap-1.5">
                  <MapPin className="size-3 text-muted-foreground" />
                  {row.ipAddress || "Unknown"}
                </div>
                {row.location && (
                  <div className="text-xs text-muted-foreground">{row.location}</div>
                )}
              </div>
            ),
          },
          {
            key: "when",
            header: "When",
            cell: (row) => (
              <div className="text-xs">
                <div className="font-medium">
                  {format(new Date(row.createdAt), "MMM d, yyyy")}
                </div>
                <div className="text-muted-foreground">
                  {format(new Date(row.createdAt), "HH:mm:ss")}
                </div>
                <div className="text-muted-foreground mt-0.5">
                  {formatDistanceToNow(new Date(row.createdAt), { addSuffix: true })}
                </div>
              </div>
            ),
          },
        ]}
        renderRowActions={(row) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleRowClick(row)}>
                <Eye className="size-4 mr-2" />
                View details
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  setJsonDialog({
                    open: true,
                    title: `Audit log ${row.id}`,
                    data: row,
                  })
                }
              >
                <FileJson className="size-4 mr-2" />
                View JSON
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  navigator.clipboard.writeText(row.id);
                  toast.success("Entry ID copied");
                }}
              >
                <Copy className="size-4 mr-2" />
                Copy ID
              </DropdownMenuItem>
              {can("audit", "delete") && (
                <DropdownMenuItem
                  onClick={() => handleDeleteEntry(row.id)}
                  className="text-rose-600"
                >
                  <Trash2 className="size-4 mr-2" />
                  Delete entry
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        onRowClick={handleRowClick}
      />

      {/* JSON Viewer Dialog */}
      <Dialog open={jsonDialog.open} onOpenChange={(open) => setJsonDialog((prev) => ({ ...prev, open }))}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileJson className="size-5" />
              {jsonDialog.title}
            </DialogTitle>
            <DialogDescription>Raw JSON payload</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto rounded-lg bg-muted/50 p-4">
            <pre className="text-xs font-mono whitespace-pre-wrap break-words">
              {JSON.stringify(jsonDialog.data, null, 2)}
            </pre>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(jsonDialog.data, null, 2));
                toast.success("JSON copied to clipboard");
              }}
            >
              <Copy className="size-4 mr-2" />
              Copy JSON
            </Button>
            <Button variant="default" size="sm" onClick={() => setJsonDialog((prev) => ({ ...prev, open: false }))}>
              <X className="size-4 mr-2" />
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface FilterDropdownProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { id: string; label: string }[];
}

function FilterDropdown({ icon: Icon, label, value, onChange, options }: FilterDropdownProps) {
  const selected = options.find((o) => o.id === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 h-9">
          <Icon className="size-3.5" />
          <span className="text-muted-foreground">{label}:</span>
          <span className="font-medium">{selected?.label || "All"}</span>
          <ChevronRight className="size-3.5 rotate-90" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {options.map((opt) => (
          <DropdownMenuItem
            key={opt.id}
            onClick={() => onChange(opt.id)}
            className={cn(value === opt.id && "bg-accent")}
          >
            {opt.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
