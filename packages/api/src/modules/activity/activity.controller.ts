import {
  Controller, Get, Put, Post, Delete, Param, Query, Body, UseGuards,
  Req, Res, Header, Logger, ForbiddenException, BadRequestException,
  NotFoundException, HttpCode, HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotificationKind } from '@prisma/client';
import type { Request, Response } from 'express';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { ActivityAggregatorService } from './activity-aggregator.service';
import {
  FeedQueryDto,
  MarkReadDto,
  UpdatePrefsDto,
  ExpoTokenDto,
  WebhookInboundDto,
} from './activity.dto';

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
function actorId(req: { user?: { sub?: string | null; id?: string | null } }): string | undefined {
  const u = req.user;
  const raw = u?.sub ?? u?.id;
  if (!raw) return undefined;
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  return trimmed.length > 0 ? trimmed : undefined;
}

const HH_MM_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

@ApiTags('Activity')
@Controller('api/activity')
export class ActivityController {
  private readonly logger = new Logger(ActivityController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aggregator: ActivityAggregatorService,
    private readonly events: EventEmitter2,
  ) {}

  // -------------------------------------------------------------------------
  // 1. Cursor feed (hydrated with actor handles/names)
  // -------------------------------------------------------------------------
  @Get('feed')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Paginated activity feed (cursor-based)' })
  @ApiResponse({ status: 200, description: 'Feed items with pageInfo' })
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async getFeed(@Req() req: any, @Query() q: FeedQueryDto) {
    const userId = actorId(req);
    if (!userId) throw new ForbiddenException('FORBIDDEN');

    const limit = Math.max(1, Math.min(100, q.limit ?? 25));
    const fetchN = limit + 1; // probe one extra for hasMore detection
    const onlyUnread = !!q.onlyUnread;

    const where: any = { userId, dismissedAt: null };
    if (onlyUnread) where.read = false;
    if (q.before?.length) {
      const cursorRow = await this.prisma.activityItem.findUnique({
        where: { id: q.before },
        select: { latestActivityAt: true, id: true },
      });
      if (cursorRow) {
        where.OR = [
          { latestActivityAt: { lt: cursorRow.latestActivityAt } },
          {
            latestActivityAt: { equals: cursorRow.latestActivityAt },
            id: { lt: cursorRow.id },
          },
        ];
      }
    }

    const rows = await this.prisma.activityItem.findMany({
      where,
      take: fetchN,
      orderBy: [{ latestActivityAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true, kind: true, count: true, previewText: true,
        articleSlug: true, highlightId: true, commentId: true, linkHref: true,
        read: true, readAt: true, latestActivityAt: true, createdAt: true, actorIds: true,
      },
    });

    const hasMore = rows.length > limit;
    const trimmed = hasMore ? rows.slice(0, limit) : rows;

    // Hydrate actorIds → actor objects { id, handle, name, avatarUrl? }
    const allIds = new Set<string>();
    for (const r of trimmed) for (const aid of r.actorIds) allIds.add(aid);
    const actorsMap = new Map<string, any>();
    if (allIds.size > 0) {
      const users = await this.prisma.user.findMany({
        where: { id: { in: [...allIds] } },
        select: { id: true, handle: true, name: true, avatar: true },
      });
      for (const u of users) actorsMap.set(u.id, u);
    }

    const hydrated = trimmed.map(r => ({
      ...r,
      actors: r.actorIds.map(aid => actorsMap.get(aid) || { id: aid, handle: null, name: 'Someone', avatar: null }),
    }));

    const endCursor = hasMore && hydrated.length > 0 ? hydrated[hydrated.length - 1].id : null;

    return {
      nodes: hydrated,
      rows: hydrated, // backward-compat alias for legacy / T9 curl gate G4 callers that expect rows[]
      pageInfo: {
        hasNextPage: hasMore,
        hasPreviousPage: !!q.before,
        endCursor,
      },
    };
  }

  // -------------------------------------------------------------------------
  // 2. Unread count
  // -------------------------------------------------------------------------
  @Get('unread-count')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Count of unread, non-dismissed activity items' })
  @ApiResponse({ status: 200, description: '{ unread: number }' })
  async getUnreadCount(@Req() req: any) {
    const userId = actorId(req);
    if (!userId) throw new ForbiddenException('FORBIDDEN');
    return { unread: await this.aggregator.countUnread(userId) };
  }

  // -------------------------------------------------------------------------
  // 3. SSE stream (raw stream + query-param token fallback, heartbeats 15s)
  // -------------------------------------------------------------------------
  @Get('stream')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Header('X-Accel-Buffering', 'no')
  @Header('Cache-Control', 'no-cache, no-transform')
  @Header('Content-Type', 'text/event-stream')
  async sseStream(@Req() req: Request, @Res() res: Response, @Query('token') tokenQ?: string) {
    let userId: string | undefined;
    try { userId = actorId(req as any); } catch {}

    if (!userId && tokenQ && tokenQ.length > 32) {
      const row = await this.prisma.session.findFirst({
        where: { sessionToken: tokenQ },
        select: { userId: true, expiresAt: true },
      });
      if (row && row.expiresAt > new Date()) userId = row.userId;
    }

    if (!userId) {
      res.status(403);
      res.end('event: error\ndata: {"code":"FORBIDDEN"}\n\n');
      return;
    }

    // Track SSE user connection for admin stats
    this.aggregator.sseUserConnected(userId);

    res.flushHeaders?.();
    const send = (ev: string, data: any) => {
      res.write(`event: ${ev}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    send('hello', { unread: await this.aggregator.countUnread(userId) });

    const heartbeat = setInterval(() => send('ping', Date.now()), 15_000);

    const onAct = (p: any) => { if (p.userId === userId) send('activity', { id: p.id, kind: p.kind }); };
    const onUnr = (p: any) => { if (p.userId === userId) send('unread', { unread: p.unread }); };

    this.events.on('sse.activity.created.' + userId, onAct);
    this.events.on('sse.activity.unread.' + userId, onUnr);

    req.on('close', () => {
      clearInterval(heartbeat);
      this.events.removeListener('sse.activity.created.' + userId, onAct);
      this.events.removeListener('sse.activity.unread.' + userId, onUnr);
      this.aggregator.sseUserDisconnected(userId);
      res.end();
    });
  }

  // -------------------------------------------------------------------------
  // 4. Mark read (ids OR all) — emits SSE unread event
  //    Supports PUT body { all, ids } legacy DTO shape AND POST body { mode:"all"|"ids", ids } alias.
  // -------------------------------------------------------------------------
  @Put('read')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark activity items as read by ids or all (PUT legacy)' })
  @ApiResponse({ status: 200, description: '{ ok: true, affected, unread } remaining' })
  async markReadPut(@Req() req: any, @Body() body: MarkReadDto) {
    return this._markReadImpl(req, body);
  }

  @Post('read')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark activity items as read by ids or all — POST alias with mode:"all"|"ids"' })
  @ApiResponse({ status: 200, description: '{ ok: true, affected, unread } remaining' })
  async markReadPost(@Req() req: any, @Body() body: any) {
    // Translate { mode: "all"|"ids", ids? } to legacy shape for impl
    const translated: MarkReadDto = {
      ids: body.ids,
      all: body.mode === 'all' ? true : (body.all ?? false),
    };
    return this._markReadImpl(req, translated);
  }

  private async _markReadImpl(req: any, body: MarkReadDto) {
    const userId = actorId(req);
    if (!userId) throw new ForbiddenException('FORBIDDEN');
    if (!body.all && !body.ids?.length) {
      throw new BadRequestException('Provide ids[] or all=true (or mode:"all" via POST alias)');
    }

    const { affected, unread } = await this.aggregator.markRead(userId, { ids: body.ids, all: body.all });
    this.events.emit('sse.activity.unread.' + userId, { userId, unread });
    return { ok: true, affected, unread };
  }

  // -------------------------------------------------------------------------
  // 5. Dismiss / delete single row
  // -------------------------------------------------------------------------
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Dismiss a single activity row' })
  @ApiResponse({ status: 200, description: '{ success: true }' })
  async dismiss(@Req() req: any, @Param('id') id: string) {
    const userId = actorId(req);
    if (!userId) throw new ForbiddenException('FORBIDDEN');

    const row = await this.prisma.activityItem.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('NOT_FOUND');
    if (row.userId !== userId) throw new ForbiddenException('FORBIDDEN');

    await this.prisma.activityItem.update({
      where: { id },
      data: { dismissedAt: new Date() },
    });

    const unread = await this.aggregator.countUnread(userId);
    this.events.emit('sse.activity.unread.' + userId, { userId, unread });

    return { success: true, unread };
  }

  // -------------------------------------------------------------------------
  // 6. Preferences GET
  // -------------------------------------------------------------------------
  @Get('preferences')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get activity notification preferences' })
  @ApiResponse({ status: 200, description: 'Preferences object' })
  async getPreferences(@Req() req: any) {
    const userId = actorId(req);
    if (!userId) throw new ForbiddenException('FORBIDDEN');

    const settings = await this.prisma.userSettings.findFirst({
      where: { userId },
      select: {
        notificationPrefs: {
          select: {
            groupLikes: true, groupComments: true, groupFollows: true,
            activityReminderEveryMinutes: true,
            quietHoursStart: true, quietHoursEnd: true,
          },
        },
      },
    });

    return settings?.notificationPrefs ?? {
      groupLikes: true, groupComments: true, groupFollows: true,
      activityReminderEveryMinutes: 0,
      quietHoursStart: null, quietHoursEnd: null,
    };
  }

  // -------------------------------------------------------------------------
  // 7. Preferences PUT
  // -------------------------------------------------------------------------
  @Put('preferences')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update activity notification preferences' })
  @ApiResponse({ status: 200, description: 'Updated preferences' })
  async updatePreferences(@Req() req: any, @Body() body: UpdatePrefsDto) {
    const userId = actorId(req);
    if (!userId) throw new ForbiddenException('FORBIDDEN');

    if (body.quietHoursStart !== undefined && body.quietHoursStart !== null && body.quietHoursStart !== '') {
      if (!HH_MM_REGEX.test(body.quietHoursStart)) {
        throw new BadRequestException('quietHoursStart must be HH:MM (24h) or empty');
      }
    }
    if (body.quietHoursEnd !== undefined && body.quietHoursEnd !== null && body.quietHoursEnd !== '') {
      if (!HH_MM_REGEX.test(body.quietHoursEnd)) {
        throw new BadRequestException('quietHoursEnd must be HH:MM (24h) or empty');
      }
    }

    let settings = await this.prisma.userSettings.findFirst({
      where: { userId },
      select: { id: true, notificationPrefs: { select: { id: true } } },
    });
    if (!settings) {
      settings = await this.prisma.userSettings.create({
        data: { userId },
        select: { id: true, notificationPrefs: { select: { id: true } } },
      });
    }

    const data: any = {};
    if (body.groupLikes !== undefined) data.groupLikes = body.groupLikes;
    if (body.groupComments !== undefined) data.groupComments = body.groupComments;
    if (body.groupFollows !== undefined) data.groupFollows = body.groupFollows;
    if (body.activityReminderEveryMinutes !== undefined) data.activityReminderEveryMinutes = body.activityReminderEveryMinutes;
    if (body.quietHoursStart !== undefined) data.quietHoursStart = body.quietHoursStart || null;
    if (body.quietHoursEnd !== undefined) data.quietHoursEnd = body.quietHoursEnd || null;

    let prefs;
    if (!settings.notificationPrefs?.id) {
      prefs = await this.prisma.notificationPreferences.create({
        data: { userSettingsId: settings.id, ...data },
      });
    } else {
      prefs = await this.prisma.notificationPreferences.update({
        where: { id: settings.notificationPrefs.id },
        data,
      });
    }

    return prefs;
  }

  // -------------------------------------------------------------------------
  // 8. Expo push token register / unregister (dedup array)
  //    Two route aliases coexist: legacy `expo-token` (used by mobile app) +
  //    curl/Sub-C T9 alias `expo-push-token` (G10/G11 gate URLs).
  // -------------------------------------------------------------------------
  @Post('expo-token')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Register or unregister an Expo push token (legacy route)' })
  @ApiResponse({ status: 200, description: '{ success: true, tokens: string[] }' })
  async handleExpoToken(@Req() req: any, @Body() body: ExpoTokenDto) {
    return this._expoTokenImpl(req, body);
  }

  @Post('expo-push-token')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Register or unregister an Expo push token — Sub-C T9 curl alias route' })
  @ApiResponse({ status: 200, description: '{ success: true, tokens: string[] }' })
  async handleExpoPushToken(@Req() req: any, @Body() body: ExpoTokenDto) {
    return this._expoTokenImpl(req, body);
  }

  private async _expoTokenImpl(req: any, body: ExpoTokenDto) {
    const userId = actorId(req);
    if (!userId) throw new ForbiddenException('FORBIDDEN');
    if (body.action !== 'register' && body.action !== 'unregister') {
      throw new BadRequestException('action must be "register" or "unregister"');
    }

    let settings = await this.prisma.userSettings.findFirst({
      where: { userId },
      select: { id: true, notificationPrefs: { select: { id: true, expoPushTokens: true } } },
    });
    if (!settings) {
      settings = await this.prisma.userSettings.create({
        data: { userId },
        select: { id: true, notificationPrefs: { select: { id: true, expoPushTokens: true } } },
      });
    }

    const token = body.token.trim();
    let tokens: string[] = settings.notificationPrefs?.expoPushTokens ?? [];

    if (body.action === 'register') {
      tokens = [...new Set([...tokens, token])]; // dedup
    } else {
      tokens = tokens.filter(t => t !== token);
    }

    let prefs;
    if (!settings.notificationPrefs?.id) {
      prefs = await this.prisma.notificationPreferences.create({
        data: { userSettingsId: settings.id, expoPushTokens: tokens },
        select: { expoPushTokens: true },
      });
    } else {
      prefs = await this.prisma.notificationPreferences.update({
        where: { id: settings.notificationPrefs.id },
        data: { expoPushTokens: tokens },
        select: { expoPushTokens: true },
      });
    }

    return { success: true, tokens: prefs.expoPushTokens };
  }

  // -------------------------------------------------------------------------
  // 9. Webhook inbound (ApiKeyGuard) — write Notification + upsert group + SSE push
  // -------------------------------------------------------------------------
  @Post('webhook-inbound')
  @UseGuards(ApiKeyGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Inbound activity webhook (guarded by X-Vell-Webhook-Key header or ?key= query)' })
  @ApiResponse({ status: 202, description: 'Activity accepted' })
  @Throttle({ default: { limit: 500, ttl: 60_000 } })
  async webhookInbound(@Body() body: WebhookInboundDto) {
    const validKinds = Object.values(NotificationKind) as string[];
    if (!validKinds.includes(body.kind)) {
      throw new BadRequestException(`Invalid kind. Accepted: ${validKinds.join(', ')}`);
    }

    // 1. Create the Notification row (triggers notification.created event via DB write;
    //    aggregator listener will call upsertGroup asynchronously too)
    const notification = await this.prisma.notification.create({
      data: {
        userId: body.userId,
        actorId: body.actorId ?? null,
        kind: body.kind as any,
        articleSlug: body.articleSlug ?? null,
        highlightId: body.highlightId ?? null,
        commentId: body.commentId ?? null,
        body: body.previewText ?? null,
      },
    });

    // 2. Synchronously upsert the activity group so callers get immediate SSE push
    await this.aggregator.upsertGroup({
      notificationId: notification.id,
      userId: body.userId,
      actorId: body.actorId ?? null,
      kind: notification.kind,
      articleSlug: body.articleSlug ?? null,
      highlightId: body.highlightId ?? null,
      commentId: body.commentId ?? null,
      previewText: body.previewText ?? null,
      linkHref: body.linkHref ?? null,
    });

    // 3. Emit SSE events for any connected stream clients
    this.events.emit('sse.activity.created.' + body.userId, { userId: body.userId, kind: body.kind, id: notification.id });
    const unreadAfter = await this.aggregator.countUnread(body.userId);
    this.events.emit('sse.activity.unread.' + body.userId, { userId: body.userId, unread: unreadAfter });

    return { accepted: true, notificationId: notification.id };
  }
}
