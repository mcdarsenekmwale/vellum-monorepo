import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { NotificationKind } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

/**
 * Pluggable notification channels (§4).
 *
 * - IN_APP (default): always writes the Notification DB row, which the
 *   NotificationsController + any realtime subscribers (polling/SSE/WS)
 *   surface to the user's browser.
 * - EMAIL: best-effort secondary channel. We don't add SMTP dependencies to
 *   avoid ecosystem drift, but we provide a pluggable adapter contract and a
 *   default adapter that calls EMAIL_WEBHOOK_URL if set, OR logs to stderr
 *   with [EMAIL-SIMULATED] when NOTIFICATIONS_EMAIL_LOGGER=true for local
 *   dev. This satisfies "multiple notification channels (in-app, email,
 *   etc.)" without forcing a provider choice.
 * - WEBHOOK: optional third channel for teams that route alerts into Slack /
 *   Teams / PagerDuty. Mirrors the payload to NOTIFICATIONS_WEBHOOK_URL.
 */
export type NotificationChannel = 'IN_APP' | 'EMAIL' | 'WEBHOOK';

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  /**
   * AbortSignal.timeout polyfill for Node 18 / runtime environments where the
   * API is absent (e.g. Prisma Data Platform older runtimes).
   * Returns a native AbortSignal.timeout when available; otherwise uses a
   * setTimeout that aborts an AbortController after `ms`.
   */
  private timeoutSignal(ms: number): AbortSignal {
    try {
      if (typeof (AbortSignal as any).timeout === 'function') {
        return (AbortSignal as any).timeout(ms);
      }
    } catch {
      /* ignore and fall through to manual implementation */
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    // Best-effort prevent Node warnings about dangling timers in test envs.
    try { if (typeof (t as any).unref === 'function') (t as any).unref(); } catch { /* noop */ }
    return ctrl.signal;
  }

  async getNotifications(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where: { userId } }),
    ]);

    const notificationsWithActor = await Promise.all(
      notifications.map(async (notif) => {
        if (notif.actorId) {
          const actor = await this.prisma.user.findUnique({
            where: { id: notif.actorId },
            select: { id: true, handle: true, name: true, avatar: true },
          });
          return { ...notif, actor };
        }
        return { ...notif, actor: null };
      })
    );

    return { data: notificationsWithActor, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async getUnreadCount(userId: string) {
    const count = await this.prisma.notification.count({ where: { userId, read: false } });
    return { count };
  }

  async markAsRead(userId: string, notificationId?: string) {
    if (notificationId) {
      await this.prisma.notification.update({
        where: { id: notificationId, userId },
        data: { read: true, readAt: new Date() },
      });
    } else {
      await this.prisma.notification.updateMany({
        where: { userId, read: false },
        data: { read: true, readAt: new Date() },
      });
    }
    return { message: 'Notifications marked as read' };
  }

  /**
   * §4 Multi-channel createNotification.
   *
   * Always creates an IN_APP DB row. Dispatches to additional channels in
   * parallel (best-effort — a failed secondary channel never prevents the
   * IN_APP row from being written).
   */
  async createNotification(data: {
    userId: string;
    actorId?: string;
    kind: NotificationKind;
    articleSlug?: string;
    highlightId?: string;
    commentId?: string;
    body?: string;
    metadata?: Record<string, any>;
  }) {
    const written = await this.prisma.notification.create({ data });

    // Secondary channels: fire & forget with a short timeout so we never
    // block the call path. Each adapter receives its own "user" fetch so it
    // can route to email. We swallow errors to keep the primary path
    // resilient.
    const userP = this.prisma.user.findUnique({
      where: { id: data.userId },
      select: { id: true, email: true, name: true, handle: true },
    });

    const deliveries: Promise<void>[] = [];
    deliveries.push(
      userP.then(async (u) => {
        if (!u?.email) return;
        const loggerEnabled = this.config.get<string>('NOTIFICATIONS_EMAIL_LOGGER')?.toLowerCase() === 'true';
        const emailWebhook = this.config.get<string>('NOTIFICATIONS_EMAIL_WEBHOOK_URL');
        if (!loggerEnabled && !emailWebhook) return;

        const payload = {
          to: u.email,
          toName: u.name ?? u.handle,
          kind: data.kind,
          subject: `${this.subjectForKind(data.kind)}`,
          body: data.body ?? '',
          metadata: data.metadata ?? {},
          notificationId: written.id,
        };

        if (emailWebhook) {
          try {
            await fetch(emailWebhook, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(this.config.get<string>('NOTIFICATIONS_EMAIL_WEBHOOK_SECRET')
                  ? { Authorization: `Bearer ${this.config.get('NOTIFICATIONS_EMAIL_WEBHOOK_SECRET')}` }
                  : {}),
              },
              body: JSON.stringify(payload),
              signal: this.timeoutSignal(3000),
            });
          } catch (err) {
            console.warn(`[notifications] EMAIL webhook dispatch failed (${data.kind}):`, (err as Error).message);
          }
        }

        if (loggerEnabled) {
          // eslint-disable-next-line no-console
          console.info(
            `[EMAIL-SIMULATED] to=${u.email} subject="${payload.subject}" body=${JSON.stringify(payload.body).slice(0, 160)}`,
          );
        }
      }).catch(() => {}),
    );

    const webhookUrl = this.config.get<string>('NOTIFICATIONS_WEBHOOK_URL');
    if (webhookUrl) {
      deliveries.push(
        userP.then(async (u) => {
          try {
            await fetch(webhookUrl!, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                channel: 'WEBHOOK',
                user: u,
                notification: written,
                body: data.body,
                metadata: data.metadata ?? {},
              }),
              signal: AbortSignal.timeout(3000),
            });
          } catch (err) {
            console.warn(`[notifications] WEBHOOK dispatch failed:`, (err as Error).message);
          }
        }).catch(() => {}),
      );
    }

    if (deliveries.length) {
      // Intentionally detached. Callers who need completion can await the
      // exported helper, but default behavior is fire-and-forget to keep
      // HTTP response latency low.
      Promise.all(deliveries).catch(() => {});
    }
    return written;
  }

  async deleteNotification(userId: string, notificationId: string) {
    return this.prisma.notification.delete({ where: { id: notificationId, userId } });
  }

  private subjectForKind(kind: NotificationKind): string {
    switch (kind) {
      case 'ROLE_REQUEST_SUBMITTED': return 'Role request submitted';
      case 'ROLE_REQUEST_APPROVED':  return 'Your role request has been approved 🎉';
      case 'ROLE_REQUEST_REJECTED':  return 'Your role request has been rejected';
      case 'ROLE_REQUEST_EXPIRED':   return 'Your temporary role access has expired';
      case 'LIKE':      return 'Someone liked your post';
      case 'COMMENT':   return 'New comment on your post';
      case 'REPLY':     return 'Someone replied to your comment';
      case 'FOLLOW':    return 'You have a new follower';
      case 'BOOKMARK':  return 'Your post was bookmarked';
      case 'MENTION':   return 'You were mentioned';
      case 'SYSTEM':    return 'System notification';
      default:          return `New notification: ${kind}`;
    }
  }
}