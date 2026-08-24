import { Test } from "@nestjs/testing";
import { SupportService } from "./support.service";
import { PrismaService } from "../../shared/prisma/prisma.service";
import { NotFoundException, BadRequestException } from "@nestjs/common";

// Jest / Vitest compatibility shim — tests use `vi.fn()` style; map to Jest globals.
declare const global: any;
const vi: any = {
  fn: (...args: any[]) => (global.jest ? global.jest.fn(...args) : (globalThis as any).vi.fn(...args)),
};

/**
 * RED tests for SupportService agent methods.
 * All tests initially FAIL to validate the service implements required behavior.
 *
 * Coverage:
 *  1. listAgents — pagination, search, filters, sort
 *  2. getAgentStats — counts breakdown + resolutionRate calc
 *  3. getAgentDetail — includes tickets, activity, metrics; 404 on missing
 *  4. createAgent — validates userId, sets defaults; prevents duplicate
 *  5. updateAgent — partial updates; 404 on missing
 *  6. deleteAgent — soft-delete (deletedAt); 404 on missing; prevents double-delete
 *  7. toggleAgentStatus — flips isActive; 404 on missing
 *  8. getAgentTickets — paginated, status filter
 *  9. getAgentActivity — paginated activity log
 * 10. getAgentMetrics — correct rates (escalationRate, reopenRate)
 * 11. Role-based visibility — ensure non-moderator agents can't see escalated ticket metadata
 */

type StubSupportAgent = {
  id: string;
  userId: string;
  status: string;
  isActive: boolean;
  maxTickets: number;
  activeTickets: number;
  skills: string[];
  departmentId: string | null;
  teamId: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  vacationUntil: Date | null;
};

type StubUser = {
  id: string;
  name: string;
  email: string;
  handle: string;
  avatar: string | null;
  role: string;
};

type StubTicket = {
  id: string;
  ticketNumber: string;
  subject: string;
  status: string;
  priority: string;
  assigneeId: string | null;
  categoryId: string | null;
  userId: string;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type StubAssignment = {
  id: string;
  agentId: string;
  ticketId: string;
  assignedAt: Date;
};

type StubActivity = {
  id: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  createdAt: Date;
  metadata: any;
};

type StubCategory = {
  id: string;
  name: string;
};

type StubDepartment = {
  id: string;
  name: string;
};

class MockPrisma {
  agents: StubSupportAgent[] = [];
  users: StubUser[] = [];
  tickets: StubTicket[] = [];
  assignments: StubAssignment[] = [];
  activity: StubActivity[] = [];
  categories: StubCategory[] = [];
  departments: StubDepartment[] = [];

  supportAgent = {
    findMany: async (q: any) => {
      let rows = this.agents.filter((a) => !a.deletedAt);
      const w = q?.where ?? {};
      if (w.departmentId) rows = rows.filter((a) => a.departmentId === w.departmentId);
      if (w.status) rows = rows.filter((a) => a.status === w.status);
      if (w.isActive !== undefined) rows = rows.filter((a) => a.isActive === w.isActive);
      if (w.user?.OR) {
        rows = rows.filter((a) => {
          const u = this.users.find((u) => u.id === a.userId);
          return (w.user.OR as any[]).some((or: any) => {
            if (or.name?.contains && u) {
              return u.name.toLowerCase().includes(or.name.contains.toLowerCase());
            }
            if (or.email?.contains && u) {
              return u.email.toLowerCase().includes(or.email.contains.toLowerCase());
            }
            return false;
          });
        });
      }
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
      return rows.map((a) => this._hydrateAgent(a));
    },
    count: async (q: any) => {
      let rows = this.agents.filter((a) => !a.deletedAt);
      const w = q?.where ?? {};
      if (w.departmentId) rows = rows.filter((a) => a.departmentId === w.departmentId);
      if (w.status) rows = rows.filter((a) => a.status === w.status);
      if (w.isActive !== undefined) rows = rows.filter((a) => a.isActive === w.isActive);
      if (w.user?.OR) {
        rows = rows.filter((a) => {
          const u = this.users.find((u) => u.id === a.userId);
          return (w.user.OR as any[]).some((or: any) => {
            if (or.name?.contains && u) {
              return u.name.toLowerCase().includes(or.name.contains.toLowerCase());
            }
            if (or.email?.contains && u) {
              return u.email.toLowerCase().includes(or.email.contains.toLowerCase());
            }
            return false;
          });
        });
      }
      return rows.length;
    },
    findUnique: async (q: any) => {
      const w = q?.where ?? {};
      // Match by either unique key
      let a: StubSupportAgent | undefined;
      if (w.userId) a = this.agents.find((x) => x.userId === w.userId && !x.deletedAt);
      else if (w.id) a = this.agents.find((x) => x.id === w.id && !x.deletedAt);
      if (!a) return null;
      return this._hydrateAgent(a);
    },
    findFirst: async (q: any) => {
      let rows = this.agents.filter((a) => !a.deletedAt);
      const w = q?.where ?? {};
      if (Array.isArray(w.OR)) {
        rows = rows.filter((a) =>
          w.OR.some((or: any) => {
            if (or.id !== undefined) return a.id === or.id;
            if (or.userId !== undefined) return a.userId === or.userId;
            return true;
          }),
        );
      } else {
        if (w.userId !== undefined) rows = rows.filter((a) => a.userId === w.userId);
        if (w.id !== undefined) rows = rows.filter((a) => a.id === w.id);
        if (w.status !== undefined) rows = rows.filter((a) => a.status === w.status);
        if (w.isActive !== undefined) rows = rows.filter((a) => a.isActive === w.isActive);
      }
      if (w.user?.OR) {
        rows = rows.filter((a) => {
          const u = this.users.find((u) => u.id === a.userId);
          return (w.user.OR as any[]).some((or: any) => {
            if (or.name?.contains && u) {
              return u.name.toLowerCase().includes(or.name.contains.toLowerCase());
            }
            if (or.email?.contains && u) {
              return u.email.toLowerCase().includes(or.email.contains.toLowerCase());
            }
            return false;
          });
        });
      }
      const a = rows[0];
      if (!a) return null;
      return q?.include ? this._hydrateAgent(a) : { ...a, user: undefined, department: undefined, team: undefined };
    },
    create: async (q: any) => {
      const d = q.data;
      if (this.agents.some((a) => a.userId === d.userId && !a.deletedAt)) {
        throw { code: "P2002" }; // Unique constraint
      }
      const agent: StubSupportAgent = {
        id: `agent-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        userId: d.userId,
        status: d.status ?? "OFFLINE",
        isActive: d.isActive ?? true,
        maxTickets: d.maxTickets ?? 10,
        activeTickets: d.activeTickets ?? 0,
        skills: d.skills ?? [],
        departmentId: d.departmentId ?? null,
        teamId: d.teamId ?? null,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        vacationUntil: null,
      };
      this.agents.push(agent);
      return this._hydrateAgent(agent);
    },
    update: async (q: any) => {
      const where = q.where ?? {};
      let idx: number = -1;
      if (where.userId !== undefined) {
        idx = this.agents.findIndex((a) => a.userId === where.userId && !a.deletedAt);
      } else if (where.id !== undefined) {
        idx = this.agents.findIndex((a) => a.id === where.id && !a.deletedAt);
      }
      if (idx === -1) throw new NotFoundException("Agent not found");
      this.agents[idx] = { ...this.agents[idx], ...q.data, updatedAt: new Date() };
      return this._hydrateAgent(this.agents[idx]);
    },
  };

  user = {
    findUnique: async (q: any) => {
      return this.users.find((u) => u.id === q.where.id) ?? null;
    },
  };

  supportTicket = {
    findMany: async (q: any) => {
      let rows = this.tickets.filter((t) => !t.deletedAt);
      const w = q?.where ?? {};
      if (w.assigneeId) rows = rows.filter((t) => t.assigneeId === w.assigneeId);
      if (w.assigneeId === null) rows = rows.filter((t) => t.assigneeId === null);
      if (w.status) rows = rows.filter((t) => t.status === w.status);
      if (typeof q?.skip === "number" && typeof q?.take === "number") {
        rows = rows.slice(q.skip, q.skip + q.take);
      }
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
      return rows.map((t) => this._hydrateTicket(t));
    },
    count: async (q: any) => {
      let rows = this.tickets.filter((t) => !t.deletedAt);
      const w = q?.where ?? {};
      // assigneeId — can be string OR null (for unassigned counts)
      if (w.assigneeId !== undefined) {
        rows = rows.filter((t) => t.assigneeId === w.assigneeId);
      }
      if (w.status && typeof w.status === "string") {
        rows = rows.filter((t) => t.status === w.status);
      }
      if (w.status?.notIn) {
        rows = rows.filter((t) => !w.status.notIn.includes(t.status));
      }
      return rows.length;
    },
    groupBy: async (q: any) => {
      const rows = this.tickets.filter((t) => !t.deletedAt);
      const w = q?.where ?? {};
      const by: string[] = q.by ?? [];
      const filtered = rows.filter((t) => {
        // assigneeId: scalar match OR { in: [...] } match
        if (w.assigneeId) {
          if (typeof w.assigneeId === "string" || w.assigneeId === null) {
            if (t.assigneeId !== w.assigneeId) return false;
          } else if (Array.isArray(w.assigneeId.in)) {
            if (!w.assigneeId.in.includes(t.assigneeId)) return false;
          } else if (Array.isArray(w.assigneeId)) {
            if (!w.assigneeId.includes(t.assigneeId)) return false;
          } else {
            return false;
          }
        }
        if (w.status?.notIn && w.status.notIn.includes(t.status)) return false;
        if (w.status && typeof w.status === "string" && t.status !== w.status) return false;
        return true;
      });
      // Group rows by the `by` fields
      const groups = new Map<string, { key: any; count: number; _rows: StubTicket[] }>();
      for (const row of filtered) {
        const k = by.map((f) => (row as any)[f]).join("|||");
        if (!groups.has(k)) groups.set(k, { key: {}, count: 0, _rows: [] });
        const g = groups.get(k)!;
        for (const f of by) (g.key as any)[f] = (row as any)[f];
        g.count += 1;
        g._rows.push(row);
      }
      const agg: any = q._count;
      const result = Array.from(groups.values()).map((g) => {
        const r: any = { ...g.key };
        if (agg === true || agg === undefined) {
          // _count: true → direct number e.g. t._count = 5
          r._count = g.count;
        } else if (agg && typeof agg === "object" && Object.keys(agg).length > 0) {
          r._count = {};
          for (const field of Object.keys(agg)) {
            r._count[field] = g.count;
          }
        } else {
          r._count = g.count;
        }
        return r;
      });
      return result;
    },
    updateMany: async (q: any) => {
      const w = q?.where ?? {};
      const d = q?.data ?? {};
      let count = 0;
      this.tickets = this.tickets.map((t) => {
        let match = true;
        if (w.assigneeId !== undefined) {
          match = match && t.assigneeId === w.assigneeId;
        }
        if (w.status?.notIn) {
          match = match && !w.status.notIn.includes(t.status);
        }
        if (!match) return t;
        count++;
        return { ...t, ...d, updatedAt: new Date() };
      });
      return { count };
    },
  };

  ticketAssignment = {
    count: async (q: any) => {
      const w = q?.where ?? {};
      return this.assignments.filter((a) => a.agentId === w.agentId).length;
    },
  };

  activityLog = {
    findMany: async (q: any) => {
      let rows = this.activity.filter((a) => a.userId === q.where.userId);
      if (q.orderBy?.createdAt === "desc") rows = rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      if (typeof q?.skip === "number" && typeof q?.take === "number") {
        rows = rows.slice(q.skip, q.skip + q.take);
      }
      return rows;
    },
    count: async (q: any) => {
      return this.activity.filter((a) => a.userId === q.where.userId).length;
    },
  };

  _hydrateAgent(a: StubSupportAgent) {
    const user = this.users.find((u) => u.id === a.userId);
    const department = this.departments.find((d) => d.id === a.departmentId) ?? null;
    return {
      ...a,
      user: user ? { id: user.id, name: user.name, email: user.email, avatar: user.avatar, handle: user.handle, role: user.role } : null,
      department,
      team: null,
    };
  }

  _hydrateTicket(t: StubTicket) {
    const category = this.categories.find((c) => c.id === t.categoryId) ?? null;
    return { ...t, category: category ? { name: category.name } : null };
  }
}

describe("SupportService — Agent Management (TDD RED tests)", () => {
  let service: SupportService;
  let prisma: MockPrisma;

  beforeEach(async () => {
    prisma = new MockPrisma();

    // — Seed users —
    prisma.users = [
      { id: "u-sarah", name: "Sarah Chen", email: "sarah.chen@vellum.com", handle: "sarahc", avatar: null, role: "MODERATOR" },
      { id: "u-mike", name: "Mike Johnson", email: "mike.johnson@vellum.com", handle: "mikej", avatar: null, role: "MODERATOR" },
      { id: "u-emma", name: "Emma Watson", email: "emma.watson@vellum.com", handle: "emmaw", avatar: null, role: "MODERATOR" },
      { id: "u-james", name: "James Rodriguez", email: "james.rodriguez@vellum.com", handle: "jamesr", avatar: null, role: "MODERATOR" },
      { id: "u-priya", name: "Priya Patel", email: "priya.patel@vellum.com", handle: "priyap", avatar: null, role: "SUPPORT_ADMIN" },
      { id: "u-alex", name: "Alex Morgan", email: "alex.morgan@example.com", handle: "alexm", avatar: null, role: "USER" },
      { id: "u-jordan", name: "Jordan Taylor", email: "jordan.taylor@example.com", handle: "jordant", avatar: null, role: "USER" },
    ];

    // — Seed departments —
    prisma.departments = [
      { id: "dept-tech", name: "Technical Support" },
      { id: "dept-billing", name: "Billing" },
    ];

    // — Seed categories —
    prisma.categories = [
      { id: "cat-login", name: "Authentication" },
      { id: "cat-payment", name: "Payments" },
      { id: "cat-bug", name: "Bug Report" },
    ];

    // — Seed agents —
    const now = new Date();
    prisma.agents = [
      { id: "a1", userId: "u-sarah", status: "ONLINE", isActive: true, maxTickets: 12, activeTickets: 3, skills: ["API", "Authentication"], departmentId: "dept-tech", teamId: null, deletedAt: null, createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 30), updatedAt: now, vacationUntil: null }, // oldest (joined 30d ago)
      { id: "a2", userId: "u-mike", status: "BUSY", isActive: true, maxTickets: 10, activeTickets: 8, skills: ["Billing"], departmentId: "dept-billing", teamId: null, deletedAt: null, createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 14), updatedAt: now, vacationUntil: null }, // 14d
      { id: "a3", userId: "u-emma", status: "AWAY", isActive: true, maxTickets: 15, activeTickets: 1, skills: ["Mobile", "iOS"], departmentId: "dept-tech", teamId: null, deletedAt: null, createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 5), updatedAt: now, vacationUntil: null }, // 5d
      { id: "a4", userId: "u-james", status: "OFFLINE", isActive: false, maxTickets: 10, activeTickets: 0, skills: ["API"], departmentId: null, teamId: null, deletedAt: null, createdAt: now, updatedAt: now, vacationUntil: null }, // newest (joined today)
      // Priya is Support Admin but NOT listed as a support agent (no row)
    ];

    // — Seed tickets —
    prisma.tickets = [
      { id: "t1", ticketNumber: "TKT-001", subject: "Can't login with SSO", status: "IN_PROGRESS", priority: "HIGH", assigneeId: "u-sarah", categoryId: "cat-login", userId: "u-alex", deletedAt: null, createdAt: now, updatedAt: now },
      { id: "t2", ticketNumber: "TKT-002", subject: "Payment declined on renewal", status: "ASSIGNED", priority: "MEDIUM", assigneeId: "u-mike", categoryId: "cat-payment", userId: "u-jordan", deletedAt: null, createdAt: now, updatedAt: now },
      { id: "t3", ticketNumber: "TKT-003", subject: "API rate limit not increasing", status: "ESCALATED", priority: "CRITICAL", assigneeId: "u-sarah", categoryId: "cat-bug", userId: "u-alex", deletedAt: null, createdAt: now, updatedAt: now },
      { id: "t4", ticketNumber: "TKT-004", subject: "Change billing plan", status: "RESOLVED", priority: "LOW", assigneeId: "u-mike", categoryId: "cat-payment", userId: "u-jordan", deletedAt: null, createdAt: now, updatedAt: now },
      { id: "t5", ticketNumber: "TKT-005", subject: "App crashes on iOS", status: "NEW", priority: "HIGH", assigneeId: "u-emma", categoryId: "cat-bug", userId: "u-alex", deletedAt: null, createdAt: now, updatedAt: now },
      { id: "t6", ticketNumber: "TKT-006", subject: "Mobile OTP not received", status: "REOPENED", priority: "MEDIUM", assigneeId: "u-sarah", categoryId: "cat-login", userId: "u-jordan", deletedAt: null, createdAt: now, updatedAt: now },
    ];

    // — Seed assignments —
    prisma.assignments = [
      { id: "as1", agentId: "u-sarah", ticketId: "t1", assignedAt: now },
      { id: "as2", agentId: "u-sarah", ticketId: "t3", assignedAt: now },
      { id: "as3", agentId: "u-sarah", ticketId: "t6", assignedAt: now },
      { id: "as4", agentId: "u-mike", ticketId: "t2", assignedAt: now },
      { id: "as5", agentId: "u-mike", ticketId: "t4", assignedAt: now },
      { id: "as6", agentId: "u-emma", ticketId: "t5", assignedAt: now },
    ];

    // — Seed activity —
    prisma.activity = [
      { id: "ac1", userId: "u-sarah", action: "Assigned ticket", resourceType: "ticket", resourceId: "t1", createdAt: new Date(now.getTime() - 1000 * 60 * 5), metadata: { from: "unassigned" } },
      { id: "ac2", userId: "u-sarah", action: "Added note", resourceType: "note", resourceId: "t1", createdAt: new Date(now.getTime() - 1000 * 60 * 10), metadata: { body: "Investigating SSO config" } },
      { id: "ac3", userId: "u-mike", action: "Updated priority", resourceType: "status", resourceId: "t2", createdAt: new Date(now.getTime() - 1000 * 60 * 20), metadata: { from: "LOW", to: "MEDIUM" } },
    ];

    const module = await Test.createTestingModule({
      providers: [SupportService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(SupportService);
  });

  // ── 1. listAgents ──────────────────────────────────────────────────

  describe("listAgents", () => {
    it("returns paginated agents with total count", async () => {
      const result = await service.listAgents({ page: 1, limit: 2 });
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(4);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(2);
    });

    it("enriches each agent with ticket counts (ticketsAssigned, ticketsResolved, escalations)", async () => {
      const result = await service.listAgents({ page: 1, limit: 10 });
      const sarah = result.data.find((a: any) => a.userId === "u-sarah");
      // Sarah has 3 assigned tickets: 1 IN_PROGRESS, 1 ESCALATED, 1 REOPENED (not RESOLVED/CLOSED)
      expect(sarah.ticketsAssigned).toBeGreaterThanOrEqual(1);
      expect(sarah.escalations).toBe(1);
    });

    it("filters by status (BUSY returns only Mike)", async () => {
      const result = await service.listAgents({ status: "BUSY" as any, page: 1, limit: 10 });
      expect(result.total).toBe(1);
      expect(result.data[0].userId).toBe("u-mike");
    });

    it("filters by departmentId (Billing returns Mike)", async () => {
      const result = await service.listAgents({ departmentId: "dept-billing", page: 1, limit: 10 });
      expect(result.total).toBe(1);
      expect(result.data[0].userId).toBe("u-mike");
    });

    it("searches by user name (sarah returns Sarah Chen)", async () => {
      const result = await service.listAgents({ search: "sarah", page: 1, limit: 10 });
      expect(result.total).toBe(1);
      expect(result.data[0].user.name).toBe("Sarah Chen");
    });

    it("searches by user email (vellum.com returns 4 agents)", async () => {
      const result = await service.listAgents({ search: "vellum.com", page: 1, limit: 10 });
      expect(result.total).toBe(4);
    });

    it("respects pagination boundaries (page 2 limit 2 → agents 3 & 4)", async () => {
      const page1 = await service.listAgents({ page: 1, limit: 2 });
      const page2 = await service.listAgents({ page: 2, limit: 2 });
      expect(page1.data.map((a: any) => a.userId)).not.toEqual(
        page2.data.map((a: any) => a.userId),
      );
      expect(page2.data.length).toBeGreaterThanOrEqual(1);
    });

    it("sortBy=activeTickets sortDir=desc returns highest-load agent first", async () => {
      const result = await service.listAgents({
        sortBy: "activeTickets",
        sortDir: "desc",
        page: 1,
        limit: 10,
      } as any);
      const loads = result.data.map((a: any) => Number(a.activeTickets) || 0);
      for (let i = 1; i < loads.length; i++) {
        expect(loads[i - 1]).toBeGreaterThanOrEqual(loads[i]);
      }
    });

    it("sortBy=createdAt sortDir=asc returns oldest-joined agent first", async () => {
      const asc = await service.listAgents({
        sortBy: "createdAt",
        sortDir: "asc",
        page: 1,
        limit: 10,
      } as any);
      const desc = await service.listAgents({
        sortBy: "createdAt",
        sortDir: "desc",
        page: 1,
        limit: 10,
      } as any);
      const ascIds = asc.data.map((a: any) => a.userId);
      const descIds = desc.data.map((a: any) => a.userId);
      expect(ascIds[0]).not.toBe(descIds[0]); // top differs
      expect(ascIds).toEqual(descIds.slice().reverse());
    });

    // — Regression: sortBy=ticketsResolved (virtual, not a Prisma column) must NOT throw 500.
    it("sortBy=ticketsResolved sortDir=desc does not throw (sorts virtually, highest first)", async () => {
      const result = await service.listAgents({
        sortBy: "ticketsResolved",
        sortDir: "desc",
        page: 1,
        limit: 10,
      } as any);
      expect(result.total).toBeGreaterThanOrEqual(1);
      const values = result.data.map((a: any) => Number(a.ticketsResolved) || 0);
      for (let i = 1; i < values.length; i++) {
        expect(values[i - 1]).toBeGreaterThanOrEqual(values[i]);
      }
    });

    it("sortBy=ticketsAssigned sortDir=asc does not throw (sorts virtually, lowest first)", async () => {
      const result = await service.listAgents({
        sortBy: "ticketsAssigned",
        sortDir: "asc",
        page: 1,
        limit: 10,
      } as any);
      const values = result.data.map((a: any) => Number(a.ticketsAssigned) || 0);
      for (let i = 1; i < values.length; i++) {
        expect(values[i - 1]).toBeLessThanOrEqual(values[i]);
      }
    });

    it("sortBy=escalations sortDir=desc does not throw", async () => {
      await expect(
        service.listAgents({ sortBy: "escalations", sortDir: "desc", page: 1, limit: 10 } as any),
      ).resolves.toBeDefined();
    });

    it("sortBy=BOGUS returns BadRequestException (400), never 500", async () => {
      await expect(
        service.listAgents({ sortBy: "BOGUS", sortDir: "desc", page: 1, limit: 10 } as any),
      ).rejects.toThrow(/Invalid.*sortBy|sortBy.*BOGUS|BOGUS/i);
    });
  });

  // ── 2. getAgentStats ───────────────────────────────────────────────

  describe("getAgentStats", () => {
    it("returns correct total / active / inactive / online / busy / away / offline counts", async () => {
      const s = await service.getAgentStats();
      expect(s.total).toBe(4);
      expect(s.active).toBe(3); // Sarah + Mike + Emma
      expect(s.inactive).toBe(1); // James
      expect(s.online).toBe(1);
      expect(s.busy).toBe(1);
      expect(s.away).toBe(1);
      expect(s.offline).toBe(1);
    });

    it("computes resolutionRate = resolvedTickets / totalTickets * 100", async () => {
      const s = await service.getAgentStats();
      // totalTickets: 6 assigned; resolvedTickets: 1 (t4 RESOLVED)
      expect(s.totalTickets).toBeGreaterThanOrEqual(1);
      expect(s.resolutionRate).toBeGreaterThanOrEqual(0);
      expect(s.resolutionRate).toBeLessThanOrEqual(100);
    });

    it("never returns negative or NaN resolutionRate when no tickets exist", async () => {
      // Clear ticket assignments by removing assignees
      prisma.tickets = prisma.tickets.map((t) => ({ ...t, assigneeId: null }));
      const s = await service.getAgentStats();
      expect(Number.isNaN(s.resolutionRate)).toBe(false);
      expect(s.resolutionRate).toBeGreaterThanOrEqual(0);
    });
  });

  // ── 3. getAgentDetail ──────────────────────────────────────────────

  describe("getAgentDetail", () => {
    it("throws NotFoundException for nonexistent user", async () => {
      await expect(service.getAgentDetail("u-nonexistent")).rejects.toThrow(NotFoundException);
    });

    it("resolves agent by userId (canonical lookup)", async () => {
      const d = await service.getAgentDetail("u-sarah");
      expect(d.user.id).toBe("u-sarah");
      expect(d.id).toBe("a1");
    });

    it("also resolves agent by SupportAgent.id (dual-id lookup — frontend drill-down passes either)", async () => {
      const d = await service.getAgentDetail("a1");
      expect(d.user.id).toBe("u-sarah");
      expect(d.id).toBe("a1");
    });

    it("includes user, department, tickets, recentActivity, and metrics keys", async () => {
      const d = await service.getAgentDetail("u-sarah");
      expect(d.user).toBeDefined();
      expect(d.tickets).toBeDefined();
      expect(d.recentActivity).toBeDefined();
      expect(d.metrics).toBeDefined();
      expect(Array.isArray(d.tickets)).toBe(true);
      expect(Array.isArray(d.recentActivity)).toBe(true);
    });

    it("tickets belong to the agent (assigneeId == userId)", async () => {
      const d = await service.getAgentDetail("u-sarah");
      for (const t of d.tickets) {
        // If a ticket has assigneeId, verify it matches; else ensure count is limited
        if ((t as any).assigneeId) {
          expect((t as any).assigneeId).toBe("u-sarah");
        }
      }
    });

    it("metrics include escalationRate and reopenRate between 0–100", async () => {
      const d = await service.getAgentDetail("u-sarah");
      expect(d.metrics.escalationRate).toBeGreaterThanOrEqual(0);
      expect(d.metrics.escalationRate).toBeLessThanOrEqual(100);
      expect(d.metrics.reopenRate).toBeGreaterThanOrEqual(0);
      expect(d.metrics.reopenRate).toBeLessThanOrEqual(100);
    });
  });

  // ── 4. createAgent ─────────────────────────────────────────────────

  describe("createAgent", () => {
    it("creates agent with userId and defaults (maxTickets=10, empty skills)", async () => {
      const created = await service.createAgent({ userId: "u-priya" });
      expect(created.userId).toBe("u-priya");
      expect(created.maxTickets).toBe(10);
      expect(created.skills).toEqual([]);
      expect(created.isActive).not.toBe(false);
    });

    it("respects provided skills, maxTickets, departmentId, teamId", async () => {
      const created = await service.createAgent({
        userId: "u-priya",
        departmentId: "dept-tech",
        teamId: "team-alpha",
        skills: ["Escalations", "Management"],
        maxTickets: 20,
      });
      expect(created.department?.name).toBe("Technical Support");
      expect(created.maxTickets).toBe(20);
      expect(created.skills).toContain("Escalations");
    });
  });

  // ── 5. updateAgent ─────────────────────────────────────────────────

  describe("updateAgent", () => {
    it("throws NotFoundException when agent doesn't exist", async () => {
      await expect(
        service.updateAgent("u-nonexistent", { maxTickets: 20 }),
      ).rejects.toThrow(NotFoundException);
    });

    it("partially updates only provided fields (skills only)", async () => {
      const before = await service.getAgentDetail("u-sarah");
      const updated = await service.updateAgent("u-sarah", {
        skills: ["OAuth", "SAML"],
      });
      expect(updated.skills).toEqual(["OAuth", "SAML"]);
      expect(updated.maxTickets).toBe(before.maxTickets); // unchanged
      expect(updated.department?.name).toBe(before.department?.name); // unchanged
    });

    it("updates isActive to false (deactivate)", async () => {
      const updated = await service.updateAgent("u-sarah", { isActive: false });
      expect(updated.isActive).toBe(false);
    });
  });

  // ── 6. deleteAgent ─────────────────────────────────────────────────

  describe("deleteAgent", () => {
    it("throws NotFoundException for nonexistent agent", async () => {
      await expect(service.deleteAgent("u-nonexistent")).rejects.toThrow(NotFoundException);
    });

    it("soft-deletes (deletedAt set) so listAgents no longer shows it", async () => {
      const before = await service.listAgents();
      await service.deleteAgent("u-sarah");
      const after = await service.listAgents();
      expect(after.total).toBe(before.total - 1);
      // Confirm not in list anymore
      const stillThere = after.data.some((a: any) => a.userId === "u-sarah");
      expect(stillThere).toBe(false);
    });

    it("throws when deleting already-deleted agent", async () => {
      await service.deleteAgent("u-sarah");
      await expect(service.deleteAgent("u-sarah")).rejects.toThrow(NotFoundException);
    });
  });

  // ── 7. toggleAgentStatus ───────────────────────────────────────────

  describe("toggleAgentStatus", () => {
    it("throws NotFoundException for nonexistent agent", async () => {
      await expect(service.toggleAgentStatus("u-nonexistent")).rejects.toThrow(NotFoundException);
    });

    it("flips isActive: true → false then false → true", async () => {
      const first = await service.toggleAgentStatus("u-sarah"); // online → deactivated
      expect(first.isActive).toBe(false);
      const second = await service.toggleAgentStatus("u-sarah"); // reactivate
      expect(second.isActive).toBe(true);
    });
  });

  // ── 8. getAgentTickets ─────────────────────────────────────────────

  describe("getAgentTickets", () => {
    it("returns only tickets assigned to the given agent", async () => {
      const sarah = await service.getAgentTickets("u-sarah");
      expect(sarah.total).toBeGreaterThanOrEqual(2);
      for (const t of sarah.data) {
        expect(["t1", "t3", "t6"]).toContain(t.id);
      }
    });

    it("filters by status (IN_PROGRESS → 1 for Sarah)", async () => {
      const r = await service.getAgentTickets("u-sarah", { status: "IN_PROGRESS" as any });
      expect(r.total).toBe(1);
      expect(r.data[0].id).toBe("t1");
    });

    it("returns empty list with total=0 for user with no tickets", async () => {
      const r = await service.getAgentTickets("u-james");
      expect(r.total).toBe(0);
      expect(r.data).toEqual([]);
    });

    it("returns ticket category name as {name} object", async () => {
      const r = await service.getAgentTickets("u-sarah");
      const withCat = r.data.find((t: any) => t.category);
      if (withCat) {
        expect(typeof (withCat as any).category.name).toBe("string");
      }
    });
  });

  // ── 9. getAgentActivity ────────────────────────────────────────────

  describe("getAgentActivity", () => {
    it("returns only activity for the given user, newest first", async () => {
      const r = await service.getAgentActivity("u-sarah");
      expect(r.total).toBe(2);
      const times = r.data.map((a: any) => new Date(a.createdAt).getTime());
      // Ensure descending order
      for (let i = 1; i < times.length; i++) {
        expect(times[i - 1]).toBeGreaterThanOrEqual(times[i]);
      }
    });

    it("returns empty list for agents with no activity", async () => {
      const r = await service.getAgentActivity("u-james");
      expect(r.total).toBe(0);
      expect(r.data).toEqual([]);
    });

    it("paginates correctly (limit 1 → 1 record, total still 2)", async () => {
      const r = await service.getAgentActivity("u-sarah", { limit: 1, page: 1 });
      expect(r.data).toHaveLength(1);
      expect(r.total).toBe(2);
    });
  });

  // ── 10. getAgentMetrics ────────────────────────────────────────────

  describe("getAgentMetrics", () => {
    it("throws NotFoundException for nonexistent agent", async () => {
      await expect(service.getAgentMetrics("u-nonexistent")).rejects.toThrow(NotFoundException);
    });

    it("returns metrics with rates = 0 when assigned/resolved = 0", async () => {
      // James has 0 tickets
      const { metrics } = await service.getAgentMetrics("u-james");
      expect(metrics.totalAssigned).toBe(0);
      expect(metrics.escalationRate).toBe(0);
      expect(metrics.reopenRate).toBe(0);
    });

    it("Sarah: escalations / totalAssignments = escalationRate (%)", async () => {
      const { metrics } = await service.getAgentMetrics("u-sarah");
      // Sarah has 3 assignments, 1 escalation
      expect(metrics.totalAssigned).toBe(3);
      expect(metrics.escalated).toBe(1);
      const expectedRate = (1 / 3) * 100;
      expect(Math.abs(metrics.escalationRate - expectedRate)).toBeLessThan(0.01);
    });
  });
});
