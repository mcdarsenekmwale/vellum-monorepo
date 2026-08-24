/**
 * Pure helper utilities for the Support Agents management page.
 *
 * All functions are side-effect free to simplify unit testing. They are used
 * both by the agents route component and any quick-view/detail sheets.
 */
import type { SupportAgent } from "@/lib/api/services";

// ── STATUS + ROLE configs (kept in sync with agents route) ─────────

const VALID_STATUSES = ["ONLINE", "BUSY", "AWAY", "OFFLINE"] as const;
type AgentStatusKey = (typeof VALID_STATUSES)[number];

const VALID_ROLES = ["SUPPORT_ADMIN", "MODERATOR", "ADMIN"] as const;
type AgentRoleKey = (typeof VALID_ROLES)[number];

// ── 1. Agent load % ─────────────────────────────────────────────────

/**
 * Compute agent workload percentage. Caps at 100, floors at 0.
 * Never throws (returns 0 on divide-by-zero).
 */
export function agentLoadPct(agent: Pick<SupportAgent, "activeTickets" | "maxTickets">): number {
  const active = Number(agent.activeTickets) || 0;
  const max = Number(agent.maxTickets) || 0;
  if (max <= 0 || active <= 0) return 0;
  return Math.min(100, Math.round((active / max) * 100));
}

// ── 2. Status normalization ─────────────────────────────────────────

/**
 * Normalize backend `status` + `isActive` to one of four canonical presence
 * buckets used by UI badges. If a status exists but isActive is false, the
 * agent is effectively offline (deactivated).
 */
export function normalizeAgentStatus(agent: Pick<SupportAgent, "status" | "isActive">): AgentStatusKey {
  // Deactivated → OFFLINE regardless of status field
  if (!agent.isActive) return "OFFLINE";

  const s = String(agent.status || "").toUpperCase();
  if ((VALID_STATUSES as readonly string[]).includes(s)) {
    return s as AgentStatusKey;
  }
  // Fallback based on isActive flag (already true above → ONLINE)
  return "ONLINE";
}

// ── 3. Role normalization ───────────────────────────────────────────

/**
 * Normalize backend user role to the 3-level display hierarchy used on the
 * support-agents page. Falls back to MODERATOR for unknowns.
 */
export function normalizeAgentRole(agent: Pick<SupportAgent, "user">): AgentRoleKey {
  const r = String(agent.user?.role || "").toUpperCase();
  if ((VALID_ROLES as readonly string[]).includes(r)) {
    return r as AgentRoleKey;
  }
  // Default — SupportAgent level
  return "MODERATOR";
}

// ── 4. CSV helpers ──────────────────────────────────────────────────

/**
 * Apply RFC 4180-compatible CSV escaping:
 *  - If string contains `"`, `,`, CR or LF → wrap in double-quotes with
 *    internal `"` doubled.
 *  - Otherwise return as-is.
 */
export function csvEscape(value: unknown): string {
  const s = value == null ? "" : String(value);
  const needsQuote = /[",\r\n]/.test(s);
  if (!needsQuote) return s;
  return `"${s.replace(/"/g, '""')}"`;
}

/**
 * Column order for a single CSV row — mirrors the 10-column header defined
 * in services.ts / agents page export handler:
 *   [Name, Email, Role, Status, Department, Skills, ActiveTickets,
 *    MaxTickets, Resolved, Escalations]
 */
export function agentToCsvRow(a: SupportAgent): string[] {
  return [
    a.user?.name ?? "",
    a.user?.email ?? "",
    a.user?.role ?? "",
    String(a.status ?? ""),
    a.department?.name ?? "",
    (a.skills ?? []).join("; "),
    a.activeTickets != null ? String(a.activeTickets) : "",
    a.maxTickets != null ? String(a.maxTickets) : "",
    a.ticketsResolved != null ? String(a.ticketsResolved) : "",
    a.escalations != null ? String(a.escalations) : "",
  ];
}

// ── 5. Filter / search predicates ───────────────────────────────────

export interface AgentFilterParams {
  search?: string;
  status?: "ALL" | AgentStatusKey | string;
}

/**
 * Pure predicate for local client-side filtering of agent rows.
 *
 * The backend already provides pagination + search, but this helper is also
 * used for optimistic UI checks (e.g. "does the newly-created agent match
 * the current filters so it should appear immediately?") and for tests.
 */
export function agentMatches(agent: SupportAgent, params: AgentFilterParams): boolean {
  // Status filter
  const statusFilter = (params.status ?? "ALL").toUpperCase();
  if (statusFilter !== "ALL") {
    const canonical = normalizeAgentStatus({ status: agent.status, isActive: agent.isActive });
    if (canonical !== statusFilter) return false;
  }

  // Search (name, email, department, skills OR — case-insensitive)
  const s = (params.search ?? "").trim().toLowerCase();
  if (s) {
    const haystacks = [
      agent.user?.name ?? "",
      agent.user?.email ?? "",
      agent.user?.handle ?? "",
      agent.department?.name ?? "",
      agent.team?.name ?? "",
      ...(agent.skills ?? []),
    ];
    const anyHit = haystacks.some((h) => h.toLowerCase().includes(s));
    if (!anyHit) return false;
  }

  return true;
}
