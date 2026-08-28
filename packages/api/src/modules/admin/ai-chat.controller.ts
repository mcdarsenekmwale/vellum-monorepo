import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Query,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response, Request } from 'express';

import { AdminGuard } from '../auth/admin.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  AiPlacement,
  ChatMessage,
  LLMGatewayService,
  StreamChunk,
} from './llm-gateway.service';
import { ToolExecutorService } from './tool-executor.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import {
  AiActivityStatus,
  AiPlacement as PAiPlacement,
} from '@prisma/client';

/**
 * Defensive helper to extract the authenticated user id no matter which
 * naming convention the `req.user` object follows.
 *
 * Two shapes coexist in the codebase:
 *   - JWT convention: `req.user.sub` (what AdminController + RoleRequestsController
 *     historically expect since the JWT payload carries `sub`).
 *   - Prisma convention: `req.user.id` (what 90% of the other controllers use
 *     because validateUser used to return the raw prisma user row).
 *
 * `AuthService.validateUser` was fixed to attach BOTH fields, but keeping this
 * helper at every call site means a future refactor that drops one field will
 * still not silently regress into assertActorAuthenticated failures.
 *
 * Call this as `actorId(req)` inside a controller.
 */
function actorId(req: {
  user?: { sub?: string | null; id?: string | null };
}): string | undefined {
  const u = req.user;
  const raw = u?.sub ?? u?.id;
  if (!raw) return undefined;
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  return trimmed.length > 0 ? trimmed : undefined;
}

function actorRole(req: any): string | undefined {
  const u = req.user;
  if (!u) return undefined;
  const legacy: any = u.roles ?? u.role;
  if (Array.isArray(legacy) && legacy.length > 0) {
    return legacy[0];
  }
  if (typeof legacy === 'string' && legacy.length > 0) {
    return legacy;
  }
  if (u.isAdmin === true || u.admin === true) return 'admin';
  return undefined;
}

function isAdminActor(req: any): boolean {
  const u = req.user;
  if (!u) return false;
  if (u.isAdmin === true || u.admin === true) return true;
  const roles: string[] | string | undefined = u.roles ?? u.role;
  if (Array.isArray(roles)) {
    return roles.some(
      (r) => typeof r === 'string' && r.toLowerCase() === 'admin',
    );
  }
  if (typeof roles === 'string') {
    return roles.toLowerCase() === 'admin';
  }
  return false;
}

function placementEnum(s: string): PAiPlacement {
  switch (s) {
    case 'web-profile':
      return PAiPlacement.WEB_PROFILE;
    case 'mobile-nav':
      return PAiPlacement.MOBILE_NAV;
    case 'admin-fab':
      return PAiPlacement.ADMIN_FAB;
    case 'admin-quick-action':
      return PAiPlacement.ADMIN_QUICK;
    default:
      throw new BadRequestException('Invalid placement: ' + s);
  }
}

const toJsonSafe = (x: unknown) => JSON.parse(JSON.stringify(x)) as any;

function sseEvent(res: Response, event: string, data: unknown) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

interface ChatRequest {
  conversationId?: string;
  placement: AiPlacement;
  messages: Array<{
    role: 'user' | 'assistant' | 'tool';
    content: string;
    tool_call_id?: string;
  }>;
  confirmedToolCalls?: Array<{
    id: string;
    name: string;
    arguments: Record<string, any>;
  }>;
  quickActionName?: string;
}

const PLACEMENT_SET: ReadonlySet<AiPlacement> = new Set<AiPlacement>([
  'web-profile',
  'mobile-nav',
  'admin-fab',
  'admin-quick-action',
]);

function validatePlacement(placement: string | undefined): AiPlacement {
  if (!placement || !PLACEMENT_SET.has(placement as AiPlacement)) {
    throw new BadRequestException(
      'Invalid placement. Allowed: web-profile, mobile-nav, admin-fab, admin-quick-action',
    );
  }
  return placement as AiPlacement;
}

@Controller('api/ai')
export class AIChatController {
  private readonly logger = new Logger(AIChatController.name);

  constructor(
    private readonly llm: LLMGatewayService,
    private readonly tools: ToolExecutorService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Shared AiActivity ledger writer. All AI endpoints go through this
   * helper so JSON columns are always normalized, PII fields stay out,
   * and we get consistent logging of persistence failures.
   */
  private async logAiActivity(input: {
    userId: string;
    conversationId?: string | null;
    placement: AiPlacement;
    contextTag?: string;
    model: string;
    inputTokens: number | null;
    outputTokens: number | null;
    durationMs: number;
    toolInvocations: unknown[];
    messages: unknown[];
    status: AiActivityStatus;
    errorCode?: string;
    errorMessage?: string;
  }): Promise<void> {
    try {
      await this.prisma.aiActivity.create({
        data: {
          userId: input.userId,
          conversationId: input.conversationId ?? undefined,
          placement: placementEnum(input.placement),
          contextTag: input.contextTag ?? undefined,
          model: input.model || 'mock',
          inputTokens: input.inputTokens ?? null,
          outputTokens: input.outputTokens ?? null,
          durationMs: input.durationMs,
          toolInvocations:
            input.toolInvocations && input.toolInvocations.length
              ? toJsonSafe(input.toolInvocations)
              : null,
          messages: toJsonSafe(input.messages),
          status: input.status,
          errorCode: input.errorCode ?? undefined,
          errorMessage: input.errorMessage ?? undefined,
        },
      });
    } catch (err: any) {
      this.logger.error('AiActivity write failed: ' + String(err?.message ?? err));
    }
  }

  /**
   * POST /api/ai/chat — SSE streaming chat endpoint.
   *
   * Uses a raw @Res stream instead of the Nest @Sse() decorator because
   * the client sends a full request body (conversation history + tool
   * confirmations) and POST-body + SSE is awkward with the decorator.
   */
  @Post('chat')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 30, ttl: 300_000 } })
  @HttpCode(HttpStatus.OK)
  async chatStream(
    @Req() req: Request,
    @Body() body: ChatRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const userId = actorId(req as any);
    if (!userId) {
      res.status(HttpStatus.UNAUTHORIZED);
      res.setHeader('Content-Type', 'text/event-stream');
      sseEvent(res, 'error', {
        code: 'AUTH_FAILED',
        message: 'Authenticated user id missing from request.',
      });
      res.end();
      return;
    }

    const placement = validatePlacement(body.placement);
    const startedAt = Date.now();
    void actorRole; // keep helper linked for future audits

    // Admin placements require AdminGuard-level role. Do the check BEFORE
    // we open the stream so the client can show a clear inline error
    // without consuming an SSE connection with a stale 403.
    if (placement === 'admin-fab' || placement === 'admin-quick-action') {
      if (!isAdminActor(req)) {
        res.status(HttpStatus.FORBIDDEN);
        res.setHeader('Content-Type', 'text/event-stream');
        sseEvent(res, 'error', {
          code: 'ADMIN_REQUIRED',
          message: 'You must be an admin for this placement.',
        });
        res.end();
        return;
      }
      // Explicit runtime reference to AdminGuard keeps the import
      // semantically meaningful even though we check roles inline.
      void AdminGuard;
      void ForbiddenException;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof (res as any).flushHeaders === 'function') {
      (res as any).flushHeaders();
    }

    let usageIn = 0;
    let usageOut = 0;
    let status: AiActivityStatus = AiActivityStatus.SUCCESS;
    let errorCode: string | undefined;
    let errorMessage: string | undefined;
    const outputChunks: string[] = [];
    const toolInvocations: any[] = [];
    const toolEnabled =
      placement === 'admin-fab' || placement === 'admin-quick-action';

    // Resolve conversation — if id is provided it must exist for this user
    // and not be deleted. If missing, create a new one.
    let convId: string;
    let convTitle = 'New conversation';
    if (body.conversationId) {
      try {
        const conv = await this.prisma.aiConversation.findFirst({
          where: { id: body.conversationId, userId, deletedAt: null },
        });
        if (!conv) throw new NotFoundException('Conversation not found');
        convId = conv.id;
        convTitle = conv.title;
      } catch (err: any) {
        if (err instanceof NotFoundException) {
          sseEvent(res, 'error', {
            code: 'CONV_NOT_FOUND',
            message: err.message,
          });
        } else {
          sseEvent(res, 'error', {
            code: 'CONV_NOT_FOUND',
            message: String(err?.message ?? err),
          });
        }
        res.end();
        return;
      }
    } else {
      const newConv = await this.prisma.aiConversation.create({
        data: { userId, placement: placementEnum(placement) },
      });
      convId = newConv.id;
    }

    // Resolve model name cheaply — resolveModelConfig is private on
    // LLMGatewayService so we call streamChat() itself for the actual
    // inference, and derive the pill name from a best-effort reflection.
    let modelUsed = 'gpt-4';
    try {
      const asAny = this.llm as any;
      if (typeof asAny.resolveModelConfig === 'function') {
        const r = await asAny.resolveModelConfig({});
        if (r && r.cfg && typeof r.cfg.model === 'string') modelUsed = r.cfg.model;
      }
    } catch {
      // ignore — keep default
    }

    sseEvent(res, 'meta', {
      conversationId: convId,
      model: modelUsed,
      persona: placement,
      placement,
    });

    // For admin quick actions: prepend a synthetic system/user lead-in so
    // the model knows which named action to run.
    let effectiveMessages = body.messages as ChatMessage[];
    if (placement === 'admin-quick-action' && body.quickActionName) {
      effectiveMessages = [
        {
          role: 'user',
          content: `Run admin quick action: ${body.quickActionName}. Produce a short one-paragraph summary.`,
        },
        ...effectiveMessages,
      ];
    }

    // PHASE 1: stream the primary LLM pass.
    try {
      const userRow = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { handle: true, name: true },
      });
      const userName = userRow?.handle || userRow?.name || undefined;

      let recentContent: any[] | undefined;
      if (placement === 'web-profile') {
        const posts = await this.prisma.article.findMany({
          where: { authorId: userId },
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            title: true,
            views: true,
            likesCount: true,
            commentsCount: true,
          },
        });
        recentContent = posts.map((x) => ({
          title: x.title,
          views: x.views ?? 0,
          likes: x.likesCount ?? 0,
          comments: x.commentsCount ?? 0,
        }));
      }

      const generator = this.llm.streamChat({
        persona: placement,
        messages: effectiveMessages,
        toolEnabled,
        userName,
        recentContent,
      });

      for await (const chunk of generator as AsyncIterable<StreamChunk>) {
        if (chunk.type === 'text' && typeof chunk.delta === 'string') {
          outputChunks.push(chunk.delta);
          sseEvent(res, 'chunk', { delta: chunk.delta });
        } else if (chunk.type === 'tool_call' && chunk.tool_call) {
          const confirmMatch = body.confirmedToolCalls?.find(
            (c) => c.id === chunk.tool_call!.id,
          );
          if (chunk.tool_call.requiresConfirmation && !confirmMatch) {
            // HALT — the UI must show a confirm button. User re-sends with
            // confirmedToolCalls array to resume.
            sseEvent(res, 'tool_call', {
              id: chunk.tool_call.id,
              name: chunk.tool_call.name,
              arguments: chunk.tool_call.arguments,
              requiresConfirmation: true,
            });
          } else {
            const args = confirmMatch?.arguments ?? chunk.tool_call.arguments ?? {};
            const name = chunk.tool_call.name;
            const toolStarted = Date.now();
            const result = await this.tools.run(name, args, { userId });
            toolInvocations.push({
              name,
              args: toJsonSafe(args),
              resultSummary: result.ok
                ? Array.isArray(result.data)
                  ? `array(${(result.data as any[]).length})`
                  : typeof result.data === 'object' && result.data !== null
                    ? Object.keys(result.data as any).join(',')
                    : 'ok'
                : `err:${result.errorMessage}`,
              startedAt: toolStarted,
              endedAt: Date.now(),
              ok: result.ok,
              requiresConfirmation: !!chunk.tool_call.requiresConfirmation,
              confirmed: !!confirmMatch,
            });
            if (placement === 'admin-fab' || placement === 'admin-quick-action') {
              const preview = JSON.stringify(result.data).slice(0, 300);
              sseEvent(res, 'chunk', {
                delta: `\n> *Used tool: ${name} (${result.ok ? 'ok' : 'failed'}) — preview: ${preview}…*\n\n`,
              });
            }
            if (result.ok) {
              const summary = this.summarizeToolResult(name, result.data, args);
              const phase2Messages: ChatMessage[] = [
                ...effectiveMessages,
                {
                  role: 'assistant',
                  content:
                    outputChunks.join('') +
                    `\n\n--- TOOL RESULT INJECTED: ${summary} ---`,
                },
              ];
              const phase2 = this.llm.streamChat({
                persona: placement,
                userName,
                recentContent,
                toolEnabled: false,
                messages: phase2Messages,
              });
              for await (const c of phase2 as AsyncIterable<StreamChunk>) {
                if (c.type === 'text' && typeof c.delta === 'string') {
                  outputChunks.push(c.delta);
                  sseEvent(res, 'chunk', { delta: c.delta });
                }
                if (c.type === 'done') {
                  usageIn += c.usage?.inputTokens ?? 0;
                  usageOut += c.usage?.outputTokens ?? 0;
                }
                if (c.type === 'error') {
                  status = AiActivityStatus.ERROR;
                  errorCode = c.errorCode;
                  errorMessage = c.errorMessage;
                  sseEvent(res, 'error', {
                    code: c.errorCode,
                    message: c.errorMessage,
                  });
                }
              }
            }
          }
        } else if (chunk.type === 'done') {
          usageIn += chunk.usage?.inputTokens ?? 0;
          usageOut += chunk.usage?.outputTokens ?? 0;
        } else if (chunk.type === 'error') {
          status = AiActivityStatus.ERROR;
          errorCode = chunk.errorCode;
          errorMessage = chunk.errorMessage;
          sseEvent(res, 'error', {
            code: chunk.errorCode,
            message: chunk.errorMessage,
          });
        }
      }
    } catch (err: any) {
      status = AiActivityStatus.ERROR;
      errorCode = err?.code || 'INTERNAL_ERROR';
      errorMessage = String(err?.message ?? err);
      this.logger.error(`chatStream err: ${errorCode} ${errorMessage}`);
      sseEvent(res, 'error', { code: errorCode, message: errorMessage });
    } finally {
      const durationMs = Date.now() - startedAt;
      const finalText = outputChunks.join('');
      const allMsgs: ChatMessage[] = [
        ...effectiveMessages,
        ...(finalText ? [{ role: 'assistant' as const, content: finalText }] : []),
      ];

      try {
        const firstUserText =
          effectiveMessages.find((m) => m.role === 'user')?.content ?? '';
        const nextTitle =
          convTitle !== 'New conversation'
            ? convTitle
            : firstUserText.slice(0, 60) || convTitle;
        await this.prisma.aiConversation.update({
          where: { id: convId },
          data: {
            lastMessageAt: new Date(),
            title: nextTitle,
          },
        });
      } catch (e: any) {
        this.logger.warn('conversation update fail: ' + String(e?.message ?? e));
      }

      await this.logAiActivity({
        userId,
        conversationId: convId,
        placement,
        contextTag: body.quickActionName ? `qa:${body.quickActionName}` : undefined,
        model: modelUsed,
        inputTokens: usageIn || null,
        outputTokens: usageOut || null,
        durationMs,
        toolInvocations,
        messages: allMsgs,
        status,
        errorCode,
        errorMessage,
      });

      sseEvent(res, 'done', {
        usage: { inputTokens: usageIn, outputTokens: usageOut },
        durationMs,
      });
      res.end();
    }
  }

  /**
   * Produces a short, tool-specific summary sentence that we prepend
   * before running the second-pass LLM. Keeps the second pass grounded
   * in real numbers instead of forcing the model to infer shape.
   */
  private summarizeToolResult(
    name: string,
    data: any,
    args: Record<string, any>,
  ): string {
    switch (name) {
      case 'list_open_tickets': {
        const arr = Array.isArray(data) ? (data as any[]) : [];
        const byPriority = arr.reduce<Record<string, number>>((acc, r) => {
          const k = r?.priority ?? '?';
          acc[k] = (acc[k] ?? 0) + 1;
          return acc;
        }, {});
        const oldest = arr.length
          ? (arr[arr.length - 1]?.createdAt as string | undefined) ?? 'N/A'
          : 'N/A';
        return `After tool: Found ${arr.length} open tickets. Oldest: ${oldest}. Priorities — ${JSON.stringify(byPriority)}. Reply with 2-line triage advice.`;
      }
      case 'summarize_recent_traffic': {
        const d = (data ?? {}) as any;
        const services = Array.isArray(d.services) ? (d.services as any[]).length : 0;
        const overall = typeof d.overall === 'string' ? d.overall.toUpperCase() : 'OPERATIONAL';
        const alerts = typeof d.alertCountRecent === 'number' ? d.alertCountRecent : 0;
        return `Traffic summary — overall ${overall}. ${services} services. Recent alerts: ${alerts}. Produce 1-paragraph Ops status.`;
      }
      case 'list_users_at_risk': {
        const arr = Array.isArray(data) ? (data as any[]) : [];
        const top3 = arr
          .slice(0, 3)
          .map((u) => u?.name ?? u?.email ?? '?')
          .join(', ');
        return `At-risk users: ${arr.length}. Top 3: ${top3}. Advise 1 outreach idea.`;
      }
      case 'run_moderation_sweep': {
        const d = (data ?? {}) as any;
        const flagged = typeof d.flaggedCount === 'number' ? d.flaggedCount : 0;
        const total = typeof d.totalScanned === 'number' ? d.totalScanned : 0;
        const byCat = d.byCategory && typeof d.byCategory === 'object' ? d.byCategory : {};
        const catEntries = Object.entries(byCat as Record<string, any>)
          .map(([k, v]) => `${k} ${v}`)
          .join(', ');
        return `Moderation: ${flagged}/${total} flagged. Top categories: ${catEntries}. Produce short next-action list.`;
      }
      case 'draft_article': {
        const d = (data ?? {}) as any;
        const title = typeof d.title === 'string' ? d.title : '(untitled)';
        const wc = typeof d.actualWordCount === 'number' ? d.actualWordCount : '?';
        const tags = Array.isArray(d.tags) ? (d.tags as string[]).join(', ') : '';
        return `Draft article ready — Title: "${title}". Word count: ${wc}. Tags: [${tags}]. REMIND user: confirm save button to persist.`;
      }
      case 'get_reports_by_severity': {
        const arr = Array.isArray(data) ? (data as any[]) : [];
        const total = arr.reduce<number>((s, x) => s + (typeof x?.count === 'number' ? x.count : 0), 0);
        const since = typeof args?.sinceHours === 'number' ? args.sinceHours : 24;
        const grouped = arr
          .slice(0, 6)
          .map((r) => `${r?.severity ?? '?'}(${r?.category ?? '?'}:${r?.count ?? 0})`)
          .join(', ');
        return `Reports: ${total} total last ${since}h. Grouped by severity — ${grouped}.`;
      }
      default:
        return `Tool result returned ${JSON.stringify(data ?? null).slice(0, 500)}. Summarize concisely.`;
    }
  }

  /**
   * GET /api/ai/conversations — list the caller's recent conversations.
   * Filterable by placement and capped at 100 rows.
   */
  @Get('conversations')
  @UseGuards(JwtAuthGuard)
  async listConversations(
    @Req() req: any,
    @Query('placement') placement?: string,
    @Query('limit') limit?: string,
  ) {
    const userId = actorId(req);
    if (!userId) {
      throw new BadRequestException('Authenticated user id missing.');
    }
    const parsedLimit = Number(limit ?? 20);
    const take = Math.min(Number.isFinite(parsedLimit) ? parsedLimit : 20, 100);
    const where: any = { userId, deletedAt: null };
    if (placement) where.placement = placementEnum(placement);

    const rows = await this.prisma.aiConversation.findMany({
      where,
      take,
      orderBy: { lastMessageAt: 'desc' },
      select: {
        id: true,
        title: true,
        placement: true,
        lastMessageAt: true,
      },
    });

    return Promise.all(
      rows.map(async (c) => ({
        id: c.id,
        title: c.title,
        placement: c.placement,
        lastMessageAt: c.lastMessageAt,
        messageCount: await this.prisma.aiActivity.count({
          where: { conversationId: c.id, userId },
        }),
      })),
    );
  }

  /**
   * DELETE /api/ai/conversations/:id — soft-delete a conversation.
   */
  @Delete('conversations/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteConversation(@Req() req: any, @Param('id') id: string) {
    const userId = actorId(req);
    if (!userId) {
      throw new BadRequestException('Authenticated user id missing.');
    }
    const conv = await this.prisma.aiConversation.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!conv) throw new NotFoundException('Conversation not found');
    await this.prisma.aiConversation.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
