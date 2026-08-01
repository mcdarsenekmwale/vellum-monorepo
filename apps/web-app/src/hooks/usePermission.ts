import { useMemo } from "react";

export type WebPermission =
  | "read:articles"
  | "write:articles"
  | "read:comments"
  | "write:comments"
  | "read:profile"
  | "write:profile"
  | "read:settings"
  | "write:settings"
  | "follow:users"
  | "like:content"
  | "save:content"
  | "share:content"
  | "compose:content"
  | "read:discover"
  | "read:author";

/**
 * Permission matrix for the web app.
 * Guest users have read-only access to public content.
 */
const WEB_PERMISSIONS: Record<WebPermission, { auth: boolean; guest: boolean }> = {
  "read:articles":    { auth: true, guest: true },
  "write:articles":   { auth: true, guest: false },
  "read:comments":    { auth: true, guest: true },
  "write:comments":   { auth: true, guest: false },
  "read:profile":     { auth: true, guest: true },
  "write:profile":    { auth: true, guest: false },
  "read:settings":    { auth: true, guest: false },
  "write:settings":   { auth: true, guest: false },
  "follow:users":     { auth: true, guest: false },
  "like:content":     { auth: true, guest: false },
  "save:content":     { auth: true, guest: false },
  "share:content":    { auth: true, guest: true },
  "compose:content":  { auth: true, guest: false },
  "read:discover":    { auth: true, guest: true },
  "read:author":      { auth: true, guest: true },
};

export interface UsePermissionResult {
  isGuest: boolean;
  isAuthenticated: boolean;
  can: (permission: WebPermission) => boolean;
  canRead: (permission: WebPermission) => boolean;
}

/**
 * Hook for checking web app permissions.
 * Returns permission helpers based on authentication state.
 *
 * @example
 * const { can, isGuest } = usePermission(user);
 * if (can("write:comments")) { ... }
 */
export function usePermission(user: unknown | null | undefined): UsePermissionResult {
  const isAuthenticated = !!user;
  const isGuest = !isAuthenticated;

  const can = useMemo(() => {
    return (permission: WebPermission): boolean => {
      const config = WEB_PERMISSIONS[permission];
      if (!config) return false;
      return isAuthenticated ? config.auth : config.guest;
    };
  }, [isAuthenticated]);

  const canRead = useMemo(() => {
    return (permission: WebPermission): boolean => {
      // Read permissions are generally more permissive
      const readPerm = permission.replace("write:", "read:") as WebPermission;
      return can(readPerm);
    };
  }, [can]);

  return {
    isGuest,
    isAuthenticated,
    can,
    canRead,
  };
}
