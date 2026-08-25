import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Download,
  RefreshCw,
  Filter,
  X,
  FileSpreadsheet,
  AlertCircle,
  Calendar,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ShieldCheck,
  Smile,
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { SectionCard } from "@/components/dashboard/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  useSupportTicketsReport,
  useSupportDepartments,
  useSupportTeams,
  useSupportAgents,
} from "@/lib/api/hooks";
import {
  getSupportTicketsReportCsvUrl,
  type SupportTicketsReportFilters,
} from "@/lib/api/services";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

export const Route = createFileRoute("/_app/support/reports")({
  head: () => ({ meta: [{ title: "Support Reports · Vellbase Admin" }] }),
  component: SupportReportsPage,
});

const STATUS_OPTIONS = [
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

const PRIORITY_OPTIONS = ["EMERGENCY", "CRITICAL", "HIGH", "MEDIUM", "LOW"];

const STATUS_TINTS: Record<string, string> = {
  NEW: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  ASSIGNED: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  IN_PROGRESS: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  WAITING_ON_CUSTOMER: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  WAITING_ON_INTERNAL: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  ESCALATED: "bg-red-500/15 text-red-400 border-red-500/30",
  RESOLVED: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  CLOSED: "bg-gray-500/15 text-gray-400 border-gray-500/30",
  REOPENED: "bg-sky-500/15 text-sky-400 border-sky-500/30",
};

const PRIORITY_TINTS: Record<string, string> = {
  EMERGENCY: "bg-red-500/20 text-red-400 border-red-500/30",
  CRITICAL: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  HIGH: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  MEDIUM: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  LOW: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

interface ReportFiltersState extends SupportTicketsReportFilters {
  assigneeId?: string;
}

const DEFAULT_LIMIT = 25;

function SupportReportsPage() {
  const [filters, setFilters] = useState<ReportFiltersState>({
    page: 1,
    limit: DEFAULT_LIMIT,
  });
  const [showFilters, setShowFilters] = useState(true);

  const { data: deptData } = useSupportDepartments({ limit: 200, isActive: true });
  const { data: teamData } = useSupportTeams({ limit: 200, isActive: true, departmentId: filters.departmentId });
  const { data: agentData } = useSupportAgents({ limit: 200, isActive: true, departmentId: filters.departmentId });

  const queryFilters = useMemo<SupportTicketsReportFilters>(() => {
    const { assigneeId: _a, ...rest } = filters;
    return rest;
  }, [filters]);

  const { data, isLoading, isError, error, refetch } = useSupportTicketsReport(queryFilters);

  const csvUrl = useMemo(() => {
    const { page: _p, limit: _l, assigneeId, ...rest } = filters;
    return getSupportTicketsReportCsvUrl(rest);
  }, [filters]);

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const page = data?.page ?? filters.page ?? 1;
  const limit = data?.limit ?? filters.limit ?? DEFAULT_LIMIT;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const summary = data?.summary;

  const summaryByStatus = summary?.byStatus ?? {};
  const summaryByPriority = summary?.byPriority ?? {};
  const totalResolved = (summaryByStatus["RESOLVED"] ?? 0) + (summaryByStatus["CLOSED"] ?? 0);

  const appliedCount = useMemo(() => {
    let n = 0;
    for (const [k, v] of Object.entries(filters)) {
      if (k === "page" || k === "limit") continue;
      if (v !== undefined && v !== null && v !== "") n++;
    }
    return n;
  }, [filters]);

  function resetFilters() {
    setFilters({ page: 1, limit: DEFAULT_LIMIT });
  }

  function goToPage(nextPage: number) {
    const p = Math.min(Math.max(1, nextPage), totalPages);
    setFilters((f) => ({ ...f, page: p }));
  }

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = csvUrl;
    a.download = `support-tickets-report-${format(new Date(), "yyyy-MM-dd")}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Support Reports"
        description="Build filtered ticket reports, review summary KPIs, and export as CSV"
        eyebrow="Support / Reports"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="size-3.5 mr-1.5" /> Refresh
            </Button>
            <Button size="sm" onClick={handleDownload} disabled={!rows.length && !isLoading}>
              <Download className="size-3.5 mr-1.5" /> Export CSV
            </Button>
          </div>
        }
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search subject, id, reporter…"
              value={filters.search ?? ""}
              onChange={(e) =>
                setFilters((f) => ({ ...f, search: e.target.value, page: 1 }))
              }
              className="pl-8"
            />
          </div>
          <Button
            variant={showFilters ? "default" : "outline"}
            size="sm"
            onClick={() => setShowFilters((v) => !v)}
          >
            <SlidersHorizontal className="size-3.5 mr-1.5" /> Filters
            {appliedCount > 0 && (
              <Badge variant="secondary" className="ml-1 border-none px-1.5 py-0 text-[10px]">
                {appliedCount}
              </Badge>
            )}
          </Button>
        </div>
        <div className="text-xs text-muted-foreground tabular-nums">
          {total.toLocaleString()} matching ticket{total === 1 ? "" : "s"}
        </div>
      </div>

      {showFilters && (
        <SectionCard
          title="Filters"
          description="Narrow down the tickets that appear in the report"
          action={
            appliedCount > 0 ? (
              <Button size="sm" variant="ghost" onClick={resetFilters}>
                <X className="size-3.5 mr-1.5" /> Clear
              </Button>
            ) : undefined
          }
        >
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <div className="space-y-1.5">
              <Label>Department</Label>
              <Select
                value={filters.departmentId ?? ""}
                onValueChange={(v) =>
                  setFilters((f) => ({
                    ...f,
                    departmentId: v || undefined,
                    teamId: undefined,
                    page: 1,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All departments</SelectItem>
                  {(deptData?.data ?? []).map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Team</Label>
              <Select
                value={filters.teamId ?? ""}
                onValueChange={(v) =>
                  setFilters((f) => ({ ...f, teamId: v || undefined, page: 1 }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All teams" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All teams</SelectItem>
                  {(teamData?.data ?? []).map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={filters.status ?? ""}
                onValueChange={(v) =>
                  setFilters((f) => ({ ...f, status: v || undefined, page: 1 }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All statuses</SelectItem>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select
                value={filters.priority ?? ""}
                onValueChange={(v) =>
                  setFilters((f) => ({ ...f, priority: v || undefined, page: 1 }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All priorities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All priorities</SelectItem>
                  {PRIORITY_OPTIONS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Date from</Label>
              <Input
                type="date"
                value={filters.dateFrom ?? ""}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, dateFrom: e.target.value || undefined, page: 1 }))
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label>Date to</Label>
              <Input
                type="date"
                value={filters.dateTo ?? ""}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, dateTo: e.target.value || undefined, page: 1 }))
                }
              />
            </div>

            <div className="space-y-1.5 xl:col-span-3">
              <Label>Agent (assignee)</Label>
              <Select
                value={filters.assigneeId ?? ""}
                onValueChange={(v) =>
                  setFilters((f) => ({ ...f, assigneeId: v || undefined, page: 1 }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All agents" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All agents</SelectItem>
                  {(agentData?.data ?? []).map((a) => (
                    <SelectItem key={a.userId} value={a.userId}>
                      {a.user.name} <span className="text-muted-foreground ml-1">{a.user.email}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </SectionCard>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="Total Tickets"
          value={isLoading ? "…" : total.toLocaleString()}
          icon={FileSpreadsheet}
          tone="primary"
          hint={`${limit} per page · page ${page}/${totalPages}`}
          loading={isLoading}
        />
        <StatCard
          label="Resolved / Closed"
          value={isLoading ? "…" : totalResolved.toLocaleString()}
          icon={CheckCircle2}
          tone="success"
          hint={total > 0 ? `${((totalResolved / Math.max(1, total)) * 100).toFixed(1)}% of total` : undefined}
          loading={isLoading}
        />
        <StatCard
          label="SLA Response"
          value={isLoading ? "…" : (summary?.slaResponseAdherencePct != null ? `${summary.slaResponseAdherencePct.toFixed(1)}%` : "—")}
          icon={Clock}
          tone="info"
          hint="Within response SLA"
          loading={isLoading}
        />
        <StatCard
          label="SLA Resolution"
          value={isLoading ? "…" : (summary?.slaResolutionAdherencePct != null ? `${summary.slaResolutionAdherencePct.toFixed(1)}%` : "—")}
          icon={ShieldCheck}
          tone={(summary?.slaResolutionAdherencePct ?? 0) >= 90 ? "success" : (summary?.slaResolutionAdherencePct ?? 0) >= 70 ? "warning" : "default"}
          hint="Within resolution SLA"
          loading={isLoading}
        />
        <StatCard
          label="Avg CSAT"
          value={isLoading ? "…" : (summary?.avgSatisfaction != null ? `${summary.avgSatisfaction.toFixed(2)} / 5` : "—")}
          icon={Smile}
          tone={(summary?.avgSatisfaction ?? 0) >= 4.2 ? "success" : (summary?.avgSatisfaction ?? 0) >= 3.5 ? "warning" : "default"}
          hint="Customer satisfaction score"
          loading={isLoading}
        />
      </div>

      {Object.keys(summaryByPriority).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {PRIORITY_OPTIONS.filter((p) => summaryByPriority[p] != null).map((p) => (
            <Badge key={p} variant="outline" className={cn("px-2.5 py-1", PRIORITY_TINTS[p])}>
              {p}: {summaryByPriority[p].toLocaleString()}
            </Badge>
          ))}
        </div>
      )}

      {isError && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Failed to load report</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>{error instanceof Error ? error.message : "Unexpected error"}</span>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              <RefreshCw className="size-3.5 mr-1.5" /> Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <SectionCard
        title="Report rows"
        description={
          isLoading
            ? "Loading rows…"
            : `${rows.length.toLocaleString()} row${rows.length === 1 ? "" : "s"} · exported via CSV with the same filters applied`
        }
        action={
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="size-3.5 mr-1.5" /> CSV
              </Button>
            </TooltipTrigger>
            <TooltipContent>Download all matching rows as CSV</TooltipContent>
          </Tooltip>
        }
        padded={false}
      >
        {isLoading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileSpreadsheet className="size-10 text-muted-foreground mb-3" />
            <p className="text-sm font-medium">No tickets match these filters</p>
            <p className="text-xs text-muted-foreground mt-1">
              Try loosening the filters or clearing them entirely.
            </p>
            {appliedCount > 0 && (
              <Button className="mt-4" variant="outline" size="sm" onClick={resetFilters}>
                <X className="size-3.5 mr-1.5" /> Clear filters
              </Button>
            )}
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticket</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Dept / Team</TableHead>
                  <TableHead>Assignee</TableHead>
                  <TableHead>Reporter</TableHead>
                  <TableHead className="tabular-nums">CSAT</TableHead>
                  <TableHead className="tabular-nums">SLA</TableHead>
                  <TableHead className="tabular-nums">Created</TableHead>
                  <TableHead className="tabular-nums">Resolved</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id} className="align-middle">
                    <TableCell>
                      <div className="min-w-0 max-w-[220px]">
                        <div className="text-xs text-muted-foreground font-mono">#{r.id.slice(0, 8)}</div>
                        <div className="font-medium truncate">{r.subject}</div>
                        {r.type && (
                          <Badge variant="outline" className="mt-1 border-none bg-muted text-muted-foreground px-1.5 py-0 text-[10px]">
                            {r.type}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn(STATUS_TINTS[r.status] ?? "bg-muted text-muted-foreground")}>
                        {r.status.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn(PRIORITY_TINTS[r.priority] ?? "bg-muted text-muted-foreground")}>
                        {r.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {r.departmentName && <div className="font-medium">{r.departmentName}</div>}
                        {r.teamName && <div className="text-xs text-muted-foreground">{r.teamName}</div>}
                        {!r.departmentName && !r.teamName && <span className="text-muted-foreground">—</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {r.assigneeName || <span className="text-muted-foreground">Unassigned</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm truncate max-w-[140px]">
                        {r.reporterName || <span className="text-muted-foreground">—</span>}
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {r.satisfaction != null ? (
                        <span className={cn(
                          "font-medium",
                          r.satisfaction >= 4.5 ? "text-emerald-400" :
                          r.satisfaction >= 3.5 ? "text-yellow-400" :
                          "text-red-400"
                        )}>{r.satisfaction.toFixed(1)}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums text-xs">
                      <div className="flex flex-col">
                        <span className={cn(
                          r.slaMetResponse === true ? "text-emerald-400" :
                          r.slaMetResponse === false ? "text-red-400" :
                          "text-muted-foreground"
                        )}>
                          R: {r.slaMetResponse === true ? "Met" : r.slaMetResponse === false ? "Missed" : "—"}
                        </span>
                        <span className={cn(
                          r.slaMetResolution === true ? "text-emerald-400" :
                          r.slaMetResolution === false ? "text-red-400" :
                          "text-muted-foreground"
                        )}>
                          S: {r.slaMetResolution === true ? "Met" : r.slaMetResolution === false ? "Missed" : "—"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(r.createdAt), "yyyy-MM-dd HH:mm")}
                    </TableCell>
                    <TableCell className="tabular-nums text-xs text-muted-foreground whitespace-nowrap">
                      {r.resolvedAt ? format(new Date(r.resolvedAt), "yyyy-MM-dd HH:mm") : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {totalPages > 1 && (
              <div className="flex items-center justify-between gap-3 border-t px-5 py-3">
                <div className="text-xs text-muted-foreground tabular-nums">
                  Showing {((page - 1) * limit) + 1}–{Math.min(total, page * limit)} of {total.toLocaleString()}
                </div>
                <div className="flex items-center gap-1">
                  <Select
                    value={String(filters.limit ?? DEFAULT_LIMIT)}
                    onValueChange={(v) => setFilters((f) => ({ ...f, limit: Number(v), page: 1 }))}
                  >
                    <SelectTrigger className="h-8 w-[110px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[10, 25, 50, 100, 250].map((n) => (
                        <SelectItem key={n} value={String(n)}>{n} / page</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => goToPage(page - 1)}
                    disabled={page <= 1}
                  >
                    <ChevronLeft className="size-3.5" />
                  </Button>
                  <div className="px-2 text-xs tabular-nums text-muted-foreground">
                    {page} / {totalPages}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => goToPage(page + 1)}
                    disabled={page >= totalPages}
                  >
                    <ChevronRight className="size-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </SectionCard>
    </div>
  );
}

export default SupportReportsPage;
