import { Injectable, BadRequestException, ForbiddenException, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CacheService } from '../../shared/cache/cache.service';
import { AccessRequestStatus, AccessRequestType, Prisma } from '@prisma/client';
import { Cron, SchedulerRegistry } from '@nestjs/schedule';
import { NotificationsService } from '../notifications/notifications.service';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateAccessRequestArgs {
  requesterId: string;
  resourceType: string;
  resourceId?: string;
  permissionKey: string;
  type: AccessRequestType;
  justification: string;
  startsAt?: Date;
  expiresAt?: Date;
}

export interface ListAccessRequestFilters {
  requesterId?: string;
  status?: AccessRequestStatus;
  resourceType?: string;
  page?: number;
  limit?: number;
  forAdminView?: boolean;
  orderBy?: 'createdAt' | 'reviewedAt' | 'expiresAt';
  orderDir?: 'asc' | 'desc';
}

export interface ReviewAccessRequestArgs {
  requestId: string;
  reviewerId: string;
  adminJustification: string;
}

// ─── Valid resource types ─────────────────────────────────────────────────────

const VALID_RESOURCE_TYPES = new Set([
  'articles', 'highlights', 'playlists', 'tracks', 'tags', 'media',
  'users', 'roles', 'permissions', 'api', 'bots', 'tickets',
  'storage', 'knowledge_base', 'settings', 'features', 'analytics',
  'notifications', 'email', 'integrations',
]);

// ─── Performance / rate limit defaults ────────────────────────────────────────

const SEARCH_CACHE_TTL_SEC = 300; // 5 minutes
const ACCESS_CHECK_CACHE_TTL_SEC = 30; // 30 seconds
const RESOURCE_TYPE_DEFS_TTL_SEC = 3600; // 1 hour
const SEARCH_RATE_LIMIT_PER_MIN = 30;

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class AccessRequestsService {
  // Sliding-window rate limit: userId -> array of timestamps (ms) within last 60s
  private readonly searchRateWindow = new Map<string, number[]>();

  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
    @Optional() private notificationService?: NotificationsService,
    @Optional() private schedulerRegistry?: SchedulerRegistry,
  ) { }

  // ─── §0 Helpers: admin lookup + role gate (zero-trust service layer) ──────

  private readonly ADMIN_ROLES = new Set(['ADMIN', 'PLATFORM_ADMIN', 'SUPER_ADMIN', 'SUPERADMIN', 'OWNER']);

  /**
   * Resolve a user's role key. Supports:
   *  - user has a `role` string column (common case)
   *  - user has related UserRole rows (RBAC pattern) with active assignment
   */
  private async getUserRole(userId: string): Promise<string | null> {
    try {
      const user = await (this.prisma as any).user.findUnique?.({
        where: { id: userId },
        select: { role: true, isActive: true, id: true },
      });
      if (user?.role) return String(user.role).toUpperCase();
    } catch {
      // fall through to userRoles relation check
    }
    try {
      const roles = await (this.prisma as any).userRole?.findMany?.({
        where: { userId },
        select: { rbacRole: { select: { key: true } } },
      }) ?? [];
      for (const r of roles) if (r?.rbacRole?.key) return String(r.rbacRole.key).toUpperCase();
    } catch {
      // ignore
    }
    return null;
  }

  private async assertIsAdmin(userId: string): Promise<void> {
    // Admin self-check 1: cannot act on own requests (caller validates separately with requesterId check)
    const role = await this.getUserRole(userId);
    if (!role || !this.ADMIN_ROLES.has(role)) {
      throw new ForbiddenException('Admin privileges are required to approve/reject access requests');
    }
  }

  // ─── §1 Create ──────────────────────────────────────────────────────────────

  async createRequest(args: CreateAccessRequestArgs) {
    // Validate resource type
    if (!VALID_RESOURCE_TYPES.has(args.resourceType)) {
      throw new BadRequestException(
        `Invalid resource type "${args.resourceType}". Valid types: ${[...VALID_RESOURCE_TYPES].join(', ')}`,
      );
    }

    // Validate permission key format: must start with resource type
    if (!args.permissionKey.startsWith(`${args.resourceType}:`)) {
      throw new BadRequestException(
        `Permission key must start with "${args.resourceType}:" — got "${args.permissionKey}"`,
      );
    }

    // Validate justification
    if (!args.justification || args.justification.trim().length < 5) {
      throw new BadRequestException('Justification must be at least 5 characters');
    }

    // Validate type + dates
    if (args.type === AccessRequestType.TEMPORARY) {
      if (!args.startsAt || !args.expiresAt) {
        throw new BadRequestException('Temporary access requests require both startsAt and expiresAt');
      }
      if (args.expiresAt <= args.startsAt) {
        throw new BadRequestException('expiresAt must be after startsAt');
      }
      const minDuration = 30 * 60 * 1000; // 30 min
      if (args.expiresAt.getTime() - args.startsAt.getTime() < minDuration) {
        throw new BadRequestException('Temporary access must be at least 30 minutes');
      }
      // Scenario 16-18: Expiry date must be in the future
      const now = new Date();
      if (args.expiresAt.getTime() <= now.getTime()) {
        throw new BadRequestException('Expiry date must be in the future');
      }
    } else {
      if (args.startsAt || args.expiresAt) {
        throw new BadRequestException('Permanent access requests must not include start/expire dates');
      }
    }

    // Guard against duplicate PENDING requests
    const existing = await this.prisma.accessRequest.findFirst({
      where: {
        requesterId: args.requesterId,
        resourceType: args.resourceType,
        permissionKey: args.permissionKey,
        status: AccessRequestStatus.PENDING,
      },
    });
    if (existing) {
      throw new BadRequestException(
        `You already have a PENDING request for ${args.permissionKey}. Wait for it to be reviewed or cancel it first.`,
      );
    }

    // Create the request + first history event in a transaction
    const request = await this.prisma.$transaction(async (tx) => {
      const created = await tx.accessRequest.create({
        data: {
          requesterId: args.requesterId,
          resourceType: args.resourceType,
          resourceId: args.resourceId ?? null,
          permissionKey: args.permissionKey,
          type: args.type,
          status: AccessRequestStatus.PENDING,
          justification: args.justification.trim(),
          startsAt: args.startsAt ?? null,
          expiresAt: args.expiresAt ?? null,
          history: {
            create: {
              actorId: args.requesterId,
              transition: AccessRequestStatus.PENDING,
              reason: 'Request submitted',
            },
          },
        },
        include: {
          requester: { select: { id: true, name: true, email: true, avatar: true, handle: true } },
          reviewer: { select: { id: true, name: true, email: true } },
          history: { orderBy: { createdAt: 'desc' }, take: 10, include: { actor: { select: { id: true, name: true } } } },
        },
      });
      return created;
    });

    await this.invalidateCache();
    return request;
  }

  // ─── §2 List ────────────────────────────────────────────────────────────────

  async listRequests(filters: ListAccessRequestFilters) {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Prisma.AccessRequestWhereInput = {};
    if (filters.status) where.status = filters.status;
    if (filters.resourceType) where.resourceType = filters.resourceType;
    if (!filters.forAdminView) {
      // Non-admins only see their own requests
      where.requesterId = filters.requesterId;
    } else if (filters.requesterId) {
      where.requesterId = filters.requesterId;
    }

    const orderBy: Prisma.AccessRequestOrderByWithRelationInput = {};
    const field = filters.orderBy ?? 'createdAt';
    orderBy[field] = filters.orderDir ?? 'desc';

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

  // ─── §3 Get one ─────────────────────────────────────────────────────────────

  async getRequestForActor(requestId: string, actorId: string, opts: { asAdmin?: boolean }) {
    const request = await this.prisma.accessRequest.findUnique({
      where: { id: requestId },
      include: {
        requester: { select: { id: true, name: true, email: true, avatar: true, handle: true } },
        reviewer: { select: { id: true, name: true, email: true } },
        history: { orderBy: { createdAt: 'desc' }, take: 20, include: { actor: { select: { id: true, name: true } } } },
      },
    });

    if (!request) throw new NotFoundException('Access request not found');

    if (!opts.asAdmin && request.requesterId !== actorId) {
      throw new ForbiddenException('You can only view your own access requests');
    }

    return request;
  }

  // ─── §4 Approve ─────────────────────────────────────────────────────────────

  async approveRequest(args: ReviewAccessRequestArgs) {
    // ─── Validate admin justification (optional but with minimum length) ───
    // Scenario 10: Admin justification is OPTIONAL for approve.
    // When provided, enforce a minimal length so lazy approvals are discouraged.
    if (args.adminJustification && args.adminJustification.trim().length > 0 && args.adminJustification.trim().length < 3) {
      throw new BadRequestException('Admin justification must be at least 3 characters when provided');
    }

    // ─── §0 Zero-trust admin gating (BUG #6) ───
    await this.assertIsAdmin(args.reviewerId);

    // ─── Fetch the request ───
    const request = await this.prisma.accessRequest.findUnique({
      where: { id: args.requestId },
    });

    if (!request) {
      throw new NotFoundException('Access request not found');
    }

    // ─── Validate request status ───
    if (request.status !== AccessRequestStatus.PENDING) {
      throw new BadRequestException(`Request is ${request.status}, not PENDING — cannot approve`);
    }

    // ─── Prevent self-approval ───
    if (request.requesterId === args.reviewerId) {
      throw new ForbiddenException('You cannot approve your own access request');
    }

    const now = new Date();

    // ─── §BUG #9: TEMPORARY grants honor startsAt. If startsAt > now → not active yet.
    const grantShouldBeActiveNow = (() => {
      if (request.type !== AccessRequestType.TEMPORARY) return true;
      if (request.startsAt && request.startsAt.getTime() > now.getTime()) return false;
      return true;
    })();

    // ─── Transaction: Update request + grant access ───
    const updated = await this.prisma.$transaction(async (tx) => {
      // ─── 1. Update the request ───
      const updatedReq = await tx.accessRequest.update({
        where: { id: args.requestId },
        data: {
          status: AccessRequestStatus.APPROVED,
          reviewerId: args.reviewerId,
          reviewedAt: now,
          adminJustification: args.adminJustification?.trim() || null,
          history: {
            create: {
              actorId: args.reviewerId,
              transition: AccessRequestStatus.APPROVED,
              reason: args.adminJustification?.trim() || 'Approved by admin',
              metadata: {
                reviewerId: args.reviewerId,
                reviewedAt: now.toISOString(),
              },
            },
          },
        },
        include: {
          requester: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
              handle: true,
            },
          },
          reviewer: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      // ─── 2. Grant the access via UserResourceAccess (upsert to handle re-grants) ───
      const resourceId = request.resourceType === 'role'
        ? null  // Roles don't have a specific resource ID
        : request.resourceId;

      await tx.userResourceAccess.upsert({
        where: {
          UserResourceAccess_user_resource_perm_unique: {
            userId: request.requesterId,
            resourceType: request.resourceType,
            permissionKey: request.permissionKey,
          },
        },
        update: {
          // BUG #9 fix: set isActive according to grantShouldBeActiveNow (startsAt future → inactive)
          isActive: grantShouldBeActiveNow,
          grantedAt: now,
          grantedBy: args.reviewerId,
          expiresAt: request.expiresAt ?? null,
          resourceId: resourceId,
        },
        create: {
          userId: request.requesterId,
          resourceType: request.resourceType,
          resourceId: resourceId,
          permissionKey: request.permissionKey,
          grantedBy: args.reviewerId,
          expiresAt: request.expiresAt ?? null,
          isActive: grantShouldBeActiveNow,
          grantedAt: now,
        },
      });

      // ─── 3. If it's a role request, also update the user's actual role assignment
      //       so role-based checks across the app reflect the change.
      if (request.resourceType === 'role' && request.resourceId) {
        const expiresAt = request.type === AccessRequestType.TEMPORARY ? request.expiresAt : null;
        try {
          await (tx as any).user.update({
            where: { id: request.requesterId },
            data: {
              role: request.resourceId as any,
            },
          });
        } catch {
          // Ignore if user model doesn't have direct role column (will go via rbac relations)
        }

        try {
          await (tx as any).userRole?.upsert?.({
            where: {
              user_role_unique: { userId: request.requesterId, roleKey: request.resourceId },
            },
            update: {
              expiresAt,
              status: grantShouldBeActiveNow ? 'ACTIVE' : 'SCHEDULED',
            },
            create: {
              userId: request.requesterId,
              roleKey: request.resourceId,
              expiresAt,
              status: grantShouldBeActiveNow ? 'ACTIVE' : 'SCHEDULED',
            },
          });
        } catch {
          // Ignore if userRole model not defined
        }

        // Also add the legacy double-write to userResourceAccess with perm = role key
        // (kept for backwards compatibility with consumers of this table)
        await tx.userResourceAccess.upsert({
          where: {
            UserResourceAccess_user_resource_perm_unique: {
              userId: request.requesterId,
              resourceType: request.resourceType,
              permissionKey: request.resourceId,
            },
          },
          update: {
            isActive: grantShouldBeActiveNow,
            expiresAt: expiresAt,
            grantedAt: now,
          },
          create: {
            userId: request.requesterId,
            resourceType: request.resourceType,
            permissionKey: request.resourceId,
            isActive: grantShouldBeActiveNow,
            expiresAt: expiresAt,
            grantedAt: now,
          },
        });
      }

      return updatedReq;
    });

    // ─── Audit log ───
    await this.audit(args.reviewerId, 'ACCESS_REQUEST_APPROVE', 'access_request', {
      resourceId: args.requestId,
      details: {
        requesterId: request.requesterId,
        resourceType: request.resourceType,
        permissionKey: request.permissionKey,
        type: request.type,
        adminJustification: args.adminJustification?.trim() || null,
      },
    });

    // ─── Invalidate cache ───
    await this.invalidateCache();

    // ─── Send notifications (BUG #4a was: missing, or crashes when service null) ───
    await this.sendApprovalNotification(
      request.requesterId,
      request.resourceType,
      request.permissionKey,
      args.adminJustification?.trim() || null
    );

    return updated;
  }

  // ─── §5 Reject ──────────────────────────────────────────────────────────────

  async rejectRequest(args: ReviewAccessRequestArgs) {
    if (!args.adminJustification || args.adminJustification.trim().length < 3) {
      throw new BadRequestException('Admin justification must be at least 3 characters');
    }

    // §0 Zero-trust admin gating (BUG #6b)
    await this.assertIsAdmin(args.reviewerId);

    const request = await this.prisma.accessRequest.findUnique({ where: { id: args.requestId } });
    if (!request) throw new NotFoundException('Access request not found');
    if (request.status !== AccessRequestStatus.PENDING) {
      throw new BadRequestException(`Request is ${request.status}, not PENDING — cannot reject`);
    }
    if (request.requesterId === args.reviewerId) {
      throw new ForbiddenException('You cannot reject your own access request');
    }

    const now = new Date();

    const updated = await this.prisma.$transaction(async (tx) => {
      return tx.accessRequest.update({
        where: { id: args.requestId },
        data: {
          status: AccessRequestStatus.REJECTED,
          reviewerId: args.reviewerId,
          reviewedAt: now,
          adminJustification: args.adminJustification.trim(),
          history: {
            create: {
              actorId: args.reviewerId,
              transition: AccessRequestStatus.REJECTED,
              reason: args.adminJustification.trim(),
              metadata: {
                reviewerId: args.reviewerId,
                reviewedAt: now.toISOString(),
              },
            },
          },
        },
        include: {
          requester: { select: { id: true, name: true, email: true, avatar: true, handle: true } },
          reviewer: { select: { id: true, name: true, email: true } },
        },
      });
    });

    await this.audit(args.reviewerId, 'ACCESS_REQUEST_REJECT', 'access_request', {
      resourceId: args.requestId,
      details: {
        requesterId: request.requesterId,
        resourceType: request.resourceType,
        permissionKey: request.permissionKey,
        adminJustification: args.adminJustification.trim(),
      },
    });

    await this.invalidateCache();

    // §BUG #4b: notify requester of rejection (best-effort)
    await this.sendRejectionNotification(
      request.requesterId,
      request.resourceType,
      request.permissionKey,
      args.adminJustification.trim(),
    );

    return updated;
  }

  // ─── §6 Cancel (owner only) ─────────────────────────────────────────────────

  async cancelRequest(requestId: string, actorId: string) {
    const request = await this.prisma.accessRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Access request not found');
    if (request.requesterId !== actorId) {
      throw new ForbiddenException('You can only cancel your own access requests');
    }
    if (request.status !== AccessRequestStatus.PENDING) {
      throw new BadRequestException(`Request is ${request.status}, not PENDING — cannot cancel`);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      return tx.accessRequest.update({
        where: { id: requestId },
        data: {
          status: AccessRequestStatus.CANCELLED,
          reviewedAt: new Date(),
          adminJustification: 'Cancelled by requester',
          history: {
            create: {
              actorId,
              transition: AccessRequestStatus.CANCELLED,
              reason: 'Cancelled by requester',
              metadata: { cancelled: true },
            },
          },
        },
        include: {
          requester: { select: { id: true, name: true, email: true, avatar: true, handle: true } },
          reviewer: { select: { id: true, name: true, email: true } },
        },
      });
    });

    await this.invalidateCache();
    return updated;
  }

  // ─── §7 Bulk operations ─────────────────────────────────────────────────────

  async bulkApproveMany(ids: string[], reviewerId: string, adminJustification: string) {
    const uniqueIds = [...new Set(ids)];
    const results: any[] = [];
    let approved = 0;
    let failed = 0;

    for (const id of uniqueIds) {
      try {
        const updated = await this.approveRequest({ requestId: id, reviewerId, adminJustification });
        results.push(updated);
        approved++;
      } catch (err) {
        failed++;
        const req = await this.prisma.accessRequest.findUnique({ where: { id } }).catch(() => null);
        results.push({
          id,
          status: req?.status ?? 'NOT_FOUND',
          bulkError: (err as Error).message,
        });
      }
    }

    return { approved, failed, total: uniqueIds.length, requests: results };
  }

  async bulkRejectMany(ids: string[], reviewerId: string, adminJustification: string) {
    const uniqueIds = [...new Set(ids)];
    const results: any[] = [];
    let rejected = 0;
    let failed = 0;

    for (const id of uniqueIds) {
      try {
        const updated = await this.rejectRequest({ requestId: id, reviewerId, adminJustification });
        results.push(updated);
        rejected++;
      } catch (err) {
        failed++;
        const req = await this.prisma.accessRequest.findUnique({ where: { id } }).catch(() => null);
        results.push({
          id,
          status: req?.status ?? 'NOT_FOUND',
          bulkError: (err as Error).message,
        });
      }
    }

    return { rejected, failed, total: uniqueIds.length, requests: results };
  }

  // ─── §8 Statistics ──────────────────────────────────────────────────────────

  async getStats() {
    const [total, pending, approved, rejected, cancelled] = await Promise.all([
      this.prisma.accessRequest.count(),
      this.prisma.accessRequest.count({ where: { status: AccessRequestStatus.PENDING } }),
      this.prisma.accessRequest.count({ where: { status: AccessRequestStatus.APPROVED } }),
      this.prisma.accessRequest.count({ where: { status: AccessRequestStatus.REJECTED } }),
      this.prisma.accessRequest.count({ where: { status: AccessRequestStatus.CANCELLED } }),
    ]);

    // By resource type — use distinct findMany to avoid Prisma groupBy type issue
    const allRequests = await this.prisma.accessRequest.findMany({
      select: { resourceType: true },
    });
    const resourceCountMap = new Map<string, number>();
    for (const r of allRequests) {
      resourceCountMap.set(r.resourceType, (resourceCountMap.get(r.resourceType) ?? 0) + 1);
    }
    const byResource = [...resourceCountMap.entries()]
      .map(([resourceType, count]) => ({ resourceType, count }))
      .sort((a, b) => b.count - a.count);

    return {
      total,
      pending,
      approved,
      rejected,
      cancelled,
      byResource,
    };
  }

  // ─── §9 Resource permissions listing ────────────────────────────────────────

  async listResourcePermissions(resourceType?: string) {
    const where: Prisma.ResourcePermissionWhereInput = {};
    if (resourceType) where.resourceType = resourceType;

    return this.prisma.resourcePermission.findMany({
      where,
      orderBy: [{ resourceType: 'asc' }, { permissionKey: 'asc' }],
    });
  }

  async listResources() {
    // Return distinct resource types with their permission counts
    const allPerms = await this.prisma.resourcePermission.findMany({
      select: { resourceType: true },
    });
    const countMap = new Map<string, number>();
    for (const p of allPerms) {
      countMap.set(p.resourceType, (countMap.get(p.resourceType) ?? 0) + 1);
    }
    return [...countMap.entries()]
      .map(([type, permissionCount]) => ({ type, permissionCount }))
      .sort((a, b) => a.type.localeCompare(b.type));
  }

  // ─── §10 Auto-expire temporary access ───────────────────────────────────────

  async expireDueAccess(nowOverride?: Date): Promise<number> {
    const now = nowOverride ?? new Date();

    // Find active UserResourceAccess records that have expired
    const expired = await this.prisma.userResourceAccess.findMany({
      where: {
        isActive: true,
        expiresAt: { not: null, lt: now },
      },
      select: { id: true, userId: true, resourceType: true, permissionKey: true },
    });

    if (expired.length === 0) return 0;

    let n = 0;
    for (const access of expired) {
      try {
        await this.prisma.userResourceAccess.update({
          where: { id: access.id },
          data: { isActive: false },
        });
        await this.audit(null, 'ACCESS_AUTO_EXPIRE', 'user_resource_access', {
          resourceId: access.id,
          details: { userId: access.userId, resourceType: access.resourceType, permissionKey: access.permissionKey },
        });
        n++;
      } catch {
        // continue on error
      }
    }

    return n;
  }

  // ─── §11 Delete request (admin only, for cleanup) ──────────────────────────

  /**
   * Hard-delete a request. Requires admin privileges (zero-trust — BUG #7).
   * If the request is/was APPROVED, the underlying userResourceAccess grant is deactivated first.
   */
  async deleteRequest(requestId: string, actorId?: string) {
    // §0 Zero-trust admin gating (BUG #7): must be admin to perform destructive cleanup
    if (actorId) await this.assertIsAdmin(actorId);

    const request = await this.prisma.accessRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Access request not found');

    // §BUG #3: If APPROVED, deactivate the underlying grant so deleting the request
    // doesn't silently orphan active permissions with no audit trail.
    if (request.status === AccessRequestStatus.APPROVED) {
      await this.prisma.userResourceAccess.updateMany({
        where: {
          userId: request.requesterId,
          resourceType: request.resourceType,
          permissionKey: request.permissionKey,
        },
        data: { isActive: false },
      }).catch(() => null);
    }

    await this.audit(actorId ?? null, 'ACCESS_REQUEST_DELETE', 'access_request', {
      resourceId: requestId,
      details: { requesterId: request.requesterId, status: request.status },
    });

    await this.prisma.accessRequest.delete({ where: { id: requestId } });
    await this.invalidateCache();
    return { id: requestId, deleted: true };
  }

  /**
   * §BUG #3 — Revoke an APPROVED request: flip status back to REVOKED and
   * deactivate the associated UserResourceAccess row(s) plus user role if applicable.
   * Exposed for admin manual revocations / future controller integration.
   */
  async revokeApprovedRequest(requestId: string, reviewerId: string, adminJustification: string) {
    if (!adminJustification || adminJustification.trim().length < 3) {
      throw new BadRequestException('Revocation justification must be at least 3 characters');
    }
    await this.assertIsAdmin(reviewerId);

    const request = await this.prisma.accessRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Access request not found');
    if (request.status !== AccessRequestStatus.APPROVED) {
      throw new BadRequestException(`Only APPROVED requests can be revoked (current: ${request.status})`);
    }

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.accessRequest.update({
        where: { id: requestId },
        data: {
          // Using REJECTED state + adminJustification = revocation note as a readable audit trail
          status: AccessRequestStatus.REJECTED,
          reviewerId,
          reviewedAt: now,
          adminJustification: adminJustification.trim(),
          history: {
            create: {
              actorId: reviewerId,
              transition: AccessRequestStatus.REJECTED,
              reason: adminJustification.trim(),
              metadata: { revoked: true, reviewedAt: now.toISOString() },
            },
          },
        },
      });

      // Cascade: disable grant rows
      await tx.userResourceAccess.updateMany({
        where: {
          userId: request.requesterId,
          resourceType: request.resourceType,
          OR: [
            { permissionKey: request.permissionKey },
            request.resourceType === 'role' && request.resourceId
              ? { permissionKey: request.resourceId }
              : ({} as any),
          ].filter(Boolean),
        },
        data: { isActive: false },
      });

      // If role-based, revert the user.role direct column if it currently matches
      if (request.resourceType === 'role' && request.resourceId) {
        try {
          const usr = await (tx as any).user.findUnique?.({
            where: { id: request.requesterId },
            select: { role: true },
          });
          if (usr?.role === request.resourceId) {
            await (tx as any).user.update?.({
              where: { id: request.requesterId },
              data: { role: 'USER' },
            });
          }
        } catch { /* ignore */ }
        try {
          await (tx as any).userRole?.updateMany?.({
            where: { userId: request.requesterId, roleKey: request.resourceId },
            data: { status: 'REVOKED' },
          });
        } catch { /* ignore */ }
      }
    });

    await this.audit(reviewerId, 'ACCESS_REQUEST_REVOKE', 'access_request', {
      resourceId: requestId,
      details: { requesterId: request.requesterId, adminJustification: adminJustification.trim() },
    });
    await this.invalidateCache();
    return this.prisma.accessRequest.findUnique({ where: { id: requestId } });
  }


  //


  // ─── Constants ───

  private readonly RESOURCE_TYPES = [
    "ticket",
    "article",
    "highlight",
    "video",
    "image",
    "music",
    "playlist",
    "tag",
    "user",
    "bot",
    "storage",
    "settings",
    "integration",
    "category",
    "api",
    "media",
  ];

  private readonly PERMISSIONS = ["read", "write", "delete", "admin"];

  // ─── Create Role Request ───

  async createRoleRequest(
    userId: string,
    data: {
      requestedRoleKey: string;
      type: AccessRequestType;
      justification: string;
      startsAt?: Date;
      expiresAt?: Date;
    }
  ) {
    // §4.3: Justification must exist AND be >= 5 chars
    if (!data.justification || data.justification.trim().length < 5) {
      throw new BadRequestException("Justification is required and must be at least 5 characters");
    }

    // Normalize role key: accept both legacy User.role casing (ADMIN, MODERATOR, CREATOR, USER,
    // SUPER_ADMIN, PLATFORM_ADMIN) and rbacRole.key snake_case (super_admin, platform_admin etc).
    // Produces a 3-step resolution strategy:
    //   1. Exact match against rbacRole.key (snake_case, seeded)
    //   2. UPPER_SNAKE → snake_case translation ("SUPER_ADMIN" → "super_admin")
    //   3. Legacy short-form alias map ("ADMIN" → "platform_admin", "MODERATOR" → "moderator" etc)
    const raw = (data.requestedRoleKey ?? "").trim();
    if (!raw) {
      throw new BadRequestException("Requested role key is required");
    }
    const LEGACY_SHORT_ALIAS: Record<string, string> = {
      ADMIN: "platform_admin",
      USER: "user",
      MODERATOR: "moderator",
      CREATOR: "creator",
      SUPERADMIN: "super_admin",
      OWNER: "super_admin",
    };
    const asSnake = raw.replace(/([A-Z]+)/g, "_$1").replace(/^_/, "").toLowerCase();
    const candidates = Array.from(new Set<string>([
      raw,
      raw.toLowerCase(),
      asSnake,
      LEGACY_SHORT_ALIAS[raw] ?? null,
      LEGACY_SHORT_ALIAS[raw.toUpperCase()] ?? null,
      // Common extra mapping: frontend may send "super_admin" as "SUPER_ADMIN"
      raw.toUpperCase() === "SUPER_ADMIN" ? "super_admin" : null,
      raw.toUpperCase() === "PLATFORM_ADMIN" ? "platform_admin" : null,
      raw.toUpperCase() === "ORGANIZATION_ADMIN" ? "organization_admin" : null,
    ].filter((x): x is string => !!x)));

    let role: any = null;
    let resolvedKey: string | null = null;
    for (const cand of candidates) {
      try {
        const found = await this.prisma.rbacRole.findUnique({
          where: { key: cand },
        });
        if (found) { role = found; resolvedKey = cand; break; }
      } catch {
        // Some Prisma client configs throw on unknown relation — keep trying
      }
    }

    // If still no role, treat legacy user-role enum requests as best-effort valid
    // (User.role column uses ADMIN/USER/MODERATOR/CREATOR — the approval will update
    // user.role directly if the request is role-based).
    if (!role) {
      const upper = raw.toUpperCase();
      const LEGACY_USER_ROLES = new Set(["ADMIN", "USER", "MODERATOR", "CREATOR", "SUPER_ADMIN", "PLATFORM_ADMIN", "SUPPORT_ADMIN"]);
      if (LEGACY_USER_ROLES.has(upper)) {
        resolvedKey = upper;
        role = { key: resolvedKey, name: upper, isSystem: true };
      }
    }

    if (!role || !resolvedKey) {
      throw new NotFoundException(`Role "${data.requestedRoleKey}" not found`);
    }

    // Check if user already has a pending request for this role
    const existing = await this.prisma.accessRequest.findFirst({
      where: {
        requesterId: userId,
        resourceType: "role",
        resourceId: resolvedKey,
        status: AccessRequestStatus.PENDING,
      },
    });

    if (existing) {
      throw new ForbiddenException("You already have a pending request for this role");
    }

    // Validate temporary dates (Scenario 2 & 16-18)
    if (data.type === AccessRequestType.TEMPORARY) {
      if (!data.startsAt || !data.expiresAt) {
        throw new BadRequestException("Temporary requests require start and end dates");
      }
      const diffMinutes = (data.expiresAt.getTime() - data.startsAt.getTime()) / (1000 * 60);
      if (diffMinutes < 30) {
        throw new BadRequestException("Temporary access must be at least 30 minutes");
      }
      if (data.expiresAt.getTime() <= Date.now()) {
        throw new BadRequestException("Expiry date must be in the future");
      }
      if (data.expiresAt <= data.startsAt) {
        throw new BadRequestException("Expiry date must be after start date");
      }
    }

    return this.prisma.accessRequest.create({
      data: {
        requesterId: userId,
        resourceType: "role",
        resourceId: resolvedKey,
        permissionKey: "role:assign",
        type: data.type,
        justification: data.justification.trim(),
        startsAt: data.startsAt,
        expiresAt: data.expiresAt,
        status: AccessRequestStatus.PENDING,
        history: {
          create: {
            actorId: userId,
            transition: AccessRequestStatus.PENDING,
            reason: 'Role access request submitted',
          },
        },
      },
      include: {
        requester: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            handle: true,
          },
        },
        history: { orderBy: { createdAt: 'desc' }, take: 5, include: { actor: { select: { id: true, name: true } } } },
      },
    });
  }

  // ─── Create Resource Request ───

  async createResourceRequest(
    userId: string,
    data: {
      resourceType: string;
      resourceId: string;
      permission: string;
      justification: string;
      type: AccessRequestType;
      startsAt?: Date;
      expiresAt?: Date;
    }
  ) {
    // Normalize resource type: accept both singular "ticket" and plural "tickets".
    // We normalize to the ALLOWED set value.
    const rawType = (data.resourceType ?? "").trim().toLowerCase();
    const isSingular = (t: string, p: string) => t === p || p === t + "s";
    const resolvedPlural = [...VALID_RESOURCE_TYPES].find((p) => isSingular(rawType, p)) ?? null;
    if (!resolvedPlural) {
      throw new BadRequestException(`Unsupported resource type: ${data.resourceType}. Valid types: ${[...VALID_RESOURCE_TYPES].join(', ')}`);
    }
    const resourceType = resolvedPlural;

    // §4.3 Validate permission against allowed list — accept both "read" and "ticket:read"
    const PERMISSIONS = ["read", "write", "delete", "admin"] as const;
    const rawPerm = (data.permission ?? "").trim().toLowerCase();
    // Strip the "<resourceType>:" prefix if present for the base-permission gate
    const stripped = rawPerm.startsWith(`${resourceType}:`)
      ? rawPerm.slice(resourceType.length + 1)
      : rawPerm.startsWith(rawType + ":")
        ? rawPerm.slice(rawType.length + 1)
        : rawPerm;
    if (!PERMISSIONS.includes(stripped as any)) {
      throw new BadRequestException(`Unsupported permission: ${data.permission}. Valid permissions: ${PERMISSIONS.join(', ')}`);
    }

    // §BUG #2: Normalize permissionKey to always be the prefixed form <resourceType>:<base>
    // so downstream userResourceAccess unique keys and checkAccess queries line up correctly.
    const permissionKey = `${resourceType}:${stripped}`;

    // Justification required and >= 5 chars
    if (!data.justification || data.justification.trim().length < 5) {
      throw new BadRequestException("Justification is required and must be at least 5 characters");
    }

    // Check if user already has a pending request for this resource + permission (Scenario 8)
    const existing = await this.prisma.accessRequest.findFirst({
      where: {
        requesterId: userId,
        resourceType,
        resourceId: data.resourceId,
        permissionKey,
        status: AccessRequestStatus.PENDING,
      },
    });

    if (existing) {
      throw new ForbiddenException("You already have a pending request for this resource and permission");
    }

    // Validate temporary dates
    if (data.type === AccessRequestType.TEMPORARY) {
      if (!data.startsAt || !data.expiresAt) {
        throw new BadRequestException("Temporary requests require start and end dates");
      }
      const diffMinutes = (data.expiresAt.getTime() - data.startsAt.getTime()) / (1000 * 60);
      if (diffMinutes < 30) {
        throw new BadRequestException("Temporary access must be at least 30 minutes");
      }
      if (data.expiresAt.getTime() <= Date.now()) {
        throw new BadRequestException("Expiry date must be in the future");
      }
      if (data.expiresAt <= data.startsAt) {
        throw new BadRequestException("Expiry date must be after start date");
      }
    }

    return this.prisma.accessRequest.create({
      data: {
        requesterId: userId,
        resourceType,
        resourceId: data.resourceId,
        permissionKey,
        type: data.type,
        justification: data.justification.trim(),
        startsAt: data.startsAt,
        expiresAt: data.expiresAt,
        status: AccessRequestStatus.PENDING,
        history: {
          create: {
            actorId: userId,
            transition: AccessRequestStatus.PENDING,
            reason: 'Resource access request submitted',
            metadata: { normalizedPermissionKey: permissionKey },
          },
        },
      },
      include: {
        requester: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            handle: true,
          },
        },
        history: { orderBy: { createdAt: 'desc' }, take: 5, include: { actor: { select: { id: true, name: true } } } },
      },
    });
  }

  // ─── Search Resources ───

  private getSearchCacheKey(query: string, limit: number): string {
    return `search:${query.toLowerCase().trim()}:${limit}`;
  }

  /** Rate limit: sliding window — 30 searches per minute per user */
  checkRateLimit(userId: string): void {
    const now = Date.now();
    const WINDOW_MS = 60_000;
    let entries = this.searchRateWindow.get(userId) ?? [];
    // Drop expired timestamps
    entries = entries.filter(t => now - t < WINDOW_MS);
    if (entries.length >= SEARCH_RATE_LIMIT_PER_MIN) {
      throw new BadRequestException(
        `Too many search requests. Please slow down (max ${SEARCH_RATE_LIMIT_PER_MIN}/minute).`,
      );
    }
    entries.push(now);
    this.searchRateWindow.set(userId, entries);
  }

  /** Score a match based on §4.1: exact ID=100, exact title/name=80, partial title/number=50, description=30 */
  private scoreMatch(query: string, fields: { id?: string; title?: string; name?: string; subject?: string; ticketNumber?: string; description?: string; excerpt?: string }): number {
    const q = query.toLowerCase().trim();
    if (!q) return 0;
    let best = 0;
    if (fields.id && fields.id.toLowerCase() === q) best = Math.max(best, 100);
    for (const exact of [fields.title, fields.name, fields.subject, fields.ticketNumber]) {
      if (exact && exact.toLowerCase() === q) best = Math.max(best, 80);
    }
    for (const partial of [fields.title, fields.name, fields.subject, fields.ticketNumber]) {
      if (partial && partial.toLowerCase().includes(q)) best = Math.max(best, 50);
    }
    for (const desc of [fields.description, fields.excerpt]) {
      if (desc && desc.toLowerCase().includes(q)) best = Math.max(best, 30);
    }
    return best;
  }

  async searchResources(userId: string, query: string, limit: number = 20) {
    // §3.3 Rate limit
    this.checkRateLimit(userId);

    const finalLimit = Math.max(1, Math.min(50, limit));
    const cacheKey = this.getSearchCacheKey(query, finalLimit);

    // §3.1 Cache hit
    const cached = await this.cache.get(cacheKey).catch(() => undefined);
    if (cached != null) {
      return cached as any[];
    }

    const q = (query ?? "").trim();
    const results: any[] = [];

    if (!q) {
      await this.cache.set(cacheKey, results, SEARCH_CACHE_TTL_SEC).catch(() => null);
      return results;
    }

    // ─── Search Tickets ───
    const tickets = await this.prisma.supportTicket.findMany({
      where: {
        OR: [
          { ticketNumber: { contains: q, mode: "insensitive" } },
          { subject: { contains: q, mode: "insensitive" } },
          { id: { contains: q, mode: "insensitive" } },
        ],
        deletedAt: null,
      },
      take: finalLimit,
      select: {
        id: true,
        ticketNumber: true,
        subject: true,
        status: true,
        priority: true,
        createdAt: true,
      },
    });

    tickets.forEach((t) => {
      const score = this.scoreMatch(q, { id: t.id, ticketNumber: t.ticketNumber, subject: t.subject });
      results.push({
        id: t.id,
        type: "ticket",
        title: t.subject,
        subject: t.subject,
        number: t.ticketNumber,
        status: t.status,
        priority: t.priority,
        createdAt: t.createdAt,
        score,
      });
    });

    // ─── Search Articles ───
    const articles = await this.prisma.article.findMany({
      where: {
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { slug: { contains: q, mode: "insensitive" } },
          { id: { contains: q, mode: "insensitive" } },
          { excerpt: { contains: q, mode: "insensitive" } },
        ],
        deletedAt: null,
      },
      take: finalLimit,
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        isPublished: true,
        createdAt: true,
      },
    });

    articles.forEach((a) => {
      const score = this.scoreMatch(q, { id: a.id, title: a.title, description: a.excerpt });
      results.push({
        id: a.id,
        type: "article",
        title: a.title,
        description: a.excerpt,
        status: a.isPublished ? "published" : "draft",
        createdAt: a.createdAt,
        score,
      });
    });

    // ─── Search Highlights ───
    const highlights = await this.prisma.highlight.findMany({
      where: {
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
          { id: { contains: q, mode: "insensitive" } },
        ],
        deletedAt: null,
      },
      take: finalLimit,
      select: {
        id: true,
        title: true,
        description: true,
        isPublished: true,
        createdAt: true,
      },
    });

    highlights.forEach((h) => {
      const score = this.scoreMatch(q, { id: h.id, title: h.title, description: h.description });
      results.push({
        id: h.id,
        type: "highlight",
        title: h.title,
        description: h.description,
        status: h.isPublished ? "published" : "draft",
        createdAt: h.createdAt,
        score,
      });
    });

    // ─── Search Playlists ───
    try {
      const playlists = await (this.prisma as any).playlist?.findMany?.({
        where: {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { id: { contains: q, mode: "insensitive" } },
          ],
        },
        take: Math.min(finalLimit, 10),
        select: { id: true, name: true, createdAt: true },
      }) ?? [];
      playlists.forEach((p: any) => {
        const score = this.scoreMatch(q, { id: p.id, name: p.name });
        results.push({ id: p.id, type: "playlist", title: p.name, createdAt: p.createdAt, score });
      });
    } catch { /* ignore if prisma model missing */ }

    // ─── Search Users ───
    const users = await this.prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { handle: { contains: q, mode: "insensitive" } },
          { id: { contains: q, mode: "insensitive" } },
        ],
        deletedAt: null,
      },
      take: Math.min(finalLimit, 10),
      select: {
        id: true,
        name: true,
        email: true,
        handle: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    users.forEach((u) => {
      const score = this.scoreMatch(q, { id: u.id, name: u.name });
      results.push({
        id: u.id,
        type: "user",
        title: u.name,
        handle: u.handle,
        email: u.email,
        status: u.isActive ? "active" : "inactive",
        role: u.role,
        createdAt: u.createdAt,
        score,
      });
    });

    // ─── Search Tags ───
    const tags = await this.prisma.tag.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { slug: { contains: q, mode: "insensitive" } },
          { id: { contains: q, mode: "insensitive" } },
        ],
      },
      take: Math.min(finalLimit, 10),
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
      },
    });

    tags.forEach((t) => {
      const score = this.scoreMatch(q, { id: t.id, name: t.name });
      results.push({
        id: t.id,
        type: "tag",
        title: t.name,
        slug: t.slug,
        createdAt: t.createdAt,
        score,
      });
    });

    // ─── §4.1 Sort by relevance (score desc), tiebreak newest first ───
    results.sort((a, b) => {
      const sDiff = (b.score ?? 0) - (a.score ?? 0);
      if (sDiff !== 0) return sDiff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const final = results.slice(0, finalLimit);

    // §3.1 Store cache (ttl 5 min)
    await this.cache.set(cacheKey, final, SEARCH_CACHE_TTL_SEC).catch(() => null);

    return final;
  }

  // ─── Check Access ───

  private getAccessCheckCacheKey(userId: string, resourceType: string, resourceId: string, permissionKey: string): string {
    return `access-check:${userId}:${resourceType}:${resourceId ?? '*'}:${permissionKey}`;
  }

  async checkAccess(
    userId: string,
    resourceType: string,
    resourceId: string,
    permissionKey: string
  ): Promise<boolean> {
    const cacheKey = this.getAccessCheckCacheKey(userId, resourceType, resourceId, permissionKey);
    const cached = await this.cache.get(cacheKey).catch(() => undefined);
    if (cached !== undefined) return cached === true;

    const access = await this.prisma.userResourceAccess.findUnique({
      where: {
        UserResourceAccess_user_resource_perm_unique: {
          userId,
          resourceType,
          permissionKey,
        },
      },
    });

    let hasAccess = true;
    if (!access) hasAccess = false;
    else if (!access.isActive) hasAccess = false;
    else if (access.expiresAt && access.expiresAt < new Date()) hasAccess = false;

    // §3.1 Cache 30 seconds
    await this.cache.set(cacheKey, hasAccess, ACCESS_CHECK_CACHE_TTL_SEC).catch(() => null);

    return hasAccess;
  }

  // ─── §3.1 Batch access check (multiple permissions at once) ─────────────────

  async batchCheckAccess(
    userId: string,
    checks: Array<{ resourceType: string; resourceId: string; permissionKey: string }>
  ): Promise<boolean[]> {
    // Parallel + individual caching for each entry
    return Promise.all(
      checks.map(c => this.checkAccess(userId, c.resourceType, c.resourceId, c.permissionKey)),
    );
  }

  // ─── Get Resource Access ───

  async getUserResourceAccess(userId: string) {
    return this.prisma.userResourceAccess.findMany({
      where: {
        userId,
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });
  }

  // ─── Scheduler: revoke expired temp access every 15 minutes (§3.4) ─────────

  @Cron('*/15 * * * *', { name: 'access_requests_revoke_expired' })
  async scheduledRevokeExpiredAccess() {
    try {
      await this.expireDueAccess();
    } catch (err) {
      // best-effort; never crash scheduler loop
    }
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private async invalidateCache() {
    await this.cache.del('access-requests:stats').catch(() => null);
    await this.cache.del('access-requests:list').catch(() => null);
  }

  private async audit(
    userId: string | null,
    action: string,
    resource: string,
    opts?: { resourceId?: string; details?: Record<string, unknown>; success?: boolean },
  ) {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId,
          action,
          resource,
          resourceId: opts?.resourceId ?? null,
          details: opts?.details ? (opts.details as any) : null,
          success: opts?.success ?? true,
        },
      });
    } catch {
      /* best-effort */
    }
  }

  //helpers

  // ─── Notification Sending ───
  private async sendApprovalNotification(
    userId: string,
    resourceType: string,
    permissionKey: string,
    adminJustification: string | null
  ) {
    // Best-effort: optional service, never throw on notification failure
    if (!this.notificationService) return;
    try {
      await this.notificationService.createNotification({
        userId,
        kind: 'ACCESS_APPROVED' as never,
        title: 'Your access request has been approved',
        body: `Your request for ${permissionKey} access to ${resourceType} has been approved.${adminJustification ? `\nAdmin note: ${adminJustification}` : ''}`,
        metadata: {
          resourceType,
          permissionKey,
          adminJustification,
        },
      });
    } catch {
      /* best-effort */
    }
  }

  private async sendRejectionNotification(
    userId: string,
    resourceType: string,
    permissionKey: string,
    adminJustification: string,
  ) {
    if (!this.notificationService) return;
    try {
      await this.notificationService.createNotification({
        userId,
        kind: 'ACCESS_REJECTED' as never,
        title: 'Your access request has been rejected',
        body: `Your request for ${permissionKey} access to ${resourceType} was rejected.${adminJustification ? `\nReason: ${adminJustification}` : ''}`,
        metadata: {
          resourceType,
          permissionKey,
          adminJustification,
        },
      });
    } catch {
      /* best-effort */
    }
  }
}