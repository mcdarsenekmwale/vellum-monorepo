import { describe, it, expect } from "vitest";

/**
 * RED tests for pure support-ticket logic helpers.
 *
 * The list page + sheet currently use page-level state and mocks. We are
 * introducing:
 *   1. Normalization of API ticket shape → row shape (customer ↔ user fixup)
 *   2. Stat-card computation using dashboard summary (not page sample)
 *   3. Sort-column ↔ API orderBy mapping
 *   4. Sheet expandable section state toggling
 *
 * All tests intentionally fail initially because the utility modules do not
 * yet exist.
 */

describe("support-ticket logic (RED — awaiting implementation)", () => {
  describe("normalizeTicketRow: user → customer fixup + missing defaults", () => {
    it("maps ticket.user.name → customerName (shape used by sheet and rows)", async () => {
      const { normalizeTicketRow } = await import("./support-ticket.logic");
      const row = normalizeTicketRow({
        id: "t1",
        ticketNumber: "TKT-001",
        user: { name: "Alice", email: "a@x.com", handle: "alice", avatar: null },
        category: { id: "c1", name: "Billing" },
        updatedAt: "2025-08-15T10:00:00.000Z",
        createdAt: "2025-08-14T09:00:00.000Z",
      });
      expect(row.customerName).toBe("Alice");
      expect(row.customerEmail).toBe("a@x.com");
      expect(row.categoryName).toBe("Billing");
    });

    it("does not crash when user / category are missing (returns safe defaults)", async () => {
      const { normalizeTicketRow } = await import("./support-ticket.logic");
      const row = normalizeTicketRow({
        id: "t2",
        ticketNumber: "TKT-002",
        updatedAt: "2025-08-15T10:00:00.000Z",
        createdAt: "2025-08-14T09:00:00.000Z",
      });
      expect(row.customerName).toBe("Unknown");
      expect(row.customerEmail).toBe("—");
      expect(row.categoryName).toBe("—");
    });
  });

  describe("statsFromDashboard: uses backend dashboard summary, not page sample", () => {
    it("derives stat cards from dashboard.summary + avgResponseMs", async () => {
      const { statsFromDashboard } = await import("./support-ticket.logic");
      const summary = {
        openTickets: 40,
        unassigned: 12,
        inProgress: 8,
        escalated: 3,
        resolved: 150,
        closed: 210,
        onlineAgents: 5,
        avgResponseMs: 22 * 60 * 1000, // 22 minutes
        avgResolutionMs: 18 * 60 * 60 * 1000, // 18 hours
        newLast24h: 7,
        resolvedToday: 11,
      };
      const stats = statsFromDashboard(summary);
      expect(stats.totalTickets).toBe(40 + 150 + 210); // open+resolved+closed
      expect(stats.newLast24h).toBe(7);
      expect(stats.escalated).toBe(3);
      expect(stats.unassigned).toBe(12);
      expect(stats.resolvedToday).toBe(11);
      expect(stats.avgResponseMinutes).toBe(22);
      expect(stats.avgResolutionHours).toBe(18);
    });

    it("survives missing optional fields (fallback to 0)", async () => {
      const { statsFromDashboard } = await import("./support-ticket.logic");
      const stats = statsFromDashboard({
        openTickets: 1,
        unassigned: 0,
        inProgress: 0,
        escalated: 0,
        resolved: 0,
        closed: 0,
        onlineAgents: 0,
      });
      expect(stats.avgResponseMinutes).toBe(0);
      expect(stats.avgResolutionHours).toBe(0);
      expect(stats.newLast24h).toBe(0);
      expect(stats.resolvedToday).toBe(0);
    });
  });

  describe("sortMap: column id → { orderBy, orderDir } API params", () => {
    it("maps 'createdAt-desc' to { orderBy: 'createdAt', orderDir: 'desc' }", async () => {
      const { sortParamFor } = await import("./support-ticket.logic");
      expect(sortParamFor("createdAt-desc")).toEqual({ orderBy: "createdAt", orderDir: "desc" });
      expect(sortParamFor("updatedAt-asc")).toEqual({ orderBy: "updatedAt", orderDir: "asc" });
      expect(sortParamFor("priority-desc")).toEqual({ orderBy: "priority", orderDir: "desc" });
      expect(sortParamFor("status-asc")).toEqual({ orderBy: "status", orderDir: "asc" });
    });

    it("returns defaults for undefined / unknown sort key", async () => {
      const { sortParamFor } = await import("./support-ticket.logic");
      expect(sortParamFor(undefined)).toEqual({ orderBy: "createdAt", orderDir: "desc" });
      expect(sortParamFor("bogus")).toEqual({ orderBy: "createdAt", orderDir: "desc" });
    });
  });
});
