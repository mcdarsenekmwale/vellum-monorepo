import { Controller, Get, Put, Delete, Query, Param, UseGuards, Request, Body, Logger, BadRequestException, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../../shared/prisma/prisma.service';

const HH_MM_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

@ApiTags('Notifications')
@Controller('api/notifications')
export class NotificationsController {
  private readonly logger = new Logger(NotificationsController.name);
  constructor(
    private notificationsService: NotificationsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get user notifications' })
  @ApiResponse({ status: 200, description: 'Notifications retrieved' })
  async getNotifications(@Request() req: any, @Query('page') page?: number, @Query('limit') limit?: number) {
    return this.notificationsService.getNotifications(req.user.id, page, limit);
  }

  @Get('unread-count')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get unread notification count' })
  @ApiResponse({ status: 200, description: 'Unread count retrieved' })
  async getUnreadCount(@Request() req: any) {
    return this.notificationsService.getUnreadCount(req.user.id);
  }

  @Put('read')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Mark notifications as read' })
  @ApiResponse({ status: 200, description: 'Notifications marked as read' })
  async markAsRead(@Request() req: any, @Query('notificationId') notificationId?: string) {
    return this.notificationsService.markAsRead(req.user.id, notificationId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Delete a notification' })
  @ApiResponse({ status: 200, description: 'Notification deleted' })
  async deleteNotification(@Request() req: any, @Param('id') id: string) {
    return this.notificationsService.deleteNotification(req.user.id, id);
  }

  // -------------------------------------------------------------------------
  // Sub-project B backward compat route (G16 regression gate)
  // GET + PUT /api/notifications/preferences — proxies to the same shape as
  // ActivityController.preferences so existing B Sub-project clients keep
  // working after the Activity module superseded notifications preferences.
  // -------------------------------------------------------------------------
  @Get('preferences')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[B-backward-compat] Get activity/notification preferences — same shape as /api/activity/preferences' })
  @ApiResponse({ status: 200, description: 'Preferences object with groupLikes/groupComments/groupFollows + quiet hours' })
  async getPreferencesBCompat(@Request() req: any) {
    const userId = req?.user?.sub ?? req?.user?.id;
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

  @Put('preferences')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '[B-backward-compat] Update activity/notification preferences' })
  @ApiResponse({ status: 200, description: 'Updated preferences persisted' })
  async updatePreferencesBCompat(@Request() req: any, @Body() body: any) {
    const userId = req?.user?.sub ?? req?.user?.id;
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
}