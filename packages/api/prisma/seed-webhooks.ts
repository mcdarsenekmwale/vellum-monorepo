/**
 * Webhook supplement seed — populates the Webhook + WebhookLog tables, which are
 * the only two models left empty by the production seed. Idempotent: skips
 * entirely if the Webhook table already has 100+ rows.
 *
 * Run with:
 *   npx tsx prisma/seed-webhooks.ts
 *   npx ts-node -r tsconfig-paths/register prisma/seed-webhooks.ts
 *
 * Only depends on @prisma/client (already installed).
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Seeded RNG (mulberry32) for reproducibility ─────────────────────────────
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(0x600d5eed);
const randInt = (min: number, max: number) => Math.floor(rng() * (max - min + 1)) + min;
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];
const pickN = <T,>(arr: readonly T[], n: number): T[] => {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(n, copy.length));
};

// ─── Time helpers ─────────────────────────────────────────────────────────────
const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const MIN = 60 * 1000;
const now = Date.now();
const daysAgo = (d: number) => new Date(now - d * DAY - randInt(0, 23) * HOUR);
const minutesAgo = (m: number) => new Date(now - m * MIN);
const tsLast6mo = () => daysAgo(randInt(0, 180));

// ─── Real-data pools ─────────────────────────────────────────────────────────

const WEBHOOK_NAMES: string[] = [
  'Production Teams Alert',
  'Slack #engineering',
  'CI/CD Pipeline Notifier',
  'Billing Webhook Handler',
  'GitHub PR Notifier',
  'Datadog Metrics Forwarder',
  'PagerDuty Incident Bridge',
  'Microsoft Teams Channel',
  'Sentry Error Alert',
  'Stripe Payment Events',
  'New Relic Deployment Hook',
  'Asana Task Update',
  'Jira Issue Tracker',
  'Zendesk Ticket Sync',
  'Intercom Conversation Hook',
  'Slack #alerts-prod',
  'Slack #customer-success',
  'Outlook Email Notifier',
  'Power Automate Flow',
  'Zapier Trigger',
  'Discord #dev',
  'Telegram Bot Channel',
  'Twilio SMS Gateway',
  'Mailchimp Campaign Sync',
  'Hubspot CRM Hook',
  'Salesforce Lead Capture',
  'Linear Issue Sync',
  'Notion Database Writer',
  'Grafana Annotation',
  'Buildkite Pipeline Hook',
  'CircleCI Build Status',
  'Jenkins Job Trigger',
  'AWS SNS Topic',
  'Azure Service Bus',
  'Google Chat Notification',
  'Slack #ops-oncall',
  'Slack #releases',
  'Mattermost Notifications',
  'Rocket.Chat Webhook',
  'Webhook.site Sandbox',
  'RequestBin Inspector',
  'Postman Echo Receiver',
  'Teams Approvals Bot',
  'Teams Shifts Connector',
  'Power BI Refresh Trigger',
  'SharePoint List Writer',
  'Dynamics 365 Lead Hook',
  'Outlook Calendar Notifier',
  'Office 365 Mail Handler',
  'Azure DevOps Service',
  'GitHub Actions Dispatch',
  'GitLab Pipeline Trigger',
  'Bitbucket Push Hook',
  'AWS Lambda Invocation',
  'AWS EventBridge Bus',
  'Azure Logic App',
  'Cloudflare Worker Trigger',
  'Vercel Deploy Hook',
  'Netlify Build Trigger',
  'Heroku Dyno Manager',
  'DigitalOcean App Deploy',
  'Render Service Hook',
  'Railway Deployment',
  'Fly.io Machine Trigger',
  'Supabase Function',
  'Firebase Function Trigger',
  'Amplitude Event Forwarder',
  'Mixpanel Track Pipeline',
  'Segment.io Destination',
  'Customer.io Trigger',
  'Iterable Campaign Hook',
  'Braze Event Bridge',
  'Klaviyo Flow Trigger',
  'ConvertKit Subscriber',
  'Loops.so Notifier',
  'Resend Email Trigger',
  'Postmark Outbound',
  'SendGrid Event Receiver',
  'AWS SES Notifier',
  'Plaid Transaction',
  'Square Payment',
  'PayPal Webhook Listener',
  'Adyen Notification',
  'Razorpay Event',
  'Coinbase Commerce',
  'Shopify Order Created',
  'WooCommerce Hook',
  'BigCommerce Event',
  'Magento Store Sync',
  'Etsy Shop Feed',
  'Slack #billing',
  'Slack #trust-safety',
  'Front Inbox Router',
  'Helpscout Mailbox',
  'Crisp Chat Notifier',
  'Olark Chat Bridge',
  'Drift Conversation',
  'Calendly Invite Hook',
  'Zoom Meeting Trigger',
  'Loom Video Render',
  'Notion API Receiver',
  'Airtable Record Writer',
  'Trello Card Mover',
  'ClickUp Task Sync',
  'Monday.com Item',
  'Basecamp Project Hook',
  'Teamwork Task Bridge',
];

// URL generator keyed off the webhook name keyword. Returns a realistic
// per-provider URL so logs look like real traffic.
function webhookUrl(name: string, i: number): string {
  const lower = name.toLowerCase();
  const randHex = (n: number) =>
    Array.from({ length: n }, () => '0123456789abcdef'[rng() * 16 | 0]).join('');
  const randUpper = (n: number) =>
    Array.from({ length: n }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[rng() * 36 | 0]).join('');
  if (lower.startsWith('slack')) {
    return `https://hooks.slack.com/services/T${randUpper(8)}/B${randUpper(8)}/${randUpper(24)}`;
  }
  if (lower.startsWith('outlook') || lower.startsWith('office 365')) {
    return `https://outlook.office.com/webhook/${randUpper(40)}`;
  }
  if (lower.includes('teams')) {
    return `https://contoso.webhook.office.com/webhook/${randUpper(64)}`;
  }
  if (lower.includes('power automate') || lower.includes('powerplatform')) {
    return `https://default${randHex(24)}.environment.api.powerplatform.com/powerautomate/automations/direct/cu/${randHex(8)}/workflows/${randHex(8)}/triggers/manual/paths/invoke`;
  }
  if (lower.startsWith('discord')) {
    return `https://discord.com/api/webhooks/${randUpper(18)}/${randUpper(68)}`;
  }
  if (lower.startsWith('telegram')) {
    return `https://api.telegram.org/bot${randUpper(48)}/sendMessage`;
  }
  if (lower.startsWith('twilio')) {
    return `https://studio.twilio.com/v2/Flows/FW${randUpper(32)}/Executions`;
  }
  if (lower.startsWith('stripe')) {
    return `https://api.stripe.com/v1/webhook_endpoints/wh_${randUpper(24)}`;
  }
  if (lower.startsWith('github')) {
    return `https://api.github.com/repos/vellbase/${name.split(' ')[0].toLowerCase()}-repo/hooks/${randInt(1000000, 9999999)}`;
  }
  if (lower.startsWith('gitlab')) {
    return `https://gitlab.com/api/v4/projects/${randInt(1000, 9999)}/hooks/${randInt(100000, 999999)}`;
  }
  if (lower.startsWith('bitbucket')) {
    return `https://api.bitbucket.org/2.0/repositories/vellbase/main-webhooks/hooks/${randInt(100000, 999999)}`;
  }
  if (lower.includes('aws sns')) {
    return `https://sns.us-east-1.amazonaws.com/${randInt(100000000000, 999999999999)}`;
  }
  if (lower.includes('aws lambda')) {
    return `https://lambda.us-east-1.amazonaws.com/2015-03-31/functions/vellbase-${lower.replace(/\s+/g, '-')}/invocations`;
  }
  if (lower.includes('azure')) {
    return `https://prod-12.eastus.logic.azure.com:443/workflows/${randUpper(32)}/triggers/manual/paths/invoke`;
  }
  if (lower.startsWith('vercel')) {
    return `https://api.vercel.com/v1/integrations/deployhooks/${randUpper(24)}`;
  }
  if (lower.startsWith('datadog')) {
    return `https://api.datadoghq.com/api/v1/integration/webhooks/${name.split(' ')[0].toLowerCase()}`;
  }
  if (lower.startsWith('pagerduty')) {
    return `https://events.pagerduty.com/v2/enqueue/${randUpper(20)}`;
  }
  if (lower.startsWith('sentry')) {
    return `https://sentry.io/api/0/projects/vellbase/${lower.replace(/\s+/g, '-')}/hooks/${randInt(100000, 999999)}/`;
  }
  if (lower.includes('shopify')) {
    return `https://vellbase.myshopify.com/admin/api/2024-01/webhooks/${randInt(1000000000, 9999999999)}`;
  }
  if (lower.startsWith('requestbin')) {
    return `https://requestbin.io/${randUpper(12)}`;
  }
  if (lower.startsWith('webhook.site')) {
    return `https://webhook.site/${randUpper(36)}`;
  }
  if (lower.startsWith('postman')) {
    return `https://postman-echo.com/post`;
  }
  // Generic fallback
  return `https://api.vellbase.com/hooks/${lower.replace(/[^a-z0-9]+/g, '-')}-${randUpper(6)}`;
}

const EVENT_POOL = [
  'article.published',
  'article.updated',
  'article.liked',
  'article.bookmarked',
  'article.shared',
  'comment.created',
  'comment.reply',
  'comment.liked',
  'highlight.created',
  'highlight.liked',
  'story.viewed',
  'user.registered',
  'user.follow',
  'user.profile_updated',
  'ticket.created',
  'ticket.updated',
  'ticket.resolved',
  'ticket.escalated',
  'order.placed',
  'order.refunded',
  'payment.succeeded',
  'payment.failed',
  'subscription.renewed',
  'subscription.cancelled',
  'deploy.started',
  'deploy.succeeded',
  'deploy.failed',
  'alert.triggered',
  'alert.resolved',
  'incident.created',
];

const FORMAT_POOL = ['JSON', 'JSON', 'JSON', 'JSON', 'FORM', 'PLAIN', 'XML'];
const CARD_TYPE_POOL = ['MESSAGE', 'MESSAGE', 'MESSAGE', 'ADAPTIVE', 'ADAPTIVE'];
const BACKOFF_POOL = [500, 1000, 1000, 2000, 5000];
const ATTEMPTS_POOL = [1, 2, 3, 4, 5];

const IP_WHITELIST_POOL = [
  '54.241.18.124',
  '54.241.18.125',
  '18.190.123.4',
  '52.94.236.248',
  '3.94.45.12',
  '104.18.0.1',
  '35.190.72.34',
  '2606:4700:4700::1111',
];

const SUCCESS_STATUS = [200, 200, 200, 200, 201, 201, 202, 204];
const ERROR_STATUS = [400, 401, 403, 404, 429, 500, 502, 503];

// ─── main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('Webhook + WebhookLog supplement seed');
  console.log('====================================');

  // Idempotency check
  const existingWebhooks = await prisma.webhook.count();
  if (existingWebhooks >= 100) {
    console.log(`Webhook: ${existingWebhooks} rows already present (>= 100 target). Skipping all inserts.`);
    const existingLogs = await prisma.webhookLog.count();
    console.log(`WebhookLog: ${existingLogs} rows currently present.`);
    return;
  }

  // Fetch existing users for createdBy
  const users = await prisma.user.findMany({ select: { id: true }, take: 50 });
  const userIds = users.map((u) => u.id);
  if (userIds.length === 0) {
    console.error('No users found in the database — run the production seed first.');
    process.exit(1);
  }
  console.log(`Fetched ${userIds.length} user ids for createdBy assignment.`);

  // ─── Build 100 Webhook rows ────────────────────────────────────────────────
  const webhookRows = WEBHOOK_NAMES.slice(0, 100).map((name, i) => {
    const isOutgoing = rng() < 0.7; // ~70% OUTGOING, 30% INCOMING
    const type = isOutgoing ? 'OUTGOING' : 'INCOMING';
    const events = pickN(EVENT_POOL, randInt(2, 5));
    const isActive = rng() < 0.85; // ~85% active
    const createdAt = tsLast6mo();
    const lastTriggeredAt = rng() < 0.7 ? minutesAgo(randInt(5, 60 * 24 * 90)) : null; // some null, some recent
    const failureCount = rng() < 0.7 ? 0 : randInt(1, 5);

    // headers — realistic request headers per provider
    const lower = name.toLowerCase();
    let headers: Record<string, string> = {
      'User-Agent': 'Vellbase-Webhook/1.0',
      Accept: 'application/json',
    };
    if (lower.startsWith('slack') || lower.startsWith('github') || lower.includes('stripe')) {
      headers['X-Signature'] = `v0=${Array.from({ length: 64 }, () => '0123456789abcdef'[rng() * 16 | 0]).join('')}`;
    }
    if (lower.includes('teams') || lower.includes('outlook') || lower.includes('office')) {
      headers['X-Office-Activity-ID'] = crypto.randomUUID();
    }
    if (isOutgoing) {
      headers['X-Webhook-Id'] = `wh_${randInt(100000, 999999)}`;
    }

    // allowedIps — mostly empty (only for some incoming webhooks)
    const allowedIps = !isOutgoing && rng() < 0.4 ? pickN(IP_WHITELIST_POOL, randInt(1, 3)) : [];

    return {
      name,
      type: type as any,
      url: webhookUrl(name, i),
      format: pick(FORMAT_POOL) as any,
      events,
      headers: headers as any,
      isActive,
      lastTriggeredAt,
      failureCount,
      retryMaxAttempts: pick(ATTEMPTS_POOL),
      retryBackoffDelay: pick(BACKOFF_POOL),
      allowedIps,
      requiresAuth: rng() < 0.85,
      teamsChannelId: lower.includes('teams') ? `19:${Array.from({ length: 32 }, () => 'abcdef0123456789'[rng() * 16 | 0]).join('')}@thread.skype` : null,
      teamsTeamId: lower.includes('teams') ? Array.from({ length: 32 }, () => 'abcdef0123456789'[rng() * 16 | 0]).join('') : null,
      teamsCardType: pick(CARD_TYPE_POOL) as any,
      teamsCardTemplate: lower.includes('teams') ? { schema: 'http://adaptivecards.io/schemas/adaptive-card.json', type: 'AdaptiveCard', version: '1.4' } : null,
      createdBy: pick(userIds),
      createdAt,
      updatedAt: createdAt,
    };
  });

  // Insert webhooks in one batch
  const webhookRes = await prisma.webhook.createMany({ data: webhookRows, skipDuplicates: true });
  console.log(`Webhook: ${webhookRes.count} rows created (target 100).`);

  // ─── Build 200+ WebhookLog rows ───────────────────────────────────────────
  // Fetch inserted webhooks to link logs to them
  const createdWebhooks = await prisma.webhook.findMany({
    select: { id: true, events: true, lastTriggeredAt: true },
    take: 200,
    orderBy: { createdAt: 'asc' },
  });

  if (createdWebhooks.length === 0) {
    console.error('No webhooks found after insert — aborting log seeding.');
    process.exit(1);
  }

  const logRows: any[] = [];
  let logsCreated = 0;
  for (const wh of createdWebhooks) {
    // At least 2 logs per webhook; some get 5+
    const baseCount = randInt(2, 6);
    const extraHigh = rng() < 0.25 ? randInt(0, 3) : 0; // ~25% have 5+ logs
    const numLogs = baseCount + extraHigh;
    const eventChoices = wh.events?.length ? wh.events : ['article.published'];
    const baseTime = wh.lastTriggeredAt ?? tsLast6mo();

    for (let j = 0; j < numLogs; j++) {
      const isError = rng() < 0.18; // ~18% errors
      const logType = isError ? 'ERROR' : pick(['REQUEST', 'RESPONSE', 'RESPONSE']) as any;
      const status = isError ? pick(ERROR_STATUS) : pick(SUCCESS_STATUS);
      const attempt = isError && rng() < 0.5 ? pick([2, 2, 3]) : 1;
      const event = pick(eventChoices);
      // Timestamp within a window around the webhook's lastTriggeredAt
      const offset = randInt(0, 14) * DAY + randInt(0, 23) * HOUR;
      const timestamp = new Date(baseTime.getTime() - offset);
      const durationMs = randInt(50, 5000);

      const payload: Record<string, any> = {
        event,
        timestamp: timestamp.toISOString(),
        data: {
          id: crypto.randomUUID(),
          type: event.split('.')[0],
          attributes: {
            title: `${event} event payload`,
            slug: `event-${event.replace('.', '-')}-${j}`,
            createdAt: timestamp.toISOString(),
          },
        },
      };
      if (event.startsWith('article')) payload.data.attributes.articleId = crypto.randomUUID();
      if (event.startsWith('ticket')) payload.data.attributes.ticketId = `TKT-${randInt(1000, 9999)}`;

      const response: Record<string, any> = isError
        ? { ok: false, error: status === 429 ? 'rate_limited' : 'request_failed', message: `HTTP ${status}` }
        : { ok: true, status, messageId: crypto.randomUUID(), accepted: true };

      const logHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'Vellbase-Webhook/1.0',
        'X-Request-ID': crypto.randomUUID(),
      };

      logRows.push({
        webhookId: wh.id,
        type: logType,
        event,
        statusCode: status,
        payload: payload as any,
        response: response as any,
        headers: logHeaders as any,
        durationMs,
        errorMessage: isError ? errorMessageFor(status, event) : null,
        attempt,
        timestamp,
      });
    }
  }

  // Insert logs (chunk to avoid query size limits)
  const CHUNK = 100;
  for (let i = 0; i < logRows.length; i += CHUNK) {
    const chunk = logRows.slice(i, i + CHUNK);
    const res = await prisma.webhookLog.createMany({ data: chunk, skipDuplicates: true });
    logsCreated += res.count;
  }
  console.log(`WebhookLog: ${logsCreated} rows created (${logRows.length} attempted).`);

  // Final counts
  const finalWebhooks = await prisma.webhook.count();
  const finalLogs = await prisma.webhookLog.count();
  console.log(`Final counts — Webhook: ${finalWebhooks}, WebhookLog: ${finalLogs}`);
}

function errorMessageFor(status: number, event: string): string {
  switch (status) {
    case 400:
      return `Bad request: malformed payload for event "${event}"`;
    case 401:
      return 'Unauthorized: invalid or missing webhook signature';
    case 403:
      return 'Forbidden: source IP not in allowedIps whitelist';
    case 404:
      return 'Not found: webhook endpoint does not exist or was deleted';
    case 429:
      return 'Rate limited: too many requests, retrying with backoff';
    case 500:
      return 'Internal server error: upstream provider returned 500';
    case 502:
      return 'Bad gateway: upstream provider unreachable';
    case 503:
      return 'Service unavailable: upstream provider temporarily down';
    default:
      return `Unexpected HTTP ${status} from upstream provider`;
  }
}

main()
  .catch((e) => {
    console.error('Webhook seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
