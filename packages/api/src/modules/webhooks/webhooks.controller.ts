import { Controller, Post, Get, Delete, Param, Body, Query, UseGuards, Request, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { WebhooksService } from './webhooks.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Webhooks')
@Controller('api/webhooks')
export class WebhooksController {
  constructor(private webhooksService: WebhooksService) {}

  @Post('content')
  @ApiOperation({ summary: 'Handle content webhook (authenticated via x-api-key header)' })
  @ApiResponse({ status: 200, description: 'Webhook processed' })
  @ApiResponse({ status: 401, description: 'Missing or invalid x-api-key' })
  async handleContentWebhook(@Body() body: any, @Headers('x-api-key') apiKey: string) {
    return this.webhooksService.handleContentWebhook(body, apiKey);
  }

  @Get('logs')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get webhook logs (admin only)' })
  @ApiResponse({ status: 200, description: 'Logs retrieved' })
  @ApiResponse({ status: 403, description: 'Admin role required' })
  async listWebhookLogs(@Query('event') event?: string, @Query('limit') limit?: number) {
    return this.webhooksService.listWebhookLogs(event, limit);
  }

  @Post('api-keys')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create API key (admin only)' })
  @ApiResponse({ status: 201, description: 'API key created' })
  @ApiResponse({ status: 403, description: 'Admin role required' })
  async createApiKey(@Request() req: any, @Body() body: { name: string; scopes: string[] }) {
    return this.webhooksService.createApiKey(req.user.id, body.name, body.scopes);
  }

  @Get('api-keys')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'List API keys (admin only)' })
  @ApiResponse({ status: 200, description: 'API keys retrieved' })
  @ApiResponse({ status: 403, description: 'Admin role required' })
  async listApiKeys(@Request() req: any) {
    return this.webhooksService.listApiKeys(req.user.id);
  }

  @Delete('api-keys/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Revoke API key (admin only)' })
  @ApiResponse({ status: 200, description: 'API key revoked' })
  @ApiResponse({ status: 403, description: 'Admin role required' })
  async revokeApiKey(@Request() req: any, @Param('id') id: string) {
    return this.webhooksService.revokeApiKey(req.user.id, id);
  }
}