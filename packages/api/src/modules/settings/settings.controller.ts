import {
  Controller,
  Get,
  Patch,
  Put,
  Post,
  Body,
  UseGuards,
  Req,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  UpdatePrivacyDto,
  UpdateNotificationPreferencesDto,
} from './dto/settings.dto';

@ApiTags('Settings (v1)')
@Controller('api/v1')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user with privacy and notification prefs' })
  @ApiResponse({ status: 200, description: 'Current user' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMe(@Req() req: { user: { id: string } }) {
    return this.settingsService.getCurrentUser(req.user.id);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Partially update privacy fields for current user' })
  @ApiResponse({ status: 200, description: 'Updated user' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async patchMe(
    @Req() req: { user: { id: string } },
    @Body() dto: UpdatePrivacyDto,
  ) {
    return this.settingsService.patchPrivacy(req.user.id, dto);
  }

  @Get('me/notifications/preferences')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get fine-grained notification preferences' })
  @ApiResponse({ status: 200, description: 'Notification preferences' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getNotificationPreferences(@Req() req: { user: { id: string } }) {
    return this.settingsService.getNotificationPreferences(req.user.id);
  }

  @Put('me/notifications/preferences')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Full replace notification preferences' })
  @ApiResponse({ status: 200, description: 'Updated preferences' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async putNotificationPreferences(
    @Req() req: { user: { id: string } },
    @Body() dto: UpdateNotificationPreferencesDto,
  ) {
    return this.settingsService.putNotificationPreferences(req.user.id, dto);
  }

  @Get('me/subscription')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get subscription info' })
  @ApiResponse({ status: 200, description: 'Subscription info' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getSubscription(@Req() req: { user: { id: string } }) {
    return this.settingsService.getSubscription(req.user.id);
  }

  @Post('me/subscription/restore')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(200)
  @ApiOperation({ summary: 'Restore subscription (no-op mock success)' })
  @ApiResponse({ status: 200, description: 'Restored subscription info' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async restoreSubscription(@Req() req: { user: { id: string } }) {
    return this.settingsService.restoreSubscription(req.user.id);
  }
}
