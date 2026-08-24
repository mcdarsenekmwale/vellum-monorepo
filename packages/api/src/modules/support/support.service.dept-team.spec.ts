import { Test } from "@nestjs/testing";
import { SupportService } from "./support.service";
import { PrismaService } from "../../shared/prisma/prisma.service";
import { NotFoundException, BadRequestException, ConflictException } from "@nestjs/common";

// Jest / Vitest compatibility shim — prefer Jest globals if present
declare const jest: any;
const vi: any = {
  fn: (...args: any[]) => {
    if (typeof jest !== 'undefined' && typeof jest.fn === 'function') return jest.fn(...args);
    return (globalThis as any).vi.fn(...args);
  },
};

/**
 * Phase 1 — RED tests for enterprise Team & Department management.
 *
 * These tests FAIL initially because:
 *   (A) the schema is missing expanded fields (headId, leadId, SLA,
 *       business-hours, capacity settings, skill specialization)
 *   (B) unique constraints (department.name globally, team.name within
 *       department) aren't enforced → runtime errors expected
 *   (C) SupportAgent↔SupportTeam is 1:N today; M:N join table with
 *       isPrimary + membership history doesn't exist
 *   (D) CRUD service methods for departments/teams/memberships are absent
 */

type StubDept = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  email: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  // ─── Phase 1 new fields ──────────────────────────────────────────────
  headId: string | null;              // department manager (User.id)
  firstResponseSlaMinutes: number;    // dept-level SLA
  resolutionSlaMinutes: number;       // dept-level SLA
  slaAdherenceTargetPct: number;      // 0..100
  businessHoursStartMin: number;      // minutes from midnight, e.g. 9*60=540
  businessHoursEndMin: number;        // minutes from midnight, e.g. 17*60=1020
  businessDays: number[];             // 0=Sun..6=Sat, default [1..5]
  timezone: string;                   // IANA tz
  budgetAllocated: number | null;     // Decimal-ish, optional
  resourceCapacityFte: number | null; // optional headcount capacity
};

type StubTeam = {
  id: string;
  name: string;
  departmentId: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  // ─── Phase 1 new fields ──────────────────────────────────────────────
  leadId: string | null;                           // SupportAgent.userId
  slaInheritFromDept: boolean;                     // true by default
  firstResponseSlaMinutes: number | null;          // overridden only when inherit=false
  resolutionSlaMinutes: number | null;
  businessHoursInherit: boolean;                   // true default
  businessHoursStartMin: number | null;
  businessHoursEndMin: number | null;
  businessDays: number[] | null;
  timezone: string | null;
  maxTicketsPerAgent: number;                      // capacity
  concurrentTicketLimitPerAgent: number;           // capacity
  skillSpecialization: string | null;              // e.g. "billing" | "technical" | "product"
};

/**
 * Agent↔Team M:N membership join-table row (currently missing from schema).
 * History: startDate/endDate allow tracking reassignments over time.
 * Invariant: exactly one `isPrimary=true` row per agent where endDate IS NULL.
 */
type StubAgentTeamMembership = {
  id: string;
  agentId: string;      // FK → SupportAgent.id
  teamId: string;       // FK → SupportTeam.id
  isPrimary: boolean;
  startDate: Date;
  endDate: Date | null; // null = currently active
  assignedBy: string | null; // User.id of the admin/manager who assigned
  assignedAt: Date;
};

// ────────────────────────────────────────────────────────────────────────────
// 1. SCHEMA-LEVEL: new fields + uniqueness assertions (RED before migration)
// ────────────────────────────────────────────────────────────────────────────
describe("Phase 1.1 — Schema: Department expanded fields + uniqueness", () => {
  it("StubDept exposes Phase 1 fields (will fail TSC until schema grows)", () => {
    const dept: StubDept = {
      id: "d1", key: "eng", name: "Engineering",
      description: null, email: null, isActive: true,
      createdAt: new Date(), updatedAt: new Date(), deletedAt: null,
      headId: "user-1",
      firstResponseSlaMinutes: 15,
      resolutionSlaMinutes: 60 * 8,
      slaAdherenceTargetPct: 95,
      businessHoursStartMin: 9 * 60,
      businessHoursEndMin: 17 * 60,
      businessDays: [1, 2, 3, 4, 5],
      timezone: "America/New_York",
      budgetAllocated: 250_000,
      resourceCapacityFte: 12,
    };
    expect(dept.headId).toBe("user-1");
    expect(dept.firstResponseSlaMinutes).toBeLessThan(dept.resolutionSlaMinutes);
    expect(dept.businessDays).toEqual(expect.arrayContaining([1, 2, 3, 4, 5]));
    expect(dept.slaAdherenceTargetPct).toBeGreaterThanOrEqual(0);
    expect(dept.slaAdherenceTargetPct).toBeLessThanOrEqual(100);
  });

  it("StubTeam exposes Phase 1 fields (capacity, inherit, lead, skill)", () => {
    const team: StubTeam = {
      id: "t1", name: "Billing L1", departmentId: "d1",
      description: null, isActive: true,
      createdAt: new Date(), updatedAt: new Date(), deletedAt: null,
      leadId: "agent-lead",
      slaInheritFromDept: true,
      firstResponseSlaMinutes: null,
      resolutionSlaMinutes: null,
      businessHoursInherit: true,
      businessHoursStartMin: null,
      businessHoursEndMin: null,
      businessDays: null,
      timezone: null,
      maxTicketsPerAgent: 10,
      concurrentTicketLimitPerAgent: 4,
      skillSpecialization: "billing",
    };
    expect(team.slaInheritFromDept).toBe(true);
    expect(team.maxTicketsPerAgent).toBeGreaterThan(0);
    expect(team.concurrentTicketLimitPerAgent).toBeLessThanOrEqual(team.maxTicketsPerAgent);
  });

  it("StubAgentTeamMembership captures primary flag + historical date range", () => {
    const now = new Date();
    const row: StubAgentTeamMembership = {
      id: "m1",
      agentId: "a1",
      teamId: "t1",
      isPrimary: true,
      startDate: new Date(now.getTime() - 86_400_000 * 30),
      endDate: null,
      assignedBy: "admin-1",
      assignedAt: now,
    };
    expect(row.isPrimary).toBe(true);
    expect(row.endDate).toBeNull();
    expect(row.startDate.getTime()).toBeLessThan(row.assignedAt.getTime());
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 2. Phase 1.3 RED — Department CRUD service behavior
//    (service methods don't exist yet — tests will fail with "is not a function")
// ────────────────────────────────────────────────────────────────────────────
describe("Phase 1.3 RED — Department CRUD service", () => {
  let service: SupportService;
  let prisma: any;

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        SupportService,
        { provide: PrismaService, useValue: { supportDepartment: {}, supportTeam: {}, supportAgent: {}, user: {} } },
      ],
    }).compile();
    service = mod.get<SupportService>(SupportService);
    prisma = mod.get<PrismaService>(PrismaService) as any;
  });

  it("createDepartment rejects when SLA targets > 100 pct", async () => {
    await expect(
      service.createDepartment({
        key: "test",
        name: "Test Dept",
        slaAdherenceTargetPct: 101,
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("createDepartment rejects when business start >= end", async () => {
    await expect(
      service.createDepartment({
        key: "test", name: "Test Dept",
        businessHoursStartMin: 17 * 60, businessHoursEndMin: 9 * 60,
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("createDepartment rejects when businessDays contains values outside 0..6", async () => {
    await expect(
      service.createDepartment({
        key: "test", name: "Test Dept",
        businessDays: [1, 7],
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("createDepartment calls prisma with all expanded fields on success", async () => {
    const created = { id: "new-dept", key: "eng", name: "Engineering" };
    prisma.supportDepartment.create = vi.fn().mockResolvedValue(created);
    const result = await service.createDepartment({
      key: "eng",
      name: "Engineering",
      description: "Product engineering",
      email: "eng@company.com",
      headId: "user-head-1",
      firstResponseSlaMinutes: 10,
      resolutionSlaMinutes: 240,
      slaAdherenceTargetPct: 95,
      businessHoursStartMin: 540,
      businessHoursEndMin: 1020,
      businessDays: [1, 2, 3, 4, 5],
      timezone: "America/Los_Angeles",
      budgetAllocated: 120000,
      resourceCapacityFte: 8,
    } as any);
    expect(result.id).toBe(created.id);
    const args = prisma.supportDepartment.create.mock.calls[0][0].data;
    expect(args.headId).toBe("user-head-1");
    expect(args.firstResponseSlaMinutes).toBe(10);
    expect(args.resolutionSlaMinutes).toBe(240);
    expect(args.slaAdherenceTargetPct).toBe(95);
    expect(args.businessDays).toEqual([1, 2, 3, 4, 5]);
    expect(args.timezone).toBe("America/Los_Angeles");
    // Decimal fields are Prisma.Decimal instances; compare via coerced Number
    expect(Number(args.budgetAllocated)).toBe(120000);
  });

  it("listDepartments paginates, filters by isActive/search, excludes deleted by default", async () => {
    prisma.supportDepartment.count = vi.fn().mockResolvedValue(1);
    prisma.supportDepartment.findMany = vi.fn().mockResolvedValue([{ id: "d1", name: "Sales" }]);
    const result = await service.listDepartments({ page: 1, limit: 10, search: "sale", isActive: true } as any);
    expect(result.page).toBe(1);
    expect(result.total).toBe(1);
    const args = prisma.supportDepartment.findMany.mock.calls[0][0];
    expect(args.where.OR).toBeDefined();          // search filter
    expect(args.where.deletedAt).toBeNull();      // soft-delete exclusion
    expect(args.where.isActive).toBe(true);
  });

  it("getDepartment returns teams + member count rollup; 404 on missing", async () => {
    prisma.supportDepartment.findUnique = vi.fn().mockResolvedValue(null);
    await expect(service.getDepartment("missing") as any).rejects.toBeInstanceOf(NotFoundException);

    prisma.supportDepartment.findUnique = vi.fn().mockResolvedValue({
      id: "d1", name: "Eng", teams: [{ id: "t1", name: "L1" }],
    });
    const dept = await service.getDepartment("d1") as any;
    expect(dept.teams.length).toBe(1);
  });

  it("updateDepartment partial-patches SLA/business-hours; 404 missing", async () => {
    prisma.supportDepartment.findUnique = vi.fn().mockResolvedValue(null);
    await expect(service.updateDepartment("nope", { name: "x" } as any)).rejects.toBeInstanceOf(NotFoundException);

    prisma.supportDepartment.findUnique = vi.fn().mockResolvedValue({ id: "d1", name: "old" });
    prisma.supportDepartment.update = vi.fn().mockResolvedValue({ id: "d1", name: "new" });
    const r = await service.updateDepartment("d1", { slaAdherenceTargetPct: 90 } as any);
    expect((r as any).id).toBe("d1");
    const args = prisma.supportDepartment.update.mock.calls[0][0].data;
    expect(args.slaAdherenceTargetPct).toBe(90);
  });

  it("deleteDepartment is a soft-delete (sets deletedAt); 404 if already gone", async () => {
    prisma.supportDepartment.findUnique = vi.fn().mockResolvedValue({ id: "d1", deletedAt: new Date() });
    await expect(service.deleteDepartment("d1")).rejects.toBeInstanceOf(NotFoundException);

    prisma.supportDepartment.findUnique = vi.fn().mockResolvedValue({ id: "d1", deletedAt: null });
    prisma.supportDepartment.update = vi.fn().mockResolvedValue({ id: "d1" });
    await service.deleteDepartment("d1");
    const args = prisma.supportDepartment.update.mock.calls[0][0].data;
    expect(args.deletedAt).toBeDefined();
    expect(args.isActive).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 3. Phase 1.4 RED — Team CRUD + Agent membership (M:N)
// ────────────────────────────────────────────────────────────────────────────
describe("Phase 1.4 RED — Team CRUD + Agent membership", () => {
  let service: SupportService;
  let prisma: any;

  beforeEach(async () => {
    const prismaMock: any = {
      supportDepartment: {},
      supportTeam: {},
      supportAgent: {},
      user: {},
      supportAgentTeamMembership: {},
      // Pass-through $transaction: just invoke the callback with the same mock
      // so tests can inspect/update the mock in a "transactional" block.
      $transaction: async (fn: (tx: any) => Promise<any>) => fn(prismaMock),
    };
    const mod = await Test.createTestingModule({
      providers: [
        SupportService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    service = mod.get<SupportService>(SupportService);
    prisma = prismaMock;
  });

  it("createTeam rejects when maxTicketsPerAgent <= 0 or concurrent > max", async () => {
    prisma.supportDepartment.findUnique = vi.fn().mockResolvedValue({ id: "d1", isActive: true });
    await expect(
      service.createTeam({
        departmentId: "d1", name: "T",
        maxTicketsPerAgent: 0, concurrentTicketLimitPerAgent: 1,
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.createTeam({
        departmentId: "d1", name: "T",
        maxTicketsPerAgent: 5, concurrentTicketLimitPerAgent: 6,
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("createTeam rejects when inherit=false but override SLA is missing", async () => {
    prisma.supportDepartment.findUnique = vi.fn().mockResolvedValue({ id: "d1", isActive: true });
    await expect(
      service.createTeam({
        departmentId: "d1", name: "T",
        slaInheritFromDept: false, firstResponseSlaMinutes: null,
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("createTeam calls prisma with capacity/lead/inherit + all expanded fields", async () => {
    prisma.supportDepartment.findUnique = vi.fn().mockResolvedValue({ id: "d1", isActive: true });
    prisma.supportTeam.create = vi.fn().mockResolvedValue({ id: "t1" });
    const r = await service.createTeam({
      departmentId: "d1", name: "Billing L2",
      description: "Handles billing escalations",
      leadId: "agent-1",
      slaInheritFromDept: false,
      firstResponseSlaMinutes: 5,
      resolutionSlaMinutes: 60,
      businessHoursInherit: false,
      businessHoursStartMin: 8 * 60,
      businessHoursEndMin: 20 * 60,
      businessDays: [0, 1, 2, 3, 4, 5, 6],
      timezone: "UTC",
      maxTicketsPerAgent: 12,
      concurrentTicketLimitPerAgent: 6,
      skillSpecialization: "billing",
    } as any);
    expect((r as any).id).toBe("t1");
    const d = prisma.supportTeam.create.mock.calls[0][0].data;
    expect(d.departmentId).toBe("d1");
    expect(d.leadId).toBe("agent-1");
    expect(d.slaInheritFromDept).toBe(false);
    expect(d.firstResponseSlaMinutes).toBe(5);
    expect(d.maxTicketsPerAgent).toBe(12);
    expect(d.concurrentTicketLimitPerAgent).toBe(6);
    expect(d.skillSpecialization).toBe("billing");
  });

  it("listTeams supports departmentId + isActive filters, excludes soft-deleted", async () => {
    prisma.supportTeam.count = vi.fn().mockResolvedValue(1);
    prisma.supportTeam.findMany = vi.fn().mockResolvedValue([{ id: "t1" }]);
    const result = await service.listTeams({ departmentId: "d1", isActive: true, page: 1, limit: 10 } as any);
    const args = prisma.supportTeam.findMany.mock.calls[0][0];
    expect(args.where.departmentId).toBe("d1");
    expect(args.where.isActive).toBe(true);
    expect(args.where.deletedAt).toBeNull();
    expect(result.data.length).toBe(1);
  });

  it("addAgentToTeam creates a membership row; isPrimary=true swaps old primary", async () => {
    prisma.supportAgent.findUnique = vi.fn().mockResolvedValue({ id: "a1" });
    prisma.supportTeam.findUnique = vi.fn().mockResolvedValue({ id: "t1" });
    prisma.supportAgentTeamMembership = prisma.supportAgentTeamMembership || {};
    prisma.supportAgentTeamMembership.findFirst = vi.fn().mockResolvedValue(null);
    prisma.supportAgentTeamMembership.create = vi.fn().mockResolvedValue({ id: "m1" });
    prisma.supportAgentTeamMembership.updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const r = await service.addAgentToTeam("a1", "t1", { isPrimary: true, assignedBy: "admin" } as any);
    expect((r as any).id).toBe("m1");
    // Old primary must have been demoted (updateMany called with isPrimary=false)
    expect(prisma.supportAgentTeamMembership.updateMany.mock.calls.length).toBeGreaterThanOrEqual(1);
    // Membership.create must carry isPrimary=true + assignedBy + startDate/endDate
    const m = prisma.supportAgentTeamMembership.create.mock.calls[0][0].data;
    expect(m.isPrimary).toBe(true);
    expect(m.assignedBy).toBe("admin");
    expect(m.endDate).toBeNull();
  });

  it("addAgentToTeam rejects if agent already on team with active membership", async () => {
    prisma.supportAgent.findUnique = vi.fn().mockResolvedValue({ id: "a1" });
    prisma.supportTeam.findUnique = vi.fn().mockResolvedValue({ id: "t1" });
    prisma.supportAgentTeamMembership.findFirst = vi.fn().mockResolvedValue({ id: "existing" });
    prisma.supportAgentTeamMembership.create = vi.fn();
    await expect(
      service.addAgentToTeam("a1", "t1", { isPrimary: false } as any),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.supportAgentTeamMembership.create).not.toHaveBeenCalled();
  });

  it("removeAgentFromTeam closes membership (sets endDate); also reassigns primary if needed", async () => {
    prisma.supportAgentTeamMembership.findFirst = vi.fn()
      .mockResolvedValue({ id: "m1", isPrimary: true, agentId: "a1", teamId: "t1" });
    prisma.supportAgentTeamMembership.update = vi.fn().mockResolvedValue({ id: "m1" });
    prisma.supportAgentTeamMembership.updateMany = vi.fn().mockResolvedValue({ count: 0 });
    await service.removeAgentFromTeam("a1", "t1");
    const args = prisma.supportAgentTeamMembership.update.mock.calls[0][0].data;
    expect(args.endDate).toBeDefined();
  });

  it("setPrimaryTeam demotes previous primary, promotes new one", async () => {
    prisma.supportAgentTeamMembership.findFirst = vi.fn()
      .mockResolvedValueOnce({ id: "oldPrimary", isPrimary: true })
      .mockResolvedValueOnce({ id: "newMembership", isPrimary: false });
    prisma.supportAgentTeamMembership.update = vi.fn().mockResolvedValue({});
    await service.setPrimaryTeam("a1", "t2");
    // 2 update calls: demote old, promote new
    expect(prisma.supportAgentTeamMembership.update).toHaveBeenCalledTimes(2);
  });
});
