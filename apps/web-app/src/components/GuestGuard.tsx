import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { LogIn } from "lucide-react";

export type GuestMode = "hide" | "disable" | "prompt";

export interface GuestGuardProps {
  /**
   * The authenticated user object, or null/undefined if guest.
   */
  user: unknown | null | undefined;
  /**
   * Content to render when user is authenticated.
   */
  children: ReactNode;
  /**
   * How to handle the element for guests:
   * - "hide": Don't render anything (default for destructive actions)
   * - "disable": Render but disable interaction (default for forms)
   * - "prompt": Show a login prompt instead (default for engagement actions)
   */
  mode?: GuestMode;
  /**
   * Custom fallback when mode is "hide" or user wants override.
   */
  fallback?: ReactNode;
  /**
   * CSS class applied to the wrapper when mode is "disable".
   */
  className?: string;
  /**
   * Message shown in prompt mode.
   */
  promptMessage?: string;
  /**
   * Redirect path after login.
   */
  redirectTo?: string;
}

/**
 * Conditionally renders content based on authentication state.
 * For guest users, can hide, disable, or show a login prompt.
 *
 * @example
 * // Hide button for guests
 * <GuestGuard user={user} mode="hide">
 *   <Button onClick={handleDelete}>Delete</Button>
 * </GuestGuard>
 *
 * @example
 * // Disable form for guests
 * <GuestGuard user={user} mode="disable">
 *   <input ... />
 * </GuestGuard>
 *
 * @example
 * // Show login prompt for guests
 * <GuestGuard user={user} mode="prompt" promptMessage="Sign in to leave a comment">
 *   <CommentForm />
 * </GuestGuard>
 */
export function GuestGuard({
  user,
  children,
  mode = "hide",
  fallback,
  className = "",
  promptMessage = "Sign in to continue",
  redirectTo = "/login",
}: GuestGuardProps) {
  const isAuthenticated = !!user;

  if (isAuthenticated) {
    return <>{children}</>;
  }

  // Guest user handling
  switch (mode) {
    case "hide":
      return <>{fallback ?? null}</>;

    case "disable": {
      return (
        <div
          className={`pointer-events-none cursor-not-allowed opacity-50 ${className}`}
          aria-disabled="true"
          title="Sign in to use this feature"
        >
          {children}
        </div>
      );
    }

    case "prompt":
      return (
        <div className={`rounded-lg border border-dashed bg-muted/30 p-6 text-center ${className}`}>
          <p className="text-sm text-muted-foreground">{promptMessage}</p>
          <Button
            size="sm"
            variant="outline"
            className="mt-3 gap-1.5"
            asChild
          >
            <Link to={redirectTo} search={{ redirect: typeof window !== "undefined" ? window.location.pathname : "/" }}>
              <LogIn className="size-4" />
              Sign in
            </Link>
          </Button>
        </div>
      );

    default:
      return null;
  }
}
