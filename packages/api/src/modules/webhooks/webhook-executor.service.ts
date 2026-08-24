import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { TeamsIntegrationService } from './teams-integration.service';
import {
  Webhook,
  WebhookFormat,
  WebhookLogType,
  WebhookType,
} from '@prisma/client';
import * as crypto from 'crypto';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExecutionResult {
  success: boolean;
  statusCode?: number;
  body?: any;
  headers?: Record<string, string>;
  durationMs: number;
  attempt: number;
  totalAttempts: number;
  errorMessage?: string;
}

export interface OutgoingRequestOptions {
  event?: string;
  payload?: any;
  extraHeaders?: Record<string, string>;
  overrideUrl?: string;
  isTest?: boolean;
}

// ─── Webhook Rate Limiter ─────────────────────────────────────────────────────

/**
 * Per-webhook sliding-window rate limiter (in-memory).
 * Teams: max 4 requests/sec per webhook; default 100/min for others.
 */
export class WebhookRateLimiter {
  private readonly windows = new Map<string, number[]>();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests = 4, windowMs = 1000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  isAllowed(key: string): boolean {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    const recent = (this.windows.get(key) || []).filter(t => t > cutoff);
    if (recent.length >= this.maxRequests) {
      this.windows.set(key, recent);
      return false;
    }
    recent.push(now);
    this.windows.set(key, recent);
    return true;
  }

  /**
   * Retry-After seconds for the 429 response (next available slot).
   */
  retryAfter(key: string): number {
    const recent = this.windows.get(key) || [];
    if (!recent.length) return 0;
    const oldest = recent[0];
    const wait = Math.max(0, oldest + this.windowMs - Date.now());
    return Math.ceil(wait / 1000);
  }
}

// ─── Webhook Signature Service ────────────────────────────────────────────────

@Injectable()
export class WebhookSignatureService {
  constructor(private configService: ConfigService) {}

  /**
   * Compute HMAC-SHA256 signature of the body string using the webhook secret.
   * Returns the `sha256=...` signature.
   */
  computeSignature(secret: string, body: string): string {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(body, 'utf-8');
    return `sha256=${hmac.digest('hex')}`;
  }

  /**
   * Verify an incoming webhook signature.
   * Accepts both `X-Signature` header and `X-Hub-Signature-256` style.
   */
  verifySignature(
    secret: string,
    rawBody: string | Buffer,
    signatureHeader?: string,
  ): boolean {
    if (!signatureHeader) return false;
    const body = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf-8');
    const expected = this.computeSignature(secret, body).replace(/^sha256=/, '');
    const provided = signatureHeader.replace(/^sha256=/, '').trim();
    if (!provided) return false;
    try {
      return crypto.timingSafeEqual(
        Buffer.from(expected, 'hex'),
        Buffer.from(provided, 'hex'),
      );
    } catch {
      return false;
    }
  }
}

// ─── Webhook Executor ─────────────────────────────────────────────────────────

@Injectable()
export class WebhookExecutorService {
  private readonly logger = new Logger(WebhookExecutorService.name);
  private readonly outgoingRateLimiter: WebhookRateLimiter;
  private readonly incomingRateLimiter: WebhookRateLimiter;

  constructor(
    private prisma: PrismaService,
    private signatureService: WebhookSignatureService,
    private teamsService: TeamsIntegrationService,
  ) {
    // Teams throttles at 4 req/s — keep a conservative global limit
    this.outgoingRateLimiter = new WebhookRateLimiter(4, 1000);
    this.incomingRateLimiter = new WebhookRateLimiter(100, 60_000);
  }

  getRateLimiters() {
    return {
      outgoing: this.outgoingRateLimiter,
      incoming: this.incomingRateLimiter,
    };
  }

  // ─── OUTGOING: Execute ─────────────────────────────────────────────────────

  async executeOutgoing(
    webhook: Webhook,
    options: OutgoingRequestOptions,
  ): Promise<ExecutionResult> {
    const url = options.overrideUrl || webhook.url;
    const event = options.event || 'manual';
    const rawPayload = options.payload ?? {};

    // Rate limit check
    if (!options.isTest && !this.outgoingRateLimiter.isAllowed(webhook.id)) {
      const retry = this.outgoingRateLimiter.retryAfter(webhook.id);
      return {
        success: false,
        durationMs: 0,
        attempt: 1,
        totalAttempts: 1,
        errorMessage: `Rate limited (too many requests). Retry after ${retry}s.`,
      };
    }

    // Build request body (handle Teams payload formatting)
    const { body, contentType } = this.serializeOutgoing(webhook, event, rawPayload);

    // Size limit check (Teams max 28 KB)
    if (Buffer.byteLength(body, 'utf-8') > 28 * 1024) {
      return {
        success: false,
        durationMs: 0,
        attempt: 1,
        totalAttempts: 1,
        errorMessage: 'Payload exceeds 28 KB size limit for Teams/webhook delivery.',
      };
    }

    const headers: Record<string, string> = {
      'Content-Type': contentType,
      ...(this.mergeHeaders(webhook.headers as any, options.extraHeaders)),
    };

    // HMAC signature
    if (webhook.secret) {
      headers['X-Signature'] = this.signatureService.computeSignature(webhook.secret, body);
      headers['X-Timestamp'] = String(Math.floor(Date.now() / 1000));
    }

    const maxAttempts = options.isTest ? 1 : Math.max(1, webhook.retryMaxAttempts || 1);
    const backoff = Math.max(100, webhook.retryBackoffDelay || 1000);

    let lastError: Error | null = null;
    let lastStatusCode: number | undefined;
    let attempt = 0;
    const started = Date.now();

    while (attempt < maxAttempts) {
      attempt++;
      try {
        const res = await this.fetchWithTimeout(url, {
          method: 'POST',
          headers,
          body,
        }, options.isTest ? 15000 : 30000);

        const durationMs = Date.now() - started;
        const text = await res.text();
        let parsedResponse: any = text;
        try { parsedResponse = text ? JSON.parse(text) : null; } catch { /* keep as text */ }

        // 2xx success
        if (res.status >= 200 && res.status < 300) {
          this.logger.debug(
            `Webhook ${webhook.id} (${webhook.name}) -> ${res.status} on attempt ${attempt}`,
          );
          await this.persistLog({
            webhookId: webhook.id,
            type: res.status >= 500 ? WebhookLogType.ERROR : WebhookLogType.RESPONSE,
            event,
            statusCode: res.status,
            payload: rawPayload,
            response: parsedResponse,
            headers: this.extractResponseHeaders(res.headers),
            durationMs,
            attempt,
            errorMessage: res.status >= 400 ? `HTTP ${res.status}` : undefined,
          });
          await this.touchWebhook(webhook.id, true);
          return {
            success: true,
            statusCode: res.status,
            body: parsedResponse,
            durationMs,
            attempt,
            totalAttempts: maxAttempts,
          };
        }

        lastStatusCode = res.status;
        lastError = new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
        this.logger.warn(
          `Webhook ${webhook.id} attempt ${attempt} failed: HTTP ${res.status}`,
        );
      } catch (err: any) {
        lastError = err;
        this.logger.warn(
          `Webhook ${webhook.id} attempt ${attempt} error: ${err.message}`,
        );
      }

      // Retry wait (skip on last attempt)
      if (attempt < maxAttempts && !options.isTest) {
        await this.sleep(backoff * attempt);
      }
    }

    const durationMs = Date.now() - started;
    await this.persistLog({
      webhookId: webhook.id,
      type: WebhookLogType.ERROR,
      event,
      statusCode: lastStatusCode,
      payload: rawPayload,
      durationMs,
      attempt,
      errorMessage: lastError?.message || 'Unknown error',
    });
    await this.touchWebhook(webhook.id, false);

    return {
      success: false,
      statusCode: lastStatusCode,
      errorMessage: lastError?.message,
      durationMs,
      attempt,
      totalAttempts: maxAttempts,
    };
  }

  // ─── INCOMING: Validate + Parse ────────────────────────────────────────────

  async handleIncoming(
    webhook: Webhook,
    rawBody: Buffer,
    parsedBody: any,
    headers: Record<string, string | string[] | undefined>,
    clientIp?: string,
  ): Promise<{ accepted: boolean; error?: string; event?: string; data?: any }> {
    // Rate limit
    if (!this.incomingRateLimiter.isAllowed(webhook.id)) {
      return { accepted: false, error: 'Rate limited. Too many requests.' };
    }

    // IP allowlist check
    if (webhook.allowedIps?.length && clientIp) {
      const ipOk = webhook.allowedIps.some(ip =>
        ip === clientIp || this.ipInCidr(clientIp, ip),
      );
      if (!ipOk) {
        return { accepted: false, error: `IP ${clientIp} not in allowlist` };
      }
    }

    // Signature verification
    if (webhook.requiresAuth && webhook.secret) {
      const sigHeader =
        (headers['x-signature'] as string) ||
        (headers['x-hub-signature-256'] as string);
      if (!this.signatureService.verifySignature(webhook.secret, rawBody, sigHeader)) {
        return { accepted: false, error: 'Invalid or missing signature' };
      }
    }

    const event = parsedBody?.event || 'generic';
    const data = parsedBody?.data ?? parsedBody;

    await this.persistLog({
      webhookId: webhook.id,
      type: WebhookLogType.REQUEST,
      event,
      payload: data,
      headers: Object.fromEntries(
        Object.entries(headers).map(([k, v]) => [k, Array.isArray(v) ? v.join(',') : (v ?? '')]),
      ),
      durationMs: 0,
      attempt: 1,
    });
    await this.touchWebhook(webhook.id, true);

    return { accepted: true, event, data };
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private serializeOutgoing(
    webhook: Webhook,
    event: string,
    payload: any,
  ): { body: string; contentType: string } {
    // Teams-specific formatting
    if (webhook.teamsCardType || webhook.teamsCardTemplate) {
      const body = this.teamsService.buildOutgoingPayload(
        webhook.teamsCardType,
        event,
        payload,
        webhook.teamsCardTemplate as any,
      );
      return { body, contentType: 'application/json; charset=utf-8' };
    }

    switch (webhook.format) {
      case WebhookFormat.FORM: {
        const params = new URLSearchParams();
        if (payload && typeof payload === 'object') {
          for (const [k, v] of Object.entries(payload)) {
            params.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v ?? ''));
          }
        }
        return { body: params.toString(), contentType: 'application/x-www-form-urlencoded' };
      }
      case WebhookFormat.XML: {
        return {
          body: this.objectToXml(payload ?? {}),
          contentType: 'application/xml; charset=utf-8',
        };
      }
      case WebhookFormat.PLAIN: {
        return {
          body: typeof payload === 'string' ? payload : JSON.stringify(payload),
          contentType: 'text/plain; charset=utf-8',
        };
      }
      case WebhookFormat.JSON:
      default: {
        return {
          body: JSON.stringify(payload ?? {}),
          contentType: 'application/json; charset=utf-8',
        };
      }
    }
  }

  private mergeHeaders(
    stored: Record<string, string> | undefined | null,
    extra: Record<string, string> | undefined,
  ): Record<string, string> {
    const out: Record<string, string> = {};
    if (stored && typeof stored === 'object') {
      for (const [k, v] of Object.entries(stored)) {
        if (v !== undefined && v !== null) out[k] = String(v);
      }
    }
    if (extra) {
      for (const [k, v] of Object.entries(extra)) {
        if (v !== undefined && v !== null) out[k] = String(v);
      }
    }
    return out;
  }

  private async fetchWithTimeout(
    url: string,
    init: RequestInit,
    timeoutMs: number,
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      return res;
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        throw new Error(`Request timed out after ${timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  private async persistLog(args: {
    webhookId: string;
    type: WebhookLogType;
    event?: string;
    statusCode?: number;
    payload?: any;
    response?: any;
    headers?: Record<string, string>;
    durationMs: number;
    errorMessage?: string;
    attempt: number;
  }) {
    try {
      await this.prisma.webhookLog.create({
        data: {
          webhookId: args.webhookId,
          type: args.type,
          event: args.event || null,
          statusCode: args.statusCode ?? null,
          payload: args.payload ?? null,
          response: args.response ?? null,
          headers: (args.headers as any) ?? null,
          durationMs: args.durationMs ?? null,
          errorMessage: args.errorMessage ?? null,
          attempt: args.attempt,
          timestamp: new Date(),
        },
      });
    } catch (e) {
      this.logger.error('Failed to persist webhook log', (e as Error).stack);
    }
  }

  private async touchWebhook(id: string, success: boolean) {
    try {
      await this.prisma.webhook.update({
        where: { id },
        data: {
          lastTriggeredAt: new Date(),
          failureCount: success ? 0 : { increment: 1 },
        },
      });
    } catch {
      // ignore — webhook may have been deleted
    }
  }

  private objectToXml(obj: any, root = 'payload'): string {
    const esc = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const lines: string[] = [`<?xml version="1.0" encoding="UTF-8"?>`, `<${root}>`];
    const walk = (o: any, indent: string) => {
      for (const [k, v] of Object.entries(o)) {
        if (v === null || v === undefined) continue;
        if (typeof v === 'object') {
          lines.push(`${indent}<${k}>`);
          walk(v, indent + '  ');
          lines.push(`${indent}</${k}>`);
        } else {
          lines.push(`${indent}<${k}>${esc(String(v))}</${k}>`);
        }
      }
    };
    walk(obj, '  ');
    lines.push(`</${root}>`);
    return lines.join('\n');
  }

  private ipInCidr(ip: string, cidr: string): boolean {
    if (!cidr.includes('/')) return ip === cidr;
    try {
      const [range, bitsStr] = cidr.split('/');
      const bits = parseInt(bitsStr, 10);
      const ipInt = this.ipToInt(ip);
      const rangeInt = this.ipToInt(range);
      const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
      return (ipInt & mask) === (rangeInt & mask);
    } catch {
      return false;
    }
  }

  private ipToInt(ip: string): number {
    return ip
      .split('.')
      .reduce((acc, part) => (acc << 8) | parseInt(part, 10), 0) >>> 0;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private extractResponseHeaders(headers: Headers): Record<string, string> | undefined {
    try {
      const out: Record<string, string> = {};
      headers.forEach((value, key) => {
        out[key] = value;
      });
      return Object.keys(out).length ? out : undefined;
    } catch {
      return undefined;
    }
  }
}
