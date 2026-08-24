import {
  Injectable,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { WebhookExecutorService } from './webhook-executor.service';
import { TeamsIntegrationService } from './teams-integration.service';
import * as crypto from 'crypto';
import {
  Webhook,
  WebhookLogType,
  WebhookType,
  TeamsCardType,
} from '@prisma/client';
import {
  CreateWebhookDto,
  UpdateWebhookDto,
  ListWebhooksQueryDto,
  TestWebhookDto,
  TriggerWebhookDto,
  ListWebhookLogsQueryDto,
  CreateFromTemplateDto,
} from './dto/webhooks.dto';

// ─── Built-in webhook templates ───────────────────────────────────────────────

const BUILT_IN_TEMPLATES: Omit<any, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    slug: 'teams-ticket-notification',
    name: 'Teams — Ticket Notification',
    description:
      'Send adaptive card notifications to a Teams channel when tickets are created, updated, or resolved.',
    category: 'teams',
    type: 'OUTGOING',
    format: 'JSON',
    isBuiltIn: true,
    isActive: true,
    variables: ['url', 'channelId'],
    config: {
      headers: { 'Content-Type': 'application/json' },
      teamsCardType: 'ADAPTIVE',
      events: [
        'ticket.created',
        'ticket.updated',
        'ticket.resolved',
        'ticket.assigned',
      ],
      retryMaxAttempts: 3,
      retryBackoffDelay: 1000,
    },
  },
  {
    slug: 'teams-alert-critical',
    name: 'Teams — Critical Alert',
    description:
      'Priority alerts (High / Critical / Emergency) rendered in Teams with resolution steps.',
    category: 'teams',
    type: 'OUTGOING',
    format: 'JSON',
    isBuiltIn: true,
    isActive: true,
    variables: ['url', 'channelId'],
    config: {
      headers: { 'Content-Type': 'application/json' },
      teamsCardType: 'ADAPTIVE',
      events: ['system.alert', 'ticket.escalated'],
      retryMaxAttempts: 5,
      retryBackoffDelay: 500,
    },
  },
  {
    slug: 'teams-daily-summary',
    name: 'Teams — Daily/Weekly Summary',
    description:
      'Aggregated activity summary (new tickets, articles, user sign-ups) posted once per period.',
    category: 'teams',
    type: 'OUTGOING',
    format: 'JSON',
    isBuiltIn: true,
    isActive: true,
    variables: ['url', 'channelId'],
    config: {
      headers: { 'Content-Type': 'application/json' },
      teamsCardType: 'MESSAGE',
      events: ['report.daily', 'report.weekly'],
      retryMaxAttempts: 2,
      retryBackoffDelay: 2000,
    },
  },
  {
    slug: 'slack-message',
    name: 'Slack — Generic JSON Webhook',
    description:
      'Standard Slack incoming-webhook JSON payload format. Works with Slack Block Kit webhook URLs.',
    category: 'slack',
    type: 'OUTGOING',
    format: 'JSON',
    isBuiltIn: true,
    isActive: true,
    variables: ['url'],
    config: {
      headers: { 'Content-Type': 'application/json' },
      events: ['*'],
      retryMaxAttempts: 3,
      retryBackoffDelay: 1000,
    },
  },
  {
    slug: 'general-json-outgoing',
    name: 'General — JSON Outgoing Webhook',
    description:
      'Plain JSON POST webhook. Use for any system that accepts JSON payloads over HTTPS.',
    category: 'general',
    type: 'OUTGOING',
    format: 'JSON',
    isBuiltIn: true,
    isActive: true,
    variables: ['url'],
    config: {
      events: ['*'],
      retryMaxAttempts: 3,
      retryBackoffDelay: 1000,
    },
  },
  {
    slug: 'incoming-content-api',
    name: 'Incoming — Content API',
    description:
      'Authenticated incoming webhook for programmatic article / highlight creation with HMAC signature verification.',
    category: 'general',
    type: 'INCOMING',
    format: 'JSON',
    isBuiltIn: true,
    isActive: true,
    variables: [],
    config: {
      requiresAuth: true,
      events: ['article.create', 'article.update', 'highlight.create', 'article.delete'],
    },
  },
];

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private executor: WebhookExecutorService,
    private teamsService: TeamsIntegrationService,
  ) {}

  // ── HMAC helper for API keys ───────────────────────────────────────────────

  private hashApiKey(rawKey: string): string {
    const secret =
      this.configService.get('API_KEY_SECRET') ||
      this.configService.get('JWT_SECRET') ||
      'vellum-dev-secret-change-me';
    return crypto.createHmac('sha256', secret).update(rawKey).digest('hex');
  }

  // ── Generate a random webhook secret ───────────────────────────────────────

  private generateSecret(): string {
    return 'whsec_' + crypto.randomBytes(32).toString('hex');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // CRUD
  // ──────────────────────────────────────────────────────────────────────────

  async create(userId: string, dto: CreateWebhookDto) {
    const secret = dto.secret ?? (dto.type === WebhookType.INCOMING ? this.generateSecret() : this.generateSecret());

    const webhook = await this.prisma.webhook.create({
      data: {
        name: dto.name,
        type: dto.type,
        url: dto.url,
        secret,
        format: dto.format,
        events: dto.events ?? [],
        headers: (dto.headers as any) ?? null,
        isActive: dto.isActive ?? true,
        retryMaxAttempts: dto.retryMaxAttempts ?? 3,
        retryBackoffDelay: dto.retryBackoffDelay ?? 1000,
        allowedIps: dto.allowedIps ?? [],
        requiresAuth: dto.requiresAuth ?? true,
        teamsChannelId: dto.teamsChannelId ?? null,
        teamsTeamId: dto.teamsTeamId ?? null,
        teamsCardType: dto.teamsCardType ?? null,
        teamsCardTemplate: (dto.teamsCardTemplate as any) ?? null,
        createdBy: userId,
      },
    });

    // Return secret once on creation (masked later)
    return this.serializeOne(webhook, { revealSecret: true });
  }

  async findAll(userId: string, role: any, dto: ListWebhooksQueryDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (dto.type) where.type = dto.type;
    if (typeof dto.isActive === 'boolean') where.isActive = dto.isActive;
    if (dto.search) {
      where.OR = [
        { name: { contains: dto.search, mode: 'insensitive' } },
        { url: { contains: dto.search, mode: 'insensitive' } },
      ];
    }
    // Non-admin users see only their own
    if (role !== 'ADMIN' && role !== 'PLATFORM_ADMIN' && role !== 'SUPER_ADMIN') {
      where.createdBy = userId;
    }

    const [items, total] = await Promise.all([
      this.prisma.webhook.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.webhook.count({ where }),
    ]);

    return {
      items: items.map(w => this.serializeOne(w)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(userId: string, role: any, id: string) {
    const webhook = await this.prisma.webhook.findUnique({
      where: { id },
    });
    if (!webhook) throw new NotFoundException('Webhook not found');
    this.enforceOwnershipOrAdmin(webhook, userId, role);
    return this.serializeOne(webhook);
  }

  async update(userId: string, role: any, id: string, dto: UpdateWebhookDto) {
    const webhook = await this.prisma.webhook.findUnique({ where: { id } });
    if (!webhook) throw new NotFoundException('Webhook not found');
    this.enforceOwnershipOrAdmin(webhook, userId, role);

    const updated = await this.prisma.webhook.update({
      where: { id },
      data: {
        name: dto.name,
        type: dto.type,
        url: dto.url,
        secret: dto.secret,
        format: dto.format,
        events: dto.events,
        headers: (dto.headers as any) ?? dto.headers,
        isActive: dto.isActive,
        retryMaxAttempts: dto.retryMaxAttempts,
        retryBackoffDelay: dto.retryBackoffDelay,
        allowedIps: dto.allowedIps,
        requiresAuth: dto.requiresAuth,
        teamsChannelId: dto.teamsChannelId,
        teamsTeamId: dto.teamsTeamId,
        teamsCardType: dto.teamsCardType,
        teamsCardTemplate: (dto.teamsCardTemplate as any) ?? dto.teamsCardTemplate,
      },
    });
    return this.serializeOne(updated);
  }

  async remove(userId: string, role: any, id: string) {
    const webhook = await this.prisma.webhook.findUnique({ where: { id } });
    if (!webhook) throw new NotFoundException('Webhook not found');
    this.enforceOwnershipOrAdmin(webhook, userId, role);

    // Logs cascade-delete via Prisma relation (onDelete: Cascade)
    await this.prisma.webhook.delete({ where: { id } });
    return { success: true, id };
  }

  async toggle(userId: string, role: any, id: string) {
    const webhook = await this.prisma.webhook.findUnique({ where: { id } });
    if (!webhook) throw new NotFoundException('Webhook not found');
    this.enforceOwnershipOrAdmin(webhook, userId, role);

    const updated = await this.prisma.webhook.update({
      where: { id },
      data: { isActive: !webhook.isActive },
    });
    return this.serializeOne(updated);
  }

  async regenerateSecret(userId: string, role: any, id: string) {
    const webhook = await this.prisma.webhook.findUnique({ where: { id } });
    if (!webhook) throw new NotFoundException('Webhook not found');
    this.enforceOwnershipOrAdmin(webhook, userId, role);

    const newSecret = this.generateSecret();
    const updated = await this.prisma.webhook.update({
      where: { id },
      data: { secret: newSecret },
    });
    return this.serializeOne(updated, { revealSecret: true });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Testing + Triggering
  // ──────────────────────────────────────────────────────────────────────────

  async testOutgoing(userId: string, role: any, id: string, dto: TestWebhookDto) {
    const webhook = await this.prisma.webhook.findUnique({ where: { id } });
    if (!webhook) throw new NotFoundException('Webhook not found');
    this.enforceOwnershipOrAdmin(webhook, userId, role);
    if (webhook.type !== WebhookType.OUTGOING) {
      throw new BadRequestException('Test endpoint is for outgoing webhooks only');
    }

    const result = await this.executor.executeOutgoing(webhook, {
      event: dto.event || 'test',
      payload: dto.payload ?? this.samplePayloadFor(dto.event || 'test'),
      extraHeaders: dto.headers,
      overrideUrl: dto.overrideUrl,
      isTest: true,
    });
    return result;
  }

  async triggerByEvent(userId: string, role: any, dto: TriggerWebhookDto) {
    // Only admins / trusted callers can fire event triggers from the API
    if (role !== 'ADMIN' && role !== 'PLATFORM_ADMIN' && role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Insufficient permissions to trigger events');
    }

    const { event, data, metadata } = dto;
    const payload = metadata ? { ...data, _metadata: metadata } : data;

    const matching = await this.prisma.webhook.findMany({
      where: {
        type: WebhookType.OUTGOING,
        isActive: true,
        OR: [{ events: { has: event } }, { events: { has: '*' } }],
      },
    });

    this.logger.log(`Trigger event "${event}" → ${matching.length} matching webhooks`);

    // Fire in parallel, don't wait (best-effort). We capture logs from within executor.
    const resultsP = matching.map(w =>
      this.executor.executeOutgoing(w, { event, payload }).then(r => ({
        webhookId: w.id,
        webhookName: w.name,
        ...r,
      })),
    );
    const results = await Promise.allSettled(resultsP);

    return {
      event,
      matchedWebhooks: matching.length,
      results: results.map(r =>
        r.status === 'fulfilled' ? r.value : { webhookId: null, success: false, error: r.reason?.message },
      ),
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Logs + Stats
  // ──────────────────────────────────────────────────────────────────────────

  async listLogs(
    userId: string,
    role: any,
    webhookId: string,
    dto: ListWebhookLogsQueryDto,
  ) {
    const webhook = await this.prisma.webhook.findUnique({ where: { id: webhookId } });
    if (!webhook) throw new NotFoundException('Webhook not found');
    this.enforceOwnershipOrAdmin(webhook, userId, role);

    const page = dto.page ?? 1;
    const limit = dto.limit ?? 50;
    const skip = (page - 1) * limit;

    const where: any = { webhookId };
    if (dto.event) where.event = dto.event;
    if (typeof dto.statusCode === 'number') where.statusCode = dto.statusCode;
    if (dto.from || dto.to) {
      where.timestamp = {};
      if (dto.from) where.timestamp.gte = new Date(dto.from);
      if (dto.to) where.timestamp.lte = new Date(dto.to);
    }

    const [items, total] = await Promise.all([
      this.prisma.webhookLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { timestamp: 'desc' },
      }),
      this.prisma.webhookLog.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async clearLogs(userId: string, role: any, webhookId: string) {
    const webhook = await this.prisma.webhook.findUnique({ where: { id: webhookId } });
    if (!webhook) throw new NotFoundException('Webhook not found');
    this.enforceOwnershipOrAdmin(webhook, userId, role);

    const { count } = await this.prisma.webhookLog.deleteMany({ where: { webhookId } });
    return { success: true, deleted: count };
  }

  async getStats(userId: string, role: any, webhookId?: string) {
    const baseWhere: any = {};
    if (webhookId) {
      const w = await this.prisma.webhook.findUnique({ where: { id: webhookId } });
      if (!w) throw new NotFoundException('Webhook not found');
      this.enforceOwnershipOrAdmin(w, userId, role);
      baseWhere.webhookId = webhookId;
    } else {
      if (role !== 'ADMIN' && role !== 'PLATFORM_ADMIN' && role !== 'SUPER_ADMIN') {
        const mine = await this.prisma.webhook.findMany({ where: { createdBy: userId }, select: { id: true } });
        baseWhere.webhookId = { in: mine.map(w => w.id) };
      }
    }

    const [totalLogs, errorLogs, avgDurRes] = await Promise.all([
      this.prisma.webhookLog.count({ where: baseWhere }),
      this.prisma.webhookLog.count({
        where: { ...baseWhere, type: WebhookLogType.ERROR },
      }),
      this.prisma.$queryRawUnsafe<{ avg: number | null }[]>(
        `SELECT AVG("durationMs") as avg FROM "WebhookLog" ${
          webhookId ? 'WHERE "webhookId" = $1' : ''
        }`,
        ...(webhookId ? [webhookId] : []),
      ),
    ]);

    const avgDur = Number(avgDurRes[0]?.avg ?? 0);
    const successCount = totalLogs - errorLogs;
    const successRate = totalLogs ? Math.round((successCount / totalLogs) * 10000) / 100 : 0;

    // Event breakdown
    const eventBreakdownRes = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT event, COUNT(*) as count FROM "WebhookLog" ${
        webhookId ? 'WHERE "webhookId" = $1' : ''
      } AND event IS NOT NULL GROUP BY event ORDER BY count DESC LIMIT 10`,
      ...(webhookId ? [webhookId] : []),
    );

    const webhookBreakdown: any[] = [];
    if (!webhookId) {
      const rows = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT "webhookId", count(*) as count,
           SUM(CASE WHEN type = 'ERROR' THEN 1 ELSE 0 END) as errors
         FROM "WebhookLog"
         WHERE "webhookId" IS NOT NULL
         GROUP BY "webhookId"
         ORDER BY count DESC
         LIMIT 10`,
      );
      for (const r of rows) {
        const w = await this.prisma.webhook.findUnique({
          where: { id: r.webhookId },
          select: { id: true, name: true },
        });
        if (w) webhookBreakdown.push({ ...w, count: Number(r.count), errors: Number(r.errors) });
      }
    }

    return {
      totalExecutions: totalLogs,
      successCount,
      errorCount: errorLogs,
      successRatePct: successRate,
      averageDurationMs: Math.round(avgDur),
      eventBreakdown: eventBreakdownRes.map(r => ({
        event: r.event,
        count: Number(r.count),
      })),
      webhookBreakdown,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Templates
  // ──────────────────────────────────────────────────────────────────────────

  async ensureBuiltInTemplates() {
    for (const t of BUILT_IN_TEMPLATES) {
      await this.prisma.webhookTemplate.upsert({
        where: { slug: t.slug },
        update: {},
        create: t as any,
      });
    }
  }

  async listTemplates(category?: string) {
    await this.ensureBuiltInTemplates();
    const where: any = { isActive: true };
    if (category) where.category = category;
    return this.prisma.webhookTemplate.findMany({
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  }

  async createFromTemplate(
    userId: string,
    templateId: string,
    dto: CreateFromTemplateDto,
  ) {
    await this.ensureBuiltInTemplates();
    const template = await this.prisma.webhookTemplate.findFirst({
      where: { OR: [{ id: templateId }, { slug: templateId }] },
    });
    if (!template) throw new NotFoundException('Template not found');

    const vars = dto.variables || {};
    const cfg = (template.config || {}) as any;
    const url = vars.url || cfg.url;
    if (!url) throw new BadRequestException('Missing variable: url');

    return this.create(userId, {
      name: dto.name || `${template.name}`,
      type: template.type as WebhookType,
      url,
      format: template.format as any,
      events: cfg.events || [],
      headers: cfg.headers || undefined,
      retryMaxAttempts: cfg.retryMaxAttempts,
      retryBackoffDelay: cfg.retryBackoffDelay,
      requiresAuth: cfg.requiresAuth,
      teamsChannelId: vars.channelId || cfg.channelId || cfg.teamsChannelId,
      teamsTeamId: vars.teamId || cfg.teamId || cfg.teamsTeamId,
      teamsCardType: cfg.teamsCardType as TeamsCardType | undefined,
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Incoming webhook (public entry point) + Content webhook legacy handler
  // ──────────────────────────────────────────────────────────────────────────

  async handleIncomingWebhook(
    id: string,
    rawBody: Buffer,
    parsedBody: any,
    headers: Record<string, string | string[] | undefined>,
    clientIp?: string,
  ) {
    const webhook = await this.prisma.webhook.findUnique({ where: { id } });
    if (!webhook || !webhook.isActive) throw new NotFoundException('Webhook not found');
    if (webhook.type !== WebhookType.INCOMING) {
      throw new BadRequestException('This endpoint is for incoming webhooks only');
    }
    return this.executor.handleIncoming(
      webhook, rawBody, parsedBody, headers, clientIp,
    );
  }

  // Legacy: content webhook authenticated via x-api-key
  async handleContentWebhook(body: any, apiKey: string) {
    if (!apiKey) throw new UnauthorizedException('API key is required');
    const keyHash = this.hashApiKey(apiKey);
    const apiKeyRecord = await this.prisma.apiKey.findUnique({
      where: { key: keyHash },
      include: { user: true },
    });
    if (!apiKeyRecord || !apiKeyRecord.isActive) {
      throw new UnauthorizedException('Invalid API key');
    }
    if (!apiKeyRecord.scopes.includes('content:create')) {
      throw new UnauthorizedException('Insufficient permissions');
    }
    const event = body.event;
    const data = body.data;

    await this.prisma.webhookLog.create({
      data: {
        webhookId: null,
        type: WebhookLogType.REQUEST,
        event,
        payload: body,
        attempt: 1,
      },
    });

    switch (event) {
      case 'article.create':
        return this.createArticleFromWebhook(data, apiKeyRecord.userId);
      case 'highlight.create':
        return this.createHighlightFromWebhook(data, apiKeyRecord.userId);
      case 'article.update':
        return this.updateArticleFromWebhook(data);
      case 'article.delete':
        return this.deleteArticleFromWebhook(data);
      default:
        throw new BadRequestException('Unknown event type');
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // API keys (keep existing)
  // ──────────────────────────────────────────────────────────────────────────

  async createApiKey(userId: string, name: string, scopes: string[]) {
    const rawKey = 'sk_' + crypto.randomBytes(24).toString('hex');
    const keyHash = this.hashApiKey(rawKey);
    const record = await this.prisma.apiKey.create({
      data: { name, key: keyHash, userId, scopes },
    });
    return { ...record, rawKey };
  }

  async listApiKeys(userId: string) {
    return this.prisma.apiKey.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeApiKey(userId: string, keyId: string) {
    return this.prisma.apiKey.update({
      where: { id: keyId, userId },
      data: { isActive: false },
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Internal helpers
  // ──────────────────────────────────────────────────────────────────────────

  private serializeOne(
    w: Webhook,
    opts: { revealSecret?: boolean } = {},
  ) {
    return {
      id: w.id,
      name: w.name,
      type: w.type,
      url: w.url,
      secret: opts.revealSecret ? w.secret : this.mask(w.secret),
      format: w.format,
      events: w.events,
      headers: w.headers,
      isActive: w.isActive,
      lastTriggeredAt: w.lastTriggeredAt,
      failureCount: w.failureCount,
      retryMaxAttempts: w.retryMaxAttempts,
      retryBackoffDelay: w.retryBackoffDelay,
      allowedIps: w.allowedIps,
      requiresAuth: w.requiresAuth,
      teamsChannelId: w.teamsChannelId,
      teamsTeamId: w.teamsTeamId,
      teamsCardType: w.teamsCardType,
      teamsCardTemplate: w.teamsCardTemplate,
      createdBy: w.createdBy,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
    };
  }

  private mask(secret: string | null): string | null {
    if (!secret) return null;
    if (secret.length <= 8) return '****';
    return secret.slice(0, 6) + '...' + secret.slice(-4);
  }

  private enforceOwnershipOrAdmin(w: Webhook, userId: string, role: any) {
    const isAdmin =
      role === 'ADMIN' || role === 'PLATFORM_ADMIN' || role === 'SUPER_ADMIN';
    if (!isAdmin && w.createdBy && w.createdBy !== userId) {
      throw new ForbiddenException('Access denied');
    }
  }

  private samplePayloadFor(event: string): any {
    const e = event.toLowerCase();
    if (e.includes('ticket')) {
      return {
        ticketNumber: 'TKT-' + Math.floor(1000 + Math.random() * 9000),
        subject: 'Sample: Printer is not responding',
        priority: e.includes('critical') || e.includes('emergency') ? 'CRITICAL' : 'MEDIUM',
        status: 'NEW',
        category: 'Technical',
        user: 'john.doe@example.com',
        message:
          'Sample description: The office printer in Room 404 is showing an error code. Please investigate.',
        url: 'https://vellum-admin.example.com/tickets',
      };
    }
    if (e.includes('alert')) {
      return {
        priority: e.includes('critical') ? 'CRITICAL' : 'HIGH',
        title: 'Sample: API response time degraded',
        message:
          'P95 latency for /api/* exceeded 1.5s for the last 5 minutes. Sample alert only.',
        source: 'monitoring-system-01',
        link: 'https://dashboard.example.com/alerts',
        resolutionSteps: [
          'Check upstream service health',
          'Review database query performance',
          'Scale API pods horizontally',
        ],
      };
    }
    if (e.includes('summary') || e.includes('report')) {
      return {
        title: 'Daily Activity Summary',
        period: '2026-08-24',
        newTickets: 12,
        resolvedTickets: 9,
        newUsers: 4,
        articlesPublished: 2,
      };
    }
    if (e.includes('article') || e.includes('publish')) {
      return {
        title: 'Sample Article: The Future of Work',
        category: 'Productivity',
        author: 'Jane Smith',
        excerpt: 'A short sample excerpt for a published article.',
        publishedAt: new Date().toISOString(),
        url: 'https://vellum.example.com/article/slug',
      };
    }
    if (e.includes('user') && e.includes('creat')) {
      return {
        userName: 'john.doe',
        email: 'john.doe@example.com',
        role: 'USER',
        signedUpAt: new Date().toISOString(),
      };
    }
    return { message: 'Test webhook payload', timestamp: new Date().toISOString() };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Content webhook legacy CRUD helpers (kept from original)
  // ──────────────────────────────────────────────────────────────────────────

  private async createArticleFromWebhook(data: any, authorId: string) {
    let category = await this.prisma.category.findFirst({
      where: {
        OR: [
          { name: data.category },
          { slug: data.category?.toLowerCase().replace(/[^a-z0-9]+/g, '-') },
        ],
      },
    });
    if (!category && data.category) {
      const slug = data.category
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 50);
      try {
        category = await this.prisma.category.create({
          data: { name: data.category, slug, tint: '#6366f1' },
        });
      } catch {
        category = await this.prisma.category.findFirst({ take: 1 });
      }
    }
    if (!category) category = await this.prisma.category.findFirst({ take: 1 });

    const slug = data.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 100);

    return this.prisma.article.create({
      data: {
        slug,
        title: data.title,
        excerpt: data.excerpt || '',
        body: data.body || [],
        cover: data.cover,
        readMinutes: data.readMinutes || 5,
        categoryId: category?.id || (await this.ensureDefaultCategory()).id,
        authorId,
        isPublished: data.isPublished !== false,
        publishedAt: data.isPublished !== false ? new Date() : null,
        featured: data.featured || false,
      },
    });
  }

  private async ensureDefaultCategory() {
    let category = await this.prisma.category.findFirst({ where: { slug: 'uncategorized' } });
    if (!category) {
      category = await this.prisma.category.create({
        data: { name: 'Uncategorized', slug: 'uncategorized', tint: '#9ca3af' },
      });
    }
    return category;
  }

  private async createHighlightFromWebhook(data: any, authorId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: authorId } });
    let aspectRatio: number | undefined = undefined;
    if (typeof data.aspectRatio === 'number') aspectRatio = data.aspectRatio;
    else if (typeof data.aspectRatio === 'string' && data.aspectRatio.includes(':')) {
      const [w, h] = data.aspectRatio.split(':').map(Number);
      if (!isNaN(w) && !isNaN(h) && h > 0) aspectRatio = w / h;
    }
    return this.prisma.highlight.create({
      data: {
        title: data.title,
        cover: data.cover,
        videoUrl: data.videoUrl,
        thumbnailUrl: data.thumbnailUrl,
        handle: data.handle || user?.handle || 'unknown',
        authorId,
        description: data.description,
        music: data.music,
        aspectRatio,
        duration: data.duration ? Number(data.duration) : null,
        isPublished: data.isPublished !== false,
        publishedAt: data.isPublished !== false ? new Date() : null,
      },
    });
  }

  private async updateArticleFromWebhook(data: any) {
    return this.prisma.article.update({
      where: { slug: data.slug },
      data: {
        title: data.title,
        excerpt: data.excerpt,
        body: data.body,
        cover: data.cover,
        readMinutes: data.readMinutes,
      },
    });
  }

  private async deleteArticleFromWebhook(data: any) {
    return this.prisma.article.update({
      where: { slug: data.slug },
      data: { deletedAt: new Date() },
    });
  }
}
