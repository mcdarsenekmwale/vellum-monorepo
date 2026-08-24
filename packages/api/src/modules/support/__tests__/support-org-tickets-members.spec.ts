import { Test } from "@nestjs/testing";
import { SupportService } from "../support.service";
import { SupportController } from "../support.controller";
import { PrismaService } from "../../../shared/prisma/prisma.service";
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
  CanActivate,
} from "@nestjs/common";
import { TicketStatus } from "@prisma/client";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { PermissionsGuard } from "../../rbac/permissions.guard";

declare const jest: any;
const vi: any = {
  fn: (...args: any[]) => {
    if (typeof jest !== "undefined" && typeof jest.fn === "function")
      return jest.fn(...args);
    return (globalThis as any).vi.fn(...args);
  },
};

const mkDate = () => new Date("2025-01-01T00:00:00.000Z");

/** Pass-through mock guard to bypass authentication in isolated controller tests. */
const NoopGuard: CanActivate = { canActivate: () => true };

/**
 * TDD RED→GREEN tests for:
 *  (R1-R6) Ticket routing / ownership behaviour
 *  (M1-M3) Agent↔Team membership operations + team query by department
 */

// ────────────────────────────────────────────────────────────────────────────
// (R1-R4) routeTicket service-level tests
// ────────────────────────────────────────────────────────────────────────────
describe("R Group — Ticket routing / ownership", () => {
  let service: SupportService;
  let prisma: any;

  const ticketBase: any = {
    id: "tkt-1",
    ticketNumber: "TKT-001",
    subject: "Hello",
    message: "Msg",
    status: "NEW" as TicketStatus,
    userId: "user-reporter",
    assigneeId: null,
    departmentId: null,
    teamId: null,
    createdAt: mkDate(),
    updatedAt: mkDate(),
    deletedAt: null,
  };

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        SupportService,
        {
          provide: PrismaService,
          useValue: {
            supportTicket: {},
            ticketAssignment: {},
            ticketStatusHistory: {},
            supportAgent: {},
            supportTeam: {},
            supportDepartment: {},
            supportAgentTeamMembership: {},
            activityLog: { create: vi.fn().mockResolvedValue({}) },
            auditLog: { create: vi.fn().mockResolvedValue({}) },
            ticketCategory: {},
            user: {},
            $transaction: async (cb: any) => cb({
              ticketAssignment: {},
              ticketStatusHistory: {},
              supportAgentTeamMembership: {},
            }),
          },
        },
      ],
    }).compile();
    service = mod.get<SupportService>(SupportService);
    prisma = mod.get<PrismaService>(PrismaService) as any;
  });

  // ── R1 ─────────────────────────────────────────────────────────────────
  it("R1: routeTicket with no agentId/teamId/departmentId throws BadRequest (400)", async () => {
    await expect(
      (service as any).routeTicket({
        ticketId: "tkt-1",
        assignedBy: "admin-1",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  // ── R2 ─────────────────────────────────────────────────────────────────
  it("R2: routeTicket with invalid teamId throws NotFound (404)", async () => {
    prisma.supportTicket.findFirst = vi.fn().mockResolvedValue({ ...ticketBase });
    prisma.supportTeam.findUnique = vi.fn().mockResolvedValue(null);

    await expect(
      (service as any).routeTicket({
        ticketId: "tkt-1",
        teamId: "team-not-exist",
        assignedBy: "admin-1",
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  // ── R3 ─────────────────────────────────────────────────────────────────
  it("R3: route to valid agentId → updates assigneeId AND creates TicketAssignment", async () => {
    const agent = { userId: "agent-1", isActive: true, deletedAt: null };
    prisma.supportTicket.findFirst = vi.fn().mockResolvedValue({ ...ticketBase });
    prisma.supportAgent.findUnique = vi.fn().mockResolvedValue(agent);
    prisma.ticketAssignment.updateMany = vi.fn().mockResolvedValue({ count: 0 });
    prisma.ticketAssignment.create = vi.fn().mockResolvedValue({ id: "ta-1" });
    prisma.supportAgent.updateMany = vi.fn().mockResolvedValue({ count: 1 });
    prisma.supportTicket.update = vi
      .fn()
      .mockResolvedValue({ ...ticketBase, assigneeId: "agent-1" });
    prisma.ticketStatusHistory.create = vi.fn().mockResolvedValue({});

    await (service as any).routeTicket({
      ticketId: "tkt-1",
      agentId: "agent-1",
      assignedBy: "admin-1",
      reason: "R3 routing",
    });

    // assigneeId written on ticket
    const ticketUpd = prisma.supportTicket.update.mock.calls[0][0];
    expect(ticketUpd.where.id).toBe("tkt-1");
    expect(ticketUpd.data.assigneeId).toBe("agent-1");

    // TicketAssignment created referencing that agent
    const taCreate = prisma.ticketAssignment.create.mock.calls[0][0].data;
    expect(taCreate.ticketId).toBe("tkt-1");
    expect(taCreate.agentId).toBe("agent-1");
    expect(taCreate.assignedBy).toBe("admin-1");
    expect(taCreate.reason).toBe("R3 routing");
  });

  // ── R4 ─────────────────────────────────────────────────────────────────
  it("R4: route to valid teamId + departmentId → writes teamId/departmentId on ticket", async () => {
    const team = { id: "team-1", deletedAt: null };
    const dept = { id: "dept-1", deletedAt: null };
    prisma.supportTicket.findFirst = vi
      .fn()
      .mockResolvedValue({ ...ticketBase, status: "ASSIGNED" });
    prisma.supportTeam.findUnique = vi.fn().mockResolvedValue(team);
    prisma.supportDepartment.findUnique = vi.fn().mockResolvedValue(dept);
    prisma.supportTicket.update = vi.fn().mockResolvedValue({
      ...ticketBase,
      teamId: "team-1",
      departmentId: "dept-1",
    });

    await (service as any).routeTicket({
      ticketId: "tkt-1",
      teamId: "team-1",
      departmentId: "dept-1",
      assignedBy: "admin-1",
    });

    const args = prisma.supportTicket.update.mock.calls[0][0];
    expect(args.data.teamId).toBe("team-1");
    expect(args.data.departmentId).toBe("dept-1");
  });

  // ── R5 ─────────────────────────────────────────────────────────────────
  it("R5: route NEW ticket + agent → status becomes ASSIGNED, status history NEW→ASSIGNED", async () => {
    const agent = { userId: "agent-1", isActive: true, deletedAt: null };
    prisma.supportTicket.findFirst = vi.fn().mockResolvedValue({ ...ticketBase });
    prisma.supportAgent.findUnique = vi.fn().mockResolvedValue(agent);
    prisma.ticketAssignment.updateMany = vi.fn().mockResolvedValue({ count: 0 });
    prisma.ticketAssignment.create = vi.fn().mockResolvedValue({ id: "ta-1" });
    prisma.supportAgent.updateMany = vi.fn().mockResolvedValue({ count: 1 });
    prisma.supportTicket.update = vi
      .fn()
      .mockResolvedValue({ ...ticketBase, assigneeId: "agent-1", status: "ASSIGNED" });
    prisma.ticketStatusHistory.create = vi.fn().mockResolvedValue({});

    await (service as any).routeTicket({
      ticketId: "tkt-1",
      agentId: "agent-1",
      assignedBy: "admin-1",
    });

    const ticketUpd = prisma.supportTicket.update.mock.calls[0][0];
    expect(ticketUpd.data.status).toBe("ASSIGNED");

    const hist = prisma.ticketStatusHistory.create.mock.calls[0][0].data;
    expect(hist.fromStatus).toBe("NEW");
    expect(hist.toStatus).toBe("ASSIGNED");
    expect(hist.changedById).toBe("admin-1");
  });

  // ── R6 ─────────────────────────────────────────────────────────────────
  it("R6: getTicket includes team.departmentId (team relation included by ticketInclude)", async () => {
    const department = { id: "dept-1", name: "Support" };
    const team = { id: "team-1", name: "L1", departmentId: "dept-1" };
    const fullTicket: any = {
      ...ticketBase,
      teamId: "team-1",
      departmentId: "dept-1",
      team,
      department,
      messages: [],
      internalNotes: [],
      attachments: [],
      statusHistory: [],
      tagAssignments: [],
      assignments: [],
    };
    prisma.supportTicket.findFirst = vi.fn().mockResolvedValue(fullTicket);

    const res = await service.getTicket("tkt-1");
    expect((res as any).team).toBeDefined();
    expect((res as any).team.id).toBe("team-1");
    // critical check for R6
    expect((res as any).team.departmentId).toBe("dept-1");

    // Verify the include actually requests the `team` relation on findFirst
    // (spread from ticketInclude helper — must be present after GREEN fix)
    const incl = prisma.supportTicket.findFirst.mock.calls[0][0].include;
    expect(incl.team).toBeDefined();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// (R6 addendum) controller / e2e-level route shape: GET /tickets/:id must
// also surface team.departmentId through HTTP.  We use the Nest controller
// directly with a mocked service so we can assert the integration.
// ────────────────────────────────────────────────────────────────────────────
describe("R6-controller — ticket detail returns team.departmentId", () => {
  let controller: SupportController;
  let service: any;

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      controllers: [SupportController],
      providers: [
        {
          provide: SupportService,
          useValue: { getTicket: vi.fn() },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard).useValue(NoopGuard)
      .overrideGuard(PermissionsGuard).useValue(NoopGuard)
      .compile();
    controller = mod.get<SupportController>(SupportController);
    service = mod.get<SupportService>(SupportService);
  });

  it("R6: controller returns ticket with team.departmentId", async () => {
    service.getTicket.mockResolvedValue({
      id: "tkt-1",
      ticketNumber: "TKT-1",
      team: { id: "team-1", departmentId: "dept-1", name: "L1" },
    });
    const out: any = await controller.getTicket("tkt-1");
    expect(out.team).toBeDefined();
    expect(out.team.departmentId).toBe("dept-1");
  });
});

// ────────────────────────────────────────────────────────────────────────────
// (M1-M2) Agent ↔ Team membership service behaviour
// ────────────────────────────────────────────────────────────────────────────
describe("M Group — Agent team membership operations", () => {
  let service: SupportService;
  let prisma: any;
  let txMock: any;

  beforeEach(async () => {
    txMock = {
      supportAgentTeamMembership: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation((x: any) => ({ id: "m-new", ...x.data })),
        update: vi.fn().mockImplementation((x: any) => ({ id: "m-upd", ...x.data })),
      },
    };
    const prismaMock: any = {
      supportAgent: {},
      supportTeam: {},
      supportAgentTeamMembership: {},
      $transaction: async (cb: any) => cb(txMock),
    };
    const mod = await Test.createTestingModule({
      providers: [
        SupportService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    service = mod.get<SupportService>(SupportService);
    prisma = mod.get<PrismaService>(PrismaService) as any;
  });

  // ── M1a: POST adds membership ──────────────────────────────────────────
  it("M1a: addAgentToTeam creates membership + auto-promotes first to primary", async () => {
    prisma.supportAgent.findUnique = vi.fn().mockResolvedValue({ id: "a-1", deletedAt: null });
    prisma.supportTeam.findUnique = vi.fn().mockResolvedValue({ id: "t-1", deletedAt: null });
    prisma.supportAgentTeamMembership.findFirst = vi.fn().mockResolvedValue(null);

    const created: any = await service.addAgentToTeam("a-1", "t-1", {
      assignedBy: "admin-1",
    });

    expect(prisma.supportAgentTeamMembership.findFirst).toHaveBeenCalled();
    const createArgs = txMock.supportAgentTeamMembership.create.mock.calls[0][0].data;
    expect(createArgs.agentId).toBe("a-1");
    expect(createArgs.teamId).toBe("t-1");
    expect(createArgs.assignedBy).toBe("admin-1");
    // first membership -> auto promoted to primary
    expect(createArgs.isPrimary).toBe(true);
  });

  // ── M1b: DELETE removes membership ─────────────────────────────────────
  it("M1b: removeAgentFromTeam closes endDate; promotes replacement primary when needed", async () => {
    const primaryRow = { id: "m-primary", agentId: "a-1", teamId: "t-1", isPrimary: true, endDate: null };
    const otherRow = { id: "m-other", agentId: "a-1", teamId: "t-2", isPrimary: false, endDate: null };
    prisma.supportAgentTeamMembership.findFirst = vi
      .fn()
      .mockResolvedValueOnce(primaryRow);
    // Inside the $transaction, findFirst looks for the replacement primary:
    // the service calls findFirst on the transaction-passed `tx` handle.
    txMock.supportAgentTeamMembership.findFirst = vi
      .fn()
      .mockResolvedValueOnce(otherRow);

    await service.removeAgentFromTeam("a-1", "t-1");

    const closeArgs = txMock.supportAgentTeamMembership.update.mock.calls[0][0].data;
    expect(closeArgs.endDate).toBeInstanceOf(Date);
    expect(closeArgs.isPrimary).toBe(false);

    // Old primary was removed, so `m-other` should be promoted (2nd update call)
    const promoteCall = txMock.supportAgentTeamMembership.update.mock.calls[1];
    expect(promoteCall).toBeDefined();
    expect(promoteCall[0].data.isPrimary).toBe(true);
  });

  it("M1b(cont): removeAgentFromTeam throws NotFound when no active membership", async () => {
    prisma.supportAgentTeamMembership.findFirst = vi.fn().mockResolvedValue(null);
    await expect(service.removeAgentFromTeam("a-1", "t-1")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  // ── M1c: POST .../primary sets primary ────────────────────────────────
  it("M1c: setPrimaryTeam demotes old primary + promotes the requested", async () => {
    const oldPrimary = { id: "m-old", agentId: "a-1", teamId: "t-1", isPrimary: true, endDate: null };
    const newPrimary = { id: "m-new", agentId: "a-1", teamId: "t-2", isPrimary: false, endDate: null };
    prisma.supportAgentTeamMembership.findFirst = vi
      .fn()
      .mockResolvedValueOnce(oldPrimary)
      .mockResolvedValueOnce(newPrimary);

    await service.setPrimaryTeam("a-1", "t-2");

    const demoteArgs = txMock.supportAgentTeamMembership.update.mock.calls[0];
    expect(demoteArgs[0].where.id).toBe("m-old");
    expect(demoteArgs[0].data.isPrimary).toBe(false);

    const promoteArgs = txMock.supportAgentTeamMembership.update.mock.calls[1];
    expect(promoteArgs[0].where.id).toBe("m-new");
    expect(promoteArgs[0].data.isPrimary).toBe(true);
  });

  it("M1c(cont): setPrimaryTeam throws NotFound when agent not on team", async () => {
    prisma.supportAgentTeamMembership.findFirst = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    await expect(service.setPrimaryTeam("a-1", "t-missing")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  // ── M2: double-add returns 409 Conflict ────────────────────────────────
  it("M2: addAgentToTeam twice for same pair throws ConflictException (409)", async () => {
    prisma.supportAgent.findUnique = vi.fn().mockResolvedValue({ id: "a-1", deletedAt: null });
    prisma.supportTeam.findUnique = vi.fn().mockResolvedValue({ id: "t-1", deletedAt: null });
    prisma.supportAgentTeamMembership.findFirst = vi.fn().mockResolvedValue({
      id: "existing",
      agentId: "a-1",
      teamId: "t-1",
      endDate: null,
    });

    await expect(
      service.addAgentToTeam("a-1", "t-1"),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// (M1-controller) HTTP route shapes — the controller must expose the three
// membership endpoints with the documented URL shapes.
// ────────────────────────────────────────────────────────────────────────────
describe("M1-controller — membership HTTP endpoints exist", () => {
  let controller: SupportController;
  let service: any;

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      controllers: [SupportController],
      providers: [
        {
          provide: SupportService,
          useValue: {
            addAgentToTeam: vi.fn().mockResolvedValue({ id: "m-1" }),
            removeAgentFromTeam: vi.fn().mockResolvedValue({ success: true }),
            setPrimaryTeam: vi.fn().mockResolvedValue({ id: "m-1", isPrimary: true }),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard).useValue(NoopGuard)
      .overrideGuard(PermissionsGuard).useValue(NoopGuard)
      .compile();
    controller = mod.get<SupportController>(SupportController);
    service = mod.get<SupportService>(SupportService);
  });

  it("M1: POST agents/:aid/teams/:tid → addAgentToTeam(service)", async () => {
    const res = await controller.addAgentToTeam("a-1", "t-1", { isPrimary: true, assignedBy: "admin-1" });
    expect(service.addAgentToTeam).toHaveBeenCalledWith("a-1", "t-1", {
      isPrimary: true,
      assignedBy: "admin-1",
    });
    expect(res).toEqual({ id: "m-1" });
  });

  it("M1: DELETE agents/:aid/teams/:tid → removeAgentFromTeam(service)", async () => {
    const res = await controller.removeAgentFromTeam("a-1", "t-1");
    expect(service.removeAgentFromTeam).toHaveBeenCalledWith("a-1", "t-1");
    expect(res).toEqual({ success: true });
  });

  it("M1: POST agents/:aid/teams/:tid/primary → setPrimaryTeam(service)", async () => {
    const res = await controller.setPrimaryTeam("a-1", "t-1");
    expect(service.setPrimaryTeam).toHaveBeenCalledWith("a-1", "t-1");
    expect((res as any).isPrimary).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// (M3) Teams list is filterable by departmentId and department detail
// embeds its teams.
// ────────────────────────────────────────────────────────────────────────────
describe("M3 — Teams queried by departmentId", () => {
  let service: SupportService;
  let prisma: any;

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        SupportService,
        {
          provide: PrismaService,
          useValue: {
            supportDepartment: {},
            supportTeam: {},
          },
        },
      ],
    }).compile();
    service = mod.get<SupportService>(SupportService);
    prisma = mod.get<PrismaService>(PrismaService) as any;
  });

  it("M3: listTeams({departmentId}) filters by departmentId", async () => {
    prisma.supportTeam.count = vi.fn().mockResolvedValue(2);
    prisma.supportTeam.findMany = vi.fn().mockResolvedValue([
      { id: "t1", name: "L1", departmentId: "dept-1" },
      { id: "t2", name: "L2", departmentId: "dept-1" },
    ]);

    const r: any = await service.listTeams({ departmentId: "dept-1" });
    expect(r.total).toBe(2);
    const where = prisma.supportTeam.findMany.mock.calls[0][0].where;
    expect(where.departmentId).toBe("dept-1");
  });

  it("M3: getDepartment includes teams array (departments/:id/teams equivalent)", async () => {
    prisma.supportDepartment.findUnique = vi.fn().mockResolvedValue({
      id: "dept-1",
      name: "Support",
      teams: [
        { id: "t1", name: "L1" },
        { id: "t2", name: "L2" },
      ],
      deletedAt: null,
    });
    const d: any = await service.getDepartment("dept-1");
    expect(d.teams).toHaveLength(2);
    expect(d.teams[0].id).toBe("t1");
  });
});
