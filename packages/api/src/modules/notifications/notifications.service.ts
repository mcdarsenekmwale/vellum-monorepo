import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { NotificationKind } from '@prisma/client';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

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

  async createNotification(data: {
    userId: string;
    actorId?: string;
    kind: NotificationKind;
    articleSlug?: string;
    highlightId?: string;
    commentId?: string;
    body?: string;
  }) {
    return this.prisma.notification.create({ data });
  }

  async deleteNotification(userId: string, notificationId: string) {
    return this.prisma.notification.delete({ where: { id: notificationId, userId } });
  }
}