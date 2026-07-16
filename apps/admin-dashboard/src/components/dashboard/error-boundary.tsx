import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { reportLovableError } from "@/lib/lovable-error-reporting";
import { logError, getCriticalErrors, acknowledgeError, type ErrorLogEntry } from "@/lib/monitoring/error-monitor";

type Props = {
  children: ReactNode;
  fallback?: (args: { error: Error; retry: () => void }) => ReactNode;
  boundary?: string;
};
type State = { error: Error | null; key: number };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, key: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const boundaryName = this.props.boundary ?? "dashboard_error_boundary";
    reportLovableError(error, {
      boundary: boundaryName,
      componentStack: info.componentStack ?? undefined,
    });
    logError(error, {
      boundary: boundaryName,
      componentStack: info.componentStack ?? undefined,
      url: typeof window !== "undefined" ? window.location.href : undefined,
    });
  }

  retry = () => this.setState((s) => ({ error: null, key: s.key + 1 }));

  render() {
    if (this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback({ error: this.state.error, retry: this.retry });
      }
      return <InlineError error={this.state.error} onRetry={this.retry} />;
    }
    return <div key={this.state.key}>{this.props.children}</div>;
  }
}

export function InlineError({
  error,
  onRetry,
  title = "Something went wrong",
}: {
  error?: Error | string;
  onRetry?: () => void;
  title?: string;
}) {
  const message =
    typeof error === "string"
      ? error
      : error?.message || "Please try again in a moment.";
  return (
    <div className="surface-card flex flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="grid size-10 place-items-center rounded-full bg-destructive/15 text-destructive">
        <AlertTriangle className="size-5" />
      </div>
      <div>
        <div className="text-sm font-semibold">{title}</div>
        <div className="mt-1 max-w-md text-xs text-muted-foreground">{message}</div>
      </div>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry} className="gap-1.5">
          <RotateCcw className="size-3.5" />
          Retry
        </Button>
      )}
    </div>
  );
}
