import { Button } from "@/components/ui/button";
import type { OverallStatus } from "@/lib/api/services";
import { Bell, CheckCircle2, Clock, Rss, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const MAP: Record<OverallStatus, { label: string; cn: string; Icon: any }> = {
  operational: {
    label: "Operational",
    cn: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
    Icon: CheckCircle2,
  },
  degraded: {
    label: "Degraded",
    cn: "bg-amber-500/10 text-amber-600 border-amber-500/30",
    Icon: Clock,
  },
  outage: {
    label: "Outage",
    cn: "bg-rose-500/10 text-rose-600 border-rose-500/30",
    Icon: XCircle,
  },
};

export function timeAgo(iso: string): string {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function StatusHeroBanner({
  overall,
  uptimePct,
  updatedAt,
  onSubscribe,
}: {
  overall: OverallStatus;
  uptimePct: number;
  updatedAt: string;
  onSubscribe?: () => void;
}) {
  const m = MAP[overall];
  return (
    <section
      className={cn(
        "flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4 md:p-5 shadow-sm",
        m.cn,
      )}
    >
      <div className="flex items-center gap-3">
        <m.Icon className="h-6 w-6" />
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-lg font-semibold">{m.label}</span>
          <span className="text-sm text-muted-foreground">
            <span className="tabular-nums font-semibold text-foreground">
              {uptimePct.toFixed(3)}%
            </span>{" "}
            uptime (30d)
          </span>
          <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
            <Rss className="h-3 w-3 animate-pulse" /> Last sync{" "}
            {timeAgo(updatedAt)}
          </span>
        </div>
      </div>
      <Button
        size="sm"
        variant="default"
        className="gap-2"
        onClick={onSubscribe}
      >
        <Bell className="h-4 w-4" /> Subscribe to incidents
      </Button>
    </section>
  );
}
