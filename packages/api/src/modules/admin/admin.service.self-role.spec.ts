import { Test } from "@nestjs/testing";
import { AdminService } from "./admin.service";
import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../../shared/prisma/prisma.service";
import { Role } from "@prisma/client";
import { ConfigService } from "@nestjs/config";
import { CacheService } from "../../shared/cache/cache.service";

// --- Self-role-change prohibition tests (requirement §1) ---
//
// Admin users must NEVER be able to elevate/demote their own role via the
// regular admin user-management endpoints. This is a critical security check:
// without it, a single compromised admin account could write themselves
// SUPER_ADMIN arbitrarily. We test both the dedicated role endpoint and the
// generic user-update endpoint, with different role strings.
describe("AdminService self-role-change prohibition", () => {
  let service: AdminService;
  const mockUserA = { id: "admin-a", role: Role.ADMIN, email: "a@x.com", name: "A", handle: "a" } as any;
  const mockUserB = { id: "user-b", role: Role.USER, email: "b@x.com", name: "B", handle: "b" } as any;
  const mockSuper = { id: "super-1", role: Role.SUPER_ADMIN, email: "s@x.com", name: "S", handle: "s" } as any;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: { user: { findUnique: jest.fn(async ({ where }: any) => {
          if (where.id === mockUserA.id) return mockUserA;
          if (where.id === mockUserB.id) return mockUserB;
          if (where.id === mockSuper.id) return mockSuper;
          return null;
        }) } } },
        { provide: ConfigService, useValue: {} },
        { provide: CacheService, useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn() } },
      ],
    }).compile();
    service = module.get(AdminService);
  });

  it("updateUserRole throws ForbiddenException when actorId === target userId", async () => {
    // We stub resolveRole to avoid needing a full DB schema in unit tests —
    // the security gate MUST fire BEFORE any DB update calls, so we don't
    // actually reach the update method at all here.
    jest.spyOn(service as any, "resolveRole").mockResolvedValue({
      kind: "legacy",
      legacyRole: Role.SUPPORT_ADMIN,
      rbacRoleId: "x",
      raw: "SUPPORT_ADMIN",
      rank: 4,
    });
    await expect(
      service.updateUserRole(mockUserA.id /* actor */, mockUserA.id /* target */, "SUPPORT_ADMIN"),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("updateUserRole does NOT throw ForbiddenException when actorId !== target userId", async () => {
    jest.spyOn(service as any, "resolveRole").mockResolvedValue({
      kind: "legacy",
      legacyRole: Role.MODERATOR,
      rbacRoleId: "x",
      raw: Role.MODERATOR,
      rank: 3,
    });
    // Gate passes → now it fails on the update call (mock undefined), but
    // that's fine — we assert the guard did NOT throw a Forbidden.
    try {
      await service.updateUserRole(mockUserA.id, mockUserB.id, Role.MODERATOR);
    } catch (err) {
      expect(err).not.toBeInstanceOf(ForbiddenException);
    }
  });

  it("updateUser with role: throws ForbiddenException when actor edits own role", async () => {
    await expect(
      service.updateUser(mockUserA.id /* actor */, mockUserA.id, { role: Role.SUPER_ADMIN }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("updateUser with role: does NOT throw Forbidden when actor edits different user", async () => {
    jest.spyOn(service as any, "resolveRole").mockResolvedValue({
      kind: "legacy",
      legacyRole: Role.PLATFORM_ADMIN,
      rbacRoleId: "x",
      raw: Role.PLATFORM_ADMIN,
      rank: 6,
    });
    try {
      await service.updateUser(mockSuper.id, mockUserA.id, { role: Role.PLATFORM_ADMIN });
    } catch (err) {
      expect(err).not.toBeInstanceOf(ForbiddenException);
    }
  });

  it("updateUser withOUT role: does NOT throw Forbidden even for self-edits (name/bio edits OK)", async () => {
    try {
      await service.updateUser(mockUserA.id, mockUserA.id, { name: "NewName", bio: "x" });
    } catch (err) {
      expect(err).not.toBeInstanceOf(ForbiddenException);
    }
  });

  it("SELF_EDITION prohibition even when using flexible role key casing/formats", async () => {
    // Flexible normalization must NOT bypass the self-edition guard.
    jest.spyOn(service as any, "resolveRole").mockResolvedValue({
      kind: "legacy",
      legacyRole: Role.SUPPORT_ADMIN,
      rbacRoleId: "x",
      raw: "SUPPORT_ADMIN",
      rank: 4,
    });
    for (const variant of ["support_admin", "SupportAdmin", "support-admin", "SUPPORT_ADMIN"]) {
      await expect(
        service.updateUserRole(mockUserA.id, mockUserA.id, variant),
      ).rejects.toBeInstanceOf(ForbiddenException);
    }
  });

  describe("Missing/invalid actorId → 401 Unauthorized (never 500)", () => {
    // Regression tests for:
    //   TypeError: Cannot read properties of undefined (reading 'trim')
    //   at ensureActorIsNotTarget (admin.service.ts:530)
    //
    // Any falsy / non-string actorId (undefined, null, "", "   ") must throw
    // UnauthorizedException cleanly. This guarantees the fix holds even if
    // a malformed JWT slips past the guard or a controller forgets req.user.sub.

    const BAD_ACTOR_IDS = [undefined, null, "", "   "] as const;

    it("updateUser(role) throws UnauthorizedException for each bad actorId (not 500)", async () => {
      for (const bad of BAD_ACTOR_IDS) {
        await expect(
          service.updateUser(bad as any, mockUserB.id, { role: Role.SUPPORT_ADMIN }),
        ).rejects.toBeInstanceOf(UnauthorizedException);
      }
    });

    it("updateUser(isActive) throws UnauthorizedException for each bad actorId (not 500)", async () => {
      for (const bad of BAD_ACTOR_IDS) {
        await expect(
          service.updateUser(bad as any, mockUserB.id, { isActive: false }),
        ).rejects.toBeInstanceOf(UnauthorizedException);
      }
    });

    it("updateUserRole throws UnauthorizedException for each bad actorId (not 500)", async () => {
      for (const bad of BAD_ACTOR_IDS) {
        await expect(
          service.updateUserRole(bad as any, mockUserB.id, Role.SUPPORT_ADMIN),
        ).rejects.toBeInstanceOf(UnauthorizedException);
      }
    });

    it("toggleUserStatus throws UnauthorizedException for each bad actorId (not 500)", async () => {
      for (const bad of BAD_ACTOR_IDS) {
        await expect(
          service.toggleUserStatus(bad as any, mockUserB.id),
        ).rejects.toBeInstanceOf(UnauthorizedException);
      }
    });

    it("deleteUser throws UnauthorizedException for each bad actorId (not 500)", async () => {
      for (const bad of BAD_ACTOR_IDS) {
        await expect(
          service.deleteUser(bad as any, mockUserB.id),
        ).rejects.toBeInstanceOf(UnauthorizedException);
      }
    });

    it("createUser throws UnauthorizedException for each bad actorId (not 500)", async () => {
      jest.spyOn(service as any, "resolveRole").mockResolvedValue({
        kind: "legacy", legacyRole: Role.USER, rbacRoleId: "x", raw: "USER", rank: 1,
      });
      for (const bad of BAD_ACTOR_IDS) {
        await expect(
          service.createUser(bad as any, "e@x.com", "E", "e", Role.USER, "p@ssw0rd1234"),
        ).rejects.toBeInstanceOf(UnauthorizedException);
      }
    });
  });
});
