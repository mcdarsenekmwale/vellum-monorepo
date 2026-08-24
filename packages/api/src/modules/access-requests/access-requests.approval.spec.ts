import { Test } from "@nestjs/testing";
import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { AccessRequestStatus, AccessRequestType } from "@prisma/client";
import { AccessRequestsService } from "./access-requests.service";
import { PrismaService } from "../../shared/prisma/prisma.service";
import { CacheService } from "../../shared/cache/cache.service";
import { NotificationsService } from "../notifications/notifications.service";

// ─── Minimal mocks ──────────────────────────────────────────────────────────

class MockPrismaApproval {
  private _data: Record<string, any[]> = {
    accessRequest: [],
    userResourceAccess: [],
    rbacRole: [
      // Used by role request scenarios
      { id: "r1", key: "MODERATOR", name: "Moderator" },
    ],
    user: [
      // Requester and admin users
      { id: "u-req", name: "Requester", email: "req@x.com", role: "USER", isActive: true, handle: "req", avatar: null },
      { id: "u-admin", name: "Admin", email: "adm@x.com", role: "ADMIN", isActive: true, handle: "admin", avatar: null },
    ],
    resourcePermission: [],
    auditLog: [],
    supportTicket: [{ id: "t1", ticketNumber: "T-100", subject: "Ticket subject", priority: "HIGH", status: "OPEN" }],
    article: [{ id: "a1", title: "Article title", slug: "a1", isPublished: true }],
    highlight: [],
    tag: [],
  };
  private _counter = 100;
  $transaction = async <T>(fn: (tx: any) => Promise<T>): Promise<T> => fn(this as any);

  private nextId(prefix: string) { return `${prefix}-${++this._counter}`; }

  genericFind(table: string) {
    const me = this as any;
    return {
      findMany: async (q: any) => {
        const rows = me._data[table] ?? [];
        const where = q?.where;
        let result = rows.filter((r: any) => me._match(r, where));
        if (q?.take) result = result.slice(0, q.take);
        if (q?.skip) result = result.slice(q.skip);
        return result;
      },
      findUnique: async (q: any) => {
        const rows = me._data[table] ?? [];
        const where = q?.where ?? {};
        // Handle compound unique keys (objects like the prisma { uniqueConstraintName: {...} })
        for (const v of Object.values(where)) {
          if (v && typeof v === "object" && !Array.isArray(v) && v instanceof Date === false) {
            // Compound key lookup - match all fields
            return rows.find((r: any) => me._match(r, v)) ?? null;
          }
        }
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
        const row = { id: me.nextId(table.slice(0, 3)), ...q.data, createdAt: new Date(), updatedAt: new Date() };
        me._data[table].push(row);
        // Resolve relations for select fields
        const requester = q.data?.requesterId ? me._data.user.find((u: any) => u.id === q.data.requesterId) ?? null : null;
        const reviewer = q.data?.reviewerId ? me._data.user.find((u: any) => u.id === q.data.reviewerId) ?? null : null;
        const history = q.data?.history?.create
          ? [{ actor: requester, actorId: q.data.history.create.actorId, ...q.data.history.create, id: me.nextId("h"), createdAt: new Date() }]
          : [];
        return { ...row, requester, reviewer, history };
      },
      update: async (q: any) => {
        const rows = me._data[table];
        const idx = rows.findIndex((r: any) => r.id === q.where.id);
        if (idx === -1) throw new NotFoundException("not found");
        rows[idx] = { ...rows[idx], ...q.data, updatedAt: new Date() };
        const requester = rows[idx].requesterId ? me._data.user.find((u: any) => u.id === rows[idx].requesterId) ?? null : null;
        const reviewer = rows[idx].reviewerId ? me._data.user.find((u: any) => u.id === rows[idx].reviewerId) ?? null : null;
        const history: any[] = Array.isArray(rows[idx].history) ? rows[idx].history : [];
        if (q.data?.history?.create) {
          const hActor = me._data.user.find((u: any) => u.id === q.data.history.create.actorId) ?? null;
          history.unshift({ id: me.nextId("h"), actor: hActor, ...q.data.history.create, createdAt: new Date() });
          rows[idx].history = history;
        }
        return { ...rows[idx], requester, reviewer, history };
      },
      upsert: async (q: any) => {
        const rows = me._data[table];
        // Build where fields (compound or simple)
        const where = q.where ?? {};
        let selector: Record<string, any> = {};
        for (const v of Object.values(where)) {
          if (v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date)) {
            selector = { ...v };
            break;
          }
        }
        const idx = rows.findIndex((r: any) => Object.entries(selector).every(([k, val]) => r[k] === val));
        const payload = idx === -1 ? q.create : q.update;
        const final = {
          id: idx === -1 ? me.nextId(table === "user" ? "u" : table[0]) : rows[idx].id,
          createdAt: idx === -1 ? new Date() : rows[idx].createdAt,
          updatedAt: new Date(),
          ...payload,
        };
        if (idx === -1) rows.push(final); else rows[idx] = { ...rows[idx], ...final };
        return final;
      },
      delete: async (q: any) => {
        const rows = me._data[table];
        const idx = rows.findIndex((r: any) => r.id === q.where.id);
        if (idx === -1) throw new NotFoundException("not found");
        return rows.splice(idx, 1)[0];
      },
      updateMany: async (q: any) => {
        const rows = me._data[table] ?? [];
        let count = 0;
        for (let i = 0; i < rows.length; i++) {
          if (me._match(rows[i], q.where)) {
            rows[i] = { ...rows[i], ...q.data, updatedAt: new Date() };
            count++;
          }
        }
        return { count };
      },
      deleteMany: async (q: any) => {
        const rows = me._data[table] ?? [];
        me._data[table] = rows.filter((r: any) => !me._match(r, q.where));
        return { count: rows.length - me._data[table].length };
      },
    };
  }

  _match(r: any, where: any): boolean {
    if (!where) return true;
    if (Array.isArray(where.OR)) {
      const anyHit = where.OR.some((sub: any) => this._match(r, sub));
      if (!anyHit) return false;
    }
    for (const k of Object.keys(where)) {
      if (k === "OR") continue;
      const wv = where[k];
      if (wv === null) { if (r[k] !== null && r[k] !== undefined) return false; continue; }
      if (wv && typeof wv === "object" && "not" in wv && wv.not === null) { if (r[k] === null || r[k] === undefined) return false; continue; }
      if (wv && typeof wv === "object" && "lt" in wv) {
        const rv = r[k]; if (rv == null) return false;
        const rvT = rv instanceof Date ? rv.getTime() : rv; const ltT = wv.lt instanceof Date ? wv.lt.getTime() : wv.lt;
        if (!(rvT < ltT)) return false; continue;
      }
      if (wv && typeof wv === "object" && "gt" in wv) {
        const rv = r[k]; if (rv == null) return false;
        const rvT = rv instanceof Date ? rv.getTime() : rv; const gtT = wv.gt instanceof Date ? wv.gt.getTime() : wv.gt;
        if (!(rvT > gtT)) return false; continue;
      }
      if (wv && typeof wv === "object" && wv.contains) {
        const rv = (r[k] ?? "").toString().toLowerCase();
        if (!rv.includes(wv.contains.toString().toLowerCase())) return false; continue;
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
    const id = row?.id ?? this.nextId(table.slice(0, 3));
    const payload = { ...row }; delete payload.id;
    const r = { id, createdAt: new Date(), updatedAt: new Date(), ...payload };
    this._data[table].push(r); return r;
  }

  directRows(table: string) { return this._data[table] ?? []; }
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

/** Fake notification service: tracks calls instead of sending */
class MockNotificationsService {
  calls: Array<{ userId: string; kind: string; title: string; body: string }> = [];
  async createNotification(p: any) { this.calls.push(p); return { id: "n-" + (this.calls.length + 1) }; }
}

// ─── Describe approval flow tests (TDD RED → GREEN) ──────────────────────

describe("AccessRequestsService · APPROVAL / REJECTION flow — Production-hardening tests", () => {
  let service: AccessRequestsService;
  let prisma: MockPrismaApproval;
  let cache: MockCacheFull;
  let notifications: MockNotificationsService;

  beforeEach(async () => {
    prisma = new MockPrismaApproval();
    cache = new MockCacheFull();
    notifications = new MockNotificationsService();
    const mod = await Test.createTestingModule({
      providers: [
        AccessRequestsService,
        { provide: PrismaService, useValue: prisma },
        { provide: CacheService, useValue: cache },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();
    service = mod.get(AccessRequestsService);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // §A approveRequest — production-critical scenarios
  // ─────────────────────────────────────────────────────────────────────────────
  describe("approveRequest", () => {
    it("BUG #6 (RED first): throws ForbiddenException when reviewerId is not admin (service-side zero-trust)", async () => {
      const req = await service.createRequest({
        requesterId: "u-req", resourceType: "tickets",
        permissionKey: "tickets:read", type: AccessRequestType.PERMANENT,
        justification: "Need read access",
      });
      // Reviewer is regular user (not admin)
      await expect(
        service.approveRequest({ requestId: req.id, reviewerId: "u-req", adminJustification: "" }),
      ).rejects.toThrow(ForbiddenException);
      // Second case: DIFFERENT non-admin user — still must be admin
      const req2 = await service.createRequest({
        requesterId: "u-other", resourceType: "tickets", permissionKey: "tickets:write",
        type: AccessRequestType.PERMANENT, justification: "Need write",
      });
      await expect(
        service.approveRequest({ requestId: req2.id, reviewerId: "u-nonadmin", adminJustification: "" }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("BUG #5 (instantiation): Constructor works WITHOUT providing NotificationsService (fallback to no-op)", async () => {
      // When the testing module does NOT provide NotificationsService, compilation must succeed
      // (constructor should mark it @Optional())
      const mod2 = await Test.createTestingModule({
        providers: [
          AccessRequestsService,
          { provide: PrismaService, useValue: new MockPrismaApproval() },
          { provide: CacheService, useValue: new MockCacheFull() },
        ],
      }).compile();
      const svc = mod2.get(AccessRequestsService);
      expect(typeof (svc as any).approveRequest).toBe("function");
    });

    it("Scenario 10: Approve PENDING ticket request → status=APPROVED + userResourceAccess.isActive=true + correct expiresAt", async () => {
      const req = await service.createRequest({
        requesterId: "u-req", resourceType: "tickets",
        permissionKey: "tickets:read", type: AccessRequestType.PERMANENT,
        justification: "Need access to read tickets",
      });
      const approved = await service.approveRequest({
        requestId: req.id, reviewerId: "u-admin", adminJustification: "Granted",
      });
      expect(approved.status).toBe(AccessRequestStatus.APPROVED);
      expect(approved.reviewerId).toBe("u-admin");
      expect(approved.adminJustification).toBe("Granted");
      // Verify grant row in userResourceAccess
      const grants = prisma.directRows("userResourceAccess");
      const grant = grants.find((g: any) => g.userId === "u-req" && g.permissionKey === "tickets:read");
      expect(grant).toBeDefined();
      expect(grant.isActive).toBe(true);
      expect(grant.resourceType).toBe("tickets");
    });

    it("BUG #9: TEMPORARY grant — when request has startsAt in FUTURE, grant.isActive should be false until startsAt; expiresAt should match request", async () => {
      const startsAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2h future
      const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8h future
      const req = await service.createRequest({
        requesterId: "u-req", resourceType: "api",
        permissionKey: "api:read", type: AccessRequestType.TEMPORARY,
        justification: "Temporary access for release", startsAt, expiresAt,
      });
      await service.approveRequest({ requestId: req.id, reviewerId: "u-admin", adminJustification: "" });
      const grants = prisma.directRows("userResourceAccess");
      const grant = grants.find((g: any) => g.permissionKey === "api:read" && g.userId === "u-req");
      expect(grant).toBeDefined();
      // Expected: when NOW < startsAt, grant should NOT be active yet (isActive=false)
      expect(grant.isActive).toBe(false);
      // Also expiresAt should be preserved with request value
      expect(grant.expiresAt).toEqual(expiresAt);
    });

    it("BUG #3: Approve → then REVOKE (re-approve rejected-path) should deactivate prior userResourceAccess row", async () => {
      // First approve a PENDING request
      const req = await service.createRequest({
        requesterId: "u-req", resourceType: "articles",
        permissionKey: "articles:write", type: AccessRequestType.PERMANENT,
        justification: "Need to edit articles",
      });
      await service.approveRequest({ requestId: req.id, reviewerId: "u-admin", adminJustification: "OK by policy" });
      // Verify active grant exists
      let grants = prisma.directRows("userResourceAccess");
      expect(grants.some((g: any) => g.permissionKey === "articles:write" && g.isActive === true)).toBe(true);
      // Now revoke via explicit revocation method (BUG #3: if admin revokes, grant must flip to inactive)
      await service.revokeApprovedRequest(req.id, "u-admin", "Revoked for audit policy compliance");
      grants = prisma.directRows("userResourceAccess");
      expect(grants.find((g: any) => g.permissionKey === "articles:write")?.isActive).toBe(false);
    });

    it("BUG #4a: Approve → approval notification actually SENT to requester", async () => {
      notifications.calls = [];
      const req = await service.createRequest({
        requesterId: "u-req", resourceType: "analytics",
        permissionKey: "analytics:read", type: AccessRequestType.PERMANENT,
        justification: "I need analytics",
      });
      await service.approveRequest({ requestId: req.id, reviewerId: "u-admin", adminJustification: "Granted" });
      const approvalCall = notifications.calls.find((c: any) => c.title.includes("approved") || c.kind === "ACCESS_APPROVED");
      expect(approvalCall).toBeDefined();
      expect(approvalCall.userId).toBe("u-req");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // §B rejectRequest
  // ─────────────────────────────────────────────────────────────────────────────
  describe("rejectRequest", () => {
    it("Scenario 11: Reject PENDING with min justification → status REJECTED", async () => {
      const req = await service.createRequest({
        requesterId: "u-req", resourceType: "settings",
        permissionKey: "settings:read", type: AccessRequestType.PERMANENT,
        justification: "Settings access",
      });
      const rejected = await service.rejectRequest({
        requestId: req.id, reviewerId: "u-admin", adminJustification: "Not needed right now",
      });
      expect(rejected.status).toBe(AccessRequestStatus.REJECTED);
      expect(rejected.adminJustification).toBe("Not needed right now");
    });

    it("Scenario 11: Reject with short justification → BadRequestException (min 3 chars required)", async () => {
      const req = await service.createRequest({
        requesterId: "u-req", resourceType: "bots",
        permissionKey: "bots:read", type: AccessRequestType.PERMANENT,
        justification: "Bots access",
      });
      await expect(
        service.rejectRequest({ requestId: req.id, reviewerId: "u-admin", adminJustification: "no" }),
      ).rejects.toThrow(BadRequestException);
    });

    it("BUG #4b: Reject → rejection notification SENT to requester", async () => {
      notifications.calls = [];
      const req = await service.createRequest({
        requesterId: "u-req", resourceType: "knowledge_base",
        permissionKey: "knowledge_base:admin", type: AccessRequestType.PERMANENT,
        justification: "KB admin access",
      });
      await service.rejectRequest({ requestId: req.id, reviewerId: "u-admin", adminJustification: "Requires manager approval first" });
      const rejCall = notifications.calls.find((c: any) => c.kind === "ACCESS_REJECTED" || c.title.includes("reject"));
      expect(rejCall).toBeDefined();
      expect(rejCall.userId).toBe("u-req");
    });

    it("BUG #6b: rejectRequest is also zero-trust: non-admin reviewer throws Forbidden", async () => {
      const req = await service.createRequest({
        requesterId: "u-req", resourceType: "users",
        permissionKey: "users:read", type: AccessRequestType.PERMANENT,
        justification: "Need to see users",
      });
      await expect(
        service.rejectRequest({ requestId: req.id, reviewerId: "u-other", adminJustification: "Nope not admin" }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // §C Bulk approve / reject
  // ─────────────────────────────────────────────────────────────────────────────
  describe("bulk operations", () => {
    it("Scenario 12: bulkApproveMany → 2 requests approve, 1 not pending → correct counts", async () => {
      // Justifications must be >= 5 chars
      const r1 = await service.createRequest({ requesterId: "u-req", resourceType: "api", permissionKey: "api:read", type: AccessRequestType.PERMANENT, justification: "j1_req" });
      const r2 = await service.createRequest({ requesterId: "u-req", resourceType: "api", permissionKey: "api:write", type: AccessRequestType.PERMANENT, justification: "j2_req" });
      const r3 = await service.createRequest({ requesterId: "u-req", resourceType: "api", permissionKey: "api:delete", type: AccessRequestType.PERMANENT, justification: "j3_req" });
      // Approve r3 first (so it's no longer pending)
      await service.approveRequest({ requestId: r3.id, reviewerId: "u-admin", adminJustification: "" });
      const result = await service.bulkApproveMany([r1.id, r2.id, r3.id, "missing-id"], "u-admin", "bulk ok");
      expect(result.approved).toBe(2);
      expect(result.failed).toBe(2); // r3 not pending + missing-id
      expect(result.total).toBe(4);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // §D Permission key normalization during resource request → approval flow
  // ─────────────────────────────────────────────────────────────────────────────
  describe("Resource request permission KEY normalization (BUG #2)", () => {
    it("createResourceRequest('read') stores permissionKey as 'tickets:read' (canonical plural prefix form) so approve→access checks succeed", async () => {
      // When the frontend sends permission="read" (short form) + resourceType="ticket" (singular),
      // the service must normalize to the canonical form with plural resourceType prefix: tickets:read
      // so downstream userResourceAccess unique key & checkAccess queries line up correctly.
      const created = await service.createResourceRequest("u-req", {
        resourceType: "ticket", resourceId: "t1", permission: "read",
        justification: "Short permission test (5 chars)", type: AccessRequestType.PERMANENT,
      });
      // BUG #2 expectation: permissionKey must be normalized to plural prefix form, NOT plain "read"
      expect(created.permissionKey).toBe("tickets:read");

      // Approve it
      await service.approveRequest({ requestId: created.id, reviewerId: "u-admin", adminJustification: "" });

      // Check access must return true using matching (canonical plural) key
      const has = await service.checkAccess("u-req", "tickets", "t1", "tickets:read");
      expect(has).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // §E deleteRequest authorization guard (BUG #7)
  // ─────────────────────────────────────────────────────────────────────────────
  describe("deleteRequest zero-trust", () => {
    it("BUG #7 (RED first): deleteRequest rejects non-admin actor with ForbiddenException", async () => {
      const req = await service.createRequest({
        requesterId: "u-req", resourceType: "api", permissionKey: "api:read",
        type: AccessRequestType.PERMANENT, justification: "Access need",
      });
      // Service signature will be updated to: deleteRequest(id, actorId) for zero-trust
      await expect(
        (service.deleteRequest as any)(req.id, "u-req"),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
