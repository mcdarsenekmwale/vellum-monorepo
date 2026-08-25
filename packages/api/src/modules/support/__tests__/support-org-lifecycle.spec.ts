import { Test } from "@nestjs/testing";
import { SupportService } from "../support.service";
import { PrismaService } from "../../../shared/prisma/prisma.service";
import { NotFoundException, BadRequestException, ConflictException } from "@nestjs/common";

declare const global: any;
const vi: any = {
  fn: (...args: any[]) => (global.jest ? global.jest.fn(...args) : (globalThis as any).vi.fn(...args)),
};

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
  headId: string | null;
  firstResponseSlaMinutes: number;
  resolutionSlaMinutes: number;
  slaAdherenceTargetPct: number;
  businessHoursStartMin: number;
  businessHoursEndMin: number;
  businessDays: number[];
  timezone: string;
  budgetAllocated: any;
  resourceCapacityFte: any;
};

type StubTeam = {
  id: string;
  departmentId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  leadId: string | null;
  slaInheritFromDept: boolean;
  firstResponseSlaMinutes: number | null;
  resolutionSlaMinutes: number | null;
  businessHoursInherit: boolean;
  businessHoursStartMin: number | null;
  businessHoursEndMin: number | null;
  businessDays: number[];
  timezone: string | null;
  maxTicketsPerAgent: number;
  concurrentTicketLimitPerAgent: number;
  skillSpecialization: string | null;
};

type StubAgent = {
  id: string;
  userId: string;
  departmentId: string | null;
  teamId: string | null;
  isActive: boolean;
  deletedAt: Date | null;
  createdAt: Date;
};

type StubTicket = {
  id: string;
  departmentId: string | null;
  teamId: string | null;
  status: string;
  deletedAt: Date | null;
  createdAt: Date;
};

type StubUser = {
  id: string;
  name: string;
  email: string;
};

class MockPrisma {
  departments: StubDept[] = [];
  teams: StubTeam[] = [];
  agents: StubAgent[] = [];
  tickets: StubTicket[] = [];
  users: StubUser[] = [];

  $transaction = async (fn: (tx: any) => Promise<any>) => fn(this);

  supportDepartment = {
    create: async (q: any) => {
      const d = q.data;
      const existingKey = this.departments.find((x) => x.key === d.key);
      if (existingKey) throw { code: "P2002", meta: { target: ["key"] } };
      const existingName = this.departments.find((x) => x.name === d.name);
      if (existingName) throw { code: "P2002", meta: { target: ["name"] } };
      const dept: StubDept = {
        id: `dept-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        key: d.key,
        name: d.name,
        description: d.description ?? null,
        email: d.email ?? null,
        isActive: d.isActive ?? true,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        headId: d.headId ?? null,
        firstResponseSlaMinutes: d.firstResponseSlaMinutes ?? 30,
        resolutionSlaMinutes: d.resolutionSlaMinutes ?? 1440,
        slaAdherenceTargetPct: d.slaAdherenceTargetPct ?? 95,
        businessHoursStartMin: d.businessHoursStartMin ?? 540,
        businessHoursEndMin: d.businessHoursEndMin ?? 1020,
        businessDays: d.businessDays ?? [1, 2, 3, 4, 5],
        timezone: d.timezone ?? "UTC",
        budgetAllocated: d.budgetAllocated ?? null,
        resourceCapacityFte: d.resourceCapacityFte ?? null,
      };
      this.departments.push(dept);
      return { ...dept };
    },
    count: async (q: any) => {
      const w = q?.where ?? {};
      return this.departments.filter((d) => this._matchDept(d, w)).length;
    },
    findMany: async (q: any) => {
      const w = q?.where ?? {};
      let rows = this.departments.filter((d) => this._matchDept(d, w));
      if (q?.orderBy) {
        const [field, dir] = Object.entries(q.orderBy)[0] as [string, "asc" | "desc"];
        rows = [...rows].sort((a: any, b: any) => {
          const av = a[field];
          const bv = b[field];
          if (av < bv) return dir === "asc" ? -1 : 1;
          if (av > bv) return dir === "asc" ? 1 : -1;
          return 0;
        });
      }
      if (typeof q?.skip === "number" && typeof q?.take === "number") {
        rows = rows.slice(q.skip, q.skip + q.take);
      }
      return rows.map((d) => this._hydrateDept(d, q?.include));
    },
    findUnique: async (q: any) => {
      const w = q?.where ?? {};
      let d: StubDept | undefined;
      if (w.id) d = this.departments.find((x) => x.id === w.id);
      if (w.key) d = this.departments.find((x) => x.key === w.key);
      if (w.name) d = this.departments.find((x) => x.name === w.name);
      if (!d) return null;
      return this._hydrateDept(d, q?.include);
    },
    update: async (q: any) => {
      const w = q?.where ?? {};
      const idx = this.departments.findIndex((d) => d.id === w.id);
      if (idx === -1) throw new NotFoundException("Department not found");
      const data = q.data ?? {};
      if (data.name) {
        const dupName = this.departments.find(
          (x, i) => i !== idx && x.name === data.name,
        );
        if (dupName) throw { code: "P2002", meta: { target: ["name"] } };
      }
      if (data.head !== undefined) delete data.head;
      this.departments[idx] = { ...this.departments[idx], ...data, updatedAt: new Date() };
      return { ...this.departments[idx] };
    },
  };

  supportTeam = {
    create: async (q: any) => {
      const d = q.data;
      const dup = this.teams.find(
        (t) => t.departmentId === d.departmentId && t.name === d.name && !t.deletedAt,
      );
      if (dup) throw { code: "P2002", meta: { target: ["departmentId", "name"] } };
      const team: StubTeam = {
        id: `team-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        departmentId: d.departmentId,
        name: d.name,
        description: d.description ?? null,
        isActive: d.isActive ?? true,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        leadId: d.leadId ?? null,
        slaInheritFromDept: d.slaInheritFromDept ?? true,
        firstResponseSlaMinutes: d.firstResponseSlaMinutes ?? null,
        resolutionSlaMinutes: d.resolutionSlaMinutes ?? null,
        businessHoursInherit: d.businessHoursInherit ?? true,
        businessHoursStartMin: d.businessHoursStartMin ?? null,
        businessHoursEndMin: d.businessHoursEndMin ?? null,
        businessDays: d.businessDays ?? [],
        timezone: d.timezone ?? null,
        maxTicketsPerAgent: d.maxTicketsPerAgent ?? 10,
        concurrentTicketLimitPerAgent: d.concurrentTicketLimitPerAgent ?? 4,
        skillSpecialization: d.skillSpecialization ?? null,
      };
      this.teams.push(team);
      return { ...team };
    },
    count: async (q: any) => {
      const w = q?.where ?? {};
      return this.teams.filter((t) => this._matchTeam(t, w)).length;
    },
    findMany: async (q: any) => {
      const w = q?.where ?? {};
      let rows = this.teams.filter((t) => this._matchTeam(t, w));
      if (typeof q?.skip === "number" && typeof q?.take === "number") {
        rows = rows.slice(q.skip, q.skip + q.take);
      }
      return rows.map((t) => this._hydrateTeam(t, q?.include));
    },
    findUnique: async (q: any) => {
      const w = q?.where ?? {};
      const t = this.teams.find((x) => x.id === w.id);
      if (!t) return null;
      return this._hydrateTeam(t, q?.include);
    },
    update: async (q: any) => {
      const w = q?.where ?? {};
      const idx = this.teams.findIndex((t) => t.id === w.id);
      if (idx === -1) throw new NotFoundException("Team not found");
      const data = q.data ?? {};
      if (data.name !== undefined || data.department !== undefined) {
        const team = this.teams[idx];
        const effName = data.name ?? team.name;
        const effDeptId = data.department?.connect?.id ?? team.departmentId;
        const dup = this.teams.find(
          (x, i) =>
            i !== idx &&
            !x.deletedAt &&
            x.departmentId === effDeptId &&
            x.name === effName,
        );
        if (dup) throw { code: "P2002", meta: { target: ["departmentId", "name"] } };
        if (data.department?.connect?.id) {
          this.teams[idx].departmentId = data.department.connect.id;
        }
      }
      if (data.lead?.connect?.id) {
        this.teams[idx].leadId = data.lead.connect.id;
      }
      if (data.lead?.disconnect) {
        this.teams[idx].leadId = null;
      }
      if (data.department?.connect?.id) delete data.department;
      if (data.lead !== undefined) delete data.lead;
      this.teams[idx] = { ...this.teams[idx], ...data, updatedAt: new Date() };
      return { ...this.teams[idx] };
    },
  };

  supportAgent = {
    findMany: async (_q: any) => this.agents.filter((a) => !a.deletedAt),
    count: async (q: any) => {
      const w = q?.where ?? {};
      return this.agents.filter((a) => {
        if (a.deletedAt) return false;
        if (w.departmentId && a.departmentId !== w.departmentId) return false;
        return true;
      }).length;
    },
  };

  supportTicket = {
    count: async (q: any) => {
      const w = q?.where ?? {};
      return this.tickets.filter((t) => {
        if (t.deletedAt) return false;
        if (w.departmentId && t.departmentId !== w.departmentId) return false;
        if (w.teamId && t.teamId !== w.teamId) return false;
        return true;
      }).length;
    },
  };

  user = {
    findUnique: async (q: any) => {
      return this.users.find((u) => u.id === q.where.id) ?? null;
    },
  };

  _matchDept(d: StubDept, w: any): boolean {
    if (w.deletedAt === null && d.deletedAt !== null) return false;
    if (w.deletedAt !== undefined && w.deletedAt !== null) return false;
    if (w.isActive !== undefined && d.isActive !== w.isActive) return false;
    if (w.OR) {
      const match = w.OR.some((or: any) => {
        if (or.name?.contains) {
          return d.name.toLowerCase().includes(or.name.contains.toLowerCase());
        }
        if (or.key?.contains) {
          return d.key.toLowerCase().includes(or.key.contains.toLowerCase());
        }
        if (or.email?.contains) {
          return d.email?.toLowerCase().includes(or.email.contains.toLowerCase());
        }
        if (or.description?.contains) {
          return d.description?.toLowerCase().includes(or.description.contains.toLowerCase());
        }
        return false;
      });
      if (!match) return false;
    }
    return true;
  }

  _matchTeam(t: StubTeam, w: any): boolean {
    if (w.deletedAt === null && t.deletedAt !== null) return false;
    if (w.isActive !== undefined && t.isActive !== w.isActive) return false;
    if (w.departmentId && t.departmentId !== w.departmentId) return false;
    if (w.OR) {
      const match = w.OR.some((or: any) => {
        if (or.name?.contains) {
          return t.name.toLowerCase().includes(or.name.contains.toLowerCase());
        }
        return false;
      });
      if (!match) return false;
    }
    return true;
  }

  _hydrateDept(d: StubDept, include?: any) {
    const head = d.headId ? this.users.find((u) => u.id === d.headId) ?? null : null;
    const teams = this.teams.filter(
      (t) => t.departmentId === d.id && !t.deletedAt,
    );
    const teamCount = teams.length;
    const agentCount = this.agents.filter(
      (a) => a.departmentId === d.id && !a.deletedAt,
    ).length;
    const ticketCount = this.tickets.filter(
      (t) => t.departmentId === d.id && !t.deletedAt,
    ).length;
    const openTicketCount = this.tickets.filter(
      (t) =>
        t.departmentId === d.id &&
        !t.deletedAt &&
        !["RESOLVED", "CLOSED"].includes(t.status),
    ).length;
    const result: any = { ...d };
    if (include) {
      if (include.head) {
        result.head = head
          ? { id: head.id, name: head.name, email: head.email, avatar: null }
          : null;
      }
      if (include.teams) {
        result.teams = teams.map((t) => {
          const lead = t.leadId ? this.users.find((u) => u.id === t.leadId) ?? null : null;
          const tAgents = this.agents.filter((a) => a.teamId === t.id && !a.deletedAt);
          return {
            ...t,
            lead: lead
              ? { id: lead.id, name: lead.name, email: lead.email, avatar: null }
              : null,
            _count: { agents: tAgents.length, memberships: 0 },
          };
        });
      }
      if (include._count) {
        result._count = {
          teams: teamCount,
          agents: agentCount,
          tickets: ticketCount,
        };
        result.teamCount = teamCount;
        result.agentCount = agentCount;
        result.ticketCount = ticketCount;
        result.openTicketCount = openTicketCount;
      }
    }
    return result;
  }

  _hydrateTeam(t: StubTeam, include?: any) {
    const dept = this.departments.find((d) => d.id === t.departmentId);
    const lead = t.leadId ? this.users.find((u) => u.id === t.leadId) ?? null : null;
    const result: any = { ...t };
    if (include) {
      if (include.department) {
        result.department = dept
          ? { id: dept.id, name: dept.name, key: dept.key }
          : null;
      }
      if (include.lead) {
        result.lead = lead
          ? { id: lead.id, name: lead.name, email: lead.email, avatar: null }
          : null;
      }
      if (include.memberships) {
        result.memberships = [];
      }
      if (include._count) {
        const memberCount = this.agents.filter(
          (a) => a.teamId === t.id && !a.deletedAt,
        ).length;
        result._count = { members: memberCount };
      }
    }
    return result;
  }
}

describe("Support Org Lifecycle — Departments + Teams (TDD)", () => {
  let service: SupportService;
  let prisma: MockPrisma;

  beforeEach(async () => {
    prisma = new MockPrisma();

    prisma.users = [
      { id: "u-alice", name: "Alice Head", email: "alice@vellbase.com" },
      { id: "u-bob", name: "Bob Lead", email: "bob@vellbase.com" },
      { id: "u-carol", name: "Carol Agent", email: "carol@vellbase.com" },
      { id: "u-dave", name: "Dave Agent", email: "dave@vellbase.com" },
      { id: "u-eve", name: "Eve Lead", email: "eve@vellbase.com" },
    ];

    const now = new Date();

    prisma.departments = [
      {
        id: "dept-eng", key: "ENG", name: "Engineering",
        description: "Product engineering support", email: "eng@vellbase.com",
        isActive: true, createdAt: now, updatedAt: now, deletedAt: null,
        headId: "u-alice",
        firstResponseSlaMinutes: 15, resolutionSlaMinutes: 480,
        slaAdherenceTargetPct: 98,
        businessHoursStartMin: 540, businessHoursEndMin: 1020,
        businessDays: [1, 2, 3, 4, 5], timezone: "America/New_York",
        budgetAllocated: null, resourceCapacityFte: null,
      },
      {
        id: "dept-billing", key: "BILL", name: "Billing",
        description: "Billing and payments support", email: "billing@vellbase.com",
        isActive: true, createdAt: now, updatedAt: now, deletedAt: null,
        headId: null,
        firstResponseSlaMinutes: 30, resolutionSlaMinutes: 1440,
        slaAdherenceTargetPct: 95,
        businessHoursStartMin: 540, businessHoursEndMin: 1020,
        businessDays: [1, 2, 3, 4, 5], timezone: "UTC",
        budgetAllocated: null, resourceCapacityFte: null,
      },
      {
        id: "dept-inactive", key: "INAC", name: "Inactive Dept",
        description: null, email: null,
        isActive: false, createdAt: now, updatedAt: now, deletedAt: null,
        headId: null,
        firstResponseSlaMinutes: 30, resolutionSlaMinutes: 1440,
        slaAdherenceTargetPct: 90,
        businessHoursStartMin: 540, businessHoursEndMin: 1020,
        businessDays: [1, 2, 3, 4, 5], timezone: "UTC",
        budgetAllocated: null, resourceCapacityFte: null,
      },
    ];

    prisma.teams = [
      {
        id: "team-api", departmentId: "dept-eng", name: "API Support",
        description: "API and integration issues", isActive: true,
        createdAt: now, updatedAt: now, deletedAt: null,
        leadId: "u-bob",
        slaInheritFromDept: true, firstResponseSlaMinutes: null, resolutionSlaMinutes: null,
        businessHoursInherit: true, businessHoursStartMin: null, businessHoursEndMin: null,
        businessDays: [], timezone: null,
        maxTicketsPerAgent: 10, concurrentTicketLimitPerAgent: 4,
        skillSpecialization: "technical",
      },
      {
        id: "team-mobile", departmentId: "dept-eng", name: "Mobile Support",
        description: "iOS and Android issues", isActive: true,
        createdAt: now, updatedAt: now, deletedAt: null,
        leadId: null,
        slaInheritFromDept: true, firstResponseSlaMinutes: null, resolutionSlaMinutes: null,
        businessHoursInherit: true, businessHoursStartMin: null, businessHoursEndMin: null,
        businessDays: [], timezone: null,
        maxTicketsPerAgent: 8, concurrentTicketLimitPerAgent: 3,
        skillSpecialization: "mobile",
      },
      {
        id: "team-payments", departmentId: "dept-billing", name: "Payments Team",
        description: "Payment processing issues", isActive: true,
        createdAt: now, updatedAt: now, deletedAt: null,
        leadId: "u-eve",
        slaInheritFromDept: true, firstResponseSlaMinutes: null, resolutionSlaMinutes: null,
        businessHoursInherit: true, businessHoursStartMin: null, businessHoursEndMin: null,
        businessDays: [], timezone: null,
        maxTicketsPerAgent: 12, concurrentTicketLimitPerAgent: 5,
        skillSpecialization: "billing",
      },
    ];

    prisma.agents = [
      { id: "a1", userId: "u-carol", departmentId: "dept-eng", teamId: "team-api", isActive: true, deletedAt: null, createdAt: now },
      { id: "a2", userId: "u-dave", departmentId: "dept-eng", teamId: "team-mobile", isActive: true, deletedAt: null, createdAt: now },
      { id: "a3", userId: "u-eve", departmentId: "dept-billing", teamId: "team-payments", isActive: true, deletedAt: null, createdAt: now },
    ];

    prisma.tickets = [
      { id: "tk1", departmentId: "dept-eng", teamId: "team-api", status: "IN_PROGRESS", deletedAt: null, createdAt: now },
      { id: "tk2", departmentId: "dept-eng", teamId: "team-api", status: "NEW", deletedAt: null, createdAt: now },
      { id: "tk3", departmentId: "dept-eng", teamId: "team-mobile", status: "RESOLVED", deletedAt: null, createdAt: now },
      { id: "tk4", departmentId: "dept-billing", teamId: "team-payments", status: "ESCALATED", deletedAt: null, createdAt: now },
      { id: "tk5", departmentId: "dept-billing", teamId: null, status: "CLOSED", deletedAt: null, createdAt: now },
    ];

    const module = await Test.createTestingModule({
      providers: [SupportService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(SupportService);
  });

  // ──────────────────────────────────────────────────────────────────────────────
  // D1 — create dept requires name/key
  // ──────────────────────────────────────────────────────────────────────────────
  describe("D1 — createDepartment requires name/key", () => {
    it("throws BadRequest when key is missing", async () => {
      await expect(
        service.createDepartment({ name: "Some Dept" } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws BadRequest when key is empty/whitespace", async () => {
      await expect(
        service.createDepartment({ key: "   ", name: "Some Dept" } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws BadRequest when name is missing", async () => {
      await expect(
        service.createDepartment({ key: "XYZ" } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws BadRequest when name is empty/whitespace", async () => {
      await expect(
        service.createDepartment({ key: "XYZ", name: "   " } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it("succeeds when both key and name are provided", async () => {
      const result = await service.createDepartment({
        key: "HR",
        name: "Human Resources",
      });
      expect(result.key).toBe("HR");
      expect(result.name).toBe("Human Resources");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────────
  // D2 — list depts paginates, search filters, status filter works
  // ──────────────────────────────────────────────────────────────────────────────
  describe("D2 — listDepartments pagination, search, status filter", () => {
    it("paginates with correct default page/limit and totalPages", async () => {
      const r = await service.listDepartments({ page: 1, limit: 2 });
      expect(r.page).toBe(1);
      expect(r.limit).toBe(2);
      expect(r.total).toBe(3);
      expect(r.data.length).toBe(2);
      expect(r.totalPages).toBe(2);
    });

    it("second page returns remaining records", async () => {
      const page1 = await service.listDepartments({ page: 1, limit: 2 });
      const page2 = await service.listDepartments({ page: 2, limit: 2 });
      expect(page1.data.map((d: any) => d.id)).not.toEqual(
        page2.data.map((d: any) => d.id),
      );
      expect(page2.data.length).toBe(1);
    });

    it("search by name substring filters results", async () => {
      const r = await service.listDepartments({ search: "billing" });
      expect(r.total).toBe(1);
      expect(r.data[0].name).toBe("Billing");
    });

    it("search by key substring filters results", async () => {
      const r = await service.listDepartments({ search: "eng" });
      expect(r.total).toBeGreaterThanOrEqual(1);
      const hasEng = r.data.some((d: any) => d.key === "ENG");
      expect(hasEng).toBe(true);
    });

    it("search is case-insensitive", async () => {
      const upper = await service.listDepartments({ search: "ENGINEERING" });
      const lower = await service.listDepartments({ search: "engineering" });
      expect(upper.total).toBe(lower.total);
    });

    it("isActive=true returns only active depts (excludes Inactive Dept)", async () => {
      const r = await service.listDepartments({ isActive: true });
      expect(r.total).toBe(2);
      const ids = r.data.map((d: any) => d.id);
      expect(ids).not.toContain("dept-inactive");
    });

    it("isActive=false returns only inactive depts", async () => {
      const r = await service.listDepartments({ isActive: false });
      expect(r.total).toBe(1);
      expect(r.data[0].id).toBe("dept-inactive");
    });

    it("excludes soft-deleted depts by default (deletedAt filter)", async () => {
      prisma.departments[0].deletedAt = new Date();
      const r = await service.listDepartments();
      expect(r.total).toBe(2);
      const ids = r.data.map((d: any) => d.id);
      expect(ids).not.toContain("dept-eng");
    });

    it("includeDeleted=true shows soft-deleted depts too", async () => {
      prisma.departments[0].deletedAt = new Date();
      const r = await service.listDepartments({ includeDeleted: true });
      expect(r.total).toBe(3);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────────
  // D3 — list unknown search returns empty
  // ──────────────────────────────────────────────────────────────────────────────
  describe("D3 — listDepartments unknown search returns empty", () => {
    it("nonexistent keyword returns data=[] and total=0", async () => {
      const r = await service.listDepartments({ search: "ZZZZ-NOPE-XYZ" });
      expect(r.total).toBe(0);
      expect(r.data).toEqual([]);
    });

    it("search with random uuid-like string returns empty", async () => {
      const r = await service.listDepartments({ search: "a1b2c3d4-e5f6-7890" });
      expect(r.total).toBe(0);
      expect(r.data.length).toBe(0);
    });

    it("empty search with isActive mismatch returns empty too", async () => {
      prisma.departments = [];
      const r = await service.listDepartments({ search: "" });
      expect(r.total).toBe(0);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────────
  // D4 — create → patch rename → DELETE archive → POST restore
  // ──────────────────────────────────────────────────────────────────────────────
  describe("D4 — Department lifecycle: create → patch → DELETE → restore", () => {
    it("creates with uppercase key, isActive=true, headId; then patch rename; then DELETE archives (soft delete); then POST restore. Verify deletedAt changes.", async () => {
      // Step 1: create with uppercase isActive=true and headId
      const created = await service.createDepartment({
        key: "LEGAL",
        name: "Legal Department",
        headId: "u-alice",
        isActive: true,
      });
      expect(created.key).toBe("LEGAL");
      expect(created.name).toBe("Legal Department");
      expect(created.headId).toBe("u-alice");
      expect(created.isActive).toBe(true);
      expect(created.deletedAt).toBeNull();

      const deptId = created.id;

      // Step 2: patch rename
      const patched = await service.updateDepartment(deptId, {
        name: "Legal & Compliance",
      });
      expect(patched.name).toBe("Legal & Compliance");
      expect(patched.deletedAt).toBeNull();
      expect(patched.isActive).toBe(true);

      // Step 3: DELETE (soft delete / archive)
      const deleted = await service.deleteDepartment(deptId);
      expect(deleted.deletedAt).not.toBeNull();
      expect(deleted.isActive).toBe(false);

      // Verify deletedAt was actually changed in storage
      const storedDeleted = prisma.departments.find((d) => d.id === deptId);
      expect(storedDeleted?.deletedAt).not.toBeNull();
      expect(storedDeleted?.isActive).toBe(false);

      // Verify list no longer shows it
      const listAfterDelete = await service.listDepartments();
      const stillVisible = listAfterDelete.data.some((d: any) => d.id === deptId);
      expect(stillVisible).toBe(false);

      // Step 4: POST restore
      const restored = await (service as any).restoreDepartment(deptId);
      expect(restored.deletedAt).toBeNull();
      expect(restored.isActive).toBe(true);

      // Verify stored state after restore
      const storedRestored = prisma.departments.find((d) => d.id === deptId);
      expect(storedRestored?.deletedAt).toBeNull();
      expect(storedRestored?.isActive).toBe(true);

      // Verify visible again
      const listAfterRestore = await service.listDepartments();
      const visibleAgain = listAfterRestore.data.some((d: any) => d.id === deptId);
      expect(visibleAgain).toBe(true);
    });

    it("DELETE already-deleted dept throws NotFoundException", async () => {
      const created = await service.createDepartment({
        key: "TEMP", name: "Temporary",
      });
      await service.deleteDepartment(created.id);
      await expect(service.deleteDepartment(created.id)).rejects.toThrow(NotFoundException);
    });

    it("restore on non-archived dept throws ConflictException", async () => {
      const created = await service.createDepartment({
        key: "ALIVE", name: "Still Alive",
      });
      await expect(
        (service as any).restoreDepartment(created.id),
      ).rejects.toThrow(ConflictException);
    });

    it("restore on nonexistent dept throws NotFoundException", async () => {
      await expect(
        (service as any).restoreDepartment("does-not-exist"),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────────
  // D5 — dept-detail returns teamCount, agentCount, ticket counts
  // ──────────────────────────────────────────────────────────────────────────────
  describe("D5 — getDepartment returns teamCount, agentCount, ticket counts", () => {
    it("ENG dept returns teamCount=2, agentCount=2, ticketCount includes all tickets", async () => {
      const dept = await service.getDepartment("dept-eng") as any;
      expect(dept.id).toBe("dept-eng");

      // teams list
      expect(dept.teams).toBeDefined();
      expect(Array.isArray(dept.teams)).toBe(true);
      expect(dept.teams.length).toBe(2);

      // rollup counts
      expect(dept._count).toBeDefined();
      expect(dept._count.teams).toBe(2);
      expect(dept._count.agents).toBe(2);
      expect(dept._count.tickets).toBeGreaterThanOrEqual(1);

      // Named counters exposed for convenience
      expect(dept.teamCount).toBeDefined();
      expect(dept.teamCount).toBe(2);
      expect(dept.agentCount).toBe(2);
      expect(dept.ticketCount).toBeDefined();
      expect(typeof dept.ticketCount).toBe("number");
    });

    it("Billing dept: teamCount=1, agentCount=1", async () => {
      const dept = await service.getDepartment("dept-billing") as any;
      expect(dept.teamCount).toBe(1);
      expect(dept.agentCount).toBe(1);
      expect(dept._count.tickets).toBeGreaterThanOrEqual(1);
    });

    it("includes head user object when headId is set", async () => {
      const dept = await service.getDepartment("dept-eng") as any;
      expect(dept.head).toBeDefined();
      expect(dept.head?.id).toBe("u-alice");
      expect(dept.head?.name).toBe("Alice Head");
    });

    it("throws NotFoundException for nonexistent dept", async () => {
      await expect(service.getDepartment("dept-nope")).rejects.toThrow(NotFoundException);
    });

    it("throws NotFoundException for soft-deleted dept", async () => {
      prisma.departments[0].deletedAt = new Date();
      await expect(service.getDepartment("dept-eng")).rejects.toThrow(NotFoundException);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────────
  // T1 — Create team fails when departmentId missing or invalid
  // ──────────────────────────────────────────────────────────────────────────────
  describe("T1 — createTeam fails when departmentId missing or invalid", () => {
    it("throws when departmentId is missing entirely", async () => {
      await expect(
        service.createTeam({ name: "Orphan Team" } as any),
      ).rejects.toThrow();
    });

    it("throws when departmentId references nonexistent dept (NotFoundException)", async () => {
      await expect(
        service.createTeam({ departmentId: "dept-ghost", name: "Team X" }),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws when departmentId references a soft-deleted dept", async () => {
      prisma.departments[0].deletedAt = new Date();
      await expect(
        service.createTeam({ departmentId: "dept-eng", name: "Team Y" }),
      ).rejects.toThrow(NotFoundException);
    });

    it("succeeds with valid, non-deleted departmentId", async () => {
      const team = await service.createTeam({
        departmentId: "dept-eng",
        name: "Web Frontend",
      });
      expect(team.departmentId).toBe("dept-eng");
      expect(team.name).toBe("Web Frontend");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────────
  // T2 — Create team requires departmentId pointing to ACTIVE dept
  // ──────────────────────────────────────────────────────────────────────────────
  describe("T2 — createTeam requires departmentId pointing to active dept", () => {
    it("throws when department exists but isActive=false", async () => {
      await expect(
        service.createTeam({ departmentId: "dept-inactive", name: "Team Noop" }),
      ).rejects.toThrow(BadRequestException);
    });

    it("allows creation on active dept (ENG, BILLING are active)", async () => {
      const t1 = await service.createTeam({
        departmentId: "dept-eng", name: "Backend Squad",
      });
      const t2 = await service.createTeam({
        departmentId: "dept-billing", name: "Refunds Team",
      });
      expect(t1.id).toBeDefined();
      expect(t2.id).toBeDefined();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────────
  // T3 — Patch team changes leadId/name, archive team, restore team
  // ──────────────────────────────────────────────────────────────────────────────
  describe("T3 — Patch team: leadId/name, archive, restore", () => {
    it("patch updates name and leadId", async () => {
      const before = await service.getTeam("team-mobile") as any;
      expect(before.leadId).toBeNull();

      const patched = await service.updateTeam("team-mobile", {
        name: "Mobile & Apps Support",
        leadId: "u-eve",
      }) as any;

      expect(patched.name).toBe("Mobile & Apps Support");
      expect(patched.leadId).toBe("u-eve");
    });

    it("archive (DELETE) team: sets deletedAt and isActive=false", async () => {
      const deleted = await service.deleteTeam("team-api") as any;
      expect(deleted.deletedAt).not.toBeNull();
      expect(deleted.isActive).toBe(false);

      const list = await service.listTeams();
      const visible = list.data.some((t: any) => t.id === "team-api");
      expect(visible).toBe(false);
    });

    it("restore team: clears deletedAt and sets isActive=true", async () => {
      await service.deleteTeam("team-api");
      const restored = await (service as any).restoreTeam("team-api") as any;
      expect(restored.deletedAt).toBeNull();
      expect(restored.isActive).toBe(true);

      const list = await service.listTeams();
      const visible = list.data.some((t: any) => t.id === "team-api");
      expect(visible).toBe(true);
    });

    it("delete already-archived team throws NotFoundException", async () => {
      await service.deleteTeam("team-api");
      await expect(service.deleteTeam("team-api")).rejects.toThrow(NotFoundException);
    });

    it("restore non-archived team throws ConflictException", async () => {
      await expect(
        (service as any).restoreTeam("team-mobile"),
      ).rejects.toThrow(ConflictException);
    });

    it("patch on nonexistent team throws NotFoundException", async () => {
      await expect(
        service.updateTeam("team-ghost", { name: "nope" }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────────
  // T4 — Delete dept with active teams → orphan-safe (no cascade)
  // ──────────────────────────────────────────────────────────────────────────────
  describe("T4 — Delete department with active teams → orphan-safe (no cascade)", () => {
    it("soft-deleting dept does NOT delete or archive its teams (teams remain intact)", async () => {
      // Before: verify ENG dept has 2 active teams
      const teamsBefore = prisma.teams.filter(
        (t) => t.departmentId === "dept-eng",
      );
      expect(teamsBefore.length).toBe(2);
      teamsBefore.forEach((t) => {
        expect(t.deletedAt).toBeNull();
        expect(t.isActive).toBe(true);
      });

      // Delete the department
      await service.deleteDepartment("dept-eng");

      // Verify dept is gone (soft deleted)
      const dept = prisma.departments.find((d) => d.id === "dept-eng");
      expect(dept?.deletedAt).not.toBeNull();

      // Verify teams are NOT cascade-deleted
      const teamsAfter = prisma.teams.filter(
        (t) => t.departmentId === "dept-eng",
      );
      expect(teamsAfter.length).toBe(2); // same count
      teamsAfter.forEach((t) => {
        expect(t.deletedAt).toBeNull(); // NOT cascade deleted
        expect(t.isActive).toBe(true);   // still active (orphan-safe)
      });

      // Verify listTeams still shows them
      const list = await service.listTeams({ departmentId: "dept-eng" });
      expect(list.total).toBe(2);
    });

    it("teams remain queryable independently after parent dept is archived", async () => {
      await service.deleteDepartment("dept-eng");
      // Each team by direct ID still accessible
      const api = await prisma.supportTeam.findUnique({ where: { id: "team-api" } });
      const mobile = await prisma.supportTeam.findUnique({ where: { id: "team-mobile" } });
      expect(api).not.toBeNull();
      expect(mobile).not.toBeNull();
      expect(api?.deletedAt).toBeNull();
      expect(mobile?.deletedAt).toBeNull();
    });

    it("route inventory: departmentId on tickets remains intact after dept delete", async () => {
      const ticketsBefore = prisma.tickets.filter(
        (t) => t.departmentId === "dept-eng",
      );
      const ticketIds = ticketsBefore.map((t) => t.id);
      expect(ticketIds.length).toBeGreaterThanOrEqual(1);

      await service.deleteDepartment("dept-eng");

      // Tickets still reference the (now archived) deptId — no cascade
      for (const tid of ticketIds) {
        const ticket = prisma.tickets.find((t) => t.id === tid);
        expect(ticket?.departmentId).toBe("dept-eng");
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────────────────
  // T5 — duplicate team name WITHIN same department → 409/422 (conflict)
  // ──────────────────────────────────────────────────────────────────────────────
  describe("T5 — duplicate team name WITHIN same department → 409/422", () => {
    it("re-creating 'API Support' in ENG dept → ConflictException (409 style)", async () => {
      await expect(
        service.createTeam({
          departmentId: "dept-eng",
          name: "API Support",
        }),
      ).rejects.toThrow(ConflictException);
    });

    it("same name in DIFFERENT department → allowed (no conflict)", async () => {
      // "API Support" exists in ENG; creating it in Billing is fine
      const created = await service.createTeam({
        departmentId: "dept-billing",
        name: "API Support",
      });
      expect(created.id).toBeDefined();
      expect(created.departmentId).toBe("dept-billing");
    });

    it("case-sensitive — same name after trim is still a conflict", async () => {
      // Leading/trailing whitespace is trimmed; "Payments Team " matches existing
      await expect(
        service.createTeam({
          departmentId: "dept-billing",
          name: "  Payments Team  ",
        }),
      ).rejects.toThrow(ConflictException);
    });

    it("after deleting original team, same name can be re-created in same dept", async () => {
      await service.deleteTeam("team-api"); // archive "API Support"

      // Now same name should work because the original is soft-deleted
      const recreated = await service.createTeam({
        departmentId: "dept-eng",
        name: "API Support",
      });
      expect(recreated.id).not.toBe("team-api"); // different row
      expect(recreated.name).toBe("API Support");
      expect(recreated.deletedAt).toBeNull();
    });
  });
});
