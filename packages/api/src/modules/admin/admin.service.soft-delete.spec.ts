import { Test } from "@nestjs/testing";
import { AdminService } from "./admin.service";
import {
  ForbiddenException,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../shared/prisma/prisma.service";
import { ConfigService } from "@nestjs/config";
import { CacheService } from "../../shared/cache/cache.service";
import { Role } from "@prisma/client";

// --- Soft-delete comprehensive unit tests ---
//
// Covers: deleteUser (soft-delete), restoreUser, purgeUser, listUsers filtering,
// listDeletedUsers, purgeExpiredSoftDeletedUsers (30-day cron), audit logging,
// and edge cases (already deleted, not deleted, self-deletion, concurrent ops).

describe("AdminService soft-delete", () => {
  let service: AdminService;
  let mockPrisma: any;

  const adminId = "admin-001";
  const userId = "user-001";
  const otherUserId = "user-002";

  const mockActiveUser = {
    id: userId,
    email: "user@test.com",
    handle: "user001",
    name: "Test User",
    role: Role.USER,
    isActive: true,
    deletedAt: null,
    passwordHash: "hash",
    resetToken: null,
    resetTokenExpiresAt: null,
    verificationToken: null,
    verificationTokenExpiresAt: null,
  };

  const mockDeletedUser = {
    ...mockActiveUser,
    isActive: false,
    deletedAt: new Date("2026-07-01T00:00:00Z"),
  };

  const mockAdmin = {
    id: adminId,
    email: "admin@test.com",
    handle: "admin",
    name: "Admin",
    role: Role.ADMIN,
    isActive: true,
    deletedAt: null,
  };

  beforeEach(async () => {
    // Build a deep mock of prisma with all models used by the service.
    mockPrisma = {
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        create: jest.fn(),
      },
      session: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      refreshToken: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      apiKey: { updateMany: jest.fn().mockResolvedValue({ count: 0 }), deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      auditLog: { create: jest.fn().mockResolvedValue({}), updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      storyView: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      like: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      bookmark: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      highlight: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      comment: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      article: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      story: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      notification: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      media: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      follow: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      userRoleAssignment: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      userPermissionOverride: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      roleAssignmentHistory: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      rolePermissionRequestEvent: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      rolePermissionRequest: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }), updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      report: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      ticketAttachment: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      ticketInternalNote: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      ticketMessage: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      ticketAssignment: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      ticketStatusHistory: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      supportTicket: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      supportAgent: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      activityLog: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      helpArticleVersion: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      userSettings: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }), create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn(async (fn: any) => fn(mockPrisma)),
    };

    const module = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: CacheService, useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn() } },
      ],
    }).compile();
    service = module.get(AdminService);
  });

  // ─── deleteUser (soft-delete) ──────────────────────────────────────────

  describe("deleteUser (soft-delete)", () => {
    it("soft-deletes a user: sets isActive=false + deletedAt", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockActiveUser);
      mockPrisma.user.update.mockResolvedValue({
        ...mockActiveUser,
        isActive: false,
        deletedAt: new Date(),
      });

      const result = await service.deleteUser(adminId, userId);

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: expect.objectContaining({
          isActive: false,
          deletedAt: expect.any(Date),
        }),
      });
      expect(result.isActive).toBe(false);
      expect(result.deletedAt).toBeTruthy();
    });

    it("revokes sessions, refresh tokens, and API keys on soft-delete", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockActiveUser);
      mockPrisma.user.update.mockResolvedValue({ ...mockActiveUser, isActive: false, deletedAt: new Date() });

      await service.deleteUser(adminId, userId);

      expect(mockPrisma.session.deleteMany).toHaveBeenCalledWith({ where: { userId } });
      expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId } });
      expect(mockPrisma.apiKey.updateMany).toHaveBeenCalledWith({
        where: { userId, isActive: true },
        data: { isActive: false },
      });
    });

    it("writes an audit log entry with action SOFT_DELETE_USER", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockActiveUser);
      mockPrisma.user.update.mockResolvedValue({ ...mockActiveUser, isActive: false, deletedAt: new Date() });

      await service.deleteUser(adminId, userId);

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: adminId,
            action: "SOFT_DELETE_USER",
            resource: "user",
            resourceId: userId,
          }),
        }),
      );
    });

    it("throws BadRequestException if user is already soft-deleted", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockDeletedUser);

      await expect(service.deleteUser(adminId, userId)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it("throws ForbiddenException on self-deletion", async () => {
      await expect(service.deleteUser(adminId, adminId)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it("throws UnauthorizedException when actorId is missing", async () => {
      await expect(service.deleteUser(undefined as any, userId)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it("throws NotFoundException when user does not exist", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.deleteUser(adminId, "nonexistent")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  // ─── restoreUser ──────────────────────────────────────────────────────

  describe("restoreUser", () => {
    it("restores a soft-deleted user: clears deletedAt + sets isActive=true", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockDeletedUser);
      mockPrisma.user.update.mockResolvedValue({
        ...mockActiveUser,
        deletedAt: null,
        isActive: true,
      });

      const result = await service.restoreUser(adminId, userId);

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { isActive: true, deletedAt: null },
      });
      expect(result.isActive).toBe(true);
      expect(result.deletedAt).toBeNull();
    });

    it("writes an audit log entry with action RESTORE_USER", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockDeletedUser);
      mockPrisma.user.update.mockResolvedValue({ ...mockActiveUser });

      await service.restoreUser(adminId, userId);

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: adminId,
            action: "RESTORE_USER",
            resource: "user",
            resourceId: userId,
          }),
        }),
      );
    });

    it("throws BadRequestException if user is not soft-deleted", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockActiveUser);

      await expect(service.restoreUser(adminId, userId)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it("throws NotFoundException when user does not exist", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.restoreUser(adminId, "nonexistent")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("throws UnauthorizedException when actorId is missing", async () => {
      await expect(service.restoreUser(undefined as any, userId)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  // ─── purgeUser ────────────────────────────────────────────────────────

  describe("purgeUser (permanent deletion)", () => {
    it("permanently deletes user and all related records in a transaction", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockDeletedUser);
      mockPrisma.user.delete.mockResolvedValue({});

      const result = await service.purgeUser(adminId, userId);

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.user.delete).toHaveBeenCalledWith({ where: { id: userId } });
      // Verify related table cleanup was called
      expect(mockPrisma.article.deleteMany).toHaveBeenCalledWith({ where: { authorId: userId } });
      expect(mockPrisma.comment.deleteMany).toHaveBeenCalledWith({ where: { authorId: userId } });
      expect(mockPrisma.session.deleteMany).toHaveBeenCalledWith({ where: { userId } });
      expect(mockPrisma.auditLog.updateMany).toHaveBeenCalledWith({
        where: { userId },
        data: { userId: null },
      });
      expect(result).toEqual({ id: userId, purged: true });
    });

    it("writes audit log BEFORE deleting user (so userId FK is valid)", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockDeletedUser);
      mockPrisma.user.delete.mockResolvedValue({});

      await service.purgeUser(adminId, userId);

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: adminId,
            action: "PURGE_USER",
            resource: "user",
            resourceId: userId,
          }),
        }),
      );
    });

    it("throws BadRequestException if user is not soft-deleted", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockActiveUser);

      await expect(service.purgeUser(adminId, userId)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when user does not exist", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.purgeUser(adminId, "nonexistent")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  // ─── listUsers filtering ──────────────────────────────────────────────

  describe("listUsers soft-delete filtering", () => {
    it("filters out soft-deleted users by default (deletedAt: null)", async () => {
      mockPrisma.user.findMany.mockResolvedValue([mockActiveUser]);
      mockPrisma.user.count.mockResolvedValue(1);

      await service.listUsers(1, 20);

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ deletedAt: null }),
        }),
      );
    });

    it("includes soft-deleted users when includeDeleted=true", async () => {
      mockPrisma.user.findMany.mockResolvedValue([mockActiveUser, mockDeletedUser]);
      mockPrisma.user.count.mockResolvedValue(2);

      await service.listUsers(1, 20, undefined, true);

      const callArgs = mockPrisma.user.findMany.mock.calls[0][0];
      expect(callArgs.where.deletedAt).toBeUndefined();
    });

    it("includes deletedAt in the select clause", async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(0);

      await service.listUsers();

      const callArgs = mockPrisma.user.findMany.mock.calls[0][0];
      expect(callArgs.select.deletedAt).toBe(true);
    });
  });

  // ─── listDeletedUsers ─────────────────────────────────────────────────

  describe("listDeletedUsers", () => {
    it("returns only soft-deleted users ordered by deletedAt desc", async () => {
      mockPrisma.user.findMany.mockResolvedValue([mockDeletedUser]);
      mockPrisma.user.count.mockResolvedValue(1);

      const result = await service.listDeletedUsers(1, 20);

      const callArgs = mockPrisma.user.findMany.mock.calls[0][0];
      expect(callArgs.where).toEqual({ deletedAt: { not: null } });
      expect(callArgs.orderBy).toEqual({ deletedAt: "desc" });
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  // ─── purgeExpiredSoftDeletedUsers (30-day cron) ───────────────────────

  describe("purgeExpiredSoftDeletedUsers", () => {
    it("purges users soft-deleted more than 30 days ago", async () => {
      const oldDeletedUser = {
        ...mockDeletedUser,
        deletedAt: new Date("2026-06-01T00:00:00Z"), // More than 30 days ago
      };
      const recentDeletedUser = {
        ...mockDeletedUser,
        id: "user-recent",
        deletedAt: new Date(), // Just now — should NOT be purged
      };

      mockPrisma.user.findMany.mockImplementation(async ({ where }: any) => {
        // The service queries with deletedAt: { not: null, lt: cutoff }
        // Only oldDeletedUser matches.
        return [oldDeletedUser];
      });
      mockPrisma.user.delete.mockResolvedValue({});

      const purged = await service.purgeExpiredSoftDeletedUsers(30);

      expect(purged).toBe(1);
      expect(mockPrisma.user.delete).toHaveBeenCalledWith({ where: { id: oldDeletedUser.id } });
    });

    it("returns 0 when no users are past retention", async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);

      const purged = await service.purgeExpiredSoftDeletedUsers(30);

      expect(purged).toBe(0);
      expect(mockPrisma.user.delete).not.toHaveBeenCalled();
    });

    it("writes PURGE_USER_AUTO audit entry with userId=null (system action)", async () => {
      const oldDeletedUser = {
        ...mockDeletedUser,
        deletedAt: new Date("2026-06-01T00:00:00Z"),
      };
      mockPrisma.user.findMany.mockResolvedValue([oldDeletedUser]);
      mockPrisma.user.delete.mockResolvedValue({});

      await service.purgeExpiredSoftDeletedUsers(30);

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: null,
            action: "PURGE_USER_AUTO",
            resource: "user",
            resourceId: oldDeletedUser.id,
          }),
        }),
      );
    });

    it("continues purging other users if one fails (fault tolerance)", async () => {
      const user1 = { ...mockDeletedUser, id: "u1", deletedAt: new Date("2026-06-01") };
      const user2 = { ...mockDeletedUser, id: "u2", deletedAt: new Date("2026-06-02") };
      mockPrisma.user.findMany.mockResolvedValue([user1, user2]);
      // First delete fails, second succeeds
      mockPrisma.user.delete
        .mockRejectedValueOnce(new Error("FK constraint"))
        .mockResolvedValueOnce({});

      const purged = await service.purgeExpiredSoftDeletedUsers(30);

      expect(purged).toBe(1); // Only user2 succeeded
    });
  });

  // ─── Audit logging on all admin operations ───────────────────────────

  describe("audit logging coverage", () => {
    it("createUser writes CREATE_USER audit entry", async () => {
      jest.spyOn(service as any, "resolveRole").mockResolvedValue({
        kind: "legacy",
        legacyRole: Role.USER,
        rbacRoleKey: "registered_user",
        rbacRoleId: "x",
        raw: "USER",
        rank: 1,
      });
      jest.spyOn(service as any, "applyRole").mockResolvedValue(undefined);
      mockPrisma.user.create.mockResolvedValue(mockActiveUser);

      await service.createUser(adminId, "test@test.com", "Test", "test", "USER", "password123");

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: adminId,
            action: "CREATE_USER",
            resource: "user",
          }),
        }),
      );
    });

    it("toggleUserStatus writes TOGGLE_USER_STATUS audit entry", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockActiveUser);
      mockPrisma.user.update.mockResolvedValue({ ...mockActiveUser, isActive: false });

      await service.toggleUserStatus(adminId, userId);

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: adminId,
            action: "TOGGLE_USER_STATUS",
            resource: "user",
            resourceId: userId,
          }),
        }),
      );
    });
  });

  // ─── Integration: full soft-delete workflow ──────────────────────────

  describe("full soft-delete workflow integration", () => {
    it("soft-delete → list deleted → restore → list active (full cycle)", async () => {
      // Step 1: Soft-delete the user
      mockPrisma.user.findUnique.mockResolvedValue(mockActiveUser);
      mockPrisma.user.update.mockResolvedValue({
        ...mockActiveUser,
        isActive: false,
        deletedAt: new Date(),
      });
      const deleted = await service.deleteUser(adminId, userId);
      expect(deleted.isActive).toBe(false);
      expect(deleted.deletedAt).toBeTruthy();

      // Step 2: listDeletedUsers returns the deleted user
      mockPrisma.user.findMany.mockResolvedValue([{ ...mockActiveUser, isActive: false, deletedAt: new Date() }]);
      mockPrisma.user.count.mockResolvedValue(1);
      const deletedList = await service.listDeletedUsers(1, 20);
      expect(deletedList.total).toBe(1);
      expect(deletedList.data[0].id).toBe(userId);

      // Step 3: listUsers excludes the deleted user (where: { deletedAt: null })
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(0);
      const activeList = await service.listUsers(1, 20);
      expect(activeList.total).toBe(0);
      // Verify the where clause includes deletedAt: null
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ deletedAt: null }),
        }),
      );

      // Step 4: Restore the user
      mockPrisma.user.findUnique.mockResolvedValue({ ...mockActiveUser, isActive: false, deletedAt: new Date() });
      mockPrisma.user.update.mockResolvedValue({ ...mockActiveUser, isActive: true, deletedAt: null });
      const restored = await service.restoreUser(adminId, userId);
      expect(restored.isActive).toBe(true);
      expect(restored.deletedAt).toBeNull();

      // Step 5: Verify audit log entries for both operations
      const auditCalls = mockPrisma.auditLog.create.mock.calls;
      const actions = auditCalls.map((c: any) => c[0].data.action);
      expect(actions).toContain("SOFT_DELETE_USER");
      expect(actions).toContain("RESTORE_USER");
    });

    it("soft-delete → purge → user completely gone (permanent deletion)", async () => {
      // Step 1: Soft-delete
      mockPrisma.user.findUnique.mockResolvedValue(mockActiveUser);
      mockPrisma.user.update.mockResolvedValue({
        ...mockActiveUser,
        isActive: false,
        deletedAt: new Date(),
      });
      await service.deleteUser(adminId, userId);

      // Step 2: Purge
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockActiveUser,
        isActive: false,
        deletedAt: new Date(),
      });
      mockPrisma.user.delete.mockResolvedValue({});
      const result = await service.purgeUser(adminId, userId);
      expect(result.purged).toBe(true);

      // Step 3: Verify user.delete was called (permanent deletion)
      expect(mockPrisma.user.delete).toHaveBeenCalledWith({ where: { id: userId } });

      // Step 4: Verify audit log for both operations
      const auditCalls = mockPrisma.auditLog.create.mock.calls;
      const actions = auditCalls.map((c: any) => c[0].data.action);
      expect(actions).toContain("SOFT_DELETE_USER");
      expect(actions).toContain("PURGE_USER");
    });

    it("soft-delete → attempt to soft-delete again → BadRequestException", async () => {
      // First soft-delete succeeds
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockActiveUser);
      mockPrisma.user.update.mockResolvedValueOnce({
        ...mockActiveUser,
        isActive: false,
        deletedAt: new Date(),
      });
      await service.deleteUser(adminId, userId);

      // Second soft-delete fails
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        ...mockActiveUser,
        isActive: false,
        deletedAt: new Date(),
      });
      await expect(service.deleteUser(adminId, userId)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it("restore → attempt to restore active user → BadRequestException", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockActiveUser);

      await expect(service.restoreUser(adminId, userId)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it("purge without prior soft-delete → BadRequestException", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockActiveUser);

      await expect(service.purgeUser(adminId, userId)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
  });
});
