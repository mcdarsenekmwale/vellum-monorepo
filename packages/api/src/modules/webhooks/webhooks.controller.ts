import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  Headers,
  Ip,
  RawBodyRequest,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { WebhooksService } from './webhooks.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import {
  CreateWebhookDto,
  UpdateWebhookDto,
  ListWebhooksQueryDto,
  TestWebhookDto,
  TriggerWebhookDto,
  ListWebhookLogsQueryDto,
  CreateFromTemplateDto,
} from './dto/webhooks.dto';

@ApiTags('Webhooks')
@Controller()
export class WebhooksController {
  constructor(private webhooksService: WebhooksService) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC: Incoming webhook endpoint
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('api/incoming-webhooks/:id')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary:
      'Public endpoint for incoming webhooks. Validates signature / IP allowlist and processes payload.',
  })
  @ApiResponse({ status: 202, description: 'Payload accepted' })
  @ApiResponse({ status: 401, description: 'Signature validation failed' })
  @ApiResponse({ status: 403, description: 'IP not in allowlist' })
  @ApiResponse({ status: 404, description: 'Webhook not found' })
  @ApiResponse({ status: 429, description: 'Rate limited' })
  async handleIncomingWebhook(
    @Param('id') id: string,
    @Body() body: any,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Request() req: RawBodyRequest<Express.Request>,
    @Ip() clientIp: string,
  ) {
    const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(body ?? {}));
    const result = await this.webhooksService.handleIncomingWebhook(
      id,
      rawBody,
      body,
      headers,
      clientIp,
    );
    if (!result.accepted) {
      if (result.error?.includes('Rate limited')) {
        throw new BadRequestException({ code: 'RATE_LIMITED', message: result.error });
      }
      if (result.error?.includes('allowlist') || result.error?.includes('IP')) {
        throw new BadRequestException({ code: 'IP_BLOCKED', message: result.error });
      }
      if (result.error?.includes('signature')) {
        throw new BadRequestException({ code: 'INVALID_SIGNATURE', message: result.error });
      }
    }
    return result;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LEGACY: Content webhook (x-api-key authenticated)
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('api/webhooks/content')
  @ApiOperation({ summary: 'Handle content webhook (authenticated via x-api-key header)' })
  @ApiResponse({ status: 200, description: 'Webhook processed' })
  @ApiResponse({ status: 401, description: 'Missing or invalid x-api-key' })
  async handleContentWebhook(@Body() body: any, @Headers('x-api-key') apiKey: string) {
    return this.webhooksService.handleContentWebhook(body, apiKey);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ADMIN / Authenticated: Webhook Management
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('api/webhooks')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'List webhooks (owner or admin)' })
  @ApiResponse({ status: 200, description: 'Paginated webhook list' })
  @ApiQuery({ name: 'type', required: false, enum: ['INCOMING', 'OUTGOING'] })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  async listWebhooks(@Request() req: any, @Query() query: ListWebhooksQueryDto) {
    return this.webhooksService.findAll(req.user.id, req.user.role, query);
  }

  @Post('api/webhooks')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Create a new webhook' })
  @ApiResponse({ status: 201, description: 'Webhook created (secret revealed once)' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async createWebhook(@Request() req: any, @Body() dto: CreateWebhookDto) {
    return this.webhooksService.create(req.user.id, dto);
  }

  @Get('api/webhooks/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Get a webhook by ID' })
  @ApiResponse({ status: 200, description: 'Webhook detail' })
  @ApiResponse({ status: 403, description: 'Not owner or admin' })
  @ApiResponse({ status: 404, description: 'Webhook not found' })
  async getWebhook(@Request() req: any, @Param('id') id: string) {
    return this.webhooksService.findOne(req.user.id, req.user.role, id);
  }

  @Put('api/webhooks/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Update a webhook' })
  @ApiResponse({ status: 200, description: 'Webhook updated' })
  @ApiResponse({ status: 403, description: 'Not owner or admin' })
  @ApiResponse({ status: 404, description: 'Webhook not found' })
  async updateWebhook(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateWebhookDto,
  ) {
    return this.webhooksService.update(req.user.id, req.user.role, id, dto);
  }

  @Delete('api/webhooks/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Delete a webhook (and its logs)' })
  @ApiResponse({ status: 200, description: 'Deleted' })
  @ApiResponse({ status: 403, description: 'Not owner or admin' })
  @ApiResponse({ status: 404, description: 'Webhook not found' })
  async deleteWebhook(@Request() req: any, @Param('id') id: string) {
    return this.webhooksService.remove(req.user.id, req.user.role, id);
  }

  @Patch('api/webhooks/:id/toggle')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Toggle webhook active/inactive' })
  @ApiResponse({ status: 200, description: 'Toggled' })
  @ApiResponse({ status: 403, description: 'Not owner or admin' })
  @ApiResponse({ status: 404, description: 'Webhook not found' })
  async toggleWebhook(@Request() req: any, @Param('id') id: string) {
    return this.webhooksService.toggle(req.user.id, req.user.role, id);
  }

  @Post('api/webhooks/:id/regenerate-secret')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Rotate webhook secret (revealed once)' })
  @ApiResponse({ status: 200, description: 'New secret' })
  async regenerateSecret(@Request() req: any, @Param('id') id: string) {
    return this.webhooksService.regenerateSecret(req.user.id, req.user.role, id);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Testing + Triggering
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('api/webhooks/:id/test')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({
    summary:
      'Send a test payload through the outgoing webhook (use event presets or custom payload).',
  })
  @ApiResponse({ status: 200, description: 'Test result' })
  async testWebhook(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: TestWebhookDto,
  ) {
    return this.webhooksService.testOutgoing(req.user.id, req.user.role, id, dto);
  }

  @Post('api/webhooks/trigger')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary:
      'Trigger an event, dispatching to all matching ACTIVE outgoing webhooks (admin only).',
  })
  @ApiResponse({ status: 200, description: 'Dispatch results' })
  @ApiResponse({ status: 403, description: 'Admin role required' })
  async triggerEvent(@Request() req: any, @Body() dto: TriggerWebhookDto) {
    return this.webhooksService.triggerByEvent(req.user.id, req.user.role, dto);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Logs
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('api/webhooks/:id/logs')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Fetch execution logs for a webhook' })
  @ApiResponse({ status: 200, description: 'Logs with pagination' })
  async listWebhookLogs(
    @Request() req: any,
    @Param('id') id: string,
    @Query() query: ListWebhookLogsQueryDto,
  ) {
    return this.webhooksService.listLogs(req.user.id, req.user.role, id, query);
  }

  @Delete('api/webhooks/:id/logs')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Clear all execution logs for a webhook' })
  @ApiResponse({ status: 200, description: 'Logs deleted' })
  async clearWebhookLogs(@Request() req: any, @Param('id') id: string) {
    return this.webhooksService.clearLogs(req.user.id, req.user.role, id);
  }

  // Backward-compatible: admin global logs endpoint
  @Get('api/webhooks/logs/global')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get recent webhook logs across all webhooks (admin only)' })
  async listAllWebhookLogs(@Query('limit') limit?: number, @Query('event') event?: string) {
    // Reuse the listLogs path with a synthetic flow by passing query directly
    // via general stats / logs endpoint. For simplicity use findMany with no webhookId.
    return this.webhooksService.listLogs('system', 'SUPER_ADMIN', 'ALL' as any, {
      event,
      limit: limit ?? 100,
    } as ListWebhookLogsQueryDto).then(r => r.items);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Stats
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('api/webhooks/stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Aggregate webhook usage stats' })
  @ApiResponse({ status: 200, description: 'Usage statistics' })
  async getOverallStats(@Request() req: any) {
    return this.webhooksService.getStats(req.user.id, req.user.role);
  }

  @Get('api/webhooks/:id/stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Per-webhook statistics' })
  @ApiResponse({ status: 200, description: 'Webhook statistics' })
  async getWebhookStats(@Request() req: any, @Param('id') id: string) {
    return this.webhooksService.getStats(req.user.id, req.user.role, id);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Templates
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('api/webhooks/templates')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'List webhook templates (Teams, Slack, general)' })
  @ApiQuery({ name: 'category', required: false, example: 'teams' })
  async listTemplates(@Query('category') category?: string) {
    return this.webhooksService.listTemplates(category);
  }

  @Post('api/webhooks/templates/:templateId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Create a webhook from a built-in template' })
  @ApiResponse({ status: 201, description: 'Webhook created from template' })
  async createFromTemplate(
    @Request() req: any,
    @Param('templateId') templateId: string,
    @Body() dto: CreateFromTemplateDto,
  ) {
    return this.webhooksService.createFromTemplate(req.user.id, templateId, dto);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // API Keys (legacy endpoints)
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('api/webhooks/api-keys')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create API key (admin only)' })
  @ApiResponse({ status: 201, description: 'API key created' })
  async createApiKey(@Request() req: any, @Body() body: { name: string; scopes: string[] }) {
    return this.webhooksService.createApiKey(req.user.id, body.name, body.scopes);
  }

  @Get('api/webhooks/api-keys')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'List API keys (admin only)' })
  async listApiKeys(@Request() req: any) {
    return this.webhooksService.listApiKeys(req.user.id);
  }

  @Delete('api/webhooks/api-keys/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Revoke API key (admin only)' })
  async revokeApiKey(@Request() req: any, @Param('id') id: string) {
    return this.webhooksService.revokeApiKey(req.user.id, id);
  }
}
