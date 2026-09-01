import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/providers/I18nProvider";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * Fallback UI rendered when the boundary catches an error. Extracted as a
 * function component so it can use the `useI18n` hook (unavailable in the
 * class-based boundary's `render` method).
 */
function ErrorFallback({ error, onRetry }: { error?: Error; onRetry: () => void }) {
  const { t } = useI18n();
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 py-12 text-center">
      <div className="grid size-16 place-items-center rounded-full bg-destructive/10">
        <AlertTriangle className="size-8 text-destructive" />
      </div>
      <h2 className="mt-6 text-lg font-semibold">{t("errors.generic")}</h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        {error?.message || "An unexpected error occurred. Please try again or go back home."}
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="gap-1.5"
        >
          <RotateCcw className="size-4" />
          Try again
        </Button>
        <Button size="sm" className="gap-1.5" asChild>
          <Link to="/">
            <Home className="size-4" />
            Go home
          </Link>
        </Button>
      </div>
    </div>
  );
}

/**
 * Enhanced error boundary for the web app with retry and navigation options.
 * Catches React rendering errors and displays a user-friendly fallback UI.
 */
export class EnhancedErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[EnhancedErrorBoundary] Caught error:", error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return <ErrorFallback error={this.state.error} onRetry={this.handleRetry} />;
    }

    return this.props.children;
  }
}
