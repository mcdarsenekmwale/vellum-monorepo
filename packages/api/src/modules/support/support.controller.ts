import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SupportService } from './support.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { Permissions } from '../rbac/permissions.decorator';
import { TicketStatus, TicketPriority, TicketType, AgentStatus, Role, AccessRequestStatus, AccessRequestType } from '@prisma/client';
import { UpdateAgentDto, UpdateDepartmentDto, UpdateTeamDto } from './dto/support-relations.dto';
import { Roles } from '../auth/roles.decorator';
import { SupportAdminGuard } from '../auth/support-admin.guard';

@ApiTags('Support')
@Controller('api/support')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SupportController {
  constructor(private supportService: SupportService) { }

  // ─── Dashboard ─────────────────────────────────────────────────────────────

  @Get('dashboard')
  @Permissions('tickets.view')
  @ApiOperation({ summary: 'Support dashboard stats' })
  async getDashboard(
    @Req() req?: { user?: { id: string; role?: Role | null } },
  ) {
    const actor = req?.user ? { id: req.user.id, role: req.user.role ?? null } : undefined;
    return this.supportService.getSupportDashboard(actor);
  }

  @Get('sla-dashboard')
  @Permissions('tickets.view')
  @ApiOperation({ summary: 'SLA dashboard' })
  async getSlaDashboard() {
    return this.supportService.getSlaDashboard();
  }

  // ─── Tickets ───────────────────────────────────────────────────────────────

  @Get('tickets')
  @Permissions('tickets.view')
  @ApiOperation({ summary: 'List tickets' })
  async listTickets(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: TicketStatus,
    @Query('priority') priority?: TicketPriority,
    @Query('assigneeId') assigneeId?: string,
    @Query('departmentId') departmentId?: string,
    @Query('teamId') teamId?: string,
    @Query('categoryId') categoryId?: string,
    @Query('search') search?: string,
    @Query('unassigned') unassigned?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('orderBy') orderBy?: 'createdAt' | 'updatedAt' | 'priority' | 'status',
    @Query('orderDir') orderDir?: 'asc' | 'desc',
    @Req() req?: { user?: { id: string; role?: Role | null } },
  ) {
    const actor = req?.user ? { id: req.user.id, role: req.user.role ?? null } : undefined;
    return this.supportService.listTickets({
      page, limit, status, priority, assigneeId, departmentId, teamId, categoryId, search,
      unassigned: unassigned === 'true',
      dateFrom, dateTo, orderBy, orderDir,
      actor,
    });
  }

  // ─── Deleted Tickets ───────────────────────────────────────────────────────────

  @Get('/tickets/deleted')
  @ApiOperation({ summary: 'List deleted tickets' })
  @UseGuards(JwtAuthGuard, SupportAdminGuard)
  async getDeletedTickets(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Req() req?: { user?: { id: string; role?: Role | null } },
  ) {
    const actor = req?.user ? { id: req.user.id, role: req.user.role ?? null } : undefined;
    return this.supportService.getDeletedTickets({
      page, limit,
      actor,
    });
  }


  @Get('tickets/:id/access')
  @Permissions('tickets.view')
  @ApiOperation({ summary: 'Check whether the current user has access to a ticket' })
  async checkTicketAccess(
    @Param('id') id: string,
    @Req() req: { user: { id: string; role?: Role | null } },
  ) {
    const result = await this.supportService.canAccessTicket(id, {
      id: req.user.id,
      role: req.user.role ?? null,
    });
    return result;
  }

  @Post('tickets')
  @Permissions('tickets.create')
  @ApiOperation({ summary: 'Create ticket (accepts subject/title + message/description aliases for frontend compatibility)' })
  async createTicket(
    @Body() body: {
      subject?: string;
      title?: string;
      message?: string;
      description?: string;
      type?: TicketType;
      priority?: TicketPriority;
      categoryId?: string;
      departmentId?: string;
      teamId?: string;
    },
    @Req() req: { user: { id: string } },
  ) {
    return this.supportService.createTicket(req.user.id, body);
  }

  @Put('tickets/:id/status')
  @Permissions('tickets.close')
  @ApiOperation({ summary: 'Update ticket status' })
  async updateStatus(
    @Param('id') id: string,
    @Body() body: { status: TicketStatus; reason?: string },
    @Req() req: { user: { id: string } },
  ) {
    return this.supportService.updateTicketStatus(id, body.status, req.user.id, body.reason);
  }

  @Post('tickets/:id/assign')
  @Permissions('tickets.assign')
  @ApiOperation({ summary: 'Assign ticket to agent' })
  async assignTicket(
    @Param('id') id: string,
    @Body() body: { agentId: string; reason?: string },
    @Req() req: { user: { id: string } },
  ) {
    return this.supportService.assignTicket(id, body.agentId, req.user.id, body.reason);
  }

  @Post('tickets/:id/route')
  @Permissions('tickets.assign')
  @ApiOperation({ summary: 'Route ticket to department/team/agent (supports all three, or any combo)' })
  async routeTicket(
    @Param('id') id: string,
    @Body() body: { agentId?: string; teamId?: string; departmentId?: string; reason?: string } | undefined,
    @Req() req: { user: { id: string } },
  ) {
    const b = body ?? {};
    if (!b.agentId && !b.teamId && !b.departmentId) {
      throw new BadRequestException('At least one of agentId, teamId, or departmentId is required');
    }
    return (this.supportService as any).routeTicket({
      ticketId: id,
      agentId: b.agentId,
      teamId: b.teamId,
      departmentId: b.departmentId,
      assignedBy: req.user.id,
      reason: b.reason,
    });
  }

  @Post('tickets/:id/auto-assign')
  @Permissions('tickets.assign')
  @ApiOperation({ summary: 'Auto-assign ticket' })
  async autoAssign(
    @Param('id') id: string,
    @Body() body: { strategy?: 'round_robin' | 'least_busy' | 'skill_based' } | undefined,
  ) {
    return this.supportService.autoAssignTicket(id, body?.strategy);
  }

  @Post('tickets/:id/messages')
  @Permissions('tickets.reply')
  @ApiOperation({ summary: 'Add reply to ticket' })
  async addMessage(
    @Param('id') id: string,
    @Body() body: { body: string; isInternal?: boolean },
    @Req() req: { user: { id: string } },
  ) {
    return this.supportService.addMessage(id, req.user.id, body.body, body.isInternal);
  }

  @Post('tickets/:id/notes')
  @Permissions('tickets.reply')
  @ApiOperation({ summary: 'Add internal note' })
  async addNote(
    @Param('id') id: string,
    @Body() body: { body: string },
    @Req() req: { user: { id: string } },
  ) {
    return this.supportService.addInternalNote(id, req.user.id, body.body);
  }

  @Post('tickets/:id/escalate')
  @Permissions('tickets.escalate')
  @ApiOperation({ summary: 'Escalate ticket' })
  async escalate(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @Req() req: { user: { id: string } },
  ) {
    return this.supportService.escalateTicket(id, req.user.id, body.reason);
  }

  @Delete('tickets/:id')
  @Permissions('tickets.delete')
  @ApiOperation({ summary: 'Delete ticket' })
  async deleteTicket(@Param('id') id: string, @Req() req: { user: { id: string } }) {
    return this.supportService.deleteTicket(id, req.user.id);
  }

  // ─── Ticket Access Requests ──────────────────────────────────────────────
  //
  // Workflow: a non-admin user who tries to view a ticket they did not create
  // and are not assigned to receives a 403 from `getTicket`. The frontend then
  // prompts them to submit an access request via POST /tickets/:id/access-request.
  // Admins can list/approve/reject requests via the endpoints below.

  @Post('tickets/:id/access-request')
  @Permissions('tickets.view')
  @ApiOperation({ summary: 'Submit a request for view access to a ticket the user cannot currently see' })
  async requestTicketAccess(
    @Param('id') id: string,
    @Body() body: {
      justification: string;
      type?: AccessRequestType;
      startsAt?: string;
      expiresAt?: string;
    },
    @Req() req: { user: { id: string; role?: Role | null } },
  ) {
    return this.supportService.requestTicketAccess({
      ticketId: id,
      requesterId: req.user.id,
      requesterRole: req.user.role ?? null,
      justification: body.justification,
      type: body.type,
      startsAt: body.startsAt ? new Date(body.startsAt) : undefined,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
    });
  }

  @Get('tickets/access-requests')
  @Permissions('tickets.view')
  @ApiOperation({ summary: 'List ticket-view access requests (admins see all; users see their own)' })
  async listTicketAccessRequests(
    @Query('status') status?: AccessRequestStatus,
    @Query('ticketId') ticketId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('orderBy') orderBy?: 'createdAt' | 'reviewedAt' | 'expiresAt',
    @Query('orderDir') orderDir?: 'asc' | 'desc',
    @Req() req?: { user?: { id: string; role?: Role | null } },
  ) {
    if (!req?.user) throw new BadRequestException('Authenticated user is required');
    return this.supportService.listTicketAccessRequests({
      actorId: req.user.id,
      actorRole: req.user.role ?? null,
      status,
      ticketId,
      page,
      limit,
      orderBy,
      orderDir,
    });
  }

  @Get('tickets/:id/access-requests')
  @Permissions('tickets.view')
  @ApiOperation({ summary: 'List access requests for a specific ticket (admins see all; users see their own)' })
  async listTicketAccessRequestsForTicket(
    @Param('id') id: string,
    @Query('status') status?: AccessRequestStatus,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Req() req?: { user?: { id: string; role?: Role | null } },
  ) {
    if (!req?.user) throw new BadRequestException('Authenticated user is required');
    return this.supportService.listTicketAccessRequests({
      actorId: req.user.id,
      actorRole: req.user.role ?? null,
      ticketId: id,
      status,
      page,
      limit,
    });
  }

  @Post('tickets/access-requests/:requestId/approve')
  @Permissions('tickets.view')
  @ApiOperation({ summary: 'Approve a pending ticket-view access request (admin only)' })
  async approveTicketAccessRequest(
    @Param('requestId') requestId: string,
    @Body() body: { adminJustification: string },
    @Req() req: { user: { id: string; role?: Role | null } },
  ) {
    return this.supportService.approveTicketAccessRequest({
      requestId,
      reviewerId: req.user.id,
      reviewerRole: req.user.role ?? null,
      adminJustification: body.adminJustification,
    });
  }

  @Post('tickets/access-requests/:requestId/reject')
  @Permissions('tickets.view')
  @ApiOperation({ summary: 'Reject a pending ticket-view access request (admin only)' })
  async rejectTicketAccessRequest(
    @Param('requestId') requestId: string,
    @Body() body: { adminJustification: string },
    @Req() req: { user: { id: string; role?: Role | null } },
  ) {
    return this.supportService.rejectTicketAccessRequest({
      requestId,
      reviewerId: req.user.id,
      reviewerRole: req.user.role ?? null,
      adminJustification: body.adminJustification,
    });
  }

  @Post('tickets/access-requests/:requestId/cancel')
  @Permissions('tickets.view')
  @ApiOperation({ summary: 'Cancel your own pending ticket-view access request' })
  async cancelTicketAccessRequest(
    @Param('requestId') requestId: string,
    @Req() req: { user: { id: string } },
  ) {
    return this.supportService.cancelTicketAccessRequest({
      requestId,
      actorId: req.user.id,
    });
  }

  @Get('tickets/:id')
  @Permissions('tickets.view')
  @ApiOperation({ summary: 'Get ticket detail' })
  async getTicket(
    @Param('id') id: string,
    @Req() req?: { user?: { id: string; role?: Role | null } },
  ) {
    const actor = req?.user ? { id: req.user.id, role: req.user.role ?? null } : undefined;
    return this.supportService.getTicket(id, actor);
  }

  // ─── Agents ──────────────────────────────────────────────────────────────

  @Get('agents')
  @Permissions('tickets.view')
  @ApiOperation({ summary: 'List support agents' })
  async listAgents(
    @Query('departmentId') departmentId?: string,
    @Query('status') status?: AgentStatus,
    @Query('isActive') isActive?: boolean,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('sortBy') sortBy?: 'name' | 'activeTickets' | 'maxTickets' | 'createdAt' | 'ticketsResolved' | 'escalations',
    @Query('sortDir') sortDir?: 'asc' | 'desc',
  ) {
    return this.supportService.listAgents({
      departmentId,
      status,
      isActive: isActive === undefined ? isActive : String(isActive) === 'true',
      search,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      sortBy,
      sortDir,
    });
  }

  @Get('agents/stats')
  @Permissions('tickets.view')
  @ApiOperation({ summary: 'Agent statistics summary' })
  async getAgentStats() {
    return this.supportService.getAgentStats();
  }

  @Post('agents')
  @Permissions('tickets.assign')
  @ApiOperation({ summary: 'Create support agent' })
  async createAgent(@Body() body: {
    userId: string;
    departmentId?: string;
    teamId?: string;
    skills?: string[];
    maxTickets?: number;
  }) {
    return this.supportService.createAgent(body);
  }

  @Get('agents/leaderboard')
  @Permissions('tickets.view')
  @ApiOperation({ summary: 'Agent leaderboard' })
  async getLeaderboard() {
    return this.supportService.getAgentLeaderboard();
  }

  // ─── Check if user is support agent ───

  @Get("agents/check/:userId")
  @ApiOperation({ summary: 'Check if user is a support agent' })
  async isSupportAgent(@Param("userId") userId: string) {
    const isAgent = await this.supportService.isSupportAgent(userId);
    return { isAgent };
  }

  // ─── Get agent presence ───

  @Get("agents/:userId/presence")
  @ApiOperation({ summary: 'Get agent presence' })
  async getAgentPresence(@Param("userId") userId: string) {
    return this.supportService.getAgentPresence(userId);
  }

  // ─── Get all agents with presence ───

  @Get("agents/with-presence")
  @Roles('ADMIN', 'SUPPORT_ADMIN')
  async getAgentsWithPresence(
    @Query("departmentId") departmentId?: string,
    @Query("teamId") teamId?: string,
    @Query("status") status?: string
  ) {
    return this.supportService.getAgentsWithPresence({
      departmentId,
      teamId,
      status,
    });
  }

  // ─── Get online agents count ───

  @Get("agents/online-count")
  @Roles('ADMIN', 'SUPPORT_ADMIN', 'SUPER_ADMIN', 'MODERATOR')
  async getOnlineAgentsCount() {
    const count = await this.supportService.getOnlineAgentsCount();
    return { count };
  }

  @Get('agents/:userId')
  @Permissions('tickets.view')
  @ApiOperation({ summary: 'Get detailed agent information' })
  async getAgentDetail(@Param('userId') userId: string) {
    return this.supportService.getAgentDetail(userId);
  }

  @Put('agents/:userId')
  @Permissions('tickets.assign')
  @ApiOperation({ summary: 'Update agent details' })
  async updateAgent(
    @Param('userId') userId: string,
    @Body() body: UpdateAgentDto,
  ) {
    return this.supportService.updateAgent(userId, body);
  }

  @Delete('agents/:userId')
  @Permissions('tickets.assign')
  @ApiOperation({ summary: 'Delete support agent' })
  async deleteAgent(@Param('userId') userId: string) {
    return this.supportService.deleteAgent(userId);
  }

  @Patch('agents/:userId/status')
  @Permissions('tickets.assign')
  @ApiOperation({ summary: 'Toggle agent active/inactive status' })
  async toggleAgentStatus(@Param('userId') userId: string) {
    return this.supportService.toggleAgentStatus(userId);
  }


  @Patch('agents/:userId/presence')
  @Permissions('tickets.reply')
  @ApiOperation({ summary: 'Toggle agent presence status' })
  async toggleAgentPresence(@Param('userId') userId: string, @Body() body: { status: string }) {
    return this.supportService.updateAgentPresence(userId, body.status);
  }


  @Put('agents/:userId/status')
  @Permissions('tickets.assign')
  @ApiOperation({ summary: 'Update agent status' })
  async updateAgentStatus(@Param('userId') userId: string, @Body() body: { status: AgentStatus }) {
    return this.supportService.updateAgentStatus(userId, body.status);
  }

  @Get('agents/:userId/tickets')
  @Permissions('tickets.view')
  @ApiOperation({ summary: "Get agent's assigned tickets" })
  async getAgentTickets(
    @Param('userId') userId: string,
    @Query('status') status?: TicketStatus,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.supportService.getAgentTickets(userId, { status, page, limit });
  }

  @Get('agents/:userId/activity')
  @Permissions('tickets.view')
  @ApiOperation({ summary: "Get agent's activity log" })
  async getAgentActivity(
    @Param('userId') userId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.supportService.getAgentActivity(userId, { page, limit });
  }

  @Get('agents/:userId/metrics')
  @Permissions('tickets.view')
  @ApiOperation({ summary: 'Get agent performance metrics' })
  async getAgentMetrics(@Param('userId') userId: string) {
    return this.supportService.getAgentMetrics(userId);
  }

  // ─── Departments & Teams ─────────────────────────────────────────────────

  @Get('departments')
  @Permissions('tickets.view')
  async listDepartments(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
    @Query('includeDeleted') includeDeleted?: string,
    @Query('sortBy') sortBy?: 'name' | 'createdAt' | 'firstResponseSlaMinutes' | 'slaAdherenceTargetPct',
    @Query('sortDir') sortDir?: 'asc' | 'desc',
  ) {
    return this.supportService.listDepartments({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
      isActive: isActive === undefined ? undefined : isActive === 'true',
      includeDeleted: includeDeleted === 'true',
      sortBy,
      sortDir,
    });
  }

  @Post('departments')
  @Permissions('tickets.assign')
  async createDepartment(@Body() body: {
    key: string; name: string; description?: string | null; email?: string | null;
    headId?: string | null;
    firstResponseSlaMinutes?: number; resolutionSlaMinutes?: number; slaAdherenceTargetPct?: number;
    businessHoursStartMin?: number; businessHoursEndMin?: number; businessDays?: number[];
    timezone?: string; budgetAllocated?: number | null; resourceCapacityFte?: number | null;
    isActive?: boolean;
  }) {
    return this.supportService.createDepartment(body);
  }

  @Get('departments/scorecard')
  @Permissions('tickets.view')
  @ApiOperation({ summary: 'Comparative department scorecards with cross-org average' })
  async getComparativeDepartmentScorecard(
    @Query('windowDays') windowDays?: number,
  ) {
    return this.supportService.getComparativeDepartmentScorecard(
      windowDays !== undefined ? Number(windowDays) : undefined,
    );
  }

  @Get('departments/:id')
  @Permissions('tickets.view')
  async getDepartment(@Param('id') id: string) {
    return this.supportService.getDepartment(id);
  }

  @Patch('departments/:id')
  @Permissions('tickets.assign')
  async updateDepartment(
    @Param('id') id: string,
    @Body() body: UpdateDepartmentDto,
  ) {
    return this.supportService.updateDepartment(id, body);
  }

  @Delete('departments/:id')
  @Permissions('tickets.assign')
  async deleteDepartment(@Param('id') id: string) {
    return this.supportService.deleteDepartment(id);
  }

  @Post('departments/:id/restore')
  @Permissions('tickets.assign')
  async restoreDepartment(@Param('id') id: string) {
    return (this.supportService as any).restoreDepartment(id);
  }

  @Get('teams')
  @Permissions('tickets.view')
  async listTeams(
    @Query('departmentId') departmentId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
    @Query('includeDeleted') includeDeleted?: string,
    @Query('sortBy') sortBy?: 'name' | 'createdAt' | 'maxTicketsPerAgent',
    @Query('sortDir') sortDir?: 'asc' | 'desc',
  ) {
    return this.supportService.listTeams({
      departmentId,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
      isActive: isActive === undefined ? undefined : isActive === 'true',
      includeDeleted: includeDeleted === 'true',
      sortBy,
      sortDir,
    });
  }

  @Post('teams')
  @Permissions('tickets.assign')
  async createTeam(@Body() body: {
    departmentId: string; name: string; description?: string | null; leadId?: string | null;
    slaInheritFromDept?: boolean; firstResponseSlaMinutes?: number | null; resolutionSlaMinutes?: number | null;
    businessHoursInherit?: boolean; businessHoursStartMin?: number | null; businessHoursEndMin?: number | null;
    businessDays?: number[]; timezone?: string | null;
    maxTicketsPerAgent?: number; concurrentTicketLimitPerAgent?: number;
    skillSpecialization?: string | null; isActive?: boolean;
  }) {
    return this.supportService.createTeam(body);
  }

  @Get('teams/:id')
  @Permissions('tickets.view')
  async getTeam(@Param('id') id: string) {
    return this.supportService.getTeam(id);
  }

  @Patch('teams/:id')
  @Permissions('tickets.assign')
  async updateTeam(
    @Param('id') id: string,
    @Body() body: UpdateTeamDto,
  ) {
    return this.supportService.updateTeam(id, body);
  }

  @Delete('teams/:id')
  @Permissions('tickets.assign')
  async deleteTeam(@Param('id') id: string) {
    return this.supportService.deleteTeam(id);
  }

  @Post('teams/:id/restore')
  @Permissions('tickets.assign')
  async restoreTeam(@Param('id') id: string) {
    return (this.supportService as any).restoreTeam(id);
  }

  // Membership endpoints
  @Post('agents/:agentId/teams/:teamId')
  @Permissions('tickets.assign')
  async addAgentToTeam(
    @Param('agentId') agentId: string,
    @Param('teamId') teamId: string,
    @Body() body?: { isPrimary?: boolean; assignedBy?: string },
  ) {
    return this.supportService.addAgentToTeam(agentId, teamId, body);
  }

  @Delete('agents/:agentId/teams/:teamId')
  @Permissions('tickets.assign')
  async removeAgentFromTeam(
    @Param('agentId') agentId: string,
    @Param('teamId') teamId: string,
  ) {
    return this.supportService.removeAgentFromTeam(agentId, teamId);
  }

  @Post('agents/:agentId/teams/:teamId/primary')
  @Permissions('tickets.assign')
  async setPrimaryTeam(
    @Param('agentId') agentId: string,
    @Param('teamId') teamId: string,
  ) {
    return this.supportService.setPrimaryTeam(agentId, teamId);
  }

  // ─── Analytics & Metrics (Phases 2–4) ────────────────────────────────────

  @Get('departments/:id/metrics')
  @Permissions('tickets.view')
  @ApiOperation({ summary: 'Department-level aggregated metrics' })
  async getDepartmentMetrics(@Param('id') id: string) {
    return this.supportService.getDepartmentMetrics(id);
  }

  @Get('teams/:id/metrics')
  @Permissions('tickets.view')
  @ApiOperation({ summary: 'Team-level aggregated metrics' })
  async getTeamMetrics(@Param('id') id: string) {
    return this.supportService.getTeamMetrics(id);
  }

  @Get('teams/:id/kpis')
  @Permissions('tickets.view')
  @ApiOperation({ summary: 'Team KPI dashboard: SLA, CSAT, FCR, reopen, volume' })
  async getTeamKpis(@Param('id') id: string) {
    return this.supportService.getTeamKpis(id);
  }

  @Get('tickets-report')
  @Permissions('tickets.view')
  @ApiOperation({ summary: 'Tickets report: paginated list with filters' })
  async getTicketsReport(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('departmentId') departmentId?: string,
    @Query('teamId') teamId?: string,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('search') search?: string,
  ) {
    return (this.supportService as any).generateTicketsReport({
      page, limit, departmentId, teamId, status, priority, dateFrom, dateTo, search,
    });
  }

  @Get('tickets-report.csv')
  @Permissions('tickets.view')
  @ApiOperation({ summary: 'Tickets report as CSV download' })
  async getTicketsReportCsv(
    @Query('departmentId') departmentId?: string,
    @Query('teamId') teamId?: string,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('search') search?: string,
  ) {
    return (this.supportService as any).getTicketsReportCsv({
      departmentId, teamId, status, priority, dateFrom, dateTo, search,
    });
  }

  @Get('forecast/volume')
  @Permissions('tickets.view')
  @ApiOperation({ summary: '30-day weighted-average ticket volume forecast' })
  async forecastTicketVolume(
    @Query('departmentId') departmentId?: string,
    @Query('deptId') deptIdAlias?: string,
    @Query('teamId') teamId?: string,
    @Query('days') days?: string,
  ) {
    return (this.supportService as any).forecastTicketVolume({
      deptId: departmentId ?? deptIdAlias,
      teamId,
      days: days !== undefined ? Number(days) : undefined,
    });
  }

  @Get('forecast/staffing')
  @Permissions('tickets.assign')
  @ApiOperation({ summary: 'Staffing (FTE) recommendation based on forecast + capacity' })
  async suggestStaffing(
    @Query('departmentId') departmentId?: string,
    @Query('deptId') deptIdAlias?: string,
    @Query('teamId') teamId?: string,
    @Query('ticketsPerAgentPerDay') ticketsPerAgentPerDay?: string,
    @Query('utilizationTargetPct') utilizationTargetPct?: string,
    @Query('days') days?: string,
  ) {
    return (this.supportService as any).suggestStaffing({
      deptId: departmentId ?? deptIdAlias,
      teamId,
      ticketsPerAgentPerDay: ticketsPerAgentPerDay !== undefined ? Number(ticketsPerAgentPerDay) : undefined,
      utilizationTargetPct: utilizationTargetPct !== undefined ? Number(utilizationTargetPct) : undefined,
      days: days !== undefined ? Number(days) : undefined,
    });
  }

  @Get('tickets/:id/risk')
  @Permissions('tickets.view')
  @ApiOperation({ summary: 'SLA breach risk score 0-100 for a single ticket' })
  async getTicketRisk(@Param('id') id: string) {
    return this.supportService.predictRiskForTicket(id);
  }

  @Get('tickets/:id/csat-prediction')
  @Permissions('tickets.view')
  @ApiOperation({ summary: 'Predicted CSAT 1-5 based on ticket characteristics (alias: predict-csat)' })
  async getTicketCsatPrediction(@Param('id') id: string) {
    return this.supportService.predictCsatForTicket(id);
  }

  @Get('tickets/:id/predict-csat')
  @Permissions('tickets.view')
  @ApiOperation({ summary: 'Predicted CSAT 1-5 based on ticket characteristics' })
  async getTicketCsatPredictionAlt(@Param('id') id: string) {
    return this.supportService.predictCsatForTicket(id);
  }

  @Get('tickets/:id/predict-risk')
  @Permissions('tickets.view')
  @ApiOperation({ summary: 'Escalation risk prediction 0-100 for a ticket' })
  async getTicketRiskPrediction(@Param('id') id: string) {
    return this.supportService.predictRiskForTicket(id);
  }

  // ─── Categories, Tags, SLA, Canned Responses ─────────────────────────────

  @Get('categories')
  @Permissions('tickets.view')
  async listCategories() {
    return this.supportService.listCategories();
  }

  @Get('tags')
  @Permissions('tickets.view')
  async listTags() {
    return this.supportService.listTags();
  }

  @Get('sla-policies')
  @Permissions('tickets.view')
  async listSlaPolicies() {
    return this.supportService.listSlaPolicies();
  }

  @Get('canned-responses')
  @Permissions('tickets.reply')
  @ApiOperation({ summary: 'List canned responses' })
  async listCannedResponses(
    @Query('category') category?: string,
    @Query('tags') tags?: string,
  ) {
    const tagArray = tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : undefined;
    return this.supportService.listCannedResponses(category, tagArray);
  }

  @Get('canned-responses/:id')
  @Permissions('tickets.reply')
  @ApiOperation({ summary: 'Get canned response by id' })
  async getCannedResponse(@Param('id') id: string) {
    return this.supportService.getCannedResponse(id);
  }

  @Post('canned-responses')
  @Permissions('tickets.assign')
  @ApiOperation({ summary: 'Create canned response' })
  async createCannedResponse(@Body() body: {
    title: string;
    body: string;
    category?: string;
    shortcut?: string;
    isActive?: boolean;
    tags?: string[];
    variables?: string[];
    shortcuts?: string[];
  }) {
    return this.supportService.createCannedResponse(body);
  }

  @Put('canned-responses/:id')
  @Permissions('tickets.assign')
  @ApiOperation({ summary: 'Update canned response' })
  async updateCannedResponse(
    @Param('id') id: string,
    @Body() body: {
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
    return this.supportService.updateCannedResponse(id, body);
  }

  @Delete('canned-responses/:id')
  @Permissions('tickets.assign')
  @ApiOperation({ summary: 'Delete canned response' })
  async deleteCannedResponse(@Param('id') id: string) {
    return this.supportService.deleteCannedResponse(id);
  }

  @Post('canned-responses/:id/use')
  @Permissions('tickets.reply')
  @ApiOperation({ summary: 'Record canned response usage' })
  async useCannedResponse(@Param('id') id: string) {
    return this.supportService.incrementCannedUsage(id);
  }

  // ─── Knowledge Base ──────────────────────────────────────────────────────

  @Get('kb/articles')
  @Permissions('tickets.view')
  async listKbArticles(
    @Query('category') category?: string,
    @Query('search') search?: string,
    @Query('published') published?: string,
  ) {
    return this.supportService.listKbArticles({
      category,
      search,
      published: published !== undefined ? published === 'true' : undefined,
    });
  }

  @Post('kb/articles/:id/versions')
  @Permissions('tickets.assign')
  async createKbVersion(
    @Param('id') id: string,
    @Body() body: { changeNote?: string },
    @Req() req: { user: { id: string } },
  ) {
    return this.supportService.createKbArticleVersion(id, req.user.id, body.changeNote);
  }

  // ─── Seed ────────────────────────────────────────────────────────────────

  @Post('seed')
  @Permissions('tickets.assign')
  async seedSupport() {
    return this.supportService.seedSupport();
  }
}
