import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class WebhooksService {
  constructor(private prisma: PrismaService, private configService: ConfigService) {}

  /** Deterministic HMAC-SHA256 hash for API keys (so we can look them up by hash). */
  private hashApiKey(rawKey: string): string {
    const secret = this.configService.get('API_KEY_SECRET') || this.configService.get('JWT_SECRET') || 'vellum-dev-secret-change-me';
    return crypto.createHmac('sha256', secret).update(rawKey).digest('hex');
  }

  async handleContentWebhook(body: any, apiKey: string) {
    if (!apiKey) {
      throw new UnauthorizedException('API key is required');
    }

    // Hash incoming key before lookup (DB stores hashes, not raw keys)
    const keyHash = this.hashApiKey(apiKey);
    const apiKeyRecord = await this.prisma.apiKey.findUnique({
      where: { key: keyHash },
      include: { user: true },
    });

    if (!apiKeyRecord || !apiKeyRecord.isActive) {
      throw new UnauthorizedException('Invalid API key');
    }

    if (!apiKeyRecord.scopes.includes('content:create')) {
      throw new UnauthorizedException('Insufficient permissions');
    }

    const event = body.event;
    const data = body.data;

    await this.prisma.webhookLog.create({
      data: {
        webhookId: null,
        event,
        payload: body,
      },
    });

    switch (event) {
      case 'article.create':
        return this.createArticleFromWebhook(data, apiKeyRecord.userId);
      case 'highlight.create':
        return this.createHighlightFromWebhook(data, apiKeyRecord.userId);
      case 'article.update':
        return this.updateArticleFromWebhook(data);
      case 'article.delete':
        return this.deleteArticleFromWebhook(data);
      default:
        throw new BadRequestException('Unknown event type');
    }
  }

  private async createArticleFromWebhook(data: any, authorId: string) {
    let category = await this.prisma.category.findFirst({
      where: {
        OR: [
          { name: data.category },
          { slug: data.category?.toLowerCase().replace(/[^a-z0-9]+/g, '-') },
        ],
      },
    });

    if (!category && data.category) {
      const slug = data.category
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 50);
      try {
        category = await this.prisma.category.create({
          data: {
            name: data.category,
            slug,
            tint: '#6366f1',
          },
        });
      } catch {
        category = await this.prisma.category.findFirst({ take: 1 });
      }
    }

    if (!category) {
      category = await this.prisma.category.findFirst({ take: 1 });
    }

    const slug = data.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 100);

    return this.prisma.article.create({
      data: {
        slug,
        title: data.title,
        excerpt: data.excerpt || '',
        body: data.body || [],
        cover: data.cover,
        readMinutes: data.readMinutes || 5,
        categoryId: category?.id || (await this.ensureDefaultCategory()).id,
        authorId,
        isPublished: data.isPublished !== false,
        publishedAt: data.isPublished !== false ? new Date() : null,
        featured: data.featured || false,
      },
    });
  }

  private async ensureDefaultCategory() {
    let category = await this.prisma.category.findFirst({
      where: { slug: 'uncategorized' },
    });
    if (!category) {
      category = await this.prisma.category.create({
        data: {
          name: 'Uncategorized',
          slug: 'uncategorized',
          tint: '#9ca3af',
        },
      });
    }
    return category;
  }

  private async createHighlightFromWebhook(data: any, authorId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: authorId } });

    let aspectRatio: number | undefined = undefined;
    if (typeof data.aspectRatio === 'number') {
      aspectRatio = data.aspectRatio;
    } else if (typeof data.aspectRatio === 'string' && data.aspectRatio.includes(':')) {
      const [w, h] = data.aspectRatio.split(':').map(Number);
      if (!isNaN(w) && !isNaN(h) && h > 0) {
        aspectRatio = w / h;
      }
    }

    return this.prisma.highlight.create({
      data: {
        title: data.title,
        cover: data.cover,
        videoUrl: data.videoUrl,
        thumbnailUrl: data.thumbnailUrl,
        handle: data.handle || user?.handle || 'unknown',
        authorId,
        description: data.description,
        music: data.music,
        aspectRatio,
        duration: data.duration ? Number(data.duration) : null,
        isPublished: data.isPublished !== false,
        publishedAt: data.isPublished !== false ? new Date() : null,
      },
    });
  }

  private async updateArticleFromWebhook(data: any) {
    return this.prisma.article.update({
      where: { slug: data.slug },
      data: {
        title: data.title,
        excerpt: data.excerpt,
        body: data.body,
        cover: data.cover,
        readMinutes: data.readMinutes,
      },
    });
  }

  private async deleteArticleFromWebhook(data: any) {
    return this.prisma.article.update({
      where: { slug: data.slug },
      data: { deletedAt: new Date() },
    });
  }

  async listWebhookLogs(event?: string, limit = 50) {
    const where: any = {};
    if (event) where.event = event;

    return this.prisma.webhookLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async createApiKey(userId: string, name: string, scopes: string[]) {
    const rawKey = 'sk_' + crypto.randomBytes(24).toString('hex');
    const keyHash = this.hashApiKey(rawKey);
    const record = await this.prisma.apiKey.create({
      data: {
        name,
        key: keyHash,
        userId,
        scopes,
      },
    });
    // Return raw key ONCE (only on creation — never stored)
    return { ...record, rawKey };
  }

  async listApiKeys(userId: string) {
    return this.prisma.apiKey.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeApiKey(userId: string, keyId: string) {
    return this.prisma.apiKey.update({
      where: { id: keyId, userId },
      data: { isActive: false },
    });
  }
}