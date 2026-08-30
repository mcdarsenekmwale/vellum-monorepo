import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import type { ColumnDef, RowSelectionState } from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { CheckCheck, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAlerts } from "@/lib/api/hooks";
import {
  bulkAckAlerts,
  bulkSnoozeAlerts,
  closeAlert,
} from "@/lib/api/services";
import type { AlertItem, Severity, ServiceName } from "@/lib/api/services";

const SEV: Record<Severity, { label: string; cn: string }> = {
  critical: {
    label: "Critical",
    cn: "bg-rose-500/10 text-rose-600 border-rose-500/30",
  },
  warning: {
    label: "Warning",
    cn: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  },
  info: {
    label: "Info",
    cn: "bg-sky-500/10 text-sky-600 border-sky-500/30",
  },
};
const SEV_KEYS: ("all" | Severity)[] = [
  "all",
  "critical",
  "warning",
  "info",
];
const SERVICES: ServiceName[] = [
  "database",
  "api",
  "redis",
  "storage",
  "webhooks",
];

function timeAgo(iso: string): string {
  const s = Math.max(
    1,
    Math.floor((Date.now() - new Date(iso).getTime()) / 1000),
  );
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

export function StatusAlertsTable() {
  const [severity, setSeverity] = useState<"all" | Severity>("all");
  const [serviceSet, setServiceSet] = useState<
    Partial<Record<ServiceName, boolean>>
  >({});
  const [ackedFilter, setAckedFilter] = useState<"all" | "acked" | "open">(
    "all",
  );
  const [since, setSince] = useState<string>("");
  const [until, setUntil] = useState<string>("");
  const [noteOpen, setNoteOpen] = useState<AlertItem | null>(null);
  const [note, setNote] = useState("");
  const [closing, setClosing] = useState(false);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const query = useMemo(
    () => ({
      severity: severity === "all" ? undefined : severity,
      service:
        Object.entries(serviceSet)
          .filter(([, v]) => v)
          .map(([k]) => k)
          .join(",") || undefined,
      acked: ackedFilter === "all" ? undefined : ackedFilter === "acked",
      since: since || undefined,
      until: until || undefined,
      limit: 50,
    }),
    [severity, serviceSet, ackedFilter, since, until],
  );

  const alerts = useAlerts(query);
  const rows = useMemo<AlertItem[]>(
    () => alerts.data?.pages.flatMap((p) => p.items) ?? [],
    [alerts.data],
  );

  const selectedIds = Object.entries(rowSelection)
    .filter(([, v]) => v)
    .map(([id]) => id);
  const allFlat = rows;

  const toggleSvc = (s: ServiceName) =>
    setServiceSet((m) => ({ ...m, [s]: !m[s] }));

  const bulkAck = async () => {
    if (selectedIds.length === 0) return;
    await bulkAckAlerts(selectedIds);
    toast.success(`${selectedIds.length} alert(s) acknowledged`);
    alerts.refetch();
    setRowSelection({});
  };
  const bulkSnooze = async (hours = 1) => {
    if (selectedIds.length === 0) return;
    const untilIso = new Date(
      Date.now() + hours * 3600_000,
    ).toISOString();
    await bulkSnoozeAlerts(selectedIds, untilIso);
    toast.success(`${selectedIds.length} alert(s) snoozed for ${hours}h`);
    alerts.refetch();
    setRowSelection({});
  };
  const doClose = async () => {
    if (!noteOpen) return;
    setClosing(true);
    try {
      await closeAlert(
        noteOpen.id,
        note || "closed from dashboard",
      );
      toast.success("Alert closed");
      alerts.refetch();
      setNoteOpen(null);
      setNote("");
    } finally {
      setClosing(false);
    }
  };

  const columns: ColumnDef<AlertItem, any>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(!!v)}
          aria-label="Select row"
        />
      ),
      size: 44,
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "severity",
      header: "Severity",
      size: 100,
      cell: ({ getValue }) => {
        const v = getValue() as Severity;
        return (
          <Badge
            variant="outline"
            className={cn("capitalize", SEV[v].cn)}
          >
            {SEV[v].label}
          </Badge>
        );
      },
    },
    {
      accessorKey: "service",
      header: "Service",
      size: 110,
      cell: ({ getValue }) => (
        <Badge variant="outline" className="capitalize">
          {String(getValue())}
        </Badge>
      ),
    },
    {
      accessorKey: "message",
      header: "Message",
      cell: ({ getValue }) => (
        <div className="break-words">{String(getValue())}</div>
      ),
    },
    {
      id: "value",
      header: "Value / Threshold",
      size: 140,
      cell: ({ row }) => (
        <div className="tabular-nums text-xs">
          {row.original.value ?? "—"} / {row.original.threshold ?? "—"}
        </div>
      ),
    },
    {
      accessorKey: "acknowledgedAt",
      header: "Acked",
      size: 72,
      cell: ({ getValue }) =>
        getValue() ? (
          <Badge
            variant="outline"
            className="border-emerald-500/30 text-emerald-600"
          >
            <CheckCheck className="h-3 w-3 mr-1" />
            Yes
          </Badge>
        ) : (
          <span className="text-muted-foreground text-xs">No</span>
        ),
    },
    {
      accessorKey: "createdAt",
      header: "Age",
      size: 80,
      cell: ({ getValue }) => (
        <span className="tabular-nums text-xs text-muted-foreground">
          {timeAgo(String(getValue()))}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      size: 90,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="ghost"
            className="text-rose-600"
            onClick={() => {
              setNoteOpen(row.original);
              setNote("");
            }}
            title="Close with note"
          >
            <XCircle className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  const table = useReactTable<AlertItem>({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onRowSelectionChange: setRowSelection,
    state: { rowSelection },
    getRowId: (r) => r.id,
  });

  return (
    <section className="rounded-xl border shadow-sm p-4 md:p-5">
      <header className="flex flex-wrap items-center justify-between gap-2 pb-3">
        <h2 className="text-base font-semibold">Alerts</h2>
      </header>

      <div className="space-y-3 pb-3">
        <div className="flex flex-wrap gap-1">
          {SEV_KEYS.map((k) => (
            <Badge
              key={k}
              variant={severity === k ? "default" : "outline"}
              className="capitalize cursor-pointer"
              onClick={() => setSeverity(k)}
            >
              {k}
            </Badge>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {SERVICES.map((s) => (
            <Badge
              key={s}
              variant={serviceSet[s] ? "default" : "outline"}
              className="capitalize cursor-pointer"
              onClick={() => toggleSvc(s)}
            >
              {s}
            </Badge>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <RadioGroup
            value={ackedFilter}
            onValueChange={(v) => setAckedFilter(v as any)}
            className="flex gap-4"
          >
            {(["all", "acked", "open"] as const).map((v) => (
              <div key={v} className="flex items-center gap-2">
                <RadioGroupItem value={v} id={`af-${v}`} />
                <Label htmlFor={`af-${v}`} className="capitalize">
                  {v}
                </Label>
              </div>
            ))}
          </RadioGroup>
          <div className="flex items-center gap-2">
            <Label className="text-xs uppercase">Since</Label>
            <Input
              type="datetime-local"
              className="h-8 w-48"
              value={since}
              onChange={(e) => setSince(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs uppercase">Until</Label>
            <Input
              type="datetime-local"
              className="h-8 w-48"
              value={until}
              onChange={(e) => setUntil(e.target.value)}
            />
          </div>
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="rounded-lg border bg-muted/30 p-2 mb-3 flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium mr-2">
            {selectedIds.length} selected
          </span>
          <Button size="sm" variant="outline" onClick={bulkAck}>
            <CheckCheck className="h-3.5 w-3.5 mr-1" />
            Ack
          </Button>
          <Button size="sm" variant="outline" onClick={() => bulkSnooze(1)}>
            Snooze 1h
          </Button>
          <Button size="sm" variant="outline" onClick={() => bulkSnooze(24)}>
            Snooze 24h
          </Button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm" aria-label="Status alerts table">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th
                    key={h.id}
                    style={{ width: h.getSize() }}
                    className="text-left px-3 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wider border-b"
                  >
                    {h.isPlaceholder
                      ? null
                      : flexRender(
                          h.column.columnDef.header,
                          h.getContext(),
                        )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {alerts.isLoading && (
              <tr>
                <td
                  colSpan={columns.length}
                  className="text-center py-6 text-muted-foreground"
                >
                  Loading alerts…
                </td>
              </tr>
            )}
            {!alerts.isLoading && allFlat.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="text-center py-10">
                  <CheckCheck className="mx-auto h-10 w-10 text-muted-foreground/60 mb-3" />
                  <div className="text-sm font-medium">No alerts</div>
                  <div className="text-xs text-muted-foreground">
                    Current filters match no alerts.
                  </div>
                </td>
              </tr>
            )}
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="border-b last:border-0 hover:bg-muted/30"
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    style={{ width: cell.column.getSize() }}
                    className="px-3 py-2 align-middle"
                  >
                    {flexRender(
                      cell.column.columnDef.cell,
                      cell.getContext(),
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between pt-3">
        <div className="text-xs text-muted-foreground tabular-nums">
          {allFlat.length} loaded
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={!alerts.hasNextPage || alerts.isFetchingNextPage}
          onClick={() => alerts.fetchNextPage()}
        >
          {alerts.isFetchingNextPage && (
            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
          )}
          Load more
        </Button>
      </div>

      <Dialog open={!!noteOpen} onOpenChange={(v) => !v && setNoteOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close alert</DialogTitle>
            <DialogDescription>
              Optional: add a root-cause or remediation note.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Note</Label>
            <Textarea
              rows={4}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="E.g.: DB connection pool resized to 200. pgBouncer restarted."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteOpen(null)}>
              Cancel
            </Button>
            <Button disabled={closing} onClick={doClose}>
              {closing && (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              )}
              Close alert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
