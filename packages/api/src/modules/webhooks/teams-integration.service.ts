import { Injectable, Logger } from '@nestjs/common';
import { TeamsCardType } from '@prisma/client';

// ─── Teams Message Card (legacy / Office 365 Connector) ───────────────────────
export interface TeamsMessageCard {
  '@type'?: 'MessageCard';
  '@context'?: string;
  summary: string;
  themeColor?: string;
  title?: string;
  text?: string;
  sections?: MessageCardSection[];
  potentialAction?: MessageCardAction[];
}

export interface MessageCardSection {
  activityTitle?: string;
  activitySubtitle?: string;
  activityImage?: string;
  facts?: { name: string; value: string }[];
  text?: string;
  markdown?: boolean;
  images?: { image: string; title?: string }[];
}

export type MessageCardAction =
  | OpenUriAction
  | HttpPostAction
  | ActionCardAction;

export interface OpenUriAction {
  '@type': 'OpenUri';
  name: string;
  targets: { os?: string; uri: string }[];
}

export interface HttpPostAction {
  '@type': 'HttpPOST';
  name: string;
  target: string;
  body?: string;
  bodyContentType?: string;
  headers?: { name: string; value: string }[];
}

export interface ActionCardAction {
  '@type': 'ActionCard';
  name: string;
  inputs?: ActionCardInput[];
  actions?: (OpenUriAction | HttpPostAction)[];
}

export interface ActionCardInput {
  '@type': 'TextInput' | 'MultilineTextInput' | 'DateInput' | 'MultiChoiceInput';
  id: string;
  isMultiline?: boolean;
  title: string;
  choices?: { display: string; value: string }[];
  isMultiSelect?: boolean;
}

// ─── Teams Adaptive Card (newer / Workflows) ─────────────────────────────────

export interface AdaptiveCardEnvelope {
  type: 'message';
  attachments: AdaptiveCardAttachment[];
}

export interface AdaptiveCardAttachment {
  contentType: 'application/vnd.microsoft.card.adaptive';
  contentUrl?: string;
  content: AdaptiveCard;
}

export interface AdaptiveCard {
  type: 'AdaptiveCard';
  version: string;
  schema?: string;
  body: AdaptiveCardElement[];
  actions?: AdaptiveCardAction[];
  msteams?: { width?: string; height?: string; allowExpand?: boolean };
  fallbackText?: string;
}

export type AdaptiveCardElement =
  | TextBlock
  | RichTextBlock
  | Image
  | Media
  | Container
  | ColumnSet
  | FactSet
  | ImageSet
  | ActionSet;

export interface TextBlock {
  type: 'TextBlock';
  text: string;
  size?: 'default' | 'small' | 'medium' | 'large' | 'extraLarge';
  weight?: 'default' | 'lighter' | 'bolder';
  color?:
    | 'default'
    | 'dark'
    | 'light'
    | 'accent'
    | 'good'
    | 'warning'
    | 'attention';
  isSubtle?: boolean;
  wrap?: boolean;
  maxLines?: number;
  separator?: boolean;
  spacing?: 'default' | 'none' | 'small' | 'medium' | 'large' | 'extraLarge' | 'padding';
  horizontalAlignment?: 'left' | 'center' | 'right';
  fontType?: 'default' | 'monospace';
}

export interface RichTextBlock {
  type: 'RichTextBlock';
  inlines: Array<{ type?: 'TextRun'; text: string; size?: number; weight?: string; color?: string } | string>;
  horizontalAlignment?: 'left' | 'center' | 'right';
}

export interface Image {
  type: 'Image';
  url: string;
  altText?: string;
  size?: 'auto' | 'stretch' | 'small' | 'medium' | 'large';
  style?: 'default' | 'person';
  width?: string;
  height?: string;
}

export interface Media {
  type: 'Media';
  sources: { url: string; mimeType?: string }[];
  poster?: string;
  altText?: string;
}

export interface Container {
  type: 'Container';
  items: AdaptiveCardElement[];
  style?: 'default' | 'emphasis' | 'good' | 'attention' | 'warning' | 'accent';
  bleed?: boolean;
  minHeight?: string;
  separator?: boolean;
  spacing?: string;
}

export interface ColumnSet {
  type: 'ColumnSet';
  columns: Column[];
}

export interface Column {
  type: 'Column';
  items: AdaptiveCardElement[];
  width?: 'auto' | 'stretch' | number | string;
  style?: string;
}

export interface FactSet {
  type: 'FactSet';
  facts: { title: string; value: string }[];
}

export interface ImageSet {
  type: 'ImageSet';
  images: Image[];
  imageSize?: 'auto' | 'stretch' | 'small' | 'medium' | 'large';
}

export interface ActionSet {
  type: 'ActionSet';
  actions: AdaptiveCardAction[];
}

export type AdaptiveCardAction =
  | ActionOpenUrl
  | ActionSubmit
  | ActionShowCard
  | ActionExecute
  | ActionToggleVisibility;

export interface ActionOpenUrl {
  type: 'Action.OpenUrl';
  title: string;
  url: string;
  iconUrl?: string;
  style?: 'default' | 'positive' | 'destructive';
}

export interface ActionSubmit {
  type: 'Action.Submit';
  title: string;
  data?: any;
  iconUrl?: string;
  style?: 'default' | 'positive' | 'destructive';
}

export interface ActionShowCard {
  type: 'Action.ShowCard';
  title: string;
  card: AdaptiveCard;
  iconUrl?: string;
}

export interface ActionExecute {
  type: 'Action.Execute';
  title: string;
  verb?: string;
  data?: any;
  iconUrl?: string;
}

export interface ActionToggleVisibility {
  type: 'Action.ToggleVisibility';
  title: string;
  targetElements: string[] | { elementId: string; isVisible: boolean }[];
}

// ─── Priority helpers ────────────────────────────────────────────────────────

const PRIORITY_COLORS: Record<string, string> = {
  LOW: '#6b7280',
  MEDIUM: '#3b82f6',
  HIGH: '#f59e0b',
  CRITICAL: '#ef4444',
  EMERGENCY: '#7f1d1d',
};

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class TeamsIntegrationService {
  private readonly logger = new Logger(TeamsIntegrationService.name);

  // ── Build outgoing webhook body ────────────────────────────────────────────

  buildOutgoingPayload(
    cardType: TeamsCardType | null | undefined,
    event: string,
    payload: any,
    customTemplate?: any,
  ): string {
    if (customTemplate) {
      const rendered = this.renderTemplate(customTemplate, {
        event,
        timestamp: new Date().toISOString(),
        ...(payload || {}),
      });
      if (cardType === TeamsCardType.MESSAGE) {
        return JSON.stringify(rendered);
      }
      // Adaptive: wrap in envelope
      return JSON.stringify({
        type: 'message',
        attachments: [
          {
            contentType: 'application/vnd.microsoft.card.adaptive',
            content: rendered,
          },
        ],
      } as AdaptiveCardEnvelope);
    }

    if (cardType === TeamsCardType.MESSAGE) {
      return JSON.stringify(this.buildMessageCard(event, payload));
    }
    return JSON.stringify(this.buildAdaptiveCardEnvelope(event, payload));
  }

  // ── Message Card builder ───────────────────────────────────────────────────

  buildMessageCard(event: string, data: any): TeamsMessageCard {
    const subject = data?.subject || data?.title || data?.name || event;
    const priority = data?.priority || data?.severity || null;
    const color = priority && PRIORITY_COLORS[String(priority).toUpperCase()]
      ? PRIORITY_COLORS[String(priority).toUpperCase()]
      : '#6366f1';

    const facts: { name: string; value: string }[] = [];
    if (data?.ticketNumber) facts.push({ name: 'Ticket', value: String(data.ticketNumber) });
    if (priority) facts.push({ name: 'Priority', value: String(priority) });
    if (data?.status) facts.push({ name: 'Status', value: String(data.status) });
    if (data?.user || data?.userName || data?.createdBy) {
      facts.push({
        name: 'User',
        value: String(data.user || data.userName || data.createdBy),
      });
    }
    if (data?.category) facts.push({ name: 'Category', value: String(data.category) });
    facts.push({
      name: 'Timestamp',
      value: new Date().toLocaleString('en-US', { timeZone: 'UTC' }),
    });

    const sections: MessageCardSection[] = [
      {
        activityTitle: subject,
        activitySubtitle: `Event: ${event}`,
        facts,
        markdown: true,
      },
    ];

    if (data?.message || data?.description || data?.body) {
      sections.push({
        text: String(data.message || data.description || data.body),
        markdown: true,
      });
    }

    const actions: MessageCardAction[] = [];
    if (data?.link || data?.url) {
      actions.push({
        '@type': 'OpenUri',
        name: 'View Details',
        targets: [{ uri: String(data.link || data.url), os: 'default' }],
      });
    }

    return {
      '@type': 'MessageCard',
      '@context': 'https://schema.org/extensions',
      summary: `[${event}] ${subject}`,
      themeColor: color,
      title: `${this.emojiForEvent(event)} ${subject}`,
      text: `**Event**: \`${event}\``,
      sections,
      potentialAction: actions.length ? actions : undefined,
    };
  }

  // ── Adaptive Card builder ──────────────────────────────────────────────────

  buildAdaptiveCardEnvelope(event: string, data: any): AdaptiveCardEnvelope {
    const card = this.buildAdaptiveCard(event, data);
    return {
      type: 'message',
      attachments: [
        {
          contentType: 'application/vnd.microsoft.card.adaptive',
          content: card,
        },
      ],
    };
  }

  buildAdaptiveCard(event: string, data: any): AdaptiveCard {
    const subject = data?.subject || data?.title || data?.name || event;
    const priority = data?.priority || data?.severity || null;
    const priorityStr = priority ? String(priority).toUpperCase() : null;
    const containerStyle =
      priorityStr === 'CRITICAL' || priorityStr === 'EMERGENCY'
        ? 'attention'
        : priorityStr === 'HIGH'
        ? 'warning'
        : priorityStr === 'LOW'
        ? 'good'
        : 'default';

    const body: AdaptiveCardElement[] = [];

    // Header
    body.push({
      type: 'Container',
      style: containerStyle,
      items: [
        {
          type: 'TextBlock',
          text: `${this.emojiForEvent(event)} ${subject}`,
          size: 'large',
          weight: 'bolder',
          wrap: true,
        },
        {
          type: 'TextBlock',
          text: `Event: \`${event}\``,
          spacing: 'small',
          isSubtle: true,
          wrap: true,
        },
      ],
    });

    // Facts
    const facts: { title: string; value: string }[] = [];
    if (data?.ticketNumber) facts.push({ title: 'Ticket', value: String(data.ticketNumber) });
    if (priorityStr) facts.push({ title: 'Priority', value: priorityStr });
    if (data?.status) facts.push({ title: 'Status', value: String(data.status) });
    if (data?.user || data?.userName || data?.createdBy) {
      facts.push({
        title: 'User',
        value: String(data.user || data.userName || data.createdBy),
      });
    }
    if (data?.category) facts.push({ title: 'Category', value: String(data.category) });
    facts.push({
      title: 'Timestamp',
      value: new Date().toISOString(),
    });

    if (facts.length) body.push({ type: 'FactSet', facts });

    // Description / body
    const bodyText = data?.message || data?.description || data?.body;
    if (bodyText) {
      body.push({
        type: 'TextBlock',
        text: String(bodyText),
        separator: true,
        spacing: 'medium',
        wrap: true,
      });
    }

    // Extra fields as columns
    const extra = Object.entries(data || {}).filter(
      ([k]) =>
        !['subject', 'title', 'name', 'priority', 'severity', 'status', 'user',
           'userName', 'createdBy', 'category', 'message', 'description', 'body',
           'ticketNumber', 'link', 'url', 'id'].includes(k),
    );
    if (extra.length) {
      const extraFacts = extra
        .slice(0, 8)
        .map(([k, v]) => ({
          title: k,
          value:
            typeof v === 'object' && v !== null
              ? JSON.stringify(v).slice(0, 120)
              : String(v ?? '').slice(0, 120),
        }));
      body.push({ type: 'FactSet', facts: extraFacts });
    }

    // Actions
    const actions: AdaptiveCardAction[] = [];
    if (data?.link || data?.url) {
      actions.push({
        type: 'Action.OpenUrl',
        title: 'View Details',
        url: String(data.link || data.url),
        style: 'positive',
      });
    }

    return {
      type: 'AdaptiveCard',
      version: '1.4',
      body,
      actions: actions.length ? actions : undefined,
      fallbackText: `[${event}] ${subject}`,
      msteams: { width: 'Full' },
    };
  }

  // ── Simple notification card (for quick alerts) ────────────────────────────

  buildAlertCard(
    priority: 'low' | 'medium' | 'high' | 'critical',
    title: string,
    message: string,
    source?: string,
    resolutionSteps?: string[],
  ): AdaptiveCard {
    const styleMap: Record<string, Container['style']> = {
      low: 'good',
      medium: 'default',
      high: 'warning',
      critical: 'attention',
    };
    const emojiMap = { low: 'ℹ️', medium: '📣', high: '⚠️', critical: '🚨' };

    const body: AdaptiveCardElement[] = [
      {
        type: 'Container',
        style: styleMap[priority] || 'default',
        items: [
          {
            type: 'TextBlock',
            text: `${emojiMap[priority]} ${title}`,
            size: 'large',
            weight: 'bolder',
            wrap: true,
          },
          {
            type: 'TextBlock',
            text: message,
            spacing: 'medium',
            wrap: true,
          },
        ],
      },
    ];

    const facts: { title: string; value: string }[] = [];
    if (source) facts.push({ title: 'Source', value: source });
    facts.push({
      title: 'Triggered at',
      value: new Date().toISOString(),
    });
    body.push({ type: 'FactSet', facts });

    if (resolutionSteps?.length) {
      body.push({
        type: 'TextBlock',
        text: '**Resolution Steps**',
        spacing: 'medium',
        separator: true,
        weight: 'bolder',
      });
      body.push({
        type: 'TextBlock',
        text: resolutionSteps.map((s, i) => `${i + 1}. ${s}`).join('\n'),
        wrap: true,
      });
    }

    return {
      type: 'AdaptiveCard',
      version: '1.4',
      body,
      fallbackText: `[${priority.toUpperCase()}] ${title}`,
      msteams: { width: 'Full' },
    };
  }

  // ── Variable substitution for custom templates ─────────────────────────────

  renderTemplate(template: any, context: Record<string, any>): any {
    if (template === null || template === undefined) return template;
    if (typeof template === 'string') {
      return this.substitute(template, context);
    }
    if (typeof template !== 'object') return template;
    if (Array.isArray(template)) {
      return template.map(item => this.renderTemplate(item, context));
    }
    const out: Record<string, any> = {};
    for (const [key, val] of Object.entries(template)) {
      out[key] = this.renderTemplate(val, context);
    }
    return out;
  }

  substitute(input: string, context: Record<string, any>): string {
    // Support: {{variable}}, {{nested.field}}, {{#each items}}...{{/each}} (simple)
    let result = input;

    // Simple {{each}} with no nesting
    const eachRe = /\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g;
    result = result.replace(eachRe, (_m, arrName: string, body: string) => {
      const arr = (context as any)[arrName];
      if (!Array.isArray(arr)) return '';
      return arr
        .map((item: any) => this.substitute(body, { ...context, item, this: item }))
        .join('');
    });

    // Variable substitution with nested dot access
    const varRe = /\{\{\s*([\w.]+)\s*\}\}/g;
    result = result.replace(varRe, (_m, expr: string) => {
      const val = this.getByPath(context, expr);
      return val === undefined || val === null ? '' : String(val);
    });

    return result;
  }

  private getByPath(obj: any, path: string): any {
    return path.split('.').reduce((acc, key) => {
      if (acc === null || acc === undefined) return undefined;
      return acc[key];
    }, obj);
  }

  private emojiForEvent(event: string): string {
    const e = event.toLowerCase();
    if (e.includes('ticket')) return '🎫';
    if (e.includes('article') || e.includes('publish')) return '📰';
    if (e.includes('user') && (e.includes('create') || e.includes('sign'))) return '👤';
    if (e.includes('user') && (e.includes('delete') || e.includes('deactiv'))) return '⛔';
    if (e.includes('comment')) return '💬';
    if (e.includes('alert') || e.includes('critical') || e.includes('error')) return '🚨';
    if (e.includes('assign')) return '✋';
    if (e.includes('resolve')) return '✅';
    if (e.includes('close')) return '🔒';
    if (e.includes('highlight') || e.includes('story')) return '🎬';
    if (e.includes('summary') || e.includes('report')) return '📊';
    if (e.includes('notify') || e.includes('notification')) return '🔔';
    return '📣';
  }
}
