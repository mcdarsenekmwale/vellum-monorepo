import { describe, it, expect } from "vitest";

/**
 * RED tests for support organization analytics utilities:
 *   1. KPI formatting: pct, seconds → human, csat stars
 *   2. Department scorecard health-grade + ranking
 *   3. Route form validation: requires at least one of {dept, team, agent}
 *   4. Team/department filter URL builder preserving search params
 */

describe("support-org-analytics utils (RED)", () => {
  describe("formatPercent: robust pct formatter", () => {
    it("formats numeric fractions 0..1 → '95.0%'", async () => {
      const { formatPercent } = await import("./support-org-analytics.logic");
      expect(formatPercent(0.95)).toBe("95.0%");
      expect(formatPercent(1)).toBe("100.0%");
      expect(formatPercent(0)).toBe("0.0%");
    });

    it("handles null/undefined → '—'", async () => {
      const { formatPercent } = await import("./support-org-analytics.logic");
      expect(formatPercent(null)).toBe("—");
      expect(formatPercent(undefined)).toBe("—");
      expect(formatPercent(NaN)).toBe("—");
    });

    it("caps display for values > 1 when passed as percent", async () => {
      const { formatPercent } = await import("./support-org-analytics.logic");
      expect(formatPercent(125)).toBe("125.0%");
    });
  });

  describe("formatDurationMs: converts ms to friendly durations", () => {
    it("shows seconds for under-a-minute durations", async () => {
      const { formatDurationMs } = await import("./support-org-analytics.logic");
      expect(formatDurationMs(45_000)).toBe("45s");
    });
    it("shows m:ss for under-an-hour", async () => {
      const { formatDurationMs } = await import("./support-org-analytics.logic");
      expect(formatDurationMs(5 * 60_000 + 23_000)).toBe("5:23");
    });
    it("shows h:mm for multi-hour", async () => {
      const { formatDurationMs } = await import("./support-org-analytics.logic");
      expect(formatDurationMs(2 * 3600_000 + 12 * 60_000)).toBe("2:12h");
    });
    it("shows days for multi-day", async () => {
      const { formatDurationMs } = await import("./support-org-analytics.logic");
      expect(formatDurationMs(3 * 86_400_000 + 2 * 3600_000)).toBe("3d 2h");
    });
    it("safe for invalid", async () => {
      const { formatDurationMs } = await import("./support-org-analytics.logic");
      expect(formatDurationMs(null)).toBe("—");
      expect(formatDurationMs(undefined)).toBe("—");
    });
  });

  describe("csatGrade: numeric score 1-5 → stars + grade label", () => {
    it("returns star count and letter", async () => {
      const { csatGrade } = await import("./support-org-analytics.logic");
      expect(csatGrade(4.7)).toMatchObject({ stars: 5, label: "Excellent" });
      expect(csatGrade(4.2)).toMatchObject({ stars: 4, label: "Good" });
      expect(csatGrade(3.2)).toMatchObject({ stars: 3, label: "Average" });
      expect(csatGrade(2.2)).toMatchObject({ stars: 2, label: "Poor" });
      expect(csatGrade(0.8)).toMatchObject({ stars: 1, label: "Bad" });
    });
    it("null/undefined → 0 stars and label 'N/A'", async () => {
      const { csatGrade } = await import("./support-org-analytics.logic");
      expect(csatGrade(null)).toMatchObject({ stars: 0, label: "N/A" });
    });
  });

  describe("healthGrade: composite score 0..100 → A/B/C/D/E/F", () => {
    it("correctly buckets by 10-point thresholds", async () => {
      const { healthGrade } = await import("./support-org-analytics.logic");
      expect(healthGrade(92)).toBe("A");
      expect(healthGrade(89)).toBe("B");
      expect(healthGrade(79)).toBe("C");
      expect(healthGrade(69)).toBe("D");
      expect(healthGrade(59)).toBe("E");
      expect(healthGrade(42)).toBe("F");
    });
    it("edge cases (>=90 is A, <50 is F)", async () => {
      const { healthGrade } = await import("./support-org-analytics.logic");
      expect(healthGrade(90)).toBe("A");
      expect(healthGrade(50)).toBe("E");
      expect(healthGrade(49.9)).toBe("F");
      expect(healthGrade(0)).toBe("F");
      expect(healthGrade(100)).toBe("A");
    });
  });

  describe("rankDepartmentScorecard: sorts descending by composite score", () => {
    it("sorts descending and adds 1-based rank", async () => {
      const { rankDepartmentScorecard } = await import("./support-org-analytics.logic");
      const input = [
        { id: "d1", name: "Billing", compositeScore: 78 },
        { id: "d2", name: "Tech", compositeScore: 92 },
        { id: "d3", name: "General", compositeScore: 66 },
      ];
      const ranked = rankDepartmentScorecard(input as any[]);
      expect(ranked.map((r) => ({ rank: r.rank, id: r.id }))).toEqual([
        { rank: 1, id: "d2" },
        { rank: 2, id: "d1" },
        { rank: 3, id: "d3" },
      ]);
    });
    it("handles ties with same rank (dense)", async () => {
      const { rankDepartmentScorecard } = await import("./support-org-analytics.logic");
      const input = [
        { id: "d1", name: "A", compositeScore: 90 },
        { id: "d2", name: "B", compositeScore: 90 },
        { id: "d3", name: "C", compositeScore: 80 },
      ];
      const ranked = rankDepartmentScorecard(input as any[]);
      expect(ranked[0].rank).toBe(1);
      expect(ranked[1].rank).toBe(1);
      expect(ranked[2].rank).toBe(2);
    });
    it("empty list returns empty", async () => {
      const { rankDepartmentScorecard } = await import("./support-org-analytics.logic");
      expect(rankDepartmentScorecard([])).toEqual([]);
    });
  });
});

describe("support-org-routing utils (RED)", () => {
  describe("validateRouteRequest: needs at least one of dept/team/agent", () => {
    it("rejects all-empty routing", async () => {
      const { validateRouteRequest } = await import("./support-org-routing.logic");
      const r = validateRouteRequest({});
      expect(r.valid).toBe(false);
      if (!r.valid) expect(r.error).toMatch(/at least one/i);
    });
    it("accepts any single non-empty field", async () => {
      const { validateRouteRequest } = await import("./support-org-routing.logic");
      expect(validateRouteRequest({ departmentId: "d1" }).valid).toBe(true);
      expect(validateRouteRequest({ teamId: "t1" }).valid).toBe(true);
      expect(validateRouteRequest({ agentId: "a1" }).valid).toBe(true);
    });
    it("rejects empty strings as absent", async () => {
      const { validateRouteRequest } = await import("./support-org-routing.logic");
      const r = validateRouteRequest({ departmentId: "", teamId: "", agentId: "" });
      expect(r.valid).toBe(false);
    });
    it("warns when team is outside selected dept", async () => {
      const { validateRouteRequest } = await import("./support-org-routing.logic");
      const r = validateRouteRequest(
        { departmentId: "d1", teamId: "t2" },
        [{ id: "t1", departmentId: "d1" }, { id: "t2", departmentId: "d2" }] as any[],
      );
      expect(r.valid).toBe(false);
      if (!r.valid) expect(r.error).toMatch(/team .* does not belong/i);
    });
  });

  describe("buildTicketsReportUrl: builds CSV download URL with ordered search params", () => {
    it("includes only truthy params and prefixes support base", async () => {
      const { buildTicketsReportUrl } = await import("./support-org-routing.logic");
      const url = buildTicketsReportUrl({
        departmentId: "d1",
        teamId: "",
        agentId: "a1",
        status: "OPEN",
        priority: undefined,
        limit: 500,
      });
      expect(url.startsWith("/support/reports/export/csv?")).toBe(true);
      expect(url).toContain("departmentId=d1");
      expect(url).toContain("agentId=a1");
      expect(url).toContain("status=OPEN");
      expect(url).toContain("limit=500");
      expect(url).not.toContain("teamId=");
      expect(url).not.toContain("priority=");
    });
  });

  describe("workloadPct: activeTickets/maxTickets safe percentage", () => {
    it("returns 0..1 ratio with safe division", async () => {
      const { workloadPct } = await import("./support-org-routing.logic");
      expect(workloadPct(5, 10)).toBe(0.5);
      expect(workloadPct(0, 10)).toBe(0);
      expect(workloadPct(10, 10)).toBe(1);
      expect(workloadPct(12, 10)).toBe(1.2);
    });
    it("maxTickets 0/NaN/null → 0", async () => {
      const { workloadPct } = await import("./support-org-routing.logic");
      expect(workloadPct(5, 0)).toBe(0);
      expect(workloadPct(5, null as any)).toBe(0);
      expect(workloadPct(5, NaN)).toBe(0);
    });
  });
});
