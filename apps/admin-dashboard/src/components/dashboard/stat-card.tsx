import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatCardSkeleton } from "./skeletons";

export { StatCardSkeleton };

export function StatCard({
  label,
  value,
  delta,
  hint,
  icon: Icon,
  tone = "default",
  loading = false,
}: {
  label: string;
  value: string | number;
  delta?: any;
  hint?: string;
  icon?: LucideIcon;
  tone?: "default" | "primary" | "success" | "warning" | "info" | "destructive";
  loading?: boolean;
}) {
  if (loading) return <StatCardSkeleton />;
  const positive = (delta ?? 0) >= 0;
  const toneBg: Record<string, string> = {
    default: "bg-muted text-foreground",
    primary: "bg-primary/10 text-primary",
    success: "bg-success/15 text-success",
    warning: "bg-warning/20 text-warning",
    info: "bg-info/15 text-info",
    destructive: "bg-destructive/15 text-destructive",
  };
  return (
    <div className="surface-card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        {Icon && (
          <div className={cn("grid size-8 place-items-center rounded-md", toneBg[tone])}>
            <Icon className="size-4" />
          </div>
        )}
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <div className="text-2xl font-semibold tabular-nums tracking-tight">
          {value}
        </div>
        {typeof delta === "number" && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-medium tabular-nums",
              positive
                ? "bg-success/15 text-success"
                : "bg-destructive/15 text-destructive",
            )}
          >
            {positive ? (
              <ArrowUpRight className="size-3" />
            ) : (
              <ArrowDownRight className="size-3" />
            )}
            {Math.abs(delta).toFixed(1)}%
          </span>
        )}
        {typeof delta === "string" && <div className="text-xs text-muted-foreground">{delta}</div>}
      </div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
