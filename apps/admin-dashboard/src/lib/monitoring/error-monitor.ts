"use client";

export type ErrorCategory =
  | "page_breakdown"
  | "navigation_failure"
  | "auth_failure"
  | "api_error"
  | "render_error"
  | "network_error"
  | "unknown";

export type ErrorSeverity = "critical" | "high" | "medium" | "low";

export type ErrorLogEntry = {
  id: string;
  timestamp: number;
  message: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  url?: string;
  stack?: string;
  componentStack?: string;
  boundary?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
  acknowledged: boolean;
};

const STORAGE_KEY = "vellbase.error_logs.v1";
const MAX_LOGS = 200;

let errorLogs: ErrorLogEntry[] = loadLogs();
const listeners = new Set<(logs: ErrorLogEntry[]) => void>();

function loadLogs(): ErrorLogEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ErrorLogEntry[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_LOGS) : [];
  } catch {
    return [];
  }
}

function saveLogs() {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(errorLogs.slice(0, MAX_LOGS)));
  } catch {
    // ignore storage errors
  }
}

function notify() {
  listeners.forEach((l) => l(errorLogs));
}

function categorizeError(error: Error | string, context?: Record<string, unknown>): { category: ErrorCategory; severity: ErrorSeverity } {
  const msg = typeof error === "string" ? error.toLowerCase() : error.message?.toLowerCase() || "";

  if (msg.includes("auth") || msg.includes("unauthorized") || msg.includes("401") || msg.includes("session") || context?.type === "auth") {
    return { category: "auth_failure", severity: "high" };
  }

  if (msg.includes("network") || msg.includes("failed to fetch") || msg.includes("cors") || context?.type === "network") {
    return { category: "network_error", severity: "high" };
  }

  if (msg.includes("navigation") || msg.includes("route") || msg.includes("redirect") || context?.type === "navigation") {
    return { category: "navigation_failure", severity: "medium" };
  }

  if (msg.includes("api") || context?.type === "api") {
    return { category: "api_error", severity: "medium" };
  }

  if (msg.includes("render") || msg.includes("hydrat") || context?.type === "render") {
    return { category: "render_error", severity: "critical" };
  }

  if (context?.boundary) {
    return { category: "page_breakdown", severity: "critical" };
  }

  return { category: "unknown", severity: "medium" };
}

export function logError(
  error: Error | string,
  context: {
    boundary?: string;
    type?: string;
    url?: string;
    componentStack?: string;
    userId?: string;
    metadata?: Record<string, unknown>;
  } = {},
): ErrorLogEntry {
  const { category, severity } = categorizeError(error, context);
  const entry: ErrorLogEntry = {
    id: crypto.randomUUID?.() ?? Math.random().toString(36).slice(2),
    timestamp: Date.now(),
    message: typeof error === "string" ? error : error.message,
    category,
    severity,
    url: context.url ?? (typeof window !== "undefined" ? window.location.href : undefined),
    stack: typeof error === "string" ? undefined : error.stack,
    componentStack: context.componentStack,
    boundary: context.boundary,
    userId: context.userId,
    metadata: context.metadata,
    acknowledged: false,
  };

  errorLogs.unshift(entry);
  if (errorLogs.length > MAX_LOGS) errorLogs = errorLogs.slice(0, MAX_LOGS);
  saveLogs();
  notify();

  if (severity === "critical" || severity === "high") {
    console.error(`[ErrorMonitor][${severity.toUpperCase()}][${category}]`, error);
  }

  return entry;
}

export function getErrorLogs(): ErrorLogEntry[] {
  return [...errorLogs];
}

export function getCriticalErrors(): ErrorLogEntry[] {
  return errorLogs.filter((e) => e.severity === "critical" && !e.acknowledged);
}

export function getErrorStats() {
  const total = errorLogs.length;
  const critical = errorLogs.filter((e) => e.severity === "critical").length;
  const high = errorLogs.filter((e) => e.severity === "high").length;
  const unacknowledged = errorLogs.filter((e) => !e.acknowledged).length;
  const byCategory: Record<string, number> = {};
  errorLogs.forEach((e) => {
    byCategory[e.category] = (byCategory[e.category] || 0) + 1;
  });
  return { total, critical, high, unacknowledged, byCategory };
}

export function acknowledgeError(id: string) {
  const entry = errorLogs.find((e) => e.id === id);
  if (entry) {
    entry.acknowledged = true;
    saveLogs();
    notify();
  }
}

export function clearErrorLogs() {
  errorLogs = [];
  saveLogs();
  notify();
}

export function subscribeToErrors(callback: (logs: ErrorLogEntry[]) => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function setupGlobalErrorHandlers() {
  if (typeof window === "undefined") return;

  window.addEventListener("error", (event) => {
    logError(event.error ?? new Error(event.message), {
      type: "render",
      url: window.location.href,
      metadata: { filename: event.filename, lineno: event.lineno, colno: event.colno },
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const err = reason instanceof Error ? reason : new Error(String(reason));
    logError(err, {
      type: "navigation",
      url: window.location.href,
      metadata: { reasonType: typeof reason },
    });
  });

  console.log("[ErrorMonitor] Global error handlers installed");
}
