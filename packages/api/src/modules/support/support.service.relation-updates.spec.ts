import { Test } from "@nestjs/testing";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { SupportService } from "./support.service";
import { PrismaService } from "../../shared/prisma/prisma.service";

declare const jest: any;
const vi: any = {
  fn: (...args: any[]) => {
    if (typeof jest !== "undefined" && typeof jest.fn === "function") return jest.fn(...args);
    return (globalThis as any).vi.fn(...args);
  },
};

describe("SupportService — relation update handling", () => {
  let service: SupportService;
  let prisma: any;

  const existingTeam = {
    id: "team-1",
    name: "Billing L1",
    departmentId: "dept-1",
    deletedAt: null,
    maxTicketsPerAgent: 10,
    concurrentTicketLimitPerAgent: 4,
  };

  beforeEach(async () => {
    prisma = {
      supportTeam: {},
      supportDepartment: {},
      user: {},
    };
    const mod = await Test.createTestingModule({
      providers: [
        SupportService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = mod.get(SupportService);
  });

  describe("updateTeam", () => {
    beforeEach(() => {
      prisma.supportTeam.findUnique = vi.fn().mockResolvedValue(existingTeam);
      prisma.supportTeam.update = vi.fn().mockImplementation(({ data }) =>
        Promise.resolve({ ...existingTeam, ...data }),
      );
    });

    it("uses department.connect (not departmentId) when departmentId is provided", async () => {
      prisma.supportDepartment.findUnique = vi.fn().mockResolvedValue({
        id: "dept-2",
        deletedAt: null,
      });

      await service.updateTeam("team-1", { departmentId: "dept-2" });

      const updateArgs = prisma.supportTeam.update.mock.calls[0][0];
      expect(updateArgs.data.department).toEqual({ connect: { id: "dept-2" } });
      expect(updateArgs.data.departmentId).toBeUndefined();
    });

    it("does not change department when departmentId is omitted", async () => {
      await service.updateTeam("team-1", { name: "Renamed Team" });

      const updateArgs = prisma.supportTeam.update.mock.calls[0][0];
      expect(updateArgs.data.name).toBe("Renamed Team");
      expect(updateArgs.data.department).toBeUndefined();
    });

    it("throws NotFoundException for invalid departmentId", async () => {
      prisma.supportDepartment.findUnique = vi.fn().mockResolvedValue(null);

      await expect(
        service.updateTeam("team-1", { departmentId: "missing-dept" }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.supportTeam.update).not.toHaveBeenCalled();
    });

    it("throws NotFoundException for soft-deleted departmentId", async () => {
      prisma.supportDepartment.findUnique = vi.fn().mockResolvedValue({
        id: "dept-archived",
        deletedAt: new Date(),
      });

      await expect(
        service.updateTeam("team-1", { departmentId: "dept-archived" }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("rejects null departmentId because team department is required", async () => {
      await expect(
        service.updateTeam("team-1", { departmentId: null as any }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.supportTeam.update).not.toHaveBeenCalled();
    });

    it("uses lead.connect when leadId is provided", async () => {
      prisma.user.findUnique = vi.fn().mockResolvedValue({ id: "user-lead" });

      await service.updateTeam("team-1", { leadId: "user-lead" });

      const updateArgs = prisma.supportTeam.update.mock.calls[0][0];
      expect(updateArgs.data.lead).toEqual({ connect: { id: "user-lead" } });
      expect(updateArgs.data.leadId).toBeUndefined();
    });

    it("uses lead.disconnect when leadId is null", async () => {
      await service.updateTeam("team-1", { leadId: null });

      const updateArgs = prisma.supportTeam.update.mock.calls[0][0];
      expect(updateArgs.data.lead).toEqual({ disconnect: true });
      expect(updateArgs.data.leadId).toBeUndefined();
    });

    it("updates multiple scalar and relation fields together", async () => {
      prisma.supportDepartment.findUnique = vi.fn().mockResolvedValue({
        id: "dept-2",
        deletedAt: null,
      });
      prisma.user.findUnique = vi.fn().mockResolvedValue({ id: "user-lead" });

      await service.updateTeam("team-1", {
        name: "New Name",
        description: "New Description",
        departmentId: "dept-2",
        leadId: "user-lead",
      });

      const updateArgs = prisma.supportTeam.update.mock.calls[0][0];
      expect(updateArgs.data.name).toBe("New Name");
      expect(updateArgs.data.description).toBe("New Description");
      expect(updateArgs.data.department).toEqual({ connect: { id: "dept-2" } });
      expect(updateArgs.data.lead).toEqual({ connect: { id: "user-lead" } });
    });
  });

  describe("updateDepartment", () => {
    beforeEach(() => {
      prisma.supportDepartment.findUnique = vi.fn().mockResolvedValue({
        id: "dept-1",
        deletedAt: null,
        firstResponseSlaMinutes: 15,
        resolutionSlaMinutes: 240,
        businessHoursStartMin: 540,
        businessHoursEndMin: 1020,
      });
      prisma.supportDepartment.update = vi.fn().mockResolvedValue({ id: "dept-1" });
    });

    it("uses head.connect instead of headId scalar on update", async () => {
      prisma.user.findUnique = vi.fn().mockResolvedValue({ id: "user-head" });

      await service.updateDepartment("dept-1", { headId: "user-head" });

      const updateArgs = prisma.supportDepartment.update.mock.calls[0][0];
      expect(updateArgs.data.head).toEqual({ connect: { id: "user-head" } });
      expect(updateArgs.data.headId).toBeUndefined();
    });
  });

  describe("updateAgent", () => {
    beforeEach(() => {
      prisma.supportAgent = {
        findUnique: vi.fn().mockResolvedValue({ userId: "u1", deletedAt: null }),
        update: vi.fn().mockResolvedValue({ userId: "u1" }),
      };
    });

    it("uses department.connect and team.disconnect relation syntax", async () => {
      prisma.supportDepartment.findUnique = vi.fn().mockResolvedValue({
        id: "dept-2",
        deletedAt: null,
      });

      await service.updateAgent("u1", { departmentId: "dept-2", teamId: null });

      const updateArgs = prisma.supportAgent.update.mock.calls[0][0];
      expect(updateArgs.data.department).toEqual({ connect: { id: "dept-2" } });
      expect(updateArgs.data.team).toEqual({ disconnect: true });
      expect(updateArgs.data.departmentId).toBeUndefined();
      expect(updateArgs.data.teamId).toBeUndefined();
    });
  });
});
