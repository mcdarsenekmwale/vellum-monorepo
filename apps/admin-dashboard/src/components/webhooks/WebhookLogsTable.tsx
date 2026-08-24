import { useMemo, useState } from "react";
import type { WebhookLog, WebhookLogsFilter } from "@/lib/api/services";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ClipboardList,
  Search,
  Download,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
  Copy,
  Check,
  TrendingUp,
  Calendar,
  XCircle,
  Filter,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface WebhookLogsTableProps {
  logs?: WebhookLog[];
  total?: number;
  loading?: boolean;
  events?: string[];
  filter: WebhookLogsFilter;
  onFilterChange: (next: WebhookLogsFilter) => void;
  onRefresh?: () => void;
  onExport?: () => void;
  exportLoading?: boolean;
}

function StatusPill({ code, error }: { code: number | null; error: string | null }) {
  const ok = code !== null && code >= 200 && code < 300 && !error;
  const variant = ok
    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
    : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20";
  return (
    <Badge variant="outline" className={cn("gap-1 font-mono text-[10px]", variant)}>
      {ok ? <CheckCircle2 className="size-3" /> : <XCircle className="size-3" />}
      {code ? `${code}` : "Failed"}
    </Badge>
  );
}

function PayloadInspector({ label, value }: { label: string; value: unknown }) {
  const [copied, setCopied] = useState(false);
  const text = useMemo(() => {
    if (value == null) return "";
    if (typeof value === "string") return value;
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }, [value]);

  if (!text) {
    return (
      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
          {label}
        </div>
        <div className="rounded-md bg-muted/30 border border-dashed p-3 text-xs text-muted-foreground">
          (empty)
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 gap-1 text-[10px]"
          onClick={async () => {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre className="rounded-md bg-muted/30 border p-3 font-mono text-[11px] whitespace-pre-wrap break-all max-h-56 overflow-auto leading-relaxed">
        {text}
      </pre>
    </div>
  );
}

export function WebhookLogsTable({
  logs,
  total,
  loading,
  events,
  filter,
  onFilterChange,
  onRefresh,
  onExport,
  exportLoading,
}: WebhookLogsTableProps) {
  const [q, setQ] = useState("");
  const [openedId, setOpenedId] = useState<string | null>(null);

  const uniqueEvents = useMemo(() => {
    const fromLogs = new Set<string>();
    logs?.forEach((l) => fromLogs.add(l.event));
    const base = Array.from(new Set([...(events ?? []), ...Array.from(fromLogs)]));
    return base.sort();
  }, [events, logs]);

  const filteredRows = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return logs ?? [];
    return (logs ?? []).filter((l) => {
      if (l.event.toLowerCase().includes(term)) return true;
      if (l.error?.toLowerCase().includes(term)) return true;
      if (l.response?.toLowerCase().includes(term)) return true;
      try {
        const p = JSON.stringify(l.payload).toLowerCase();
        if (p.includes(term)) return true;
      } catch {
        // payload is not JSON-serializable — skip matching
      }
      return false;
    });
  }, [logs, q]);

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <ClipboardList className="size-4 text-muted-foreground shrink-0" />
            <div>
              <h3 className="text-sm font-semibold leading-tight">Delivery logs</h3>
              <p className="text-xs text-muted-foreground">
                {typeof total === "number"
                  ? `${filteredRows.length} shown of ${total.toLocaleString()} total logs`
                  : `${filteredRows.length.toLocaleString()} logs loaded`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search logs…"
                className="h-8 pl-8 w-full sm:w-56 text-xs"
              />
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Filter className="size-3.5 text-muted-foreground" />
              <Select
                value={filter.status ?? "all"}
                onValueChange={(v) =>
                  onFilterChange({ ...filter, status: v as WebhookLogsFilter["status"] })
                }
              >
                <SelectTrigger className="h-8 w-[120px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="failure">Failure</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={filter.event ?? "__all__"}
                onValueChange={(v) =>
                  onFilterChange({ ...filter, event: v === "__all__" ? undefined : v })
                }
              >
                <SelectTrigger className="h-8 w-[180px] text-xs">
                  <SelectValue placeholder="Any event" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Any event</SelectItem>
                  {uniqueEvents.map((ev) => (
                    <SelectItem key={ev} value={ev} className="font-mono text-xs">
                      {ev}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              {onRefresh && (
                <Button variant="outline" size="sm" className="h-8 gap-1" onClick={onRefresh}>
                  <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
                  <span className="hidden sm:inline">Refresh</span>
                </Button>
              )}
              {onExport && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1"
                  onClick={onExport}
                  disabled={exportLoading || !logs || logs.length === 0}
                >
                  <Download className={cn("size-3.5", exportLoading && "animate-spin")} />
                  <span className="hidden sm:inline">Export CSV</span>
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-2">
            <Calendar className="size-3.5 text-muted-foreground" />
            <Label className="text-xs shrink-0">From</Label>
            <Input
              type="date"
              className="h-8 flex-1"
              value={filter.from ?? ""}
              onChange={(e) => onFilterChange({ ...filter, from: e.target.value || undefined })}
            />
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="size-3.5 text-muted-foreground" />
            <Label className="text-xs shrink-0">To</Label>
            <Input
              type="date"
              className="h-8 flex-1"
              value={filter.to ?? ""}
              onChange={(e) => onFilterChange({ ...filter, to: e.target.value || undefined })}
            />
          </div>
        </div>

        <div className="rounded-lg border divide-y overflow-hidden">
          {loading && !logs ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <Skeleton className="h-3 w-60" />
              </div>
            ))
          ) : filteredRows.length === 0 ? (
            <div className="py-16 text-center">
              <ClipboardList className="size-8 mx-auto text-muted-foreground/40" />
              <p className="mt-3 text-sm font-medium text-muted-foreground">
                No delivery logs match
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Trigger a test event or clear the filters/query.
              </p>
            </div>
          ) : (
            filteredRows.map((log) => {
              const open = openedId === log.id;
              return (
                <Collapsible
                  key={log.id}
                  open={open}
                  onOpenChange={(v) => setOpenedId(v ? log.id : null)}
                  className="group"
                >
                  <div className="flex items-start gap-3 px-3 py-3 hover:bg-muted/30 transition-colors">
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        className="mt-1 size-6 grid place-items-center rounded-md text-muted-foreground hover:bg-muted shrink-0"
                        aria-label={open ? "Collapse" : "Expand"}
                      >
                        {open ? (
                          <ChevronDown className="size-3.5" />
                        ) : (
                          <ChevronRight className="size-3.5" />
                        )}
                      </button>
                    </CollapsibleTrigger>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill code={log.statusCode} error={log.error} />
                        <Badge variant="secondary" className="font-mono text-[10px]">
                          {log.event}
                        </Badge>
                        {typeof log.attempt === "number" && log.attempt > 1 && (
                          <Badge
                            variant="outline"
                            className="text-[10px] gap-1 border-amber-500/30 text-amber-600"
                          >
                            <RefreshCw className="size-2.5" />
                            attempt {log.attempt}
                          </Badge>
                        )}
                        {typeof log.durationMs === "number" && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="outline" className="gap-1 text-[10px]">
                                  <TrendingUp className="size-2.5" />
                                  {log.durationMs.toLocaleString()}ms
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-[11px]">
                                Round-trip duration
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                      {log.error && (
                        <div className="flex items-start gap-1.5 text-xs text-rose-600 dark:text-rose-400">
                          <AlertCircle className="size-3 mt-0.5 shrink-0" />
                          <span className="font-mono break-all">{log.error}</span>
                        </div>
                      )}
                    </div>

                    <div className="shrink-0 text-right">
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Clock className="size-3" />
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="tabular-nums">
                                {formatDistanceToNow(new Date(log.createdAt), {
                                  addSuffix: true,
                                })}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="text-[11px]">
                              {format(new Date(log.createdAt), "PPp")}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                  </div>
                  <CollapsibleContent>
                    <div className="px-3 pb-4 pl-11 pr-4 space-y-3 border-t bg-muted/10">
                      <div className="pt-3">
                        <PayloadInspector label="Request payload" value={log.payload} />
                      </div>
                      <PayloadInspector label="Response" value={log.response} />
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
