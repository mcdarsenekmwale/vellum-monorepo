import { Test } from "@nestjs/testing";
import { SupportService } from "./support.service";
import { PrismaService } from "../../shared/prisma/prisma.service";
import {
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import {
  Role,
  AccessRequestStatus,
  AccessRequestType,
} from "@prisma/client";

/**
 * Tests for the ticket access-control system in SupportService:
 *
 *   1. Role-based visibility for listTickets
 *      - admin / support_admin → all tickets
 *      - support agent / regular user → only owned + assigned + team + granted
 *
 *   2. Role-based access for getTicket
 *      - admin → can fetch any ticket
 *      - non-admin without access → ForbiddenException
 *      - non-admin with grant → can fetch
 *
 *   3. canAccessTicket
 *      - returns the correct reason for each access path
 *
 *   4. requestTicketAccess workflow
 *      - rejects duplicate PENDING requests
 *      - rejects when user already has access
 *      - creates PENDING request with history event
 *
 *   5. approveTicketAccessRequest
 *      - non-admin → ForbiddenException
 *      - approves + creates UserResourceAccess grant
 *      - subsequent getTicket succeeds for the requester
 *
 *   6. rejectTicketAccessRequest
 *      - non-admin → ForbiddenException
 *      - rejects without creating a grant
 *
 *   7. cancelTicketAccessRequest
 *      - only the requester can cancel
 *      - non-PENDING → BadRequest
 */

// ─── Stub types ─────────────────────────────────────────────────────────────

type StubTicket = {
  id: string;
  ticketNumber: string;
  subject: string;
  message: string;
  description: string | null;
  status: string;
  priority: string;
  type: string;
  userId: string;
  assigneeId: string | null;
  teamId: string | null;
  departmentId: string | null;
  categoryId: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
  closedAt: Date | null;
  reopenedAt: Date | null;
  firstResponseAt: Date | null;
};

type StubAccessRequest = {
  id: string;
  requesterId: string;
  reviewerId: string | null;
  resourceType: string;
  resourceId: string | null;
  permissionKey: string;
  type: string;
  status: string;
  justification: string;
  adminJustification: string | null;
  startsAt: Date | null;
  expiresAt: Date | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  history: any[];
};

type StubResourceAccess = {
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

type StubAgent = {
  id: string;
  userId: string;
  status: string;
  isActive: boolean;
  deletedAt: Date | null;
};

type StubMembership = {
  id: string;
  agentId: string;
  teamId: string;
  endDate: Date | null;
};

// ─── Mock Prisma ────────────────────────────────────────────────────────────

class MockPrisma {
  tickets: StubTicket[] = [];
  accessRequests: StubAccessRequest[] = [];
  resourceAccess: StubResourceAccess[] = [];
  agents: StubAgent[] = [];
  memberships: StubMembership[] = [];
  auditLogs: any[] = [];

  // Used to simulate unique constraint failures etc.
  nextId = 1;
  nextIdStr() {
    return `id-${this.nextId++}`;
  }

  supportTicket = {
    findUnique: async (q: any) => {
      const t = this.tickets.find((x) => x.id === q?.where?.id);
      if (!t || t.deletedAt) return null;
      return { ...t };
    },
    findFirst: async (q: any) => {
      const w = q?.where ?? {};
      let rows = this.tickets.filter((t) => !t.deletedAt);
      if (w.id) rows = rows.filter((t) => t.id === w.id);
      if (w.deletedAt === null) rows = rows.filter((t) => !t.deletedAt);
      return rows[0] ?? null;
    },
    findMany: async (q: any) => {
      const w = q?.where ?? {};
      let rows = this.tickets.filter((t) => !t.deletedAt);
      // Honour role-based visibility filter — when the caller passes
      // `actor`, SupportService merges an OR clause into `where.AND`.
      const and = w.AND;
      if (Array.isArray(and)) {
        for (const clause of and) {
          if (clause.OR) {
            rows = rows.filter((t) =>
              clause.OR.some((or: any) => {
                if (or.userId !== undefined) return t.userId === or.userId;
                if (or.assigneeId !== undefined) return t.assigneeId === or.assigneeId;
                if (or.teamId?.in) return or.teamId.in.includes(t.teamId);
                if (or.id?.in) return or.id.in.includes(t.id);
                return false;
              }),
            );
          }
        }
      }
      if (w.OR) {
        rows = rows.filter((t) =>
          w.OR.some((or: any) => {
            if (or.userId !== undefined) return t.userId === or.userId;
            if (or.assigneeId !== undefined) return t.assigneeId === or.assigneeId;
            if (or.teamId?.in) return or.teamId.in.includes(t.teamId);
            if (or.id?.in) return or.id.in.includes(t.id);
            if (or.subject?.contains) {
              return t.subject.toLowerCase().includes(or.subject.contains.toLowerCase());
            }
            return false;
          }),
        );
      }
      if (w.status) rows = rows.filter((t) => t.status === w.status);
      if (w.assigneeId) rows = rows.filter((t) => t.assigneeId === w.assigneeId);
      if (w.assigneeId === null) rows = rows.filter((t) => t.assigneeId === null);
      return rows;
    },
    count: async (q: any) => {
      const rows = await this.supportTicket.findMany(q);
      return rows.length;
    },
    create: async () => {
      throw new Error("not used in access-control tests");
    },
  };

  accessRequest = {
    findUnique: async (q: any) => {
      const r = this.accessRequests.find((x) => x.id === q?.where?.id);
      return r ? { ...r } : null;
    },
    findFirst: async (q: any) => {
      const w = q?.where ?? {};
      const rows = this.accessRequests.filter((r) => {
        if (w.requesterId && r.requesterId !== w.requesterId) return false;
        if (w.resourceType && r.resourceType !== w.resourceType) return false;
        if (w.resourceId && r.resourceId !== w.resourceId) return false;
        if (w.permissionKey && r.permissionKey !== w.permissionKey) return false;
        if (w.status && r.status !== w.status) return false;
        return true;
      });
      return rows[0] ?? null;
    },
    findMany: async (q: any) => {
      const w = q?.where ?? {};
      return this.accessRequests.filter((r) => {
        if (w.requesterId && r.requesterId !== w.requesterId) return false;
        if (w.resourceType && r.resourceType !== w.resourceType) return false;
        if (w.resourceId && r.resourceId !== w.resourceId) return false;
        if (w.permissionKey && r.permissionKey !== w.permissionKey) return false;
        if (w.status && r.status !== w.status) return false;
        return true;
      });
    },
    count: async (q: any) => {
      const rows = await this.accessRequest.findMany(q);
      return rows.length;
    },
    create: async (q: any) => {
      const data = q?.data ?? {};
      const id = this.nextIdStr();
      const now = new Date();
      const history: any[] = [];
      if (data.history?.create) {
        history.push({
          id: this.nextIdStr(),
          actorId: data.history.create.actorId,
          transition: data.history.create.transition,
          reason: data.history.create.reason,
          createdAt: now,
        });
      }
      const newReq: StubAccessRequest = {
        id,
        requesterId: data.requesterId,
        reviewerId: data.reviewerId ?? null,
        resourceType: data.resourceType,
        resourceId: data.resourceId ?? null,
        permissionKey: data.permissionKey,
        type: data.type,
        status: data.status ?? AccessRequestStatus.PENDING,
        justification: data.justification,
        adminJustification: data.adminJustification ?? null,
        startsAt: data.startsAt ?? null,
        expiresAt: data.expiresAt ?? null,
        reviewedAt: null,
        createdAt: now,
        updatedAt: now,
        history,
      };
      this.accessRequests.push(newReq);
      return { ...newReq };
    },
    update: async (q: any) => {
      const id = q?.where?.id;
      const idx = this.accessRequests.findIndex((r) => r.id === id);
      if (idx === -1) throw new Error("access request not found");
      const data = q?.data ?? {};
      // Don't spread `history` (a nested create) into the record directly.
      const { history: _historyUpdate, ...plainData } = data;
      const existing = this.accessRequests[idx];
      const updated: StubAccessRequest = { ...existing, ...plainData };
      if (data.history?.create) {
        updated.history = [
          ...(existing.history ?? []),
          {
            id: this.nextIdStr(),
            actorId: data.history.create.actorId,
            transition: data.history.create.transition,
            reason: data.history.create.reason,
            createdAt: new Date(),
          },
        ];
      }
      this.accessRequests[idx] = updated;
      return { ...updated };
    },
  };

  userResourceAccess = {
    findFirst: async (q: any) => {
      const w = q?.where ?? {};
      const rows = this.resourceAccess.filter((g) => {
        if (w.userId && g.userId !== w.userId) return false;
        if (w.resourceType && g.resourceType !== w.resourceType) return false;
        if (w.resourceId && g.resourceId !== w.resourceId) return false;
        if (w.permissionKey && g.permissionKey !== w.permissionKey) return false;
        if (w.isActive !== undefined && g.isActive !== w.isActive) return false;
        return true;
      });
      // Honour OR clauses on expiresAt
      const or = w.OR;
      if (Array.isArray(or)) {
        const filtered = rows.filter((g) => {
          if (g.expiresAt === null) {
            return or.some((o: any) => o.expiresAt === null);
          }
          return or.some((o: any) => o.expiresAt?.gt && g.expiresAt! > o.expiresAt.gt);
        });
        return filtered[0] ?? null;
      }
      return rows[0] ?? null;
    },
    findMany: async (q: any) => {
      const single = await this.userResourceAccess.findFirst(q);
      return single ? [single] : [];
    },
    create: async (q: any) => {
      const data = q?.data ?? {};
      const newGrant: StubResourceAccess = {
        id: this.nextIdStr(),
        userId: data.userId,
        resourceType: data.resourceType,
        resourceId: data.resourceId ?? null,
        permissionKey: data.permissionKey,
        grantedAt: data.grantedAt ?? new Date(),
        grantedBy: data.grantedBy ?? null,
        expiresAt: data.expiresAt ?? null,
        isActive: data.isActive ?? true,
      };
      this.resourceAccess.push(newGrant);
      return { ...newGrant };
    },
    update: async (q: any) => {
      const id = q?.where?.id;
      const idx = this.resourceAccess.findIndex((g) => g.id === id);
      if (idx === -1) throw new Error("grant not found");
      const data = q?.data ?? {};
      this.resourceAccess[idx] = { ...this.resourceAccess[idx], ...data };
      return { ...this.resourceAccess[idx] };
    },
  };

  supportAgent = {
    findUnique: async (q: any) => {
      const w = q?.where ?? {};
      const a = this.agents.find((x) => x.userId === w.userId && !x.deletedAt);
      return a ? { ...a } : null;
    },
  };

  supportAgentTeamMembership = {
    findFirst: async (q: any) => {
      const w = q?.where ?? {};
      const m = this.memberships.find(
        (x) =>
          x.teamId === w.teamId &&
          x.agentId === w.agentId &&
          (w.endDate === null ? x.endDate === null : true),
      );
      return m ? { ...m } : null;
    },
    findMany: async (q: any) => {
      const w = q?.where ?? {};
      return this.memberships
        .filter(
          (x) =>
            x.agentId === w.agentId &&
            (w.endDate === null ? x.endDate === null : true),
        )
        .map((m) => ({ ...m }));
    },
  };

  auditLog = {
    create: async (q: any) => {
      this.auditLogs.push(q?.data ?? {});
      return q?.data ?? {};
    },
  };

  $transaction = async (fn: any) => fn(this);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const day = (d: number) => new Date(`2025-08-${String(d).padStart(2, "0")}T10:00:00.000Z`);

function makeTicket(id: string, patch: Partial<StubTicket> = {}): StubTicket {
  return {
    id,
    ticketNumber: `TKT-${id}`,
    subject: `Subject ${id}`,
    message: `Message body ${id}`,
    description: null,
    status: "NEW",
    priority: "MEDIUM",
    type: "CUSTOMER",
    userId: "u-alice",
    assigneeId: null,
    teamId: null,
    departmentId: null,
    categoryId: null,
    deletedAt: null,
    createdAt: day(1),
    updatedAt: day(1),
    resolvedAt: null,
    closedAt: null,
    reopenedAt: null,
    firstResponseAt: null,
    ...patch,
  };
}

// ─── Test suite ─────────────────────────────────────────────────────────────

describe("SupportService — ticket access control", () => {
  let service: SupportService;
  let prisma: MockPrisma;

  beforeEach(async () => {
    prisma = new MockPrisma();
    prisma.tickets = [
      makeTicket("t1", { userId: "u-alice", assigneeId: null, teamId: null }),
      makeTicket("t2", { userId: "u-bob", assigneeId: "u-carol", teamId: null }),
      makeTicket("t3", { userId: "u-dave", assigneeId: null, teamId: "team-1" }),
      makeTicket("t4", { userId: "u-eve", assigneeId: null, teamId: null }),
    ];

    const module = await Test.createTestingModule({
      providers: [
        SupportService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(SupportService);
  });

  // ─── §1 listTickets role-based visibility ────────────────────────────────

  describe("listTickets — role-based visibility", () => {
    it("admin sees all tickets", async () => {
      const res = await service.listTickets({
        actor: { id: "u-admin", role: Role.ADMIN },
      } as any);
      expect(res.data.length).toBe(4);
    });

    it("support_admin sees all tickets", async () => {
      const res = await service.listTickets({
        actor: { id: "u-sa", role: Role.SUPPORT_ADMIN },
      } as any);
      expect(res.data.length).toBe(4);
    });

    it("regular user sees only their own tickets", async () => {
      const res = await service.listTickets({
        actor: { id: "u-alice", role: Role.USER },
      } as any);
      expect(res.data.length).toBe(1);
      expect((res.data[0] as any).id).toBe("t1");
    });

    it("regular user with no tickets sees empty list", async () => {
      const res = await service.listTickets({
        actor: { id: "u-unknown", role: Role.USER },
      } as any);
      expect(res.data.length).toBe(0);
    });

    it("support agent sees assigned + owned tickets", async () => {
      const res = await service.listTickets({
        actor: { id: "u-carol", role: Role.USER },
      } as any);
      // carol is assignee on t2, owns nothing
      expect(res.data.length).toBe(1);
      expect((res.data[0] as any).id).toBe("t2");
    });

    it("team member sees tickets for their team", async () => {
      // Set up: dave is the agent for team-1 (which owns t3)
      prisma.agents.push({
        id: "agent-dave",
        userId: "u-dave",
        status: "ACTIVE",
        isActive: true,
        deletedAt: null,
      });
      prisma.memberships.push({
        id: "mem-1",
        agentId: "agent-dave",
        teamId: "team-1",
        endDate: null,
      });

      const res = await service.listTickets({
        actor: { id: "u-dave", role: Role.USER },
      } as any);
      // dave owns t3 (userId=u-dave) AND is on team-1 (t3)
      expect(res.data.length).toBe(1);
      expect((res.data[0] as any).id).toBe("t3");
    });

    it("user with explicit grant sees granted ticket", async () => {
      // alice already owns t1; grant her view access to t4 (owned by eve)
      prisma.resourceAccess.push({
        id: "grant-1",
        userId: "u-alice",
        resourceType: "tickets",
        resourceId: "t4",
        permissionKey: "tickets:view",
        grantedAt: new Date(),
        grantedBy: "u-admin",
        expiresAt: null,
        isActive: true,
      });

      const res = await service.listTickets({
        actor: { id: "u-alice", role: Role.USER },
      } as any);
      const ids = res.data.map((t: any) => t.id).sort();
      expect(ids).toEqual(["t1", "t4"]);
    });

    it("expired grant does NOT grant visibility", async () => {
      prisma.resourceAccess.push({
        id: "grant-2",
        userId: "u-alice",
        resourceType: "tickets",
        resourceId: "t4",
        permissionKey: "tickets:view",
        grantedAt: new Date("2024-01-01"),
        grantedBy: "u-admin",
        expiresAt: new Date("2024-12-31"), // expired
        isActive: true,
      });

      const res = await service.listTickets({
        actor: { id: "u-alice", role: Role.USER },
      } as any);
      // alice should only see t1 (her own); the expired grant on t4 is ignored
      expect(res.data.length).toBe(1);
      expect((res.data[0] as any).id).toBe("t1");
    });

    it("no actor parameter — backward-compatible (returns all)", async () => {
      // When `actor` is not supplied (e.g. internal calls), no filter is applied.
      const res = await service.listTickets({} as any);
      expect(res.data.length).toBe(4);
    });
  });

  // ─── §2 getTicket — role-based access ────────────────────────────────────

  describe("getTicket — role-based access", () => {
    it("admin can fetch any ticket", async () => {
      const ticket = await service.getTicket("t2", {
        id: "u-admin",
        role: Role.ADMIN,
      });
      expect(ticket.id).toBe("t2");
    });

    it("support_admin can fetch any ticket", async () => {
      const ticket = await service.getTicket("t3", {
        id: "u-sa",
        role: Role.SUPPORT_ADMIN,
      });
      expect(ticket.id).toBe("t3");
    });

    it("owner can fetch their own ticket", async () => {
      const ticket = await service.getTicket("t1", {
        id: "u-alice",
        role: Role.USER,
      });
      expect(ticket.id).toBe("t1");
    });

    it("assignee can fetch their assigned ticket", async () => {
      const ticket = await service.getTicket("t2", {
        id: "u-carol",
        role: Role.USER,
      });
      expect(ticket.id).toBe("t2");
    });

    it("team member can fetch a ticket in their team", async () => {
      prisma.agents.push({
        id: "agent-frank",
        userId: "u-frank",
        status: "ACTIVE",
        isActive: true,
        deletedAt: null,
      });
      prisma.memberships.push({
        id: "mem-frank",
        agentId: "agent-frank",
        teamId: "team-1",
        endDate: null,
      });

      const ticket = await service.getTicket("t3", {
        id: "u-frank",
        role: Role.USER,
      });
      expect(ticket.id).toBe("t3");
    });

    it("non-admin without access → ForbiddenException", async () => {
      await expect(
        service.getTicket("t4", { id: "u-alice", role: Role.USER }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("user with explicit grant can fetch the granted ticket", async () => {
      prisma.resourceAccess.push({
        id: "grant-3",
        userId: "u-alice",
        resourceType: "tickets",
        resourceId: "t4",
        permissionKey: "tickets:view",
        grantedAt: new Date(),
        grantedBy: "u-admin",
        expiresAt: null,
        isActive: true,
      });

      const ticket = await service.getTicket("t4", {
        id: "u-alice",
        role: Role.USER,
      });
      expect(ticket.id).toBe("t4");
    });

    it("non-existent ticket → NotFoundException", async () => {
      await expect(
        service.getTicket("nonexistent", { id: "u-admin", role: Role.ADMIN }),
      ).rejects.toThrow(NotFoundException);
    });

    it("no actor parameter — backward-compatible (no access check)", async () => {
      const ticket = await service.getTicket("t4");
      expect(ticket.id).toBe("t4");
    });
  });

  // ─── §3 canAccessTicket ─────────────────────────────────────────────────

  describe("canAccessTicket", () => {
    it("returns reason=admin for admin role", async () => {
      const r = await service.canAccessTicket("t1", {
        id: "u-admin",
        role: Role.ADMIN,
      });
      expect(r).toEqual({ hasAccess: true, reason: "admin" });
    });

    it("returns reason=owner for ticket creator", async () => {
      const r = await service.canAccessTicket("t1", {
        id: "u-alice",
        role: Role.USER,
      });
      expect(r).toEqual({ hasAccess: true, reason: "owner" });
    });

    it("returns reason=assignee for ticket assignee", async () => {
      const r = await service.canAccessTicket("t2", {
        id: "u-carol",
        role: Role.USER,
      });
      expect(r).toEqual({ hasAccess: true, reason: "assignee" });
    });

    it("returns reason=team for team members", async () => {
      prisma.agents.push({
        id: "agent-x",
        userId: "u-x",
        status: "ACTIVE",
        isActive: true,
        deletedAt: null,
      });
      prisma.memberships.push({
        id: "mem-x",
        agentId: "agent-x",
        teamId: "team-1",
        endDate: null,
      });

      const r = await service.canAccessTicket("t3", {
        id: "u-x",
        role: Role.USER,
      });
      expect(r).toEqual({ hasAccess: true, reason: "team" });
    });

    it("returns reason=grant for users with an explicit grant", async () => {
      prisma.resourceAccess.push({
        id: "grant-4",
        userId: "u-alice",
        resourceType: "tickets",
        resourceId: "t4",
        permissionKey: "tickets:view",
        grantedAt: new Date(),
        grantedBy: "u-admin",
        expiresAt: null,
        isActive: true,
      });

      const r = await service.canAccessTicket("t4", {
        id: "u-alice",
        role: Role.USER,
      });
      expect(r).toEqual({ hasAccess: true, reason: "grant" });
    });

    it("returns reason=none when no access path matches", async () => {
      const r = await service.canAccessTicket("t4", {
        id: "u-alice",
        role: Role.USER,
      });
      expect(r).toEqual({ hasAccess: false, reason: "none" });
    });

    it("returns reason=none for a deleted ticket (non-admin)", async () => {
      prisma.tickets[3].deletedAt = new Date();
      const r = await service.canAccessTicket("t4", {
        id: "u-alice",
        role: Role.USER,
      });
      // Non-admins see reason=none for a deleted ticket
      expect(r).toEqual({ hasAccess: false, reason: "none" });
    });

    it("admin still gets reason=admin for a deleted ticket", async () => {
      // canAccessTicket checks admin role before ticket existence — admins
      // always pass the access check; the deleted/not-found filtering is
      // a separate concern handled by getTicket (which returns 404).
      prisma.tickets[3].deletedAt = new Date();
      const r = await service.canAccessTicket("t4", {
        id: "u-admin",
        role: Role.ADMIN,
      });
      expect(r).toEqual({ hasAccess: true, reason: "admin" });
    });
  });

  // ─── §4 requestTicketAccess ─────────────────────────────────────────────

  describe("requestTicketAccess", () => {
    it("creates a PENDING access request", async () => {
      const req = await service.requestTicketAccess({
        ticketId: "t4",
        requesterId: "u-alice",
        requesterRole: Role.USER,
        justification: "I need to follow up on this customer escalation.",
      });

      expect(req.status).toBe(AccessRequestStatus.PENDING);
      expect(req.resourceType).toBe("tickets");
      expect(req.permissionKey).toBe("tickets:view");
      expect(req.resourceId).toBe("t4");
      expect(req.requesterId).toBe("u-alice");
      expect(prisma.accessRequests.length).toBe(1);
    });

    it("rejects justification shorter than 5 chars", async () => {
      await expect(
        service.requestTicketAccess({
          ticketId: "t4",
          requesterId: "u-alice",
          requesterRole: Role.USER,
          justification: "hi",
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects request for a non-existent ticket", async () => {
      await expect(
        service.requestTicketAccess({
          ticketId: "nope",
          requesterId: "u-alice",
          requesterRole: Role.USER,
          justification: "I need to view this ticket please.",
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("rejects request when admin already has access", async () => {
      await expect(
        service.requestTicketAccess({
          ticketId: "t4",
          requesterId: "u-admin",
          requesterRole: Role.ADMIN,
          justification: "I need to view this ticket please.",
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects request when user already has access (owner)", async () => {
      await expect(
        service.requestTicketAccess({
          ticketId: "t1",
          requesterId: "u-alice",
          requesterRole: Role.USER,
          justification: "I need to view this ticket please.",
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects duplicate PENDING request for the same ticket/user", async () => {
      await service.requestTicketAccess({
        ticketId: "t4",
        requesterId: "u-alice",
        requesterRole: Role.USER,
        justification: "First request — please grant access.",
      });

      await expect(
        service.requestTicketAccess({
          ticketId: "t4",
          requesterId: "u-alice",
          requesterRole: Role.USER,
          justification: "Second request — please grant access.",
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects TEMPORARY request without start/end dates", async () => {
      await expect(
        service.requestTicketAccess({
          ticketId: "t4",
          requesterId: "u-alice",
          requesterRole: Role.USER,
          justification: "Need temporary access to this ticket please.",
          type: AccessRequestType.TEMPORARY,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects PERMANENT request that includes dates", async () => {
      await expect(
        service.requestTicketAccess({
          ticketId: "t4",
          requesterId: "u-alice",
          requesterRole: Role.USER,
          justification: "Need permanent access to this ticket please.",
          type: AccessRequestType.PERMANENT,
          startsAt: new Date("2025-09-01"),
          expiresAt: new Date("2025-12-31"),
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── §5 approveTicketAccessRequest ──────────────────────────────────────

  describe("approveTicketAccessRequest", () => {
    beforeEach(async () => {
      // Seed a pending request from alice for ticket t4
      await service.requestTicketAccess({
        ticketId: "t4",
        requesterId: "u-alice",
        requesterRole: Role.USER,
        justification: "I need to view this ticket for follow-up.",
      });
    });

    it("non-admin cannot approve", async () => {
      const reqId = prisma.accessRequests[0].id;
      await expect(
        service.approveTicketAccessRequest({
          requestId: reqId,
          reviewerId: "u-carol",
          reviewerRole: Role.USER,
          adminJustification: "Approved for follow-up.",
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("admin can approve and grant is created", async () => {
      const reqId = prisma.accessRequests[0].id;
      const updated = await service.approveTicketAccessRequest({
        requestId: reqId,
        reviewerId: "u-admin",
        reviewerRole: Role.ADMIN,
        adminJustification: "Approved for follow-up.",
      });

      expect(updated.status).toBe(AccessRequestStatus.APPROVED);
      expect(prisma.resourceAccess.length).toBe(1);
      const grant = prisma.resourceAccess[0];
      expect(grant.userId).toBe("u-alice");
      expect(grant.resourceId).toBe("t4");
      expect(grant.permissionKey).toBe("tickets:view");
      expect(grant.isActive).toBe(true);
    });

    it("admin cannot approve their own request", async () => {
      // Make a new request from admin himself
      const ownReq = await service.requestTicketAccess({
        ticketId: "t3",
        requesterId: "u-bob",
        requesterRole: Role.USER,
        justification: "Need to view this ticket for follow-up please.",
      });

      await expect(
        service.approveTicketAccessRequest({
          requestId: ownReq.id,
          reviewerId: "u-bob", // same as requester
          reviewerRole: Role.ADMIN, // bumped to admin for the approve call
          adminJustification: "Self approve.",
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("cannot approve a non-PENDING request", async () => {
      const reqId = prisma.accessRequests[0].id;
      await service.approveTicketAccessRequest({
        requestId: reqId,
        reviewerId: "u-admin",
        reviewerRole: Role.ADMIN,
        adminJustification: "First approval.",
      });

      // Second approval attempt on the now-APPROVED request should fail
      await expect(
        service.approveTicketAccessRequest({
          requestId: reqId,
          reviewerId: "u-sa",
          reviewerRole: Role.SUPPORT_ADMIN,
          adminJustification: "Second approval attempt.",
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects adminJustification shorter than 3 chars", async () => {
      const reqId = prisma.accessRequests[0].id;
      await expect(
        service.approveTicketAccessRequest({
          requestId: reqId,
          reviewerId: "u-admin",
          reviewerRole: Role.ADMIN,
          adminJustification: "ok",
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("after approval, the requester can fetch the ticket", async () => {
      const reqId = prisma.accessRequests[0].id;
      await service.approveTicketAccessRequest({
        requestId: reqId,
        reviewerId: "u-admin",
        reviewerRole: Role.ADMIN,
        adminJustification: "Approved for follow-up.",
      });

      // Alice should now be able to fetch t4 (which she doesn't own)
      const ticket = await service.getTicket("t4", {
        id: "u-alice",
        role: Role.USER,
      });
      expect(ticket.id).toBe("t4");
    });
  });

  // ─── §6 rejectTicketAccessRequest ───────────────────────────────────────

  describe("rejectTicketAccessRequest", () => {
    beforeEach(async () => {
      await service.requestTicketAccess({
        ticketId: "t4",
        requesterId: "u-alice",
        requesterRole: Role.USER,
        justification: "I need to view this ticket for follow-up.",
      });
    });

    it("non-admin cannot reject", async () => {
      const reqId = prisma.accessRequests[0].id;
      await expect(
        service.rejectTicketAccessRequest({
          requestId: reqId,
          reviewerId: "u-carol",
          reviewerRole: Role.USER,
          adminJustification: "Not allowed.",
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("admin can reject and no grant is created", async () => {
      const reqId = prisma.accessRequests[0].id;
      const updated = await service.rejectTicketAccessRequest({
        requestId: reqId,
        reviewerId: "u-admin",
        reviewerRole: Role.ADMIN,
        adminJustification: "Ticket contains confidential info.",
      });

      expect(updated.status).toBe(AccessRequestStatus.REJECTED);
      expect(prisma.resourceAccess.length).toBe(0);
    });

    it("rejected request does NOT grant access to the ticket", async () => {
      const reqId = prisma.accessRequests[0].id;
      await service.rejectTicketAccessRequest({
        requestId: reqId,
        reviewerId: "u-admin",
        reviewerRole: Role.ADMIN,
        adminJustification: "Ticket contains confidential info.",
      });

      await expect(
        service.getTicket("t4", { id: "u-alice", role: Role.USER }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── §7 cancelTicketAccessRequest ───────────────────────────────────────

  describe("cancelTicketAccessRequest", () => {
    beforeEach(async () => {
      await service.requestTicketAccess({
        ticketId: "t4",
        requesterId: "u-alice",
        requesterRole: Role.USER,
        justification: "I need to view this ticket for follow-up.",
      });
    });

    it("requester can cancel their own pending request", async () => {
      const reqId = prisma.accessRequests[0].id;
      const updated = await service.cancelTicketAccessRequest({
        requestId: reqId,
        actorId: "u-alice",
      });
      expect(updated.status).toBe(AccessRequestStatus.CANCELLED);
    });

    it("non-requester cannot cancel", async () => {
      const reqId = prisma.accessRequests[0].id;
      await expect(
        service.cancelTicketAccessRequest({
          requestId: reqId,
          actorId: "u-carol",
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("cannot cancel a non-PENDING request", async () => {
      const reqId = prisma.accessRequests[0].id;
      // Approve first
      await service.approveTicketAccessRequest({
        requestId: reqId,
        reviewerId: "u-admin",
        reviewerRole: Role.ADMIN,
        adminJustification: "Approved before cancel attempt.",
      });

      // Now cancel should fail
      await expect(
        service.cancelTicketAccessRequest({
          requestId: reqId,
          actorId: "u-alice",
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── §8 listTicketAccessRequests ────────────────────────────────────────

  describe("listTicketAccessRequests", () => {
    beforeEach(async () => {
      // alice creates two requests
      await service.requestTicketAccess({
        ticketId: "t4",
        requesterId: "u-alice",
        requesterRole: Role.USER,
        justification: "First ticket access request please.",
      });
      await service.requestTicketAccess({
        ticketId: "t3",
        requesterId: "u-alice",
        requesterRole: Role.USER,
        justification: "Second ticket access request please.",
      });
    });

    it("non-admin sees only their own requests", async () => {
      const res = await service.listTicketAccessRequests({
        actorId: "u-alice",
        actorRole: Role.USER,
      });
      expect(res.data.length).toBe(2);
      expect(res.data.every((r: any) => r.requesterId === "u-alice")).toBe(true);
    });

    it("admin sees all requests", async () => {
      // Add a request from a different user
      await service.requestTicketAccess({
        ticketId: "t2",
        requesterId: "u-dave",
        requesterRole: Role.USER,
        justification: "Another user needs access please.",
      });

      const res = await service.listTicketAccessRequests({
        actorId: "u-admin",
        actorRole: Role.ADMIN,
      });
      expect(res.data.length).toBe(3);
    });

    it("filter by ticketId", async () => {
      const res = await service.listTicketAccessRequests({
        actorId: "u-alice",
        actorRole: Role.USER,
        ticketId: "t4",
      });
      expect(res.data.length).toBe(1);
      expect((res.data[0] as any).resourceId).toBe("t4");
    });

    it("filter by status=PENDING", async () => {
      // Approve one of alice's requests
      const first = prisma.accessRequests[0];
      await service.approveTicketAccessRequest({
        requestId: first.id,
        reviewerId: "u-admin",
        reviewerRole: Role.ADMIN,
        adminJustification: "Approved one of them.",
      });

      const res = await service.listTicketAccessRequests({
        actorId: "u-alice",
        actorRole: Role.USER,
        status: AccessRequestStatus.PENDING,
      });
      expect(res.data.length).toBe(1);
    });
  });
});
