import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SupportService } from './support.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { Permissions } from '../rbac/permissions.decorator';
import { TicketStatus, TicketPriority, TicketType, AgentStatus } from '@prisma/client';

@ApiTags('Support')
@Controller('api/support')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SupportController {
  constructor(private supportService: SupportService) {}

  // ─── Dashboard ─────────────────────────────────────────────────────────────

  @Get('dashboard')
  @Permissions('tickets.view')
  @ApiOperation({ summary: 'Support dashboard stats' })
  async getDashboard() {
    return this.supportService.getSupportDashboard();
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
    @Query('search') search?: string,
    @Query('unassigned') unassigned?: string,
  ) {
    return this.supportService.listTickets({
      page, limit, status, priority, assigneeId, departmentId, search,
      unassigned: unassigned === 'true',
    });
  }

  @Get('tickets/:id')
  @Permissions('tickets.view')
  @ApiOperation({ summary: 'Get ticket detail' })
  async getTicket(@Param('id') id: string) {
    return this.supportService.getTicket(id);
  }

  @Post('tickets')
  @Permissions('tickets.create')
  @ApiOperation({ summary: 'Create ticket' })
  async createTicket(
    @Body() body: {
      subject: string;
      message: string;
      description?: string;
      type?: TicketType;
      priority?: TicketPriority;
      categoryId?: string;
      departmentId?: string;
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

  @Post('tickets/:id/auto-assign')
  @Permissions('tickets.assign')
  @ApiOperation({ summary: 'Auto-assign ticket' })
  async autoAssign(
    @Param('id') id: string,
    @Body() body: { strategy?: 'round_robin' | 'least_busy' | 'skill_based' },
  ) {
    return this.supportService.autoAssignTicket(id, body.strategy);
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

  // ─── Agents ──────────────────────────────────────────────────────────────

  @Get('agents')
  @Permissions('tickets.view')
  @ApiOperation({ summary: 'List support agents' })
  async listAgents(@Query('departmentId') departmentId?: string, @Query('status') status?: AgentStatus) {
    return this.supportService.listAgents({ departmentId, status });
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

  @Put('agents/:userId/status')
  @Permissions('tickets.view')
  @ApiOperation({ summary: 'Update agent status' })
  async updateAgentStatus(@Param('userId') userId: string, @Body() body: { status: AgentStatus }) {
    return this.supportService.updateAgentStatus(userId, body.status);
  }

  @Get('agents/:userId/metrics')
  @Permissions('tickets.view')
  @ApiOperation({ summary: 'Get agent performance metrics' })
  async getAgentMetrics(@Param('userId') userId: string) {
    return this.supportService.getAgentMetrics(userId);
  }

  @Get('agents/leaderboard')
  @Permissions('tickets.view')
  @ApiOperation({ summary: 'Agent leaderboard' })
  async getLeaderboard() {
    return this.supportService.getAgentLeaderboard();
  }

  // ─── Departments & Teams ─────────────────────────────────────────────────

  @Get('departments')
  @Permissions('tickets.view')
  async listDepartments() {
    return this.supportService.listDepartments();
  }

  @Post('departments')
  @Permissions('tickets.assign')
  async createDepartment(@Body() body: { key: string; name: string; description?: string; email?: string }) {
    return this.supportService.createDepartment(body);
  }

  @Get('teams')
  @Permissions('tickets.view')
  async listTeams(@Query('departmentId') departmentId?: string) {
    return this.supportService.listTeams(departmentId);
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
  async listCannedResponses(@Query('category') category?: string) {
    return this.supportService.listCannedResponses(category);
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
  }) {
    return this.supportService.createCannedResponse(body);
  }

  @Put('canned-responses/:id')
  @Permissions('tickets.assign')
  @ApiOperation({ summary: 'Update canned response' })
  async updateCannedResponse(
    @Param('id') id: string,
    @Body() body: { title?: string; body?: string; category?: string; shortcut?: string; isActive?: boolean },
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
