import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { TicketStatus, TicketPriority, TicketType, AgentStatus, Prisma } from '@prisma/client';

@Injectable()
export class SupportService {
  constructor(private prisma: PrismaService) {}

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

  private async generateTicketNumber(): Promise<string> {
    const count = await this.prisma.supportTicket.count();
    return `TKT-${String(count + 1).padStart(6, '0')}`;
  }

  // ─── Tickets ───────────────────────────────────────────────────────────────

  async createTicket(
    userId: string,
    data: {
      subject: string;
      message: string;
      description?: string;
      type?: TicketType;
      priority?: TicketPriority;
      categoryId?: string;
      departmentId?: string;
    },
  ) {
    const ticketNumber = await this.generateTicketNumber();
    const ticket = await this.prisma.supportTicket.create({
      data: {
        ticketNumber,
        subject: data.subject,
        message: data.message,
        description: data.description,
        type: data.type ?? 'CUSTOMER',
        priority: data.priority ?? 'MEDIUM',
        userId,
        categoryId: data.categoryId,
        departmentId: data.departmentId,
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
    search?: string;
    unassigned?: boolean;
  }) {
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 20;
    const skip = (page - 1) * limit;
    const where: Prisma.SupportTicketWhereInput = { deletedAt: null };

    if (params?.status) where.status = params.status;
    if (params?.priority) where.priority = params.priority;
    if (params?.assigneeId) where.assigneeId = params.assigneeId;
    if (params?.departmentId) where.departmentId = params.departmentId;
    if (params?.unassigned) where.assigneeId = null;
    if (params?.search) {
      where.OR = [
        { subject: { contains: params.search, mode: 'insensitive' } },
        { ticketNumber: { contains: params.search, mode: 'insensitive' } },
        { message: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [tickets, total] = await Promise.all([
      this.prisma.supportTicket.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: this.ticketInclude(),
      }),
      this.prisma.supportTicket.count({ where }),
    ]);

    return { data: tickets, total, page, pageSize: limit };
  }

  async getTicket(id: string) {
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
    return ticket;
  }

  async updateTicketStatus(id: string, status: TicketStatus, changedById: string, reason?: string) {
    const ticket = await this.getTicket(id);
    const now = new Date();
    const updates: Prisma.SupportTicketUpdateInput = { status };

    if (status === 'RESOLVED') updates.resolvedAt = now;
    if (status === 'CLOSED') updates.closedAt = now;
    if (status === 'REOPENED') updates.reopenedAt = now;
    if (status === 'IN_PROGRESS' && !ticket.firstResponseAt) updates.firstResponseAt = now;

    const updated = await this.prisma.supportTicket.update({
      where: { id },
      data: updates,
      include: this.ticketInclude(),
    });

    await this.prisma.ticketStatusHistory.create({
      data: { ticketId: id, fromStatus: ticket.status, toStatus: status, changedById, reason },
    });

    await this.logActivity(changedById, 'ticket.status_changed', 'SupportTicket', id, { status, reason });
    await this.audit(changedById, 'UPDATE_TICKET_STATUS', 'SupportTicket', {
      resourceId: id,
      changes: { from: ticket.status, to: status, reason: reason ?? null },
    });
    return updated;
  }

  async assignTicket(ticketId: string, agentId: string, assignedBy: string, reason?: string) {
    const ticket = await this.getTicket(ticketId);

    // End previous assignments
    await this.prisma.ticketAssignment.updateMany({
      where: { ticketId, isActive: true },
      data: { isActive: false, endedAt: new Date() },
    });

    await this.prisma.ticketAssignment.create({
      data: { ticketId, agentId, assignedBy, reason },
    });

    const updated = await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: { assigneeId: agentId, status: ticket.status === 'NEW' ? 'ASSIGNED' : ticket.status },
      include: this.ticketInclude(),
    });

    if (ticket.status === 'NEW') {
      await this.prisma.ticketStatusHistory.create({
        data: { ticketId, fromStatus: 'NEW', toStatus: 'ASSIGNED', changedById: assignedBy },
      });
    }

    // Update agent workload
    await this.prisma.supportAgent.updateMany({
      where: { userId: agentId },
      data: { activeTickets: { increment: 1 } },
    });

    await this.logActivity(assignedBy, 'ticket.assigned', 'SupportTicket', ticketId, { agentId });
    return updated;
  }

  async addMessage(ticketId: string, authorId: string, body: string, isInternal = false) {
    const ticket = await this.getTicket(ticketId);
    const message = await this.prisma.ticketMessage.create({
      data: { ticketId, authorId, body, isInternal },
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
        const now = new Date();
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
        details: { messageId: message.id, isInternal: false, authorRole: message.author.email?.includes('@vellum') ? 'staff' : 'user' },
      });
    }

    return message;
  }

  async addInternalNote(ticketId: string, authorId: string, body: string) {
    await this.getTicket(ticketId);
    return this.prisma.ticketInternalNote.create({
      data: { ticketId, authorId, body },
      include: { author: { select: { id: true, name: true, email: true, avatar: true } } },
    });
  }

  async escalateTicket(ticketId: string, changedById: string, reason?: string) {
    return this.updateTicketStatus(ticketId, 'ESCALATED', changedById, reason);
  }

  async deleteTicket(id: string, deletedBy: string) {
    await this.prisma.supportTicket.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.logActivity(deletedBy, 'ticket.deleted', 'SupportTicket', id);
    await this.audit(deletedBy, 'DELETE_TICKET', 'SupportTicket', { resourceId: id });
    return { success: true };
  }

  // ─── Auto Assignment ───────────────────────────────────────────────────────

  async autoAssignTicket(ticketId: string, strategy: 'round_robin' | 'least_busy' | 'skill_based' = 'least_busy') {
    const ticket = await this.getTicket(ticketId);
    let agent: { userId: string } | null = null;

    if (strategy === 'least_busy') {
      agent = await this.prisma.supportAgent.findFirst({
        where: {
          isActive: true,
          status: { in: ['ONLINE', 'AWAY'] },
          departmentId: ticket.departmentId ?? undefined,
          activeTickets: { lt: 10 },
        },
        orderBy: { activeTickets: 'asc' },
      });
    } else if (strategy === 'round_robin') {
      const agents = await this.prisma.supportAgent.findMany({
        where: { isActive: true, status: { in: ['ONLINE', 'AWAY'] } },
        orderBy: { updatedAt: 'asc' },
        take: 1,
      });
      agent = agents[0] ?? null;
    }

    if (!agent) throw new BadRequestException('No available agents for assignment');
    return this.assignTicket(ticketId, agent.userId, agent.userId, `Auto-assigned via ${strategy}`);
  }

  // ─── Agents ────────────────────────────────────────────────────────────────

  async listAgents(params?: { departmentId?: string; status?: AgentStatus }) {
    const where: Prisma.SupportAgentWhereInput = { deletedAt: null, isActive: true };
    if (params?.departmentId) where.departmentId = params.departmentId;
    if (params?.status) where.status = params.status;

    return this.prisma.supportAgent.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, avatar: true, handle: true } },
        department: true,
        team: true,
      },
      orderBy: { activeTickets: 'asc' },
    });
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

  async getAgentMetrics(userId: string) {
    const agent = await this.prisma.supportAgent.findUnique({ where: { userId } });
    if (!agent) throw new NotFoundException('Agent not found');

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

  // ─── Departments & Teams ───────────────────────────────────────────────────

  async listDepartments() {
    return this.prisma.supportDepartment.findMany({
      where: { deletedAt: null, isActive: true },
      include: { _count: { select: { agents: true, tickets: true, teams: true } } },
    });
  }

  async createDepartment(data: { key: string; name: string; description?: string; email?: string }) {
    return this.prisma.supportDepartment.create({ data });
  }

  async listTeams(departmentId?: string) {
    const where: Prisma.SupportTeamWhereInput = { deletedAt: null, isActive: true };
    if (departmentId) where.departmentId = departmentId;
    return this.prisma.supportTeam.findMany({
      where,
      include: { _count: { select: { agents: true } }, department: true },
    });
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

  async listCannedResponses(category?: string) {
    const where: Prisma.CannedResponseWhereInput = { isActive: true, deletedAt: null };
    if (category) where.category = category;
    return this.prisma.cannedResponse.findMany({ where, orderBy: { title: 'asc' } });
  }

  async getCannedResponse(id: string) {
    const cr = await this.prisma.cannedResponse.findFirst({
      where: { id, deletedAt: null },
    });
    if (!cr) throw new NotFoundException('Canned response not found');
    return cr;
  }

  async createCannedResponse(data: { title: string; body: string; category?: string; shortcut?: string }) {
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
    data: { title?: string; body?: string; category?: string; shortcut?: string; isActive?: boolean },
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

  async getSupportDashboard() {
    const [
      openTickets,
      unassigned,
      inProgress,
      escalated,
      resolved,
      closed,
      agents,
      responseTimeTickets,
    ] = await Promise.all([
      this.prisma.supportTicket.count({ where: { deletedAt: null, status: { notIn: ['CLOSED', 'RESOLVED'] } } }),
      this.prisma.supportTicket.count({ where: { deletedAt: null, assigneeId: null, status: 'NEW' } }),
      this.prisma.supportTicket.count({ where: { deletedAt: null, status: 'IN_PROGRESS' } }),
      this.prisma.supportTicket.count({ where: { deletedAt: null, status: 'ESCALATED' } }),
      this.prisma.supportTicket.count({ where: { deletedAt: null, status: 'RESOLVED' } }),
      this.prisma.supportTicket.count({ where: { deletedAt: null, status: 'CLOSED' } }),
      this.prisma.supportAgent.count({ where: { isActive: true, status: 'ONLINE' } }),
      this.prisma.supportTicket.findMany({
        where: { firstResponseAt: { not: null }, deletedAt: null },
        select: { createdAt: true, firstResponseAt: true },
      }),
    ]);

    const avgResponseMs = responseTimeTickets.length > 0
      ? responseTimeTickets.reduce((sum, t) => sum + (t.firstResponseAt!.getTime() - t.createdAt.getTime()), 0) / responseTimeTickets.length
      : 0;

    const byPriority = await this.prisma.supportTicket.groupBy({
      by: ['priority'],
      where: { deletedAt: null, status: { notIn: ['CLOSED', 'RESOLVED'] } },
      _count: true,
    });

    const byStatus = await this.prisma.supportTicket.groupBy({
      by: ['status'],
      where: { deletedAt: null },
      _count: true,
    });

    return {
      summary: { openTickets, unassigned, inProgress, escalated, resolved, closed, onlineAgents: agents, avgResponseMs },
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
            title: 'Getting Started with Vellum',
            description: 'Learn the basics of Vellum — set up your profile, publish your first story, and connect with readers.',
            content: [
              '## Welcome to Vellum!',
              'Vellum is a home for thoughtful writing and story discovery. This guide walks you through getting set up and making the most of the platform.',
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
            description: 'Write, format, schedule, and publish stories on Vellum. Learn about drafts, cover images, and SEO.',
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
            description: 'Use Vellum AI to brainstorm, rewrite, proofread, and generate cover ideas for your stories.',
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
            description: 'Get started with the Vellum developer API — authentication, rate limits, and example requests.',
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
              'Each webhook request includes an `X-Vellum-Signature` header. Verify it using HMAC-SHA256 with your signing secret.',
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
              'We offer Free, Plus, and Premium plans. Compare features on our pricing page at vellum.app/pricing.',
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
            description: 'How to permanently delete your Vellum account and what happens to your data.',
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
      data: { key: 'general', name: 'General Support', email: 'support@vellum.app' },
    });
    const technical = await this.prisma.supportDepartment.create({
      data: { key: 'technical', name: 'Technical Support', email: 'tech@vellum.app' },
    });
    const billing = await this.prisma.supportDepartment.create({
      data: { key: 'billing', name: 'Billing Support', email: 'billing@vellum.app' },
    });

    const team1 = await this.prisma.supportTeam.create({
      data: { name: 'Tier 1 Support', departmentId: general.id },
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
        { title: 'Greeting', body: 'Thank you for contacting Vellum Support. My name is {agent_name}, and I\'ll be happy to assist you today.', shortcut: '/greet', category: 'general' },
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
}
