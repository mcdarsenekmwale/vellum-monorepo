import { Test } from "@nestjs/testing";
import { AdminService } from "./admin.service";
import { NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../shared/prisma/prisma.service";
import { ConfigService } from "@nestjs/config";
import { CacheService } from "../../shared/cache/cache.service";
import { Role } from "@prisma/client";

// --- Report endpoints: getReportById, deleteReport, bulkUpdateReportStatus ---
//
// Covers the 3 missing admin-report endpoints that the frontend (admin-dashboard)
// calls but the backend did not implement:
//   GET    /admin/reports/:id           → getReportById
//   DELETE /admin/reports/:id           → deleteReport
//   PUT    /admin/reports/bulk/status   → bulkUpdateReportStatus

describe("AdminService reports (get-by-id / delete / bulk-update)", () => {
  let service: AdminService;
  let mockPrisma: any;

  const actorId = "admin-001";
  const reportId = "report-001";
  const reportId2 = "report-002";
  const reportId3 = "report-003";

  const mockReporter = {
    id: "u1",
    name: "Reporter",
    handle: "reporter",
    email: "reporter@test.com",
  };

  const makeReport = (id: string, status = "PENDING", overrides: any = {}) => ({
    id,
    targetType: "article",
    targetId: "art-1",
    reason: "spam",
    reporterId: mockReporter.id,
    status,
    priority: "MEDIUM",
    notes: null,
    resolvedById: null,
    resolvedAt: null,
    aiScore: 0.3,
    createdAt: new Date("2026-08-01T00:00:00Z"),
    updatedAt: new Date("2026-08-01T00:00:00Z"),
    reporter: mockReporter,
    ...overrides,
  });

  beforeEach(async () => {
    mockPrisma = {
      report: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
        create: jest.fn(),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
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

  // ─── getReportById ─────────────────────────────────────────────────────

  describe("getReportById", () => {
    it("returns a single report with reporter info by id", async () => {
      const expected = makeReport(reportId, "PENDING");
      mockPrisma.report.findUnique.mockResolvedValue(expected);

      const result = await service.getReportById(reportId);

      expect(mockPrisma.report.findUnique).toHaveBeenCalledWith({
        where: { id: reportId },
        include: expect.objectContaining({
          reporter: expect.anything(),
        }),
      });
      expect(result.id).toBe(reportId);
      expect(result.status).toBe("PENDING");
      expect(result.reporter).toEqual(mockReporter);
    });

    it("includes reporter (handle/name/email), moderator, and resolution fields", async () => {
      const expected = makeReport(reportId, "RESOLVED", {
        resolvedById: actorId,
        resolvedAt: new Date("2026-08-05T00:00:00Z"),
        notes: "Reviewed and dismissed",
      });
      mockPrisma.report.findUnique.mockResolvedValue(expected);

      const result = await service.getReportById(reportId);

      // verify the include matches what listReports uses
      expect(mockPrisma.report.findUnique).toHaveBeenCalledTimes(1);
      const includeArg = mockPrisma.report.findUnique.mock.calls[0][0].include;
      expect(includeArg.reporter).toBeDefined();
      expect(result.resolvedById).toBe(actorId);
      expect(result.notes).toBe("Reviewed and dismissed");
    });

    it("throws NotFoundException when report does not exist", async () => {
      mockPrisma.report.findUnique.mockResolvedValue(null);

      await expect(service.getReportById("non-existent")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── deleteReport ──────────────────────────────────────────────────────

  describe("deleteReport", () => {
    it("deletes a report by id (hard delete — reports are moderation records)", async () => {
      const existing = makeReport(reportId);
      mockPrisma.report.findUnique.mockResolvedValue(existing);
      mockPrisma.report.delete.mockResolvedValue(existing);

      await service.deleteReport(actorId, reportId);

      expect(mockPrisma.report.delete).toHaveBeenCalledWith({
        where: { id: reportId },
      });
    });

    it("writes an audit log entry for the deletion", async () => {
      const existing = makeReport(reportId);
      mockPrisma.report.findUnique.mockResolvedValue(existing);
      mockPrisma.report.delete.mockResolvedValue(existing);

      await service.deleteReport(actorId, reportId);

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: actorId,
            action: "DELETE_REPORT",
            resource: "report",
            resourceId: reportId,
            success: true,
          }),
        }),
      );
    });

    it("throws NotFoundException when report does not exist", async () => {
      mockPrisma.report.findUnique.mockResolvedValue(null);

      await expect(service.deleteReport(actorId, "missing")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── bulkUpdateReportStatus ────────────────────────────────────────────

  describe("bulkUpdateReportStatus", () => {
    it("updates status for multiple reports in one call", async () => {
      const ids = [reportId, reportId2, reportId3];
      const updatedReports = [
        makeReport(reportId, "RESOLVED"),
        makeReport(reportId2, "RESOLVED"),
        makeReport(reportId3, "RESOLVED"),
      ];
      mockPrisma.report.findMany.mockResolvedValue(updatedReports);
      mockPrisma.report.updateMany.mockResolvedValue({ count: 3 });

      const result = await service.bulkUpdateReportStatus(actorId, ids, "RESOLVED");

      expect(mockPrisma.report.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ids } },
        data: expect.objectContaining({
          status: "RESOLVED",
          resolvedById: actorId,
          resolvedAt: expect.any(Date),
        }),
      });
      expect(result.updated).toBe(3);
      expect(result.reports).toHaveLength(3);
      expect(result.reports[0].id).toBe(reportId);
    });

    it("does NOT set resolvedById/resolvedAt when new status is not terminal", async () => {
      const ids = [reportId];
      mockPrisma.report.findMany.mockResolvedValue([makeReport(reportId, "IN_PROGRESS")]);
      mockPrisma.report.updateMany.mockResolvedValue({ count: 1 });

      await service.bulkUpdateReportStatus(actorId, ids, "IN_PROGRESS");

      const dataArg = mockPrisma.report.updateMany.mock.calls[0][0].data;
      expect(dataArg.status).toBe("IN_PROGRESS");
      expect(dataArg.resolvedById).toBeUndefined();
      expect(dataArg.resolvedAt).toBeUndefined();
    });

    it("clears resolvedById/resolvedAt when re-opening a previously resolved report", async () => {
      const ids = [reportId];
      mockPrisma.report.findMany.mockResolvedValue([makeReport(reportId, "PENDING")]);
      mockPrisma.report.updateMany.mockResolvedValue({ count: 1 });

      await service.bulkUpdateReportStatus(actorId, ids, "PENDING");

      const dataArg = mockPrisma.report.updateMany.mock.calls[0][0].data;
      expect(dataArg.status).toBe("PENDING");
      expect(dataArg.resolvedById).toBeNull();
      expect(dataArg.resolvedAt).toBeNull();
    });

    it("returns updated=0 and empty reports when ids array is empty", async () => {
      const result = await service.bulkUpdateReportStatus(actorId, [], "RESOLVED");

      expect(mockPrisma.report.updateMany).not.toHaveBeenCalled();
      expect(mockPrisma.report.findMany).not.toHaveBeenCalled();
      expect(result.updated).toBe(0);
      expect(result.reports).toEqual([]);
    });

    it("passes note param into moderation notes when provided", async () => {
      const ids = [reportId];
      mockPrisma.report.findMany.mockResolvedValue([makeReport(reportId, "RESOLVED", { notes: "bulk dismissed" })]);
      mockPrisma.report.updateMany.mockResolvedValue({ count: 1 });

      await service.bulkUpdateReportStatus(actorId, ids, "RESOLVED", "bulk dismissed");

      const dataArg = mockPrisma.report.updateMany.mock.calls[0][0].data;
      expect(dataArg.notes).toBe("bulk dismissed");
    });

    it("fetches updated records with reporter include after update", async () => {
      const ids = [reportId, reportId2];
      mockPrisma.report.findMany.mockResolvedValue([
        makeReport(reportId, "RESOLVED"),
        makeReport(reportId2, "RESOLVED"),
      ]);
      mockPrisma.report.updateMany.mockResolvedValue({ count: 2 });

      await service.bulkUpdateReportStatus(actorId, ids, "RESOLVED");

      // after updateMany, findMany should be called to return the updated rows
      expect(mockPrisma.report.findMany).toHaveBeenCalledWith({
        where: { id: { in: ids } },
        include: expect.objectContaining({ reporter: expect.anything() }),
      });
    });
  });
});
