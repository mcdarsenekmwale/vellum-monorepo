import { Test } from "@nestjs/testing";
import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { AccessRequestStatus, AccessRequestType, Role } from "@prisma/client";
import { AccessRequestsService } from "./access-requests.service";
import { PrismaService } from "../../shared/prisma/prisma.service";
import { CacheService } from "../../shared/cache/cache.service";

// ─── Minimal mock CacheService with get/set ──────────────────────────────────

class MockPrismaLite {
  private _data: Record<string, any[]> = {
    accessRequest: [],
    userResourceAccess: [],
    rbacRole: [],
    resourcePermission: [],
    auditLog: [],
    supportTicket: [],
    article: [],
    highlight: [],
    user: [],
    tag: [],
  };
  private _counter = 0;
  $transaction = async <T>(fn: (tx: any) => Promise<T>): Promise<T> => fn(this as any);

  private nextId(prefix: string) {
    return `${prefix}-${++this._counter}`;
  }

  // Build generic findMany/findUnique/findFirst helpers with seedable data
  genericFind(table: string) {
    const me = this as any;
    return {
      findMany: async (q: any) => {
        const rows = me._data[table] ?? [];
        const where = q?.where;
        let result = rows.filter((r: any) => me._match(r, where));
        if (q?.take) result = result.slice(0, q.take);
        // Skip contains filters for now — seed tests with full matches
        if (q?.skip) result = result.slice(q.skip);
        return result;
      },
      findUnique: async (q: any) => {
        const rows = me._data[table] ?? [];
        const where = q?.where ?? {};
        return rows.find((r: any) => me._match(r, where)) ?? null;
      },
      findFirst: async (q: any) => {
        const rows = me._data[table] ?? [];
        const where = q?.where ?? {};
        return rows.find((r: any) => me._match(r, where)) ?? null;
      },
      count: async (q: any) => {
        const rows = me._data[table] ?? [];
        const where = q?.where ?? {};
        return rows.filter((r: any) => me._match(r, where)).length;
      },
      create: async (q: any) => {
        const row = { id: me.nextId(table[0]), ...q.data, createdAt: new Date(), updatedAt: new Date() };
        me._data[table].push(row);
        return { ...row, requester: q.data?.requesterId ? { id: q.data.requesterId, name: "Requester", email: "r@x.com", avatar: null, handle: "requester" } : undefined };
      },
      update: async (q: any) => {
        const rows = me._data[table];
        const idx = rows.findIndex((r: any) => r.id === q.where.id);
        if (idx === -1) throw new NotFoundException("not found");
        rows[idx] = { ...rows[idx], ...q.data };
        return rows[idx];
      },
      upsert: async (q: any) => {
        return { id: me.nextId("u"), ...q.create, grantedAt: new Date(), isActive: true };
      },
    };
  }

  _match(r: any, where: any): boolean {
    if (!where) return true;
    // Handle OR — any subcondition is sufficient
    if (Array.isArray(where.OR)) {
      const anyHit = where.OR.some((sub: any) => this._match(r, sub));
      if (!anyHit) return false;
    }
    for (const k of Object.keys(where)) {
      if (k === "OR") continue;
      const wv = where[k];
      if (wv === null) {
        // Field must be null (or undefined)
        if (r[k] !== null && r[k] !== undefined) return false;
        continue;
      }
      if (wv && typeof wv === "object" && "not" in wv && wv.not === null) {
        // Field must be non-null
        if (r[k] === null || r[k] === undefined) return false;
        continue;
      }
      if (wv && typeof wv === "object" && "lt" in wv) {
        const rv = r[k];
        if (rv === null || rv === undefined) return false;
        const rvTime = rv instanceof Date ? rv.getTime() : rv;
        const ltTime = wv.lt instanceof Date ? wv.lt.getTime() : wv.lt;
        if (!(rvTime < ltTime)) return false;
        continue;
      }
      if (wv && typeof wv === "object" && "gt" in wv) {
        const rv = r[k];
        if (rv === null || rv === undefined) return false;
        const rvTime = rv instanceof Date ? rv.getTime() : rv;
        const gtTime = wv.gt instanceof Date ? wv.gt.getTime() : wv.gt;
        if (!(rvTime > gtTime)) return false;
        continue;
      }
      if (wv && typeof wv === "object" && wv.contains) {
        const rv = (r[k] ?? "").toString().toLowerCase();
        if (!rv.includes(wv.contains.toLowerCase())) return false;
        continue;
      }
      if (r[k] !== wv) return false;
    }
    return true;
  }

  get accessRequest() { return this.genericFind("accessRequest") as any; }
  get userResourceAccess() { return this.genericFind("userResourceAccess") as any; }
  get rbacRole() { return this.genericFind("rbacRole") as any; }
  get resourcePermission() { return this.genericFind("resourcePermission") as any; }
  get auditLog() { return this.genericFind("auditLog") as any; }
  get supportTicket() { return this.genericFind("supportTicket") as any; }
  get article() { return this.genericFind("article") as any; }
  get highlight() { return this.genericFind("highlight") as any; }
  get user() { return this.genericFind("user") as any; }
  get tag() { return this.genericFind("tag") as any; }

  seedTable(table: string, row: any) {
    // If caller already supplied an id, use it instead of auto-generating so tests
    // can predict id-based lookups (Scenario 7/§4.1 search by exact ID).
    const id = row?.id ?? this.nextId(table.slice(0, 3));
    const payload = { ...row };
    delete payload.id;
    const r = { id, createdAt: new Date(), updatedAt: new Date(), ...payload };
    this._data[table].push(r);
    return r;
  }
}

class MockCacheFull {
  store: Map<string, { v: any; ttl: number; ts: number }> = new Map();
  deleted: string[] = [];
  async get(k: string) {
    const e = this.store.get(k);
    if (!e) return undefined;
    if (e.ts + e.ttl < Date.now()) { this.store.delete(k); return undefined; }
    return e.v;
  }
  async set(k: string, v: any, ttlSec = 300) { this.store.set(k, { v, ttl: ttlSec * 1000, ts: Date.now() }); }
  async del(k: string) { this.deleted.push(k); this.store.delete(k); }
  reset() { this.store.clear(); this.deleted = []; }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("AccessRequestsService — NEW scenarios (TDD RED first)", () => {
  let service: AccessRequestsService;
  let prisma: MockPrismaLite;
  let cache: MockCacheFull;

  beforeEach(async () => {
    prisma = new MockPrismaLite();
    cache = new MockCacheFull();
    const mod = await Test.createTestingModule({
      providers: [
        AccessRequestsService,
        { provide: PrismaService, useValue: prisma },
        { provide: CacheService, useValue: cache },
      ],
    }).compile();
    service = mod.get(AccessRequestsService);
  });

  // ── §4.3 & Scenario 16 (validation): temporary access must expire in FUTURE ──
  describe("createRequest — temporary expiry FUTURE validation", () => {
    it("throws BadRequestException when expiresAt is in the past (Scenario 16-18)", async () => {
      const startsAt = new Date(Date.now() - 3 * 60 * 60 * 1000);  // 3h ago
      const expiresAt = new Date(Date.now() - 1 * 60 * 60 * 1000); // 1h ago (still past)
      await expect(
        service.createRequest({
          requesterId: "u1",
          resourceType: "api",
          permissionKey: "api:read",
          type: AccessRequestType.TEMPORARY,
          justification: "Valid justification string",
          startsAt,
          expiresAt,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("accepts temporary dates both in future with duration >= 30m", async () => {
      const startsAt = new Date(Date.now() + 1 * 60 * 60 * 1000);
      const expiresAt = new Date(Date.now() + 3 * 60 * 60 * 1000);
      const r = await service.createRequest({
        requesterId: "u1",
        resourceType: "api",
        permissionKey: "api:read",
        type: AccessRequestType.TEMPORARY,
        justification: "Need temp api access for testing workflow",
        startsAt,
        expiresAt,
      });
      expect(r.status).toBe(AccessRequestStatus.PENDING);
    });
  });

  // ── §4.2 createRoleRequest must validate justification >= 5 chars ─────────
  describe("createRoleRequest — justification validation", () => {
    beforeEach(() => {
      prisma.seedTable("rbacRole", { key: "MODERATOR", name: "Moderator" });
    });
    it("throws BadRequestException when justification is missing", async () => {
      await expect(
        (service as any).createRoleRequest("u1", {
          requestedRoleKey: "MODERATOR",
          type: AccessRequestType.PERMANENT,
          justification: "",
        } as any),
      ).rejects.toThrow(BadRequestException);
    });
    it("throws BadRequestException when justification is shorter than 5 chars (Scenario 16)", async () => {
      await expect(
        (service as any).createRoleRequest("u1", {
          requestedRoleKey: "MODERATOR",
          type: AccessRequestType.PERMANENT,
          justification: "abc",
        } as any),
      ).rejects.toThrow(BadRequestException);
    });
    it("throws NotFoundException when role key does not exist", async () => {
      await expect(
        (service as any).createRoleRequest("u1", {
          requestedRoleKey: "NON_EXISTENT_ROLE",
          type: AccessRequestType.PERMANENT,
          justification: "Need this role badly",
        } as any),
      ).rejects.toThrow(NotFoundException);
    });
    it("returns PENDING for valid permanent role request", async () => {
      const r = await (service as any).createRoleRequest("u1", {
        requestedRoleKey: "MODERATOR",
        type: AccessRequestType.PERMANENT,
        justification: "Need to moderate content section, handling user reports",
      });
      expect(r.status).toBe("PENDING");
      expect(r.resourceType).toBe("role");
      expect(r.resourceId).toBe("MODERATOR");
    });
    it("prevents duplicate PENDING role request (Scenario 3)", async () => {
      await (service as any).createRoleRequest("u1", {
        requestedRoleKey: "MODERATOR",
        type: AccessRequestType.PERMANENT,
        justification: "Justification here for first submission",
      });
      await expect(
        (service as any).createRoleRequest("u1", {
          requestedRoleKey: "MODERATOR",
          type: AccessRequestType.PERMANENT,
          justification: "Same role submitted again",
        } as any),
      ).rejects.toThrow(/already have a pending request for this role/);
    });
  });

  // ── §4.3 createResourceRequest must use BadRequestException, not Error ─────
  describe("createResourceRequest — validation uses Nest exceptions (Scenario 16)", () => {
    it("throws BadRequestException for unsupported resource type (not generic Error)", async () => {
      await expect(
        (service as any).createResourceRequest("u1", {
          resourceType: "rocket_ship",
          resourceId: "r1",
          permission: "read",
          justification: "This should be 400 BadRequestException",
          type: AccessRequestType.PERMANENT,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
    it("throws BadRequestException for unsupported permission", async () => {
      await expect(
        (service as any).createResourceRequest("u1", {
          resourceType: "article",
          resourceId: "a1",
          permission: "take_ownership",
          justification: "This should be 400 BadRequestException",
          type: AccessRequestType.PERMANENT,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
    it("throws BadRequestException when justification < 5 chars", async () => {
      await expect(
        (service as any).createResourceRequest("u1", {
          resourceType: "article",
          resourceId: "a1",
          permission: "read",
          justification: "n",
          type: AccessRequestType.PERMANENT,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  // ── §4.1 Search relevance scoring ──────────────────────────────────────────
  describe("searchResources — relevance scoring (§4.1 exact/partial/description)", () => {
    beforeEach(() => {
      prisma.seedTable("article", {
        id: "art-exact",
        title: "API Authentication Guide",
        slug: "api-authentication-guide",
        excerpt: "covers jwt, oauth, sessions",
        isPublished: true,
      });
      prisma.seedTable("article", {
        id: "art-partial",
        title: "Payment API Webhook",
        slug: "payment-api-webhook",
        excerpt: "How to implement",
        isPublished: true,
      });
    });
    it("places exact ID matches ABOVE partial title matches (exact ID = 100 score)", async () => {
      const results = await service.searchResources("u-nevermind", "art-exact", 10);
      expect(results.length).toBeGreaterThanOrEqual(1);
      if (results.length >= 2) {
        // Relevance means the article with id==="art-exact" should rank first (not newest)
        const idxExact = results.findIndex((r: any) => r.id === "art-exact");
        const idxPartial = results.findIndex((r: any) => r.id === "art-partial");
        expect(idxExact).toBeLessThan(idxPartial);
      }
    });
    it("includes `score` or orders by exact title first before partial", async () => {
      prisma.seedTable("article", {
        id: "art-title-exact",
        title: "api",
        slug: "api",
        excerpt: "short",
        isPublished: true,
      });
      const results = await service.searchResources("u1", "api", 10);
      // "api" exact title first (score 80) before partial title Payment API (score 50)
      const idxExact = results.findIndex((r: any) => r.id === "art-title-exact");
      const idxPartial = results.findIndex((r: any) => r.id === "art-partial");
      // Index of exact title must be lower than partial
      expect(idxExact).toBeLessThan(idxPartial);
    });
  });

  // ── §3.2 Caching — search TTL 5min ─────────────────────────────────────────
  describe("searchResources caching (§3.1, 5-minute TTL)", () => {
    it("second identical query reuses cache (sets + reads cache)", async () => {
      // Primes the cache then calls again — second call should read from cache so prisma query path
      // should only be called once (we can verify via cache store non-empty)
      await service.searchResources("u1", "API", 20);
      await service.searchResources("u1", "API", 20);
      const hasSearchKey = [...cache.store.keys()].some(k => k.startsWith("search:api:"));
      expect(hasSearchKey).toBe(true);
      // Verify cache returns valid cached results:
      const entry = [...cache.store.entries()].find(([k]) => k.startsWith("search:api:"));
      expect(entry).toBeTruthy();
      const [, v] = entry as any;
      expect(Array.isArray(v.v)).toBe(true);
    });
  });

  // ── §3.2 Caching — checkAccess TTL 30s ─────────────────────────────────────
  describe("checkAccess caching (§3.1, 30-second TTL)", () => {
    it("stores check results in cache with key starting access-check:", async () => {
      // Seed access row
      prisma.seedTable("userResourceAccess", {
        userId: "u1",
        resourceType: "tickets",
        resourceId: "t1",
        permissionKey: "tickets:view",
        isActive: true,
        expiresAt: null,
      });
      const r = await service.checkAccess("u1", "tickets", "t1", "tickets:view");
      expect(typeof r).toBe("boolean");
      const keys = [...cache.store.keys()];
      const hasAccessKey = keys.some(k => k.startsWith("access-check:"));
      expect(hasAccessKey).toBe(true);
    });
  });

  // ── §3.3 Rate limiting — 30/min search ─────────────────────────────────────
  describe("searchResources rate limiting (§3.3, 30/min sliding window)", () => {
    it("enforces max 30 identical requests per user per minute", async () => {
      // The real service.checkRateLimit(userId) should throw when > 30/min
      const method = (service as any).checkRateLimit;
      if (typeof method !== "function") {
        // Missing feature — RED
        throw new Error("checkRateLimit method not yet implemented on AccessRequestsService");
      }
      // Bind to service so `this` refers to the instance (preserves searchRateWindow map)
      const bound = method.bind(service);
      // Simulate 30 calls → pass; 31st should throw
      for (let i = 0; i < 30; i++) bound("u-limited");
      expect(() => bound("u-limited")).toThrow();
    });
  });

  // ── §14 My-access filters expired + inactive rows (Scenario 14) ────────────
  describe("getUserResourceAccess — excludes expired (Scenario 14)", () => {
    it("returns 0 rows when only expired access exists (hasAccess=false after expire)", async () => {
      prisma.seedTable("userResourceAccess", {
        userId: "u1",
        resourceType: "tickets",
        permissionKey: "tickets:view",
        expiresAt: new Date(Date.now() - 1000),
        isActive: true,
      });
      const rows = await service.getUserResourceAccess("u1");
      expect(Array.isArray(rows)).toBe(true);
      expect(rows).toHaveLength(0);
    });
  });
});
