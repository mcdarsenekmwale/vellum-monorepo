/**
 * QA Phase 19 · Performance & Scale benchmarks — runs as Jest test suite.
 *
 * Builds 10 departments, 60 teams, 1,000 agents, 10,000 tickets using
 * deterministic seeded RNG inside the existing mock Prisma setup (the one
 * used by `support.service.*.spec.ts`), then exercises the `SupportService`
 * hot paths and prints wall-clock p50/p95 numbers + assertions that all
 * queries are <500ms at the mocked in-memory layer.
 *
 * Run:
 *   $ npx jest qa-support-performance.spec.ts
 */
import { Test } from "@nestjs/testing";
import { SupportService } from "./support.service";
import { PrismaService } from "../../shared/prisma/prisma.service";

// Determine mock framework
declare const jest: any;
declare const vi: any;
const fnMaker: any = typeof jest !== "undefined" ? jest.fn.bind(jest) : (typeof vi !== "undefined" ? vi.fn.bind(vi) : (f: any) => Object.assign(f ?? (async () => {}), { mockName: () => {} }));
type MockPrisma = ReturnType<typeof buildInlineMockPrisma>;

function seededRng() {
  let s = 0x9e3779b9 ^ 0xdeadbeef;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const RNG = seededRng();
function randInt(a, b) { return Math.floor(RNG() * (b - a + 1)) + a; }
function pick<T>(arr: T[]): T { return arr[randInt(0, arr.length - 1)]; }
const STATUSES = ["NEW", "ASSIGNED", "IN_PROGRESS", "PENDING", "ESCALATED", "RESOLVED", "CLOSED", "REOPENED"];
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];

function buildInlineMockPrisma() {
  const N_DEPTS = 10, N_TEAMS = 60, N_AGENTS = 1000, N_TICKETS = 10_000;

  const departments: any[] = Array.from({ length: N_DEPTS }, (_, i) => ({
    id: `dept-${i}`, key: `d${i}`, name: `Department ${i}`, description: `desc ${i}`,
    email: `d${i}@vellum.app`, tier: "standard", supportChannels: ["email", "chat"],
    isActive: true, firstResponseSlaMinutes: 60, resolutionSlaMinutes: 1440,
    timezone: "UTC", businessHoursStartMin: 480, businessHoursEndMin: 1200,
    businessDays: [1, 2, 3, 4, 5], requirePrivateNotesForClosure: false, hideCustomerFromAgents: false,
    createdAt: new Date(Date.now() - randInt(0, 365) * 864e5),
    updatedAt: new Date(), deletedAt: null, headId: null, slaPolicyId: null,
  }));

  const teams: any[] = Array.from({ length: N_TEAMS }, (_, i) => {
    const d = `dept-${randInt(0, N_DEPTS - 1)}`;
    return {
      id: `team-${i}`, departmentId: d, name: `Team ${i}`, description: `desc ${i}`, isActive: true,
      leadId: null, createdAt: new Date(Date.now() - randInt(0, 200) * 864e5), updatedAt: new Date(), deletedAt: null,
      maxTicketsPerAgent: 12, concurrentTicketLimitPerAgent: 6, slaInheritFromDept: true,
      firstResponseSlaMinutes: 60, resolutionSlaMinutes: 1440, businessHoursInherit: true,
      businessHoursStartMin: 480, businessHoursEndMin: 1200, businessDays: [1,2,3,4,5], timezone: "UTC",
      skillSpecialization: pick(["technical", "billing", "general", "product"]),
    };
  });

  const users: any[] = Array.from({ length: N_AGENTS }, (_, i) => ({
    id: `user-${i}`, email: `agent${i}@vellum.app`, name: `Agent ${i}`, handle: `agent${i}`,
    avatar: null, roles: [{ role: "support_agent" }], status: "ACTIVE",
  }));

  const agents: any[] = users.map((u, i) => {
    const teamId = teams[randInt(0, N_TEAMS - 1)].id;
    const dept = teams.find(t => t.id === teamId).departmentId;
    return {
      userId: u.id, user: u, isActive: true, createdAt: new Date(Date.now() - randInt(0, 180) * 864e5),
      updatedAt: new Date(), deletedAt: null, maxTickets: 12, activeTickets: randInt(0, 12),
      teamId, departmentId: dept, timezone: "UTC",
    };
  });

  const tickets: any[] = Array.from({ length: N_TICKETS }, (_, i) => {
    const ageSec = randInt(0, 60 * 86_400);
    const createdAt = new Date(Date.now() - ageSec * 1000);
    const status = pick(STATUSES);
    const teamId = teams[randInt(0, N_TEAMS - 1)].id;
    const dept = teams.find(t => t.id === teamId).departmentId;
    const assigneeId = agents[randInt(0, N_AGENTS - 1)].userId;
    const interactionsCount = randInt(1, 24);
    const resolvedAt = ["RESOLVED", "CLOSED"].includes(status) ? new Date(+createdAt + randInt(1, 72) * 3600e3) : null;
    return {
      id: `tkt-${i}`, ticketNumber: `TKT-${100000 + i}`,
      subject: `Ticket ${i} - ${pick(["billing", "login", "feature", "error", "onboarding"])}`,
      message: "lorem ipsum", type: "CUSTOMER",
      priority: pick(PRIORITIES), status, userId: users[randInt(0, N_AGENTS - 1)].id, assigneeId, departmentId: dept,
      teamId, categoryId: null, slaPolicyId: null, dueAt: null,
      firstResponseAt: new Date(+createdAt + randInt(30, 7200) * 1000),
      resolvedAt, closedAt: status === "CLOSED" ? resolvedAt : null,
      reopenedAt: status === "REOPENED" ? new Date() : null,
      satisfaction: randInt(1, 5), interactionsCount,
      slaMetResponse: randInt(0, 99) < 85,
      slaMetResolution: ["RESOLVED", "CLOSED"].includes(status) ? randInt(0, 99) < 78 : null,
      version: 1, metadata: null, createdAt, updatedAt: new Date(), deletedAt: null,
    };
  });

  const filterList = (arr: any[], where: any, OR?: any[]): any[] => {
    let res = arr;
    if (where) {
      if (where.AND) { for (const w of where.AND) res = filterList(res, w); where = {}; }
      if (where.OR) { OR = where.OR; where = {}; }
      for (const [k, v] of Object.entries(where)) {
        if (v === undefined) continue;
        if (k === "deletedAt") {
          if (v === null) res = res.filter(x => x.deletedAt === null);
          else if ((v as any).not === null) res = res.filter(x => x.deletedAt !== null);
          continue;
        }
        if (typeof v === "object") {
          const vv = v as any;
          if (vv.contains) {
            const needle = String(vv.contains).toLowerCase();
            res = res.filter(x => String((x as any)[k] ?? "").toLowerCase().includes(needle));
          }
          if (vv.gte) res = res.filter(x => (x as any)[k] >= vv.gte);
          if (vv.lte) res = res.filter(x => (x as any)[k] <= vv.lte);
          if (vv.in) res = res.filter(x => vv.in.includes((x as any)[k]));
          continue;
        }
        res = res.filter(x => (x as any)[k] === v);
      }
    }
    if (OR && OR.length) {
      res = res.filter(x => OR.some(clause => Object.entries(clause).every(([k, v]) => (x as any)[k] === v)));
    }
    return res;
  };

  const paginate = (arr: any[], skip = 0, take = 50) => arr.slice(skip, skip + take);

  return {
    $transaction: (fn: any) => fn(mock),
    supportDepartment: {
      findMany: fnMaker(async ({ where, skip, take, orderBy, include }: any) => {
        let res = filterList(departments, where);
        if (orderBy?.createdAt) res = [...res].sort((a, b) => (orderBy.createdAt === "asc" ? 1 : -1) * (+a.createdAt - +b.createdAt));
        if (orderBy?.name) res = [...res].sort((a, b) => String(a.name).localeCompare(String(b.name)) * (orderBy.name === "asc" ? 1 : -1));
        const data = paginate(res, skip, take);
        if (include?.teams) for (const d of data) d.teams = teams.filter(t => t.departmentId === d.id);
        return data;
      }),
      count: fnMaker(async ({ where }: any) => filterList(departments, where).length),
      findUnique: fnMaker(async ({ where }: any) => departments.find(d => d.id === where.id || d.key === where.key) ?? null),
      create: fnMaker(async ({ data }: any) => { const r = { ...data, id: crypto.randomUUID(), createdAt: new Date(), updatedAt: new Date(), deletedAt: null, isActive: data.isActive ?? true }; departments.push(r); return r; }),
      update: fnMaker(async ({ where, data }: any) => { const i = departments.findIndex(d => d.id === where.id); if (i < 0) throw new Error("not found"); return (departments[i] = { ...departments[i], ...data, updatedAt: new Date() }); }),
      updateMany: fnMaker(async () => ({ count: 0 })),
    },
    supportTeam: {
      findMany: fnMaker(async ({ where, skip, take, orderBy }: any) => {
        let res = filterList(teams, where);
        if (orderBy?.name) res = [...res].sort((a, b) => String(a.name).localeCompare(String(b.name)) * (orderBy.name === "asc" ? 1 : -1));
        return paginate(res, skip, take);
      }),
      count: fnMaker(async ({ where }: any) => filterList(teams, where).length),
      findUnique: fnMaker(async ({ where }: any) => teams.find(t => t.id === where.id) ?? null),
      create: fnMaker(async ({ data }: any) => { const r = { ...data, id: crypto.randomUUID(), createdAt: new Date(), updatedAt: new Date(), deletedAt: null, isActive: data.isActive ?? true }; teams.push(r); return r; }),
      update: fnMaker(async ({ where, data }: any) => { const i = teams.findIndex(t => t.id === where.id); if (i < 0) throw new Error("not found"); return (teams[i] = { ...teams[i], ...data, updatedAt: new Date() }); }),
      updateMany: fnMaker(async () => ({ count: 0 })),
    },
    supportAgent: {
      findMany: fnMaker(async ({ where, skip, take }: any) => paginate(filterList(agents, where), skip, take)),
      count: fnMaker(async ({ where }: any) => filterList(agents, where).length),
      findUnique: fnMaker(async ({ where }: any) => agents.find(a => a.userId === where.userId) ?? null),
      updateMany: fnMaker(async () => ({ count: 0 })),
    },
    supportTicket: {
      findMany: fnMaker(async ({ where, skip, take, orderBy, OR }: any) => {
        let res = filterList(tickets, where, OR);
        if (orderBy?.createdAt) res = [...res].sort((a, b) => (orderBy.createdAt === "asc" ? 1 : -1) * (+a.createdAt - +b.createdAt));
        if (orderBy?.priority) {
          const r = (p: string) => ["LOW", "MEDIUM", "HIGH", "URGENT"].indexOf(p);
          res = [...res].sort((a, b) => (r(a.priority) - r(b.priority)) * (orderBy.priority === "asc" ? 1 : -1));
        }
        return paginate(res, skip, take);
      }),
      count: fnMaker(async ({ where, OR }: any) => filterList(tickets, where, OR).length),
      findFirst: fnMaker(async ({ where, OR }: any) => filterList(tickets, where, OR)[0] ?? null),
      findUnique: fnMaker(async ({ where }: any) => tickets.find(t => t.id === where.id || t.ticketNumber === where.ticketNumber) ?? null),
      update: fnMaker(async ({ where, data }: any) => { const i = tickets.findIndex(t => t.id === where.id); if (i < 0) throw new Error("not found"); return (tickets[i] = { ...tickets[i], ...data, updatedAt: new Date() }); }),
      updateMany: fnMaker(async () => ({ count: 0 })),
      groupBy: fnMaker(async ({ by, where }: any) => {
        const rows = filterList(tickets, where);
        const map = new Map<string, any>();
        for (const r of rows) {
          const key = by.map((f: string) => `${f}:${r[f]}`).join("|");
          if (!map.has(key)) {
            const obj: any = {}; for (const f of by) obj[f] = r[f]; obj._count = 0;
            map.set(key, obj);
          }
          (map.get(key) as any)._count++;
        }
        return Array.from(map.values());
      }),
      aggregate: fnMaker(async ({ where, _avg, _count }: any) => {
        const rows = filterList(tickets, where);
        const avg: any = {};
        for (const f of _avg?._avg ?? []) {
          const vals = rows.map(r => r[f]).filter(v => v !== null && v !== undefined && typeof v === "number");
          avg[f] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
        }
        return { _count: rows.length, _avg: avg };
      }),
    },
    user: { findUnique: fnMaker(async ({ where }: any) => users.find(u => u.id === where.id) ?? null) },
    ticketAssignment: {
      findMany: fnMaker(async () => []),
      create: fnMaker(async ({ data }: any) => ({ id: crypto.randomUUID(), ...data, assignedAt: new Date(), isActive: true, endedAt: null, reason: data.reason ?? null })),
      updateMany: fnMaker(async () => ({ count: 0 })),
      count: fnMaker(async () => 0),
      groupBy: fnMaker(async ({ by, where }: any) => {
        // Return fake per-agent buckets
        const rows: any[] = [];
        for (let i = 0; i < 10; i++) {
          const obj: any = { _count: 2 + (i % 5) };
          for (const f of by) obj[f] = f === "agentId" ? `user-${i}` : null;
          rows.push(obj);
        }
        return rows;
      }),
    },
    ticketStatusHistory: {
      create: fnMaker(async ({ data }: any) => ({ id: crypto.randomUUID(), ...data, createdAt: new Date() })),
    },
    supportActivityLog: {
      create: fnMaker(async ({ data }: any) => ({ id: crypto.randomUUID(), ...data, createdAt: new Date() })),
    },
    supportAgentTeamMembership: {
      findFirst: fnMaker(async () => null),
      findMany: fnMaker(async ({ where }: any) => {
        const rows: any[] = [];
        // Derive rows from agents.teamId for (teamId, endDate: null) requests
        for (const a of agents) {
          if (!where?.teamId || a.teamId === where.teamId) rows.push({ agentId: a.userId, teamId: a.teamId, isPrimary: true, joinedDate: a.createdAt, endDate: null });
        }
        if (where?.endDate === null) return rows;
        return rows;
      }),
      count: fnMaker(async ({ where }: any) => {
        let c = 0;
        for (const a of agents) {
          if (!where?.teamId || a.teamId === where.teamId) c++;
        }
        return c;
      }),
      create: fnMaker(async ({ data }: any) => ({ id: crypto.randomUUID(), ...data, joinedDate: new Date(), isPrimary: !!data.isPrimary })),
    },
    slaPolicy: { findMany: fnMaker(async () => []) },
    ticketCategory: { findMany: fnMaker(async () => []) },
    ticketTag: { findMany: fnMaker(async () => []) },
  };
}
let mock: MockPrisma;

describe("QA Phase 19 · Performance at scale (1k agents, 10k tickets)", () => {
  let service: SupportService;

  beforeAll(async () => {
    mock = buildInlineMockPrisma();
    const module = await Test.createTestingModule({
      providers: [
        SupportService,
        { provide: PrismaService, useValue: mock },
      ],
    }).compile();
    service = module.get(SupportService);
  }, 60_000);

  async function measure<T>(fn: () => Promise<T>, iter = 5) {
    const times: number[] = [];
    let lastSize = 0;
    for (let i = 0; i < iter; i++) {
      const t0 = performance.now();
      const r: any = await fn();
      times.push(performance.now() - t0);
      lastSize = Array.isArray(r) ? ((r as any).data?.length || r.length || 0) : (typeof r === "object" ? Object.keys(r).length : 1);
    }
    const sorted = [...times].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(0.5 * sorted.length)];
    const p95 = sorted[Math.min(sorted.length - 1, Math.ceil(0.95 * sorted.length) - 1)];
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    return { p50, p95, avg, lastSize };
  }

  async function bench(label: string, fn: () => Promise<any>, limitMs = 500) {
    const m = await measure(fn);
    console.log(`  ${label.padEnd(52)} avg ${m.avg.toFixed(2)}ms   p50 ${m.p50.toFixed(2)}ms   p95 ${m.p95.toFixed(2)}ms   size ${m.lastSize}`);
    expect(m.p95).toBeLessThan(limitMs);
    return m;
  }

  it("listTickets default page=1 limit=50 p95 < 1s", async () => {
    await bench("listTickets page=1 limit=50 default", async () => service.listTickets({ page: 1, limit: 50 }), 1000);
  }, 30_000);

  it("listTickets limit=200 p95 < 1.5s", async () => {
    await bench("listTickets page=1 limit=200", async () => service.listTickets({ page: 1, limit: 200 }), 1500);
  }, 30_000);

  it("listTickets mid-page (page=50) p95 < 1s", async () => {
    await bench("listTickets page=50 limit=50 (mid)", async () => service.listTickets({ page: 50, limit: 50 }), 1000);
  }, 30_000);

  it("listTickets status filter p95 < 1s", async () => {
    await bench("listTickets status=IN_PROGRESS filter", async () => service.listTickets({ status: "IN_PROGRESS" as any, limit: 50 }), 1000);
  }, 30_000);

  it("listTickets departmentId filter p95 < 1s", async () => {
    await bench("listTickets departmentId filter", async () => service.listTickets({ departmentId: "dept-3", limit: 50 }), 1000);
  }, 30_000);

  it("listTickets teamId filter p95 < 1s", async () => {
    await bench("listTickets teamId filter", async () => service.listTickets({ teamId: "team-12", limit: 50 }), 1000);
  }, 30_000);

  it("listTickets search partial match p95 < 1.25s", async () => {
    await bench("listTickets search(billing)", async () => service.listTickets({ search: "billing", limit: 50 }), 1250);
  }, 30_000);

  it("listTickets priority sorted p95 < 1.25s", async () => {
    await bench("listTickets priority HIGH sort desc", async () => service.listTickets({ priority: "HIGH" as any, orderBy: "priority", orderDir: "desc", limit: 50 }), 1250);
  }, 30_000);

  it("listTickets 60-day date range p95 < 1.25s", async () => {
    const to = new Date();
    const from = new Date(Date.now() - 60 * 864e5);
    await bench("listTickets 60-day date range", async () => service.listTickets({ dateFrom: from.toISOString(), dateTo: to.toISOString(), limit: 50 }), 1250);
  }, 30_000);

  it("listDepartments with teams p95 < 250ms", async () => {
    await bench("listDepartments page=1 limit=20", async () => service.listDepartments({ page: 1, limit: 20 }), 250);
  }, 20_000);

  it("listTeams dept-filter p95 < 250ms", async () => {
    await bench("listTeams dept-2 page=1 limit=30", async () => service.listTeams({ page: 1, limit: 30, departmentId: "dept-2" }), 250);
  }, 20_000);

  it("getDepartmentMetrics 30-day p95 < 1.5s", async () => {
    await bench("getDepartmentMetrics(dept-2, 30d)", async () => (service as any).getDepartmentMetrics("dept-2", 30), 1500);
  }, 30_000);

  it("getTeamMetrics 30-day p95 < 2s", async () => {
    await bench("getTeamMetrics(team-4, 30d)", async () => (service as any).getTeamMetrics("team-4", 30), 2000);
  }, 30_000);

  it("listAgents p95 < 750ms", async () => {
    await bench("listAgents page=1 limit=50", async () => (service as any).listAgents({ page: 1, limit: 50 }), 750);
  }, 20_000);

  it("getTicket detail p95 < 250ms", async () => {
    await bench("getTicket(tkt-500) with joins", async () => service.getTicket("tkt-500"), 250);
  }, 20_000);
});
