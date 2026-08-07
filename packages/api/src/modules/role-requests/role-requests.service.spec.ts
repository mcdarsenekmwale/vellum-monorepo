import { Test } from "@nestjs/testing";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { Role, RolePermissionRequestStatus, RolePermissionRequestType, NotificationKind } from "@prisma/client";
import { RoleRequestsService } from "./role-requests.service";
import { PrismaService } from "../../shared/prisma/prisma.service";
import { CacheService } from "../../shared/cache/cache.service";
import { NotificationsService } from "../notifications/notifications.service";
import { ConfigService } from "@nestjs/config";

type RoleRequestRow = {
  id: string;
  requesterId: string;
  reviewerId: string | null;
  requestedRoleKey: string;
  type: RolePermissionRequestType;
  status: RolePermissionRequestStatus;
  justification: string;
  adminJustification: string | null;
  startsAt: Date | null;
  expiresAt: Date | null;
  reviewedAt: Date | null;
  resultingAssignmentId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

// In-memory Prisma-styled store — enough to test the service's validation +
// lifecycle transitions without a real DB.
class MockPrisma {
  notifications: any[] = [];
  users = [
    { id: "u-requester", name: "Req", handle: "req", email: "req@x.com", role: Role.USER, isActive: true, deletedAt: null },
    { id: "u-admin",     name: "Adm", handle: "adm", email: "adm@x.com", role: Role.ADMIN, isActive: true, deletedAt: null },
    { id: "u-super",     name: "Sup", handle: "sup", email: "sup@x.com", role: Role.SUPER_ADMIN, isActive: true, deletedAt: null },
    { id: "u-other",     name: "Otr", handle: "otr", email: "otr@x.com", role: Role.USER, isActive: true, deletedAt: null },
  ];
  history: any[] = [];
  assignments: { id: string; userId: string; roleId: string; expiresAt?: Date | null }[] = [];
  rbacRoles = [
    { id: "r-registered", key: "registered_user", deletedAt: null, isActive: true, name: "Registered User" },
    { id: "r-moderator",  key: "moderator",       deletedAt: null, isActive: true, name: "Moderator" },
    { id: "r-support",    key: "support_admin",   deletedAt: null, isActive: true, name: "Support Admin" },
  ];

  private _rpr: RoleRequestRow[] = [];

  $transaction = async <T>(fn: (tx: any) => Promise<T>) => fn(this as any);

  user = {
    findMany: ({ where }: any) => {
      return this.users.filter((u) => {
        if (where?.role?.in && !where.role.in.includes(u.role)) return false;
        if (where?.isActive !== undefined && u.isActive !== where.isActive) return false;
        if (where?.deletedAt !== null && u.deletedAt !== where.deletedAt) return false;
        // exclude specific user ids
        if (where?.id === null) return true;
        return true;
      });
    },
    findUnique: ({ where }: any) => this.users.find((u) => u.id === where?.id) ?? null,
  };

  rbacRole = {
    findFirst: ({ where }: any) => this.rbacRoles.find((r) => r.key === where?.key && r.deletedAt === where?.deletedAt) ?? null,
    findMany: () => [...this.rbacRoles],
  };

  userRoleAssignment = {
    delete: async () => {},
    deleteMany: async () => {},
    findMany: async ({ where }: any) => {
      // Minimal stub: we don't ship any RBAC-assigned admins in this fixture,
      // so return empty. Tests that need a richer fixture can extend later.
      return [];
    },
  };

  get rolePermissionRequest() {
    const ctx = this;
    return {
      get length() { return ctx._rpr.length; },
      [Symbol.iterator]() { return ctx._rpr[Symbol.iterator](); },
      find: (...a: any[]) => (ctx._rpr as any).find(...a),
      map:  (...a: any[]) => (ctx._rpr as any).map(...a),
      filter: (...a: any[]) => (ctx._rpr as any).filter(...a),
      findFirst: (q: any) => ctx.findRequest(q?.where),
      findUnique: (q: any) => ctx.findRequest(q?.where),
      findMany: (q: any) => ctx.filterRequests(q?.where),
      count:    (q: any) => ctx.filterRequests(q?.where).length,
      create:   (q: any) => ctx.createReq(q.data),
      update:   (q: any) => ctx.updateReq(q.where, q.data),
    } as any;
  }
  // Setter used by service-level assignments (very rare).
  set rolePermissionRequest(_v: RoleRequestRow[]) { /* noop — test harness never rebinds */ }

  private findRequest(where: any): RoleRequestRow | null {
    if (!where) return null;
    if (where.id) return this._rpr.find((r) => r.id === where.id) ?? null;
    return this.filterRequests(where)[0] ?? null;
  }
  private filterRequests(where: any): RoleRequestRow[] {
    return this._rpr.filter((r) => {
      if (where.requesterId && r.requesterId !== where.requesterId) return false;
      if (where.status?.in && !where.status.in.includes(r.status)) return false;
      if (where.status && !where.status?.in && r.status !== where.status) return false;
      if (where.expiresAt?.lte && (r.expiresAt == null || +r.expiresAt > +where.expiresAt.lte)) return false;
      return true;
    });
  }
  private createReq(data: any): RoleRequestRow {
    const row: RoleRequestRow = {
      id: "rr-" + Math.random().toString(36).slice(2, 8),
      requesterId: data.requesterId,
      reviewerId: null,
      requestedRoleKey: data.requestedRoleKey,
      type: data.type,
      status: data.status,
      justification: data.justification,
      adminJustification: null,
      startsAt: data.startsAt ?? null,
      expiresAt: data.expiresAt ?? null,
      reviewedAt: null,
      resultingAssignmentId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    if (data.history?.create) this.history.push({ requestId: row.id, ...data.history.create, id: "he-" + Math.random(), createdAt: new Date() });
    this._rpr.push(row);
    return row;
  }
  private updateReq(where: any, data: any): RoleRequestRow | null {
    const idx = this._rpr.findIndex((r) => r.id === where.id);
    if (idx < 0) return null;
    const merged = { ...this._rpr[idx], ...data, updatedAt: new Date() } as RoleRequestRow;
    this._rpr[idx] = merged;
    if (data.history?.create) this.history.push({ requestId: where.id, ...data.history.create, id: "he-" + Math.random(), createdAt: new Date() });
    return merged;
  }
}

describe("RoleRequestsService — unit tests", () => {
  let service: RoleRequestsService;
  let prisma: MockPrisma;

  beforeEach(async () => {
    prisma = new MockPrisma();

    const module = await Test.createTestingModule({
      providers: [
        RoleRequestsService,
        { provide: PrismaService, useValue: prisma },
        { provide: CacheService, useValue: { del: jest.fn() } },
        { provide: NotificationsService, useValue: {
          createNotification: jest.fn().mockImplementation((d: any) => {
            const n = { id: "n-" + Math.random(), ...d, createdAt: new Date() };
            prisma.notifications.push(n);
            return n;
          }),
        } },
        { provide: ConfigService, useValue: { get: () => undefined } },
      ],
    }).compile();
    service = module.get(RoleRequestsService);
  });

  // ----- §2 Validation -----

  it("createRequest rejects when justification < 5 chars", async () => {
    await expect(service.createRequest({
      requesterId: "u-requester",
      requestedRoleKey: "MODERATOR",
      type: RolePermissionRequestType.PERMANENT,
      justification: "ok",
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("createRequest PERMANENT rejects if dates provided", async () => {
    await expect(service.createRequest({
      requesterId: "u-requester",
      requestedRoleKey: "MODERATOR",
      type: RolePermissionRequestType.PERMANENT,
      justification: "Need to do support work",
      startsAt: new Date(Date.now() + 60000),
      expiresAt: new Date(Date.now() + 3600000),
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("createRequest TEMPORARY rejects if expiresAt <= startsAt", async () => {
    const s = new Date(Date.now() + 1000);
    await expect(service.createRequest({
      requesterId: "u-requester",
      requestedRoleKey: "MODERATOR",
      type: RolePermissionRequestType.TEMPORARY,
      justification: "Covering on-call weekend",
      startsAt: s,
      expiresAt: s,
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("createRequest TEMPORARY rejects if duration < 30 minutes", async () => {
    await expect(service.createRequest({
      requesterId: "u-requester",
      requestedRoleKey: "MODERATOR",
      type: RolePermissionRequestType.TEMPORARY,
      justification: "Quick look at something",
      startsAt: new Date(Date.now() + 1000),
      expiresAt: new Date(Date.now() + 1000 + 10 * 60 * 1000), // 10 min
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("createRequest dedupes PENDING duplicates per (user+role)", async () => {
    const req = {
      requesterId: "u-requester",
      requestedRoleKey: "support_admin",
      type: RolePermissionRequestType.PERMANENT,
      justification: "Need support admin for ticket duty",
    };
    await service.createRequest(req);
    await expect(service.createRequest(req)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("createRequest TEMPORARY succeeds with valid window", async () => {
    const res = await service.createRequest({
      requesterId: "u-requester",
      requestedRoleKey: "support_admin",
      type: RolePermissionRequestType.TEMPORARY,
      justification: "Covering on-call weekend — 48h",
      startsAt: new Date(Date.now() + 60000),
      expiresAt: new Date(Date.now() + 60000 + 48 * 3600 * 1000),
    });
    expect(res.status).toBe(RolePermissionRequestStatus.PENDING);
    expect(res.type).toBe(RolePermissionRequestType.TEMPORARY);
    expect(res.expiresAt).not.toBeNull();
    // Submitted + admin notifications created
    expect(prisma.notifications.length).toBeGreaterThanOrEqual(2);
    expect(prisma.notifications.map((n) => n.kind).filter((k) => k === NotificationKind.ROLE_REQUEST_SUBMITTED).length).toBeGreaterThanOrEqual(2);
  });

  // ----- §3 Admin review -----

  it("approveRequest writes APPROVED transition, admin justification, applies role via assignRole callback", async () => {
    const created = await service.createRequest({
      requesterId: "u-requester",
      requestedRoleKey: "support_admin",
      type: RolePermissionRequestType.PERMANENT,
      justification: "Need it for triage duties",
    });

    const assignMock = jest.fn().mockResolvedValue({ assignmentId: "assn-1" });
    const approved = await service.approveRequest({
      requestId: created.id,
      reviewerId: "u-admin",
      adminJustification: "Requester has completed support training — approved",
      assignRole: assignMock,
    });

    expect(approved.status).toBe(RolePermissionRequestStatus.APPROVED);
    expect(approved.adminJustification).toBe("Requester has completed support training — approved");
    expect(approved.reviewerId).toBe("u-admin");
    expect(assignMock).toHaveBeenCalledWith({
      userId: "u-requester",
      requestedRoleKey: "support_admin",
      assignedBy: "u-admin",
      expiresAt: undefined,
    });
    // Resulting assignment id is pointed back at the request.
    const refetch = prisma.rolePermissionRequest.find((r) => r.id === created.id)!;
    expect(refetch.resultingAssignmentId).toBe("assn-1");
    // History event present (PENDING + APPROVED = 2 entries)
    const evForThis = prisma.history.filter((h) => h.requestId === created.id);
    expect(evForThis.map((e) => e.transition).sort()).toEqual([RolePermissionRequestStatus.APPROVED, RolePermissionRequestStatus.PENDING]);
    // Notifications for requester (APPROVED kind)
    const kinds = prisma.notifications.map((n) => n.kind);
    expect(kinds).toContain(NotificationKind.ROLE_REQUEST_APPROVED);
  });

  it("approveRequest with TEMPORARY passes expiresAt through assignRole", async () => {
    const later = new Date(Date.now() + 24 * 3600 * 1000);
    const created = await service.createRequest({
      requesterId: "u-requester",
      requestedRoleKey: "moderator",
      type: RolePermissionRequestType.TEMPORARY,
      justification: "Holiday coverage for 24h",
      startsAt: new Date(Date.now() + 60000),
      expiresAt: later,
    });
    const assignMock = jest.fn().mockResolvedValue({ assignmentId: "assn-temp" });
    await service.approveRequest({
      requestId: created.id,
      reviewerId: "u-super",
      adminJustification: "24h cover approved",
      assignRole: assignMock,
    });
    expect(assignMock.mock.calls[0][0].expiresAt).toEqual(later);
  });

  it("approveRequest rejects when reviewer === requester (self-approval forbidden §1)", async () => {
    const created = await service.createRequest({
      requesterId: "u-admin",
      requestedRoleKey: Role.SUPER_ADMIN,
      type: RolePermissionRequestType.PERMANENT,
      justification: "Promoting myself for a minute",
    });
    await expect(
      service.approveRequest({
        requestId: created.id,
        reviewerId: "u-admin", // same as requester
        adminJustification: "Doing it",
        assignRole: jest.fn().mockResolvedValue({}),
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejectRequest requires admin justification (>= 5 chars)", async () => {
    const created = await service.createRequest({
      requesterId: "u-requester",
      requestedRoleKey: "support_admin",
      type: RolePermissionRequestType.PERMANENT,
      justification: "Elevate me please",
    });
    await expect(service.rejectRequest({
      requestId: created.id,
      reviewerId: "u-admin",
      adminJustification: "nah",
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejectRequest writes REJECTED transition and emits notification", async () => {
    const created = await service.createRequest({
      requesterId: "u-requester",
      requestedRoleKey: "support_admin",
      type: RolePermissionRequestType.PERMANENT,
      justification: "Wanna be admin",
    });
    const rejected = await service.rejectRequest({
      requestId: created.id,
      reviewerId: "u-super",
      adminJustification: "No evidence of support training — please reapply after completing onboarding modules A1/A2.",
    });
    expect(rejected.status).toBe(RolePermissionRequestStatus.REJECTED);
    expect(rejected.reviewerId).toBe("u-super");
    const kinds = prisma.notifications.map((n) => n.kind);
    expect(kinds).toContain(NotificationKind.ROLE_REQUEST_REJECTED);
  });

  it("cancelRequest: requester can cancel their own PENDING request", async () => {
    const created = await service.createRequest({
      requesterId: "u-requester",
      requestedRoleKey: "support_admin",
      type: RolePermissionRequestType.PERMANENT,
      justification: "Nvm, let me re-submit later",
    });
    const cancelled = await service.cancelRequest(created.id, "u-requester");
    expect(cancelled.status).toBe(RolePermissionRequestStatus.REJECTED);
    expect(cancelled.adminJustification).toBe("Cancelled by requester");
  });

  it("cancelRequest: a third party cannot cancel someone else's request", async () => {
    const created = await service.createRequest({
      requesterId: "u-requester",
      requestedRoleKey: "support_admin",
      type: RolePermissionRequestType.PERMANENT,
      justification: "For triage duties",
    });
    await expect(service.cancelRequest(created.id, "u-other")).rejects.toBeInstanceOf(ForbiddenException);
  });

  // ----- §6 Temporary permissions expiry sweep -----

  it("expireDueRequests: no-op if no APPROVED temp requests are due", async () => {
    await service.createRequest({
      requesterId: "u-requester",
      requestedRoleKey: "moderator",
      type: RolePermissionRequestType.TEMPORARY,
      justification: "Holiday cover",
      startsAt: new Date(Date.now() + 60000),
      expiresAt: new Date(Date.now() + 48 * 3600 * 1000),
    });
    // not yet approved → not picked up
    const n = await service.expireDueRequests();
    expect(n).toBe(0);
  });

  it("expireDueRequests: marks APPROVED past-expiry rows EXPIRED, emits EXPIRED notification", async () => {
    // create + approve via assign role callback
    const created = await service.createRequest({
      requesterId: "u-requester",
      requestedRoleKey: "support_admin",
      type: RolePermissionRequestType.TEMPORARY,
      justification: "Weekend on call",
      startsAt: new Date(Date.now() - 2 * 24 * 3600 * 1000),
      expiresAt: new Date(Date.now() - 1 * 24 * 3600 * 1000), // expired yesterday
    });
    prisma.assignments.push({ id: "assn-expired", userId: "u-requester", roleId: "r-support" });
    // mark approved, and link to assignment
    await service.approveRequest({
      requestId: created.id,
      reviewerId: "u-admin",
      adminJustification: "Approved for weekend cover",
      assignRole: jest.fn().mockResolvedValue({ assignmentId: "assn-expired" }),
    });
    const expiredCount = await service.expireDueRequests();
    expect(expiredCount).toBe(1);

    const row = prisma.rolePermissionRequest.find((r) => r.id === created.id)!;
    expect(row.status).toBe(RolePermissionRequestStatus.EXPIRED);
    const kinds = prisma.notifications.map((n) => n.kind);
    expect(kinds).toContain(NotificationKind.ROLE_REQUEST_EXPIRED);
    // History entry for EXPIRED transition
    const ev = prisma.history.find((h) => h.requestId === created.id && h.transition === RolePermissionRequestStatus.EXPIRED);
    expect(ev).toBeDefined();
  });

  it("expireDueRequests: idempotent (repeat sweeps return 0)", async () => {
    const created = await service.createRequest({
      requesterId: "u-requester",
      requestedRoleKey: "support_admin",
      type: RolePermissionRequestType.TEMPORARY,
      justification: "Expired already",
      startsAt: new Date(Date.now() - 5 * 3600 * 1000),
      expiresAt: new Date(Date.now() - 1 * 3600 * 1000),
    });
    prisma.assignments.push({ id: "x-idem", userId: "u-requester", roleId: "r-support" });
    await service.approveRequest({
      requestId: created.id,
      reviewerId: "u-admin",
      adminJustification: "Approved; expected to expire shortly",
      assignRole: jest.fn().mockResolvedValue({ assignmentId: "x-idem" }),
    });
    expect(await service.expireDueRequests()).toBe(1);
    expect(await service.expireDueRequests()).toBe(0);
  });

  // ----- §4 NotificationKind enum completeness (from spec) -----
  it("NotificationKind enum has all four role-request stages", () => {
    expect(NotificationKind.ROLE_REQUEST_SUBMITTED).toBeDefined();
    expect(NotificationKind.ROLE_REQUEST_APPROVED).toBeDefined();
    expect(NotificationKind.ROLE_REQUEST_REJECTED).toBeDefined();
    expect(NotificationKind.ROLE_REQUEST_EXPIRED).toBeDefined();
  });
});
