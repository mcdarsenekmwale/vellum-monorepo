"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Role } from "./rbac";
import { roleAtLeast, can as canCheck, canVisit as canVisitCheck, type Resource, type Action } from "./rbac";
import { API_BASE_URL } from "@/lib/api/client";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  handle: string;
  role: Role;
  avatarSeed: string;
  avatar: string | null;

  lastLoginAt?: string;
  bio?: string | null;
  location?: string | null;
  website?: string | null;
  publication?: string | null;

  twoFactorEnabled?: boolean;
  emailNotifications?: boolean;

  isVerified?: boolean;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type AuthState = {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isReady: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
  refreshUser: () => Promise<void>;
  hasRole: (min: Role) => boolean;
  can: (resource: Resource, action?: Action) => boolean;
  canVisit: (path: string) => boolean;
};

const STORAGE_KEY = "vellum.admin.session.v1";
const REFRESH_TOKEN_KEY = "vellum.admin.refresh.v1";

const AuthContext = createContext<AuthState | undefined>(undefined);

/**
 * Converts an API role string to a display-friendly format
 * Handles both predefined roles and custom roles
 * 
 * Examples:
 * - ADMIN -> Admin
 * - SUPPORT_ADMIN -> Support Admin
 * - EXAMPLE_ROLE -> Example Role
 * - CUSTOM_ROLE_NAME -> Custom Role Name
 * 
 * @param apiRole - The role string from the API (uppercase with underscores)
 * @returns A formatted display name for the role
 */

// ─── Alternative: More robust version with handling for edge cases ───

function roleFromApiRole(apiRole: string): string {
  if (!apiRole || typeof apiRole !== "string") {
    return "User";
  }

  // ─── Predefined role mapping ───
  const roleMap: Record<string, string> = {
    ADMIN: "Admin",
    MODERATOR: "Moderator",
    CREATOR: "Creator",
    USER: "User",
    GUEST: "Guest",
    SUPPORT_ADMIN: "SupportAdmin",
    SUPPORT_AGENT: "SupportAgent",
    SUPER_ADMIN: "SuperAdmin",
    CONTENT_MANAGER: "ContentManager",
    ANALYTICS_VIEWER: "AnalyticsViewer",
  };

  // ─── Check if it's a predefined role ───
  if (roleMap[apiRole]) {
    return roleMap[apiRole];
  }

  // ─── Handle custom roles ───
  // Split by underscore, capitalize each part, and join with spaces
  const parts = apiRole.split("_");
  const formatted = parts
    .map((part) => {
      // Handle edge cases like abbreviations (e.g., "API" -> "API")
      if (part === part.toUpperCase() && part.length <= 3) {
        return part;
      }
      // Capitalize first letter, keep the rest as is
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join("");

  return formatted;
}


function mapApiUser(apiUser: any): AuthUser {
  const handle = apiUser.handle || apiUser.email?.split("@")[0] || "user";

   return {
    id: apiUser.id,
    name: apiUser.name,
    email: apiUser.email,
    handle: handle.startsWith("@") ? handle : `@${handle}`,
    role: roleFromApiRole(apiUser.role) as any,
    avatarSeed: handle,
    avatar: apiUser.avatar ?? null,
    bio: apiUser.bio ?? null,
    website: apiUser.website ?? null,
    location: apiUser.location ?? null,
    publication: apiUser.publication ?? null,
    isActive: apiUser.isActive,
    isVerified: apiUser.emailVerified ? true : false,
    emailNotifications: apiUser.emailNotifications ?? true,
    createdAt: apiUser.createdAt,
    updatedAt: apiUser.updatedAt,
  };
}

async function rawFetch<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null,
): Promise<{ data: T; status: number }> {
  const base = API_BASE_URL.replace(/\/+$/, "");
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const text = await res.text();
  const data = text ? safeJson(text) : undefined;
  return { data: data as T, status: res.status };
}

function safeJson(t: string): unknown {
  try {
    return JSON.parse(t);
  } catch {
    return t;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isReady, setReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const refreshPromiseRef = useRef<Promise<boolean> | null>(null);

  const clearSession = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    setUser(null);
    setToken(null);
  }, []);

  const saveSession = useCallback((authUser: AuthUser, accessToken: string, refreshToken?: string) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ user: authUser, token: accessToken }));
    if (refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    }
    setUser(authUser);
    setToken(accessToken);
  }, []);

  const refreshSession = useCallback(async (): Promise<boolean> => {
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    const promise = (async () => {
      try {
        const storedRefresh = localStorage.getItem(REFRESH_TOKEN_KEY);
        if (!storedRefresh) {
          clearSession();
          return false;
        }

        const { data, status } = await rawFetch<{ accessToken: string; refreshToken?: string }>(
          "/auth/refresh",
          { method: "POST", body: JSON.stringify({ refreshToken: storedRefresh }) },
        );

        if (status !== 200) {
          clearSession();
          return false;
        }

        const storedRaw = localStorage.getItem(STORAGE_KEY);
        if (storedRaw) {
          const stored = JSON.parse(storedRaw) as { user?: AuthUser };
          if (stored.user) {
            saveSession(stored.user, data.accessToken, data.refreshToken);
          } else {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: data.accessToken }));
            if (data.refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
            setToken(data.accessToken);
          }
        }

        return true;
      } catch {
        clearSession();
        return false;
      }
    })();

    refreshPromiseRef.current = promise;
    promise.finally(() => {
      refreshPromiseRef.current = null;
    });

    return promise;
  }, [clearSession, saveSession]);

  const validateSession = useCallback(async () => {
    try {
      const storedRaw = localStorage.getItem(STORAGE_KEY);
      if (!storedRaw) {
        setIsLoading(false);
        setReady(true);
        return;
      }

      const stored = JSON.parse(storedRaw) as { user?: AuthUser; token?: string };
      if (stored.user && stored.token) {
        setUser(stored.user);
        setToken(stored.token);
      }

      const { data, status } = await rawFetch<any>("/auth/me", { method: "GET" }, stored.token);

      if (status === 401) {
        const refreshed = await refreshSession();
        if (refreshed) {
          const { data: meData, status: meStatus } = await rawFetch<any>(
            "/auth/me",
            { method: "GET" },
            localStorage.getItem(STORAGE_KEY) ? JSON.parse(localStorage.getItem(STORAGE_KEY)!).token : null,
          );
          if (meStatus === 200 && meData) {
            saveSession(mapApiUser(meData), JSON.parse(localStorage.getItem(STORAGE_KEY)!).token);
          } else {
            clearSession();
          }
        } else {
          clearSession();
        }
      } else if (status === 200 && data) {
        saveSession(mapApiUser(data), stored.token || "");
      } else {
        clearSession();
      }
    } catch {
      clearSession();
    } finally {
      setIsLoading(false);
      setReady(true);
    }
  }, [clearSession, refreshSession, saveSession]);

  useEffect(() => {
    validateSession();
  }, [validateSession]);

  const login = useCallback(async (email: string, password: string) => {
    if (!email || !password) throw new Error("Email and password are required");

    const { data, status } = await rawFetch<{ user: any; accessToken: string; refreshToken: string }>(
      "/auth/login",
      { method: "POST", body: JSON.stringify({ email, password }) },
    );

    if (status !== 200 || !data) {
      const msg = (data as { message?: string })?.message || "Login failed";
      throw new Error(msg);
    }

    const authUser = mapApiUser(data.user);
    saveSession(authUser, data.accessToken, data.refreshToken);
  }, [saveSession]);

  const logout = useCallback(async () => {
    try {
      await rawFetch("/auth/logout", { method: "POST" }, token);
    } catch {
      // ignore network errors on logout
    }
    clearSession();
  }, [clearSession, token]);

  const refreshUser = useCallback(async () => {
    try {
      const { data, status } = await rawFetch<any>("/auth/me", { method: "GET" }, token);
      if (status === 200 && data) {
        const updatedUser = mapApiUser(data);
        const storedRaw = localStorage.getItem(STORAGE_KEY);
        if (storedRaw) {
          const stored = JSON.parse(storedRaw);
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...stored, user: updatedUser }));
        }
        setUser(updatedUser);
      }
    } catch {
    }
  }, [token]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      token,
      isAuthenticated: !!user,
      isReady,
      isLoading,
      login,
      logout,
      refreshSession,
      refreshUser,
      hasRole: (min) => roleAtLeast(user?.role, min),
      can: (resource, action = "read") => canCheck(user?.role, resource, action),
      canVisit: (path) => canVisitCheck(user?.role, path),
    }),
    [user, token, isReady, isLoading, login, logout, refreshSession, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

let currentAuth: AuthState | null = null;
let authReadyPromise: Promise<void> | null = null;
let resolveAuthReady: (() => void) | null = null;

export function _setRouterAuth(state: AuthState) {
  currentAuth = state;
  if (state.isReady && resolveAuthReady) {
    resolveAuthReady();
    resolveAuthReady = null;
    authReadyPromise = null;
  }
}
export function getRouterAuth(): AuthState | null {
  return currentAuth;
}

export function waitForAuthReady(timeoutMs = 10000): Promise<void> {
  if (currentAuth?.isReady) return Promise.resolve();
  if (!authReadyPromise) {
    authReadyPromise = new Promise<void>((resolve) => {
      resolveAuthReady = resolve;
      setTimeout(() => {
        if (resolveAuthReady) {
          resolveAuthReady = null;
          authReadyPromise = null;
          resolve();
        }
      }, timeoutMs);
    });
  }
  return authReadyPromise;
}
