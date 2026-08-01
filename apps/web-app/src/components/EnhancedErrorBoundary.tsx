import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

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

      return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 py-12 text-center">
          <div className="grid size-16 place-items-center rounded-full bg-destructive/10">
            <AlertTriangle className="size-8 text-destructive" />
          </div>
          <h2 className="mt-6 text-lg font-semibold">Something went wrong</h2>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            {this.state.error?.message ||
              "An unexpected error occurred. Please try again or go back home."}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={this.handleRetry}
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

    return this.props.children;
  }
}
