"use client";

import { Eye, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

export type ReadOnlyBannerProps = {
  resource: string;
  className?: string;
  variant?: "banner" | "inline";
};

export function ReadOnlyBanner({
  resource,
  className,
  variant = "banner",
}: ReadOnlyBannerProps) {
  if (variant === "inline") {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border bg-amber-500/5 px-2 py-1 text-xs text-amber-700 dark:text-amber-400 border-amber-500/20",
          className
        )}
      >
        <Eye className="size-3" />
        <span>Read-only: you can view but not modify {resource}</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border bg-amber-500/5 px-4 py-3 text-sm text-amber-800 dark:text-amber-400 border-amber-500/20",
        className
      )}
    >
      <div className="grid size-8 place-items-center rounded-full bg-amber-500/10 shrink-0">
        <Lock className="size-4 text-amber-600 dark:text-amber-400" />
      </div>
      <div>
        <p className="font-medium">Read-only mode</p>
        <p className="text-xs text-amber-700/80 dark:text-amber-400/80">
          You can view {resource}, but you need higher permissions to make changes.
        </p>
      </div>
    </div>
  );
}
