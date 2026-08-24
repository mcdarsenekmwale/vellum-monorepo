"use client";

import { useCallback } from "react";
import { useAuth } from "../auth/context";
import { can, canVisit, requiredRoleFor, roleAtLeast, type Role, type Resource, type Action } from "./rbac";
import { toast } from "sonner";

export function usePermissions() {
  const { user, isAuthenticated, isReady } = useAuth();
  const role = user?.role;

  const hasRole = useCallback(
    (min: Role): boolean => {
      if (!isReady) return false;
      return roleAtLeast(role, min);
    },
    [role, isReady]
  );

  const canAccess = useCallback(
    (resource: Resource, action: Action = "read"): boolean => {
      if (!isReady) return false;
      return can(role, resource, action);
    },
    [role, isReady]
  );

  const canNavigate = useCallback(
    (path: string): boolean => {
      if (!isReady) return false;
      return canVisit(role, path);
    },
    [role, isReady]
  );

  const getRequiredRole = useCallback(
    (path: string): Role => {
      return requiredRoleFor(path);
    },
    []
  );

  const checkAndNotify = useCallback(
    (resource: Resource, action: Action = "read", actionName?: string): boolean => {
      const allowed = canAccess(resource, action);
      if (!allowed && isReady) {
        const actionText = actionName || `${action} ${resource}`;
        toast.warning(`You don't have permission to ${actionText}`, {
          description: `Requires ${requiredRoleFor(`/${resource}`)} role`,
          duration: 3000,
        });
      }
      return allowed;
    },
    [canAccess, isReady]
  );

  return {
    role,
    user,
    isAuthenticated,
    isReady,
    hasRole,
    canAccess,
    canNavigate,
    getRequiredRole,
    checkAndNotify,
  };
}

export function useRoleGuard(minRole: Role) {
  const { hasRole, isReady, isAuthenticated, user } = usePermissions();
  const isAllowed = hasRole(minRole);

  return {
    isAllowed,
    isReady,
    isAuthenticated,
    user,
    hasRequiredRole: isAllowed,
    requiredRole: minRole,
  };
}

export function roleDisplayName(role: Role): string {
  const displayNames: Record<Role, string> = {
    Guest: "Guest",
    User: "User",
    Creator: "Content Creator",
    Moderator: "Moderator",
    Editor: "Editor",
    Admin: "Admin",
    SuperAdmin: "Super Admin",
    SupportAgent: "Support Agent",
    SupportAdmin: "Support Admin",
  };
  return displayNames[role];
}
