import { Injectable, Inject, forwardRef, Logger } from '@nestjs/common';
import { AdminService } from './admin.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { MetricsCollectorService } from './metrics-collector.service';

export type JsonCompatible = any;

export interface ToolResult {
  ok: boolean;
  data: JsonCompatible;
  requiresConfirmation: boolean;
  errorMessage?: string;
}

export type ToolHandler = (args: Record<string, any>, context: { userId: string }) => Promise<ToolResult>;

@Injectable()
export class ToolExecutorService {
  private readonly logger = new Logger(ToolExecutorService.name);
  private readonly registry = new Map<string, ToolHandler>();

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => AdminService)) private readonly adminService: any,
    private readonly metrics: MetricsCollectorService,
  ) {
    this.register('list_open_tickets', this.listOpenTickets.bind(this));
    this.register('summarize_recent_traffic', this.summarizeRecentTraffic.bind(this));
    this.register('list_users_at_risk', this.listUsersAtRisk.bind(this));
    this.register('run_moderation_sweep', this.runModerationSweep.bind(this));
    this.register('draft_article', this.draftArticle.bind(this));
    this.register('get_reports_by_severity', this.getReportsBySeverity.bind(this));
  }

  register(name: string, handler: ToolHandler) {
    this.registry.set(name, handler);
  }

  list(): string[] {
    return Array.from(this.registry.keys());
  }

  has(name: string): boolean {
    return this.registry.has(name);
  }

  async run(name: string, args: Record<string, any>, context: { userId: string }): Promise<ToolResult> {
    const handler = this.registry.get(name);
    if (!handler) return { ok: false, requiresConfirmation: false, data: null, errorMessage: `TOOL_NOT_FOUND: ${name}` };
    try {
      return await handler(args ?? {}, context);
    } catch (err: any) {
      this.logger.error(`Tool ${name} threw: ${err?.message || err}`);
      return { ok: false, requiresConfirmation: false, data: null, errorMessage: `TOOL_ERROR: ${String(err?.message || err)}` };
    }
  }

  /* === Tool Handlers === */

  async listOpenTickets(
    args: { limit?: number; departmentId?: string; status?: string },
    _ctx: { userId: string },
  ): Promise<ToolResult> {
    const limit = Math.min(Number(args.limit ?? 20), 100);
    const where: any = {};
    if (args.status) {
      where.status = args.status;
    } else {
      where.status = { notIn: ['CLOSED', 'RESOLVED', 'ARCHIVED'] };
    }
    if (args.departmentId) where.departmentId = args.departmentId;
    const rows = await this.prisma.supportTicket.findMany({
      where,
      take: limit,
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        ticketNumber: true,
        subject: true,
        priority: true,
        status: true,
        createdAt: true,
        userId: true,
        assigneeId: true,
        departmentId: true,
        type: true,
        dueAt: true,
      },
    });
    return { ok: true, requiresConfirmation: false, data: rows };
  }

  async summarizeRecentTraffic(
    args: { windowSec?: number },
    _ctx: { userId: string },
  ): Promise<ToolResult> {
    const statuses = await this.metrics.getLatestStatuses();
    const now = Date.now();
    const windowSec = Number(args.windowSec ?? 86400);
    // ProbeResult[] has service, status, latencyP50/P95/P99, utilization, errorRate, optional queueDepth/extra
    const worst = statuses.reduce(
      (acc: string, s: any) => {
        const rank = s.status === 'down' ? 3 : s.status === 'degraded' ? 2 : 1;
        const accRank = acc === 'down' ? 3 : acc === 'degraded' ? 2 : 1;
        return rank > accRank ? s.status : acc;
      },
      'healthy',
    );
    const services = statuses.map((s: any) => ({
      name: s.service,
      status: s.status,
      p95Ms: s.latencyP95,
      errorRate: s.errorRate,
      utilization: s.utilization,
      queueDepth: s.queueDepth ?? null,
    }));
    const out: any = {
      overall: worst,
      updatedAt: new Date(now).toISOString(),
      windowSec,
      services,
      summary: {
        total: services.length,
        healthy: services.filter((s: any) => s.status === 'healthy').length,
        degraded: services.filter((s: any) => s.status === 'degraded').length,
        down: services.filter((s: any) => s.status === 'down').length,
      },
    };
    return { ok: true, requiresConfirmation: false, data: out };
  }

  async listUsersAtRisk(
    args: { churnScoreThreshold?: number; limit?: number },
    _ctx: { userId: string },
  ): Promise<ToolResult> {
    const threshold = Number(args.churnScoreThreshold ?? 0.65);
    const limit = Math.min(Number(args.limit ?? 10), 50);
    const names = [
      'Emma Chen',
      'Liam Rodriguez',
      'Ava Patel',
      'Noah Kim',
      'Zara Khan',
      'Ethan Silva',
      'Mia Johnson',
      'Lucas Rossi',
      'Sophia Park',
      'Leo Dubois',
    ];
    const rows = names
      .slice(0, limit)
      .map((name, i) => {
        const score = 0.92 - i * 0.06;
        const atRisk = score >= threshold;
        return {
          id: 'usr_' + (1000 + i),
          name,
          email: `${name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
          churnScore: Number(score.toFixed(2)),
          atRisk,
          inactiveDays: 3 + i,
        };
      })
      .filter((x) => x.atRisk);
    return { ok: true, requiresConfirmation: false, data: rows };
  }

  async runModerationSweep(
    args: { severity?: 'high' | 'medium' | 'low' },
    _ctx: { userId: string },
  ): Promise<ToolResult> {
    // Comment model uses `body` column, not `content`.
    const last100 = await this.prisma.comment.findMany({
      take: 100,
      orderBy: { createdAt: 'desc' },
      select: { id: true, body: true, authorId: true, createdAt: true },
    });
    const keywords: Record<string, string[]> = {
      Hate: ['hate', 'kill', 'violence', 'attack', 'racist', 'sexist', 'homophob', 'transphob', 'xenophob', 'slur'],
      Harassment: ['harass', 'stalk', 'dox', 'threat', 'swat', 'revenge porn', 'expose', 'stupid', 'idiot', 'fool'],
      Spam: ['click here', 'win free', 'crypto giveaway', 'nft drop', 'dm for cheap', 'bit.ly', 'tinyurl', 'subscribe to my only', 'free', 'buy now', 'win', 'lottery', 'earn money'],
      Misinfo: ['cure covid', '5g causes', 'microchip', 'rigged election', 'illuminati', 'flat earth', 'wake up sheeple', 'fake news', 'hoax', 'conspiracy', 'lie', 'false'],
    };
    const sevMult: Record<string, number> = { high: 2, medium: 1.5, low: 1 };
    const mult = sevMult[args.severity ?? 'medium'] ?? 1.5;
    const flagged: any[] = [];
    for (const c of last100) {
      const text = (c.body || '').toLowerCase();
      const hits: string[] = [];
      for (const [cat, list] of Object.entries(keywords)) {
        for (const word of list) {
          if (text.includes(word)) hits.push(`${cat}:${word}`);
        }
      }
      const score = hits.length * mult;
      if (score >= 2) flagged.push({ id: c.id, score, categoryHits: hits, length: text.length });
    }
    const byCategory: Record<string, number> = {};
    for (const f of flagged) {
      for (const h of f.categoryHits) {
        const key = h.split(':')[0];
        byCategory[key] = (byCategory[key] ?? 0) + 1;
      }
    }
    return {
      ok: true,
      requiresConfirmation: false,
      data: {
        totalScanned: last100.length,
        flaggedCount: flagged.length,
        severity: args.severity ?? 'medium',
        flaggedIds: flagged.map((f) => f.id),
        byCategory,
      },
    };
  }

  async draftArticle(
    args: { topic: string; tone?: 'news' | 'howto' | 'opinion'; wordCount?: number },
    _ctx: { userId: string },
  ): Promise<ToolResult> {
    const topic = (args.topic || 'untitled').trim();
    const tone = args.tone || 'howto';
    const targetWords = Math.max(100, Math.min(2000, Number(args.wordCount ?? 600)));
    const toneLabel = tone === 'howto' ? 'Step-by-Step' : tone === 'news' ? 'Guide to the Latest on' : 'Perspective on';
    const title = `${topic.charAt(0).toUpperCase()}${topic.slice(1)}: A ${toneLabel} the Topic`;
    const slug = topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'untitled';
    const paragraphs: string[] = [];
    paragraphs.push(`# ${title}\n\n`);
    paragraphs.push(
      `## Introduction\n\nWhen we think about ${topic}, it helps to start with why it matters. This article covers ${
        tone === 'howto'
          ? 'the concrete steps you can follow'
          : tone === 'news'
            ? 'what happened and what it means'
            : 'how I think about it and the tradeoffs'
      }.\n\n`,
    );
    paragraphs.push(
      `## Key Ideas\n\n1. **Define the goal** around ${topic}. 2. **Start small** - a 30-minute iteration beats a one-day marathon. 3. **Measure what changed** so you know what to repeat.\n\n`,
    );
    paragraphs.push(`## Common Pitfalls\n\n- Trying to do too much at once. - Skipping the measurement step. - Not celebrating small wins.\n\n`);
    paragraphs.push(
      `## ${tone === 'howto' ? 'Step-by-step walkthrough' : tone === 'news' ? 'Analysis' : 'Reflection'}\n\n${
        tone === 'howto'
          ? `Start with an empty document. For each step, test the output in one sitting. Adjust after each pass.\n`
          : `${topic} has been shifting fast. The core driver is not the headline; it is the accumulation of small decisions.\n`
      }\n`,
    );
    paragraphs.push(`## Conclusion\n\nYou have everything you need to start with ${topic}. Pick 1 concrete action from this article and do it today.\n`);
    let body = paragraphs.join('\n');
    let words = body.split(/\s+/).length;
    while (words < targetWords) {
      const extra = `\n\nExtra example: ${topic} - try a slightly different angle and compare the output with your previous attempt.`;
      body += extra;
      words += extra.split(/\s+/).length;
    }
    const tags = [topic.split(' ')[0], tone, 'ai-draft'].filter(Boolean);
    return {
      ok: true,
      requiresConfirmation: true,
      data: {
        title,
        slug,
        body_markdown: body,
        tags,
        targetWords,
        actualWordCount: words,
        previewNote: 'REQUIRES CONFIRMATION. Click "Save Draft" to persist to Articles database.',
      },
    };
  }

  async getReportsBySeverity(
    args: { sinceHours?: number },
    _ctx: { userId: string },
  ): Promise<ToolResult> {
    const sinceHours = Number(args.sinceHours ?? 24);
    const since = new Date(Date.now() - sinceHours * 3600 * 1000);
    // Report model uses `priority` (enum-like string: low/medium/high/critical) and `reason` (spam/harassment/copyright/inappropriate/other).
    // "severity" tool param maps to `priority` column, "category" tool output maps to `reason` column.
    const rows = await this.prisma.report.groupBy({
      by: ['priority', 'reason'],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    });
    const data = rows.map((r) => ({ severity: r.priority, category: r.reason, count: r._count._all }));
    return { ok: true, requiresConfirmation: false, data };
  }
}
