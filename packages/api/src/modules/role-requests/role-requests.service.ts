import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CacheService } from '../../shared/cache/cache.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  NotificationKind,
  Role,
  RolePermissionRequestStatus,
  RolePermissionRequestType,
} from '@prisma/client';

export type CreateRequestArgs = {
  requesterId: string;
  requestedRoleKey: string;
  type: RolePermissionRequestType;
  justification: string;
  startsAt?: Date;
  expiresAt?: Date;
};

export type ListFilters = {
  requesterId?: string;
  status?: RolePermissionRequestStatus;
  forAdminView?: boolean;
  page?: number;
  limit?: number;
  ordering?: { field: 'createdAt' | 'reviewedAt' | 'startsAt'; dir: 'asc' | 'desc' };
};

export type ReviewArgs = {
  requestId: string;
  reviewerId: string;
  adminJustification: string;
};

/**
 * §2 & §3 — RolePermissionRequest domain service.
 *
 * Manages the full request lifecycle: submit → pending → (approve|reject|expire).
 * Emits notifications at every transition via NotificationsService, and writes
 * request history events (RolePermissionRequestEvent rows) for auditability.
 *
 * Design notes:
 * - `requestedRoleKey` is stored as the raw string the user picked (the same
 *   keys returned from `/api/admin/roles`), i.e. either a legacy `Role` enum
 *   value OR an `RbacRole.key`. At approval time, AdminService.resolveRole
 *   (via the private helper exposed as a public `resolveRoleForAssignment`)
 *   normalizes the key down to an RbacRole.id + legacy sync pair. This keeps
 *   the request table schema fully role-key-agnostic and avoids coupling to
 *   enum refactors.
 */
@Injectable()
export class RoleRequestsService {
  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
    private notifications: NotificationsService,
  ) {}

  /**
   * Validate that a role key is assignable — i.e. either a legacy `Role` enum
   * value OR an active, non-deleted `RbacRole.key`. Prevents users from
   * submitting requests for non-existent roles.
   */
  private async assertValidRoleKey(requestedRoleKey: string): Promise<void> {
    if (!requestedRoleKey || typeof requestedRoleKey !== 'string') {
      throw new BadRequestException('Requested role is required.');
    }
    // Fast path: try exact legacy enum match (case insensitive compare via uppercase).
    const legacyRoles = new Set<string>(Object.values(Role).map((r) => String(r)));
    if (legacyRoles.has(requestedRoleKey)) return;

    // RBAC match. Also tolerate case-insensitive RbacRole.key lookups; if user
    // submits `SUPPORT_ADMIN` instead of `support_admin` accept the
    // canonicalized key and rewrite to the exact stored key. We treat fuzzy
    // matches the same way AdminService.resolveRole does.
    const allActive = await this.prisma.rbacRole.findMany({
      where: { deletedAt: null, isActive: true },
      select: { key: true, name: true },
    });
    const lowerToExact = new Map<string, string>();
    for (const r of allActive) {
      lowerToExact.set(r.key.toLowerCase(), r.key);
      if (r.name) lowerToExact.set(r.name.toLowerCase(), r.key);
    }
    if (!lowerToExact.has(requestedRoleKey.toLowerCase())) {
      const available = Array.from(legacyRoles)
        .concat(allActive.map((r) => r.key))
        .filter((v, i, arr) => arr.indexOf(v) === i)
        .sort();
      throw new BadRequestException(
        `Requested role "${requestedRoleKey}" is not assignable. Valid role keys: ${available.join(', ')}.`,
      );
    }
  }

  // ---------- §2 User-initiated requests ----------

  async createRequest(args: CreateRequestArgs) {
    const { requesterId, requestedRoleKey, type, justification, startsAt, expiresAt } = args;

    // Role-key validation first — fails fast with valid list if bad.
    // (This also throws BadRequest for empty-string/null/missing keys.)
    await this.assertValidRoleKey(requestedRoleKey);

    if (!justification || justification.trim().length < 5) {
      throw new BadRequestException('Justification must be at least 5 characters.');
    }

    if (type === RolePermissionRequestType.TEMPORARY) {
      if (!startsAt || !expiresAt) {
        throw new BadRequestException('Temporary requests require both startsAt and expiresAt.');
      }
      const s = +new Date(startsAt);
      const e = +new Date(expiresAt);
      if (!Number.isFinite(s) || !Number.isFinite(e)) {
        throw new BadRequestException('startsAt / expiresAt must be valid dates.');
      }
      if (e <= s) {
        throw new BadRequestException('expiresAt must be strictly later than startsAt.');
      }
      if (e - s < 1000 * 60 * 30) {
        throw new BadRequestException('Temporary access must be at least 30 minutes long.');
      }
    } else {
      // PERMANENT
      if (startsAt || expiresAt) {
        throw new BadRequestException('Permanent requests must not include startsAt or expiresAt.');
      }
    }

    // One active duplicate guard
    const existing = await this.prisma.rolePermissionRequest.findFirst({
      where: {
        requesterId,
        requestedRoleKey,
        status: { in: [RolePermissionRequestStatus.PENDING] },
      },
    });
    if (existing) {
      throw new BadRequestException(
        'You already have a pending request for this role. Wait for it to be reviewed or cancel it first.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const request = await tx.rolePermissionRequest.create({
        data: {
          requesterId,
          requestedRoleKey,
          type,
          status: RolePermissionRequestStatus.PENDING,
          justification: justification.trim(),
          startsAt: type === RolePermissionRequestType.TEMPORARY ? new Date(startsAt) : null,
          expiresAt: type === RolePermissionRequestType.TEMPORARY ? new Date(expiresAt) : null,
          history: {
            create: {
              actorId: requesterId,
              transition: RolePermissionRequestStatus.PENDING,
              reason: 'Submitted by user',
              metadata: { submitted: true, type },
            },
          },
        },
        include: { requester: { select: { id: true, name: true, handle: true } } },
      });

        // §4a Notify requester "submitted"
        await this.notifications.createNotification({
          userId: requesterId,
          kind: NotificationKind.ROLE_REQUEST_SUBMITTED as never,
          title: 'Your role request has been submitted',
          body: `Your role request for ${requestedRoleKey} has been submitted and is pending review.`,
          
        metadata: { roleRequestId: request.id, requestedRoleKey, type },
      });

      // §4b Notify all admin-level users "new request pending"
      //
      // Admin-level users are detected two ways:
      //  (a) legacy `user.role` column — ADMIN | PLATFORM_ADMIN | SUPER_ADMIN
      //  (b) RBAC UserRoleAssignment rows whose RbacRole.key is an admin-tier key
      //      (moderator | support_admin | admin | platform_admin | super_admin).
      // This ensures RBAC-created subadmins always get notified even if their
      // legacy user.role column remains USER.
      const legacyAdminRoles = ['ADMIN', 'PLATFORM_ADMIN', 'SUPER_ADMIN'];
      const adminTierRbacKeys = new Set([
        'moderator', 'support_admin', 'admin', 'platform_admin', 'super_admin',
      ]);

      const [legacyAdmins, rbacAdmins] = await Promise.all([
        tx.user.findMany({
          where: {
            role: { in: legacyAdminRoles as any[] },
            isActive: true,
            deletedAt: null,
          },
          select: { id: true },
        }),
        tx.userRoleAssignment.findMany({
          where: {
            role: { key: { in: Array.from(adminTierRbacKeys) }, deletedAt: null, isActive: true },
            user: { isActive: true, deletedAt: null },
          },
          select: { userId: true },
        }),
      ]);

      const adminIds = new Set<string>();
      for (const u of legacyAdmins) adminIds.add(u.id);
      for (const a of rbacAdmins) adminIds.add(a.userId);
      adminIds.delete(requesterId); // don't self-notify

      await Promise.all(
        Array.from(adminIds).map((id) =>
          this.notifications.createNotification({
            userId: id,
            actorId: requesterId,
            kind: NotificationKind.ROLE_REQUEST_SUBMITTED as never,
            title: 'New role request pending review',
            body: `A new role request for ${requestedRoleKey} is awaiting your review.`,
            metadata: { roleRequestId: request.id, requestedRoleKey, type },
          }),
        ),
      );

      return request;
    });
  }

  // ---------- §2/§3 Listing (user self-view + admin all-view) ----------

  async listRequests(filters: ListFilters = {}) {
    const { requesterId, status, forAdminView = false, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;

    // Non-admin view: restrict explicitly to the requesterId given.
    // For admin view, pass `forAdminView=true` and requesterId becomes optional filter.
    const where: any = {};
    if (!forAdminView) {
      if (!requesterId) {
        throw new BadRequestException('requesterId is required for non-admin listing.');
      }
      where.requesterId = requesterId;
    } else if (requesterId) {
      where.requesterId = requesterId;
    }
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      this.prisma.rolePermissionRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: filters.ordering
          ? { [filters.ordering.field]: filters.ordering.dir }
          : { createdAt: 'desc' },
        include: {
          requester: { select: { id: true, name: true, handle: true, avatar: true, email: true } },
          reviewer: { select: { id: true, name: true, handle: true, avatar: true } },
          history: { orderBy: { createdAt: 'asc' } },
        },
      }),
      this.prisma.rolePermissionRequest.count({ where }),
    ]);

    return { data, total, page, limit, pages: Math.ceil(total / limit) || 1 };
  }

  async getRequestForActor(requestId: string, actorId: string, opts: { asAdmin: boolean }) {
    const req = await this.prisma.rolePermissionRequest.findUnique({
      where: { id: requestId },
      include: {
        requester: { select: { id: true, name: true, handle: true, avatar: true, email: true } },
        reviewer: { select: { id: true, name: true, handle: true, avatar: true } },
        history: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!req) throw new NotFoundException('Request not found.');
    if (!opts.asAdmin && req.requesterId !== actorId) {
      throw new ForbiddenException('You may not view this request.');
    }
    return req;
  }

  // ---------- §3 Admin review (approve / reject) ----------

  async approveRequest(args: ReviewArgs & { assignRole: (params: {
    userId: string;
    requestedRoleKey: string;
    assignedBy: string;
    expiresAt?: Date;
  }) => Promise<{ assignmentId?: string }> }) {
    const { requestId, reviewerId, adminJustification, assignRole } = args;
    if (!adminJustification || adminJustification.trim().length < 5) {
      throw new BadRequestException('Admin justification is required (min 5 characters).');
    }
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const request = await tx.rolePermissionRequest.findUnique({ where: { id: requestId } });
      if (!request) throw new NotFoundException('Request not found.');
      if (request.status !== RolePermissionRequestStatus.PENDING) {
        throw new BadRequestException(`Request is already ${request.status}.`);
      }
      if (request.requesterId === reviewerId) {
        // Requirement §1: admin must not approve their own role change via
        // the request endpoint, same rule as direct edit.
        throw new ForbiddenException('You may not approve your own role/permission request.');
      }

      const updated = await tx.rolePermissionRequest.update({
        where: { id: requestId },
        data: {
          status: RolePermissionRequestStatus.APPROVED,
          reviewerId,
          reviewedAt: now,
          adminJustification: adminJustification.trim(),
          history: {
            create: {
              actorId: reviewerId,
              transition: RolePermissionRequestStatus.APPROVED,
              reason: adminJustification.trim(),
              metadata: { reviewedAt: now.toISOString() },
            },
          },
        },
      });

      // Actually grant the role. Delegate to caller-supplied fn so we don't
      // create a circular dep on AdminService while still running inside the
      // same Prisma transaction.
      const { assignmentId } = await assignRole({
        userId: request.requesterId,
        requestedRoleKey: request.requestedRoleKey,
        assignedBy: reviewerId,
        expiresAt: request.type === RolePermissionRequestType.TEMPORARY ? request.expiresAt ?? undefined : undefined,
      });

      if (assignmentId) {
        await tx.rolePermissionRequest.update({
          where: { id: requestId },
          data: { resultingAssignmentId: assignmentId },
        });
      }

      // Notify requester
      await this.notifications.createNotification({
        userId: request.requesterId,
        actorId: reviewerId,
        kind: NotificationKind.ROLE_REQUEST_APPROVED as never,
        title: 'Your role request has been approved',
        body: `Your role request for ${request.requestedRoleKey} has been approved.`,
        metadata: {
          roleRequestId: request.id,
          requestedRoleKey: request.requestedRoleKey,
          type: request.type,
          adminJustification: adminJustification.trim(),
        },
      });

      // Invalidate RBAC cache for the requester
      try { await this.cache.del(`rbac:permissions:${request.requesterId}`); } catch { /* optional */ }

      return updated;
    });
  }

  async rejectRequest(args: ReviewArgs) {
    const { requestId, reviewerId, adminJustification } = args;
    if (!adminJustification || adminJustification.trim().length < 5) {
      throw new BadRequestException('Admin justification is required (min 5 characters).');
    }
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const request = await tx.rolePermissionRequest.findUnique({ where: { id: requestId } });
      if (!request) throw new NotFoundException('Request not found.');
      if (request.status !== RolePermissionRequestStatus.PENDING) {
        throw new BadRequestException(`Request is already ${request.status}.`);
      }
      if (request.requesterId === reviewerId) {
        throw new ForbiddenException('You may not reject your own role/permission request (cancel instead).');
      }

      const updated = await tx.rolePermissionRequest.update({
        where: { id: requestId },
        data: {
          status: RolePermissionRequestStatus.REJECTED,
          reviewerId,
          reviewedAt: now,
          adminJustification: adminJustification.trim(),
          history: {
            create: {
              actorId: reviewerId,
              transition: RolePermissionRequestStatus.REJECTED,
              reason: adminJustification.trim(),
              metadata: { reviewedAt: now.toISOString() },
            },
          },
        },
      });

      await this.notifications.createNotification({
        userId: request.requesterId,
        actorId: reviewerId,
        kind: NotificationKind.ROLE_REQUEST_REJECTED as never,
        title: 'Your role request has been rejected',
        body: `Your role request for ${request.requestedRoleKey} has been rejected.`,
        metadata: {
          roleRequestId: request.id,
          requestedRoleKey: request.requestedRoleKey,
          adminJustification: adminJustification.trim(),
        },
      });

      return updated;
    });
  }

  async cancelRequest(requestId: string, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const request = await tx.rolePermissionRequest.findUnique({ where: { id: requestId } });
      if (!request) throw new NotFoundException('Request not found.');
      if (request.requesterId !== actorId) {
        throw new ForbiddenException('You may not cancel this request.');
      }
      if (request.status !== RolePermissionRequestStatus.PENDING) {
        throw new BadRequestException(`Only PENDING requests can be cancelled (status=${request.status}).`);
      }
      return tx.rolePermissionRequest.update({
        where: { id: requestId },
        data: {
          status: RolePermissionRequestStatus.REJECTED,
          reviewedAt: new Date(),
          adminJustification: 'Cancelled by requester',
          history: {
            create: {
              actorId,
              transition: RolePermissionRequestStatus.REJECTED,
              reason: 'Cancelled by requester',
              metadata: { cancelled: true },
            },
          },
        },
      });
    });
  }

  // ---------- §6 Temporary permissions expiration (idempotent sweep) ----------

  /**
   * Idempotent sweep that:
   *  (a) transitions APPROVED TEMPORARY requests to EXPIRED if expiresAt < now,
   *  (b) removes the related UserRoleAssignment,
   *  (c) emits a ROLE_REQUEST_EXPIRED notification.
   *
   * Safe to re-run repeatedly; typically called from a cron.
   */
  async expireDueRequests(nowOverride?: Date): Promise<number> {
    const now = nowOverride ?? new Date();

    const due = await this.prisma.rolePermissionRequest.findMany({
      where: {
        status: RolePermissionRequestStatus.APPROVED,
        type: RolePermissionRequestType.TEMPORARY,
        expiresAt: { lte: now },
      },
    });
    if (due.length === 0) return 0;

    let n = 0;
    for (const req of due) {
      try {
        await this.prisma.$transaction(async (tx) => {
          await tx.rolePermissionRequest.update({
            where: { id: req.id },
            data: {
              status: RolePermissionRequestStatus.EXPIRED,
              history: {
                create: {
                  actorId: null, // system action
                  transition: RolePermissionRequestStatus.EXPIRED,
                  reason: `Expired at ${now.toISOString()} (scheduled)`,
                  metadata: { expiredBy: 'system-sweep', expiredAt: now.toISOString() },
                },
              },
            },
          });

          // Remove the assignment if we have it, otherwise best-effort remove
          // any active assignment for the same role key on that user.
          if (req.resultingAssignmentId) {
            try {
              await tx.userRoleAssignment.delete({
                where: { id: req.resultingAssignmentId },
              });
            } catch {
              // already gone (OK — idempotent)
            }
          } else {
            // Try to resolve role key back to RbacRole for a fallback cleanup.
            const resolved = await tx.rbacRole.findFirst({
              where: { key: req.requestedRoleKey, deletedAt: null },
              select: { id: true },
            });
            if (resolved) {
              await tx.userRoleAssignment.deleteMany({
                where: { userId: req.requesterId, roleId: resolved.id },
              });
            }
          }

          await this.notifications.createNotification({
            userId: req.requesterId,
            kind: NotificationKind.ROLE_REQUEST_EXPIRED as never,
            title: 'Your temporary access expired',
            body: `Your temporary access to ${req.requestedRoleKey} has expired.`,
            metadata: {
              roleRequestId: req.id,
              requestedRoleKey: req.requestedRoleKey,
              expiredAt: now.toISOString(),
            },
          });
        });
        try { await this.cache.del(`rbac:permissions:${req.requesterId}`); } catch { /* optional */ }
        n++;
      } catch (err) {
        // Swallow per-request errors so sweep keeps going.
        console.error(`[role-requests] expireDueRequests failed for request=${req.id}:`, err);
      }
    }
    return n;
  }

  async bulkApproveMany(
    requestIds: string[],
    reviewerId: string,
    adminJustification: string,
    assignRole: (params: {
      userId: string;
      requestedRoleKey: string;
      assignedBy: string;
      expiresAt?: Date;
    }) => Promise<{ assignmentId?: string }>,
  ) {
    if (!Array.isArray(requestIds) || requestIds.length === 0) {
      throw new BadRequestException('requestIds must be a non-empty array.');
    }
    if (!adminJustification || adminJustification.trim().length < 5) {
      throw new BadRequestException('Admin justification is required (min 5 characters).');
    }

    const updated: string[] = [];
    const requests: any[] = [];
    const uniqueIds = Array.from(new Set(requestIds));

    for (const requestId of uniqueIds) {
      try {
        const result = await this.approveRequest({
          requestId,
          reviewerId,
          adminJustification,
          assignRole,
        });
        updated.push(requestId);
        requests.push(result);
      } catch (err) {
        const request = await this.prisma.rolePermissionRequest.findUnique({
          where: { id: requestId },
          include: {
            requester: { select: { id: true, name: true, handle: true, avatar: true, email: true } },
            reviewer: { select: { id: true, name: true, handle: true, avatar: true } },
            history: { orderBy: { createdAt: 'asc' } },
          },
        });
        if (request) {
          requests.push({
            ...request,
            bulkError: (err as Error).message,
          });
        } else {
          requests.push({
            id: requestId,
            bulkError: (err as Error).message || 'Request not found',
          });
        }
      }
    }

    return { updated, requests };
  }

  async bulkRejectMany(
    requestIds: string[],
    reviewerId: string,
    adminJustification: string,
  ) {
    if (!Array.isArray(requestIds) || requestIds.length === 0) {
      throw new BadRequestException('requestIds must be a non-empty array.');
    }
    if (!adminJustification || adminJustification.trim().length < 5) {
      throw new BadRequestException('Admin justification is required (min 5 characters).');
    }

    const updated: string[] = [];
    const requests: any[] = [];
    const uniqueIds = Array.from(new Set(requestIds));

    for (const requestId of uniqueIds) {
      try {
        const result = await this.rejectRequest({
          requestId,
          reviewerId,
          adminJustification,
        });
        updated.push(requestId);
        requests.push(result);
      } catch (err) {
        const request = await this.prisma.rolePermissionRequest.findUnique({
          where: { id: requestId },
          include: {
            requester: { select: { id: true, name: true, handle: true, avatar: true, email: true } },
            reviewer: { select: { id: true, name: true, handle: true, avatar: true } },
            history: { orderBy: { createdAt: 'asc' } },
          },
        });
        if (request) {
          requests.push({
            ...request,
            bulkError: (err as Error).message,
          });
        } else {
          requests.push({
            id: requestId,
            bulkError: (err as Error).message || 'Request not found',
          });
        }
      }
    }

    return { updated, requests };
  }
}
