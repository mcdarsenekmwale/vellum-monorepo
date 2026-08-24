import { describe, it, expect } from "vitest";
import type { SupportAgent } from "@/lib/api/services";

/**
 * RED tests for pure agent-page helpers.
 *
 * Scenarios covered:
 *  1. Agent load calculation (active / max)
 *  2. Status normalization (ONLINE/BUSY/AWAY/OFFLINE or fallback to isActive)
 *  3. Role normalization (from backend Role enum → ROLE_CONFIG keys)
 *  4. CSV row formatting (escaping, missing fields)
 *  5. Agent filter helpers (status filter predicate, search by name/email/department)
 *  6. Dialog/sheet state open/close semantics (per-agent unique keys)
 */

const makeAgent = (overrides: Partial<SupportAgent> = {}): SupportAgent =>
  ({
    id: "a-1",
    userId: "u-1",
    status: "ONLINE",
    activeTickets: 3,
    maxTickets: 10,
    skills: ["API", "Billing"],
    isActive: true,
    vacationUntil: null,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-02T00:00:00.000Z",
    user: {
      id: "u-1",
      name: "Sarah Chen",
      email: "sarah.chen@vellum.com",
      avatar: null,
      handle: "sarahc",
      role: "MODERATOR",
    },
    department: { id: "d-1", name: "Technical Support" },
    team: { id: "tm-1", name: "Tier 2" },
    ticketsAssigned: 3,
    ticketsResolved: 15,
    escalations: 1,
    ...overrides,
  }) as SupportAgent;

describe("support-agents logic (RED)", () => {
  // ── 1. Agent load calculation ──────────────────────────────────────

  describe("agentLoadPct: active / max → percentage", () => {
    it("returns correct percentage for active=3, max=10", async () => {
      const { agentLoadPct } = await import("./support-agent.logic");
      expect(agentLoadPct(makeAgent())).toBe(30);
    });

    it("caps at 100 (when active > max due to race / bulk assign)", async () => {
      const { agentLoadPct } = await import("./support-agent.logic");
      expect(agentLoadPct(makeAgent({ activeTickets: 15, maxTickets: 10 }))).toBe(100);
    });

    it("returns 0 when max=0 (prevent divide-by-zero)", async () => {
      const { agentLoadPct } = await import("./support-agent.logic");
      expect(agentLoadPct(makeAgent({ maxTickets: 0 }))).toBe(0);
    });

    it("returns 0 when active=0 (new agent)", async () => {
      const { agentLoadPct } = await import("./support-agent.logic");
      expect(agentLoadPct(makeAgent({ activeTickets: 0 }))).toBe(0);
    });
  });

  // ── 2. Status normalization ────────────────────────────────────────

  describe("normalizeAgentStatus: maps backend status → STATUS_CONFIG key", () => {
    it("returns ONLINE, BUSY, AWAY, OFFLINE unchanged", async () => {
      const { normalizeAgentStatus } = await import("./support-agent.logic");
      expect(normalizeAgentStatus(makeAgent({ status: "ONLINE" }))).toBe("ONLINE");
      expect(normalizeAgentStatus(makeAgent({ status: "BUSY" }))).toBe("BUSY");
      expect(normalizeAgentStatus(makeAgent({ status: "AWAY" }))).toBe("AWAY");
      expect(normalizeAgentStatus(makeAgent({ status: "OFFLINE" }))).toBe("OFFLINE");
    });

    it("falls back ONLINE when isActive=true but status unknown", async () => {
      const { normalizeAgentStatus } = await import("./support-agent.logic");
      expect(
        normalizeAgentStatus(makeAgent({ status: "WEIRD_VALUE" as any, isActive: true })),
      ).toBe("ONLINE");
    });

    it("falls back OFFLINE when isActive=false even if status says ONLINE", async () => {
      const { normalizeAgentStatus } = await import("./support-agent.logic");
      expect(
        normalizeAgentStatus(makeAgent({ status: "ONLINE", isActive: false })),
      ).toBe("OFFLINE");
    });

    it("handles lowercase status gracefully", async () => {
      const { normalizeAgentStatus } = await import("./support-agent.logic");
      expect(
        normalizeAgentStatus(makeAgent({ status: "online" as any })),
      ).toBe("ONLINE");
    });
  });

  // ── 3. Role normalization ──────────────────────────────────────────

  describe("normalizeAgentRole: backend role string → ROLE_CONFIG key", () => {
    it("maps MODERATOR (SupportAgent) → MODERATOR", async () => {
      const { normalizeAgentRole } = await import("./support-agent.logic");
      expect(
        normalizeAgentRole(makeAgent({ user: { id: "u", name: "x", email: "e", avatar: null, role: "MODERATOR" } })),
      ).toBe("MODERATOR");
    });

    it("maps SUPPORT_ADMIN → SUPPORT_ADMIN", async () => {
      const { normalizeAgentRole } = await import("./support-agent.logic");
      expect(
        normalizeAgentRole(makeAgent({ user: { id: "u", name: "x", email: "e", avatar: null, role: "SUPPORT_ADMIN" } })),
      ).toBe("SUPPORT_ADMIN");
    });

    it("maps ADMIN → ADMIN (admins can also help with tickets)", async () => {
      const { normalizeAgentRole } = await import("./support-agent.logic");
      expect(
        normalizeAgentRole(makeAgent({ user: { id: "u", name: "x", email: "e", avatar: null, role: "ADMIN" } })),
      ).toBe("ADMIN");
    });

    it("falls back to MODERATOR for unknown/undefined role (default agent)", async () => {
      const { normalizeAgentRole } = await import("./support-agent.logic");
      expect(
        normalizeAgentRole(makeAgent({ user: { id: "u", name: "x", email: "e", avatar: null, role: undefined as any } })),
      ).toBe("MODERATOR");
      expect(
        normalizeAgentRole(makeAgent({ user: { id: "u", name: "x", email: "e", avatar: null, role: "GARBAGE" as any } })),
      ).toBe("MODERATOR");
    });
  });

  // ── 4. CSV row formatting & escaping ───────────────────────────────

  describe("agentToCsvRow + csvEscape", () => {
    it("escapes double-quotes inside a field", async () => {
      const { csvEscape } = await import("./support-agent.logic");
      expect(csvEscape('Joe "The King" Smith')).toBe('"Joe ""The King"" Smith"');
    });

    it("wraps commas in quotes", async () => {
      const { csvEscape } = await import("./support-agent.logic");
      expect(csvEscape("Billing, Payments")).toBe('"Billing, Payments"');
    });

    it("doesn't wrap simple alphanumeric", async () => {
      const { csvEscape } = await import("./support-agent.logic");
      expect(csvEscape("Sarah Chen")).toBe("Sarah Chen");
    });

    it("agentToCsvRow returns 10 ordered columns matching header (services.ts export spec)", async () => {
      const { agentToCsvRow } = await import("./support-agent.logic");
      const row = agentToCsvRow(makeAgent());
      expect(row).toHaveLength(10);
      expect(row[0]).toBe("Sarah Chen"); // Name
      expect(row[1]).toBe("sarah.chen@vellum.com"); // Email
      expect(row[2]).toBe("MODERATOR"); // Role
      expect(row[3]).toBe("ONLINE"); // Status
      expect(row[4]).toBe("Technical Support"); // Department
      expect(row[5]).toBe("API; Billing"); // Skills joined with "; "
      expect(row[6]).toBe("3"); // Active
      expect(row[7]).toBe("10"); // Max
      expect(row[8]).toBe("15"); // Resolved
      expect(row[9]).toBe("1"); // Escalations
    });

    it("agentToCsvRow handles missing department/user (safe '—' / empty fallback)", async () => {
      const { agentToCsvRow } = await import("./support-agent.logic");
      const a = makeAgent({
        department: null,
        skills: [],
        user: { id: "u", name: "X", email: "y", avatar: null, role: undefined as any },
        ticketsResolved: undefined,
        escalations: undefined,
      });
      const row = agentToCsvRow(a);
      expect(row[4]).toBe(""); // department null → ""
      expect(row[5]).toBe(""); // skills empty → ""
      expect(row[8]).toBe(""); // ticketsResolved undefined → ""
      expect(row[9]).toBe(""); // escalations undefined → ""
    });
  });

  // ── 5. Agent filter/search predicates ──────────────────────────────

  describe("agentMatches: search + status filter combined", () => {
    it("matches search by name substring (case insensitive)", async () => {
      const { agentMatches } = await import("./support-agent.logic");
      expect(agentMatches(makeAgent(), { search: "sarah" })).toBe(true);
      expect(agentMatches(makeAgent(), { search: "SARAH" })).toBe(true);
      expect(agentMatches(makeAgent(), { search: "mike" })).toBe(false);
    });

    it("matches search by email substring", async () => {
      const { agentMatches } = await import("./support-agent.logic");
      expect(agentMatches(makeAgent(), { search: "@vellum" })).toBe(true);
      expect(agentMatches(makeAgent(), { search: "@example.com" })).toBe(false);
    });

    it("matches search by department name", async () => {
      const { agentMatches } = await import("./support-agent.logic");
      expect(agentMatches(makeAgent(), { search: "Technical" })).toBe(true);
      // "Human Resources" is not in dept/team/name/email/skills
      expect(agentMatches(makeAgent(), { search: "Human Resources" })).toBe(false);
    });

    it("status=ALL matches any status", async () => {
      const { agentMatches } = await import("./support-agent.logic");
      expect(agentMatches(makeAgent(), { status: "ALL" })).toBe(true);
      expect(agentMatches(makeAgent({ status: "OFFLINE" }), { status: "ALL" })).toBe(true);
    });

    it("status=BUSY matches only BUSY (after normalize)", async () => {
      const { agentMatches } = await import("./support-agent.logic");
      expect(agentMatches(makeAgent({ status: "BUSY" }), { status: "BUSY" })).toBe(true);
      expect(agentMatches(makeAgent({ status: "ONLINE" }), { status: "BUSY" })).toBe(false);
    });

    it("search + status together require both", async () => {
      const { agentMatches } = await import("./support-agent.logic");
      expect(agentMatches(makeAgent({ status: "ONLINE" }), { search: "sarah", status: "ONLINE" })).toBe(true);
      expect(agentMatches(makeAgent({ status: "OFFLINE" }), { search: "sarah", status: "ONLINE" })).toBe(false);
    });
  });
});
