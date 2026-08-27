import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { ColumnDef } from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  Check,
  Gauge,
  Loader2,
  Plus,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAlertRuleMutations, useAlertRules } from "@/lib/api/hooks";
import type { AlertRule, ServiceName, Severity } from "@/lib/api/services";

const SEV_CN: Record<Severity, string> = {
  info: "bg-sky-500/10 text-sky-600 border-sky-500/30",
  warning: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  critical: "bg-rose-500/10 text-rose-600 border-rose-500/30",
};

const SERVICES: ServiceName[] = [
  "database",
  "api",
  "redis",
  "storage",
  "webhooks",
];
const METRICS: AlertRule["metric"][] = [
  "latency-p50",
  "latency-p95",
  "latency-p99",
  "utilization",
  "error-rate",
  "queue-depth",
];
const OPS: AlertRule["operator"][] = [">", "<", ">=", "<=", "=="];

function defaultRule(): Partial<AlertRule> {
  return {
    service: "api",
    metric: "latency-p95",
    operator: ">",
    threshold: 500,
    windowSeconds: 300,
    severity: "warning",
    cooldownSeconds: 300,
    channels: { dashboard: true },
    enabled: true,
  };
}

export function StatusRulesTable() {
  const { data, isLoading, error, refetch } = useAlertRules(1, 100);
  const mutations = useAlertRuleMutations();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<AlertRule> | null>(null);
  const [testRunning, setTestRunning] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<
    Record<string, { ok: boolean; error?: string }> | null
  >(null);

  const startNew = () => {
    setEditing(defaultRule());
    setDrawerOpen(true);
  };
  const startEdit = (r: AlertRule) => {
    setEditing(r);
    setDrawerOpen(true);
  };

  const save = async () => {
    if (!editing) return;
    try {
      let channels = editing.channels ?? {};
      if (typeof channels === "string") channels = JSON.parse(channels);
      const payload = { ...editing, channels } as Omit<
        AlertRule,
        "id" | "createdAt" | "updatedAt"
      >;
      if (editing.id) {
        await mutations.update.mutateAsync({
          id: editing.id,
          patch: payload,
        });
        toast.success("Rule updated");
      } else {
        await mutations.create.mutateAsync(payload);
        toast.success("Rule created");
      }
      setDrawerOpen(false);
    } catch (e: any) {
      toast.error("Failed to save", {
        description: e?.message ?? "Invalid channels JSON or values.",
      });
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Archive this rule? It cannot be restored.")) return;
    await mutations.remove.mutateAsync(id);
    toast.success("Rule archived");
  };

  const runTest = async (r: AlertRule) => {
    setTestRunning(r.id);
    setTestResult(null);
    try {
      const res = await mutations.test.mutateAsync(r.id);
      const perChannel: Record<string, { ok: boolean; error?: string }> = {};
      for (const c of res.channels)
        perChannel[c.name] = { ok: c.ok, error: c.error };
      setTestResult(perChannel);
      toast[res.fired ? "warning" : "success"](res.reason, {
        description: `value = ${res.value ?? "n/a"}`,
      });
    } catch (e: any) {
      toast.error("Test failed", { description: e?.message });
    } finally {
      setTimeout(() => setTestRunning(null), 800);
    }
  };

  const toggle = async (r: AlertRule) => {
    await mutations.update.mutateAsync({
      id: r.id,
      patch: { enabled: !r.enabled },
    });
    toast(r.enabled ? "Rule disabled" : "Rule enabled");
  };

  const columns = useMemo<ColumnDef<AlertRule, any>[]>(
    () => [
      {
        id: "enabled",
        header: "",
        size: 56,
        cell: ({ row }) => (
          <Switch
            checked={row.original.enabled}
            onCheckedChange={() => toggle(row.original)}
          />
        ),
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
        accessorKey: "metric",
        header: "Metric",
        size: 130,
        cell: ({ getValue }) => (
          <span className="font-mono text-xs">{String(getValue())}</span>
        ),
      },
      {
        id: "condition",
        header: "Condition",
        size: 230,
        cell: ({ row }) => {
          const r = row.original;
          return (
            <div className="font-mono text-xs whitespace-nowrap">
              {r.metric}{" "}
              <span className="text-chart-3 font-semibold">{r.operator}</span>{" "}
              {r.threshold}
              <span className="text-muted-foreground">
                {"  "}@ {r.windowSeconds}s window
              </span>
            </div>
          );
        },
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
              className={cn("capitalize", SEV_CN[v])}
            >
              {v}
            </Badge>
          );
        },
      },
      {
        accessorKey: "channels",
        header: "Channels",
        cell: ({ getValue }) => {
          const ch = (getValue() ?? {}) as Record<string, any>;
          const keys = Object.keys(ch).filter((k) => !!ch[k]);
          if (keys.length === 0)
            return (
              <span className="text-xs text-muted-foreground">—</span>
            );
          return (
            <div className="flex flex-wrap gap-1">
              {keys.map((k) => (
                <Badge
                  key={k}
                  variant="secondary"
                  className="text-[10px] capitalize"
                >
                  {k}
                </Badge>
              ))}
            </div>
          );
        },
      },
      {
        id: "actions",
        header: "",
        size: 160,
        cell: ({ row }) => {
          const r = row.original;
          return (
            <div className="flex items-center justify-end gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => runTest(r)}
                disabled={testRunning === r.id}
                title="Test rule"
              >
                {testRunning === r.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Gauge className="h-3.5 w-3.5" />
                )}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => startEdit(r)}>
                <Settings2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-rose-600"
                onClick={() => remove(r.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
              {testRunning === r.id && testResult && (
                <div className="flex gap-1 pl-2 ml-2 border-l">
                  {Object.entries(testResult).map(([name, c]) => (
                    <Badge
                      key={name}
                      variant="outline"
                      className={cn(
                        "text-[10px]",
                        c.ok
                          ? "border-emerald-500/30 text-emerald-600"
                          : "border-rose-500/30 text-rose-600",
                      )}
                      title={c.error}
                    >
                      {c.ok ? (
                        <Check className="h-2.5 w-2.5 mr-0.5" />
                      ) : (
                        <X className="h-2.5 w-2.5 mr-0.5" />
                      )}
                      {name}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mutations, testRunning, testResult],
  );

  const table = useReactTable<AlertRule>({
    data: data?.items ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <section className="rounded-xl border shadow-sm p-4 md:p-5">
      <header className="flex flex-wrap items-center justify-between gap-2 pb-3">
        <div>
          <h2 className="text-base font-semibold">Threshold rules</h2>
          <p className="text-xs text-muted-foreground">
            Define what triggers an alert. Evaluated every minute.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => refetch()}>
            Refresh
          </Button>
          <Button size="sm" className="gap-1.5" onClick={startNew}>
            <Plus className="h-4 w-4" /> New rule
          </Button>
        </div>
      </header>

      {error && (
        <div className="rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-600 text-sm p-3 mb-3">
          Failed to load rules:{" "}
          {(error as any)?.message ?? String(error)}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
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
            {isLoading && (
              <tr>
                <td
                  colSpan={columns.length}
                  className="text-center py-6 text-muted-foreground"
                >
                  Loading rules…
                </td>
              </tr>
            )}
            {!isLoading && table.getRowModel().rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="text-center py-10">
                  <Gauge className="mx-auto h-10 w-10 text-muted-foreground/60 mb-3" />
                  <div className="text-sm font-medium">No rules yet</div>
                  <div className="text-xs text-muted-foreground mb-3">
                    Create your first threshold rule to get alerted on
                    degradation.
                  </div>
                  <Button size="sm" className="gap-1.5" onClick={startNew}>
                    <Plus className="h-4 w-4" /> New rule
                  </Button>
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

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="h-[92vh] overflow-y-auto">
          <DrawerHeader>
            <DrawerTitle>
              {editing?.id ? "Edit rule" : "Create rule"}
            </DrawerTitle>
            <DrawerDescription>
              Rules are evaluated every minute. Use Test to see per-channel
              delivery.
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-5 space-y-4 pb-10">
            {editing && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Service</Label>
                    <Select
                      value={editing.service}
                      onValueChange={(v) =>
                        setEditing({
                          ...editing,
                          service: v as ServiceName,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SERVICES.map((s) => (
                          <SelectItem
                            key={s}
                            value={s}
                            className="capitalize"
                          >
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Metric</Label>
                    <Select
                      value={editing.metric}
                      onValueChange={(v) =>
                        setEditing({
                          ...editing,
                          metric: v as AlertRule["metric"],
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {METRICS.map((m) => (
                          <SelectItem key={m} value={m}>
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Operator</Label>
                    <Select
                      value={editing.operator}
                      onValueChange={(v) =>
                        setEditing({
                          ...editing,
                          operator: v as AlertRule["operator"],
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {OPS.map((o) => (
                          <SelectItem key={o} value={o}>
                            {o}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Threshold</Label>
                    <Input
                      type="number"
                      value={editing.threshold ?? 0}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          threshold: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Window (seconds)</Label>
                  <div className="flex items-center gap-4">
                    <Slider
                      className="flex-1"
                      min={30}
                      max={900}
                      step={30}
                      value={[editing.windowSeconds ?? 300]}
                      onValueChange={(v) =>
                        setEditing({ ...editing, windowSeconds: v[0] })
                      }
                    />
                    <Input
                      type="number"
                      className="w-24"
                      value={editing.windowSeconds ?? 300}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          windowSeconds: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Severity</Label>
                    <Select
                      value={editing.severity}
                      onValueChange={(v) =>
                        setEditing({
                          ...editing,
                          severity: v as Severity,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(["info", "warning", "critical"] as Severity[]).map(
                          (s) => (
                            <SelectItem
                              key={s}
                              value={s}
                              className="capitalize"
                            >
                              {s}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Cooldown (seconds)</Label>
                    <Input
                      type="number"
                      value={editing.cooldownSeconds ?? 300}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          cooldownSeconds: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <Label className="text-sm font-medium">Enabled</Label>
                    <div className="text-xs text-muted-foreground">
                      Evaluators skip disabled rules.
                    </div>
                  </div>
                  <Switch
                    checked={!!editing.enabled}
                    onCheckedChange={(c) =>
                      setEditing({ ...editing, enabled: c })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Channels (JSON object)</Label>
                  <Textarea
                    rows={4}
                    className="font-mono text-xs"
                    value={
                      typeof editing.channels === "string"
                        ? editing.channels
                        : JSON.stringify(editing.channels ?? {}, null, 2)
                    }
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        channels: e.target.value as any,
                      })
                    }
                  />
                  <div className="text-[11px] text-muted-foreground">
                    Supported keys:{" "}
                    <code className="font-mono">dashboard</code>,{" "}
                    <code className="font-mono">email</code>,{" "}
                    <code className="font-mono">teams</code> (webhook URL),{" "}
                    <code className="font-mono">slack</code> (webhook URL).
                  </div>
                </div>
              </>
            )}
          </div>
          <DrawerFooter>
            <Button variant="outline" onClick={() => setDrawerOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={save}
              disabled={
                mutations.create.isPending || mutations.update.isPending
              }
            >
              {(mutations.create.isPending || mutations.update.isPending) && (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              )}
              Save rule
            </Button>
            {editing?.id && (
              <Button
                variant="ghost"
                onClick={() => runTest(editing as AlertRule)}
                disabled={testRunning === editing.id}
                className="ml-auto"
              >
                {testRunning === editing.id ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                ) : (
                  <Gauge className="h-4 w-4 mr-1.5" />
                )}
                Test run
              </Button>
            )}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </section>
  );
}
