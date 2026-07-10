import { Controller, Get, Put, Delete, Query, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Notifications')
@Controller('api/notifications')
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

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
}