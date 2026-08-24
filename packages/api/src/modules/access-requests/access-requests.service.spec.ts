import { Test } from "@nestjs/testing";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import {
  AccessRequestStatus,
  AccessRequestType,
} from "@prisma/client";
import { AccessRequestsService } from "./access-requests.service";
import { PrismaService } from "../../shared/prisma/prisma.service";
import { CacheService } from "../../shared/cache/cache.service";

// ─── Types ────────────────────────────────────────────────────────────────────

type AccessRequestRow = {
  id: string;
  requesterId: string;
  reviewerId: string | null;
  resourceType: string;
  resourceId: string | null;
  permissionKey: string;
  type: AccessRequestType;
  status: AccessRequestStatus;
  justification: string;
  adminJustification: string | null;
  startsAt: Date | null;
  expiresAt: Date | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  history?: any[];
};

type UserResourceAccessRow = {
  id: string;
  userId: string;
  resourceType: string;
  resourceId: string | null;
  permissionKey: string;
  grantedAt: Date;
  grantedBy: string | null;
  expiresAt: Date | null;
  isActive: boolean;
};

// ─── Mock Prisma ──────────────────────────────────────────────────────────────

class MockPrisma {
  private _requests: AccessRequestRow[] = [];
  private _access: UserResourceAccessRow[] = [];
  private _resourcePermissions: any[] = [];
  private _users: Array<{ id: string; name: string; email: string; role: string; isActive: boolean; handle: string; avatar: null }> = [
    { id: "u1", name: "Requester", email: "r@x.com", role: "USER", isActive: true, handle: "requester", avatar: null },
    { id: "u2", name: "Admin", email: "a@x.com", role: "ADMIN", isActive: true, handle: "admin", avatar: null },
  ];
  auditLogs: any[] = [];
  private _idCounter = 0;

  $transaction = async <T>(fn: (tx: any) => Promise<T>): Promise<T> => fn(this as any);

  private nextId(prefix: string) {
    return `${prefix}-${++this._idCounter}`;
  }

  get accessRequest() {
    const ctx = this;
    return {
      findFirst: async (q: any) => {
        const where = q?.where ?? {};
        return (
          ctx._requests.find((r) => {
            if (where.id && r.id !== where.id) return false;
            if (where.requesterId && r.requesterId !== where.requesterId) return false;
            if (where.resourceType && r.resourceType !== where.resourceType) return false;
            if (where.permissionKey && r.permissionKey !== where.permissionKey) return false;
            if (where.status && r.status !== where.status) return false;
            return true;
          }) ?? null
        );
      },
      findUnique: async (q: any) => {
        const id = q?.where?.id;
        return ctx._requests.find((r) => r.id === id) ?? null;
      },
      findMany: async (q: any) => {
        const where = q?.where ?? {};
        let result = ctx._requests.filter((r) => {
          if (where.id && r.id !== where.id) return false;
          if (where.requesterId && r.requesterId !== where.requesterId) return false;
          if (where.status && r.status !== where.status) return false;
          if (where.resourceType && r.resourceType !== where.resourceType) return false;
          return true;
        });
        // sort
        const orderBy = q?.orderBy;
        if (orderBy) {
          const field = Object.keys(orderBy)[0];
          const dir = orderBy[field];
          result = [...result].sort((a: any, b: any) => {
            const av = a[field];
            const bv = b[field];
            if (av < bv) return dir === "asc" ? -1 : 1;
            if (av > bv) return dir === "asc" ? 1 : -1;
            return 0;
          });
        }
        // pagination
        const skip = q?.skip ?? 0;
        const take = q?.take ?? result.length;
        return result.slice(skip, skip + take);
      },
      count: async (q: any) => {
        const where = q?.where ?? {};
        return ctx._requests.filter((r) => {
          if (where.id && r.id !== where.id) return false;
          if (where.requesterId && r.requesterId !== where.requesterId) return false;
          if (where.status && r.status !== where.status) return false;
          if (where.resourceType && r.resourceType !== where.resourceType) return false;
          return true;
        }).length;
      },
      create: async (q: any) => {
        const d = q.data;
        const row: AccessRequestRow = {
          id: ctx.nextId("ar"),
          requesterId: d.requesterId,
          reviewerId: null,
          resourceType: d.resourceType,
          resourceId: d.resourceId ?? null,
          permissionKey: d.permissionKey,
          type: d.type,
          status: d.status ?? AccessRequestStatus.PENDING,
          justification: d.justification,
          adminJustification: null,
          startsAt: d.startsAt ?? null,
          expiresAt: d.expiresAt ?? null,
          reviewedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          history: d.history?.create
            ? [{ actorId: d.history.create.actorId, transition: d.history.create.transition, reason: d.history.create.reason, createdAt: new Date() }]
            : [],
        };
        ctx._requests.push(row);
        return { ...row, requester: { id: "u1", name: "Test", email: "t@x.com", avatar: null, handle: "test" }, reviewer: null };
      },
      update: async (q: any) => {
        const id = q.where.id;
        const idx = ctx._requests.findIndex((r) => r.id === id);
        if (idx === -1) throw new Error("not found");
        const d = q.data;
        // Exclude nested relation creates (e.g. history) from the flat spread
        const { history: _hist, ...rest } = d;
        ctx._requests[idx] = {
          ...ctx._requests[idx],
          ...rest,
        };
        if (d.history?.create) {
          ctx._requests[idx].history = [
            ...(ctx._requests[idx].history ?? []),
            { actorId: d.history.create.actorId, transition: d.history.create.transition, reason: d.history.create.reason, createdAt: new Date() },
          ];
        }
        return {
          ...ctx._requests[idx],
          requester: { id: "u1", name: "Test", email: "t@x.com", avatar: null, handle: "test" },
          reviewer: ctx._requests[idx].reviewerId
            ? { id: ctx._requests[idx].reviewerId!, name: "Admin", email: "a@x.com" }
            : null,
        };
      },
      delete: async (q: any) => {
        const id = q.where.id;
        const idx = ctx._requests.findIndex((r) => r.id === id);
        if (idx === -1) throw new Error("not found");
        ctx._requests.splice(idx, 1);
        return { id };
      },
    } as any;
  }

  get userResourceAccess() {
    const ctx = this;
    return {
      findMany: async (q: any) => {
        const where = q?.where ?? {};
        return ctx._access.filter((a) => {
          if (where.isActive !== undefined && a.isActive !== where.isActive) return false;
          if (where.expiresAt?.lt && a.expiresAt && a.expiresAt >= where.expiresAt.lt) return false;
          if (where.expiresAt?.not === null && a.expiresAt === null) return false;
          return true;
        });
      },
      upsert: async (q: any) => {
        const w = q.where?.UserResourceAccess_user_resource_perm_unique;
        if (w) {
          const idx = ctx._access.findIndex(
            (a) =>
              a.userId === w.userId &&
              a.resourceType === w.resourceType &&
              a.permissionKey === w.permissionKey,
          );
          if (idx !== -1) {
            ctx._access[idx] = { ...ctx._access[idx], ...q.update, isActive: true };
            return ctx._access[idx];
          }
        }
        const row: UserResourceAccessRow = {
          id: ctx.nextId("ura"),
          userId: q.create.userId,
          resourceType: q.create.resourceType,
          resourceId: q.create.resourceId ?? null,
          permissionKey: q.create.permissionKey,
          grantedAt: new Date(),
          grantedBy: q.create.grantedBy ?? null,
          expiresAt: q.create.expiresAt ?? null,
          isActive: q.create.isActive ?? true,
        };
        ctx._access.push(row);
        return row;
      },
      update: async (q: any) => {
        const id = q.where.id;
        const idx = ctx._access.findIndex((a) => a.id === id);
        if (idx === -1) throw new Error("not found");
        ctx._access[idx] = { ...ctx._access[idx], ...q.data };
        return ctx._access[idx];
      },
    } as any;
  }

  get resourcePermission() {
    const ctx = this;
    return {
      findMany: async (q: any) => {
        const where = q?.where ?? {};
        return ctx._resourcePermissions.filter((p) => {
          if (where.resourceType && p.resourceType !== where.resourceType) return false;
          return true;
        });
      },
    } as any;
  }

  get user() {
    const ctx = this;
    return {
      findUnique: async (q: any) => {
        const id = q?.where?.id;
        return ctx._users.find((u) => u.id === id) ?? null;
      },
      update: async (q: any) => {
        const id = q?.where?.id;
        const idx = ctx._users.findIndex((u) => u.id === id);
        if (idx === -1) throw new NotFoundException("not found");
        ctx._users[idx] = { ...ctx._users[idx], ...q.data };
        return ctx._users[idx];
      },
      findMany: async () => ctx._users.slice(),
    } as any;
  }

  get auditLog() {
    const ctx = this;
    return {
      create: async (q: any) => {
        ctx.auditLogs.push(q.data);
        return q.data;
      },
    } as any;
  }

  // Test helpers
  _seedRequest(partial: Partial<AccessRequestRow> & { requesterId: string; resourceType: string; permissionKey: string }): AccessRequestRow {
    const row: AccessRequestRow = {
      id: partial.id ?? this.nextId("ar"),
      requesterId: partial.requesterId,
      reviewerId: partial.reviewerId ?? null,
      resourceType: partial.resourceType,
      resourceId: partial.resourceId ?? null,
      permissionKey: partial.permissionKey,
      type: partial.type ?? AccessRequestType.PERMANENT,
      status: partial.status ?? AccessRequestStatus.PENDING,
      justification: partial.justification ?? "Test justification",
      adminJustification: partial.adminJustification ?? null,
      startsAt: partial.startsAt ?? null,
      expiresAt: partial.expiresAt ?? null,
      reviewedAt: partial.reviewedAt ?? null,
      createdAt: partial.createdAt ?? new Date(),
      updatedAt: new Date(),
      history: [],
    };
    this._requests.push(row);
    return row;
  }

  _seedAccess(partial: Partial<UserResourceAccessRow> & { userId: string; resourceType: string; permissionKey: string }): UserResourceAccessRow {
    const row: UserResourceAccessRow = {
      id: partial.id ?? this.nextId("ura"),
      userId: partial.userId,
      resourceType: partial.resourceType,
      resourceId: partial.resourceId ?? null,
      permissionKey: partial.permissionKey,
      grantedAt: partial.grantedAt ?? new Date(),
      grantedBy: partial.grantedBy ?? null,
      expiresAt: partial.expiresAt ?? null,
      isActive: partial.isActive ?? true,
    };
    this._access.push(row);
    return row;
  }

  _reset() {
    this._requests = [];
    this._access = [];
    this._resourcePermissions = [];
    this.auditLogs = [];
    this._idCounter = 0;
  }
}

class MockCache {
  deletedKeys: string[] = [];
  async del(key: string) {
    this.deletedKeys.push(key);
  }
  _reset() {
    this.deletedKeys = [];
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("AccessRequestsService", () => {
  let service: AccessRequestsService;
  let mockPrisma: MockPrisma;
  let mockCache: MockCache;

  beforeEach(async () => {
    mockPrisma = new MockPrisma();
    mockCache = new MockCache();

    const module = await Test.createTestingModule({
      providers: [
        AccessRequestsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CacheService, useValue: mockCache },
      ],
    }).compile();

    service = module.get(AccessRequestsService);
  });

  // ── §1 createRequest ────────────────────────────────────────────────────────

  describe("createRequest", () => {
    it("creates a PENDING request for valid permanent access", async () => {
      const result = await service.createRequest({
        requesterId: "u1",
        resourceType: "articles",
        permissionKey: "articles:edit",
        type: AccessRequestType.PERMANENT,
        justification: "Need to edit articles for the blog.",
      });

      expect(result.status).toBe(AccessRequestStatus.PENDING);
      expect(result.type).toBe(AccessRequestType.PERMANENT);
      expect(result.startsAt).toBeNull();
      expect(result.expiresAt).toBeNull();
    });

    it("creates a TEMPORARY request with valid dates", async () => {
      // Scenario 2 & 16-18: dates must be in FUTURE with 30+ min duration
      const startsAt = new Date(Date.now() + 60 * 60 * 1000); // 1h from now
      const expiresAt = new Date(Date.now() + 5 * 60 * 60 * 1000); // 5h from now
      const result = await service.createRequest({
        requesterId: "u1",
        resourceType: "api",
        permissionKey: "api:create",
        type: AccessRequestType.TEMPORARY,
        justification: "Need temporary API access for testing.",
        startsAt,
        expiresAt,
      });

      expect(result.status).toBe(AccessRequestStatus.PENDING);
      expect(result.type).toBe(AccessRequestType.TEMPORARY);
    });

    it("rejects invalid resource type", async () => {
      await expect(
        service.createRequest({
          requesterId: "u1",
          resourceType: "invalid_resource",
          permissionKey: "invalid_resource:view",
          type: AccessRequestType.PERMANENT,
          justification: "Test justification here",
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects permission key not matching resource type", async () => {
      await expect(
        service.createRequest({
          requesterId: "u1",
          resourceType: "articles",
          permissionKey: "users:view",
          type: AccessRequestType.PERMANENT,
          justification: "Test justification here",
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects justification shorter than 5 characters", async () => {
      await expect(
        service.createRequest({
          requesterId: "u1",
          resourceType: "articles",
          permissionKey: "articles:view",
          type: AccessRequestType.PERMANENT,
          justification: "abc",
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects temporary access without dates", async () => {
      await expect(
        service.createRequest({
          requesterId: "u1",
          resourceType: "articles",
          permissionKey: "articles:view",
          type: AccessRequestType.TEMPORARY,
          justification: "Need temporary access here",
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects temporary access where expiresAt <= startsAt", async () => {
      // expiresAt also in future but before startsAt — should still throw on ordering
      const startsAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000); // +5d
      const expiresAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // +2d < startsAt
      await expect(
        service.createRequest({
          requesterId: "u1",
          resourceType: "articles",
          permissionKey: "articles:view",
          type: AccessRequestType.TEMPORARY,
          justification: "Need temporary access here",
          startsAt,
          expiresAt,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects temporary access shorter than 30 minutes", async () => {
      // Both dates future but duration only 15m -> should throw
      const startsAt = new Date(Date.now() + 60 * 60 * 1000);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000 + 15 * 60 * 1000); // +15m
      await expect(
        service.createRequest({
          requesterId: "u1",
          resourceType: "articles",
          permissionKey: "articles:view",
          type: AccessRequestType.TEMPORARY,
          justification: "Need temporary access here",
          startsAt,
          expiresAt,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects permanent access with dates", async () => {
      await expect(
        service.createRequest({
          requesterId: "u1",
          resourceType: "articles",
          permissionKey: "articles:view",
          type: AccessRequestType.PERMANENT,
          justification: "Need permanent access here",
          startsAt: new Date("2026-01-01T00:00:00Z"),
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects duplicate PENDING request for same resource+permission", async () => {
      mockPrisma._seedRequest({
        requesterId: "u1",
        resourceType: "articles",
        permissionKey: "articles:edit",
        status: AccessRequestStatus.PENDING,
      });

      await expect(
        service.createRequest({
          requesterId: "u1",
          resourceType: "articles",
          permissionKey: "articles:edit",
          type: AccessRequestType.PERMANENT,
          justification: "Need to edit articles again.",
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("allows new request when previous one was APPROVED", async () => {
      mockPrisma._seedRequest({
        requesterId: "u1",
        resourceType: "articles",
        permissionKey: "articles:edit",
        status: AccessRequestStatus.APPROVED,
      });

      const result = await service.createRequest({
        requesterId: "u1",
        resourceType: "articles",
        permissionKey: "articles:edit",
        type: AccessRequestType.PERMANENT,
        justification: "Need to edit articles again.",
      });

      expect(result.status).toBe(AccessRequestStatus.PENDING);
    });
  });

  // ── §2 listRequests ─────────────────────────────────────────────────────────

  describe("listRequests", () => {
    beforeEach(() => {
      mockPrisma._seedRequest({ requesterId: "u1", resourceType: "articles", permissionKey: "articles:view" });
      mockPrisma._seedRequest({ requesterId: "u2", resourceType: "api", permissionKey: "api:create" });
      mockPrisma._seedRequest({ requesterId: "u1", resourceType: "users", permissionKey: "users:view", status: AccessRequestStatus.APPROVED });
    });

    it("non-admin view only shows own requests", async () => {
      const result = await service.listRequests({
        requesterId: "u1",
        forAdminView: false,
      });

      expect(result.data).toHaveLength(2);
      expect(result.data.every((r: any) => r.requesterId === "u1")).toBe(true);
    });

    it("admin view shows all requests", async () => {
      const result = await service.listRequests({ forAdminView: true });

      expect(result.data).toHaveLength(3);
    });

    it("filters by status", async () => {
      const result = await service.listRequests({
        forAdminView: true,
        status: AccessRequestStatus.APPROVED,
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].status).toBe(AccessRequestStatus.APPROVED);
    });

    it("filters by resourceType", async () => {
      const result = await service.listRequests({
        forAdminView: true,
        resourceType: "api",
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].resourceType).toBe("api");
    });

    it("paginates correctly", async () => {
      const result = await service.listRequests({
        forAdminView: true,
        page: 1,
        limit: 2,
      });

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(3);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(2);
    });

    it("respects max limit of 100", async () => {
      const result = await service.listRequests({
        forAdminView: true,
        limit: 500,
      });

      expect(result.pageSize).toBe(100);
    });
  });

  // ── §3 getRequestForActor ───────────────────────────────────────────────────

  describe("getRequestForActor", () => {
    it("throws NotFoundException for non-existent request", async () => {
      await expect(
        service.getRequestForActor("nonexistent", "u1", { asAdmin: false }),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws ForbiddenException when non-admin views other's request", async () => {
      const req = mockPrisma._seedRequest({
        requesterId: "u1",
        resourceType: "articles",
        permissionKey: "articles:view",
      });

      await expect(
        service.getRequestForActor(req.id, "u2", { asAdmin: false }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("allows owner to view own request", async () => {
      const req = mockPrisma._seedRequest({
        requesterId: "u1",
        resourceType: "articles",
        permissionKey: "articles:view",
      });

      const result = await service.getRequestForActor(req.id, "u1", { asAdmin: false });
      expect(result.id).toBe(req.id);
    });

    it("allows admin to view any request", async () => {
      const req = mockPrisma._seedRequest({
        requesterId: "u1",
        resourceType: "articles",
        permissionKey: "articles:view",
      });

      const result = await service.getRequestForActor(req.id, "u2", { asAdmin: true });
      expect(result.id).toBe(req.id);
    });
  });

  // ── §4 approveRequest ───────────────────────────────────────────────────────

  describe("approveRequest", () => {
    it("rejects admin justification shorter than 3 characters", async () => {
      const req = mockPrisma._seedRequest({
        requesterId: "u1",
        resourceType: "articles",
        permissionKey: "articles:view",
      });

      await expect(
        service.approveRequest({ requestId: req.id, reviewerId: "u2", adminJustification: "ab" }),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws NotFoundException for non-existent request", async () => {
      await expect(
        service.approveRequest({ requestId: "nonexistent", reviewerId: "u2", adminJustification: "Approved because reasons" }),
      ).rejects.toThrow(NotFoundException);
    });

    it("rejects approval of non-PENDING request", async () => {
      const req = mockPrisma._seedRequest({
        requesterId: "u1",
        resourceType: "articles",
        permissionKey: "articles:view",
        status: AccessRequestStatus.APPROVED,
      });

      await expect(
        service.approveRequest({ requestId: req.id, reviewerId: "u2", adminJustification: "Approved because reasons" }),
      ).rejects.toThrow(BadRequestException);
    });

    it("forbids self-approval", async () => {
      const req = mockPrisma._seedRequest({
        requesterId: "u1",
        resourceType: "articles",
        permissionKey: "articles:view",
      });

      await expect(
        service.approveRequest({ requestId: req.id, reviewerId: "u1", adminJustification: "Self approve" }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("approves a PENDING request and grants access", async () => {
      const req = mockPrisma._seedRequest({
        requesterId: "u1",
        resourceType: "articles",
        permissionKey: "articles:view",
      });

      const result = await service.approveRequest({
        requestId: req.id,
        reviewerId: "u2",
        adminJustification: "Approved for project work",
      });

      expect(result.status).toBe(AccessRequestStatus.APPROVED);
      expect(result.reviewerId).toBe("u2");
      expect(result.reviewedAt).toBeTruthy();
      expect(result.adminJustification).toBe("Approved for project work");
    });

    it("approves a TEMPORARY request and grants access with expiry", async () => {
      const startsAt = new Date(Date.now() + 60 * 60 * 1000);
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // +30d
      const req = mockPrisma._seedRequest({
        requesterId: "u1",
        resourceType: "api",
        permissionKey: "api:create",
        type: AccessRequestType.TEMPORARY,
        startsAt,
        expiresAt,
      });

      const result = await service.approveRequest({
        requestId: req.id,
        reviewerId: "u2",
        adminJustification: "Temporary access granted",
      });

      expect(result.status).toBe(AccessRequestStatus.APPROVED);
    });
  });

  // ── §5 rejectRequest ────────────────────────────────────────────────────────

  describe("rejectRequest", () => {
    it("rejects admin justification shorter than 3 characters", async () => {
      const req = mockPrisma._seedRequest({
        requesterId: "u1",
        resourceType: "articles",
        permissionKey: "articles:view",
      });

      await expect(
        service.rejectRequest({ requestId: req.id, reviewerId: "u2", adminJustification: "ab" }),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws NotFoundException for non-existent request", async () => {
      await expect(
        service.rejectRequest({ requestId: "nonexistent", reviewerId: "u2", adminJustification: "Rejected because reasons" }),
      ).rejects.toThrow(NotFoundException);
    });

    it("rejects a non-PENDING request", async () => {
      const req = mockPrisma._seedRequest({
        requesterId: "u1",
        resourceType: "articles",
        permissionKey: "articles:view",
        status: AccessRequestStatus.REJECTED,
      });

      await expect(
        service.rejectRequest({ requestId: req.id, reviewerId: "u2", adminJustification: "Rejected again" }),
      ).rejects.toThrow(BadRequestException);
    });

    it("forbids self-rejection", async () => {
      const req = mockPrisma._seedRequest({
        requesterId: "u1",
        resourceType: "articles",
        permissionKey: "articles:view",
      });

      await expect(
        service.rejectRequest({ requestId: req.id, reviewerId: "u1", adminJustification: "Self reject" }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("rejects a PENDING request", async () => {
      const req = mockPrisma._seedRequest({
        requesterId: "u1",
        resourceType: "articles",
        permissionKey: "articles:view",
      });

      const result = await service.rejectRequest({
        requestId: req.id,
        reviewerId: "u2",
        adminJustification: "Not enough justification provided",
      });

      expect(result.status).toBe(AccessRequestStatus.REJECTED);
      expect(result.reviewerId).toBe("u2");
      expect(result.reviewedAt).toBeTruthy();
    });
  });

  // ── §6 cancelRequest ────────────────────────────────────────────────────────

  describe("cancelRequest", () => {
    it("throws NotFoundException for non-existent request", async () => {
      await expect(
        service.cancelRequest("nonexistent", "u1"),
      ).rejects.toThrow(NotFoundException);
    });

    it("forbids cancelling other user's request", async () => {
      const req = mockPrisma._seedRequest({
        requesterId: "u1",
        resourceType: "articles",
        permissionKey: "articles:view",
      });

      await expect(
        service.cancelRequest(req.id, "u2"),
      ).rejects.toThrow(ForbiddenException);
    });

    it("rejects cancelling non-PENDING request", async () => {
      const req = mockPrisma._seedRequest({
        requesterId: "u1",
        resourceType: "articles",
        permissionKey: "articles:view",
        status: AccessRequestStatus.APPROVED,
      });

      await expect(
        service.cancelRequest(req.id, "u1"),
      ).rejects.toThrow(BadRequestException);
    });

    it("cancels own PENDING request", async () => {
      const req = mockPrisma._seedRequest({
        requesterId: "u1",
        resourceType: "articles",
        permissionKey: "articles:view",
      });

      const result = await service.cancelRequest(req.id, "u1");
      expect(result.status).toBe(AccessRequestStatus.CANCELLED);
      expect(result.reviewedAt).toBeTruthy();
    });
  });

  // ── §7 bulk operations ──────────────────────────────────────────────────────

  describe("bulkApproveMany", () => {
    it("approves multiple PENDING requests", async () => {
      const r1 = mockPrisma._seedRequest({ requesterId: "u1", resourceType: "articles", permissionKey: "articles:view" });
      const r2 = mockPrisma._seedRequest({ requesterId: "u1", resourceType: "api", permissionKey: "api:create" });

      const result = await service.bulkApproveMany([r1.id, r2.id], "u2", "Bulk approved for project");

      expect(result.approved).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.total).toBe(2);
    });

    it("handles mixed success/failure", async () => {
      const r1 = mockPrisma._seedRequest({ requesterId: "u1", resourceType: "articles", permissionKey: "articles:view" });
      // r2 is already APPROVED, so approval will fail
      const r2 = mockPrisma._seedRequest({ requesterId: "u1", resourceType: "api", permissionKey: "api:create", status: AccessRequestStatus.APPROVED });

      const result = await service.bulkApproveMany([r1.id, r2.id, "nonexistent"], "u2", "Bulk approved for project");

      expect(result.approved).toBe(1);
      expect(result.failed).toBe(2);
      expect(result.total).toBe(3);
    });

    it("deduplicates ids", async () => {
      const r1 = mockPrisma._seedRequest({ requesterId: "u1", resourceType: "articles", permissionKey: "articles:view" });

      const result = await service.bulkApproveMany([r1.id, r1.id], "u2", "Bulk approved for project");

      // Second attempt fails because the request is no longer PENDING
      expect(result.total).toBe(1);
    });
  });

  describe("bulkRejectMany", () => {
    it("rejects multiple PENDING requests", async () => {
      const r1 = mockPrisma._seedRequest({ requesterId: "u1", resourceType: "articles", permissionKey: "articles:view" });
      const r2 = mockPrisma._seedRequest({ requesterId: "u1", resourceType: "api", permissionKey: "api:create" });

      const result = await service.bulkRejectMany([r1.id, r2.id], "u2", "Bulk rejected by admin");

      expect(result.rejected).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.total).toBe(2);
    });

    it("handles failures gracefully", async () => {
      const r1 = mockPrisma._seedRequest({ requesterId: "u1", resourceType: "articles", permissionKey: "articles:view" });

      const result = await service.bulkRejectMany([r1.id, "nonexistent"], "u2", "Bulk rejected by admin");

      expect(result.rejected).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.total).toBe(2);
    });
  });

  // ── §8 getStats ─────────────────────────────────────────────────────────────

  describe("getStats", () => {
    beforeEach(() => {
      mockPrisma._seedRequest({ requesterId: "u1", resourceType: "articles", permissionKey: "articles:view", status: AccessRequestStatus.PENDING });
      mockPrisma._seedRequest({ requesterId: "u1", resourceType: "articles", permissionKey: "articles:edit", status: AccessRequestStatus.APPROVED });
      mockPrisma._seedRequest({ requesterId: "u2", resourceType: "api", permissionKey: "api:create", status: AccessRequestStatus.REJECTED });
      mockPrisma._seedRequest({ requesterId: "u2", resourceType: "api", permissionKey: "api:view", status: AccessRequestStatus.CANCELLED });
    });

    it("returns correct counts by status", async () => {
      const stats = await service.getStats();

      expect(stats.total).toBe(4);
      expect(stats.pending).toBe(1);
      expect(stats.approved).toBe(1);
      expect(stats.rejected).toBe(1);
      expect(stats.cancelled).toBe(1);
    });

    it("returns counts by resource type", async () => {
      const stats = await service.getStats();

      const articlesCount = stats.byResource.find((r) => r.resourceType === "articles");
      const apiCount = stats.byResource.find((r) => r.resourceType === "api");

      expect(articlesCount?.count).toBe(2);
      expect(apiCount?.count).toBe(2);
    });
  });

  // ── §10 expireDueAccess ─────────────────────────────────────────────────────

  describe("expireDueAccess", () => {
    it("returns 0 when no expired access records exist", async () => {
      const count = await service.expireDueAccess();
      expect(count).toBe(0);
    });

    it("deactivates expired access records", async () => {
      const pastDate = new Date("2020-01-01T00:00:00Z");
      mockPrisma._seedAccess({
        userId: "u1",
        resourceType: "articles",
        permissionKey: "articles:view",
        expiresAt: pastDate,
        isActive: true,
      });
      mockPrisma._seedAccess({
        userId: "u2",
        resourceType: "api",
        permissionKey: "api:create",
        expiresAt: new Date("2030-01-01T00:00:00Z"),
        isActive: true,
      });

      const count = await service.expireDueAccess();
      expect(count).toBe(1);
    });

    it("uses provided nowOverride for expiry check", async () => {
      const futureDate = new Date("2030-06-01T00:00:00Z");
      mockPrisma._seedAccess({
        userId: "u1",
        resourceType: "articles",
        permissionKey: "articles:view",
        expiresAt: new Date("2030-01-01T00:00:00Z"),
        isActive: true,
      });

      const count = await service.expireDueAccess(futureDate);
      expect(count).toBe(1);
    });

    it("does not deactivate non-expired records", async () => {
      mockPrisma._seedAccess({
        userId: "u1",
        resourceType: "articles",
        permissionKey: "articles:view",
        expiresAt: new Date("2030-01-01T00:00:00Z"),
        isActive: true,
      });

      const count = await service.expireDueAccess();
      expect(count).toBe(0);
    });
  });

  // ── §11 deleteRequest ───────────────────────────────────────────────────────

  describe("deleteRequest", () => {
    it("throws NotFoundException for non-existent request", async () => {
      await expect(
        service.deleteRequest("nonexistent"),
      ).rejects.toThrow(NotFoundException);
    });

    it("deletes an existing request", async () => {
      const req = mockPrisma._seedRequest({
        requesterId: "u1",
        resourceType: "articles",
        permissionKey: "articles:view",
      });

      const result = await service.deleteRequest(req.id);
      expect(result).toEqual({ id: req.id, deleted: true });

      // Verify it's gone
      await expect(
        service.getRequestForActor(req.id, "u1", { asAdmin: false }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── §9 listResourcePermissions / listResources ──────────────────────────────

  describe("listResourcePermissions", () => {
    it("returns all permissions when no filter", async () => {
      const result = await service.listResourcePermissions();
      expect(Array.isArray(result)).toBe(true);
    });

    it("filters by resourceType", async () => {
      const result = await service.listResourcePermissions("articles");
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("listResources", () => {
    it("returns array of resource summaries", async () => {
      const result = await service.listResources();
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
