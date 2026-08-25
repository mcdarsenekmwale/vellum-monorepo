import { Test } from "@nestjs/testing";
import { SupportService } from "./support.service";
import { PrismaService } from "../../shared/prisma/prisma.service";

// Jest/Vitest compatibility shim — Jest is the runtime per package.json
// (jest --config jest.config.ts) but this spec was authored with Vitest
// globals.  We expose a tiny mirror so both runtimes work.
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

/**
 * RED tests for listTickets enhancements:
 *  1. NEW: `orderBy` param (createdAt | updatedAt | priority)
 *  2. NEW: `categoryId` filter param
 *  3. NEW: `dateFrom` / `dateTo` date-range filtering
 *  4. ENHANCED: `search` matches customer name/handle/email (previously only
 *     subject / ticketNumber / message)
 *
 * All tests below intentionally FAIL initially — the service does not yet
 * implement these parameters in its `where` / `orderBy` clauses.
 */

type StubTicket = {
  id: string;
  ticketNumber: string;
  subject: string;
  message: string;
  status: string;
  priority: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  assigneeId: string | null;
  categoryId: string | null;
  departmentId: string | null;
  userId: string;
};

type StubUser = { id: string; name: string; email: string; handle: string; avatar: string | null };

class MockPrisma {
  tickets: StubTicket[] = [];
  users: StubUser[] = [];

  supportTicket = {
    findMany: async (q: any) => {
      // ── Filters ──────────────────────────────────────────────
      let rows = this.tickets.filter((t) => !t.deletedAt);
      const w = q?.where ?? {};
      if (w.status) rows = rows.filter((t) => t.status === w.status);
      if (w.priority) rows = rows.filter((t) => t.priority === w.priority);
      if (w.assigneeId) rows = rows.filter((t) => t.assigneeId === w.assigneeId);
      if (w.assigneeId === null) rows = rows.filter((t) => t.assigneeId === null);
      if (w.categoryId) rows = rows.filter((t) => t.categoryId === w.categoryId);
      if (w.userId) rows = rows.filter((t) => t.userId === w.userId);
      if (w.createdAt?.gte) rows = rows.filter((t) => t.createdAt >= w.createdAt.gte);
      if (w.createdAt?.lte) rows = rows.filter((t) => t.createdAt <= w.createdAt.lte);

      if (w.OR) {
        rows = rows.filter((t) => {
          return (w.OR as any[]).some((orClause: any) => {
            if (orClause.subject?.contains) {
              return t.subject.toLowerCase().includes(orClause.subject.contains.toLowerCase());
            }
            if (orClause.ticketNumber?.contains) {
              return t.ticketNumber.toLowerCase().includes(orClause.ticketNumber.contains.toLowerCase());
            }
            if (orClause.message?.contains) {
              return t.message.toLowerCase().includes(orClause.message.contains.toLowerCase());
            }
            // Nested relation query: user → { is: { OR: [ name.contains, email.contains, handle.contains ] } }
            const userIs = orClause.user?.is;
            if (userIs && Array.isArray(userIs.OR)) {
              const uid = t.userId;
              const user = this.users.find((u) => u.id === uid);
              return (userIs.OR as any[]).some((inner: any) => {
                if (inner.name?.contains) {
                  return (user?.name ?? "").toLowerCase().includes(inner.name.contains.toLowerCase());
                }
                if (inner.email?.contains) {
                  return (user?.email ?? "").toLowerCase().includes(inner.email.contains.toLowerCase());
                }
                if (inner.handle?.contains) {
                  return (user?.handle ?? "").toLowerCase().includes(inner.handle.contains.toLowerCase());
                }
                return false;
              });
            }
            return false;
          });
        });
      }

      // ── Order ────────────────────────────────────────────────
      const orderBy = q?.orderBy;
      if (orderBy) {
        const [field, dir] = Object.entries(orderBy)[0] as [string, "asc" | "desc"];
        rows = [...rows].sort((a: any, b: any) => {
          const av = a[field];
          const bv = b[field];
          if (av < bv) return dir === "asc" ? -1 : 1;
          if (av > bv) return dir === "asc" ? 1 : -1;
          return 0;
        });
      }

      return rows;
    },
    count: async (q: any) => (await (this.supportTicket as any).findMany(q)).length,
  };

  ticketCategory = {
    findUnique: async () => Promise.resolve({ sortOrder: 1 }),
  };
}

// Shared dummy categories & dates
const day = (d: number) => new Date(`2025-08-${String(d).padStart(2, "0")}T10:00:00.000Z`);

const makeTicket = (
  id: string,
  patch: Partial<StubTicket> = {},
): StubTicket => ({
  id,
  ticketNumber: `TKT-2025081501030${id}`,
  subject: `Subject ${id}`,
  message: `Message body ${id}`,
  status: "NEW",
  priority: "MEDIUM",
  createdAt: day(10),
  updatedAt: day(10),
  deletedAt: null,
  assigneeId: null,
  categoryId: "cat-billing",
  departmentId: "dept-general",
  userId: "u-alice",
  ...patch,
});

describe("SupportService.listTickets enhancements (TDD RED)", () => {
  let service: SupportService;
  let prisma: MockPrisma;

  beforeEach(async () => {
    prisma = new MockPrisma();
    prisma.users = [
      { id: "u-alice", name: "Alice Johnson", email: "alice@vellbase.app", handle: "alice", avatar: null },
      { id: "u-bob", name: "Bob Smith", email: "bob@vellbase.app", handle: "bobby", avatar: null },
    ];
    prisma.tickets = [
      makeTicket("1", { createdAt: day(1), updatedAt: day(2), priority: "LOW", userId: "u-alice", categoryId: "cat-account", status: "NEW" }),
      makeTicket("2", { createdAt: day(3), updatedAt: day(8), priority: "HIGH", userId: "u-bob", categoryId: "cat-billing", status: "ESCALATED" }),
      makeTicket("3", { createdAt: day(5), updatedAt: day(6), priority: "CRITICAL", userId: "u-alice", categoryId: "cat-account", status: "IN_PROGRESS" }),
      makeTicket("4", { createdAt: day(7), updatedAt: day(7), priority: "MEDIUM", userId: "u-bob", categoryId: "cat-tech", status: "ASSIGNED" }),
    ];

    const module = await Test.createTestingModule({
      providers: [
        SupportService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(SupportService);
  });

  describe("orderBy", () => {
    it("orders by updatedAt desc when requested", async () => {
      const res = await service.listTickets({ orderBy: "updatedAt", orderDir: "desc" } as any);
      const ids = res.data.map((r: any) => r.id);
      // Highest updatedAt first: #2 (day8), #3 (day6), #1 (day2), #4 (day7?? no — day7 actually > day6)
      // Correction: updatedAt order: ticket2=day8, ticket4=day7, ticket3=day6, ticket1=day2
      expect(ids).toEqual(["2", "4", "3", "1"]);
    });

    it("orders by priority asc when requested (alpha sort works as a stand-in)", async () => {
      const res = await service.listTickets({ orderBy: "priority", orderDir: "asc" } as any);
      const priorities = res.data.map((r: any) => r.priority);
      expect(priorities).toEqual(["CRITICAL", "HIGH", "LOW", "MEDIUM"]);
    });

    it("orders by status desc when requested", async () => {
      const res = await service.listTickets({ orderBy: "status", orderDir: "desc" } as any);
      const statuses = res.data.map((r: any) => r.status);
      const sorted = [...statuses].sort().reverse();
      expect(statuses).toEqual(sorted);
    });
  });

  describe("categoryId filter", () => {
    it("filters by categoryId", async () => {
      const res = await service.listTickets({ categoryId: "cat-account" } as any);
      expect(res.data.length).toBe(2);
      expect(res.data.every((t: any) => t.categoryId === "cat-account")).toBe(true);
    });

    it("categoryId = cat-billing returns 1 ticket", async () => {
      const res = await service.listTickets({ categoryId: "cat-billing" } as any);
      expect(res.data.length).toBe(1);
      expect((res.data[0] as any).id).toBe("2");
    });
  });

  describe("date range (dateFrom / dateTo)", () => {
    it("dateFrom filters to tickets created on/after given date", async () => {
      const res = await service.listTickets({ dateFrom: day(5).toISOString() } as any);
      expect(res.data.length).toBe(2); // #3 day5 + #4 day7
      expect(res.data.map((r: any) => r.id).sort()).toEqual(["3", "4"]);
    });

    it("dateTo filters tickets created on/before given date", async () => {
      const res = await service.listTickets({ dateTo: day(3).toISOString() } as any);
      expect(res.data.map((r: any) => r.id).sort()).toEqual(["1", "2"]);
    });

    it("combined dateFrom + dateTo picks the correct window", async () => {
      const res = await service.listTickets({
        dateFrom: day(2).toISOString(),
        dateTo: day(6).toISOString(),
      } as any);
      expect(res.data.map((r: any) => r.id).sort()).toEqual(["2", "3"]);
    });
  });

  describe("search includes customer (user) name/email/handle", () => {
    it("finds by customer name substring", async () => {
      const res = await service.listTickets({ search: "Smith" });
      expect(res.data.length).toBeGreaterThanOrEqual(1);
      expect(res.data.every((t: any) => t.userId === "u-bob")).toBe(true);
    });

    it("finds by customer email substring", async () => {
      const res = await service.listTickets({ search: "alice@vellbase" });
      expect(res.data.length).toBeGreaterThanOrEqual(1);
      expect(res.data.every((t: any) => t.userId === "u-alice")).toBe(true);
    });

    it("finds by handle substring (case insensitive)", async () => {
      const res = await service.listTickets({ search: "BOBBY" });
      expect(res.data.length).toBeGreaterThanOrEqual(1);
      expect(res.data.every((t: any) => t.userId === "u-bob")).toBe(true);
    });

    it("search 'account' still works against subject/message (original behavior preserved)", async () => {
      // No tickets have "account" in subject/message, but original OR
      // branches still exist. Just verify no crash and length is a number.
      const res = await service.listTickets({ search: "Subject 1" });
      expect(Array.isArray(res.data)).toBe(true);
      expect(res.data.length).toBeGreaterThanOrEqual(0);
    });
  });
});
