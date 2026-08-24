/**
 * Pure logic helpers for the support/tickets module.
 *
 * These helpers are testable without React, and deliberately have zero
 * UI-layer dependencies. They are consumed by:
 *   - routes/_app.support.tickets.tsx (list page)
 *   - the SupportDetailSheet component (row normalization / dashboard stats)
 */

/* ─── Ticket row normalization ─────────────────────────────────────────────── */

export interface NormalizedTicketRow {
  id: string;
  ticketNumber: string;
  subject: string;
  message: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  customerName: string;
  customerEmail: string;
  customerAvatar?: string | null;
  customerHandle?: string | null;
  assigneeName?: string | null;
  assigneeEmail?: string | null;
  assigneeAvatar?: string | null;
  categoryName: string;
  categoryId?: string | null;
  /** Alias of assigneeId – used by the list filters */
  assigneeId?: string | null;
}

export function normalizeTicketRow(ticket: any): NormalizedTicketRow {
  const user = ticket?.user ?? ticket?.customer ?? {};
  const assignee = ticket?.assignee ?? null;
  const category = ticket?.category ?? null;

  return {
    id: ticket?.id,
    ticketNumber: ticket?.ticketNumber ?? "—",
    subject: ticket?.subject ?? "",
    message: ticket?.message ?? "",
    status: ticket?.status ?? "NEW",
    priority: ticket?.priority ?? "MEDIUM",
    createdAt: ticket?.createdAt,
    updatedAt: ticket?.updatedAt ?? ticket?.createdAt,
    customerName: user?.name ?? "Unknown",
    customerEmail: user?.email ?? "—",
    customerAvatar: user?.avatar ?? null,
    customerHandle: user?.handle ?? null,
    assigneeId: assignee?.id ?? ticket?.assigneeId ?? null,
    assigneeName: assignee?.name ?? null,
    assigneeEmail: assignee?.email ?? null,
    assigneeAvatar: assignee?.avatar ?? null,
    categoryId: category?.id ?? ticket?.categoryId ?? null,
    categoryName: category?.name ?? category?.key ?? "—",
  };
}

/* ─── Stat-card computation from backend dashboard summary ─────────────────── */

export interface SupportDashboardSummary {
  openTickets: number;
  unassigned: number;
  inProgress: number;
  escalated: number;
  resolved: number;
  closed: number;
  onlineAgents: number;
  avgResponseMs?: number;
  avgResolutionMs?: number;
  newLast24h?: number;
  resolvedToday?: number;
}

export interface SupportStatCards {
  totalTickets: number;
  newLast24h: number;
  escalated: number;
  unassigned: number;
  resolvedToday: number;
  avgResponseMinutes: number;
  avgResolutionHours: number;
  openTickets: number;
  inProgress: number;
  onlineAgents: number;
  resolved: number;
  closed: number;
}

export function statsFromDashboard(summary: SupportDashboardSummary | undefined | null): SupportStatCards {
  if (!summary) {
    return {
      totalTickets: 0,
      newLast24h: 0,
      escalated: 0,
      unassigned: 0,
      resolvedToday: 0,
      avgResponseMinutes: 0,
      avgResolutionHours: 0,
      openTickets: 0,
      inProgress: 0,
      onlineAgents: 0,
      resolved: 0,
      closed: 0,
    };
  }
  const MS_PER_MIN = 60_000;
  const MS_PER_HOUR = 60 * MS_PER_MIN;
  const minutes = (ms?: number) => (ms ? Math.round(ms / MS_PER_MIN) : 0);
  const hours = (ms?: number) => (ms ? Math.round((ms / MS_PER_HOUR) * 10) / 10 : 0);
  return {
    totalTickets: (summary.openTickets ?? 0) + (summary.resolved ?? 0) + (summary.closed ?? 0),
    newLast24h: summary.newLast24h ?? 0,
    escalated: summary.escalated ?? 0,
    unassigned: summary.unassigned ?? 0,
    resolvedToday: summary.resolvedToday ?? 0,
    avgResponseMinutes: minutes(summary.avgResponseMs),
    avgResolutionHours: hours(summary.avgResolutionMs),
    openTickets: summary.openTickets ?? 0,
    inProgress: summary.inProgress ?? 0,
    onlineAgents: summary.onlineAgents ?? 0,
    resolved: summary.resolved ?? 0,
    closed: summary.closed ?? 0,
  };
}

/* ─── Sort-column → API orderBy/orderDir mapping ───────────────────────────── */

export type SortKey =
  | "createdAt-desc"
  | "createdAt-asc"
  | "updatedAt-desc"
  | "updatedAt-asc"
  | "priority-desc"
  | "priority-asc"
  | "status-desc"
  | "status-asc";

/** Alias used by the route page import (keeps both names valid). */
export type SortParam = SortKey;

export function sortParamFor(
  key: string | undefined | null,
): { orderBy: "createdAt" | "updatedAt" | "priority" | "status"; orderDir: "asc" | "desc" } {
  if (!key) return { orderBy: "createdAt", orderDir: "desc" };
  switch (key) {
    case "createdAt-asc":
      return { orderBy: "createdAt", orderDir: "asc" };
    case "updatedAt-asc":
      return { orderBy: "updatedAt", orderDir: "asc" };
    case "updatedAt-desc":
      return { orderBy: "updatedAt", orderDir: "desc" };
    case "priority-asc":
      return { orderBy: "priority", orderDir: "asc" };
    case "priority-desc":
      return { orderBy: "priority", orderDir: "desc" };
    case "status-asc":
      return { orderBy: "status", orderDir: "asc" };
    case "status-desc":
      return { orderBy: "status", orderDir: "desc" };
    case "createdAt-desc":
    default:
      return { orderBy: "createdAt", orderDir: "desc" };
  }
}

/** Alias used by the route page (keeps both names valid). */
export const mapSortParamToApiOrderBy = sortParamFor;
