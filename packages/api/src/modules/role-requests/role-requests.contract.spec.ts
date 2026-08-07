import { Role, RolePermissionRequestStatus, RolePermissionRequestType, NotificationKind } from "@prisma/client";
import { RoleRequestsService } from "./role-requests.service";
import { NotificationsService } from "../notifications/notifications.service";

/**
 * Contract-level surface tests for the role-request feature.
 *
 * These are intentionally shallow — they assert that:
 *   1. The enums required by the feature spec are actually present on the
 *      generated Prisma client (so schema.prisma + migration are in sync).
 *   2. Public methods on RoleRequestsService / NotificationsService match the
 *      signatures expected by controllers (shape contract, not behavior).
 *
 * All deep behavioral testing lives in `role-requests.service.spec.ts` and
 * `admin.service.self-role.spec.ts`.
 */
describe("Feature contract — enums & service shapes", () => {
  it("Role enum contains the 8 expected tiers (§1 enterprise RBAC baseline)", () => {
    const expected = [
      "ADMIN", "PLATFORM_ADMIN", "SUPER_ADMIN", "MODERATOR",
      "SUPPORT_ADMIN", "CREATOR", "USER", "GUEST",
    ];
    expect(new Set(Object.values(Role))).toEqual(new Set(expected));
  });

  it("RolePermissionRequestStatus has 4 lifecycle states (§2+§3)", () => {
    expect(new Set(Object.values(RolePermissionRequestStatus))).toEqual(
      new Set(["PENDING", "APPROVED", "REJECTED", "EXPIRED"]),
    );
  });

  it("RolePermissionRequestType distinguishes PERMANENT vs TEMPORARY (§2)", () => {
    expect(Object.values(RolePermissionRequestType).sort()).toEqual(["PERMANENT", "TEMPORARY"]);
  });

  it("NotificationKind has the 4 role-request stages (§4)", () => {
    expect(NotificationKind.ROLE_REQUEST_SUBMITTED).toBeDefined();
    expect(NotificationKind.ROLE_REQUEST_APPROVED).toBeDefined();
    expect(NotificationKind.ROLE_REQUEST_REJECTED).toBeDefined();
    expect(NotificationKind.ROLE_REQUEST_EXPIRED).toBeDefined();
  });

  it("RoleRequestsService exposes the public methods used by RoleRequestsController", () => {
    const methods: (keyof RoleRequestsService)[] = [
      "createRequest",
      "listRequests",
      "getRequestForActor",
      "approveRequest",
      "rejectRequest",
      "cancelRequest",
      "expireDueRequests",
    ];
    for (const m of methods) {
      expect(typeof (RoleRequestsService.prototype as any)[m]).toBe("function");
    }
  });

  it("NotificationsService exposes createNotification with metadata support", () => {
    expect(typeof (NotificationsService.prototype as any).createNotification).toBe("function");
    // `createNotification` accepts kind, metadata, and actorId arguments (§4).
    // Signature shape test: function.length is unreliable with TS default args, so
    // just assert the prototype has the property as a callable.
  });
});
