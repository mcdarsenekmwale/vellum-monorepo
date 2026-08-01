"use client";

import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth/context";
import { can, type Resource, type Action } from "@/lib/auth/rbac";
import { ReadOnlyBanner } from "./read-only-banner";
import { cn } from "@/lib/utils";

export type PermissionGuardProps = {
  resource: Resource;
  action?: Action;
  children: ReactNode;
  fallback?: ReactNode;
  showReadOnlyBanner?: boolean;
  className?: string;
};

/**
 * Admin-specific permission guard.
 * Hides children if the current user lacks permission for the given resource/action.
 * Optionally shows a read-only banner when the user can read but not write.
 */
export function PermissionGuard({
  resource,
  action = "read",
  children,
  fallback = null,
  showReadOnlyBanner = false,
  className,
}: PermissionGuardProps) {
  const { user } = useAuth();
  const allowed = can(user?.role, resource, action);

  if (!allowed) {
    return <>{fallback}</>;
  }

  const canWrite = action === "write" ? true : can(user?.role, resource, "write");

  return (
    <div className={cn(className)}>
      {showReadOnlyBanner && !canWrite && action === "read" && (
        <ReadOnlyBanner resource={resource} className="mb-4" />
      )}
      {children}
    </div>
  );
}

export type PermissionGateProps = {
  /** Minimum required permission action for this resource */
  resource: Resource;
  action?: Action;
  children: ReactNode;
  /** Rendered when permission check fails */
  fallback?: ReactNode;
};

/**
 * Simple permission gate that conditionally renders children.
 * Does not wrap in a div; use when you just need hide/show behavior.
 */
export function PermissionGate({
  resource,
  action = "read",
  children,
  fallback = null,
}: PermissionGateProps) {
  const { user } = useAuth();
  const allowed = can(user?.role, resource, action);

  if (!allowed) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
