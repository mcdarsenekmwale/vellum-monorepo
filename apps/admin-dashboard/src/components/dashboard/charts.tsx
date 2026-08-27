import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart as RechartsScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { cn } from "@/lib/utils";

const AXIS = { stroke: "var(--muted-foreground)", fontSize: 11 };
const GRID = { stroke: "var(--border)", strokeDasharray: "3 3" };

const TT = {
  contentStyle: {
    background: "var(--popover)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    fontSize: 12,
    color: "var(--popover-foreground)",
    boxShadow: "var(--shadow-elev-2)",
  },
  cursor: { stroke: "var(--border)" },
} as const;

type Series = { date: string; value: number }[];

export function AreaSpark({ data, color = "var(--chart-1)", height = 64 }: { data: Series; color?: string, height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 6, left: 0, right: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`sp-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.75}
          fill={`url(#sp-${color})`}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function LargeAreaChart({
  data,
  height = 280,
  showComparison = false,
  comparisonData,
}: {
  data: Series;
  height?: number;
  showComparison?: boolean;
  comparisonData?: Series;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="area-primary" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.4} />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
          </linearGradient>
          {showComparison && (
            <linearGradient id="area-comparison" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-3)" stopOpacity={0.3} />
              <stop offset="100%" stopColor="var(--chart-3)" stopOpacity={0} />
            </linearGradient>
          )}
        </defs>
        <CartesianGrid {...GRID} vertical={false} />
        <XAxis dataKey="date" {...AXIS} tickLine={false} axisLine={false} />
        <YAxis {...AXIS} tickLine={false} axisLine={false} width={36} />
        <Tooltip {...TT} />
        {showComparison && comparisonData && (
          <Area
            type="monotone"
            dataKey="value"
            data={comparisonData}
            stroke="var(--chart-3)"
            strokeWidth={1.5}
            strokeDasharray="5 3"
            fill="url(#area-comparison)"
            name="Previous"
          />
        )}
        <Area
          type="monotone"
          dataKey="value"
          stroke="var(--chart-1)"
          strokeWidth={2}
          fill="url(#area-primary)"
          name="Current"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function MultiLine({
  data,
  keys,
  height = 260,
}: {
  data: Record<string, number | string>[];
  keys: { key: string; color: string; label: string }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid {...GRID} vertical={false} />
        <XAxis dataKey="date" {...AXIS} tickLine={false} axisLine={false} />
        <YAxis {...AXIS} tickLine={false} axisLine={false} width={36} />
        <Tooltip {...TT} />
        {keys.map((k) => (
          <Line
            key={k.key}
            type="monotone"
            dataKey={k.key}
            stroke={k.color}
            strokeWidth={2}
            dot={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function BarSeries({
  data,
  height = 240,
  color = "var(--chart-1)",
}: {
  data: Series;
  height?: number;
  color?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid {...GRID} vertical={false} />
        <XAxis dataKey="date" {...AXIS} tickLine={false} axisLine={false} />
        <YAxis {...AXIS} tickLine={false} axisLine={false} width={36} />
        <Tooltip {...TT} />
        <Bar dataKey="value" fill={color} radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function Donut({
  data,
  height = 220,
}: {
  data: { name: string; value: number }[];
  height?: number;
}) {
  const COLORS = [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
    "var(--chart-6)",
    "var(--chart-7)",
    "var(--chart-8)",
    "var(--chart-9)",
    "var(--chart-10)",
    "var(--chart-11)",
    "var(--chart-12)",
    "var(--chart-13)",
    "var(--chart-14)",
    "var(--chart-15)",
    "var(--chart-16)",
    "var(--chart-17)",
    "var(--chart-18)",
    "var(--chart-19)",
    "var(--chart-20)",
    "var(--chart-21)",
    "var(--chart-22)",
    "var(--chart-23)",
    "var(--chart-24)",
    "var(--chart-25)",
    "var(--chart-26)",
  ];
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Tooltip {...TT} />
        <Pie
          data={data}
          dataKey="value"
          innerRadius={54}
          outerRadius={82}
          paddingAngle={2}
          stroke="var(--card)"
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}

// ─── HeatMap ─────────────────────────────────────────────────────────────────
// Custom CSS-grid heatmap — zero extra dependencies, fully responsive.

export type HeatMapPoint = { x: string; y: string; value: number };

function heatColor(value: number, max: number): string {
  if (max === 0 || value <= 0) return "var(--muted)";
  const ratio = value / max;
  if (ratio < 0.15) return "color-mix(in oklab, var(--chart-1) 12%, var(--muted))";
  if (ratio < 0.3) return "color-mix(in oklab, var(--chart-1) 25%, var(--muted))";
  if (ratio < 0.5) return "color-mix(in oklab, var(--chart-1) 45%, var(--muted))";
  if (ratio < 0.7) return "color-mix(in oklab, var(--chart-1) 65%, var(--muted))";
  if (ratio < 0.85) return "color-mix(in oklab, var(--chart-1) 82%, var(--muted))";
  return "var(--chart-1)";
}

export function HeatMap({
  data,
  height = 300,
  xLabel = "X",
  yLabel = "Y",
}: {
  data: HeatMapPoint[];
  height?: number;
  xLabel?: string;
  yLabel?: string;
}) {
  // Guard: empty data → friendly empty state
  const points = Array.isArray(data) ? data : [];
  if (points.length === 0) {
    return (
      <div
        className="grid w-full place-items-center rounded-lg border border-dashed border-muted text-xs text-muted-foreground"
        style={{ height }}
      >
        No activity data available for the selected period.
      </div>
    );
  }

  // Build sorted axes: sort x numerically (hours 00–23), preserve order of y as provided
  const rawX = [...new Set(points.map((d) => d.x))];
  const rawY = [...new Set(points.map((d) => d.y))];

  // Try numeric sort on x so hours/times line up left→right
  const xValues = [...rawX].sort((a, b) => {
    const na = Number(a);
    const nb = Number(b);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
    return a.localeCompare(b);
  });
  const yValues = rawY;

  const cols = xValues.length;
  const rows = yValues.length;
  const max = Math.max(1, ...points.map((d) => d.value));

  // Lookup: key "y|x" -> value
  const lookup = new Map<string, number>();
  for (const p of points) lookup.set(`${p.y}|${p.x}`, p.value);

  // Row height excludes ~60px of axis/labels/legend overhead
  const rowH = Math.max(16, (height - 60) / Math.max(1, rows));

  // Cell labels: show every Nth x label to avoid overlap when many cols
  const xLabelStep = cols > 12 ? Math.ceil(cols / 12) : 1;

  return (
    <div className="flex h-full w-full flex-col" style={{ height }}>
      {/* X-axis top label */}
      <div className="mb-1 flex items-center">
        <span className="w-10 shrink-0" aria-hidden />
        <div className="flex-1 text-center text-[10px] font-medium tracking-wide text-muted-foreground">
          {xLabel}
        </div>
      </div>

      {/* Body: y-label column + grid of cells */}
      <div className="flex min-h-0 flex-1 gap-2">
        {/* Y-axis row labels */}
        <div className="flex shrink-0 flex-col justify-around pr-1">
          <span
            className="pointer-events-none absolute -left-2 self-start text-[10px] font-medium tracking-wide text-muted-foreground origin-center whitespace-nowrap"
            style={{ transform: "rotate(-90deg) translateX(-100%) translateY(-14px)" }}
          >
            {yLabel}
          </span>
          {yValues.map((y) => (
            <div key={y} className="flex items-center justify-end" style={{ height: rowH }}>
              <span className="text-[10px] whitespace-nowrap text-muted-foreground pr-1 tabular-nums">{y}</span>
            </div>
          ))}
        </div>

        {/* Grid of cells (cols = xValues, rows = yValues) */}
        <div
          className="min-w-0 flex-1 overflow-x-auto"
          style={{ display: "block" }}
        >
          <div
            className="grid gap-[2px] rounded-md p-[2px]"
            style={{
              gridTemplateColumns: `repeat(${cols}, minmax(14px, 1fr))`,
              gridAutoRows: `${rowH}px`,
            }}
          >
            {yValues.map((y) =>
              xValues.map((x) => {
                const v = lookup.get(`${y}|${x}`) ?? 0;
                return (
                  <div
                    key={`${y}-${x}`}
                    className="group relative grid place-items-center rounded-[3px] transition-transform hover:scale-[1.2] hover:z-10"
                    style={{
                      width: "100%",
                      height: "100%",
                      background: heatColor(v, max),
                      boxShadow: v > 0 ? "inset 0 0 0 1px rgba(0,0,0,0.05)" : undefined,
                    }}
                  >
                    {v > 0 && rowH >= 18 && cols <= 16 && (
                      <span className="text-[9px] font-semibold leading-none text-white/90 pointer-events-none select-none drop-shadow-sm">
                        {v}
                      </span>
                    )}
                    {/* Hover tooltip */}
                    <div className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-[10px] text-popover-foreground shadow-md group-hover:block">
                      <span className="text-muted-foreground">{y} · {x}</span>
                      {"  "}
                      <span className="font-semibold">{v}</span>
                    </div>
                  </div>
                );
              }),
            )}
          </div>

          {/* X-axis labels under grid — aligned via grid columns */}
          <div
            className="mt-1 grid gap-[2px]"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(14px, 1fr))` }}
          >
            {xValues.map((x, idx) => (
              <div key={x} className="grid place-items-center">
                {idx % xLabelStep === 0 ? (
                  <span className="text-[9px] text-muted-foreground tabular-nums">{x}</span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-2 flex items-center justify-end gap-3 pr-1">
        <span className="text-[10px] text-muted-foreground">Low</span>
        <div className="flex h-2.5 overflow-hidden rounded-full border">
          {[0.1, 0.3, 0.5, 0.7, 0.9, 1].map((r) => (
            <div key={r} className="w-4" style={{ background: heatColor(r * max, max) }} />
          ))}
        </div>
        <span className="text-[10px] text-muted-foreground">High</span>
        <span className="text-[10px] text-muted-foreground/70 tabular-nums">max {max}</span>
      </div>
    </div>
  );
}

// ─── ScatterChart ────────────────────────────────────────────────────────────
// Uses recharts ScatterChart for correlation analysis.

export function ScatterPlot({
  data,
  xKey = "x",
  yKey = "y",
  xLabel = "X",
  yLabel = "Y",
  color = "var(--chart-1)",
  height = 280,
}: {
  data: Record<string, number | string>[];
  xKey?: string;
  yKey?: string;
  xLabel?: string;
  yLabel?: string;
  color?: string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsScatterChart margin={{ top: 12, right: 12, left: 0, bottom: 8 }}>
        <CartesianGrid {...GRID} vertical={false} />
        <XAxis
          type="number"
          dataKey={xKey}
          name={xLabel}
          {...AXIS}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          type="number"
          dataKey={yKey}
          name={yLabel}
          {...AXIS}
          tickLine={false}
          axisLine={false}
          width={36}
        />
        <ZAxis range={[40, 40]} />
        <Tooltip
          {...TT}
          cursor={{ strokeDasharray: "3 3" }}
        />
        <Scatter data={data} fill={color} />
      </RechartsScatterChart>
    </ResponsiveContainer>
  );
}

// ─── RadarChart ──────────────────────────────────────────────────────────────
// Uses recharts RadarChart for multi-metric comparison.

export function RadarMulti({
  data,
  keys,
  height = 280,
}: {
  data: Record<string, number | string>[];
  keys: { key: string; color: string; label: string }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={data} outerRadius="70%">
        <PolarGrid stroke="var(--border)" />
        <PolarAngleAxis dataKey="metric" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
        <PolarRadiusAxis tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} />
        <Tooltip {...TT} />
        {keys.map((k) => (
          <Radar
            key={k.key}
            name={k.label}
            dataKey={k.key}
            stroke={k.color}
            fill={k.color}
            fillOpacity={0.15}
            strokeWidth={2}
          />
        ))}
      </RadarChart>
    </ResponsiveContainer>
  );
}

/* ===================== RadialGauge ===================== */
interface RadialGaugeProps {
  value: number;
  max?: number;
  warningThreshold?: number;
  criticalThreshold?: number;
  label?: string;
  size?: number;
  unit?: string;
}
export function RadialGauge({
  value,
  max = 100,
  warningThreshold = 70,
  criticalThreshold = 90,
  label,
  size = 112,
  unit = "%",
}: RadialGaugeProps) {
  const clamped = Math.max(0, Math.min(max, value));
  const pct = clamped / max;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const dash = circumference * pct;
  const ringColor =
    clamped >= criticalThreshold
      ? "stroke-rose-500"
      : clamped >= warningThreshold
        ? "stroke-amber-500"
        : "stroke-emerald-500";
  const textColor =
    clamped >= criticalThreshold
      ? "text-rose-600"
      : clamped >= warningThreshold
        ? "text-amber-600"
        : "text-emerald-600";
  return (
    <div
      className="relative inline-grid place-items-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          fill="none"
          className="stroke-border"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          fill="none"
          className={ringColor}
          strokeLinecap="round"
          style={{
            strokeDasharray: `${dash} ${Math.max(0, circumference - dash)}`,
            transition: "stroke-dasharray 400ms ease",
          }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div
            className={cn(
              "text-lg font-semibold tabular-nums leading-none",
              textColor,
            )}
          >
            {Math.round(clamped)}
            <span className="text-xs text-muted-foreground ml-0.5 font-normal">
              {unit}
            </span>
          </div>
          {label ? (
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
              {label}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
