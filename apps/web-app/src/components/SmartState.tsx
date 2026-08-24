import type { ReactNode } from "react";
import { Loader2, AlertTriangle, Inbox } from "lucide-react";
import { useSmartState, type UseSmartStateOptions } from "@/hooks/useSmartState";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/providers/I18nProvider";

export interface SmartStateProps extends UseSmartStateOptions {
  children: ReactNode;
  /**
   * Rendered during loading state (spinner).
   * If not provided, a default spinner is shown.
   */
  loadingComponent?: ReactNode;
  /**
   * Rendered during shimmer state (skeleton placeholder).
   * If not provided, falls back to loadingComponent or default spinner.
   */
  shimmerComponent?: ReactNode;
  /**
   * Rendered when data is empty.
   * If not provided, a default empty state is shown.
   */
  emptyComponent?: ReactNode;
  /**
   * Rendered when an error occurs.
   * If not provided, a default error state with retry is shown.
   */
  errorComponent?: ReactNode;
  /**
   * Called when the user clicks retry in the default error state.
   */
  onRetry?: () => void;
  /**
   * Title for the default empty state.
   */
  emptyTitle?: string;
  /**
   * Description for the default empty state.
   */
  emptyDescription?: string;
  /**
   * Title for the default error state.
   */
  errorTitle?: string;
  /**
   * CSS class for the wrapper div.
   */
  className?: string;
}

/**
 * Renders the appropriate state (loading, shimmer, empty, error, or children)
 * based on data-fetching state. Provides consistent UX across all data-driven
 * sections.
 */
export function SmartState({
  children,
  loadingComponent,
  shimmerComponent,
  emptyComponent,
  errorComponent,
  onRetry,
  emptyTitle,
  emptyDescription = "Check back later or try a different view.",
  errorTitle,
  className = "",
  ...options
}: SmartStateProps) {
  const { t } = useI18n();
  const { state, error } = useSmartState(options);

  const resolvedEmptyTitle = emptyTitle ?? t("emptyStates.nothingHere");
  const resolvedErrorTitle = errorTitle ?? t("errors.generic");

  switch (state) {
    case "loading":
      return (
        <div className={`flex min-h-[120px] items-center justify-center ${className}`}>
          {loadingComponent ?? (
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <Loader2 className="size-6 animate-spin" />
              <span className="text-sm">{t("common.loading")}</span>
            </div>
          )}
        </div>
      );

    case "shimmer":
      return (
        <div className={className}>
          {shimmerComponent ?? loadingComponent ?? (
            <div className="flex min-h-[120px] items-center justify-center">
              <div className="flex flex-col items-center gap-3 text-muted-foreground">
                <Loader2 className="size-6 animate-spin" />
                <span className="text-sm">{t("common.loading")}</span>
              </div>
            </div>
          )}
        </div>
      );

    case "empty":
      return (
        <div className={`flex min-h-[120px] items-center justify-center ${className}`}>
          {emptyComponent ?? (
            <div className="flex flex-col items-center gap-3 text-center text-muted-foreground">
              <div className="grid size-12 place-items-center rounded-full bg-muted">
                <Inbox className="size-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{resolvedEmptyTitle}</p>
                {emptyDescription && (
                  <p className="mt-1 max-w-xs text-xs">{emptyDescription}</p>
                )}
              </div>
            </div>
          )}
        </div>
      );

    case "error":
      return (
        <div className={`flex min-h-[120px] items-center justify-center ${className}`}>
          {errorComponent ?? (
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="grid size-12 place-items-center rounded-full bg-destructive/10">
                <AlertTriangle className="size-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm font-medium">{resolvedErrorTitle}</p>
                <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                  {error?.message || t("emptyStates.pleaseTryAgain")}
                </p>
              </div>
              {onRetry && (
                <Button size="sm" variant="outline" onClick={onRetry} className="mt-1 gap-1.5">
                  Try again
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
