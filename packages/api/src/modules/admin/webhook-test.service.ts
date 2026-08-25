import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import {
  WebhookExecutorService,
  ExecutionResult,
} from '../webhooks/webhook-executor.service';

/**
 * Request shape the Admin webhook test endpoint accepts.
 * Mirrors TestWebhookDto field-for-field so callers coming through
 * the admin controller (which indexes this type for the body) can
 * pass {event?, payload?, headers?, overrideUrl?} identically to the
 * non-admin /api/webhooks/:id/test path.
 */
export interface WebhookTestRequest {
  body: {
    event?: string;
    payload?: unknown;
    headers?: Record<string, string>;
    overrideUrl?: string;
  };
}

export interface WebhookTestResult extends ExecutionResult {
  webhookId: string;
  webhookName: string;
  request?: {
    url: string;
    method: string;
    headers: Record<string, string>;
    bodyPreview?: string;
  };
  responsePreview?: unknown;
  timestamp: string;
}

@Injectable()
export class WebhookTestService {
  private readonly logger = new Logger(WebhookTestService.name);

  constructor(
    private prisma: PrismaService,
    private webhookExecutor: WebhookExecutorService,
  ) {}

  /**
   * Run a single fire-and-return test delivery against the configured
   * webhook. Forces `isTest: true` on the executor so retries are
   * skipped (maxAttempts clamped to 1), rate limiting is bypassed for
   * the probe, and the result is returned synchronously with request
   * + response metadata the admin UI debug panel renders.
   */
  async testWebhook(
    id: string,
    body: WebhookTestRequest['body'],
  ): Promise<WebhookTestResult> {
    const webhook = await this.prisma.webhook.findUnique({ where: { id } });
    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }

    const start = Date.now();
    this.logger.log(
      `[TEST] webhook=${webhook.id} name=${webhook.name} event=${body?.event ?? 'manual'} url=${body?.overrideUrl ?? webhook.url}`,
    );

    const result = await this.webhookExecutor.executeOutgoing(webhook, {
      event: body?.event,
      payload: body?.payload,
      extraHeaders: body?.headers,
      overrideUrl: body?.overrideUrl,
      isTest: true,
    });

    const durationMs = Date.now() - start;
    const responsePreview =
      result.body && typeof result.body === 'object'
        ? truncateDeep(result.body, 400)
        : typeof result.body === 'string'
        ? result.body.slice(0, 400)
        : result.body;

    this.logger.log(
      `[TEST] webhook=${webhook.id} success=${result.success} status=${result.statusCode ?? 'none'} duration=${durationMs}ms`,
    );

    return {
      webhookId: webhook.id,
      webhookName: webhook.name,
      success: result.success,
      statusCode: result.statusCode,
      body: result.body,
      headers: result.headers,
      durationMs,
      attempt: result.attempt,
      totalAttempts: result.totalAttempts,
      errorMessage: result.errorMessage,
      responsePreview,
      timestamp: new Date().toISOString(),
    };
  }
}

function truncateDeep(obj: unknown, maxChars = 500): unknown {
  const serialized = JSON.stringify(obj);
  if (!serialized) return obj;
  if (serialized.length <= maxChars) return obj;
  try {
    return JSON.parse(serialized.slice(0, maxChars) + '…"truncated":true}');
  } catch {
    return serialized.slice(0, maxChars) + '… [truncated]';
  }
}
