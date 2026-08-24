import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Patch,
  Put,
  Delete,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { AccessRequestsService } from './access-requests.service';
import { AccessRequestStatus, AccessRequestType } from '@prisma/client';

@ApiTags('Access Control Requests')
@Controller('api/access-requests')
export class AccessRequestsController {
  constructor(private service: AccessRequestsService) { }

  // ─── User endpoints ──────────────────────────────────────────────────────────

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit an access request for a resource permission' })
  @ApiResponse({ status: 201, description: 'Request submitted (PENDING)' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async submit(
    @Request() req: any,
    @Body() body: {
      resourceType: string;
      resourceId?: string;
      permissionKey: string;
      type: AccessRequestType;
      justification: string;
      startsAt?: string;
      expiresAt?: string;
    },
  ) {
    return this.service.createRequest({
      requesterId: req.user.sub ?? req.user.id,
      resourceType: body.resourceType,
      resourceId: body.resourceId,
      permissionKey: body.permissionKey,
      type: body.type,
      justification: body.justification,
      startsAt: body.startsAt ? new Date(body.startsAt) : undefined,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
    });
  }

  // ─── Create role request ───

  @Post("role")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a ROLE ACCESS request (Scenario 1 & 2)' })
  @ApiResponse({ status: 201, description: 'Request created with PENDING status' })
  async createRoleRequest(@Request() req: Request, @Body() raw: any) {
    const userId = (req as any).user.sub ?? (req as any).user.id;
    const startsAt = raw.startsAt ? new Date(raw.startsAt) : undefined;
    const expiresAt = raw.expiresAt ? new Date(raw.expiresAt) : undefined;
    // Backward compat: frontends may send `targetRole` or `requestedRoleKey`
    const requestedRoleKey = raw.requestedRoleKey ?? raw.targetRole;
    return this.service.createRoleRequest(userId, {
      requestedRoleKey,
      type: raw.type === AccessRequestType.TEMPORARY ? AccessRequestType.TEMPORARY : AccessRequestType.PERMANENT,
      justification: raw.justification,
      startsAt,
      expiresAt,
    });
  }

  // ─── Create resource request ───

  @Post("resource")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a resource access request (Scenario 6 & 9)' })
  async createResourceRequest(@Request() req: Request, @Body() data: any) {
    const userId = (req as any).user.sub ?? (req as any).user.id;
    const startsAt = data.startsAt ? new Date(data.startsAt) : undefined;
    const expiresAt = data.expiresAt ? new Date(data.expiresAt) : undefined;
    // Frontend can send either `permission` or `permissionKey` — normalize
    const permission = data.permission ?? data.permissionKey;
    return this.service.createResourceRequest(userId, {
      resourceType: data.resourceType,
      resourceId: data.resourceId,
      permission,
      justification: data.justification,
      type: data.type === AccessRequestType.TEMPORARY ? AccessRequestType.TEMPORARY : AccessRequestType.PERMANENT,
      startsAt,
      expiresAt,
    });
  }

  // Compatibility endpoint: services.ts uses /access-requests/resources (plural) POST
  @Post("resources")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[compat] Alias for POST resource — matches services.ts createResourceAccessRequest' })
  async createResourceRequestCompat(@Request() req: Request, @Body() data: any) {
    return this.createResourceRequest(req, data);
  }

  // ─── Search resources ───

  @Post("/resources/search")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Search for resources to request access to (Scenario 5 & 7)' })
  async searchResources(
    @Request() req: Request, 
    @Query('query') queryFromQs?: string, 
    @Body() data?: { query?: string; limit?: number }
  ) {
    
    const userId = (req as any).user.sub ?? (req as any).user.id;
    const query = data?.query || queryFromQs || "";
    const limit = data?.limit ?? 20;
    return this.service.searchResources(userId, query, limit);
  }

  // Compatibility endpoint: services.ts uses /access-requests/resources/search POST
  @Post("resources/search")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[compat] Alias for POST search — matches services.ts searchResources' })
  async searchResourcesCompat(
    @Request() req: Request,
    @Body() data: { query?: string; limit?: number },
    @Query('query') queryFromQs?: string,
  ) {
    const userId = (req as any).user.sub ?? (req as any).user.id;
    // Accept query from either body or ?query= querystring (frontend sends both)
    const query = data?.query ?? queryFromQs ?? "";
    return this.service.searchResources(userId, query, data?.limit ?? 20);
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Current user's access requests" })
  async listMine(
    @Request() req: any,
    @Query('status') status?: AccessRequestStatus,
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
  @ApiOperation({ summary: 'Get a single access request (owner or admin)' })
  async getOne(@Request() req: any, @Param('id') id: string) {
    const userId = req.user.sub ?? req.user.id;
    const role = req.user?.role as string | undefined;
    const asAdmin = !!(role && ['ADMIN', 'PLATFORM_ADMIN', 'SUPER_ADMIN'].includes(role));
    return this.service.getRequestForActor(id, userId, { asAdmin });
  }

  @Patch(':id/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel one of your own PENDING access requests (Scenario 4)' })
  async cancelPatch(@Request() req: any, @Param('id') id: string) {
    const userId = req.user.sub ?? req.user.id;
    return this.service.cancelRequest(id, userId);
  }

  @Put(':id/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel one of your own PENDING access requests (legacy PUT alias)' })
  async cancel(@Request() req: any, @Param('id') id: string) {
    const userId = req.user.sub ?? req.user.id;
    return this.service.cancelRequest(id, userId);
  }

  // ─── Admin endpoints ─────────────────────────────────────────────────────────

  @Get()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[ADMIN] List all access requests with filtering & sorting' })
  @ApiResponse({ status: 200, description: 'Paginated request list' })
  @ApiResponse({ status: 403, description: 'Admin privileges required' })
  async adminList(
    @Query('requesterId') requesterId?: string,
    @Query('status') status?: AccessRequestStatus,
    @Query('resourceType') resourceType?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('orderBy') orderBy?: 'createdAt' | 'reviewedAt' | 'expiresAt',
    @Query('orderDir') orderDir?: 'asc' | 'desc',
  ) {
    return this.service.listRequests({
      requesterId,
      status,
      resourceType,
      page,
      limit,
      forAdminView: true,
      orderBy,
      orderDir,
    });
  }

  @Get('stats/summary')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[ADMIN] Get access request statistics' })
  @ApiResponse({ status: 200, description: 'Statistics summary' })
  async getStats() {
    return this.service.getStats();
  }

  @Patch(':id/approve')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[ADMIN] Approve a PENDING access request and grant access (Scenario 10)' })
  @ApiResponse({ status: 200, description: 'Approved; access granted' })
  @ApiResponse({ status: 400, description: 'Not PENDING / missing justification' })
  @ApiResponse({ status: 403, description: 'Cannot approve your own request' })
  async approvePatch(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { adminJustification?: string },
  ) {
    const reviewerId = req.user.sub ?? req.user.id;
    return this.service.approveRequest({
      requestId: id,
      reviewerId,
      adminJustification: body.adminJustification ?? "",
    });
  }

  @Put(':id/approve')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[ADMIN] Approve (legacy PUT alias)' })
  async approve(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { adminJustification: string },
  ) {
    const reviewerId = req.user.sub ?? req.user.id;
    return this.service.approveRequest({
      requestId: id,
      reviewerId,
      adminJustification: body.adminJustification,
    });
  }

  @Patch(':id/reject')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[ADMIN] Reject a PENDING access request (Scenario 11, justification required)' })
  @ApiResponse({ status: 200, description: 'Rejected' })
  async rejectPatch(
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

  @Put(':id/reject')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[ADMIN] Reject (legacy PUT alias)' })
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

  @Post('bulk/approve')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[ADMIN] Bulk approve multiple PENDING access requests (Scenario 12)' })
  async bulkApprove(
    @Request() req: any,
    @Body() body: { ids: string[]; adminJustification?: string },
  ) {
    const reviewerId = req.user.sub ?? req.user.id;
    return this.service.bulkApproveMany(body.ids, reviewerId, body.adminJustification ?? "");
  }

  @Post('bulk-approve')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[ADMIN] Bulk approve (legacy hyphen route)' })
  async bulkApproveLegacy(
    @Request() req: any,
    @Body() body: { ids: string[]; adminJustification: string },
  ) {
    const reviewerId = req.user.sub ?? req.user.id;
    return this.service.bulkApproveMany(body.ids, reviewerId, body.adminJustification);
  }

  @Post('bulk/reject')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[ADMIN] Bulk reject multiple PENDING access requests (Scenario 12, justification required)' })
  async bulkReject(
    @Request() req: any,
    @Body() body: { ids: string[]; adminJustification: string },
  ) {
    const reviewerId = req.user.sub ?? req.user.id;
    return this.service.bulkRejectMany(body.ids, reviewerId, body.adminJustification);
  }

  @Post('bulk-reject')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[ADMIN] Bulk reject (legacy hyphen route)' })
  async bulkRejectLegacy(
    @Request() req: any,
    @Body() body: { ids: string[]; adminJustification: string },
  ) {
    const reviewerId = req.user.sub ?? req.user.id;
    return this.service.bulkRejectMany(body.ids, reviewerId, body.adminJustification);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[ADMIN] Delete an access request (cleanup — zero-trust: service layer re-validates admin)' })
  async deleteRequest(@Request() req: any, @Param('id') id: string) {
    const actorId = req.user?.sub ?? req.user?.id;
    return this.service.deleteRequest(id, actorId);
  }

  // ─── Revoke endpoints ────────────────────────────────────────────────────────

  @Patch(':id/revoke')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[ADMIN] Revoke an APPROVED access request and deactivate grant(s)' })
  @ApiResponse({ status: 200, description: 'Revoked; prior grant(s) flipped to inactive' })
  async revokeByIdPatch(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { adminJustification?: string; reviewerId?: string },
  ) {
    const reviewerId = req.user.sub ?? req.user.id;
    const justification = body.adminJustification ?? "Revoked by admin (API default)";
    return this.service.revokeApprovedRequest(id, reviewerId, justification);
  }

  @Post(':id/revoke')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[ADMIN] Revoke (POST alias)' })
  async revokeByIdPost(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { adminJustification?: string },
  ) {
    const reviewerId = req.user.sub ?? req.user.id;
    const justification = body.adminJustification ?? "Revoked by admin";
    return this.service.revokeApprovedRequest(id, reviewerId, justification);
  }

  @Patch('revoke')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[ADMIN] Revoke (top-level PATCH alias with requestId in body)' })
  async revokeTopLevelPatch(
    @Request() req: any,
    @Body() body: { requestId: string; adminJustification?: string },
  ) {
    const reviewerId = req.user.sub ?? req.user.id;
    const justification = body.adminJustification ?? "Revoked by admin";
    return this.service.revokeApprovedRequest(body.requestId, reviewerId, justification);
  }

  // ─── Top-level approve / reject (body carries requestId) ─────────────────────

  @Patch('approve')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[ADMIN] Approve (top-level alias with requestId in body)' })
  async approveTopLevelPatch(
    @Request() req: any,
    @Body() body: { requestId: string; adminJustification?: string; reviewerId?: string },
  ) {
    const reviewerId = req.user.sub ?? req.user.id;
    return this.service.approveRequest({
      requestId: body.requestId,
      reviewerId,
      adminJustification: body.adminJustification ?? "",
    });
  }

  @Patch('reject')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[ADMIN] Reject (top-level alias with requestId in body)' })
  async rejectTopLevelPatch(
    @Request() req: any,
    @Body() body: { requestId: string; adminJustification: string },
  ) {
    const reviewerId = req.user.sub ?? req.user.id;
    return this.service.rejectRequest({
      requestId: body.requestId,
      reviewerId,
      adminJustification: body.adminJustification,
    });
  }

  // ─── Resource permissions ────────────────────────────────────────────────────

  @Get('resources/list')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all protected resource types' })
  async listResources() {
    return this.service.listResources();
  }

  @Get('resources/permissions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List permissions for a resource type (or all)' })
  async listPermissions(@Query('resourceType') resourceType?: string) {
    return this.service.listResourcePermissions(resourceType);
  }


  @Get("check")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check access to a resource' })
  async checkAccess(
    @Request() req: Request,
    @Query() params: { resourceType: string; resourceId: string; permissionKey: string }
  ) {
    const userId = (req as any).user.id;
    const hasAccess = await this.service.checkAccess(
      userId,
      params.resourceType,
      params.resourceId,
      params.permissionKey
    );
    return { hasAccess };
  }

  // ─── Get user's resource access ───

  @Get("my-access")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user\'s resource access' })
  async getMyResourceAccess(@Request() req: Request) {
    const userId = (req as any).user.id;
    return this.service.getUserResourceAccess(userId);
  }
}
