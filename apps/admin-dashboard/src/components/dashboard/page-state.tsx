"use client";

import type { ReactNode } from "react";
import { useMemo } from "react";
import { AlertTriangle, Inbox, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChartSkeleton } from "./skeletons";
import { cn } from "@/lib/utils";

export type PageStateType = "loading" | "shimmer" | "empty" | "error" | "success";

export type PageStateOptions = {
  isLoading?: boolean;
  isError?: boolean;
  error?: Error | null | unknown;
  data?: unknown;
  useShimmer?: boolean;
  isEmpty?: (data: unknown) => boolean;
};

export type PageStateResult = {
  state: PageStateType;
  error: Error | null;
  isLoading: boolean;
  isEmpty: boolean;
  isError: boolean;
};

function defaultIsEmpty(data: unknown): boolean {
  if (data == null) return true;
  if (Array.isArray(data)) return data.length === 0;
  if (typeof data === "object") return Object.keys(data).length === 0;
  return false;
}

export function usePageState(options: PageStateOptions): PageStateResult {
  const {
    isLoading = false,
    isError = false,
    error = null,
    data,
    useShimmer = false,
    isEmpty: isEmptyFn = defaultIsEmpty,
  } = options;

  return useMemo(() => {
    if (isError || error) {
      const err =
        error instanceof Error
          ? error
          : new Error(typeof error === "string" ? error : "An error occurred");
      return { state: "error", error: err, isLoading: false, isEmpty: false, isError: true };
    }
    if (isLoading) {
      return {
        state: useShimmer ? "shimmer" : "loading",
        error: null,
        isLoading: true,
        isEmpty: false,
        isError: false,
      };
    }
    const empty = isEmptyFn(data);
    if (empty) {
      return { state: "empty", error: null, isLoading: false, isEmpty: true, isError: false };
    }
    return { state: "success", error: null, isLoading: false, isEmpty: false, isError: false };
  }, [isLoading, isError, error, data, useShimmer, isEmptyFn]);
}

export type PageStateProps = PageStateOptions & {
  children: ReactNode;
  className?: string;
  loadingComponent?: ReactNode;
  shimmerComponent?: ReactNode;
  emptyComponent?: ReactNode;
  errorComponent?: ReactNode;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: ReactNode;
  errorTitle?: string;
  minHeight?: string;
};

export function PageState({
  children,
  className,
  loadingComponent,
  shimmerComponent,
  emptyComponent,
  errorComponent,
  onRetry,
  emptyTitle = "Nothing to show yet",
  emptyDescription = "Try adjusting your filters or check back later.",
  emptyIcon,
  errorTitle = "Couldn't load data",
  minHeight = "min-h-[200px]",
  ...options
}: PageStateProps) {
  const { state, error } = usePageState(options);

  switch (state) {
    case "loading":
      return (
        <div className={cn(`flex items-center justify-center ${minHeight}`, className)}>
          {loadingComponent ?? (
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <Loader2 className="size-6 animate-spin" />
              <span className="text-sm">Loading...</span>
            </div>
          )}
        </div>
      );

    case "shimmer":
      return (
        <div className={cn(className)}>
          {shimmerComponent ?? loadingComponent ?? <ChartSkeleton height={200} />}
        </div>
      );

    case "empty":
      return (
        <div className={cn(`flex items-center justify-center ${minHeight}`, className)}>
          {emptyComponent ?? (
            <div className="flex flex-col items-center text-center px-4">
              <div className="grid size-12 place-items-center rounded-full bg-muted">
                {emptyIcon ?? <Inbox className="size-5 text-muted-foreground" />}
              </div>
              <h3 className="mt-3 text-sm font-medium">{emptyTitle}</h3>
              {emptyDescription && (
                <p className="mt-1 max-w-xs text-xs text-muted-foreground">{emptyDescription}</p>
              )}
            </div>
          )}
        </div>
      );

    case "error":
      return (
        <div className={cn(`flex items-center justify-center ${minHeight}`, className)}>
          {errorComponent ?? (
            <div className="flex flex-col items-center text-center px-4">
              <div className="grid size-12 place-items-center rounded-full bg-destructive/10">
                <AlertTriangle className="size-5 text-destructive" />
              </div>
              <h3 className="mt-3 text-sm font-medium">{errorTitle}</h3>
              {error?.message && (
                <p className="mt-1 max-w-xs text-xs text-muted-foreground">{error.message}</p>
              )}
              {onRetry && (
                <Button size="sm" variant="outline" className="mt-4 gap-1.5" onClick={onRetry}>
                  <RotateCcw className="size-3.5" /> Try again
                </Button>
              )}
            </div>
          )}
        </div>
      );

    case "success":
    default:
      return <div className={className}>{children}</div>;
  }
}
