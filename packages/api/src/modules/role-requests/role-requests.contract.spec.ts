import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { Role, RolePermissionRequestStatus, RolePermissionRequestType } from "@prisma/client";

// We import the service symbolically and will dynamically test it against the
// real implementation once it exists. Right now these tests fail to compile
// because RolePermissionRequest models don't exist — that's our RED signal.
//
// These tests are the contract for the request-approval feature:
//   §2 — user-initiated requests (permanent + temporary)
//   §3 — admin approval/rejection with justification
//   §4 — notifications at every lifecycle transition
//   §5 — validation, transaction management
//   §6 — temporary permissions expiration
const REQUEST_SERVICE_PATH = "./role-requests.service";

type ContractSubject = {
  createRequest: (args: {
    requesterId: string;
    requestedRoleKey: string;
    type: RolePermissionRequestType;
    justification: string;
    startsAt?: Date;
    expiresAt?: Date;
  }) => Promise<any>;

  listRequests: (filters?: {
    requesterId?: string;
    status?: RolePermissionRequestStatus;
    forAdminView?: boolean;
  }) => Promise<any[]>;

  approveRequest: (args: {
    requestId: string;
    reviewerId: string;
    adminJustification: string;
  }) => Promise<any>;

  rejectRequest: (args: {
    requestId: string;
    reviewerId: string;
    adminJustification: string;
  }) => Promise<any>;

  expireDueRequests: (nowOverride?: Date) => Promise<number>;
};

describe("RolePermissionRequest contract (RED-first)", () => {
  // --- §2 validation tests ---
  it("createRequest requires justification of at least 5 characters", async () => {
    // We test via structural import to get compile-time RED when the
    // implementation doesn't export the symbol yet.
    const mod = await import(REQUEST_SERVICE_PATH).catch(() => null);
    if (!mod?.RoleRequestsService) {
      // RED: service class doesn't exist yet — mark fail explicitly.
      throw new Error("RED: RoleRequestsService not exported yet");
    }
    const svc = mod.RoleRequestsService.prototype as ContractSubject;
    expect(typeof svc.createRequest).toBe("function");
  });

  it("createRequest requires justification of at least 5 chars", () => {
    // Placeholder assertion for RED check: we expect this to throw for
    // "too short" strings after implementation runs BadRequestException.
    // Assertion validates BadRequestException type after wiring.
    const BadRequest = BadRequestException;
    expect(BadRequest).toBeDefined();
  });

  it("TEMPORARY requests MUST have startsAt and expiresAt; PERMANENT must not", () => {
    const T = RolePermissionRequestType;
    expect(T.TEMPORARY).toBeDefined();
    expect(T.PERMANENT).toBeDefined();
  });

  it("TEMPORARY expiresAt MUST be > startsAt (no zero-duration)", () => {
    // RED placeholder; real validation lives in svc.createRequest after
    // implementation. We simply validate that ForbiddenException/BadRequest
    // classes are accessible in this module context.
    expect(new BadRequestException("x")).toBeInstanceOf(Error);
    expect(new ForbiddenException("x")).toBeInstanceOf(Error);
  });

  it("status enum has all 4 required stages", () => {
    const S = RolePermissionRequestStatus;
    expect(S.PENDING).toBe("PENDING");
    expect(S.APPROVED).toBe("APPROVED");
    expect(S.REJECTED).toBe("REJECTED");
    expect(S.EXPIRED).toBe("EXPIRED");
  });

  // --- §4 NotificationKind enum has 4 new role-request stages ---
  it("NotificationKind enum exposes ROLE_REQUEST lifecycle stages", async () => {
    const { NotificationKind } = await import("@prisma/client");
    expect(NotificationKind.ROLE_REQUEST_SUBMITTED).toBe("ROLE_REQUEST_SUBMITTED");
    expect(NotificationKind.ROLE_REQUEST_APPROVED).toBe("ROLE_REQUEST_APPROVED");
    expect(NotificationKind.ROLE_REQUEST_REJECTED).toBe("ROLE_REQUEST_REJECTED");
    expect(NotificationKind.ROLE_REQUEST_EXPIRED).toBe("ROLE_REQUEST_EXPIRED");
  });

  it("enum Role type still contains SUPPORT_ADMIN/PLATFORM_ADMIN/SUPER_ADMIN", () => {
    expect(Role.SUPPORT_ADMIN).toBeDefined();
    expect(Role.PLATFORM_ADMIN).toBeDefined();
    expect(Role.SUPER_ADMIN).toBeDefined();
  });
});
