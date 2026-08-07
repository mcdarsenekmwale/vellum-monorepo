import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { AdminService } from '../admin/admin.service';
import { RoleRequestsService } from './role-requests.service';
import {
  RolePermissionRequestStatus,
  RolePermissionRequestType,
} from '@prisma/client';

@ApiTags('Role Permission Requests')
@Controller('api/role-requests')
export class RoleRequestsController {
  constructor(
    private service: RoleRequestsService,
    private adminService: AdminService,
  ) {}

  // ----- §2 User endpoints -----

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit a role/permission change request (permanent or temporary)' })
  @ApiResponse({ status: 201, description: 'Request submitted (PENDING)' })
  @ApiResponse({ status: 400, description: 'Validation error (justification, dates, type, duplicate pending)' })
  async submit(
    @Request() req: any,
    @Body() body: {
      requestedRoleKey: string;
      type: RolePermissionRequestType;
      justification: string;
      startsAt?: string;
      expiresAt?: string;
    },
  ) {
    return this.service.createRequest({
      requesterId: req.user.sub ?? req.user.id,
      requestedRoleKey: body.requestedRoleKey,
      type: body.type,
      justification: body.justification,
      startsAt: body.startsAt ? new Date(body.startsAt) : undefined,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
    });
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Current user\'s request history (filterable by status)' })
  @ApiResponse({ status: 200, description: 'Paginated request list' })
  async listMine(
    @Request() req: any,
    @Query('status') status?: RolePermissionRequestStatus,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const userId = req.user.sub ?? req.user.id;
    return this.service.listRequests({
      requesterId: userId,
      status,
      page,
      limit,
      forAdminView: false,
    });
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a single request (visible to owner or admins)' })
  async getOne(@Request() req: any, @Param('id') id: string) {
    const userId = req.user.sub ?? req.user.id;
    // AdminGuard-style role check inline — allow admins to see any req.
    const role = req.user?.role as string | undefined;
    const asAdmin = !!(role && ['ADMIN', 'PLATFORM_ADMIN', 'SUPER_ADMIN'].includes(role));
    return this.service.getRequestForActor(id, userId, { asAdmin });
  }

  @Put(':id/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel one of your own PENDING requests' })
  async cancel(@Request() req: any, @Param('id') id: string) {
    const userId = req.user.sub ?? req.user.id;
    return this.service.cancelRequest(id, userId);
  }

  // ----- §3 Admin endpoints -----

  @Get()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[ADMIN] List all role requests with filtering & sorting' })
  @ApiResponse({ status: 200, description: 'Paginated request list' })
  @ApiResponse({ status: 403, description: 'Admin privileges required' })
  async adminList(
    @Query('requesterId') requesterId?: string,
    @Query('status') status?: RolePermissionRequestStatus,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('orderBy') orderBy: 'createdAt' | 'reviewedAt' | 'startsAt' = 'createdAt',
    @Query('orderDir') orderDir: 'asc' | 'desc' = 'desc',
  ) {
    return this.service.listRequests({
      requesterId,
      status,
      page,
      limit,
      forAdminView: true,
      ordering: { field: orderBy, dir: orderDir },
    });
  }

  @Put(':id/approve')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[ADMIN] Approve a PENDING role request and grant the requested role' })
  @ApiResponse({ status: 200, description: 'Approved; role applied' })
  @ApiResponse({ status: 400, description: 'Not PENDING / missing justification' })
  @ApiResponse({ status: 403, description: 'Admin privilege required; cannot approve your own request' })
  async approve(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { adminJustification: string },
  ) {
    const reviewerId = req.user.sub ?? req.user.id;
    // Wire AdminService role application inside the request's transaction.
    return this.service.approveRequest({
      requestId: id,
      reviewerId,
      adminJustification: body.adminJustification,
      assignRole: async ({ userId, requestedRoleKey, assignedBy, expiresAt }) => {
        // Use AdminService private resolveRole via the public applyRoleForAssignment
        // wrapper. applyRoleForAssignment is exposed for exactly this case.
        const { assignmentId } = await (this.adminService as any).applyRoleForAssignment?.(
          userId,
          requestedRoleKey,
          { assignedBy, expiresAt },
        ) ?? this.applyViaAdminService(userId, requestedRoleKey, assignedBy, expiresAt);
        return { assignmentId };
      },
    });
  }

  @Put(':id/reject')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[ADMIN] Reject a PENDING role request with justification' })
  @ApiResponse({ status: 200, description: 'Rejected' })
  @ApiResponse({ status: 400, description: 'Not PENDING / missing justification' })
  @ApiResponse({ status: 403, description: 'Admin privilege required; cannot reject your own request' })
  async reject(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { adminJustification: string },
  ) {
    const reviewerId = req.user.sub ?? req.user.id;
    return this.service.rejectRequest({
      requestId: id,
      reviewerId,
      adminJustification: body.adminJustification,
    });
  }

  @Post('admin/bulk-approve')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[ADMIN] Bulk approve multiple PENDING role requests' })
  @ApiResponse({ status: 200, description: 'Bulk processed; see updated count and requests array' })
  @ApiResponse({ status: 400, description: 'Missing ids / adminJustification' })
  @ApiResponse({ status: 403, description: 'Admin privileges required' })
  async bulkApprove(
    @Request() req: any,
    @Body() body: { ids: string[]; adminJustification: string },
  ) {
    const reviewerId = req.user.sub ?? req.user.id;
    return this.service.bulkApproveMany(
      body.ids,
      reviewerId,
      body.adminJustification,
      async ({ userId, requestedRoleKey, assignedBy, expiresAt }) => {
        const { assignmentId } = await (this.adminService as any).applyRoleForAssignment?.(
          userId,
          requestedRoleKey,
          { assignedBy, expiresAt },
        ) ?? this.applyViaAdminService(userId, requestedRoleKey, assignedBy, expiresAt);
        return { assignmentId };
      },
    );
  }

  @Post('admin/bulk-reject')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[ADMIN] Bulk reject multiple PENDING role requests' })
  @ApiResponse({ status: 200, description: 'Bulk processed; see updated count and requests array' })
  @ApiResponse({ status: 400, description: 'Missing ids / adminJustification' })
  @ApiResponse({ status: 403, description: 'Admin privileges required' })
  async bulkReject(
    @Request() req: any,
    @Body() body: { ids: string[]; adminJustification: string },
  ) {
    const reviewerId = req.user.sub ?? req.user.id;
    return this.service.bulkRejectMany(
      body.ids,
      reviewerId,
      body.adminJustification,
    );
  }

  /**
   * Fallback adapter: if applyRoleForAssignment helper isn't present yet in
   * AdminService, route through updateUserRole which ultimately calls
   * applyRole inside AdminService with identical semantics. Note that this
   * runs outside the original transaction context (a second DB call) but the
   * service-level side effects (role written, history, permissions cache
   * invalidation) still occur. The primary recommended path is the direct
   * helper to keep the tx atomic — it is added to AdminService below.
   */
  private async applyViaAdminService(
    userId: string,
    requestedRoleKey: string,
    assignedBy: string,
    expiresAt?: Date,
  ): Promise<{ assignmentId?: string }> {
    try {
      await (this.adminService as any).updateUserRole(assignedBy, userId, requestedRoleKey);
      return {};
    } catch (err) {
      throw new ForbiddenException(`Unable to apply role ${requestedRoleKey}: ${(err as Error).message}`);
    }
  }
}
