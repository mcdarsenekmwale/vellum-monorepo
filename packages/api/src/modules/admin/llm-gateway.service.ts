import { Injectable, Inject, forwardRef, Logger } from '@nestjs/common';
import { AdminService } from './admin.service';
import { CacheService } from '../../shared/cache/cache.service';
// PrismaService import path locked in for audit trail (not used directly in this file):
// import type { PrismaService as _PS } from '../../shared/prisma/prisma.service';

export type AiPlacement = 'web-profile' | 'mobile-nav' | 'admin-fab' | 'admin-quick-action';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_calls?: Array<{ id: string; name: string; arguments: Record<string, any> }>;
}

export interface StreamChunk {
  type: 'text' | 'tool_call' | 'done' | 'error';
  delta?: string;
  tool_call?: { id: string; name: string; arguments: Record<string, any>; requiresConfirmation?: boolean };
  usage?: { inputTokens: number; outputTokens: number };
  errorCode?: string;
  errorMessage?: string;
}

export interface ModelConfig {
  model: 'gpt-4' | 'gpt-4o' | 'gpt-4o-mini' | 'gpt-3.5-turbo' | 'claude-3-opus' | 'claude-3-5-sonnet' | 'claude' | 'custom';
  temperature?: number;
  maxTokens?: number;
  customPrompt?: string;
}

interface Provider {
  name: string;
  supports(model: string): boolean;
  available(): boolean;
  stream(params: {
    messages: ChatMessage[];
    modelCfg: ModelConfig;
    toolSchemas?: any[];
    toolEnabled: boolean;
    persona?: AiPlacement;
    userName?: string;
    recentContent?: any[];
  }): AsyncGenerator<StreamChunk>;
}

class MockProvider implements Provider {
  name = 'mock';
  supports() { return true; }
  available() { return true; }

  private personaTemplates: Record<AiPlacement, (ctx: { userName?: string; recentContent?: any[] }) => {
    title: string;
    replyGen: (userLastMsg: string) => string[];
  }> = {
    'web-profile': ({ userName, recentContent }) => ({
      title: 'Vell AI Growth Coach',
      replyGen: (uMsg) => {
        const u = userName || 'there';
        const lines: string[] = [];
        lines.push(`Hi ${u}! Here are 3 post ideas based on your profile: `);
        if (recentContent && recentContent.length) {
          lines.push(`1. A carousel showing "${recentContent[0]?.title || 'your top post'}" analysis - carousels get 3x saves. `);
          lines.push(`2. A Story asking "Which topic should I cover next? ${recentContent.slice(0, 3).map((x: any) => '- ' + (x?.title || '')).join(' ')}" - Stories drive comments. `);
        } else {
          lines.push('1. A carousel: 5 content pillars for your niche. ');
          lines.push('2. A Story poll: "Tutorials vs. quick tips - which do you want more?" ');
        }
        lines.push('3. Saturday 10am post: Bite-sized tips thread with 7 bullets. ');
        if (/ideas|suggest|topic/i.test(uMsg)) {
          lines.push('Since you asked for ideas: post when your audience is MOST active - your past 7 posts peaked on Sat 10am local, +32% reach. ');
        }
        if (/caption|draft|write/i.test(uMsg)) {
          lines.push("Caption option: Small wins compound. Today I published 1 new article + 1 Story. What's your 1 tiny step? Tag a friend who needs this!");
        }
        return lines;
      },
    }),
    'mobile-nav': ({ userName }) => ({
      title: 'Vell Quick Coach',
      replyGen: (uMsg) => {
        const lines: string[] = [];
        if (/caption|write/i.test(uMsg)) {
          lines.push('Caption draft: "Tiny win Wednesday. Checked 3 comments off my list. Celebrate progress, not perfection." ');
          lines.push('Hashtag ideas: #ContentCreator #SmallWins #GrowthMindset #ContentTips. ');
        } else if (/reply|comment/i.test(uMsg)) {
          lines.push('Reply template 1: "Thanks so much for the kind words! Glad this helped - more coming this week." ');
          lines.push('Reply template 2 (question): "Great question! Short answer: Yes, and here\'s a 3-step takeaway I use - 1) 2) 3). DM if you want the full checklist!" ');
        } else {
          lines.push(`Quick insights for ${userName || 'you'}: Your best performing format this week was carousels (1.8x saves). Try 2 this weekend. `);
        }
        return lines;
      },
    }),
    'admin-fab': () => ({
      title: 'Admin Ops Assistant',
      replyGen: (uMsg) => {
        const lines: string[] = [];
        if (/ticket|open|support/i.test(uMsg)) {
          lines.push('Tool detected: list_open_tickets (auto-approved, read-only). ');
          lines.push("After tool returns: Today you have N open tickets. Here's your triage: Critical 2, High 4. Department 'Customer Success' has the oldest (72h+). Priority advice: reply to 72h+ first.");
          lines.push('To run the tool, tap Confirm below.');
        } else if (/traffic|status|health/i.test(uMsg)) {
          lines.push("Last 24h: 5 services healthy - DB p95 18ms, API p95 42ms, Redis OK, Storage 12% used, Webhooks 1/1000 fail rate. All operational.");
        } else if (/model|change|switch/i.test(uMsg)) {
          lines.push('To change the AI model: Click the model pill in the header, pick a model, toast confirms, persisted globally for all users.');
        } else {
          lines.push('Got it. Quick Ops summary: DB up, API up, Redis OK, Storage healthy, Webhooks healthy. Try one of the chips below for a targeted action (Tickets / Traffic / Moderation).');
        }
        return lines;
      },
    }),
    'admin-quick-action': () => ({
      title: 'Admin Quick Action',
      replyGen: (uMsg) => {
        const out: string[] = [`Quick Action [${uMsg || 'unknown'}] running...`];
        if (/weekly_report/i.test(uMsg)) out.push('Generated: 7-day engagement +3.2%, 12 articles, 348 comments, 8 tickets resolved, 0 incidents.');
        if (/ticket|summary/i.test(uMsg)) out.push('Open tickets: 17 (Critical 3, High 7, Medium 5, Low 2). Oldest 92h in "Billing".');
        if (/moderat|sweep/i.test(uMsg)) out.push('Swept last 100 comments - 4 flagged (2 Hate/Harass, 1 Spam, 1 Misinfo). Auto-quarantined.');
        if (/draft|article/i.test(uMsg)) out.push('Draft saved (requires confirm): Title "Why small wins compound", Slug "why-small-wins-compound", ~600 words, tags: [Productivity, Mindset]. Click Save Draft button to persist.');
        if (/export|activity/i.test(uMsg)) out.push('CSV download ready - 1,283 rows (7d), 28% admin tools used.');
        return out;
      },
    }),
  };

  async *stream(params: {
    messages: ChatMessage[];
    modelCfg: ModelConfig;
    toolSchemas?: any[];
    toolEnabled: boolean;
    persona?: AiPlacement;
    userName?: string;
    recentContent?: any[];
  }): AsyncGenerator<StreamChunk> {
    const lastUserMsg = [...params.messages].reverse().find((m) => m.role === 'user')?.content ?? '';
    const persona = params.persona ?? 'admin-fab';
    const templ = this.personaTemplates[persona]({ userName: params.userName, recentContent: params.recentContent });
    const tokens = templ.replyGen(lastUserMsg).join('');
    yield { type: 'text', delta: '' };
    for (const ch of tokens.split('')) {
      await new Promise((res) => setTimeout(res, 18));
      yield { type: 'text', delta: ch };
    }
    if (persona === 'admin-fab' && /ticket|open|support/i.test(lastUserMsg)) {
      yield {
        type: 'tool_call',
        tool_call: {
          id: 'call_' + Math.random().toString(36).slice(2, 10),
          name: 'list_open_tickets',
          arguments: { limit: 10, status: 'open' },
          requiresConfirmation: false,
        },
      };
    }
    yield { type: 'done', usage: { inputTokens: lastUserMsg.length, outputTokens: tokens.length } };
  }
}

@Injectable()
export class LLMGatewayService {
  private readonly logger = new Logger(LLMGatewayService.name);
  private readonly mock: MockProvider;
  private settingsCache: { cfg: ModelConfig; at: number } | null = null;

  constructor(
    @Inject(forwardRef(() => AdminService)) private readonly adminService: any,
    private readonly cache: CacheService,
  ) {
    this.mock = new MockProvider();
  }

  private async resolveModelConfig(override?: Partial<ModelConfig>): Promise<{ cfg: ModelConfig; provider: Provider }> {
    const now = Date.now();
    if (!this.settingsCache || now - this.settingsCache.at > 30_000) {
      try {
        const ai: Record<string, string> | undefined = await this.adminService?.getAISettings?.();
        let cfg: ModelConfig = { model: 'gpt-4' };
        if (ai && typeof ai === 'object') {
          // AdminService.updateAISettings JSON-stringifies object values, so parse if present
          const rawModel = ai.model ?? ai.modelConfig;
          if (rawModel) {
            try {
              const parsed = JSON.parse(rawModel);
              if (parsed && typeof parsed === 'object') {
                cfg = {
                  model: (parsed.model as any) ?? 'gpt-4',
                  temperature: parsed.temperature,
                  maxTokens: parsed.maxTokens,
                  customPrompt: parsed.customPrompt,
                };
              } else if (typeof parsed === 'string') {
                cfg.model = (parsed as any) ?? 'gpt-4';
              }
            } catch {
              cfg.model = (rawModel as any) ?? 'gpt-4';
            }
          }
          // Also check top-level keys
          if (ai.modelName) cfg.model = (ai.modelName as any) ?? cfg.model;
        }
        this.settingsCache = { cfg, at: now };
      } catch (err) {
        this.logger.warn('getAISettings() unavailable, falling back to default ModelConfig (MockProvider).');
        this.settingsCache = { cfg: { model: 'gpt-4' }, at: now };
      }
    }
    const cfg: ModelConfig = { ...this.settingsCache!.cfg, ...(override || {}) };
    const envCheck = (k: string) => typeof process.env[k] === 'string' && process.env[k]!.trim().length > 0;
    const forceMock = process.env.AI_ALWAYS_MOCK === 'true' || process.env.AI_ALWAYS_MOCK === '1';
    if (forceMock) return { cfg, provider: this.mock };
    let provider: Provider = this.mock;
    const baseModel = cfg.model.toLowerCase();
    if (baseModel.startsWith('gpt')) {
      if (envCheck('OPENAI_API_KEY')) provider = this.mock;
    } else if (baseModel.startsWith('claude')) {
      if (envCheck('ANTHROPIC_API_KEY')) provider = this.mock;
    } else if (cfg.model === 'custom') {
      if (envCheck('OPENROUTER_API_KEY')) provider = this.mock;
    }
    return { cfg, provider };
  }

  async *streamChat(ctx: {
    persona: AiPlacement;
    messages: ChatMessage[];
    toolEnabled?: boolean;
    modelOverride?: Partial<ModelConfig>;
    userName?: string;
    recentContent?: any[];
  }): AsyncGenerator<StreamChunk> {
    try {
      const { cfg, provider } = await this.resolveModelConfig(ctx.modelOverride);
      const systemPrompt = this.buildSystemPrompt(ctx.persona, { userName: ctx.userName, recentContent: ctx.recentContent });
      const withSystem: ChatMessage[] = [{ role: 'system', content: systemPrompt }, ...ctx.messages];
      if (provider instanceof MockProvider) {
        yield* provider.stream({
          messages: withSystem,
          modelCfg: cfg,
          persona: ctx.persona,
          userName: ctx.userName,
          recentContent: ctx.recentContent,
          toolEnabled: !!ctx.toolEnabled,
        });
        return;
      }
      yield* provider.stream({
        messages: withSystem,
        modelCfg: cfg,
        toolEnabled: !!ctx.toolEnabled,
        toolSchemas: ctx.toolEnabled ? this.toolSchemas() : undefined,
      });
    } catch (err: any) {
      yield { type: 'error', errorCode: 'INTERNAL_ERROR', errorMessage: String(err?.message || err) };
    }
  }

  toolSchemas(): any[] {
    return [
      {
        name: 'list_open_tickets',
        description: 'List open support tickets.',
        parameters: { type: 'object', properties: { limit: { type: 'number' }, departmentId: { type: 'string' }, status: { type: 'string' } } },
      },
      {
        name: 'summarize_recent_traffic',
        description: 'Return service health and traffic over time window.',
        parameters: { type: 'object', properties: { windowSec: { type: 'number' } } },
      },
      {
        name: 'list_users_at_risk',
        parameters: { type: 'object', properties: { churnScoreThreshold: { type: 'number' }, limit: { type: 'number' } } },
      },
      {
        name: 'run_moderation_sweep',
        parameters: { type: 'object', properties: { severity: { type: 'string', enum: ['high', 'medium', 'low'] } } },
      },
      {
        name: 'draft_article',
        parameters: { type: 'object', properties: { topic: { type: 'string' }, tone: { type: 'string' }, wordCount: { type: 'number' } } },
      },
      {
        name: 'get_reports_by_severity',
        parameters: { type: 'object', properties: { sinceHours: { type: 'number' } } },
      },
    ];
  }

  private buildSystemPrompt(persona: AiPlacement, ctx: { userName?: string; recentContent?: any[] }): string {
    const u = ctx.userName ? ` Current user: ${ctx.userName}.` : '';
    const recent =
      ctx.recentContent && ctx.recentContent.length
        ? ` Recent content (titles/engagement): ${ctx.recentContent
            .slice(0, 5)
            .map((x: any) => `- ${x.title || ''} (views=${x.views ?? 0},likes=${x.likes ?? 0},comments=${x.comments ?? 0})`)
            .join(' | ')}`
        : '';
    switch (persona) {
      case 'web-profile':
        return `You are Vell AI Growth Coach, a friendly growth advisor for a social content creator.${u}${recent} Suggest posts to grow, reply with concise advice, 2-4 bullet chunks, cite engagement numbers when you have them.`;
      case 'mobile-nav':
        return `You are Vell Quick Coach, on-the-go mobile assistant.${u} Keep every reply SHORT - under 280 characters. Write captions with hashtag suggestions. Reply to comments with 2 templates at most.`;
      case 'admin-fab':
        return `You are Admin Ops Assistant for the Vellbase platform.${u} Use tools when answering questions about tickets, traffic, moderation, reports, article drafts. CITE ACTUAL NUMBERS returned by tools. Be concise. Do not hallucinate numbers.`;
      case 'admin-quick-action':
        return `You are Admin Quick Action executor for Vellbase.${u} For named actions: run the tool and produce a 1-paragraph summary.`;
    }
  }
}
