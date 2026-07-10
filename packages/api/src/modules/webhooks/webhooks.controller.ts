import { Controller, Post, Get, Delete, Param, Body, Query, UseGuards, Request, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { WebhooksService } from './webhooks.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Webhooks')
@Controller('api/webhooks')
export class WebhooksController {
  constructor(private webhooksService: WebhooksService) {}

  @Post('content')
  @ApiOperation({ summary: 'Handle content webhook' })
  @ApiResponse({ status: 200, description: 'Webhook processed' })
  async handleContentWebhook(@Body() body: any, @Headers('x-api-key') apiKey: string) {
    return this.webhooksService.handleContentWebhook(body, apiKey);
  }

  @Get('logs')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get webhook logs' })
  @ApiResponse({ status: 200, description: 'Logs retrieved' })
  async listWebhookLogs(@Query('event') event?: string, @Query('limit') limit?: number) {
    return this.webhooksService.listWebhookLogs(event, limit);
  }

  @Post('api-keys')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create API key' })
  @ApiResponse({ status: 201, description: 'API key created' })
  async createApiKey(@Request() req: any, @Body() body: { name: string; scopes: string[] }) {
    return this.webhooksService.createApiKey(req.user.id, body.name, body.scopes);
  }

  @Get('api-keys')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List API keys' })
  @ApiResponse({ status: 200, description: 'API keys retrieved' })
  async listApiKeys(@Request() req: any) {
    return this.webhooksService.listApiKeys(req.user.id);
  }

  @Delete('api-keys/:id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Revoke API key' })
  @ApiResponse({ status: 200, description: 'API key revoked' })
  async revokeApiKey(@Request() req: any, @Param('id') id: string) {
    return this.webhooksService.revokeApiKey(req.user.id, id);
  }
}