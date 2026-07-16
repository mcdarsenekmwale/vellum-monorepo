import { getRouterAuth } from "@/lib/auth/context";
import { logError } from "@/lib/monitoring/error-monitor";

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";
export const STUB_MODE = !API_BASE_URL;

export class ApiError extends Error {
  status: number;
  body?: unknown;
  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export type Query = Record<string, string | number | boolean | undefined | null>;

function buildUrl(path: string, query?: Query) {
  const base = API_BASE_URL.replace(/\/+$/, "");
  const url = new URL(`${base}${path.startsWith("/") ? path : `/${path}`}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === "") continue;
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  const auth = getRouterAuth();
  if (!auth) return false;
  if (refreshPromise) return refreshPromise;
  refreshPromise = auth.refreshSession().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

export async function api<T>(
  path: string,
  init: RequestInit & { query?: Query } = {},
): Promise<T> {
  if (STUB_MODE) {
    throw new ApiError("API base URL not configured (stub mode)", 0);
  }
  const { query, headers, ...rest } = init;
  const auth = getRouterAuth();
  const token = auth?.token;

  const doRequest = (useToken: string | null | undefined) =>
    fetch(buildUrl(path, query), {
      ...rest,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(useToken ? { Authorization: `Bearer ${useToken}` } : {}),
        ...headers,
      },
    });

  let res = await doRequest(token);

  if (res.status === 401 && auth?.isAuthenticated) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      const newAuth = getRouterAuth();
      res = await doRequest(newAuth?.token);
    }
  }

  const text = await res.text();
  const body = text ? safeJson(text) : undefined;
  if (!res.ok) {
    const error = new ApiError(
      (body as { message?: string })?.message ?? res.statusText,
      res.status,
      body,
    );

    logError(error, {
      type: res.status === 401 || res.status === 403 ? "auth" : "api",
      url: path,
      metadata: { status: res.status, method: init.method ?? "GET" },
    });

    if (res.status === 401) {
      auth?.logout();
    }
    throw error;
  }
  return body as T;
}

function safeJson(t: string): unknown {
  try {
    return JSON.parse(t);
  } catch {
    return t;
  }
}

export type Paginated<T> = {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
};
