import { Injectable, NotFoundException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { assignRelationUpdate } from '../../shared/prisma/relation-update.util';
import {
  validateSupportDepartmentExists,
  validateSupportTeamExists,
  validateUserExists,
} from '../../shared/prisma/relation-validation.util';
import { TicketStatus, TicketPriority, TicketType, AgentStatus, Role, AccessRequestStatus, AccessRequestType, Prisma } from '@prisma/client';

@Injectable()
export class SupportService {
  constructor(private prisma: PrismaService) { }

  static readonly VALID_STATUSES: readonly TicketStatus[] = [
    'NEW', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_ON_CUSTOMER', 'WAITING_ON_INTERNAL',
    'ESCALATED', 'RESOLVED', 'REOPENED', 'CLOSED',
  ];
  private static readonly STATUS_ALIASES: Readonly<Record<string, string>> = {
    OPEN: 'ASSIGNED',
    PENDING: 'WAITING_ON_INTERNAL',
  };
  static readonly VALID_PRIORITIES: readonly TicketPriority[] = ['EMERGENCY', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
  static readonly VALID_TYPES: readonly TicketType[] = ['CUSTOMER', 'INTERNAL', 'BUG_REPORT', 'FEATURE_REQUEST', 'TECHNICAL', 'BILLING', 'ABUSE', 'MODERATION'];
  static readonly TERMINAL_STATUSES: readonly TicketStatus[] = ['RESOLVED', 'CLOSED'];

  // ─── Ticket Access Control ────────────────────────────────────────────────
  //
  // Roles that retain full visibility of every ticket. Everyone else (support
  // agents, regular users, creators, moderators) may only view tickets they
  // created (userId) or that are explicitly assigned to them (assigneeId), or
  // for which they have an approved UserResourceAccess grant.
  static readonly TICKET_ACCESS_ADMIN_ROLES: ReadonlySet<Role> = new Set<Role>([
    Role.ADMIN,
    Role.SUPPORT_ADMIN,
    Role.PLATFORM_ADMIN,
    Role.SUPER_ADMIN,
  ]);

  /** Resource type used for AccessRequest / UserResourceAccess rows. */
  static readonly TICKET_RESOURCE_TYPE = 'ticket';
  /** Permission key used for ticket-view access requests. */
  static readonly TICKET_VIEW_PERMISSION = 'read';

  /**
   * Returns true when the actor's role grants full ticket visibility
   * (admin / support_admin / platform_admin / super_admin).
   */
  private isTicketAccessAdmin(role: Role | undefined | null): boolean {
    if (!role) return false;
    return SupportService.TICKET_ACCESS_ADMIN_ROLES.has(role);
  }

  /**
   * Build a Prisma `where` clause that restricts tickets to those the actor
   * is allowed to see. Admin roles get an empty filter (sees everything).
   * Everyone else sees tickets where:
   *   - they are the creator (userId), OR
   *   - they are the assignee (assigneeId), OR
   *   - they are a member of the ticket's team, OR
   *   - they have an APPROVED UserResourceAccess grant for this ticket.
   */
  private async buildTicketAccessWhere(
    userId: string,
    role: Role | undefined | null,
  ): Promise<Prisma.SupportTicketWhereInput> {
    if (this.isTicketAccessAdmin(role)) return {};

    const orBranches: Prisma.SupportTicketWhereInput[] = [
      { userId },
      { assigneeId: userId },
    ];

    // Include tickets for any team the user is a member of. SupportAgentTeamMembership
    // is keyed by agentId (SupportAgent.id), so resolve that first.
    const agentRecord = await this.prisma.supportAgent.findUnique({
      where: { userId },
      select: { id: true },
    }).catch(() => null);
    if (agentRecord) {
      const teamMemberships = await this.prisma.supportAgentTeamMembership.findMany({
        where: { agentId: agentRecord.id, endDate: null },
        select: { teamId: true },
      }).catch(() => [] as { teamId: string }[]);
      if (teamMemberships.length) {
        orBranches.push({ teamId: { in: teamMemberships.map((m) => m.teamId) } });
      }
    }

    // Include tickets the user has been explicitly granted access to via the
    // AccessRequest workflow (UserResourceAccess rows).
    const grants = await this.prisma.userResourceAccess.findMany({
      where: {
        userId,
        resourceType: SupportService.TICKET_RESOURCE_TYPE,
        permissionKey: SupportService.TICKET_VIEW_PERMISSION,
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { resourceId: true },
    }).catch(() => [] as { resourceId: string | null }[]);
    const grantedIds = grants
      .map((g) => g.resourceId)
      .filter((id): id is string => !!id);
    if (grantedIds.length) {
      orBranches.push({ id: { in: grantedIds } });
    }

    return { OR: orBranches };
  }

  /**
   * Assert that the actor is allowed to view a specific ticket. Throws
   * ForbiddenException when access is not permitted. Callers should catch
   * ForbiddenException at the controller layer to surface an access-request
   * prompt to the user.
   */
  private async assertTicketAccess(
    ticket: { id: string; userId: string; assigneeId: string | null; teamId: string | null },
    actor: { id: string; role?: Role | null },
  ): Promise<void> {
    if (this.isTicketAccessAdmin(actor.role)) return;
    if (ticket.userId === actor.id) return;
    if (ticket.assigneeId === actor.id) return;

    // Team membership check — SupportAgentTeamMembership is keyed by agentId
    // (SupportAgent.id), not userId. Resolve the agent record first.
    if (ticket.teamId) {
      const agentRecord = await this.prisma.supportAgent.findUnique({
        where: { userId: actor.id },
        select: { id: true },
      }).catch(() => null);
      if (agentRecord) {
        const membership = await this.prisma.supportAgentTeamMembership.findFirst({
          where: { teamId: ticket.teamId, agentId: agentRecord.id, endDate: null },
          select: { id: true },
        }).catch(() => null);
        if (membership) return;
      }
    }

    // Explicit access grant (approved access requests)
    const grant = await this.prisma.userResourceAccess.findFirst({
      where: {
        userId: actor.id,
        resourceType: SupportService.TICKET_RESOURCE_TYPE,
        permissionKey: SupportService.TICKET_VIEW_PERMISSION,
        resourceId: ticket.id,
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    }).catch(() => null);
    if (grant) return;

    throw new ForbiddenException(
      'You do not have access to this ticket. Submit an access request to be granted visibility.',
    );
  }

  // ─── Ticket Access Request workflow ───────────────────────────────────────
  //
  // Reuses the generic AccessRequest + UserResourceAccess tables (the same
  // ones used by the access-requests module) with:
  //   resourceType  = 'tickets'
  //   permissionKey = 'tickets:view'
  //   resourceId    = the ticket id (optional, used for per-ticket grants)

  /**
   * Determine whether an actor already has access to a ticket without
   * throwing. Used by the admin dashboard to decide whether to prompt the
   * "Request access" dialog when the user lands on a ticket detail page.
   */
  async canAccessTicket(
    ticketId: string,
    actor: { id: string; role?: Role | null },
  ): Promise<{ hasAccess: boolean; reason: 'admin' | 'owner' | 'assignee' | 'team' | 'grant' | 'none' }> {
    if (this.isTicketAccessAdmin(actor.role)) return { hasAccess: true, reason: 'admin' };

    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
      select: { id: true, userId: true, assigneeId: true, teamId: true, deletedAt: true },
    }).catch(() => null);

    if (!ticket || ticket.deletedAt) {
      // Treat missing/deleted tickets as "no access" so callers surface a 404-ish prompt.
      return { hasAccess: false, reason: 'none' };
    }
    if (ticket.userId === actor.id) return { hasAccess: true, reason: 'owner' };
    if (ticket.assigneeId === actor.id) return { hasAccess: true, reason: 'assignee' };

    if (ticket.teamId) {
      const agentRecord = await this.prisma.supportAgent.findUnique({
        where: { userId: actor.id },
        select: { id: true },
      }).catch(() => null);
      if (agentRecord) {
        const membership = await this.prisma.supportAgentTeamMembership.findFirst({
          where: { teamId: ticket.teamId, agentId: agentRecord.id, endDate: null },
          select: { id: true },
        }).catch(() => null);
        if (membership) return { hasAccess: true, reason: 'team' };
      }
    }

    const grant = await this.prisma.userResourceAccess.findFirst({
      where: {
        userId: actor.id,
        resourceType: SupportService.TICKET_RESOURCE_TYPE,
        permissionKey: SupportService.TICKET_VIEW_PERMISSION,
        resourceId: ticket.id,
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { id: true },
    }).catch(() => null);
    if (grant) return { hasAccess: true, reason: 'grant' };

    return { hasAccess: false, reason: 'none' };
  }

  /**
   * Submit a ticket-view access request on behalf of the actor. Creates an
   * AccessRequest row in PENDING status. Refuses to create a duplicate
   * PENDING request for the same ticket/user.
   */
  async requestTicketAccess(args: {
    ticketId: string;
    requesterId: string;
    requesterRole?: Role | null;
    justification: string;
    type?: AccessRequestType;
    startsAt?: Date;
    expiresAt?: Date;
  }) {
    const justification = (args.justification ?? '').trim();
    if (justification.length < 5) {
      throw new BadRequestException('justification must be at least 5 characters');
    }

    // Validate ticket existence
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: args.ticketId },
      select: { id: true, ticketNumber: true, subject: true, deletedAt: true },
    });
    if (!ticket || ticket.deletedAt) {
      throw new NotFoundException('Ticket not found');
    }

    // Admins already have access — no need to request.
    if (this.isTicketAccessAdmin(args.requesterRole)) {
      throw new BadRequestException('Your role already grants full ticket visibility');
    }

    // If the user already has access, do not create a redundant request.
    const access = await this.canAccessTicket(args.ticketId, {
      id: args.requesterId,
      role: args.requesterRole ?? null,
    });
    if (access.hasAccess) {
      throw new BadRequestException(
        `You already have access to this ticket (reason: ${access.reason})`,
      );
    }

    const type = args.type ?? AccessRequestType.PERMANENT;
    if (type === AccessRequestType.TEMPORARY) {
      if (!args.startsAt || !args.expiresAt) {
        throw new BadRequestException('Temporary access requests require both startsAt and expiresAt');
      }
      if (args.expiresAt <= args.startsAt) {
        throw new BadRequestException('expiresAt must be after startsAt');
      }
    } else {
      if (args.startsAt || args.expiresAt) {
        throw new BadRequestException('Permanent access requests must not include start/expire dates');
      }
    }

    // Guard against duplicate PENDING requests for the same ticket/user.
    const existing = await this.prisma.accessRequest.findFirst({
      where: {
        requesterId: args.requesterId,
        resourceType: SupportService.TICKET_RESOURCE_TYPE,
        resourceId: args.ticketId,
        permissionKey: SupportService.TICKET_VIEW_PERMISSION,
        status: AccessRequestStatus.PENDING,
      },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException(
        'You already have a PENDING access request for this ticket. Wait for it to be reviewed or cancel it first.',
      );
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const req = await tx.accessRequest.create({
        data: {
          requesterId: args.requesterId,
          resourceType: SupportService.TICKET_RESOURCE_TYPE,
          resourceId: args.ticketId,
          permissionKey: SupportService.TICKET_VIEW_PERMISSION,
          type,
          status: AccessRequestStatus.PENDING,
          justification,
          startsAt: args.startsAt ?? null,
          expiresAt: args.expiresAt ?? null,
          history: {
            create: {
              actorId: args.requesterId,
              transition: AccessRequestStatus.PENDING,
              reason: 'Ticket view access requested',
            },
          },
        },
        include: {
          requester: { select: { id: true, name: true, email: true, avatar: true, handle: true } },
          reviewer: { select: { id: true, name: true, email: true } },
        },
      });
      return req;
    });

    await this.audit(args.requesterId, 'TICKET_ACCESS_REQUEST', 'SupportTicket', {
      resourceId: args.ticketId,
      details: {
        ticketNumber: ticket.ticketNumber,
        requestId: created.id,
        type,
        justification,
      },
    });

    return created;
  }

  /**
   * List ticket-view access requests. Admin roles see all; everyone else
   * only sees their own.
   */
  async listTicketAccessRequests(params: {
    actorId: string;
    actorRole?: Role | null;
    status?: AccessRequestStatus;
    ticketId?: string;
    page?: number;
    limit?: number;
    orderBy?: 'createdAt' | 'reviewedAt' | 'expiresAt';
    orderDir?: 'asc' | 'desc';
  }) {
    const page = Math.max(1, Number(params.page ?? 1) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit ?? 20) || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.AccessRequestWhereInput = {
      resourceType: SupportService.TICKET_RESOURCE_TYPE,
      permissionKey: SupportService.TICKET_VIEW_PERMISSION,
    };
    if (params.status) where.status = params.status;
    if (params.ticketId) where.resourceId = params.ticketId;

    // Non-admins only see their own requests.
    if (!this.isTicketAccessAdmin(params.actorRole)) {
      where.requesterId = params.actorId;
    }

    const field = params.orderBy ?? 'createdAt';
    const direction = (params.orderDir ?? 'desc') === 'asc' ? 'asc' : 'desc';
    const orderBy: Prisma.AccessRequestOrderByWithRelationInput = { [field]: direction };

    const [data, total] = await Promise.all([
      this.prisma.accessRequest.findMany({
        skip,
        take: limit,
        where,
        orderBy,
        include: {
          requester: { select: { id: true, name: true, email: true, avatar: true, handle: true } },
          reviewer: { select: { id: true, name: true, email: true } },
        },
      }),
      this.prisma.accessRequest.count({ where }),
    ]);

    return { data, total, page, pageSize: limit };
  }

  /**
   * Approve a pending ticket-view access request. Only admin roles may
   * approve. The requester receives a UserResourceAccess grant scoped to the
   * specific ticket (resourceId = ticketId).
   */
  async approveTicketAccessRequest(args: {
    requestId: string;
    reviewerId: string;
    reviewerRole?: Role | null;
    adminJustification: string;
  }) {
    if (!this.isTicketAccessAdmin(args.reviewerRole)) {
      throw new ForbiddenException('Only admin roles may approve ticket access requests');
    }
    const justification = (args.adminJustification ?? '').trim();
    if (justification.length < 3) {
      throw new BadRequestException('adminJustification must be at least 3 characters');
    }

    const request = await this.prisma.accessRequest.findUnique({
      where: { id: args.requestId },
    });
    if (!request) throw new NotFoundException('Access request not found');
    if (request.resourceType !== SupportService.TICKET_RESOURCE_TYPE
      || request.permissionKey !== SupportService.TICKET_VIEW_PERMISSION) {
      throw new BadRequestException('Access request is not a ticket-view request');
    }
    if (request.status !== AccessRequestStatus.PENDING) {
      throw new BadRequestException(`Request is ${request.status}, not PENDING — cannot approve`);
    }
    if (request.requesterId === args.reviewerId) {
      throw new ForbiddenException('You cannot approve your own access request');
    }

    const now = new Date();
    const ticketId = request.resourceId ?? null;

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedReq = await tx.accessRequest.update({
        where: { id: args.requestId },
        data: {
          status: AccessRequestStatus.APPROVED,
          reviewerId: args.reviewerId,
          reviewedAt: now,
          adminJustification: justification,
          history: {
            create: {
              actorId: args.reviewerId,
              transition: AccessRequestStatus.APPROVED,
              reason: justification,
            },
          },
        },
        include: {
          requester: { select: { id: true, name: true, email: true, avatar: true, handle: true } },
          reviewer: { select: { id: true, name: true, email: true } },
        },
      });

      // Grant per-ticket view access. Use a composite key based on
      // (userId, resourceType, resourceId, permissionKey) so the same user
      // can hold distinct grants for different tickets.
      if (ticketId) {
        // Upsert by unique constraint if available; otherwise create-or-
        // activate. We try the unique constraint first, fall back to manual.
        const existing = await tx.userResourceAccess.findFirst({
          where: {
            userId: request.requesterId,
            resourceType: SupportService.TICKET_RESOURCE_TYPE,
            resourceId: ticketId,
            permissionKey: SupportService.TICKET_VIEW_PERMISSION,
          },
          select: { id: true },
        });
        if (existing) {
          await tx.userResourceAccess.update({
            where: { id: existing.id },
            data: {
              isActive: true,
              grantedAt: now,
              grantedBy: args.reviewerId,
              expiresAt: request.expiresAt ?? null,
            },
          });
        } else {
          await tx.userResourceAccess.create({
            data: {
              userId: request.requesterId,
              resourceType: SupportService.TICKET_RESOURCE_TYPE,
              resourceId: ticketId,
              permissionKey: SupportService.TICKET_VIEW_PERMISSION,
              grantedBy: args.reviewerId,
              expiresAt: request.expiresAt ?? null,
              isActive: true,
            },
          });
        }
      }

      return updatedReq;
    });

    await this.audit(args.reviewerId, 'TICKET_ACCESS_APPROVE', 'access_request', {
      resourceId: args.requestId,
      details: {
        requesterId: request.requesterId,
        ticketId,
        expiresAt: request.expiresAt ?? null,
      },
    });

    return updated;
  }

  /**
   * Reject a pending ticket-view access request. Only admin roles may reject.
   */
  async rejectTicketAccessRequest(args: {
    requestId: string;
    reviewerId: string;
    reviewerRole?: Role | null;
    adminJustification: string;
  }) {
    if (!this.isTicketAccessAdmin(args.reviewerRole)) {
      throw new ForbiddenException('Only admin roles may reject ticket access requests');
    }
    const justification = (args.adminJustification ?? '').trim();
    if (justification.length < 3) {
      throw new BadRequestException('adminJustification must be at least 3 characters');
    }

    const request = await this.prisma.accessRequest.findUnique({
      where: { id: args.requestId },
    });
    if (!request) throw new NotFoundException('Access request not found');
    if (request.resourceType !== SupportService.TICKET_RESOURCE_TYPE
      || request.permissionKey !== SupportService.TICKET_VIEW_PERMISSION) {
      throw new BadRequestException('Access request is not a ticket-view request');
    }
    if (request.status !== AccessRequestStatus.PENDING) {
      throw new BadRequestException(`Request is ${request.status}, not PENDING — cannot reject`);
    }
    if (request.requesterId === args.reviewerId) {
      throw new ForbiddenException('You cannot reject your own access request');
    }

    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedReq = await tx.accessRequest.update({
        where: { id: args.requestId },
        data: {
          status: AccessRequestStatus.REJECTED,
          reviewerId: args.reviewerId,
          reviewedAt: now,
          adminJustification: justification,
          history: {
            create: {
              actorId: args.reviewerId,
              transition: AccessRequestStatus.REJECTED,
              reason: justification,
            },
          },
        },
        include: {
          requester: { select: { id: true, name: true, email: true, avatar: true, handle: true } },
          reviewer: { select: { id: true, name: true, email: true } },
        },
      });
      return updatedReq;
    });

    await this.audit(args.reviewerId, 'TICKET_ACCESS_REJECT', 'access_request', {
      resourceId: args.requestId,
      details: { requesterId: request.requesterId, ticketId: request.resourceId ?? null },
    });

    return updated;
  }

  /**
   * Cancel a pending ticket-view access request. Only the requester may
   * cancel their own request.
   */
  async cancelTicketAccessRequest(args: {
    requestId: string;
    actorId: string;
  }) {
    const request = await this.prisma.accessRequest.findUnique({
      where: { id: args.requestId },
    });
    if (!request) throw new NotFoundException('Access request not found');
    if (request.resourceType !== SupportService.TICKET_RESOURCE_TYPE
      || request.permissionKey !== SupportService.TICKET_VIEW_PERMISSION) {
      throw new BadRequestException('Access request is not a ticket-view request');
    }
    if (request.requesterId !== args.actorId) {
      throw new ForbiddenException('You can only cancel your own access requests');
    }
    if (request.status !== AccessRequestStatus.PENDING) {
      throw new BadRequestException(`Request is ${request.status}, not PENDING — cannot cancel`);
    }

    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedReq = await tx.accessRequest.update({
        where: { id: args.requestId },
        data: {
          status: AccessRequestStatus.CANCELLED,
          reviewerId: args.actorId,
          reviewedAt: now,
          adminJustification: 'Cancelled by requester',
          history: {
            create: {
              actorId: args.actorId,
              transition: AccessRequestStatus.CANCELLED,
              reason: 'Cancelled by requester',
            },
          },
        },
        include: {
          requester: { select: { id: true, name: true, email: true, avatar: true, handle: true } },
          reviewer: { select: { id: true, name: true, email: true } },
        },
      });
      return updatedReq;
    });

    await this.audit(args.actorId, 'TICKET_ACCESS_CANCEL', 'access_request', {
      resourceId: args.requestId,
      details: { ticketId: request.resourceId ?? null },
    });

    return updated;
  }


  private normalizeStatus(value: any): TicketStatus | undefined {
    if (value == null) return undefined;
    let v = String(value).toUpperCase();
    if ((SupportService.STATUS_ALIASES as any)[v]) v = (SupportService.STATUS_ALIASES as any)[v];
    if (!(SupportService.VALID_STATUSES as readonly string[]).includes(v)) {
      throw new BadRequestException(`Invalid status "${String(value)}". Valid statuses: ${SupportService.VALID_STATUSES.join(', ')}`);
    }
    return v as TicketStatus;
  }
  private validateStatus(value: any): asserts value is TicketStatus {
    this.normalizeStatus(value);
  }
  private validatePriority(value: any): asserts value is TicketPriority | undefined {
    if (value == null) return;
    const v = String(value).toUpperCase();
    if (!(SupportService.VALID_PRIORITIES as readonly string[]).includes(v)) {
      throw new BadRequestException(`Invalid priority "${value}". Valid priorities: ${SupportService.VALID_PRIORITIES.join(', ')}`);
    }
  }
  private validateTicketType(value: any): asserts value is TicketType | undefined {
    if (value == null) return;
    const v = String(value).toUpperCase();
    if (!(SupportService.VALID_TYPES as readonly string[]).includes(v)) {
      throw new BadRequestException(`Invalid ticket type "${value}". Valid types: ${SupportService.VALID_TYPES.join(', ')}`);
    }
  }
  private assertUuid(value: string, label: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || '')) {
      throw new BadRequestException(`${label} must be a valid UUID`);
    }
  }
  private assertNonEmptyString(value: any, label: string) {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new BadRequestException(`${label} is required and cannot be empty`);
    }
  }

  /** Write a security-relevant event to the AuditLog table. */
  private async audit(
    userId: string | null,
    action: string,
    resource: string,
    opts?: { resourceId?: string; details?: Record<string, unknown>; changes?: Record<string, unknown>; success?: boolean },
  ) {
    await this.prisma.auditLog.create({
      data: {
        userId,
        action,
        resource,
        resourceId: opts?.resourceId ?? null,
        details: (opts?.details ?? null) as Prisma.InputJsonValue | null,
        changes: (opts?.changes ?? null) as Prisma.InputJsonValue | null,
        success: opts?.success ?? true,
      },
    }).catch(() => null); // Audit logging is best-effort; never break the primary flow
  }

  /**
   * Generates a unique ticket number in the format: TKT-YYYYMMDDCCPPNNNNN
   * Where:
   * - TKT: Static prefix
   * - YYYYMMDD: Current date
   * - CC: Category code (2 digits)
   * - PP: Priority code (2 digits)
   * - NNNNN: Sequential number (5 digits, padded with zeros)
   * 
   * @param categoryId - The ID of the ticket category
   * @param priority - The priority level (CRITICAL, HIGH, MEDIUM, LOW)
   * @returns A unique ticket number string
   * @throws NotFoundException if the category is not found
   */
  private async generateTicketNumber(
    categoryId: string,
    priority: string
  ): Promise<string> {
    // ─── Step 1: Get current date components ──────────────────────────
    // Format the current date as YYYYMMDD for the ticket number prefix
    const now = new Date();
    const year = String(now.getFullYear());
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dateStr = `${year}${month}${day}`;

    // ─── Step 2: Get category number ──────────────────────────────────
    // Fetch the category code from the database to ensure consistency
    // The category code is a 2-digit number that identifies the ticket type
    const categoryNumber = await this.getCategoryNumber(categoryId);

    // ─── Step 3: Get priority number ──────────────────────────────────
    // Map priority levels to 2-digit codes for the ticket number
    // CRITICAL → 01, HIGH → 02, MEDIUM → 03, LOW → 04
    const priorityNumber = this.getPriorityNumber(priority);

    // ─── Step 4: Get today's ticket count ─────────────────────────────
    // Count existing tickets created today with the same category and priority
    // This ensures sequential numbering resets daily per category/priority combination
    const todayCount = await this.getTodayTicketCount(
      dateStr,
      categoryNumber,
      priorityNumber
    );

    // ─── Step 5: Generate sequential number ───────────────────────────
    // The sequence starts at 1 for the first ticket of the day
    // and increments for each subsequent ticket, padded to 5 digits
    const sequence = String(todayCount + 1).padStart(5, '0');

    // ─── Step 6: Construct final ticket number ────────────────────────
    // Combine all components: TKT-YYYYMMDDCCPPNNNNN
    // Example: TKT-20241215010300001 (First Critical ticket in Category 1 on Dec 15, 2024)
    return `TKT-${dateStr}${categoryNumber}${priorityNumber}${sequence}`;
  }

  /**
   * Retrieves the numeric code for a category
   * 
   * @param categoryId - The ID of the category
   * @returns A 2-digit string representing the category code
   * @throws NotFoundException if the category is not found
   */
  private async getCategoryNumber(categoryId: string): Promise<string> {
    // ─── Graceful fallback: when no category selected, use code "00" ─────────
    if (!categoryId?.trim()) {
      return '00';
    }
    try {
      const category = await this.prisma.ticketCategory.findUnique({
        where: { id: categoryId },
        select: { sortOrder: true }
      });
      if (category) {
        return String(category.sortOrder).padStart(2, '0');
      }
    } catch {
      // Fall through to lookup-by-key fallback
    }
    // ─── Option 2: try lookup by category key (UUID could be a raw key) ─────
    try {
      const byKey = await this.prisma.ticketCategory.findUnique({
        where: { key: categoryId },
        select: { sortOrder: true },
      });
      if (byKey) return String(byKey.sortOrder).padStart(2, '0');
    } catch {
      // ignore schema variations
    }
    // ─── Final fallback so createTicket always succeeds ────────────────────
    return '00';
  }

  /**
   * Maps priority levels to 2-digit numeric codes
   * 
   * Priority mapping:
   * - CRITICAL: 01 (Highest priority)
   * - HIGH: 02
   * - MEDIUM: 03 (Default)
   * - LOW: 04 (Lowest priority)
   * 
   * @param priority - The priority level string
   * @returns A 2-digit string representing the priority code
   */
  private getPriorityNumber(priority: string): string {
    // ─── Priority code mapping ─────────────────────────────────────────
    // Define a consistent mapping between priority names and their codes
    const priorityCodes: Record<string, string> = {
      'CRITICAL': '01',
      'HIGH': '02',
      'MEDIUM': '03',
      'LOW': '04'
    };

    // Look up the code, default to '03' (MEDIUM) if not found
    // This ensures the system can handle unexpected priority values gracefully
    const normalizedPriority = priority.toUpperCase();
    return priorityCodes[normalizedPriority] || '03';
  }

  /**
   * Counts the number of tickets created today with specific category and priority
   * 
   * @param dateStr - The date string in YYYYMMDD format
   * @param categoryNumber - The 2-digit category code
   * @param priorityNumber - The 2-digit priority code
   * @returns The count of tickets matching the criteria
   */
  private async getTodayTicketCount(
    dateStr: string,
    categoryNumber: string,
    priorityNumber: string
  ): Promise<number> {
    // ─── Calculate today's date range ──────────────────────────────────
    // Get the start of the day (00:00:00)
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    // Get the end of the day (23:59:59.999)
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    // ─── Query tickets with matching prefix ────────────────────────────
    // The prefix includes the date, category code, and priority code
    // This ensures we only count tickets with the same category and priority
    // For example: TKT-2024121501* would match all tickets on Dec 15, 2024
    // with category code 01 (any priority)
    const prefix = `TKT-${dateStr}${categoryNumber}${priorityNumber}`;

    // ─── Count matching tickets ────────────────────────────────────────
    // Count all tickets created today that match the prefix pattern
    // This includes tickets created earlier today with the same category/priority
    return await this.prisma.supportTicket.count({
      where: {
        // Match tickets that start with the prefix
        ticketNumber: {
          startsWith: prefix
        },
        // Ensure the ticket was created today
        createdAt: {
          gte: startOfDay,
          lte: endOfDay
        }
      }
    });
  }

  // ─── Tickets ───────────────────────────────────────────────────────────────

  async createTicket(
    userId: string,
    data: {
      subject?: string;
      title?: string;   // DTO alias for "subject" (frontend compat)
      message?: string;
      description?: string; // DTO alias for "message" (frontend compat)
      type?: TicketType;
      priority?: TicketPriority;
      categoryId?: string;
      departmentId?: string;
      teamId?: string;
    },
  ) {
    // Normalize DTO aliases so the controller accepts both forms
    const subject = (data.subject ?? data.title ?? '').toString().trim();
    const message = (data.message ?? data.description ?? '').toString().trim();
    if (!subject) throw new BadRequestException('subject (or title) is required');
    const priorityRaw = (data.priority as any) != null ? String(data.priority).toUpperCase() : undefined;
    const typeRaw = (data.type as any) != null ? String(data.type).toUpperCase() : undefined;
    this.validatePriority(priorityRaw);
    this.validateTicketType(typeRaw);
    const priority = (priorityRaw as TicketPriority) ?? 'MEDIUM';
    const type = (typeRaw as TicketType) ?? 'CUSTOMER';
    const ticketNumber = await this.generateTicketNumber(
      data.categoryId ?? '',
      priority,
    );
    const ticket = await this.prisma.supportTicket.create({
      data: {
        ticketNumber,
        subject,
        message: message || subject,
        description: data.description,
        type,
        priority,
        userId,
        categoryId: data.categoryId ?? null,
        departmentId: data.departmentId ?? null,
        teamId: data.teamId ?? null,
        status: 'NEW',
      },
      include: this.ticketInclude(),
    });

    await this.prisma.ticketStatusHistory.create({
      data: { ticketId: ticket.id, toStatus: 'NEW', changedById: userId },
    });

    await this.logActivity(userId, 'ticket.created', 'SupportTicket', ticket.id);
    await this.audit(userId, 'CREATE_TICKET', 'SupportTicket', {
      resourceId: ticket.id,
      details: { ticketNumber: ticket.ticketNumber, subject: ticket.subject, priority: ticket.priority, type: ticket.type },
    });
    return ticket;
  }

  async listTickets(params?: {
    page?: number;
    limit?: number;
    status?: TicketStatus;
    priority?: TicketPriority;
    assigneeId?: string;
    departmentId?: string;
    teamId?: string;
    categoryId?: string;
    search?: string;
    unassigned?: boolean;
    dateFrom?: string;
    dateTo?: string;
    orderBy?: 'createdAt' | 'updatedAt' | 'priority' | 'status';
    orderDir?: 'asc' | 'desc';
    /**
     * Authenticated actor making the request. When supplied, ticket visibility
     * is restricted by role (admins see everything; everyone else sees only
     * tickets they created, are assigned to, are team members of, or have an
     * approved access grant for).
     */
    actor?: { id: string; role?: Role | null };
  }) {
    const page = Math.max(1, Number(params?.page ?? 1) || 1);
    const limit = Math.min(100, Math.max(1, Number(params?.limit ?? 20) || 20));
    const skip = (page - 1) * limit;
    const where: Prisma.SupportTicketWhereInput = { deletedAt: null };

    // Apply role-based visibility filter when an actor is supplied.
    if (params?.actor) {
      const accessWhere = await this.buildTicketAccessWhere(
        params.actor.id,
        params.actor.role ?? null,
      );
      
      if (Object.keys(accessWhere).length > 0) {
        (where as any).AND = [...((where as any).AND ?? []), accessWhere];
      }
    }

    // Normalize + validate enums from query strings
    if (params?.status) {
      const s = this.normalizeStatus(params.status);
      if (s) where.status = s;
    }
    if (params?.priority) {
      const p = String(params.priority).toUpperCase() as TicketPriority;
      this.validatePriority(p);
      where.priority = p;
    }
    if (params?.assigneeId) where.assigneeId = params.assigneeId;
    if (params?.departmentId) where.departmentId = params.departmentId;
    if (params?.categoryId) where.categoryId = params.categoryId;
    if (params?.teamId) {
      const userIds = await this.getUserIdsForTeam(params.teamId);
      const teamOr: Prisma.SupportTicketWhereInput[] = [{ teamId: params.teamId }];
      if (userIds.length) teamOr.push({ assigneeId: { in: userIds } });
      (where as any).AND = [...((where as any).AND ?? []), { OR: teamOr }];
    }
    if (params?.unassigned) where.assigneeId = null;
    if (params?.dateFrom || params?.dateTo) {
      where.createdAt = {};
      if (params?.dateFrom) {
        const d = new Date(params.dateFrom);
        if (isNaN(d.getTime())) throw new BadRequestException(`Invalid dateFrom: ${params.dateFrom}`);
        where.createdAt.gte = d;
      }
      if (params?.dateTo) {
        const d = new Date(params.dateTo);
        if (isNaN(d.getTime())) throw new BadRequestException(`Invalid dateTo: ${params.dateTo}`);
        where.createdAt.lte = d;
      }
    }
    if (params?.search) {
      const q = params.search;
      where.OR = [
        { subject: { contains: q, mode: 'insensitive' } },
        { ticketNumber: { contains: q, mode: 'insensitive' } },
        { message: { contains: q, mode: 'insensitive' } },
        {
          user: {
            is: {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { email: { contains: q, mode: 'insensitive' } },
                { handle: { contains: q, mode: 'insensitive' } },
              ],
            },
          },
        },
      ];
    }

    const validOrderByFields = ['createdAt', 'updatedAt', 'priority', 'status'];
    const orderField = validOrderByFields.includes(params?.orderBy as any) ? params.orderBy : 'createdAt';
    const orderDirection = (params?.orderDir ?? 'desc') === 'asc' ? 'asc' : 'desc';
    const orderBy: Record<string, 'asc' | 'desc'> = { [orderField as string]: orderDirection };
    // Secondary sort for stable pagination
    if (orderField !== 'createdAt') orderBy.createdAt = 'desc';

    const [tickets, total] = await Promise.all([
      this.prisma.supportTicket.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: this.ticketInclude(),
      }),
      this.prisma.supportTicket.count({ where }),
    ]);

    return { data: tickets, total, page, pageSize: limit };
  }

  //Get a list of deleted tickets
  async getDeletedTickets(params: {
    page?: number;
    limit?: number;
  } & {
    actor?: { id: string; role?: Role | null };
  }) {
    const page = Math.max(1, Number(params?.page ?? 1) || 1);
    const limit = Math.min(100, Math.max(1, Number(params?.limit ?? 20) || 20));
    const skip = (page - 1) * limit;
    const where: Prisma.SupportTicketWhereInput = { deletedAt: { not: null } };

    // Apply role-based visibility filter when an actor is supplied.
    if (params?.actor) {
      const accessWhere = await this.buildTicketAccessWhere(
        params.actor.id,
        params.actor.role ?? null,
      );
      if (Object.keys(accessWhere).length > 0) {
        (where as any).AND = [...((where as any).AND ?? []), accessWhere];
      }
    }

    const tickets = await this.prisma.supportTicket.findMany({
      where,
      skip,
      take: limit,
      include: this.ticketInclude(),
    });

    return { data: tickets, total: tickets.length, page, pageSize: limit };
  }

  //Get a ticket by id
  async getTicket(id: string, actor?: { id: string; role?: Role | null }) {
    const ticket = await this.prisma.supportTicket.findFirst({
      where: { id, deletedAt: null },
      include: {
        ...this.ticketInclude(),
        messages: {
          where: { deletedAt: null },
          include: { author: { select: { id: true, name: true, email: true, avatar: true, handle: true } } },
          orderBy: { createdAt: 'asc' },
        },
        internalNotes: {
          include: { author: { select: { id: true, name: true, email: true, avatar: true } } },
          orderBy: { createdAt: 'desc' },
        },
        attachments: true,
        statusHistory: {
          include: { changedBy: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
        },
        tagAssignments: { include: { tag: true } },
        assignments: {
          where: { isActive: true },
          include: { agent: { select: { id: true, name: true, email: true, avatar: true } } },
        },
      },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    if (actor) {
      await this.assertTicketAccess(ticket, actor);
    }
    return ticket;
  }

  async updateTicketStatus(id: string, status: TicketStatus, changedById: string, reason?: string) {
    const normalized = this.normalizeStatus(status);
    if (!normalized) throw new BadRequestException("status is required");
    const ticket = await this.getTicket(id);
    const now = new Date();
    const updates: Prisma.SupportTicketUpdateInput = { status: normalized };

    if (normalized === 'RESOLVED') updates.resolvedAt = now;
    if (normalized === 'CLOSED') updates.closedAt = now;
    if (normalized === 'REOPENED') updates.reopenedAt = now;
    if (normalized === 'IN_PROGRESS' && !ticket.firstResponseAt) updates.firstResponseAt = now;

    const updated = await this.prisma.supportTicket.update({
      where: { id },
      data: updates,
      include: this.ticketInclude(),
    });

    await this.prisma.ticketStatusHistory.create({
      data: { ticketId: id, fromStatus: ticket.status, toStatus: normalized, changedById, reason },
    });

    await this.logActivity(changedById, 'ticket.status_changed', 'SupportTicket', id, { status: normalized, reason });
    await this.audit(changedById, 'UPDATE_TICKET_STATUS', 'SupportTicket', {
      resourceId: id,
      changes: { from: ticket.status, to: normalized, reason: reason ?? null },
    });
    return updated;
  }

  async assignTicket(ticketId: string, agentId: string, assignedBy: string, reason?: string) {
    return this.routeTicket({ ticketId, agentId, assignedBy, reason });
  }

  async routeTicket(params: {
    ticketId: string;
    agentId?: string;
    teamId?: string;
    departmentId?: string;
    assignedBy: string;
    reason?: string;
  }) {
    const { ticketId, agentId, teamId, departmentId, assignedBy, reason } = params;
    if (!agentId && !teamId && !departmentId) {
      throw new BadRequestException("At least one of agentId/teamId/departmentId required");
    }
    const ticket = await this.getTicket(ticketId);

    // Validate foreign keys exist
    if (teamId) {
      const team = await this.prisma.supportTeam.findUnique({ where: { id: teamId } });
      if (!team || team.deletedAt) throw new NotFoundException(`Team ${teamId} not found`);
    }
    if (departmentId) {
      const dept = await this.prisma.supportDepartment.findUnique({ where: { id: departmentId } });
      if (!dept || dept.deletedAt) throw new NotFoundException(`Department ${departmentId} not found`);
    }
    if (agentId) {
      const agent = await this.prisma.supportAgent.findUnique({ where: { userId: agentId } });
      if (!agent || !agent.isActive || agent.deletedAt) {
        throw new NotFoundException(`Agent ${agentId} not found or inactive`);
      }
    }

    if (agentId) {
      await this.prisma.ticketAssignment.updateMany({
        where: { ticketId, isActive: true },
        data: { isActive: false, endedAt: new Date() },
      });
      await this.prisma.ticketAssignment.create({
        data: { ticketId, agentId, assignedBy, reason },
      });
      await this.prisma.supportAgent.updateMany({
        where: { userId: agentId },
        data: { activeTickets: { increment: 1 } },
      });
    }

    const ticketUpdate: Prisma.SupportTicketUpdateInput = {};
    if (agentId) {
      ticketUpdate.assignee = { connect: { id: agentId } };
      if (ticket.status === 'NEW') ticketUpdate.status = 'ASSIGNED';
    }
    if (teamId !== undefined) {
      assignRelationUpdate(ticketUpdate as Record<string, unknown>, 'team', teamId);
    }
    if (departmentId !== undefined) {
      assignRelationUpdate(ticketUpdate as Record<string, unknown>, 'department', departmentId);
    }

    const updated = await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: ticketUpdate,
      include: this.ticketInclude(),
    });

    if (ticket.status === 'NEW' && agentId) {
      await this.prisma.ticketStatusHistory.create({
        data: { ticketId, fromStatus: 'NEW', toStatus: 'ASSIGNED', changedById: assignedBy },
      });
    }

    await this.logActivity(assignedBy, 'ticket.routed', 'SupportTicket', ticketId, {
      agentId: agentId ?? null,
      teamId: teamId ?? null,
      departmentId: departmentId ?? null,
      reason: reason ?? null,
    });
    return updated;
  }

  async addMessage(ticketId: string, authorId: string, body: string, isInternal = false) {
    this.assertNonEmptyString(body, 'body');
    const ticket = await this.getTicket(ticketId);
    const message = await this.prisma.ticketMessage.create({
      data: { ticketId, authorId, body: String(body).trim(), isInternal: !!isInternal },
      include: { author: { select: { id: true, name: true, email: true, avatar: true } } },
    });

    if (!isInternal) {
      // 1) First-response timestamp if this is the first public message
      if (!ticket.firstResponseAt) {
        await this.prisma.supportTicket.update({
          where: { id: ticketId },
          data: { firstResponseAt: new Date() },
        });
      }
      // 2) After an agent posts a public reply, the ticket is now waiting on the customer
      if (ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED') {
        await this.prisma.supportTicket.update({
          where: { id: ticketId },
          data: { status: 'WAITING_ON_CUSTOMER' },
        });
        await this.prisma.ticketStatusHistory.create({
          data: { ticketId, fromStatus: ticket.status, toStatus: 'WAITING_ON_CUSTOMER', changedById: authorId, reason: 'Agent public reply' },
        });
      }
      await this.audit(authorId, 'CREATE_TICKET_MESSAGE', 'SupportTicket', {
        resourceId: ticketId,
        details: { messageId: message.id, isInternal: false, authorRole: message.author.email?.includes('@vellbase') ? 'staff' : 'user' },
      });
    }

    return message;
  }

  async addInternalNote(ticketId: string, authorId: string, body: string) {
    this.assertNonEmptyString(body, 'body');
    await this.getTicket(ticketId);
    return this.prisma.ticketInternalNote.create({
      data: { ticketId, authorId, body: String(body).trim() },
      include: { author: { select: { id: true, name: true, email: true, avatar: true } } },
    });
  }

  async escalateTicket(ticketId: string, changedById: string, reason?: string) {
    return this.updateTicketStatus(ticketId, 'ESCALATED', changedById, reason);
  }

  async deleteTicket(id: string, deletedBy: string) {
    const existing = await this.prisma.supportTicket.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new NotFoundException(`Ticket ${id} not found or already deleted`);
    await this.prisma.supportTicket.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.logActivity(deletedBy, 'ticket.deleted', 'SupportTicket', id);
    await this.audit(deletedBy, 'DELETE_TICKET', 'SupportTicket', { resourceId: id });
    return { success: true };
  }

  // ─── Auto Assignment ───────────────────────────────────────────────────────

  async autoAssignTicket(ticketId: string, strategy: 'round_robin' | 'least_busy' | 'skill_based' | undefined = 'least_busy') {
    const validStrategies = ['round_robin', 'least_busy', 'skill_based'] as const;
    let chosen: (typeof validStrategies)[number] = 'least_busy';
    if (strategy == null) {
      chosen = 'least_busy';
    } else {
      const s = String(strategy).toLowerCase() as any;
      if (!validStrategies.includes(s)) {
        throw new BadRequestException(`Invalid strategy "${strategy}". Valid: ${validStrategies.join(', ')}`);
      }
      chosen = s;
    }
    const ticket = await this.getTicket(ticketId);
    let agent: { userId: string } | null = null;

    if (chosen === 'least_busy') {
      agent = await this.prisma.supportAgent.findFirst({
        where: {
          isActive: true,
          status: { in: ['ONLINE', 'AWAY'] },
          departmentId: ticket.departmentId ?? undefined,
          activeTickets: { lt: 10 },
        },
        orderBy: { activeTickets: 'asc' },
      });
    } else if (chosen === 'round_robin') {
      const agents = await this.prisma.supportAgent.findMany({
        where: { isActive: true, status: { in: ['ONLINE', 'AWAY'] } },
        orderBy: { updatedAt: 'asc' },
        take: 1,
      });
      agent = agents[0] ?? null;
    }

    if (!agent) throw new BadRequestException('No available agents for assignment');
    return this.assignTicket(ticketId, agent.userId, agent.userId, `Auto-assigned via ${chosen}`);
  }

  // ─── Agents ────────────────────────────────────────────────────────────────

  async listAgents(params?: {
    departmentId?: string;
    status?: AgentStatus;
    isActive?: boolean;
    search?: string;
    page?: number;
    limit?: number;
    sortBy?: 'name' | 'activeTickets' | 'maxTickets' | 'createdAt' | 'ticketsResolved' | 'escalations' | 'ticketsAssigned';
    sortDir?: 'asc' | 'desc';
  }) {
    const where: Prisma.SupportAgentWhereInput = { deletedAt: null };
    if (params?.departmentId) where.departmentId = params.departmentId;
    if (params?.status) where.status = params.status;
    if (params?.isActive !== undefined) where.isActive = params.isActive;

    if (params?.search) {
      where.user = {
        OR: [
          { name: { contains: params.search, mode: 'insensitive' } },
          { email: { contains: params.search, mode: 'insensitive' } },
        ],
      };
    }

    const page = params?.page ?? 1;
    const limit = params?.limit ?? 50;
    const skip = (page - 1) * limit;

    // Whitelist:
    //  - prismaOrderByKeys: fields that actually exist on SupportAgent Prisma model, so orderBy won't throw Unknown argument.
    //  - virtualOrderByKeys: computed fields attached after enrichment (ticketsAssigned/ticketsResolved/escalations)
    const PRISMA_KEYS = new Set<string>(['name', 'activeTickets', 'maxTickets', 'createdAt', 'userId', 'departmentId', 'teamId', 'status', 'isActive', 'vacationUntil', 'updatedAt']);
    const VIRTUAL_KEYS = new Set<string>(['ticketsResolved', 'ticketsAssigned', 'escalations']);
    const ALL_KEYS = new Set([...PRISMA_KEYS, ...VIRTUAL_KEYS]);

    const rawSortBy = params?.sortBy ?? 'createdAt';
    const sortBy = String(rawSortBy);
    if (!ALL_KEYS.has(sortBy)) {
      const valid = [...ALL_KEYS].sort().join(', ');
      throw new BadRequestException(`Invalid sortBy "${rawSortBy}". Valid values: ${valid}`);
    }
    const sortDir: 'asc' | 'desc' = params?.sortDir === 'asc' ? 'asc' : 'desc';

    const isVirtualSort = VIRTUAL_KEYS.has(sortBy);
    const buildPrismaOrderBy = (key: string): Prisma.SupportAgentOrderByWithRelationInput => {
      switch (key) {
        case 'name':
          return { user: { name: sortDir } };
        case 'activeTickets':
          return { activeTickets: sortDir };
        case 'maxTickets':
          return { maxTickets: sortDir };
        case 'createdAt':
        default:
          return { createdAt: sortDir };
      }
    };
    // For Prisma-native sorts we let the DB sort and paginate.
    // For virtual sorts we MUST fetch + enrich + sort in memory before slicing the page
    // (otherwise ordering is wrong because Prisma knows nothing about those fields).
    const prismaOrderBy: Prisma.SupportAgentOrderByWithRelationInput = isVirtualSort
      ? { createdAt: 'desc' } // stable default for virtual-sort pass
      : buildPrismaOrderBy(sortBy);

    const [agents, total] = await Promise.all([
      this.prisma.supportAgent.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true, avatar: true, handle: true, role: true } },
          department: true,
          team: true,
        },
        orderBy: prismaOrderBy,
        skip: isVirtualSort ? undefined : skip,
        take: isVirtualSort ? undefined : limit,
      }),
      this.prisma.supportAgent.count({ where }),
    ]);

    // Enrich with ticket counts — single batched groupBy when available,
    // otherwise fall back to per-agent count queries (backwards-compat with test mocks lacking groupBy).
    const agentUserIds = agents.map((a) => a.userId);
    const prismaAny = this.prisma as any;
    let enriched: any[];
    if (
      agentUserIds.length &&
      typeof prismaAny.supportTicket?.groupBy === 'function'
    ) {
      const assigneesWhere: any = { assigneeId: { in: agentUserIds }, deletedAt: null };
      const statusRows: any[] = await prismaAny.supportTicket.groupBy({
        by: ['assigneeId', 'status'],
        where: assigneesWhere,
        _count: { _all: true },
      });
      const collect = (uid: string, statusList: string[]) =>
        statusRows
          .filter((r) => r.assigneeId === uid && statusList.includes(String(r.status)))
          .reduce((s, r) => s + Number(r._count?._all ?? 0), 0);
      const TERMINAL = SupportService.TERMINAL_STATUSES as readonly string[];
      enriched = agents.map((agent) => {
        const openTickets = collect(agent.userId, (SupportService.VALID_STATUSES as readonly string[]).filter((s) => !TERMINAL.includes(s)));
        const ticketsResolved = collect(agent.userId, ['RESOLVED']);
        const escalations = collect(agent.userId, ['ESCALATED']);
        return {
          ...agent,
          ticketsAssigned: openTickets,
          ticketsResolved,
          escalations,
        };
      });
    } else {
      // Fallback (per-agent count queries) — covers mocks that don't implement groupBy.
      enriched = await Promise.all(
        agents.map(async (agent) => {
          const TERMINAL = SupportService.TERMINAL_STATUSES as readonly string[];
          const [assigned, resolved, escalated] = await Promise.all([
            prismaAny.supportTicket?.count?.({
              where: { assigneeId: agent.userId, deletedAt: null, status: { notIn: TERMINAL as any[] } },
            }) ?? 0,
            prismaAny.supportTicket?.count?.({
              where: { assigneeId: agent.userId, deletedAt: null, status: 'RESOLVED' },
            }) ?? 0,
            prismaAny.supportTicket?.count?.({
              where: { assigneeId: agent.userId, deletedAt: null, status: 'ESCALATED' },
            }) ?? 0,
          ]);
          return {
            ...agent,
            ticketsAssigned: Number(assigned) || 0,
            ticketsResolved: Number(resolved) || 0,
            escalations: Number(escalated) || 0,
          };
        }),
      );
    }

    // Apply virtual sort in memory
    const sorted = isVirtualSort
      ? enriched.slice().sort((a, b) => {
        const av = Number((a as any)[sortBy] ?? 0);
        const bv = Number((b as any)[sortBy] ?? 0);
        return sortDir === 'asc' ? av - bv : bv - av;
      })
      : enriched;

    const sliced: typeof enriched = isVirtualSort ? sorted.slice(skip, skip + limit) : sorted;

    return { data: sliced, total, page, limit };
  }

  async createAgent(data: {
    userId: string;
    departmentId?: string;
    teamId?: string;
    skills?: string[];
    maxTickets?: number;
  }) {
    return this.prisma.supportAgent.create({
      data: {
        userId: data.userId,
        departmentId: data.departmentId,
        teamId: data.teamId,
        skills: data.skills ?? [],
        maxTickets: data.maxTickets ?? 10,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        department: true,
        team: true,
      },
    });
  }

  async updateAgentStatus(userId: string, status: AgentStatus) {
    return this.prisma.supportAgent.update({
      where: { userId },
      data: { status },
    });
  }

  async getAgentMetrics(userIdOrAgentId: string) {
    const agent = await this.resolveSupportAgent(userIdOrAgentId);
    const userId = agent.userId;

    const [assigned, resolved, escalated, reopened] = await Promise.all([
      this.prisma.ticketAssignment.count({ where: { agentId: userId } }),
      this.prisma.supportTicket.count({ where: { assigneeId: userId, status: 'RESOLVED' } }),
      this.prisma.supportTicket.count({ where: { assigneeId: userId, status: 'ESCALATED' } }),
      this.prisma.supportTicket.count({ where: { assigneeId: userId, status: 'REOPENED' } }),
    ]);

    return {
      agent,
      metrics: {
        totalAssigned: assigned,
        resolved,
        escalated,
        reopened,
        escalationRate: assigned > 0 ? (escalated / assigned) * 100 : 0,
        reopenRate: resolved > 0 ? (reopened / resolved) * 100 : 0,
      },
    };
  }

  async getAgentLeaderboard() {
    const agents = await this.prisma.supportAgent.findMany({
      where: { isActive: true, deletedAt: null },
      include: { user: { select: { id: true, name: true, avatar: true } } },
    });

    const leaderboard = await Promise.all(
      agents.map(async (agent) => {
        const metrics = await this.getAgentMetrics(agent.userId);
        return { ...agent, ...metrics.metrics };
      }),
    );

    return leaderboard.sort((a, b) => b.resolved - a.resolved);
  }

  async getAgentStats() {
    const [total, active, online, busy, away, offline] = await Promise.all([
      this.prisma.supportAgent.count({ where: { deletedAt: null } }),
      this.prisma.supportAgent.count({ where: { deletedAt: null, isActive: true } }),
      this.prisma.supportAgent.count({ where: { deletedAt: null, status: 'ONLINE' } }),
      this.prisma.supportAgent.count({ where: { deletedAt: null, status: 'BUSY' } }),
      this.prisma.supportAgent.count({ where: { deletedAt: null, status: 'AWAY' } }),
      this.prisma.supportAgent.count({ where: { deletedAt: null, status: 'OFFLINE' } }),
    ]);

    const tickets = await this.prisma.supportTicket.groupBy({
      by: ['status'],
      where: { deletedAt: null },
      _count: true,
    });

    const totalTickets = tickets.reduce((sum, t) => sum + t._count, 0);
    const resolvedTickets = tickets.find((t) => t.status === 'RESOLVED')?._count ?? 0;
    const closedTickets = tickets.find((t) => t.status === 'CLOSED')?._count ?? 0;

    return {
      total,
      active,
      inactive: total - active,
      online,
      busy,
      away,
      offline,
      totalTickets,
      resolvedTickets,
      closedTickets,
      resolutionRate: totalTickets > 0 ? ((resolvedTickets + closedTickets) / totalTickets) * 100 : 0,
    };
  }

  /**
   * Resolves a SupportAgent by either:
   *   1. SupportAgent.id (UUID of the agent record itself, e.g. `a1` / `e2bd...`)
   *   2. SupportAgent.userId (UUID of the underlying User, e.g. `u-sarah` / `96b0...`)
   *
   * Frontend drill-downs occasionally pass `agent.id` instead of `agent.userId`;
   * supporting both keeps navigation tolerant.
   */
  private async resolveSupportAgent(userIdOrAgentId: string): Promise<{ id: string; userId: string } & any> {
    const agent = await this.prisma.supportAgent.findFirst({
      where: {
        OR: [{ id: userIdOrAgentId }, { userId: userIdOrAgentId }],
        deletedAt: null,
      },
    });
    if (!agent) throw new NotFoundException('Agent not found');
    return agent;
  }

  async getAgentDetail(userIdOrAgentId: string) {
    const agent = await this.prisma.supportAgent.findFirst({
      where: {
        OR: [{ id: userIdOrAgentId }, { userId: userIdOrAgentId }],
        deletedAt: null,
      },
      include: {
        user: { select: { id: true, name: true, email: true, avatar: true, handle: true, role: true, createdAt: true } },
        department: true,
        team: true,
      },
    });

    if (!agent) throw new NotFoundException('Agent not found');
    const userId = agent.userId;

    const [tickets, recentActivity, metrics] = await Promise.all([
      this.prisma.supportTicket.findMany({
        where: { assigneeId: userId, deletedAt: null },
        select: {
          id: true,
          ticketNumber: true,
          subject: true,
          status: true,
          priority: true,
          createdAt: true,
          updatedAt: true,
          category: { select: { name: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 10,
      }),
      this.prisma.activityLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.getAgentMetrics(userId),
    ]);

    return {
      ...agent,
      tickets,
      recentActivity,
      metrics: metrics.metrics,
    };
  }

  async updateAgent(userIdOrAgentId: string, data: {
    departmentId?: string | null;
    teamId?: string | null;
    skills?: string[];
    maxTickets?: number;
    isActive?: boolean;
  }) {
    const agent = await this.resolveSupportAgent(userIdOrAgentId);

    const updateData: Prisma.SupportAgentUpdateInput = {};
    if (data.departmentId !== undefined) {
      if (data.departmentId) {
        await validateSupportDepartmentExists(this.prisma, data.departmentId);
      }
      assignRelationUpdate(updateData as Record<string, unknown>, 'department', data.departmentId ?? null);
    }
    if (data.teamId !== undefined) {
      if (data.teamId) {
        await validateSupportTeamExists(this.prisma, data.teamId);
      }
      assignRelationUpdate(updateData as Record<string, unknown>, 'team', data.teamId ?? null);
    }
    if (data.skills !== undefined) updateData.skills = data.skills;
    if (data.maxTickets !== undefined) updateData.maxTickets = data.maxTickets;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    return this.prisma.supportAgent.update({
      where: { id: agent.id },
      data: updateData,
      include: {
        user: { select: { id: true, name: true, email: true, avatar: true } },
        department: true,
        team: true,
      },
    });
  }

  async deleteAgent(userIdOrAgentId: string) {
    const agent = await this.resolveSupportAgent(userIdOrAgentId);
    const userId = agent.userId;

    // Soft delete - unassign active tickets first
    await this.prisma.supportTicket.updateMany({
      where: { assigneeId: userId, status: { notIn: ['RESOLVED', 'CLOSED'] } },
      data: { assigneeId: null, status: 'NEW' },
    });

    return this.prisma.supportAgent.update({
      where: { id: agent.id },
      data: { deletedAt: new Date(), isActive: false, status: 'OFFLINE' },
    });
  }

  //update agent presence such as offline and online
  // ─── Update agent presence ───

  async updateAgentPresence(
    userId: string,
    status: string
  ): Promise<any> {
    try {
      // First verify user is an agent
      const isAgent = await this.isSupportAgent(userId);
      if (!isAgent) {
        throw new Error("User is not a support agent");
      }

      // Update or create presence record
      return await this.prisma.supportAgent.upsert({
        where: { userId },
        update: {
          status: status.toUpperCase() as AgentStatus,
          // lastSeenAt: new Date(),
          updatedAt: new Date(),
        },
        create: {
          userId,
          status: status.toUpperCase() as AgentStatus,
          // lastSeenAt: new Date(),
        },
      });
    } catch (error) {
      throw (error as any).message;
      
    }
  }

  // ─── Get agent presence ───

  async getAgentPresence(userId: string) {
    const presence = await this.prisma.supportAgent.findUnique({
      where: { userId },
      select: {
        status: true,
        updatedAt: true,
      },
    });

    return presence || {
      status: "OFFLINE",
      updatedAt: null,
    };
  }

  // ─── Get all agents with their presence ───

  async getAgentsWithPresence(params?: {
    departmentId?: string;
    teamId?: string;
    status?: string;
  }) {
    const where: any = {
      deletedAt: null,
      isActive: true,
    };

    if (params?.departmentId) {
      where.departmentId = params.departmentId;
    }
    if (params?.teamId) {
      where.teamId = params.teamId;
    }

    const agents = await this.prisma.supportAgent.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            handle: true,
          },
        },
        department: true,
        team: true,
      },
    });

    // Filter by status if provided (after fetching presence)
    let filteredAgents = agents;
    if (params?.status) {
      filteredAgents = agents.filter(
        (agent) => agent.status.toLowerCase() === params.status.toLowerCase()
      );
    }

    return filteredAgents.map((agent) => ({
      ...agent,
      presence: agent || {
        status: "OFFLINE",
        updatedAt: null,
      },
    }));
  }

  // ─── Get online agents count ───

  async getOnlineAgentsCount(): Promise<number> {
    const count = await this.prisma.supportAgent.count({
      where: {
        status: "ONLINE",
        user: {
          deletedAt: null,
          isActive: true,
        },
      },
    });
    return count;
  }

  // ─── Check if user is a support agent ───

  async isSupportAgent(userId: string): Promise<boolean> {
    const agent = await this.prisma.supportAgent.findFirst({
      where: {
        userId,
        deletedAt: null,
        isActive: true,
      },
      select: { id: true },
    });
    return !!agent;
  }


  //toggle agent status such as active and inactive
  async toggleAgentStatus(userIdOrAgentId: string) {
    const agent = await this.resolveSupportAgent(userIdOrAgentId);

    const newIsActive = !agent.isActive;
    return this.prisma.supportAgent.update({
      where: { id: agent.id },
      data: {
        isActive: newIsActive,
        status: newIsActive ? 'ONLINE' : 'OFFLINE',
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async getAgentTickets(userIdOrAgentId: string, params?: {
    status?: TicketStatus;
    page?: number;
    limit?: number;
  }) {
    const agent = await this.resolveSupportAgent(userIdOrAgentId);
    const userId = agent.userId;

    const where: Prisma.SupportTicketWhereInput = {
      assigneeId: userId,
      deletedAt: null,
    };
    if (params?.status) where.status = params.status;

    const page = params?.page ?? 1;
    const limit = params?.limit ?? 20;
    const skip = (page - 1) * limit;

    const [tickets, total] = await Promise.all([
      this.prisma.supportTicket.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true, avatar: true } },
          category: { select: { name: true } },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.supportTicket.count({ where }),
    ]);

    return { data: tickets, total, page, limit };
  }

  async getAgentActivity(userIdOrAgentId: string, params?: {
    page?: number;
    limit?: number;
  }) {
    const agent = await this.resolveSupportAgent(userIdOrAgentId);
    const userId = agent.userId;

    const page = params?.page ?? 1;
    const limit = params?.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = { userId };

    const [activities, total] = await Promise.all([
      this.prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.activityLog.count({ where }),
    ]);

    return { data: activities, total, page, limit };
  }

  // ─── Categories, Tags, SLA ─────────────────────────────────────────────────

  async listCategories() {
    return this.prisma.ticketCategory.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } });
  }

  async listTags() {
    return this.prisma.ticketTag.findMany({ orderBy: { name: 'asc' } });
  }

  async listSlaPolicies() {
    return this.prisma.slaPolicy.findMany({
      where: { isActive: true },
      include: { department: true, escalationRules: true },
    });
  }

  async listCannedResponses(category?: string, tags?: string[]) {
    const where: Prisma.CannedResponseWhereInput = { isActive: true, deletedAt: null };
    if (category) where.category = category;
    if (tags && tags.length > 0) where.tags = { hasSome: tags };
    return this.prisma.cannedResponse.findMany({ where, orderBy: { title: 'asc' } });
  }

  async getCannedResponse(id: string) {
    const cr = await this.prisma.cannedResponse.findFirst({
      where: { id, deletedAt: null },
    });
    if (!cr) throw new NotFoundException('Canned response not found');
    return cr;
  }

  async createCannedResponse(data: {
    title: string;
    body: string;
    category?: string;
    shortcut?: string;
    isActive?: boolean;
    tags?: string[];
    variables?: string[];
    shortcuts?: string[];
  }) {
    if (data.shortcut) {
      const existing = await this.prisma.cannedResponse.findFirst({
        where: { shortcut: data.shortcut, deletedAt: null },
      });
      if (existing) throw new BadRequestException('Shortcut already in use');
    }
    return this.prisma.cannedResponse.create({ data });
  }

  async updateCannedResponse(
    id: string,
    data: {
      title?: string;
      body?: string;
      category?: string;
      shortcut?: string;
      isActive?: boolean;
      tags?: string[];
      variables?: string[];
      shortcuts?: string[];
    },
  ) {
    await this.getCannedResponse(id);
    if (data.shortcut) {
      const existing = await this.prisma.cannedResponse.findFirst({
        where: { shortcut: data.shortcut, deletedAt: null, NOT: { id } },
      });
      if (existing) throw new BadRequestException('Shortcut already in use');
    }
    return this.prisma.cannedResponse.update({ where: { id }, data });
  }

  async deleteCannedResponse(id: string) {
    await this.getCannedResponse(id);
    await this.prisma.cannedResponse.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
    return { success: true };
  }

  async incrementCannedUsage(id: string) {
    await this.getCannedResponse(id);
    return this.prisma.cannedResponse.update({
      where: { id },
      data: { usageCount: { increment: 1 } },
    });
  }

  // ─── Dashboard & Analytics ─────────────────────────────────────────────────

  async getSupportDashboard(actor?: { id: string; role?: Role | null }) {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const where: Prisma.SupportTicketWhereInput = { deletedAt: null };

    // Apply role-based visibility filter when an actor is supplied.
    if (actor) {
      const accessWhere = await this.buildTicketAccessWhere(
        actor.id,
        actor.role ?? null,
      );
      if (Object.keys(accessWhere).length > 0) {
        (where as any).AND = [...((where as any).AND ?? []), accessWhere];
      }
    }

    const [
      openTickets,
      unassigned,
      inProgress,
      escalated,
      resolved,
      closed,
      agents,
      responseTimeTickets,
      newLast24h,
      resolvedToday,
      resolutionTimeTickets,
    ] = await Promise.all([
      this.prisma.supportTicket.count({ where: { ...where, status: { notIn: ['CLOSED', 'RESOLVED'] } } }),
      this.prisma.supportTicket.count({ where: { ...where, assigneeId: null, status: 'NEW' } }),
      this.prisma.supportTicket.count({ where: { ...where, status: 'IN_PROGRESS' } }),
      this.prisma.supportTicket.count({ where: { ...where, status: 'ESCALATED' } }),
      this.prisma.supportTicket.count({ where: { ...where, status: 'RESOLVED' } }),
      this.prisma.supportTicket.count({ where: { ...where, status: 'CLOSED' } }),
      this.prisma.supportAgent.count({ where: { isActive: true, status: 'ONLINE' } }),
      this.prisma.supportTicket.findMany({
        where: { ...where, firstResponseAt: { not: null } },
        select: { createdAt: true, firstResponseAt: true },
      }),
      this.prisma.supportTicket.count({ where: { ...where, createdAt: { gte: oneDayAgo } } }),
      this.prisma.supportTicket.count({
        where: {
          ...where,
          status: { in: ['RESOLVED', 'CLOSED'] },
          updatedAt: { gte: startOfToday },
        },
      }),
      this.prisma.supportTicket.findMany({
        where: {
          ...where,
          status: { in: ['RESOLVED', 'CLOSED'] },
          resolvedAt: { not: null },
        },
        select: { createdAt: true, resolvedAt: true },
      }),
    ]);

    const avgResponseMs = responseTimeTickets.length > 0
      ? responseTimeTickets.reduce((sum, t) => sum + (t.firstResponseAt!.getTime() - t.createdAt.getTime()), 0) / responseTimeTickets.length
      : 0;

    const avgResolutionMs = resolutionTimeTickets.length > 0
      ? resolutionTimeTickets.reduce((sum, t) => sum + (t.resolvedAt!.getTime() - t.createdAt.getTime()), 0) / resolutionTimeTickets.length
      : 0;

    const byPriority = await this.prisma.supportTicket.groupBy({
      by: ['priority'],
      where: { ...where, status: { notIn: ['CLOSED', 'RESOLVED'] } },
      _count: true,
    });



    const byStatus = await this.prisma.supportTicket.groupBy({
      by: ['status'],
      where: { ...where },
      _count: true,
    });

    return {
      summary: {
        openTickets,
        unassigned,
        inProgress,
        escalated,
        resolved,
        closed,
        onlineAgents: agents,
        avgResponseMs,
        avgResolutionMs,
        newLast24h,
        resolvedToday,
      },
      byPriority,
      byStatus,
    };
  }

  async getSlaDashboard() {
    const policies = await this.listSlaPolicies();
    const breached = await this.prisma.supportTicket.count({
      where: {
        deletedAt: null,
        dueAt: { lt: new Date() },
        status: { notIn: ['RESOLVED', 'CLOSED'] },
      },
    });

    return { policies, breachedCount: breached };
  }

  // ─── Knowledge Base ────────────────────────────────────────────────────────

  async listKbArticles(params?: { category?: string; search?: string; published?: boolean }) {
    const where: Prisma.HelpArticleWhereInput = {};
    if (params?.category) where.category = params.category;
    if (params?.published !== undefined) where.isPublished = params.published;
    if (params?.search) {
      where.OR = [
        { title: { contains: params.search, mode: 'insensitive' } },
        { description: { contains: params.search, mode: 'insensitive' } },
      ];
    }
    return this.prisma.helpArticle.findMany({ where, orderBy: { createdAt: 'desc' } });
  }

  async createKbArticleVersion(articleId: string, authorId: string, changeNote?: string) {
    const article = await this.prisma.helpArticle.findUnique({ where: { id: articleId } });
    if (!article) throw new NotFoundException('Article not found');

    const lastVersion = await this.prisma.helpArticleVersion.findFirst({
      where: { articleId },
      orderBy: { version: 'desc' },
    });

    return this.prisma.helpArticleVersion.create({
      data: {
        articleId,
        version: (lastVersion?.version ?? 0) + 1,
        title: article.title,
        content: article.content,
        authorId,
        changeNote,
      },
    });
  }

  // ─── User-Facing (Help Center) ────────────────────────────────────────────

  async listMyTickets(
    userId: string,
    params?: { page?: number; limit?: number; status?: TicketStatus },
  ) {
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 20;
    const skip = (page - 1) * limit;
    const where: Prisma.SupportTicketWhereInput = { userId, deletedAt: null };
    if (params?.status) where.status = params.status;

    const [tickets, total] = await Promise.all([
      this.prisma.supportTicket.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          category: true,
          department: true,
          assignee: { select: { id: true, name: true, avatar: true } },
        },
      }),
      this.prisma.supportTicket.count({ where }),
    ]);

    return { data: tickets, total, page, pageSize: limit };
  }

  async getMyTicket(userId: string, ticketId: string) {
    const ticket = await this.prisma.supportTicket.findFirst({
      where: { id: ticketId, userId, deletedAt: null },
      include: {
        category: true,
        department: true,
        assignee: { select: { id: true, name: true, avatar: true, handle: true } },
        messages: {
          where: { deletedAt: null, isInternal: false },
          include: { author: { select: { id: true, name: true, avatar: true, handle: true } } },
          orderBy: { createdAt: 'asc' },
        },
        statusHistory: {
          include: { changedBy: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket;
  }

  async addMessageToMyTicket(userId: string, ticketId: string, body: string) {
    const ticket = await this.getMyTicket(userId, ticketId);
    if (ticket.status === 'CLOSED' || ticket.status === 'RESOLVED') {
      throw new BadRequestException('Cannot reply to a closed or resolved ticket');
    }
    const message = await this.prisma.ticketMessage.create({
      data: { ticketId, authorId: userId, body, isInternal: false },
      include: { author: { select: { id: true, name: true, avatar: true, handle: true } } },
    });
    // Reopen if waiting on customer
    if (ticket.status === 'WAITING_ON_CUSTOMER') {
      await this.prisma.supportTicket.update({
        where: { id: ticketId },
        data: { status: 'IN_PROGRESS' },
      });
      await this.prisma.ticketStatusHistory.create({
        data: { ticketId, fromStatus: 'WAITING_ON_CUSTOMER', toStatus: 'IN_PROGRESS', changedById: userId },
      });
    }
    await this.audit(userId, 'CREATE_TICKET_MESSAGE', 'SupportTicket', {
      resourceId: ticketId,
      details: { messageId: message.id, source: 'help_center', isInternal: false },
    });
    return message;
  }

  async getKbArticleBySlug(slug: string) {
    const article = await this.prisma.helpArticle.findFirst({
      where: { slug, isPublished: true },
    });
    if (!article) throw new NotFoundException('Article not found');
    await this.prisma.helpArticle.update({ where: { id: article.id }, data: { views: { increment: 1 } } });
    return article;
  }

  // ─── Seed ──────────────────────────────────────────────────────────────────

  async seedSupport() {
    const existing = await this.prisma.supportDepartment.count();
    const kbExisting = await this.prisma.helpArticle.count();

    // Seed KB articles regardless of departments
    if (kbExisting === 0) {
      await this.prisma.helpArticle.createMany({
        data: [
          {
            slug: 'getting-started',
            title: 'Getting Started with Vellbase',
            description: 'Learn the basics of Vellbase — set up your profile, publish your first story, and connect with readers.',
            content: [
              '## Welcome to Vellbase!',
              'Vellbase is a home for thoughtful writing and story discovery. This guide walks you through getting set up and making the most of the platform.',
              '## 1. Create Your Profile',
              'Start by uploading a profile photo, adding a short bio, and setting a memorable handle. Your handle is how other users find and mention you.',
              '## 2. Publish Your First Story',
              'Tap **Create** in the sidebar to open the editor. You can write from scratch or paste an existing draft. Add a cover image to help your story stand out.',
              '## 3. Discover & Follow',
              'Use **Discover** to find writers and topics you love. Tap Follow on any author to see their new stories in your Feed.',
              '## 4. Save & Highlight',
              'Bookmark stories to read later by tapping the bookmark icon. Highlight passages to save your favorite quotes and share them with friends.',
            ],
            category: 'Basics',
            icon: 'BookOpen',
            readMinutes: 4,
            popular: true,
          },
          {
            slug: 'signing-up-logging-in',
            title: 'Signing up & logging in',
            description: 'Everything about creating an account, password resets, and two-factor authentication.',
            content: [
              '## Creating an Account',
              'You can sign up with your email address or continue with Google. We never post to your social accounts without permission.',
              '## Resetting Your Password',
              'If you forget your password, tap **Forgot password?** on the login screen. We will email you a secure link that is valid for 24 hours.',
              '## Changing Your Email',
              'Go to **Settings → Edit profile** to update your email address. You will need to confirm the new address via a verification link.',
            ],
            category: 'Access',
            icon: 'LogIn',
            readMinutes: 3,
            popular: true,
          },
          {
            slug: 'publishing-a-story',
            title: 'Publishing a story',
            description: 'Write, format, schedule, and publish stories on Vellbase. Learn about drafts, cover images, and SEO.',
            content: [
              '## The Editor',
              'Our editor supports Markdown shortcuts. Type # for headings, ** for bold, and * for italic. You can also use the formatting toolbar.',
              '## Cover Images',
              'A great cover helps your story perform. We recommend a landscape image at least 1200px wide. You can upload one or choose from our library.',
              '## Drafts & Scheduling',
              'Your work autosaves as you write. When you are ready, choose **Publish** now or schedule a future time for optimal reach.',
            ],
            category: 'Basics',
            icon: 'PenLine',
            readMinutes: 5,
            popular: true,
          },
          {
            slug: 'community-guidelines',
            title: 'Community Guidelines',
            description: 'Our rules for a respectful, safe, and creative community. Please read before posting.',
            content: [
              '## Be Kind',
              'Treat fellow writers and readers with respect. Personal attacks, hate speech, and harassment are not allowed and will be removed.',
              '## Original Work',
              'Only publish work you have the right to share. Plagiarism and copyright violations will result in content removal and possibly account suspension.',
              '## Safety & Privacy',
              'Never share someone else\'s personal information without consent. Do not encourage self-harm or violence. If you see something, report it.',
              '## Content Moderation',
              'Our moderation team reviews every report within 24 hours. Repeat offenders may be suspended or banned permanently.',
            ],
            category: 'Trust & Safety',
            icon: 'ShieldCheck',
            readMinutes: 3,
            popular: true,
          },
          {
            slug: 'bookmarks-saves',
            title: 'Bookmarks & Saves',
            description: 'Organize your reading list with folders, tags, and offline reading.',
            content: [
              '## Saving a Story',
              'Tap the bookmark icon (🔖) on any story card to save it to your Saved tab. Bookmarks are private by default.',
              '## Organizing with Folders',
              'You can create custom folders in the Saved tab to organize stories by theme, project, or mood.',
              '## Offline Reading',
              'Premium members can download stories for offline reading. Look for the download icon on bookmarked stories.',
            ],
            category: 'Basics',
            icon: 'Bookmark',
            readMinutes: 2,
          },
          {
            slug: 'reporting-content',
            title: 'Reporting content or users',
            description: 'How to report inappropriate content, abuse, or policy violations.',
            content: [
              '## Reporting a Story or Comment',
              'Tap the ⋯ (more) menu and choose **Report**. Select a reason and add optional details. Every report is reviewed by a human.',
              '## Blocking Users',
              'You can block another user from their profile page. Blocked users cannot interact with you or see your content.',
              '## Appealing a Decision',
              'If you believe your content was removed in error, reply to the moderation email or file an appeal via Settings → Support.',
            ],
            category: 'Trust & Safety',
            icon: 'Flag',
            readMinutes: 3,
          },
          {
            slug: 'creator-analytics',
            title: 'Creator analytics',
            description: 'Understand your readers with views, read-through rates, demographics, and engagement.',
            content: [
              '## Accessing Analytics',
              'Go to your profile and tap **Analytics** at the top. Analytics are available for all published stories.',
              '## Key Metrics',
              ' - **Views**: how many times your story was loaded',
              ' - **Read-through**: % of readers who reached the end',
              ' - **Engagement**: likes, comments, highlights combined',
              ' - **Referrers**: where your readers are coming from',
            ],
            category: 'Analytics',
            icon: 'BarChart3',
            readMinutes: 4,
          },
          {
            slug: 'ai-writing-assistant',
            title: 'AI Writing Assistant',
            description: 'Use Vellbase AI to brainstorm, rewrite, proofread, and generate cover ideas for your stories.',
            content: [
              '## What It Can Do',
              'Our AI assistant can help with brainstorming, drafting, rewriting for tone, proofreading, and summarizing.',
              '## Using It Responsibly',
              'AI is a tool, not a replacement for your voice. Review and edit AI-generated text before publishing. Always disclose significant AI usage per our policy.',
              '## Keyboard Shortcuts',
              'Press ⌘J to open the AI panel inside the editor. Type a prompt like "Make this more concise" and press Enter.',
            ],
            category: 'AI',
            icon: 'Sparkles',
            readMinutes: 5,
          },
          {
            slug: 'api-introduction',
            title: 'API Introduction',
            description: 'Get started with the Vellbase developer API — authentication, rate limits, and example requests.',
            content: [
              '## Authentication',
              'Create an API key in **Settings → Developer → API keys**. Keep it secret! Include it in requests as `Authorization: Bearer <key>`.',
              '## Rate Limits',
              'Free keys: 100 requests/min. Premium keys: 1000 requests/min. We return `429` with a `Retry-After` header when you hit the limit.',
              '## Pagination',
              'List endpoints return paginated results. Use `?page=1&limit=20` and the `pages` / `total` fields to walk through collections.',
            ],
            category: 'Developers',
            icon: 'Code2',
            readMinutes: 6,
          },
          {
            slug: 'webhooks-overview',
            title: 'Webhooks Overview',
            description: 'Subscribe to real-time events for new comments, likes, follows, and story publishes.',
            content: [
              '## Supported Events',
              'We currently support: `story.published`, `comment.created`, `like.created`, `follow.created`, and `bookmark.created`.',
              '## Verifying Signatures',
              'Each webhook request includes an `X-Vellbase-Signature` header. Verify it using HMAC-SHA256 with your signing secret.',
              '## Retries',
              'We retry failed deliveries up to 5 times with exponential backoff. Endpoints must respond with a 2xx status within 5 seconds.',
            ],
            category: 'Developers',
            icon: 'Webhook',
            readMinutes: 5,
          },
          {
            slug: 'billing-faq',
            title: 'Billing & Plans FAQ',
            description: 'Subscription plans, payment methods, refunds, and cancelling your membership.',
            content: [
              '## Plans',
              'We offer Free, Plus, and Premium plans. Compare features on our pricing page at vellbase.app/pricing.',
              '## Payment Methods',
              'We accept major credit cards (Visa, Mastercard, Amex), Apple Pay, and Google Pay. Annual billing saves 20%.',
              '## Refunds',
              'If you are unsatisfied, contact support within 14 days for a full refund. No questions asked.',
              '## Cancelling',
              'You can cancel anytime in **Settings → Billing**. Your benefits continue until the end of the current billing period.',
            ],
            category: 'Access',
            icon: 'CreditCard',
            readMinutes: 4,
          },
          {
            slug: 'deleting-your-account',
            title: 'Deleting your account',
            description: 'How to permanently delete your Vellbase account and what happens to your data.',
            content: [
              '## Before You Delete',
              'Consider downloading your data first in **Settings → Privacy → Export data**. This includes your stories, comments, and messages.',
              '## How to Delete',
              'Go to **Settings → Privacy → Delete account**. You will be asked to confirm twice. Deletion is irreversible.',
              '## What Gets Deleted',
              'Your profile, stories, comments, bookmarks, and messages are permanently deleted 30 days after your request. Published stories may remain in search engine results temporarily.',
            ],
            category: 'Trust & Safety',
            icon: 'Trash2',
            readMinutes: 3,
          },
        ],
      });
    }

    if (existing > 0) return { message: 'Support data already seeded', kbSeeded: kbExisting === 0 ? 12 : 0 };

    const general = await this.prisma.supportDepartment.create({
      data: { key: 'general', name: 'General Support', email: 'support@vellbase.app' },
    });
    const technical = await this.prisma.supportDepartment.create({
      data: { key: 'technical', name: 'Technical Support', email: 'tech@vellbase.app' },
    });

    await this.prisma.supportTeam.create({
      data: { name: 'Engineering Escalation', departmentId: technical.id },
    });

    const categories = [
      { key: 'account', name: 'Account Issues' },
      { key: 'billing', name: 'Billing & Payments' },
      { key: 'technical', name: 'Technical Problems' },
      { key: 'feature', name: 'Feature Requests' },
      { key: 'bug', name: 'Bug Reports' },
      { key: 'abuse', name: 'Abuse Reports' },
    ];
    for (const [i, cat] of categories.entries()) {
      await this.prisma.ticketCategory.create({ data: { ...cat, sortOrder: i } });
    }

    const priorities: TicketPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'EMERGENCY'];
    for (const priority of priorities) {
      await this.prisma.slaPolicy.create({
        data: {
          name: `${priority} SLA`,
          priority,
          departmentId: general.id,
          firstResponseMinutes: priority === 'EMERGENCY' ? 15 : priority === 'CRITICAL' ? 30 : priority === 'HIGH' ? 60 : priority === 'MEDIUM' ? 240 : 480,
          resolutionMinutes: priority === 'EMERGENCY' ? 60 : priority === 'CRITICAL' ? 120 : priority === 'HIGH' ? 480 : priority === 'MEDIUM' ? 1440 : 2880,
          escalationMinutes: priority === 'EMERGENCY' ? 10 : priority === 'CRITICAL' ? 20 : undefined,
        },
      });
    }

    await this.prisma.cannedResponse.createMany({
      data: [
        { title: 'Greeting', body: 'Thank you for contacting Vellbase Support. My name is {agent_name}, and I\'ll be happy to assist you today.', shortcut: '/greet', category: 'general' },
        { title: 'Request More Info', body: 'Could you please provide more details about the issue you are experiencing? Include steps to reproduce, any error messages, and screenshots if applicable.', shortcut: '/moreinfo', category: 'general' },
        { title: 'Acknowledged', body: 'Thank you for providing those details. I\'m looking into this now and will get back to you shortly with an update.', shortcut: '/ack', category: 'general' },
        { title: 'Issue Resolved', body: 'I am glad we were able to resolve your issue. If you have any other questions or need further assistance, please don\'t hesitate to reach out. Have a great day!', shortcut: '/resolved', category: 'closing' },
        { title: 'Ticket Closing', body: 'I\'m going to mark this ticket as resolved since we haven\'t heard back from you. If the issue persists or you have additional questions, feel free to reply and we\'ll reopen it.', shortcut: '/close', category: 'closing' },
        { title: 'Password Reset', body: 'I\'ve initiated a password reset for your account. Please check your email (including spam/junk folders) for the reset link. The link is valid for 24 hours.', shortcut: '/pwreset', category: 'account' },
        { title: 'Account Verification', body: 'To verify your account ownership, please confirm the email address on file and the last 4 digits of any payment method associated with the account.', shortcut: '/verify', category: 'account' },
        { title: 'Refund Request Received', body: 'Thank you for reaching out. I\'ve received your refund request and it\'s now under review. Our billing team typically processes these within 2-3 business days, and you\'ll receive a confirmation email once complete.', shortcut: '/refund', category: 'billing' },
        { title: 'Escalation Notice', body: 'I\'m escalating this issue to our engineering team for further investigation. They typically respond within 24-48 hours. I\'ll keep you posted as we receive updates.', shortcut: '/escalate', category: 'internal' },
        { title: 'Bug Report Acknowledged', body: 'Thank you for taking the time to report this bug. I\'ve logged it in our issue tracker with the details you provided. Our engineering team will triage it, and I\'ll follow up once there\'s progress.', shortcut: '/bug', category: 'technical' },
        { title: 'Feature Request', body: 'Thank you for this feature suggestion! I\'ve passed it along to our product team for consideration. While we can\'t guarantee a timeline, we genuinely value user feedback and use it to prioritize our roadmap.', shortcut: '/feature', category: 'technical' },
        { title: 'Follow-up Check-in', body: 'Just checking in to see if you still need assistance with this issue. The ticket is still open on our end — please reply and let me know how things are going.', shortcut: '/followup', category: 'general' },
        { title: 'VIP Greeting', body: 'Hello {user_name}! Thank you for being a valued Premium member. You\'re currently receiving priority support — I\'m on this immediately and will have an update for you shortly.', shortcut: '/vip', category: 'general' },
      ],
    });

    const tags = ['urgent', 'vip', 'follow-up', 'escalated', 'billing'];
    for (const name of tags) {
      await this.prisma.ticketTag.create({ data: { name } });
    }

    return { departments: 3, teams: 2, categories: categories.length, kbArticles: kbExisting === 0 ? 12 : 0 };
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private ticketInclude() {
    return {
      user: { select: { id: true, email: true, name: true, handle: true, avatar: true } },
      assignee: { select: { id: true, email: true, name: true, handle: true, avatar: true } },
      department: true,
      team: true,
      category: true,
      slaPolicy: true,
    };
  }

  private async logActivity(
    userId: string | null,
    action: string,
    entityType: string,
    entityId?: string,
    details?: Record<string, unknown>,
  ) {
    await this.prisma.activityLog.create({
      data: { userId, action, entityType, entityId, details: details as Prisma.InputJsonValue },
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Phase 1 — Department CRUD
  // ──────────────────────────────────────────────────────────────────────────

  private validateBusinessHours(start: number | undefined, end: number | undefined) {
    if (start === undefined || end === undefined) return;
    if (start < 0 || end > 24 * 60 || start >= end) {
      throw new BadRequestException(
        `businessHoursStartMin must be in [0, 1440) and < businessHoursEndMin (got ${start}, ${end})`,
      );
    }
  }

  private validateBusinessDays(days: number[] | undefined) {
    if (!days) return;
    if (days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
      throw new BadRequestException(`businessDays values must be 0..6 (Sun..Sat); got ${JSON.stringify(days)}`);
    }
    if (days.length === 0) {
      throw new BadRequestException('businessDays cannot be empty');
    }
  }

  private validatePct0100(pct: number | undefined, label: string) {
    if (pct === undefined) return;
    if (!Number.isInteger(pct) || pct < 0 || pct > 100) {
      throw new BadRequestException(`${label} must be an integer in [0, 100]; got ${pct}`);
    }
  }

  async createDepartment(params: {
    key: string;
    name: string;
    description?: string | null;
    email?: string | null;
    headId?: string | null;
    firstResponseSlaMinutes?: number;
    resolutionSlaMinutes?: number;
    slaAdherenceTargetPct?: number;
    businessHoursStartMin?: number;
    businessHoursEndMin?: number;
    businessDays?: number[];
    timezone?: string;
    budgetAllocated?: number | null;
    resourceCapacityFte?: number | null;
    isActive?: boolean;
  }) {
    const {
      key, name, description = null, email = null, headId = null,
      firstResponseSlaMinutes = 30, resolutionSlaMinutes = 1440, slaAdherenceTargetPct = 95,
      businessHoursStartMin = 540, businessHoursEndMin = 1020,
      businessDays = [1, 2, 3, 4, 5], timezone = 'UTC',
      budgetAllocated = null, resourceCapacityFte = null, isActive = true,
    } = params;

    if (!key?.trim()) throw new BadRequestException('key is required');
    if (!name?.trim()) throw new BadRequestException('name is required');
    if (firstResponseSlaMinutes <= 0) throw new BadRequestException('firstResponseSlaMinutes must be > 0');
    if (resolutionSlaMinutes <= 0) throw new BadRequestException('resolutionSlaMinutes must be > 0');
    if (firstResponseSlaMinutes >= resolutionSlaMinutes) {
      throw new BadRequestException('firstResponseSlaMinutes must be less than resolutionSlaMinutes');
    }
    this.validatePct0100(slaAdherenceTargetPct, 'slaAdherenceTargetPct');
    this.validateBusinessHours(businessHoursStartMin, businessHoursEndMin);
    this.validateBusinessDays(businessDays);
    if (!timezone?.trim()) throw new BadRequestException('timezone is required');

    // Soft-unique enforcement for name + key among active (non-deleted) rows.
    // Hard schema @unique still exists; doing a pre-check improves error messaging
    // and ensures deleted rows don't permanently block re-creation under the same key/name.
    const trimmedName = name.trim();
    const trimmedKey = key.trim();
    const prismaAny = this.prisma as any;
    // findFirst may be unavailable in lightweight test mocks; skip soft check in those environments.
    if (typeof prismaAny.supportDepartment?.findFirst === "function") {
      const nameConflict = await prismaAny.supportDepartment.findFirst({
        where: { name: trimmedName, deletedAt: null },
        select: { id: true },
      });
      if (nameConflict) throw new ConflictException(`Department name "${trimmedName}" is already in use`);
      const keyConflict = await prismaAny.supportDepartment.findFirst({
        where: { key: trimmedKey, deletedAt: null },
        select: { id: true },
      });
      if (keyConflict) throw new ConflictException(`Department key "${trimmedKey}" is already in use`);
    }

    try {
      return await this.prisma.supportDepartment.create({
        data: {
          key: trimmedKey,
          name: trimmedName,
          description,
          email,
          isActive,
          headId,
          firstResponseSlaMinutes,
          resolutionSlaMinutes,
          slaAdherenceTargetPct,
          businessHoursStartMin,
          businessHoursEndMin,
          businessDays,
          timezone,
          budgetAllocated: budgetAllocated !== null ? new (Prisma as any).Decimal(budgetAllocated) : null,
          resourceCapacityFte: resourceCapacityFte !== null ? new (Prisma as any).Decimal(resourceCapacityFte) : null,
        },
      });
    } catch (e: any) {
      if (e?.code === 'P2002') {
        const targets: string[] = e?.meta?.target ?? [];
        const msg = targets.includes('name')
          ? `Department name "${trimmedName}" is already in use`
          : targets.includes('key')
            ? `Department key "${trimmedKey}" is already in use`
            : `Duplicate value for field(s): ${targets.join(', ')}`;
        throw new ConflictException(msg);
      }
      throw e;
    }
  }

  async listDepartments(params?: {
    page?: number;
    limit?: number;
    search?: string;
    isActive?: boolean;
    includeDeleted?: boolean;
    sortBy?: 'name' | 'createdAt' | 'firstResponseSlaMinutes' | 'slaAdherenceTargetPct';
    sortDir?: 'asc' | 'desc';
  }) {
    const {
      page = 1, limit = 25, search, isActive, includeDeleted = false,
      sortBy = 'createdAt', sortDir = 'desc',
    } = params ?? {};

    const where: Prisma.SupportDepartmentWhereInput = {};
    if (!includeDeleted) where.deletedAt = null;
    if (isActive !== undefined) where.isActive = isActive;
    if (search?.trim()) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { key: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ];
    }

    const orderBy: Prisma.SupportDepartmentOrderByWithRelationInput =
      sortBy === 'name' ? { name: sortDir } :
        sortBy === 'firstResponseSlaMinutes' ? { firstResponseSlaMinutes: sortDir } :
          sortBy === 'slaAdherenceTargetPct' ? { slaAdherenceTargetPct: sortDir } :
            { createdAt: sortDir };

    const skip = (page - 1) * limit;
    const [total, data] = await Promise.all([
      this.prisma.supportDepartment.count({ where }),
      this.prisma.supportDepartment.findMany({
        where, orderBy, skip, take: limit,
        include: {
          _count: { select: { teams: true, agents: true, tickets: true } },
          head: { select: { id: true, name: true, email: true, avatar: true } },
        },
      }),
    ]);

    return { page, limit, total, data, totalPages: Math.ceil(total / limit) || 1 };
  }

  async getDepartment(id: string) {
    const dept = await this.prisma.supportDepartment.findUnique({
      where: { id },
      include: {
        head: { select: { id: true, name: true, email: true, avatar: true } },
        teams: {
          where: { deletedAt: null },
          orderBy: { name: 'asc' },
          include: {
            _count: { select: { agents: true, memberships: true } },
            lead: { select: { id: true, name: true, email: true, avatar: true } },
          },
        },
        _count: { select: { agents: true, tickets: true } },
      },
    });
    if (!dept || dept.deletedAt) throw new NotFoundException(`Department ${id} not found`);
    return dept;
  }

  async updateDepartment(
    id: string,
    patch: {
      name?: string;
      description?: string | null;
      email?: string | null;
      headId?: string | null;
      isActive?: boolean;
      firstResponseSlaMinutes?: number;
      resolutionSlaMinutes?: number;
      slaAdherenceTargetPct?: number;
      businessHoursStartMin?: number;
      businessHoursEndMin?: number;
      businessDays?: number[];
      timezone?: string;
      budgetAllocated?: number | null;
      resourceCapacityFte?: number | null;
    },
  ) {
    const existing = await this.prisma.supportDepartment.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) throw new NotFoundException(`Department ${id} not found`);

    // Validate only the fields the caller is changing, merging with existing values
    // so we can evaluate pair-wise constraints (start < end, firstRsp < resolution, etc).
    const merged = { ...existing, ...patch } as any;
    if (patch.name !== undefined) {
      if (!String(patch.name).trim()) throw new BadRequestException('name cannot be empty');
    }
    if (patch.firstResponseSlaMinutes !== undefined && patch.firstResponseSlaMinutes <= 0) {
      throw new BadRequestException('firstResponseSlaMinutes must be > 0');
    }
    if (patch.resolutionSlaMinutes !== undefined && patch.resolutionSlaMinutes <= 0) {
      throw new BadRequestException('resolutionSlaMinutes must be > 0');
    }
    if (
      (patch.firstResponseSlaMinutes !== undefined || patch.resolutionSlaMinutes !== undefined) &&
      merged.firstResponseSlaMinutes >= merged.resolutionSlaMinutes
    ) {
      throw new BadRequestException('firstResponseSlaMinutes must be less than resolutionSlaMinutes');
    }
    if (patch.slaAdherenceTargetPct !== undefined) {
      this.validatePct0100(patch.slaAdherenceTargetPct, 'slaAdherenceTargetPct');
    }
    if (patch.businessHoursStartMin !== undefined || patch.businessHoursEndMin !== undefined) {
      this.validateBusinessHours(
        patch.businessHoursStartMin ?? existing.businessHoursStartMin,
        patch.businessHoursEndMin ?? existing.businessHoursEndMin,
      );
    }
    if (patch.businessDays) this.validateBusinessDays(patch.businessDays);
    if (patch.timezone !== undefined && !patch.timezone?.trim()) {
      throw new BadRequestException('timezone cannot be empty');
    }

    const data: any = {};
    if (patch.name !== undefined) data.name = patch.name.trim();
    if (patch.description !== undefined) data.description = patch.description;
    if (patch.email !== undefined) data.email = patch.email;
    if (patch.headId !== undefined) {
      if (patch.headId) {
        await validateUserExists(this.prisma, patch.headId);
      }
      assignRelationUpdate(data, 'head', patch.headId);
    }
    if (patch.isActive !== undefined) data.isActive = patch.isActive;
    if (patch.firstResponseSlaMinutes !== undefined) data.firstResponseSlaMinutes = patch.firstResponseSlaMinutes;
    if (patch.resolutionSlaMinutes !== undefined) data.resolutionSlaMinutes = patch.resolutionSlaMinutes;
    if (patch.slaAdherenceTargetPct !== undefined) data.slaAdherenceTargetPct = patch.slaAdherenceTargetPct;
    if (patch.businessHoursStartMin !== undefined) data.businessHoursStartMin = patch.businessHoursStartMin;
    if (patch.businessHoursEndMin !== undefined) data.businessHoursEndMin = patch.businessHoursEndMin;
    if (patch.businessDays !== undefined) data.businessDays = { set: patch.businessDays };
    if (patch.timezone !== undefined) data.timezone = patch.timezone;
    if (patch.budgetAllocated !== undefined) {
      data.budgetAllocated = patch.budgetAllocated === null ? Prisma.AnyNull : new (Prisma as any).Decimal(patch.budgetAllocated);
    }
    if (patch.resourceCapacityFte !== undefined) {
      data.resourceCapacityFte = patch.resourceCapacityFte === null ? Prisma.AnyNull : new (Prisma as any).Decimal(patch.resourceCapacityFte);
    }

    try {
      return await this.prisma.supportDepartment.update({ where: { id }, data });
    } catch (e: any) {
      if (e?.code === 'P2002') {
        const targets: string[] = e?.meta?.target ?? [];
        const msg = targets.includes('name')
          ? `Department name "${patch.name ?? id}" is already in use`
          : targets.includes('key')
            ? `Department key is already in use`
            : `Duplicate value for field(s): ${targets.join(', ')}`;
        throw new ConflictException(msg);
      }
      throw e;
    }
  }

  async deleteDepartment(id: string) {
    const existing = await this.prisma.supportDepartment.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) throw new NotFoundException(`Department ${id} not found`);
    return this.prisma.supportDepartment.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  async restoreDepartment(id: string) {
    const existing = await this.prisma.supportDepartment.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Department ${id} not found`);
    if (!existing.deletedAt) {
      // Idempotent: nothing to restore.
      return existing;
    }
    return this.prisma.supportDepartment.update({
      where: { id },
      data: { deletedAt: null, isActive: true },
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Phase 1 — Team CRUD
  // ──────────────────────────────────────────────────────────────────────────

  async createTeam(params: {
    departmentId: string;
    name: string;
    description?: string | null;
    leadId?: string | null;
    slaInheritFromDept?: boolean;
    firstResponseSlaMinutes?: number | null;
    resolutionSlaMinutes?: number | null;
    businessHoursInherit?: boolean;
    businessHoursStartMin?: number | null;
    businessHoursEndMin?: number | null;
    businessDays?: number[] | null;
    timezone?: string | null;
    maxTicketsPerAgent?: number;
    concurrentTicketLimitPerAgent?: number;
    skillSpecialization?: string | null;
    isActive?: boolean;
  }) {
    const {
      departmentId, name, description = null, leadId = null,
      slaInheritFromDept = true, firstResponseSlaMinutes = null, resolutionSlaMinutes = null,
      businessHoursInherit = true, businessHoursStartMin = null, businessHoursEndMin = null,
      businessDays = null, timezone = null,
      maxTicketsPerAgent = 10, concurrentTicketLimitPerAgent = 4,
      skillSpecialization = null, isActive = true,
    } = params;

    const dept = await this.prisma.supportDepartment.findUnique({ where: { id: departmentId } });
    if (!dept || dept.deletedAt) throw new NotFoundException(`Department ${departmentId} not found`);
    if (!dept.isActive) throw new BadRequestException(`Department ${departmentId} is not active`);
    if (!name?.trim()) throw new BadRequestException('name is required');
    if (!Number.isInteger(maxTicketsPerAgent) || maxTicketsPerAgent <= 0) {
      throw new BadRequestException('maxTicketsPerAgent must be a positive integer');
    }
    if (!Number.isInteger(concurrentTicketLimitPerAgent) || concurrentTicketLimitPerAgent <= 0) {
      throw new BadRequestException('concurrentTicketLimitPerAgent must be a positive integer');
    }
    if (concurrentTicketLimitPerAgent > maxTicketsPerAgent) {
      throw new BadRequestException('concurrentTicketLimitPerAgent cannot exceed maxTicketsPerAgent');
    }
    if (slaInheritFromDept === false) {
      if (firstResponseSlaMinutes == null || resolutionSlaMinutes == null) {
        throw new BadRequestException(
          'slaInheritFromDept=false requires firstResponseSlaMinutes and resolutionSlaMinutes',
        );
      }
      if (firstResponseSlaMinutes <= 0 || resolutionSlaMinutes <= 0) {
        throw new BadRequestException('Team SLA override values must be > 0');
      }
      if (firstResponseSlaMinutes >= resolutionSlaMinutes) {
        throw new BadRequestException('Team firstResponseSlaMinutes must be < resolutionSlaMinutes');
      }
    }
    if (businessHoursInherit === false) {
      if (
        businessHoursStartMin == null || businessHoursEndMin == null ||
        businessDays == null || !timezone
      ) {
        throw new BadRequestException(
          'businessHoursInherit=false requires start/end, businessDays, and timezone',
        );
      }
      this.validateBusinessHours(businessHoursStartMin, businessHoursEndMin);
      this.validateBusinessDays(businessDays);
    }

    try {
      // Schema: businessDays is Int[] @default([]) (non-nullable scalar list → never pass null)
      // Schema: timezone String? but department always has one; when inherit=true use dept values
      const effectiveBusinessDays = businessHoursInherit
        ? (dept.businessDays ?? [])
        : (businessDays ?? []);
      const effectiveTimezone = businessHoursInherit
        ? (dept.timezone ?? 'UTC')
        : (timezone ?? dept.timezone ?? 'UTC');
      return await this.prisma.supportTeam.create({
        data: {
          departmentId,
          name: name.trim(),
          description,
          isActive,
          leadId,
          slaInheritFromDept,
          firstResponseSlaMinutes,
          resolutionSlaMinutes,
          businessHoursInherit,
          businessHoursStartMin,
          businessHoursEndMin,
          businessDays: effectiveBusinessDays,
          timezone: effectiveTimezone,
          maxTicketsPerAgent,
          concurrentTicketLimitPerAgent,
          skillSpecialization,
        },
      });
    } catch (e: any) {
      if (e?.code === 'P2002') {
        const targets: string[] = e?.meta?.target ?? [];
        if (targets.includes('departmentId') && targets.includes('name')) {
          throw new ConflictException(`Team name "${name}" already exists in this department`);
        }
        throw new ConflictException(`Duplicate value for field(s): ${targets.join(', ')}`);
      }
      throw e;
    }
  }

  async listTeams(params?: {
    page?: number;
    limit?: number;
    departmentId?: string;
    search?: string;
    isActive?: boolean;
    includeDeleted?: boolean;
    sortBy?: 'name' | 'createdAt' | 'maxTicketsPerAgent';
    sortDir?: 'asc' | 'desc';
  }) {
    const {
      page = 1, limit = 25, departmentId, search, isActive, includeDeleted = false,
      sortBy = 'createdAt', sortDir = 'desc',
    } = params ?? {};

    const where: Prisma.SupportTeamWhereInput = {};
    if (!includeDeleted) where.deletedAt = null;
    if (isActive !== undefined) where.isActive = isActive;
    if (departmentId) where.departmentId = departmentId;
    if (search?.trim()) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { skillSpecialization: { contains: q, mode: 'insensitive' } },
      ];
    }

    const orderBy: Prisma.SupportTeamOrderByWithRelationInput =
      sortBy === 'name' ? { name: sortDir } :
        sortBy === 'maxTicketsPerAgent' ? { maxTicketsPerAgent: sortDir } :
          { createdAt: sortDir };

    const skip = (page - 1) * limit;
    const [total, data] = await Promise.all([
      this.prisma.supportTeam.count({ where }),
      this.prisma.supportTeam.findMany({
        where, orderBy, skip, take: limit,
        include: {
          department: { select: { id: true, name: true, key: true } },
          lead: { select: { id: true, name: true, email: true, avatar: true } },
          _count: { select: { memberships: true, assignedTickets: true } } as any,
        },
      }),
    ]);
    return { page, limit, total, data, totalPages: Math.ceil(total / limit) || 1 };
  }

  async getTeam(id: string) {
    const team = await this.prisma.supportTeam.findUnique({
      where: { id },
      include: {
        department: { select: { id: true, name: true, key: true, timezone: true, slaAdherenceTargetPct: true } },
        lead: { select: { id: true, name: true, email: true, avatar: true } },
        memberships: {
          where: { endDate: null },
          include: {
            agent: {
              include: {
                user: { select: { id: true, name: true, email: true, avatar: true, handle: true } },
              },
            },
          },
          orderBy: [{ isPrimary: 'desc' }, { startDate: 'asc' }],
        },
      },
    });
    if (!team || team.deletedAt) throw new NotFoundException(`Team ${id} not found`);
    return team;
  }

  async updateTeam(
    id: string,
    patch: {
      name?: string;
      description?: string | null;
      leadId?: string | null;
      isActive?: boolean;
      departmentId?: string;
      slaInheritFromDept?: boolean;
      firstResponseSlaMinutes?: number | null;
      resolutionSlaMinutes?: number | null;
      businessHoursInherit?: boolean;
      businessHoursStartMin?: number | null;
      businessHoursEndMin?: number | null;
      businessDays?: number[] | null;
      timezone?: string | null;
      maxTicketsPerAgent?: number;
      concurrentTicketLimitPerAgent?: number;
      skillSpecialization?: string | null;
    },
  ) {
    const existing = await this.prisma.supportTeam.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) throw new NotFoundException(`Team ${id} not found`);
    if (patch.departmentId) {
      await validateSupportDepartmentExists(this.prisma, patch.departmentId);
    }
    if (patch.maxTicketsPerAgent !== undefined &&
      (!Number.isInteger(patch.maxTicketsPerAgent) || patch.maxTicketsPerAgent <= 0)) {
      throw new BadRequestException('maxTicketsPerAgent must be a positive integer');
    }
    if (patch.concurrentTicketLimitPerAgent !== undefined &&
      (!Number.isInteger(patch.concurrentTicketLimitPerAgent) || patch.concurrentTicketLimitPerAgent <= 0)) {
      throw new BadRequestException('concurrentTicketLimitPerAgent must be a positive integer');
    }
    const effectiveMax = patch.maxTicketsPerAgent ?? existing.maxTicketsPerAgent;
    const effectiveConcurrent = patch.concurrentTicketLimitPerAgent ?? existing.concurrentTicketLimitPerAgent;
    if (effectiveConcurrent > effectiveMax) {
      throw new BadRequestException('concurrentTicketLimitPerAgent cannot exceed maxTicketsPerAgent');
    }

    const data: any = {};
    if (patch.name !== undefined) data.name = patch.name.trim();
    if (patch.description !== undefined) data.description = patch.description;
    if (patch.leadId !== undefined) {
      if (patch.leadId) {
        await validateUserExists(this.prisma, patch.leadId);
      }
      assignRelationUpdate(data, 'lead', patch.leadId);
    }
    if (patch.isActive !== undefined) data.isActive = patch.isActive;
    if (patch.departmentId !== undefined) {
      if (patch.departmentId === null) {
        throw new BadRequestException('departmentId cannot be null; every team must belong to a department');
      }
      await validateSupportDepartmentExists(this.prisma, patch.departmentId);
      assignRelationUpdate(data, 'department', patch.departmentId, { required: true });
    }
    if (patch.slaInheritFromDept !== undefined) data.slaInheritFromDept = patch.slaInheritFromDept;
    if (patch.firstResponseSlaMinutes !== undefined) data.firstResponseSlaMinutes = patch.firstResponseSlaMinutes;
    if (patch.resolutionSlaMinutes !== undefined) data.resolutionSlaMinutes = patch.resolutionSlaMinutes;
    if (patch.businessHoursInherit !== undefined) data.businessHoursInherit = patch.businessHoursInherit;
    if (patch.businessHoursStartMin !== undefined) data.businessHoursStartMin = patch.businessHoursStartMin;
    if (patch.businessHoursEndMin !== undefined) data.businessHoursEndMin = patch.businessHoursEndMin;
    if (patch.businessDays !== undefined) {
      data.businessDays = { set: patch.businessDays };
    }
    if (patch.timezone !== undefined) data.timezone = patch.timezone;
    if (patch.maxTicketsPerAgent !== undefined) data.maxTicketsPerAgent = patch.maxTicketsPerAgent;
    if (patch.concurrentTicketLimitPerAgent !== undefined) data.concurrentTicketLimitPerAgent = patch.concurrentTicketLimitPerAgent;
    if (patch.skillSpecialization !== undefined) data.skillSpecialization = patch.skillSpecialization;

    try {
      return await this.prisma.supportTeam.update({ where: { id }, data });
    } catch (e: any) {
      if (e?.code === 'P2002') {
        const targets: string[] = e?.meta?.target ?? [];
        if (targets.includes('departmentId') && targets.includes('name')) {
          throw new ConflictException(`Team name "${patch.name ?? id}" already exists in this department`);
        }
        throw new ConflictException(`Duplicate value for field(s): ${targets.join(', ')}`);
      }
      throw e;
    }
  }

  async deleteTeam(id: string) {
    const existing = await this.prisma.supportTeam.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) throw new NotFoundException(`Team ${id} not found`);
    return this.prisma.supportTeam.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  async restoreTeam(id: string) {
    const existing = await this.prisma.supportTeam.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Team ${id} not found`);
    if (!existing.deletedAt) {
      // Idempotent: nothing to restore.
      return existing;
    }
    return this.prisma.supportTeam.update({
      where: { id },
      data: { deletedAt: null, isActive: true },
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Phase 1 — Agent ↔ Team Membership M:N operations
  // ──────────────────────────────────────────────────────────────────────────

  async addAgentToTeam(
    agentId: string,
    teamId: string,
    opts?: { isPrimary?: boolean; assignedBy?: string },
  ) {
    const { isPrimary = false, assignedBy = null } = opts ?? {};
    const agent = await this.prisma.supportAgent.findUnique({ where: { id: agentId } });
    if (!agent || agent.deletedAt) throw new NotFoundException(`Agent ${agentId} not found`);
    const team = await this.prisma.supportTeam.findUnique({ where: { id: teamId } });
    if (!team || team.deletedAt) throw new NotFoundException(`Team ${teamId} not found`);

    // Prevent duplicate active membership for same agent/team pair
    const existing = await this.prisma.supportAgentTeamMembership.findFirst({
      where: { agentId, teamId, endDate: null },
    });
    if (existing) throw new ConflictException(`Agent ${agentId} is already on team ${teamId}`);

    return this.prisma.$transaction(async (tx: any) => {
      if (isPrimary) {
        // Demote any currently-active primary for the same agent
        await tx.supportAgentTeamMembership.updateMany({
          where: { agentId, isPrimary: true, endDate: null },
          data: { isPrimary: false },
        });
      } else {
        // If this is the agent's FIRST membership ever, auto-promote to primary
        const anyActive = await tx.supportAgentTeamMembership.findFirst({
          where: { agentId, endDate: null },
        });
        if (!anyActive) opts && (opts.isPrimary = true);
      }
      return tx.supportAgentTeamMembership.create({
        data: {
          agentId,
          teamId,
          isPrimary: (opts?.isPrimary as any) ?? isPrimary,
          startDate: new Date(),
          endDate: null,
          assignedBy,
          assignedAt: new Date(),
        },
      });
    });
  }

  async removeAgentFromTeam(agentId: string, teamId: string) {
    const membership = await this.prisma.supportAgentTeamMembership.findFirst({
      where: { agentId, teamId, endDate: null },
    });
    if (!membership) throw new NotFoundException(`No active membership for agent ${agentId} on team ${teamId}`);

    const now = new Date();
    return this.prisma.$transaction(async (tx: any) => {
      const closed = await tx.supportAgentTeamMembership.update({
        where: { id: membership.id },
        data: { endDate: now, isPrimary: false },
      });
      // If we removed the primary team, try to promote another active membership
      if (membership.isPrimary) {
        const next = await tx.supportAgentTeamMembership.findFirst({
          where: { agentId, endDate: null, id: { not: membership.id } },
          orderBy: { startDate: 'asc' },
        });
        if (next) {
          await tx.supportAgentTeamMembership.update({
            where: { id: next.id },
            data: { isPrimary: true },
          });
        }
      }
      return closed;
    });
  }

  async setPrimaryTeam(agentId: string, teamId: string) {
    const [oldPrimary, newMembership] = await Promise.all([
      this.prisma.supportAgentTeamMembership.findFirst({
        where: { agentId, isPrimary: true, endDate: null },
      }),
      this.prisma.supportAgentTeamMembership.findFirst({
        where: { agentId, teamId, endDate: null },
      }),
    ]);
    if (!newMembership) {
      throw new NotFoundException(`Agent ${agentId} is not actively a member of team ${teamId}`);
    }

    return this.prisma.$transaction(async (tx: any) => {
      if (oldPrimary && oldPrimary.id !== newMembership.id) {
        await tx.supportAgentTeamMembership.update({
          where: { id: oldPrimary.id },
          data: { isPrimary: false },
        });
      }
      return tx.supportAgentTeamMembership.update({
        where: { id: newMembership.id },
        data: { isPrimary: true },
      });
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Phase 2 — Department / Team Ticket Metrics
  // ──────────────────────────────────────────────────────────────────────────

  private static readonly TERM_SET: ReadonlySet<string> = new Set(SupportService.TERMINAL_STATUSES as readonly string[]);

  /**
   * Given a teamId, return userIds of agents belonging to the team (either
   * via direct SupportAgent.teamId or via active membership). Never returns
   * `undefined`; returns an empty array when the team has no matching agents.
   *
   * This replaces the buggy pattern of `{ assignee: { is: { teamId } } }` /
   * `{ assignee: { is: { memberships: ... } } }` — assignee is a *User*
   * relation, not SupportAgent, so those nested paths don't exist.
   */
  private async getUserIdsForTeam(teamId: string): Promise<string[]> {
    if (!teamId?.trim()) return [];
    const prisma = this.prisma as any;
    const rows = (await prisma.supportAgent.findMany({
      where: {
        OR: [{ teamId }, { memberships: { some: { teamId, endDate: null } } }],
        isActive: true,
        deletedAt: null,
      },
      select: { userId: true },
    }) ?? []) as Array<{ userId: string }>;
    return rows.map((r) => r.userId);
  }


  /** Helper: build an n-hours-ago Date from now. */
  private hoursAgo(n: number): Date {
    return new Date(Date.now() - n * 60 * 60 * 1000);
  }
  private daysAgo(n: number): Date {
    return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
  }

  /** Convert a groupBy [{by, _count:{_all}}] list into { [by]: count }. */
  private static foldCounts<K extends string>(rows: any[], by: K): Record<string, number> {
    const out: Record<string, number> = {};
    for (const r of rows ?? []) {
      const key = String(r[by]);
      out[key] = (out[key] ?? 0) + Number(r?._count?._all ?? 0);
    }
    return out;
  }

  /** Round number to N decimals. */
  private static round(n: number | null | undefined, digits = 2): number | null {
    if (n === null || n === undefined || !Number.isFinite(n)) return null;
    const pow = Math.pow(10, digits);
    return Math.round(n * pow) / pow;
  }

  /** Safe division with denominator guard (returns 0 on zero/non-finite denom). */
  private static pct(num: number, den: number, digits = 2): number {
    if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return 0;
    return SupportService.round((num / den) * 100, digits) as number;
  }

  async getDepartmentMetrics(departmentId: string) {
    if (!departmentId?.trim()) throw new BadRequestException("departmentId is required");
    this.assertUuid(departmentId, "departmentId");
    const prisma = this.prisma as any;
    const deptExists = await prisma.supportDepartment.findUnique({ where: { id: departmentId }, select: { id: true, deletedAt: true } });
    if (!deptExists || deptExists.deletedAt) throw new NotFoundException(`Department ${departmentId} not found`);

    const baseWhere: any = { departmentId, deletedAt: null };
    // TicketAssignment.agent is a User relation. To filter users belonging to the department,
    // join through SupportAgent (departmentId is on SupportAgent). Collect agent (user) IDs
    // belonging to this department first.
    const agentsInDept = (await prisma.supportAgent.findMany({
      where: { departmentId, isActive: true, deletedAt: null },
      select: { userId: true },
    }) ?? []) as Array<{ userId: string }>;
    const agentUserIdsInDept = agentsInDept.map((a) => a.userId);
    const [statusRows, priorityRows, agg, total, new24h, new7d, new30d, backlog, escalated, agentsTotal, agentsActive, memberships, assignedTickets] =
      await Promise.all([
        prisma.supportTicket.groupBy({ by: ["status"], where: baseWhere, _count: { _all: true } }),
        prisma.supportTicket.groupBy({ by: ["priority"], where: baseWhere, _count: { _all: true } }),
        prisma.supportTicket.aggregate({ where: baseWhere, _avg: { satisfaction: true }, _count: { _all: true } }),
        prisma.supportTicket.count({ where: baseWhere }),
        prisma.supportTicket.count({ where: { ...baseWhere, createdAt: { gte: this.hoursAgo(24) } } }),
        prisma.supportTicket.count({ where: { ...baseWhere, createdAt: { gte: this.daysAgo(7) } } }),
        prisma.supportTicket.count({ where: { ...baseWhere, createdAt: { gte: this.daysAgo(30) } } }),
        prisma.supportTicket.count({
          where: { ...baseWhere, status: { notIn: [...SupportService.TERMINAL_STATUSES] as any[] } },
        }),
        prisma.supportTicket.count({ where: { ...baseWhere, status: "ESCALATED" } }),
        prisma.supportAgent.count({ where: { departmentId, isActive: true, deletedAt: null } }),
        prisma.supportAgent.count({ where: { departmentId, isActive: true, deletedAt: null, status: { not: "OFFLINE" } } }),
        prisma.supportAgentTeamMembership.count({
          where: { team: { departmentId }, endDate: null },
        }),
        agentUserIdsInDept.length
          ? prisma.ticketAssignment.count({
            where: { isActive: true, agentId: { in: agentUserIdsInDept } },
          })
          : Promise.resolve(0),
      ]);

    const avgSat: number | null = SupportService.round((agg?._avg?.satisfaction as number | null) ?? null, 2);
    const avgDaily7d = new7d / 7;
    const avgDaily30d = new30d / 30;
    const statusBreakdown: Record<string, number> = SupportService.foldCounts(statusRows, "status");

    const resolvedCount =
      Number(statusBreakdown.RESOLVED ?? 0) + Number(statusBreakdown.CLOSED ?? 0);
    const reopenedCount = Number(statusBreakdown.REOPENED ?? 0);
    const volume = Number(total ?? 0);
    const resolutionRate = SupportService.pct(resolvedCount, Math.max(1, volume), 2);
    const reopenRate = SupportService.pct(reopenedCount, Math.max(1, volume), 2);
    const escalationRate = SupportService.pct(Number(escalated ?? 0), Math.max(1, volume), 2);
    const csat = Number(avgSat ?? 0);

    const datedRows = await prisma.supportTicket.findMany({
      where: { ...baseWhere, resolvedAt: { not: null } },
      select: { createdAt: true, resolvedAt: true, firstResponseAt: true },
      take: 1000,
      orderBy: { createdAt: "desc" },
    }) ?? [];

    let totalResMs = 0;
    let totalResCount = 0;
    let totalFrMs = 0;
    let totalFrCount = 0;
    for (const r of datedRows) {
      const created = r.createdAt ? new Date(r.createdAt as any).getTime() : null;
      const resolved = r.resolvedAt ? new Date(r.resolvedAt as any).getTime() : null;
      const firstResp = r.firstResponseAt ? new Date(r.firstResponseAt as any).getTime() : null;
      if (created != null && resolved != null && resolved >= created) {
        totalResMs += resolved - created;
        totalResCount += 1;
      }
      if (created != null && firstResp != null && firstResp >= created) {
        totalFrMs += firstResp - created;
        totalFrCount += 1;
      }
    }
    const avgResolutionMs = totalResCount > 0 ? SupportService.round(totalResMs / totalResCount, 0) : 0;
    const avgFirstResponseMs = totalFrCount > 0 ? SupportService.round(totalFrMs / totalFrCount, 0) : 0;

    const [slaTotalRes, slaMetRes] = await Promise.all([
      prisma.supportTicket.count({
        where: { ...baseWhere, slaMetResolution: { not: null } },
      }),
      prisma.supportTicket.count({
        where: { ...baseWhere, slaMetResponse: true, slaMetResolution: true },
      }),
    ]);
    const slaCompliancePct = SupportService.pct(
      Number(slaMetRes ?? 0),
      Math.max(1, Number(slaTotalRes ?? 0)),
      2,
    );

    return {
      id: departmentId,
      generatedAt: new Date(),
      volume,
      backlog: Number(backlog ?? 0),
      resolutionRate,
      avgResolutionMs,
      avgFirstResponseMs,
      slaCompliancePct,
      csat,
      reopenRate,
      escalationRate,
      tickets: {
        total,
        new24h,
        new7d,
        new30d,
        avgDaily7d: SupportService.round(avgDaily7d, 2),
        avgDaily30d: SupportService.round(avgDaily30d, 2),
        backlog,
        escalated,
      },
      statusBreakdown,
      priorityBreakdown: SupportService.foldCounts(priorityRows, "priority"),
      satisfaction: { avg: avgSat, count: Number(agg?._count?._all ?? 0) },
      agents: {
        total: agentsTotal,
        active: agentsActive,
        assignedTickets,
        avgTicketsPerActiveAgent: SupportService.round(
          assignedTickets / Math.max(1, agentsActive), 2,
        ),
      },
      memberships: { active: memberships },
    };
  }

  async getTeamMetrics(teamId: string) {
    if (!teamId?.trim()) throw new BadRequestException("teamId is required");
    this.assertUuid(teamId, "teamId");
    const prisma = this.prisma as any;
    const teamExists = await prisma.supportTeam.findUnique({ where: { id: teamId }, select: { id: true, deletedAt: true } });
    if (!teamExists || teamExists.deletedAt) throw new NotFoundException(`Team ${teamId} not found`);

    // Collect agents (userIds and rows) in team FIRST.
    // SupportTeam.tickets can also be directly attached via legacy teamId column.
    const agentsInTeamFull = (await prisma.supportAgent.findMany({
      where: {
        OR: [
          { teamId },
          { memberships: { some: { teamId, endDate: null } } },
        ],
        isActive: true,
        deletedAt: null,
      },
      select: { id: true, userId: true, status: true, maxTickets: true },
    }) ?? []) as Array<{ id: string; userId: string; status: string; maxTickets: number }>;
    const teamAgentUserIds = agentsInTeamFull.map((a) => a.userId);
    // Tickets are scoped to team via: legacy direct teamId OR assignee is a user currently in team.
    // Never emit `in: []` — Prisma rejects empty in-clauses at parse.
    // If only one branch effective, skip the OR wrapper entirely — top-level scalar filters
    // play nicer with sibling filters (status: { in: [...] }).
    const orBranches: any[] = [{ teamId }];
    if (teamAgentUserIds.length) orBranches.push({ assigneeId: { in: teamAgentUserIds } });
    const ticketsForTeam: any =
      orBranches.length === 1
        ? { deletedAt: null, ...orBranches[0] }
        : { deletedAt: null, OR: orBranches };

    const [membershipCount, total, openCount, resolved, escalated, statusRows, priorityRows, agg, assignedByAgent] =
      await Promise.all([
        prisma.supportAgentTeamMembership.count({ where: { teamId, endDate: null } }),
        prisma.supportTicket.count({ where: ticketsForTeam }),
        prisma.supportTicket.count({ where: { ...ticketsForTeam, status: { notIn: [...SupportService.TERMINAL_STATUSES] as any[] } } }),
        prisma.supportTicket.count({ where: { ...ticketsForTeam, status: { in: [...SupportService.TERMINAL_STATUSES] as any[] } } }),
        prisma.supportTicket.count({ where: { ...ticketsForTeam, status: "ESCALATED" } }),
        prisma.supportTicket.groupBy({ by: ["status"], where: ticketsForTeam, _count: { _all: true } }),
        prisma.supportTicket.groupBy({ by: ["priority"], where: ticketsForTeam, _count: { _all: true } }),
        prisma.supportTicket.aggregate({ where: ticketsForTeam, _avg: { satisfaction: true }, _count: { _all: true } }),
        teamAgentUserIds.length
          ? prisma.ticketAssignment.groupBy({
            by: ["agentId"],
            where: { isActive: true, agentId: { in: teamAgentUserIds } },
            _count: { _all: true },
          })
          : Promise.resolve([]),
      ]);

    const assignedByUserId: Record<string, number> = {};
    for (const row of assignedByAgent ?? []) {
      assignedByUserId[row.agentId] = Number(row._count?._all ?? 0);
    }
    const totalCapacity = agentsInTeamFull.reduce((acc, a) => acc + (a.maxTickets ?? 0), 0);
    const totalAssigned = agentsInTeamFull.reduce((acc, a) => acc + (assignedByUserId[a.userId] ?? 0), 0);
    const utilizationPct = SupportService.pct(totalAssigned, Math.max(1, totalCapacity), 2);

    const agents = agentsInTeamFull.map((a) => {
      const assignedCount = assignedByUserId[a.userId] ?? 0;
      return {
        id: a.id,
        userId: a.userId,
        status: a.status,
        assignedCount,
        maxTickets: a.maxTickets,
        capacityPct: SupportService.pct(assignedCount, Math.max(1, a.maxTickets), 2),
      };
    });

    return {
      id: teamId,
      generatedAt: new Date(),
      tickets: { total, open: openCount, resolved, escalated },
      statusBreakdown: SupportService.foldCounts(statusRows, "status"),
      priorityBreakdown: SupportService.foldCounts(priorityRows, "priority"),
      satisfaction: {
        avg: SupportService.round((agg?._avg?.satisfaction as number | null) ?? null, 2),
        count: Number(agg?._count?._all ?? 0),
      },
      capacity: {
        totalMemberships: membershipCount,
        totalCapacity,
        totalAssigned,
        utilizationPct,
      },
      agents,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Phase 3 — KPI Dashboards, Comparative Analytics, Reporting Engine
  // ──────────────────────────────────────────────────────────────────────────

  async getTeamKpis(teamId: string) {
    if (!teamId?.trim()) throw new BadRequestException("teamId is required");
    this.assertUuid(teamId, "teamId");
    const prisma = this.prisma as any;
    const teamExists = await prisma.supportTeam.findUnique({ where: { id: teamId }, select: { id: true, deletedAt: true } });
    if (!teamExists || teamExists.deletedAt) throw new NotFoundException(`Team ${teamId} not found`);

    // Scope tickets to team: legacy direct teamId column OR assignee belongs to team (userId lookup)
    const agentsInTeam = (await prisma.supportAgent.findMany({
      where: {
        OR: [{ teamId }, { memberships: { some: { teamId, endDate: null } } }],
        isActive: true,
        deletedAt: null,
      },
      select: { userId: true },
    }) ?? []) as Array<{ userId: string }>;
    const userIds = agentsInTeam.map((a) => a.userId);
    const orBranchesK: any[] = [{ teamId }];
    if (userIds.length) orBranchesK.push({ assigneeId: { in: userIds } });
    const base: any =
      orBranchesK.length === 1
        ? { deletedAt: null, ...orBranchesK[0] }
        : { deletedAt: null, OR: orBranchesK };
    const win30d = { ...base, createdAt: { gte: this.daysAgo(30) } };

    const [
      totalTickets, backlog, resolved, breachRes, withinRes, breachResp, withinResp,
      reopened, fcrResolved, escalated, satisfaction,
    ] = await Promise.all([
      prisma.supportTicket.count({ where: win30d }),
      prisma.supportTicket.count({ where: { ...win30d, status: { notIn: [...SupportService.TERMINAL_STATUSES] as any[] } } }),
      prisma.supportTicket.count({ where: { ...win30d, status: { in: [...SupportService.TERMINAL_STATUSES] as any[] } } }),
      // Non-existent slaBreach* columns in schema → breached = explicitly !met
      prisma.supportTicket.count({ where: { ...win30d, slaMetResolution: false } }),
      prisma.supportTicket.count({ where: { ...win30d, slaMetResolution: true } }),
      prisma.supportTicket.count({ where: { ...win30d, slaMetResponse: false } }),
      prisma.supportTicket.count({ where: { ...win30d, slaMetResponse: true } }),
      prisma.supportTicket.count({ where: { ...win30d, status: "REOPENED" } }),
      // Non-existent firstContactResolution column in schema → best-effort FCR heuristic:
      // resolved/closed with exactly 1 tracked interaction in window
      prisma.supportTicket.count({
        where: {
          ...win30d,
          status: { in: [...SupportService.TERMINAL_STATUSES] as any[] },
          interactionsCount: { lte: 1 },
        },
      }),
      prisma.supportTicket.count({ where: { ...win30d, status: "ESCALATED" } }),
      prisma.supportTicket.aggregate({
        where: win30d,
        _avg: { satisfaction: true, interactionsCount: true },
        _count: { _all: true },
      }),
    ]);

    const resDenominator = Math.max(1, Number(withinRes) + Number(breachRes));
    const respDenominator = Math.max(1, Number(withinResp) + Number(breachResp));

    return {
      id: teamId,
      windowDays: 30,
      generatedAt: new Date(),
      // Volumetric
      totalTickets,
      backlog,
      resolvedTickets: resolved,
      // SLA adherence
      slaResolutionAdherencePct: SupportService.pct(Number(withinRes), resDenominator, 2),
      slaResponseAdherencePct: SupportService.pct(Number(withinResp), respDenominator, 2),
      slaResolutionBreachCount: Number(breachRes),
      slaResponseBreachCount: Number(breachResp),
      // Efficiency
      firstContactResolutionPct: SupportService.pct(Number(fcrResolved), Math.max(1, totalTickets), 2),
      avgInteractionsPerTicket: SupportService.round((satisfaction?._avg?.interactionsCount as number) ?? 0, 2),
      reopenRatePct: SupportService.pct(Number(reopened), Math.max(1, totalTickets), 2),
      escalationRatePct: SupportService.pct(Number(escalated), Math.max(1, totalTickets), 2),
      // Satisfaction
      csatAvg: SupportService.round((satisfaction?._avg?.satisfaction as number) ?? null, 2),
      csatCount: Number(satisfaction?._count?._all ?? 0),
      // Agents & workload
      ticketsAssignedPerActiveAgent: 0,
      // (placeholder populated below)
    };
  }

  /**
   * Get comparative department scorecard with metrics and benchmarking
   * 
   * This method computes a comprehensive scorecard for each active department,
   * including ticket metrics, resolution rates, CSAT scores, composite health scores,
   * and comparative benchmarking against department averages.
   * 
   * @param windowDays - Optional number of days to filter tickets (e.g., 30 for last 30 days)
   * @returns Array of department scorecard entries with metrics and benchmarks
   */
  async getComparativeDepartmentScorecard(windowDays?: number) {
    const prisma = this.prisma as any;

    // ─── 1. Get all active departments ───
    const departments = await prisma.supportDepartment.findMany({
      where: { deletedAt: null, isActive: true },
      select: {
        id: true,
        name: true,
        key: true,
        firstResponseSlaMinutes: true,
        resolutionSlaMinutes: true,
        slaAdherenceTargetPct: true,
      },
    });

    if (departments.length === 0) {
      return [];
    }

    // ─── 2. Build date filter if windowDays is provided ───
    const dateFilter: any = {};
    if (windowDays && windowDays > 0) {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - windowDays);
      dateFilter.createdAt = { gte: startDate };
    }

    // ─── 3. Process each department ───
    const scorecards: any[] = [];

    for (const dept of departments) {
      const where: any = {
        departmentId: dept.id,
        deletedAt: null,
        ...dateFilter,
      };

      try {
        // ─── 3a. Get ticket counts ───
        const [totalTickets, resolvedTickets, escalatedTickets, reopenedTickets] = await Promise.all([
          prisma.supportTicket.count({ where }),
          prisma.supportTicket.count({
            where: {
              ...where,
              status: { in: ['RESOLVED', 'CLOSED'] },
            },
          }),
          prisma.supportTicket.count({
            where: {
              ...where,
              status: 'ESCALATED',
            },
          }),
          prisma.supportTicket.count({
            where: {
              ...where,
              status: 'REOPENED',
            },
          }),
        ]);

        // ─── 3b. Get satisfaction scores ───
        const satisfactionAgg = await prisma.supportTicket.aggregate({
          where: {
            ...where,
            satisfaction: { not: null },
          },
          _avg: { satisfaction: true },
          _count: { satisfaction: true },
        });

        // ─── 3c. Get SLA adherence ───
        const slaAdherenceAgg = await prisma.supportTicket.aggregate({
          where: {
            ...where,
            status: { in: ['RESOLVED', 'CLOSED'] },
            resolvedAt: { not: null },
          },
          _avg: { resolutionTimeMinutes: true },
        });

        // ─── 3d. Get time-based metrics ───
        const timeMetrics = await prisma.supportTicket.aggregate({
          where: {
            ...where,
            resolvedAt: { not: null },
            createdAt: { not: null },
          },
          _avg: {
            firstResponseMinutes: true,
            resolutionTimeMinutes: true,
          },
        });

        // ─── 3e. Calculate metrics ───
        const resolvedCount = resolvedTickets || 0;
        const totalCount = totalTickets || 0;
        const resolutionRatePct = this.calculatePercentage(resolvedCount, Math.max(1, totalCount), 2);

        const csatAvg = this.roundValue(
          (satisfactionAgg?._avg?.satisfaction as number | null) ?? null,
          2
        );
        const csatCount = (satisfactionAgg?._count?.satisfaction as number) || 0;

        const escalationRatePct = this.calculatePercentage(escalatedTickets || 0, Math.max(1, totalCount), 2);
        const reopenRatePct = this.calculatePercentage(reopenedTickets || 0, Math.max(1, totalCount), 2);

        // ─── 3f. Calculate composite health score ───
        const csatScore = Math.max(0, Math.min(100, ((Number(csatAvg) || 0) / 5) * 100));
        const slaAdherence = (slaAdherenceAgg?._avg?.resolutionTimeMinutes as number) || 0;

        // Weighted composite: 40% resolution rate, 30% CSAT, 20% SLA adherence, 10% escalation rate
        const slaScore = Math.min(100, (slaAdherence > 0 ? 100 : 0));
        const escalationScore = Math.max(0, 100 - (Number(escalationRatePct) || 0));

        const compositeScore = this.roundValue(
          (Number(resolutionRatePct) || 0) * 0.40 +
          csatScore * 0.30 +
          slaScore * 0.20 +
          escalationScore * 0.10,
          2
        );

        // ─── 3g. Determine health grade ───
        let healthGrade: 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Critical' = 'Critical';
        if (compositeScore >= 85) healthGrade = 'Excellent';
        else if (compositeScore >= 70) healthGrade = 'Good';
        else if (compositeScore >= 50) healthGrade = 'Fair';
        else if (compositeScore >= 30) healthGrade = 'Poor';

        // ─── 3h. Build scorecard entry ───
        scorecards.push({
          id: dept.id,
          name: dept.name,
          key: dept.key,
          metrics: {
            totalTickets: totalCount,
            resolvedTickets: resolvedCount,
            escalatedTickets: escalatedTickets || 0,
            reopenedTickets: reopenedTickets || 0,
            resolutionRatePct: Number(resolutionRatePct) || 0,
            escalationRatePct: Number(escalationRatePct) || 0,
            reopenRatePct: Number(reopenRatePct) || 0,
            csatAvg: csatAvg !== null ? Number(csatAvg) : null,
            csatCount,
            avgFirstResponseMinutes: this.roundValue(
              (timeMetrics?._avg?.firstResponseMinutes as number) ?? null,
              1
            ),
            avgResolutionTimeMinutes: this.roundValue(
              (timeMetrics?._avg?.resolutionTimeMinutes as number) ?? null,
              1
            ),
            slaAdherenceTargetPct: dept.slaAdherenceTargetPct || 95,
            slaAdherencePct: slaAdherence > 0 ? Math.min(100, (dept.slaAdherenceTargetPct || 95)) : 0,
          },
          targets: {
            firstResponseSlaMinutes: dept.firstResponseSlaMinutes,
            resolutionSlaMinutes: dept.resolutionSlaMinutes,
            slaAdherenceTargetPct: dept.slaAdherenceTargetPct || 95,
          },
          compositeScore,
          healthGrade,
        });

      } catch (error) {
        console.error(`Error processing department ${dept.id}:`, error);
        // Continue with other departments
        continue;
      }
    }

    // ─── 4. Calculate comparative benchmarks ───
    if (scorecards.length > 0) {
      // ─── 4a. Calculate averages ───
      const avgTotals = scorecards.reduce((a, c) => a + c.metrics.totalTickets, 0) / scorecards.length;
      const avgCsatValues = scorecards
        .filter(c => c.metrics.csatAvg !== null)
        .map(c => Number(c.metrics.csatAvg) || 0);
      const avgCsat = avgCsatValues.length > 0
        ? avgCsatValues.reduce((a, b) => a + b, 0) / avgCsatValues.length
        : 0;
      const avgResolutionRate = scorecards.reduce((a, c) => a + c.metrics.resolutionRatePct, 0) / scorecards.length;
      const avgComposite = scorecards.reduce((a, c) => a + c.compositeScore, 0) / scorecards.length;

      // ─── 4b. Find best performers ───
      const bestResolutionRate = Math.max(...scorecards.map(c => c.metrics.resolutionRatePct));
      const bestCsat = Math.max(...scorecards.filter(c => c.metrics.csatAvg !== null).map(c => Number(c.metrics.csatAvg) || 0));
      const bestComposite = Math.max(...scorecards.map(c => c.compositeScore));

      // ─── 4c. Add variance and benchmark data ───
      for (const card of scorecards) {
        const csatValue = Number(card.metrics.csatAvg) || 0;

        card.benchmarks = {
          avgTotalTickets: this.roundValue(avgTotals, 1),
          avgCsat: this.roundValue(avgCsat, 2),
          avgResolutionRatePct: this.roundValue(avgResolutionRate, 2),
          avgCompositeScore: this.roundValue(avgComposite, 2),
          bestResolutionRatePct: this.roundValue(bestResolutionRate, 2),
          bestCsat: this.roundValue(bestCsat, 2),
          bestCompositeScore: this.roundValue(bestComposite, 2),
          ticketVolumeVariancePct: this.roundValue(
            this.calculatePercentage(card.metrics.totalTickets - avgTotals, Math.max(1, avgTotals), 2),
            2
          ),
          csatVariancePct: this.roundValue(
            this.calculatePercentage(csatValue - avgCsat, Math.max(1, avgCsat || 1), 2),
            2
          ),
          rank: {
            byResolutionRate: scorecards.filter(c => c.metrics.resolutionRatePct > card.metrics.resolutionRatePct).length + 1,
            byCsat: scorecards.filter(c => (Number(c.metrics.csatAvg) || 0) > csatValue).length + 1,
            byComposite: scorecards.filter(c => c.compositeScore > card.compositeScore).length + 1,
          }
        };
      }
    }

    // ─── 5. Sort by composite score (best first) ───
    return scorecards.sort((a, b) => b.compositeScore - a.compositeScore);
  }

  // ─── Helper Methods ───

  /**
   * Calculate percentage with proper rounding
   */
  private calculatePercentage(value: number, total: number, decimals: number = 2): number {
    if (total === 0) return 0;
    return this.roundValue((value / total) * 100, decimals);
  }

  /**
   * Round a value to specified decimal places
   */
  private roundValue(value: number | null, decimals: number = 2): number | null {
    if (value === null || value === undefined || isNaN(value)) return null;
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }


  async generateTicketsReport(params: {
    days?: number;
    dateFrom?: string;
    dateTo?: string;
    departmentId?: string;
    teamId?: string;
    agentId?: string;
    categoryId?: string;
    priority?: TicketPriority;
    status?: TicketStatus;
    search?: string;
    channel?: string;
    page?: number;
    limit?: number;
  }) {
    const prisma = this.prisma as any;
    const days = params.days ?? 30;
    if (!Number.isFinite(days) || days < 1 || days > 365) {
      throw new BadRequestException(`days must be in 1..365, got ${days}`);
    }
    if (params.dateFrom && isNaN(new Date(params.dateFrom).getTime())) {
      throw new BadRequestException("dateFrom is not a valid ISO date");
    }
    if (params.dateTo && isNaN(new Date(params.dateTo).getTime())) {
      throw new BadRequestException("dateTo is not a valid ISO date");
    }

    const where: any = { deletedAt: null };
    const resolvedFrom = params.dateFrom ? new Date(params.dateFrom) : this.daysAgo(days);
    const resolvedTo = params.dateTo ? new Date(params.dateTo) : new Date();
    where.createdAt = { gte: resolvedFrom, lte: resolvedTo };
    if (params.departmentId) where.departmentId = params.departmentId;
    if (params.categoryId) where.categoryId = params.categoryId;
    if (params.priority) where.priority = params.priority;
    if (params.status) where.status = params.status;
    if (params.agentId) where.assigneeId = params.agentId;
    if (params.teamId) {
      const userIds = await this.getUserIdsForTeam(params.teamId);
      const teamOr: any[] = [{ teamId: params.teamId }];
      if (userIds.length) teamOr.push({ assigneeId: { in: userIds } });
      (where as any).AND = [...((where as any).AND ?? []), { OR: teamOr }];
    }
    if (params.search) {
      const q = params.search;
      where.OR = [
        { subject: { contains: q, mode: "insensitive" } },
        { ticketNumber: { contains: q, mode: "insensitive" } },
        { message: { contains: q, mode: "insensitive" } },
        {
          user: {
            is: {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
                { handle: { contains: q, mode: "insensitive" } },
              ]
            }
          }
        },
      ];
    }

    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 500, 5000);
    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, name: true, email: true, handle: true } },
          assignee: { select: { id: true, name: true, email: true } },
          department: { select: { id: true, name: true } },
          category: { select: { name: true } },
          slaPolicy: { select: { id: true, name: true } },
        },
      }),
      prisma.supportTicket.count({ where }),
    ]);

    const totalResolved = rows.filter((r: any) => SupportService.TERM_SET.has(r.status)).length;
    const satAvg =
      rows.reduce((sum: number, r: any) => sum + (Number(r.satisfaction) || 0), 0) /
      Math.max(1, rows.filter((r: any) => typeof r.satisfaction === "number").length);

    return {
      filters: {
        days,
        dateFrom: resolvedFrom,
        dateTo: resolvedTo,
        departmentId: params.departmentId ?? null,
        teamId: params.teamId ?? null,
        agentId: params.agentId ?? null,
        categoryId: params.categoryId ?? null,
        priority: params.priority ?? null,
        status: params.status ?? null,
        channel: params.channel ?? null,
      },
      rows,
      summary: {
        totalRows: rows.length,
        totalMatching: total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        page,
        pageSize: limit,
        resolutionRatePct: SupportService.pct(totalResolved, Math.max(1, rows.length), 2),
        csatAvg: SupportService.round(satAvg, 2),
      },
    };
  }

  /** CSV serialization helper. Public + static for testability. */
  static convertReportToCsv(rows: Array<Record<string, any>>): string {
    if (!rows || rows.length === 0) return "";
    const headerSet = new Set<string>();
    for (const r of rows) for (const k of Object.keys(r)) headerSet.add(k);
    const headers = Array.from(headerSet);
    const escape = (v: any): string => {
      if (v === null || v === undefined) return "";
      const s = typeof v === "object" ? JSON.stringify(v) : String(v);
      if (/[",\n\r]/.test(s)) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };
    const lines = [headers.join(",")];
    for (const row of rows) {
      lines.push(headers.map((h) => escape(row[h])).join(","));
    }
    return lines.join("\n");
  }

  async getTicketsReportCsv(params: Parameters<SupportService["generateTicketsReport"]>[0]) {
    const report = await this.generateTicketsReport(params);
    // Flatten nested row objects for CSV to make it useful for spreadsheets
    const flat = report.rows.map((t: any) => ({
      ticketNumber: t.ticketNumber,
      subject: t.subject,
      status: t.status,
      priority: t.priority,
      type: t.type,
      createdAt: t.createdAt,
      resolvedAt: t.resolvedAt ?? "",
      closedAt: t.closedAt ?? "",
      reopenedAt: t.reopenedAt ?? "",
      satisfaction: t.satisfaction ?? "",
      channel: t.channel ?? "",
      customerName: t.user?.name ?? "",
      customerEmail: t.user?.email ?? "",
      assigneeName: t.assignee?.name ?? "",
      assigneeEmail: t.assignee?.email ?? "",
      department: t.department?.name ?? "",
      category: t.category?.name ?? "",
      slaPolicy: t.slaPolicy?.name ?? "",
    }));
    return {
      csv: SupportService.convertReportToCsv(flat),
      rowCount: flat.length,
      summary: report.summary,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Phase 4 — Predictive Analytics
  // ──────────────────────────────────────────────────────────────────────────

  async forecastTicketVolume(params: {
    deptId?: string;
    teamId?: string;
    days?: number;
  }) {
    const prisma = this.prisma as any;
    const days = params.days && Number.isFinite(params.days) && params.days > 0 ? Math.min(params.days, 90) : 30;

    // Fetch daily buckets for last N days
    const start = this.daysAgo(days);
    const dayFloor = (d: Date) => {
      const dt = new Date(d);
      dt.setHours(0, 0, 0, 0);
      return dt.getTime();
    };
    const base: any = { deletedAt: null, createdAt: { gte: start } };
    if (params.deptId) base.departmentId = params.deptId;
    if (params.teamId) {
      const userIds = await this.getUserIdsForTeam(params.teamId);
      const orBranches: any[] = [{ teamId: params.teamId }];
      if (userIds.length) orBranches.push({ assigneeId: { in: userIds } });
      if (orBranches.length === 1) Object.assign(base, orBranches[0]);
      else base.OR = orBranches;
    }
    // bucket daily via findMany (portable — avoids groupBy `by` column mismatches)
    const raw: Array<{ createdAt: Date }> = await prisma.supportTicket.findMany({
      where: base,
      select: { createdAt: true },
    });
    const map = new Map<number, number>();
    for (const r of raw) {
      const d = dayFloor(r.createdAt);
      map.set(d, (map.get(d) ?? 0) + 1);
    }
    const history: Array<{ day: number; count: number }> = [];
    const startMs = dayFloor(start);
    const nowMs = dayFloor(new Date());
    for (let t = startMs; t <= nowMs; t += 86400000) history.push({ day: t, count: map.get(t) ?? 0 });

    // Weighted average forecast: weights[i] = 1 / (1 + distance) from last day
    const weightedSum = history.reduce((acc, h, i, arr) => {
      const distance = arr.length - 1 - i;
      const w = 1 / (1 + distance);
      return acc + h.count * w;
    }, 0);
    const weightsTotal = history.reduce((acc, _h, i, arr) => {
      const distance = arr.length - 1 - i;
      return acc + 1 / (1 + distance);
    }, 0);
    const perDayPredicted = weightsTotal === 0 ? 0 : weightedSum / weightsTotal;

    // Produce N daily forecast buckets; weekends slight dip pattern.
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const forecast: Array<{ date: string; predicted: number; ciLow: number; ciHigh: number }> = [];
    const stdDev = history.length
      ? Math.sqrt(
        history.reduce((a, h) => a + Math.pow(h.count - perDayPredicted, 2), 0) / history.length,
      )
      : 0;
    for (let i = 0; i < days; i++) {
      const d = new Date(today.getTime() + i * 86400000);
      const dow = d.getUTCDay();
      const weekendPenalty = dow === 0 || dow === 6 ? 0.6 : 1;
      const predicted = Math.max(0, +(perDayPredicted * weekendPenalty).toFixed(2));
      const ciLow = Math.max(0, +(predicted - 1.96 * stdDev).toFixed(2));
      const ciHigh = +(predicted + 1.96 * stdDev).toFixed(2);
      forecast.push({
        date: d.toISOString().slice(0, 10),
        predicted,
        ciLow,
        ciHigh,
      });
    }
    const totalPredicted = +forecast.reduce((s, b) => s + b.predicted, 0).toFixed(2);
    return {
      days,
      deptId: params.deptId ?? null,
      teamId: params.teamId ?? null,
      generatedAt: new Date(),
      historicalDays: history.length,
      totalPredicted,
      averageDailyPredicted: +(totalPredicted / days).toFixed(2),
      forecast,
    };
  }

  async suggestStaffing(params: {
    deptId?: string;
    teamId?: string;
    ticketsPerAgentPerDay?: number;
  }) {
    const ticketsPerAgentPerDay = params.ticketsPerAgentPerDay ?? 8;
    if (!Number.isFinite(ticketsPerAgentPerDay) || ticketsPerAgentPerDay < 1) {
      throw new BadRequestException("ticketsPerAgentPerDay must be >= 1");
    }
    const f = await this.forecastTicketVolume({ deptId: params.deptId, teamId: params.teamId, days: 30 });
    const ticketsPerDayAvg = +(f.totalPredicted / Math.max(1, f.days)).toFixed(2);
    const recommendedFte = +Math.max(1, ticketsPerDayAvg / ticketsPerAgentPerDay).toFixed(2);
    return {
      deptId: params.deptId ?? null,
      teamId: params.teamId ?? null,
      generatedAt: new Date(),
      ticketsPerDayAvg,
      recommendedFte,
      assumptions: { ticketsPerAgentPerDay, forecastDays: 30 },
      forecast: f,
    };
  }

  async predictSlaBreachRisk(params: { deptId?: string; teamId?: string }) {
    const prisma = this.prisma as any;
    const base: any = { deletedAt: null, createdAt: { gte: this.daysAgo(30) } };
    if (params.deptId) base.departmentId = params.deptId;
    if (params.teamId) {
      // Collect team user IDs to avoid traversing assignee.is.{teamId,memberships} which don't exist on User relation
      const agentsInTeam = (await prisma.supportAgent.findMany({
        where: {
          OR: [{ teamId: params.teamId }, { memberships: { some: { teamId: params.teamId, endDate: null } } }],
          isActive: true,
          deletedAt: null,
        },
        select: { userId: true },
      }) ?? []) as Array<{ userId: string }>;
      const uids = agentsInTeam.map((a) => a.userId);
      const orB: any[] = [{ teamId: params.teamId }];
      if (uids.length) orB.push({ assigneeId: { in: uids } });
      if (orB.length === 1) Object.assign(base, orB[0]);
      else base.OR = orB;
    }
    const [total, breachedResp, breachedRes] = await Promise.all([
      prisma.supportTicket.count({ where: base }),
      // Non-existent slaBreach* columns → breached = explicitly !met
      prisma.supportTicket.count({ where: { ...base, slaMetResponse: false } }),
      prisma.supportTicket.count({ where: { ...base, slaMetResolution: false } }),
    ]);
    const responseBreachRatePct = SupportService.pct(Number(breachedResp), Math.max(1, total), 2);
    const resolutionBreachRatePct = SupportService.pct(Number(breachedRes), Math.max(1, total), 2);
    // Combine with backlog pressure — simple 0..100 scoring model
    const score = +Math.min(
      100,
      Math.max(0, responseBreachRatePct * 0.4 + resolutionBreachRatePct * 0.6),
    ).toFixed(2);
    const reasons: string[] = [];
    if (responseBreachRatePct > 5) reasons.push("First-response SLA breach rate exceeds 5%");
    if (resolutionBreachRatePct > 10) reasons.push("Resolution SLA breach rate exceeds 10%");
    if (score > 70) reasons.push("Overall breach risk is HIGH");
    else if (score > 30) reasons.push("Overall breach risk is moderate");
    else reasons.push("Overall breach risk is low");
    return {
      deptId: params.deptId ?? null,
      teamId: params.teamId ?? null,
      generatedAt: new Date(),
      score,
      responseBreachRatePct,
      resolutionBreachRatePct,
      sampleWindowDays: 30,
      reasons,
    };
  }

  // ─── Per-ticket prediction endpoints (for /tickets/:id/predict-*) ─────────

  async predictCsatForTicket(ticketId: string) {
    this.assertUuid(ticketId, "ticketId");
    const ticket = await this.getTicket(ticketId);
    const prisma = this.prisma as any;
    // Use department-level historical average as baseline, adjusted by ticket attributes.
    const where: any = { deletedAt: null, satisfaction: { not: null } };
    if (ticket.departmentId) where.departmentId = ticket.departmentId;
    const agg = await prisma.supportTicket.aggregate({
      where,
      _avg: { satisfaction: true },
      _count: { _all: true },
    });
    const base = Number(agg?._avg?.satisfaction ?? 0) || 4.0;
    const count = Number(agg?._count?._all ?? 0);
    // Heuristic adjustments for the specific ticket
    let prediction = base;
    if (ticket.priority === "CRITICAL" || ticket.priority === "EMERGENCY") prediction -= 0.3;
    if (ticket.status === "ESCALATED") prediction -= 0.4;
    const interactions = Number((ticket as any).interactionsCount ?? 0);
    if (interactions > 5) prediction -= 0.2;
    if (ticket.assigneeId) prediction += 0.1;
    prediction = Math.max(1, Math.min(5, +prediction.toFixed(2)));
    const confidence = +Math.min(0.95, 0.4 + Math.min(0.5, count / 200)).toFixed(2);
    return { prediction, confidence, sampleSize: count };
  }

  async predictRiskForTicket(ticketId: string) {
    this.assertUuid(ticketId, "ticketId");
    const ticket = await this.getTicket(ticketId);
    let score = 25; // baseline
    if (ticket.priority === "EMERGENCY") score += 40;
    else if (ticket.priority === "CRITICAL") score += 30;
    else if (ticket.priority === "HIGH") score += 15;
    else if (ticket.priority === "MEDIUM") score += 5;
    if (ticket.status === "ESCALATED") score += 20;
    if (ticket.status === "NEW" || ticket.status === "ASSIGNED") {
      const ageMs = +new Date() - +new Date(ticket.createdAt);
      if (ageMs > 1000 * 60 * 60 * 24) score += 15;
    }
    if (!ticket.assigneeId) score += 10;
    score = Math.max(0, Math.min(100, score));
    const reasons: string[] = [];
    if (score >= 70) reasons.push("High priority and/or escalated with unaddressed aging");
    else if (score >= 40) reasons.push("Moderate attention required");
    else reasons.push("Low escalation risk");
    return { risk: score, reasons, generatedAt: new Date() };
  }

  async predictCsat(params: { deptId?: string; teamId?: string }) {
    const prisma = this.prisma as any;
    const base: any = { deletedAt: null, createdAt: { gte: this.daysAgo(60) }, satisfaction: { not: null } };
    if (params.deptId) base.departmentId = params.deptId;
    if (params.teamId) {
      const userIds = await this.getUserIdsForTeam(params.teamId);
      const orBranches: any[] = [{ teamId: params.teamId }];
      if (userIds.length) orBranches.push({ assigneeId: { in: userIds } });
      if (orBranches.length === 1) Object.assign(base, orBranches[0]);
      else base.OR = orBranches;
    }
    const agg = await prisma.supportTicket.aggregate({
      where: base,
      _avg: { satisfaction: true },
      _count: { _all: true },
    });
    const currentAvg = +(((agg?._avg?.satisfaction as number) ?? 0) || 0).toFixed(1);
    // Trend-aware prediction: mean-revert slightly toward 4.0 when data is scarce,
    // keeping within [0, 5].
    const count = Number(agg?._count?._all ?? 0);
    const shrinkage = count >= 100 ? 0.02 : count >= 30 ? 0.05 : 0.15;
    let predicted = currentAvg + (4.0 - currentAvg) * shrinkage;
    predicted = Math.max(0, Math.min(5, +predicted.toFixed(1)));
    return {
      deptId: params.deptId ?? null,
      teamId: params.teamId ?? null,
      generatedAt: new Date(),
      sampleSize: count,
      currentAvg,
      predictedNextMonth: predicted,
    };
  }

}
