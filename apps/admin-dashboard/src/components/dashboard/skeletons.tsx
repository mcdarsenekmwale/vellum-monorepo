import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

export function Shimmer({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <div
      style={style}
      className={cn(
        "relative overflow-hidden rounded-md bg-muted/60",
        "before:absolute before:inset-0 before:-translate-x-full",
        "before:animate-[shimmer_1.4s_ease-in-out_infinite]",
        "before:bg-gradient-to-r before:from-transparent before:via-foreground/5 before:to-transparent",
        className,
      )}
    />
  );
}

export function StatCardSkeleton() {
  return (
    <div className="surface-card p-4 sm:p-5">
      <Shimmer className="h-3 w-24" />
      <Shimmer className="mt-4 h-7 w-32" />
      <Shimmer className="mt-2 h-3 w-16" />
    </div>
  );
}

export function ChartSkeleton({ height = 260 }: { height?: number }) {
  return (
    <div className="surface-card p-4">
      <Shimmer className="h-3 w-32" />
      <div className="mt-4 flex items-end gap-2" style={{ height }}>
        {Array.from({ length: 16 }).map((_, i) => (
          <Shimmer
            key={i}
            className="flex-1 rounded-sm"
            style={{ height: `${30 + ((i * 37) % 70)}%` }}
          />
        ))}
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 8, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="divide-y">
      <div className="grid gap-3 bg-muted/40 p-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
        {Array.from({ length: cols }).map((_, i) => (
          <Shimmer key={i} className="h-3" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="grid gap-3 p-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
          {Array.from({ length: cols }).map((_, c) => (
            <Shimmer key={c} className={cn("h-4", c === 0 && "w-3/4")} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  );
}
