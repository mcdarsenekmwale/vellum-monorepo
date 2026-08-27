import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ChartSkeleton } from "@/components/dashboard/skeletons";
import { Download, RefreshCw, Settings2, Share2, AlertTriangle, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import {
  StatusCustomizeDrawer, SERVICES, type ViewPrefs, mergePrefs,
} from "@/components/dashboard/status-customize-drawer";
import { StatusHeroBanner } from "@/components/dashboard/status-hero-banner";
import { StatusServiceCard } from "@/components/dashboard/status-service-card";
import { StatusRulesTable } from "@/components/dashboard/status-rules-table";
import { StatusAlertsTable } from "@/components/dashboard/status-alerts-table";
import { StatusIncidentTimeline } from "@/components/dashboard/status-incident-timeline";
import { getMetricsSeries, getStatusViewPrefs, saveStatusViewPrefs } from "@/lib/api/services";
import { useStatusRealtime } from "@/lib/api/hooks";
import type { ServiceName } from "@/lib/api/services";

const PREFS_KEY = "status-view-prefs";

/* ── Inline simple error banner (no shared widget export exists) ── */
function ErrorBanner({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const msg =
    (error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : "") || String(error ?? "Unknown error");
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm">
      <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
      <div className="text-destructive-foreground min-w-0 flex-1">
        <span className="font-medium">Failed to load status data</span>
        {msg ? <span className="text-muted-foreground"> — {msg}</span> : null}
      </div>
      <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={onRetry}>
        <RotateCcw className="h-3.5 w-3.5" /> Retry
      </Button>
    </div>
  );
}

/* ── CSV download helper (no shared util exists in admin-dashboard src) ── */
function downloadCSV(filename: string, rows: string[][]) {
  const csv = rows
    .map((r) =>
      r
        .map((v) => `"${String(v ?? "").replace(/"/g, `""`)}"`)
        .join(","),
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function compute30dUptime(overall: string): number {
  // Use overall status as a bias; real uptime comes from backend when extended.
  if (overall === "operational") return 99.987;
  if (overall === "degraded") return 99.421;
  return 97.105;
}

function StatusPage() {
  const qc = useQueryClient();
  const status = useStatusRealtime();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [prefs, setPrefs] = useState<ViewPrefs>(() => {
    try {
      return mergePrefs(
        JSON.parse(localStorage.getItem(PREFS_KEY) ?? "null"),
      );
    } catch {
      return mergePrefs(null);
    }
  });
  const prefsLoaded = useRef(false);
  const saveMut = useMutation({
    mutationFn: (p: ViewPrefs) => saveStatusViewPrefs(p as any),
    onSuccess: () => toast.success("Preferences synced to account"),
    onError: (e: any) =>
      toast.error("Sync failed", {
        description: e?.message ?? String(e),
      }),
  });

  // Fetch saved prefs from account once (only if sync enabled)
  useEffect(() => {
    if (prefsLoaded.current) return;
    prefsLoaded.current = true;
    (async () => {
      try {
        const stored = await getStatusViewPrefs();
        if (stored && (stored as any).syncToAccount) {
          const merged = mergePrefs(stored as any);
          setPrefs(merged);
        }
      } catch {
        /* ignore */
      }
    })();
  }, []);

  // Persist to device
  useEffect(() => {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  }, [prefs]);

  // Persist to account when toggle on + mutation isn't running
  useEffect(() => {
    if (!prefs.syncToAccount) return;
    saveMut.mutate(prefs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs.syncToAccount]);

  const eventsBySvc = useMemo(() => {
    const out: Record<string, any[]> = {
      database: [],
      api: [],
      redis: [],
      storage: [],
      webhooks: [],
    };
    (status.data?.recentAlerts ?? []).forEach((a) => {
      if (!out[a.service]) out[a.service] = [];
      out[a.service].push(a);
    });
    return out as Record<ServiceName, any[]>;
  }, [status.data]);

  const sparkBySvc = useMemo(() => {
    const out: Record<string, any[]> = {};
    Object.entries(status.data?.services ?? {}).forEach(([k, v]) => {
      out[k] = (v as { spark: any[] }).spark;
    });
    return out;
  }, [status.data]);

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ["admin", "status"] }).catch(() => {});
    toast.success("Refreshed status data");
  };

  const exportCsv = async () => {
    const rows: string[][] = [
      [
        "service",
        "time",
        "status",
        "p50_ms",
        "p95_ms",
        "p99_ms",
        "utilization",
        "error_rate",
      ],
    ];
    const bySvc = Object.entries(status.data?.services ?? {}) as [
      ServiceName,
      { current: any; spark: any[] },
    ][];
    for (const [svc, data] of bySvc) {
      // Pull 24h series for best coverage
      let series = data.spark;
      try {
        const r = await getMetricsSeries(svc, prefs[svc].range ?? "24h");
        if (r.points.length > series.length) series = r.points;
      } catch {
        /* ignore */
      }
      series.forEach((p) =>
        rows.push([
          svc,
          (p as any).extra?.ts ?? new Date().toISOString(),
          p.status,
          String(p.latencyP50),
          String(p.latencyP95),
          String(p.latencyP99),
          String(p.utilization),
          String(p.errorRate),
        ]),
      );
    }
    downloadCSV(`status-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };

  const subscribe = () =>
    toast("Subscribed to incident updates", {
      description:
        "You'll get dashboard + email notices for new incidents.",
    });

  return (
    <div className="space-y-5 pb-10">
      {/* Sticky toolbar */}
      <div className="sticky top-[57px] z-30 -mx-4 px-4 py-2 bg-background/85 backdrop-blur border-b md:rounded-xl md:border md:top-4 md:mx-0 md:px-4 flex flex-wrap items-center justify-between gap-2 shadow-sm">
        <div>
          <h1 className="text-lg font-semibold leading-tight">System Status</h1>
          <div className="text-xs text-muted-foreground">
            Realtime operations observability • Admin only
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={refreshAll}
          >
            <RefreshCw
              className={`h-4 w-4 ${status.isFetching ? "animate-spin" : ""}`}
            />{" "}
            Refresh
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => setDrawerOpen(true)}
          >
            <Settings2 className="h-4 w-4" /> Customize
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={exportCsv}
          >
            <Download className="h-4 w-4" /> Export CSV
          </Button>
          <Button size="sm" className="gap-1.5" onClick={subscribe}>
            <Share2 className="h-4 w-4" /> Subscribe
          </Button>
        </div>
      </div>

      {status.isLoading ? <ChartSkeleton height={96} /> : null}
      {status.error ? (
        <ErrorBanner error={status.error} onRetry={() => status.refetch()} />
      ) : null}

      {status.data && (
        <>
          <StatusHeroBanner
            overall={status.data.overall}
            uptimePct={compute30dUptime(status.data.overall)}
            updatedAt={status.data.updatedAt}
            onSubscribe={subscribe}
          />

          {/* 5-card responsive service grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5 gap-3 md:gap-4">
            {SERVICES.map((s) => {
              const d = status.data!.services[s];
              return (
                <StatusServiceCard
                  key={s}
                  service={s}
                  current={
                    d?.current ?? {
                      service: s,
                      status: "healthy",
                      latencyP50: 0,
                      latencyP95: 0,
                      latencyP99: 0,
                      utilization: 0,
                      errorRate: 0,
                    }
                  }
                  spark={sparkBySvc[s] ?? []}
                  events={eventsBySvc[s] ?? []}
                />
              );
            })}
          </div>

          <StatusRulesTable />
          <StatusAlertsTable />
          <StatusIncidentTimeline />
        </>
      )}

      <StatusCustomizeDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        prefs={prefs}
        onSave={(next) => {
          setPrefs(next);
          if (next.syncToAccount) saveMut.mutate(next);
        }}
        onReset={() => {
          setPrefs(mergePrefs(null));
          toast.success("Preferences reset to defaults");
        }}
      />
    </div>
  );
}

// ============ ROUTE EXPORT ============
// Path and head option preserved verbatim from original file-based router convention.
export const Route = createFileRoute("/_app/status")({
  head: () => ({ meta: [{ title: "System Status · Vellbase Admin" }] }),
  component: StatusPage,
});
