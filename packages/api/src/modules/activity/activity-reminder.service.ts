import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class ActivityReminderService {
  private readonly logger = new Logger(ActivityReminderService.name);
  constructor(private readonly prisma: PrismaService) {}

  @Cron(process.env.ACTIVITY_REMINDER_CRON || '0 */15 * * * *', { name: 'activity-reminder-nudge' })
  async runNudge() {
    if (process.env.ACTIVITY_CRON_ENABLED === 'false') return;
    const t0 = Date.now();

    const eligible = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT DISTINCT u.id AS "userId",
        (np."activityReminderEveryMinutes")::int AS cadence_min,
        np."quietHoursStart", np."quietHoursEnd", np."lastActivityNudgeAt",
        (SELECT COUNT(*) FROM "ActivityItem" ai WHERE ai."userId" = u.id AND ai.read = false AND ai."dismissedAt" IS NULL) AS unread
      FROM "User" u
      JOIN "UserSettings" us ON us."userId" = u.id
      JOIN "NotificationPreferences" np ON np."userSettingsId" = us.id
      WHERE np."activityReminderEveryMinutes" > 0
        AND (
          np."lastActivityNudgeAt" IS NULL
          OR EXTRACT(EPOCH FROM (NOW() - np."lastActivityNudgeAt")) / 60 >= np."activityReminderEveryMinutes"
        )
    `);

    let nudged = 0; let skipped = 0;
    for (const row of eligible) {
      const cadenceMin = Number(row.cadence_min) || 0;
      const unread = Number(row.unread) || 0;
      if (unread < 3) { skipped++; continue; }

      if (row.quietHoursStart && row.quietHoursEnd) {
        const nowHM = new Date().toTimeString().slice(0,5);
        if (row.quietHoursStart < row.quietHoursEnd) {
          if (nowHM >= row.quietHoursStart && nowHM <= row.quietHoursEnd) { skipped++; continue; }
        } else {
          if (nowHM <= row.quietHoursEnd || nowHM >= row.quietHoursStart) { skipped++; continue; }
        }
      }

      try {
        const text = `You have ${unread} unread notifications — catch up on likes, comments and follows.`;
        await this.prisma.activityItem.create({
          data: {
            userId: row.userId,
            kind: 'SYSTEM' as any,
            groupingKey: `SYSTEM:nudge:${Date.now()}`,
            actorIds: [],
            count: 1,
            previewText: text,
            linkHref: '/notifications',
            read: false,
            latestActivityAt: new Date(),
          },
        });
        await this.prisma.notificationPreferences.updateMany({
          where: { userSettings: { userId: row.userId } },
          data: { lastActivityNudgeAt: new Date() },
        });
        nudged++;
      } catch (e: any) {
        this.logger.warn(`Nudge write fail user=${row.userId}: ${e?.message}`);
      }
    }

    this.logger.log(`Reminder sweep complete: nudged=${nudged} skipped=${skipped} in ${Date.now()-t0}ms`);
  }
}
