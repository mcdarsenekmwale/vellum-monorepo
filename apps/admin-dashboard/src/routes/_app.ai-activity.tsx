import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/dashboard/page-header";
import { SectionCard } from "@/components/dashboard/section-card";
import { TableSkeleton } from "@/components/dashboard/skeletons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useAiActivity,
  type AiActivityItem,
  type AiActivityStatus,
  type AiActivityQuery,
} from "@/lib/api/hooks";
import { exportAiActivity, type ChatMessage } from "@/lib/api/services";
import type { ColumnDef } from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  Download,
  Sparkles,
  User,
  ChevronLeft,
  ChevronRight,
  Search,
  MessageSquare,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  StopCircle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/ai-activity")({
  head: () => ({ meta: [{ title: "AI Activity · Vellbase Admin" }] }),
  component: AiActivityPage,
});

/* --- Constants --- */

const PLACEMENT_OPTIONS: { value: string; label: string }[] = [
  { value: "web-profile", label: "WEB_PROFILE" },
  { value: "mobile-nav", label: "MOBILE_NAV" },
  { value: "admin-fab", label: "ADMIN_FAB" },
  { value: "admin-quick-action", label: "ADMIN_QUICK" },
];

const STATUS_OPTIONS: AiActivityStatus[] = [
  "SUCCESS",
  "STREAM_TRUNCATED",
  "ERROR",
  "RATE_LIMITED",
  "AUTH_FAILED",
];

const STATUS_STYLES: Record<
  AiActivityStatus,
  { label: string; cn: string; icon: typeof CheckCircle2 }
> = {
  SUCCESS: {
    label: "Success",
    cn: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    icon: CheckCircle2,
  },
  ERROR: {
    label: "Error",
    cn: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30",
    icon: XCircle,
  },
  RATE_LIMITED: {
    label: "Rate limited",
    cn: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
    icon: StopCircle,
  },
  STREAM_TRUNCATED: {
    label: "Truncated",
    cn: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30",
    icon: AlertTriangle,
  },
  AUTH_FAILED: {
    label: "Auth failed",
    cn: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30",
    icon: AlertTriangle,
  },
};

function timeAgo(iso: string): string {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function shortId(id: string): string {
  if (!id) return "—";
  if (id.length <= 10) return id;
  return id.slice(0, 4) + "…" + id.slice(-4);
}

/* ---- Page component ---- */

function AiActivityPage() {
  const [filters, setFilters] = useState<{
    userId: string;
    placement: string;
    status: string;
    model: string;
    since: string;
    until: string;
    page: number;
    pageSize: number;
  }>({
    userId: "",
    placement: "all",
    status: "all",
    model: "",
    since: "",
    until: "",
    page: 1,
    pageSize: 20,
  });
  const [viewing, setViewing] = useState<AiActivityItem | null>(null);
  const [exporting, setExporting] = useState(false);

  const query: AiActivityQuery = useMemo(() => {
    return {
      page: filters.page,
      pageSize: filters.pageSize,
      userId: filters.userId.trim() || undefined,
      placement: filters.placement === "all" ? undefined : filters.placement,
      status: filters.status === "all" ? undefined : (filters.status as AiActivityStatus),
      model: filters.model.trim() || undefined,
      since: filters.since || undefined,
      until: filters.until || undefined,
    };
  }, [filters]);

  const { data, isLoading, isFetching, refetch } = useAiActivity(query);

  const columns: ColumnDef<AiActivityItem>[] = useMemo(
    () => [
      {
        accessorKey: "id",
        header: "ID",
        cell: ({ row }) => (
          <span
            className="font-mono text-[11px] text-muted-foreground cursor-default"
            title={row.original.id}
          >
            {shortId(row.original.id)}
          </span>
        ),
        size: 90,
      },
      {
        accessorKey: "user",
        header: "User",
        cell: ({ row }) => {
          const u = row.original.user;
          return (
            <div className="flex items-center gap-2 min-w-0">
              <Avatar className="size-7 shrink-0 border">
                <AvatarFallback className="text-[10px]">
                  <User className="size-3.5" />
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="text-xs font-medium truncate">
                  {u?.handle ?? u?.name ?? "—"}
                </div>
                <div className="text-[10px] text-muted-foreground truncate">
                  {u?.email ?? row.original.userId.slice(0, 10)}
                </div>
              </div>
            </div>
          );
        },
        size: 180,
      },
      {
        accessorKey: "placement",
        header: "Placement",
        cell: ({ row }) => (
          <Badge variant="outline" className="text-[10px] uppercase tracking-wider font-mono">
            {row.original.placement}
          </Badge>
        ),
        size: 130,
      },
      {
        accessorKey: "model",
        header: "Model",
        cell: ({ row }) => (
          <span className="font-mono text-[11px]">{row.original.model || "—"}</span>
        ),
        size: 150,
      },
      {
        accessorKey: "tokens",
        header: "Tokens (in/out)",
        cell: ({ row }) => {
          const i = row.original.inputTokens ?? 0;
          const o = row.original.outputTokens ?? 0;
          return (
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
              {i.toLocaleString()} / {o.toLocaleString()}
            </span>
          );
        },
        size: 120,
      },
      {
        accessorKey: "durationMs",
        header: "Duration",
        cell: ({ row }) => (
          <span className="font-mono text-[11px] tabular-nums">
            {row.original.durationMs.toLocaleString()}ms
          </span>
        ),
        size: 100,
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const s = (row.original.status || "SUCCESS") as AiActivityStatus;
          const style = STATUS_STYLES[s] ?? STATUS_STYLES.SUCCESS;
          const Icon = style.icon;
          return (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium",
                style.cn
              )}
            >
              <Icon className="size-3" />
              {style.label}
            </span>
          );
        },
        size: 130,
      },
      {
        accessorKey: "errorCode",
        header: "Error",
        cell: ({ row }) => {
          if (!row.original.errorCode && !row.original.errorMessage) {
            return <span className="text-[11px] text-muted-foreground">—</span>;
          }
          return (
            <span
              className="font-mono text-[10px] text-destructive truncate max-w-[140px] block"
              title={row.original.errorMessage ?? row.original.errorCode ?? ""}
            >
              {row.original.errorCode ?? "ERROR"}
            </span>
          );
        },
        size: 130,
      },
      {
        accessorKey: "createdAt",
        header: "Created",
        cell: ({ row }) => (
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground whitespace-nowrap">
            <Clock className="size-3 opacity-60" />
            {timeAgo(row.original.createdAt)}
          </div>
        ),
        size: 90,
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 text-[11px]"
            onClick={() => setViewing(row.original)}
          >
            <MessageSquare className="size-3" />
            View messages
          </Button>
        ),
        size: 130,
      },
    ],
    []
  );

  const table = useReactTable({
    data: data?.items ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    enableColumnResizing: true,
    defaultColumn: { size: 120, minSize: 60 },
  });

  const totalPages = data?.total
    ? Math.max(1, Math.ceil(data.total / (filters.pageSize || 20)))
    : 1;

  /* ---- Actions ---- */

  const changePage = (next: number) => {
    setFilters((f) => ({ ...f, page: Math.max(1, Math.min(totalPages, next)) }));
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await exportAiActivity(query);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const stamp = new Date().toISOString().slice(0, 10);
      a.download = `ai-activity-${stamp}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Activity export downloaded");
    } catch (err) {
      toast.error(`Export failed: ${(err as Error).message || "Unknown error"}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Audit"
        title="AI Activity"
        description="Audit log of all AI placements across the platform: chat rounds, tokens, model, status and full messages."
        actions={
          <Button
            size="sm"
            variant="outline"
            onClick={handleExport}
            disabled={exporting || isLoading}
            className="gap-1.5"
          >
            {exporting ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Exporting…
              </>
            ) : (
              <>
                <Download className="size-3.5" />
                Export CSV
              </>
            )}
          </Button>
        }
      />

      {/* FILTER BAR */}
      <SectionCard padded className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="f-user" className="text-[11px] uppercase tracking-wider text-muted-foreground">
              User ID / email
            </Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
              <Input
                id="f-user"
                placeholder="user_xxx or email…"
                value={filters.userId}
                onChange={(e) => setFilters((f) => ({ ...f, userId: e.target.value, page: 1 }))}
                className="pl-8 text-sm"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f-placement" className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Placement
            </Label>
            <Select
              value={filters.placement}
              onValueChange={(v) => setFilters((f) => ({ ...f, placement: v, page: 1 }))}
            >
              <SelectTrigger id="f-placement" className="text-sm">
                <SelectValue placeholder="All placements" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All placements</SelectItem>
                {PLACEMENT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value} className="text-sm">
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f-status" className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Status
            </Label>
            <Select
              value={filters.status}
              onValueChange={(v) => setFilters((f) => ({ ...f, status: v, page: 1 }))}
            >
              <SelectTrigger id="f-status" className="text-sm">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s} className="text-sm">
                    {STATUS_STYLES[s].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f-model" className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Model (fuzzy)
            </Label>
            <Input
              id="f-model"
              placeholder="gpt-4o, claude…"
              value={filters.model}
              onChange={(e) => setFilters((f) => ({ ...f, model: e.target.value, page: 1 }))}
              className="text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f-since" className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Since (date)
            </Label>
            <Input
              id="f-since"
              type="date"
              value={filters.since}
              onChange={(e) => setFilters((f) => ({ ...f, since: e.target.value, page: 1 }))}
              className="text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f-until" className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Until (date)
            </Label>
            <Input
              id="f-until"
              type="date"
              value={filters.until}
              onChange={(e) => setFilters((f) => ({ ...f, until: e.target.value, page: 1 }))}
              className="text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f-page" className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Page size
            </Label>
            <Select
              value={String(filters.pageSize)}
              onValueChange={(v) =>
                setFilters((f) => ({ ...f, pageSize: Number(v), page: 1 }))
              }
            >
              <SelectTrigger id="f-page" className="text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 20, 50, 100].map((n) => (
                  <SelectItem key={n} value={String(n)} className="text-sm">
                    {n} / page
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setFilters({
                  userId: "",
                  placement: "all",
                  status: "all",
                  model: "",
                  since: "",
                  until: "",
                  page: 1,
                  pageSize: 20,
                })
              }
              className="flex-1"
            >
              Reset
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => refetch()}
              disabled={isFetching}
              className="gap-1.5"
            >
              {isFetching ? <Loader2 className="size-3.5 animate-spin" /> : null}
              Reload
            </Button>
          </div>
        </div>
      </SectionCard>

      {/* TABLE */}
      <SectionCard
        padded={false}
        className="overflow-hidden"
        title={
          data
            ? `${data.total.toLocaleString()} total record${data.total === 1 ? "" : "s"}`
            : undefined
        }
        description={
          data
            ? `Page ${filters.page} of ${totalPages} · showing ${data.items.length}`
            : undefined
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((h) => (
                    <th
                      key={h.id}
                      className="whitespace-nowrap px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
                      style={{ width: `${h.getSize()}px`, maxWidth: `${h.getSize()}px` }}
                    >
                      {flexRender(h.column.columnDef.header, h.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={columns.length} className="p-0">
                    <TableSkeleton rows={8} cols={columns.length} />
                  </td>
                </tr>
              ) : !data || data.items.length === 0 ? (
                <tr>
                  <td colSpan={columns.length}>
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <div className="mb-3 grid size-14 place-items-center rounded-full bg-muted/40">
                        <Sparkles className="size-6 text-muted-foreground opacity-60" />
                      </div>
                      <p className="text-sm font-medium">No AI activity yet</p>
                      <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                        Try adjusting the filters, or open the AI Assistant chat (⌘K) to generate
                        the first record.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b last:border-b-0 hover:bg-muted/30 transition-colors"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className="px-4 py-2.5 align-middle"
                        style={{
                          width: `${cell.column.getSize()}px`,
                          maxWidth: `${cell.column.getSize()}px`,
                        }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!isLoading && data && data.total > 0 && (
          <div className="flex items-center justify-between gap-2 border-t px-4 py-3 bg-muted/20">
            <div className="text-xs text-muted-foreground">
              {data.hasMore
                ? `Showing ${(filters.page - 1) * filters.pageSize + 1}–${
                    (filters.page - 1) * filters.pageSize + data.items.length
                  } of ${data.total.toLocaleString()}`
                : `${data.total.toLocaleString()} record${data.total === 1 ? "" : "s"}`}
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => changePage(filters.page - 1)}
                disabled={filters.page <= 1}
                className="gap-1 h-8"
              >
                <ChevronLeft className="size-3.5" />
                Prev
              </Button>
              <span className="px-3 text-xs font-medium tabular-nums">
                {filters.page} / {totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => changePage(filters.page + 1)}
                disabled={!data.hasMore}
                className="gap-1 h-8"
              >
                Next
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          </div>
        )}
      </SectionCard>

      {/* View messages dialog */}
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col overflow-hidden p-0 gap-0">
          <DialogHeader className="px-5 py-4 border-b shrink-0">
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <MessageSquare className="size-4 text-emerald-500" />
              Activity detail — messages
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {viewing && (
                <>
                  {viewing.model} · {(viewing.durationMs || 0).toLocaleString()}ms · {timeAgo(viewing.createdAt)}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 min-h-0 px-5 py-4">
            {viewing ? (
              <MessagesViewer messages={viewing.messages} />
            ) : null}
          </ScrollArea>
          <DialogFooter className="px-5 py-3 border-t shrink-0">
            <Button variant="outline" onClick={() => setViewing(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* --- Inner messages viewer --- */

function MessagesViewer({ messages }: { messages: unknown }) {
  let list: ChatMessage[] = [];
  try {
    if (Array.isArray(messages)) {
      list = messages as ChatMessage[];
    } else if (typeof messages === "string") {
      list = JSON.parse(messages);
    } else if (messages && typeof messages === "object") {
      /* might be a JSON payload wrapper */
      const anyM = messages as any;
      if (Array.isArray(anyM.messages)) list = anyM.messages;
      else if (Array.isArray(anyM.items)) list = anyM.items;
    }
  } catch {
    list = [];
  }

  if (!list || list.length === 0) {
    const rawRepr =
      typeof messages === "string" ? messages : JSON.stringify(messages, null, 2);
    return (
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          No message array decoded. Showing raw payload:
        </p>
        <pre className="overflow-auto rounded-md border bg-muted/30 p-3 text-[11px] font-mono max-h-96 whitespace-pre-wrap">
          {rawRepr || "(empty)"}
        </pre>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {list.map((m, idx) => {
        const isUser = m.role === "user";
        const isAssistant = m.role === "assistant";
        const isTool = m.role === "tool";
        const isSystem = m.role === "system";
        return (
          <div
            key={idx}
            className={cn(
              "flex items-start gap-2.5",
              isUser && "justify-end"
            )}
          >
            {!isUser && !isTool && (
              <Avatar className="size-7 shrink-0 border">
                <AvatarFallback className={cn(
                  "bg-transparent",
                  isAssistant && "text-emerald-500",
                  isSystem && "text-slate-500"
                )}>
                  {isAssistant ? <Sparkles className="size-3.5" /> : <span className="text-[10px] font-mono uppercase">S</span>}
                </AvatarFallback>
              </Avatar>
            )}
            {isTool && (
              <div className="grid size-7 shrink-0 place-items-center rounded-full border bg-violet-500/10">
                <span className="text-[9px] font-mono text-violet-600 dark:text-violet-400">T</span>
              </div>
            )}
            <div
              className={cn(
                "max-w-[85%] rounded-2xl border px-3 py-2 text-[12px] shadow-sm whitespace-pre-wrap break-words",
                isUser && "bg-emerald-600 text-white border-transparent rounded-tr-sm",
                isAssistant && "bg-card rounded-tl-sm",
                isSystem && "bg-slate-500/10 border-slate-500/20 text-slate-600 dark:text-slate-400",
                isTool && "bg-violet-500/10 border-violet-500/20 rounded-tl-sm"
              )}
            >
              {isTool && m.tool_call_id && (
                <div className="mb-1 font-mono text-[9px] uppercase tracking-wider text-violet-600 dark:text-violet-400">
                  tool result · {m.tool_call_id.slice(0, 6)}…
                </div>
              )}
              {isSystem && (
                <div className="mb-1 font-mono text-[9px] uppercase tracking-wider opacity-70">system</div>
              )}
              <div className="leading-relaxed">{m.content || "(empty)"}</div>
              {isAssistant && m.tool_calls && m.tool_calls.length > 0 && (
                <div className="mt-2 space-y-1.5 border-t pt-2">
                  {m.tool_calls.map((tc, tci) => (
                    <div key={tci} className="rounded bg-muted/40 border p-2">
                      <div className="font-mono text-[10px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                        🔧 {tc.name} · id {tc.id.slice(0, 6)}…
                      </div>
                      <pre className="mt-1 text-[10px] font-mono text-muted-foreground overflow-x-auto max-h-24">
                        {JSON.stringify(tc.arguments ?? {}, null, 1)}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
