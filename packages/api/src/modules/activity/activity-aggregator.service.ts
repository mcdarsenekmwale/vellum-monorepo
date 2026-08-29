import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { NotificationKind } from '@prisma/client';

export interface NotificationCreatedPayload {
  notificationId: string;
  userId: string;
  actorId?: string | null;
  kind: NotificationKind;
  articleSlug?: string | null;
  highlightId?: string | null;
  commentId?: string | null;
  previewText?: string | null;
  linkHref?: string | null;
}

@Injectable()
export class ActivityAggregatorService implements OnModuleInit {
  private readonly logger = new Logger(ActivityAggregatorService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  onModuleInit() {
    this.logger.log('Activity aggregator ready.');
  }

  buildGroupingKey(kind: NotificationKind, row: Pick<NotificationCreatedPayload,'articleSlug'|'highlightId'|'commentId'>): string {
    switch (kind) {
      case NotificationKind.LIKE:
      case NotificationKind.BOOKMARK:
      case NotificationKind.SHARE:
        if (row.articleSlug) return `${kind}:article:${row.articleSlug}`;
        if (row.highlightId) return `${kind}:highlight:${row.highlightId}`;
        if (row.commentId) return `${kind}:comment:${row.commentId}`;
        return `${kind}:${row.articleSlug || row.highlightId || row.commentId || 'misc'}`;
      case NotificationKind.COMMENT:
      case NotificationKind.REPLY:
      case NotificationKind.MENTION:
        return row.commentId
          ? `${kind}:comment-thread:${row.commentId}`
          : (row.articleSlug ? `${kind}:article:${row.articleSlug}` : `${kind}:unknown:${Date.now()}`);
      case NotificationKind.FOLLOW:
        return `${kind}:actor:${row.articleSlug || 'batch'}-${Date.now()}`;
      case NotificationKind.SYSTEM:
      default:
        return `${kind}:${Date.now()}`;
    }
  }

  @OnEvent('notification.created', { async: true, promisify: true })
  async handleNotificationCreated(payload: NotificationCreatedPayload) {
    try {
      await this.upsertGroup(payload);
    } catch (err: any) {
      this.logger.warn(`Aggregator upsert failed: ${err?.message}`);
    }
  }

  async upsertGroup(payload: NotificationCreatedPayload) {
    const { userId, actorId, kind, articleSlug = null, highlightId = null, commentId = null, previewText = null, linkHref = null } = payload;
    if (!userId) return;

    let groupBySameTarget = true;
    try {
      const prefs = await this.prisma.notificationPreferences.findFirst({
        where: { userSettings: { userId } },
        select: { groupLikes: true, groupComments: true, groupFollows: true },
      });
      if (kind === NotificationKind.LIKE) groupBySameTarget = prefs?.groupLikes ?? true;
      else if (kind === NotificationKind.COMMENT || kind === NotificationKind.REPLY || kind === NotificationKind.MENTION) groupBySameTarget = prefs?.groupComments ?? true;
      else if (kind === NotificationKind.FOLLOW) groupBySameTarget = prefs?.groupFollows ?? true;
    } catch {}

    let groupingKey = this.buildGroupingKey(kind, { articleSlug, highlightId, commentId });
    if (!groupBySameTarget) groupingKey += `:${payload.notificationId}`;

    let actorHandle = actorId ? (await this.prisma.user.findUnique({ where: { id: actorId }, select: { handle: true, name: true } })) : null;
    const who = actorHandle ? (actorHandle.handle || actorHandle.name || 'Someone') : 'Someone';
    const builtPreview = previewText || this.buildDefaultPreview(kind, who, { articleSlug, highlightId, commentId });

    const MAX_ACTORIDS = 50;
    const finalActorIds = actorId ? [actorId] : [];

    await this.prisma.$executeRawUnsafe(`
      INSERT INTO "ActivityItem"
        (id, "userId", kind, "groupingKey", "actorIds", count, "previewText",
         "articleSlug", "highlightId", "commentId", "linkHref",
         dismissedAt, read, "readAt", "latestActivityAt", "createdAt", "updatedAt")
      VALUES (
        gen_random_uuid(),
        $1::uuid, $2::"NotificationKind", $3::text,
        $4::uuid[], 1, $5::text,
        $6::text, $7::uuid, $8::uuid, $9::text,
        NULL::timestamptz, false, NULL::timestamptz, NOW(), NOW(), NOW()
      )
      ON CONFLICT ("userId", "groupingKey") DO UPDATE SET
        "actorIds" = CASE
          WHEN array_length("ActivityItem"."actorIds", 1) >= ${MAX_ACTORIDS}
            THEN "ActivityItem"."actorIds"
          ELSE array_cat("ActivityItem"."actorIds", $4::uuid[])
            FILTER (WHERE NOT ($4::uuid[] && "ActivityItem"."actorIds"))
          END,
        count = "ActivityItem".count + 1,
        "latestActivityAt" = NOW(),
        "previewText" = $5::text,
        "read" = CASE WHEN "ActivityItem".read = true THEN false ELSE "ActivityItem".read END,
        "readAt" = NULL,
        "updatedAt" = NOW()
      RETURNING id;
    `,
      userId,
      kind as any,
      groupingKey,
      finalActorIds,
      builtPreview,
      articleSlug,
      highlightId,
      commentId,
      linkHref || null,
    );

    // Emit SSE push
    try {
      this.events.emit('sse.activity.created.' + userId, { userId, kind, id: groupingKey });
      const unread = await this.countUnread(userId);
      this.events.emit('sse.activity.unread.' + userId, { userId, unread });
    } catch (_) { /* non-fatal */ }
  }

  buildDefaultPreview(kind: NotificationKind, who: string, target: { articleSlug?: string|null; highlightId?: string|null; commentId?: string|null }): string {
    switch (kind) {
      case NotificationKind.LIKE:       return `${who} liked your ${target.articleSlug ? 'post' : target.highlightId ? 'highlight' : 'content'}.`;
      case NotificationKind.COMMENT:    return `${who} commented on your ${target.articleSlug ? 'post' : 'highlight'}.`;
      case NotificationKind.REPLY:      return `${who} replied to your comment.`;
      case NotificationKind.FOLLOW:     return `${who} followed you.`;
      case NotificationKind.MENTION:    return `${who} mentioned you in a ${target.commentId ? 'comment' : 'post'}.`;
      case NotificationKind.BOOKMARK:   return `${who} bookmarked your ${target.articleSlug ? 'post' : target.highlightId ? 'highlight' : 'content'}.`;
      case NotificationKind.SHARE:      return `${who} shared your ${target.articleSlug ? 'post' : 'highlight'}.`;
      case NotificationKind.SYSTEM:
      default:                          return `${who}: system activity.`;
    }
  }

  @Cron(CronExpression.EVERY_5_MINUTES, { name: 'activity-aggregator-sweep' })
  async cronAggregatorSweep() {
    if (process.env.ACTIVITY_CRON_ENABLED === 'false') return;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const notifs = await this.prisma.notification.findMany({
      where: { createdAt: { gte: since } },
      select: { id: true, userId: true, actorId: true, kind: true, articleSlug: true, highlightId: true, commentId: true },
      take: 10_000,
      orderBy: { createdAt: 'asc' },
    });
    let done = 0; let skipped = 0;
    for (const n of notifs) {
      try {
        await this.upsertGroup({
          notificationId: n.id, userId: n.userId, actorId: n.actorId, kind: n.kind as any,
          articleSlug: n.articleSlug, highlightId: n.highlightId, commentId: n.commentId,
        });
        done++;
      } catch { skipped++; }
    }
    this.logger.debug(`Cron aggregator sweep: processed ${done} notifications (skipped ${skipped}).`);
  }

  async countUnread(userId: string): Promise<number> {
    return this.prisma.activityItem.count({ where: { userId, read: false, dismissedAt: null } });
  }

  async markRead(userId: string, opts: { ids?: string[]; all?: boolean }) {
    if (opts.all) {
      await this.prisma.activityItem.updateMany({
        where: { userId, read: false },
        data: { read: true, readAt: new Date() },
      });
    } else if (opts.ids?.length) {
      await this.prisma.activityItem.updateMany({
        where: { userId, id: { in: opts.ids }, read: false },
        data: { read: true, readAt: new Date() },
      });
    }
    return this.countUnread(userId);
  }
}
