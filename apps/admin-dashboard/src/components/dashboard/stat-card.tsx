import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight, Minus, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatCardSkeleton } from "./skeletons";
import { ReactNode, useMemo } from "react";

export { StatCardSkeleton };

// ─── Types ───

interface TrendData {
  value: number;
  label?: string;
  direction?: "up" | "down" | "flat";
  icon?: ReactNode;
}

interface StatCardProps {
  label: string;
  value: string | number;
  delta?: number | string;
  hint?: string;
  icon?: LucideIcon;
  tone?: "default" | "primary" | "success" | "warning" | "info" | "destructive";
  loading?: boolean;
  error?: boolean;
  trend?: ReactNode | TrendData | number;
  className?: string;
  onClick?: () => void;
}

// ─── Helper Functions ───

function formatTrendValue(value: number): string {
  if (value === 0) return "0%";
  const abs = Math.abs(value);
  const formatted = abs % 1 === 0 ? abs.toString() : abs.toFixed(1);
  return `${formatted}%`;
}

function getTrendColor(value: number): string {
  if (value > 0) return "text-emerald-500 bg-emerald-500/15";
  if (value < 0) return "text-rose-500 bg-rose-500/15";
  return "text-muted-foreground bg-muted/30";
}

function getTrendIcon(value: number): ReactNode {
  if (value > 0) return <TrendingUp className="size-3" />;
  if (value < 0) return <TrendingDown className="size-3" />;
  return <Minus className="size-3" />;
}

// ─── Main Component ───

export function StatCard({
  label,
  value,
  delta,
  hint,
  icon: Icon,
  tone = "default",
  loading = false,
  error = false,
  trend,
  className,
  onClick,
}: StatCardProps) {
  // ─── Loading & Error States ───
  if (loading) return <StatCardSkeleton />;
  if (error) {
    return (
      <div className={cn("surface-card p-4 sm:p-5", className)}>
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </div>
          {Icon && (
            <div className="grid size-8 place-items-center rounded-md bg-destructive/10 text-destructive">
              <Icon className="size-4" />
            </div>
          )}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <div className="text-sm text-destructive">Error loading data</div>
        </div>
      </div>
    );
  }

  // ─── Parse Delta ───
  const deltaNum = typeof delta === "number" ? delta : undefined;
  const deltaStr = typeof delta === "string" ? delta : undefined;
  const isDeltaPositive = deltaNum !== undefined && deltaNum >= 0;

  // ─── Parse Trend ───
  const trendData = useMemo(() => {
    // If trend is a number, treat it as a percentage value
    if (typeof trend === "number") {
      return {
        value: trend,
        direction: trend > 0 ? "up" : trend < 0 ? "down" : "flat" as const,
        label: formatTrendValue(trend),
      };
    }
    // If trend is a ReactNode, render it as-is
    if (trend && typeof trend === "object" && "type" in trend) {
      return { custom: true, node: trend };
    }
    // If trend is a TrendData object
    if (trend && typeof trend === "object" && "value" in trend) {
      const t = trend as TrendData;
      return {
        value: t.value,
        direction: t.direction || (t.value > 0 ? "up" : t.value < 0 ? "down" : "flat"),
        label: t.label || formatTrendValue(t.value),
        icon: t.icon,
      };
    }
    return null;
  }, [trend]);

  // ─── Tone Colors ───
  const toneBg: Record<string, string> = {
    default: "bg-muted text-foreground",
    primary: "bg-primary/10 text-primary",
    success: "bg-success/15 text-success",
    warning: "bg-warning/20 text-warning",
    info: "bg-info/15 text-info",
    destructive: "bg-destructive/15 text-destructive",
  };

  // ─── Render Trend ───
  const renderTrend = () => {
    // If trend is a custom ReactNode
    if (trendData && "custom" in trendData) {
      return trendData.node;
    }

    // If trend is a TrendData object
    if (trendData && "value" in trendData) {
      const { value, direction, label, icon } = trendData;
      const color = getTrendColor(value);
      const TrendIcon = icon || getTrendIcon(value);

      return (
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
            color
          )}
        >
          {TrendIcon}
          {label}
        </span>
      );
    }

    // Fallback to delta-based trend if no trend provided
    if (deltaNum !== undefined) {
      const color = isDeltaPositive ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive";
      const Icon = isDeltaPositive ? TrendingUp : TrendingDown;
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
            color
          )}
        >
          <Icon className="size-3" />
          {isDeltaPositive ? "+" : ""}{deltaNum.toFixed(1)}%
        </span>
      );
    }

    return null;
  };

  // ─── Render ───
  return (
    <div
      className={cn(
        "surface-card p-4 sm:p-5 transition-colors",
        onClick && "cursor-pointer hover:bg-muted/30",
        className
      )}
      onClick={onClick}
    >
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

      <div className="mt-3 flex flex-wrap items-baseline gap-2">
        <div className="text-2xl font-semibold tabular-nums tracking-tight">
          {value}
        </div>

        {/* Trend Badge */}
        {renderTrend()}

        {/* Delta String (if provided) */}
        {deltaStr && (
          <span className="text-xs text-muted-foreground">{deltaStr}</span>
        )}
      </div>

      {/* Hint */}
      {hint && (
        <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
      )}
    </div>
  );
}

// ─── Trend Helper Component ───

interface TrendBadgeProps {
  value: number;
  label?: string;
  size?: "sm" | "md";
  showIcon?: boolean;
}

export function TrendBadge({ value, label, size = "sm", showIcon = true }: TrendBadgeProps) {
  const isPositive = value > 0;
  const isNegative = value < 0;
  const isFlat = value === 0;

  const color = isPositive ? "text-emerald-500" : isNegative ? "text-rose-500" : "text-muted-foreground";
  const bgColor = isPositive ? "bg-emerald-500/15" : isNegative ? "bg-rose-500/15" : "bg-muted/30";
  const Icon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus;
  const formattedValue = value % 1 === 0 ? value.toString() : value.toFixed(1);
  const displayLabel = label || `${isPositive ? "+" : ""}${formattedValue}%`;

  const sizeClasses = {
    sm: "text-xs px-2 py-0.5 gap-1",
    md: "text-sm px-3 py-1 gap-1.5",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium tabular-nums",
        sizeClasses[size],
        color,
        bgColor
      )}
    >
      {showIcon && <Icon className={cn("size-3", size === "md" && "size-3.5")} />}
      {displayLabel}
    </span>
  );
}

// ─── Trend Builder Functions ───

export function createTrendFromDelta(current: number, previous: number): TrendData {
  if (previous === 0) return { value: 0, direction: "flat", label: "0%" };
  const percentage = ((current - previous) / previous) * 100;
  return {
    value: percentage,
    direction: percentage > 0 ? "up" : percentage < 0 ? "down" : "flat",
    label: formatTrendValue(percentage),
  };
}

export function createTrendFromPeriod(
  currentPeriod: number[],
  previousPeriod: number[]
): TrendData {
  const currentAvg = currentPeriod.reduce((a, b) => a + b, 0) / currentPeriod.length;
  const prevAvg = previousPeriod.reduce((a, b) => a + b, 0) / previousPeriod.length;
  return createTrendFromDelta(currentAvg, prevAvg);
}

