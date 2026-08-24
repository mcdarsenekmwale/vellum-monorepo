import { describe, it, expect } from "vitest";

/**
 * RED tests for the sheet + assignment logic module.
 *
 * Tests three areas that currently do NOT exist:
 *  1. Support sheet view state (which ticket is open, expanded/collapsed details)
 *  2. Role-based assignment visibility — who can assign to whom
 *  3. Agent picker filter/search — given a list of agents, return those matching
 *     the current user's role + optional search string
 */

describe("support-sheet-assignment logic (RED)", () => {
  describe("sheet state helpers", () => {
    it("toggleExpand flips expanded flag when called with same ticketId", async () => {
      const { sheetReducer, initSheetState } = await import("./support-sheet-assignment.logic");
      let state = initSheetState();
      state = sheetReducer(state, { type: "OPEN_TICKET", ticketId: "t1" });
      expect(state.openTicketId).toBe("t1");
      expect(state.isExpanded).toBe(false);
      state = sheetReducer(state, { type: "TOGGLE_EXPAND" });
      expect(state.isExpanded).toBe(true);
      state = sheetReducer(state, { type: "TOGGLE_EXPAND" });
      expect(state.isExpanded).toBe(false);
    });

    it("CLOSE_TICKET resets openTicketId + collapses details", async () => {
      const { sheetReducer, initSheetState } = await import("./support-sheet-assignment.logic");
      let state = initSheetState();
      state = sheetReducer(state, { type: "OPEN_TICKET", ticketId: "t99" });
      state = sheetReducer(state, { type: "TOGGLE_EXPAND" });
      state = sheetReducer(state, { type: "CLOSE_TICKET" });
      expect(state.openTicketId).toBeNull();
      expect(state.isExpanded).toBe(false);
    });

    it("OPEN_TICKET always collapses details initially (avoid carry-over)", async () => {
      const { sheetReducer, initSheetState } = await import("./support-sheet-assignment.logic");
      let state = initSheetState();
      state = sheetReducer(state, { type: "OPEN_TICKET", ticketId: "t1" });
      state = sheetReducer(state, { type: "TOGGLE_EXPAND" });
      // switch to different ticket
      state = sheetReducer(state, { type: "OPEN_TICKET", ticketId: "t2" });
      expect(state.openTicketId).toBe("t2");
      expect(state.isExpanded).toBe(false);
    });
  });

  describe("role-based assignment permissions", () => {
    it("SUPER_ADMIN / ADMIN / SUPPORT_ADMIN can assign to anyone", async () => {
      const { canAssignTo } = await import("./support-sheet-assignment.logic");
      for (const role of ["SuperAdmin", "Admin", "SupportAdmin"] as const) {
        expect(canAssignTo({ actorRole: role, targetRole: "SupportAgent" })).toBe(true);
        expect(canAssignTo({ actorRole: role, targetRole: "SupportAdmin" })).toBe(true);
        expect(canAssignTo({ actorRole: role, targetRole: "Admin" })).toBe(true);
      }
    });

    it("SupportAgent can assign to other SupportAgents and self, but NOT to admins", async () => {
      const { canAssignTo } = await import("./support-sheet-assignment.logic");
      expect(canAssignTo({ actorRole: "SupportAgent", targetRole: "SupportAgent" })).toBe(true);
      expect(canAssignTo({ actorRole: "SupportAgent", targetRole: "Moderator" })).toBe(false);
      expect(canAssignTo({ actorRole: "SupportAgent", targetRole: "SupportAdmin" })).toBe(false);
      expect(canAssignTo({ actorRole: "SupportAgent", targetRole: "Admin" })).toBe(false);
    });

    it("Moderator / User / Guest CANNOT assign at all", async () => {
      const { canAssignTo } = await import("./support-sheet-assignment.logic");
      expect(canAssignTo({ actorRole: "Moderator", targetRole: "SupportAgent" })).toBe(false);
      expect(canAssignTo({ actorRole: "User", targetRole: "SupportAgent" })).toBe(false);
      expect(canAssignTo({ actorRole: "Guest", targetRole: "SupportAgent" })).toBe(false);
    });
  });

  describe("agent picker filter/search", () => {
    type Agent = { userId: string; user: { name: string; email: string }; role: string; skills?: string[] };

    const agents: Agent[] = [
      { userId: "a1", user: { name: "Sarah Chen", email: "sarah@vellum.app" }, role: "SupportAgent", skills: ["billing"] },
      { userId: "a2", user: { name: "Mike Johnson", email: "mike@vellum.app" }, role: "SupportAgent", skills: ["technical"] },
      { userId: "a3", user: { name: "Emma Admin", email: "emma@vellum.app" }, role: "SupportAdmin" },
      { userId: "a4", user: { name: "Raj Patel", email: "raj@vellum.app" }, role: "Admin" },
    ];

    it("as a SupportAgent → only other SupportAgents visible", async () => {
      const { filterAssignableAgents } = await import("./support-sheet-assignment.logic");
      const visible = filterAssignableAgents({
        agents,
        actorRole: "SupportAgent",
      });
      expect(visible.map((a) => a.userId).sort()).toEqual(["a1", "a2"]);
    });

    it("as an Admin → all 4 agents (SupportAgent + SupportAdmin + Admin) visible", async () => {
      const { filterAssignableAgents } = await import("./support-sheet-assignment.logic");
      const visible = filterAssignableAgents({ agents, actorRole: "Admin" });
      expect(visible.map((a) => a.userId).sort()).toEqual(["a1", "a2", "a3", "a4"]);
    });

    it("search filters by name or email substring (case-insensitive)", async () => {
      const { filterAssignableAgents } = await import("./support-sheet-assignment.logic");
      let visible = filterAssignableAgents({
        agents,
        actorRole: "Admin",
        search: "sarah",
      });
      expect(visible.map((a) => a.userId)).toEqual(["a1"]);

      visible = filterAssignableAgents({
        agents,
        actorRole: "Admin",
        search: "@vellum",
      });
      expect(visible.length).toBe(4);

      visible = filterAssignableAgents({
        agents,
        actorRole: "Admin",
        search: "MIKE",
      });
      expect(visible.map((a) => a.userId)).toEqual(["a2"]);
    });

    it("search respects role visibility (e.g. SupportAgent search 'emma' returns empty)", async () => {
      const { filterAssignableAgents } = await import("./support-sheet-assignment.logic");
      const visible = filterAssignableAgents({
        agents,
        actorRole: "SupportAgent",
        search: "emma",
      });
      expect(visible.length).toBe(0);
    });
  });

  /* ── RED: Backend role format compatibility (UPPER_SNAKE_CASE ↔ PascalCase) ── */
  describe("backend role format (UPPER_SNAKE_CASE from Prisma enum)", () => {
    it("ADMIN (backend upper-snake) can assign ticket", async () => {
      const { canAssignTo } = await import("./support-sheet-assignment.logic");
      expect(canAssignTo({ actorRole: "ADMIN", targetRole: "SupportAgent" })).toBe(true);
    });

    it("SUPPORT_ADMIN (backend upper-snake) can assign ticket", async () => {
      const { canAssignTo } = await import("./support-sheet-assignment.logic");
      expect(canAssignTo({ actorRole: "SUPPORT_ADMIN", targetRole: "SupportAgent" })).toBe(true);
    });

    it("SUPER_ADMIN (backend upper-snake) can assign ticket", async () => {
      const { canAssignTo } = await import("./support-sheet-assignment.logic");
      expect(canAssignTo({ actorRole: "SUPER_ADMIN", targetRole: "SupportAgent" })).toBe(true);
    });

    it("SUPPORT_AGENT (backend upper-snake) can assign to SupportAgent targets", async () => {
      const { canAssignTo } = await import("./support-sheet-assignment.logic");
      expect(canAssignTo({ actorRole: "SUPPORT_AGENT", targetRole: "SupportAgent" })).toBe(true);
    });

    it("USER (backend upper-snake) CANNOT assign ticket", async () => {
      const { canAssignTo } = await import("./support-sheet-assignment.logic");
      expect(canAssignTo({ actorRole: "USER", targetRole: "SupportAgent" })).toBe(false);
    });

    it("MODERATOR (backend upper-snake) CANNOT assign ticket", async () => {
      const { canAssignTo } = await import("./support-sheet-assignment.logic");
      expect(canAssignTo({ actorRole: "MODERATOR", targetRole: "SupportAgent" })).toBe(false);
    });
  });
});
