import { Test } from "@nestjs/testing";
import { SupportService } from "./support.service";
import { PrismaService } from "../../shared/prisma/prisma.service";
import { BadRequestException } from "@nestjs/common";

// Jest/Vitest compatibility shim
declare const jest: any;
declare const describe: any;
declare const it: any;
declare const expect: any;
declare const beforeEach: any;
const vi: any = {
  fn: (...args: any[]) => {
    if (typeof jest !== "undefined" && typeof jest.fn === "function") return jest.fn(...args);
    return (globalThis as any).vi.fn(...args);
  },
};

/** Build a minimal Prisma mock shaped like the analytics calls expect. */
function buildMock(overrides: Record<string, any> = {}): any {
  const mock: any = {
    $transaction: async (fn: (tx: any) => Promise<any>) => fn(mock),
    supportTicket: {
      count: vi.fn(async () => 0),
      groupBy: vi.fn(async () => [] as any[]),
      aggregate: vi.fn(async () => ({ _avg: { satisfaction: null }, _count: { _all: 0 } }) as any),
      findMany: vi.fn(async () => [] as any[]),
    },
    supportAgent: {
      count: vi.fn(async () => 0),
      groupBy: vi.fn(async () => [] as any[]),
      findMany: vi.fn(async () => [] as any[]),
    },
    supportAgentTeamMembership: {
      count: vi.fn(async () => 0),
    },
    ticketAssignment: {
      count: vi.fn(async () => 0),
      groupBy: vi.fn(async () => [] as any[]),
    },
  };
  for (const k of Object.keys(overrides)) {
    if (typeof overrides[k] === "object" && !Array.isArray(overrides[k])) {
      mock[k] = { ...(mock[k] ?? {}), ...overrides[k] };
    } else {
      mock[k] = overrides[k];
    }
  }
  return mock;
}

describe("Phase 2 RED — Department Metrics (getDepartmentMetrics)", () => {
  let service: SupportService;
  let prisma: any;

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        SupportService,
        { provide: PrismaService, useValue: buildMock() },
      ],
    }).compile();
    service = mod.get<SupportService>(SupportService);
    prisma = mod.get<PrismaService>(PrismaService) as any;
  });

  it("requires a valid non-empty departmentId", async () => {
    await expect((service as any).getDepartmentMetrics(" ")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("returns dept-level ticket status + priority counts by calling supportTicket.groupBy twice", async () => {
    prisma.supportTicket.groupBy = vi.fn()
      .mockResolvedValueOnce([
        { status: "OPEN", _count: { _all: 3 } },
        { status: "IN_PROGRESS", _count: { _all: 2 } },
        { status: "RESOLVED", _count: { _all: 7 } },
      ])
      .mockResolvedValueOnce([
        { priority: "HIGH", _count: { _all: 2 } },
        { priority: "MEDIUM", _count: { _all: 5 } },
        { priority: "LOW", _count: { _all: 1 } },
      ]);
    prisma.supportTicket.aggregate = vi.fn().mockResolvedValue({ _avg: { satisfaction: 4.5 }, _count: { _all: 12 } });
    prisma.supportTicket.count = vi.fn()
      .mockResolvedValueOnce(12) // total
      .mockResolvedValueOnce(3)  // new24h
      .mockResolvedValueOnce(8)  // new7d
      .mockResolvedValueOnce(22) // new30d
      .mockResolvedValueOnce(3)  // backlog (non-terminal)
      .mockResolvedValueOnce(1); // escalated
    prisma.supportAgent.count = vi.fn()
      .mockResolvedValueOnce(5) // agents in dept
      .mockResolvedValueOnce(4); // active agents
    prisma.supportAgentTeamMembership.count = vi.fn().mockResolvedValue(7);
    prisma.ticketAssignment.count = vi.fn().mockResolvedValue(20);

    const m = await (service as any).getDepartmentMetrics("dept-1");
    expect(m.id).toBe("dept-1");
    expect(m.tickets.total).toBe(12);
    expect(m.tickets.new24h).toBe(3);
    expect(m.tickets.new7d).toBe(8);
    expect(m.tickets.new30d).toBe(22);
    expect(m.tickets.backlog).toBe(3);
    expect(m.tickets.escalated).toBe(1);
    expect(m.statusBreakdown).toEqual({ OPEN: 3, IN_PROGRESS: 2, RESOLVED: 7 });
    expect(m.priorityBreakdown).toEqual({ HIGH: 2, MEDIUM: 5, LOW: 1 });
    expect(m.satisfaction.avg).toBe(4.5);
    expect(m.satisfaction.count).toBe(12);
    expect(m.agents.total).toBe(5);
    expect(m.agents.active).toBe(4);
    expect(m.agents.assignedTickets).toBe(20);
    expect(m.memberships.active).toBe(7);

    // status groupBy filters by departmentId
    const statusWhere = prisma.supportTicket.groupBy.mock.calls[0][0].where;
    expect(statusWhere.departmentId).toBe("dept-1");
    expect(statusWhere.deletedAt).toBeNull();
  });
});

describe("Phase 2 RED — Team Metrics (getTeamMetrics)", () => {
  let service: SupportService;
  let prisma: any;

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        SupportService,
        { provide: PrismaService, useValue: buildMock() },
      ],
    }).compile();
    service = mod.get<SupportService>(SupportService);
    prisma = mod.get<PrismaService>(PrismaService) as any;
  });

  it("requires a valid non-empty teamId", async () => {
    await expect((service as any).getTeamMetrics("")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("returns per-agent metrics list via membership + assignments aggregation", async () => {
    // agents in team
    prisma.supportAgentTeamMembership.count = vi.fn().mockResolvedValueOnce(3);
    prisma.supportTicket.count = vi.fn()
      .mockResolvedValueOnce(15) // total
      .mockResolvedValueOnce(4)  // open
      .mockResolvedValueOnce(11) // resolved
      .mockResolvedValueOnce(1); // escalated
    prisma.supportTicket.groupBy = vi.fn()
      .mockResolvedValueOnce([{ status: "OPEN", _count: { _all: 4 } }])   // status
      .mockResolvedValueOnce([{ priority: "MEDIUM", _count: { _all: 10 } }]); // priority
    prisma.supportTicket.aggregate = vi.fn().mockResolvedValue({ _avg: { satisfaction: 4.2 }, _count: { _all: 10 } });
    // Per-agent: ticketAssignment.groupBy assigneeId counts (agentId == User.id)
    prisma.ticketAssignment.groupBy = vi.fn().mockResolvedValue([
      { agentId: "user-a1", _count: { _all: 5 } },
      { agentId: "user-a2", _count: { _all: 3 } },
    ]);
    prisma.supportAgent.findMany = vi.fn().mockResolvedValue([
      { id: "a1", userId: "user-a1", status: "ONLINE", maxTickets: 10 },
      { id: "a2", userId: "user-a2", status: "BUSY", maxTickets: 8 },
      { id: "a3", userId: "user-a3", status: "OFFLINE", maxTickets: 10 },
    ]);

    const m = await (service as any).getTeamMetrics("team-42");
    expect(m.id).toBe("team-42");
    expect(m.tickets.total).toBe(15);
    expect(m.tickets.open).toBe(4);
    expect(m.tickets.resolved).toBe(11);
    expect(m.tickets.escalated).toBe(1);
    expect(m.satisfaction.avg).toBe(4.2);
    expect(m.capacity.utilizationPct).toBeGreaterThan(0);
    expect(Array.isArray(m.agents)).toBe(true);
    expect(m.agents.length).toBe(3);
    const a1 = m.agents.find((a: any) => a.id === "a1");
    expect(a1.assignedCount).toBe(5);
    expect(a1.capacityPct).toBe(50);
  });
});

describe("Phase 3 RED — KPI Dashboard (getTeamKpis + getComparativeDepartmentScorecard)", () => {
  let service: SupportService;
  let prisma: any;

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        SupportService,
        { provide: PrismaService, useValue: buildMock() },
      ],
    }).compile();
    service = mod.get<SupportService>(SupportService);
    prisma = mod.get<PrismaService>(PrismaService) as any;
    prisma.supportDepartment = prisma.supportDepartment ?? {};
  });

  it("getTeamKpis returns at least 15 distinct KPI fields", async () => {
    prisma.supportTicket = {
      count: vi.fn()
        .mockResolvedValueOnce(100)  // [0] totalTickets
        .mockResolvedValueOnce(22)   // [1] backlog
        .mockResolvedValueOnce(78)   // [2] resolved (terminal)
        .mockResolvedValueOnce(2)    // [3] breachRes (resolution)
        .mockResolvedValueOnce(78)   // [4] withinRes (resolution met)
        .mockResolvedValueOnce(3)    // [5] breachResp (response)
        .mockResolvedValueOnce(80)   // [6] withinResp (response met)
        .mockResolvedValueOnce(6)    // [7] reopened
        .mockResolvedValueOnce(85)   // [8] fcr (first contact resolution count)
        .mockResolvedValueOnce(5),   // [9] escalated
      aggregate: vi.fn().mockResolvedValue({
        _avg: { satisfaction: 4.7, interactionsCount: 2.3 },
        _count: { _all: 90 },
      } as any),
      groupBy: vi.fn().mockResolvedValue([] as any[]),
      findMany: vi.fn().mockResolvedValue([] as any[]),
    };

    const k = await (service as any).getTeamKpis("team-1");
    const keys = Object.keys(k);
    expect(keys.length).toBeGreaterThanOrEqual(15);
    expect(k.totalTickets).toBe(100);
    expect(k.backlog).toBe(22);
    expect(k.slaResolutionAdherencePct).toBeCloseTo(
      (78 / (78 + 2)) * 100, 0,
    );
    expect(k.slaResponseAdherencePct).toBeCloseTo(
      (80 / (80 + 3)) * 100, 0,
    );
    expect(k.reopenRatePct).toBeCloseTo((6 / 100) * 100, 0);
    expect(k.escalationRatePct).toBeCloseTo((5 / 100) * 100, 0);
    expect(k.firstContactResolutionPct).toBeCloseTo((85 / 100) * 100, 0);
    expect(k.csatAvg).toBe(4.7);
    expect(k.avgInteractionsPerTicket).toBe(2.3);
  });

  it("getComparativeDepartmentScorecard returns array of scorecards with variancePct vs avg", async () => {
    prisma.supportDepartment.findMany = vi.fn().mockResolvedValue([
      { id: "d1", name: "General Support", firstResponseSlaMinutes: 60, resolutionSlaMinutes: 2880 },
      { id: "d2", name: "Technical Support", firstResponseSlaMinutes: 30, resolutionSlaMinutes: 1440 },
      { id: "d3", name: "Billing Support", firstResponseSlaMinutes: 90, resolutionSlaMinutes: 1920 },
    ]);
    prisma.supportTicket.count = vi.fn()
      .mockResolvedValueOnce(20).mockResolvedValueOnce(18)  // d1 total / resolved
      .mockResolvedValueOnce(50).mockResolvedValueOnce(45)  // d2
      .mockResolvedValueOnce(30).mockResolvedValueOnce(25); // d3
    prisma.supportTicket.aggregate = vi.fn()
      .mockResolvedValueOnce({ _avg: { satisfaction: 4.5 } })
      .mockResolvedValueOnce({ _avg: { satisfaction: 4.1 } })
      .mockResolvedValueOnce({ _avg: { satisfaction: 4.3 } });

    const cards = await (service as any).getComparativeDepartmentScorecard();
    expect(cards).toHaveLength(3);
    // avg of totals = (20+50+30)/3 = 33.333
    const d1 = cards.find((c: any) => c.id === "d1");
    expect(d1.totalTickets).toBe(20);
    expect(typeof d1.ticketVolumeVariancePct).toBe("number");
    expect(typeof d1.csatVariancePct).toBe("number");
    expect(typeof d1.resolutionRatePct).toBe("number");
  });
});

describe("Phase 3 RED — Reporting Engine (generateTicketsReport + CSV)", () => {
  let service: SupportService;
  let prisma: any;

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        SupportService,
        { provide: PrismaService, useValue: buildMock() },
      ],
    }).compile();
    service = mod.get<SupportService>(SupportService);
    prisma = mod.get<PrismaService>(PrismaService) as any;
  });

  it("validateParams rejects invalid days for generateTicketsReport", async () => {
    await expect(
      (service as any).generateTicketsReport({ days: -1, departmentId: "d1" }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("generateTicketsReport returns structured rows + summary totals", async () => {
    prisma.supportTicket.findMany = vi.fn().mockResolvedValue([
      {
        id: "t1", ticketNumber: "T-1", subject: "Can't login", status: "OPEN",
        priority: "HIGH", type: "CUSTOMER", createdAt: new Date("2026-08-01T10:00:00Z"),
        resolvedAt: null, satisfaction: null,
        assignee: { id: "a1", name: "Agent A" },
        user: { id: "u1", name: "User U", email: "u@ex.com" },
        department: { id: "d1", name: "General Support" },
        team: { id: "team-1", name: "Tier 1" },
        category: { name: "Accounts" },
      },
    ]);
    const rep = await (service as any).generateTicketsReport({ days: 7, departmentId: "d1" });
    expect(Array.isArray(rep.rows)).toBe(true);
    expect(rep.rows.length).toBe(1);
    expect(rep.summary.totalRows).toBe(1);
    expect(rep.filters.days).toBe(7);
    expect(rep.filters.departmentId).toBe("d1");
  });

  it("convertReportToCsv escapes commas and quotes", () => {
    const rows = [
      { ticketNumber: "T-1", subject: 'Hello, "world"', status: "OPEN" },
    ];
    const csv = (SupportService as any).convertReportToCsv
      ? (SupportService as any).convertReportToCsv(rows)
      : (service as any).convertReportToCsv(rows);
    expect(csv).toContain("ticketNumber,subject,status");
    expect(csv).toContain('"Hello, ""world"""');
    expect(csv).toContain("T-1");
  });
});

describe("Phase 4 RED — Predictive Analytics (forecastTicketVolume + suggestStaffing)", () => {
  let service: SupportService;
  let prisma: any;

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        SupportService,
        { provide: PrismaService, useValue: buildMock() },
      ],
    }).compile();
    service = mod.get<SupportService>(SupportService);
    prisma = mod.get<PrismaService>(PrismaService) as any;
  });

  it("forecastTicketVolume returns 30-day daily bucketed forecast using weighted average", async () => {
    // 30 counts (fake history)
    const history30 = Array.from({ length: 30 }, (_, i) => 8 + (i % 5));
    prisma.supportTicket.groupBy = vi.fn().mockResolvedValue(
      history30.map((c, idx) => ({ day: idx, _count: { _all: c } })),
    );
    prisma.supportTicket.count = vi.fn().mockResolvedValue(history30.reduce((a, b) => a + b, 0));
    const f = await (service as any).forecastTicketVolume({ deptId: "d1" });
    expect(f.days).toBe(30);
    expect(Array.isArray(f.forecast)).toBe(true);
    expect(f.forecast.length).toBe(30);
    // every bucket should be a positive number
    expect(f.forecast.every((b: any) => b.predicted > 0)).toBe(true);
    expect(typeof f.totalPredicted).toBe("number");
  });

  it("suggestStaffing returns FTE recommendation based on forecast and per-agent capacity", async () => {
    prisma.supportTicket.groupBy = vi.fn().mockResolvedValue(
      Array.from({ length: 30 }, (_, i) => ({ day: i, _count: { _all: 20 } })),
    );
    prisma.supportTicket.count = vi.fn().mockResolvedValue(600);
    // Reuse forecast internally
    const rec = await (service as any).suggestStaffing({
      deptId: "d1",
      ticketsPerAgentPerDay: 10,
    });
    expect(rec.ticketsPerDayAvg).toBeGreaterThan(0);
    expect(rec.recommendedFte).toBeGreaterThan(0);
    expect(rec.assumptions.ticketsPerAgentPerDay).toBe(10);
  });

  it("predictSlaBreachRisk returns score in [0..100] with reasons list", async () => {
    prisma.supportTicket.count = vi.fn()
      .mockResolvedValueOnce(100) // total
      .mockResolvedValueOnce(15)  // breached response
      .mockResolvedValueOnce(12); // breached resolution
    const r = await (service as any).predictSlaBreachRisk({ deptId: "d1" });
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
    expect(Array.isArray(r.reasons)).toBe(true);
    expect(typeof r.responseBreachRatePct).toBe("number");
    expect(typeof r.resolutionBreachRatePct).toBe("number");
  });

  it("predictCsat returns score in [0..5] rounded to one decimal", async () => {
    prisma.supportTicket.aggregate = vi.fn().mockResolvedValue({ _avg: { satisfaction: 4.213 } });
    const p = await (service as any).predictCsat({ deptId: "d1" });
    expect(p.currentAvg).toBeCloseTo(4.2, 1);
    expect(p.predictedNextMonth).toBeGreaterThanOrEqual(0);
    expect(p.predictedNextMonth).toBeLessThanOrEqual(5);
  });
});
