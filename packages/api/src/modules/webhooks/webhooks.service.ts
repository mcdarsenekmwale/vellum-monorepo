import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class WebhooksService {
  constructor(private prisma: PrismaService, private configService: ConfigService) {}

  async handleContentWebhook(body: any, apiKey: string) {
    const apiKeyRecord = await this.prisma.apiKey.findUnique({
      where: { key: apiKey },
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
        webhookId: 'system-content-webhook',
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
    const category = await this.prisma.category.findFirst({
      where: { name: data.category },
    });

    const slug = data.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 100);

    return this.prisma.article.create({
      data: {
        slug,
        title: data.title,
        excerpt: data.excerpt,
        body: data.body || [],
        cover: data.cover,
        readMinutes: data.readMinutes || 5,
        categoryId: category?.id || 'default',
        authorId,
        isPublished: true,
        publishedAt: new Date(),
      },
    });
  }

  private async createHighlightFromWebhook(data: any, authorId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: authorId } });

    return this.prisma.highlight.create({
      data: {
        title: data.title,
        cover: data.cover,
        videoUrl: data.videoUrl,
        thumbnailUrl: data.thumbnailUrl,
        handle: data.handle || user.handle,
        authorId,
        description: data.description,
        music: data.music,
        aspectRatio: data.aspectRatio,
        duration: data.duration,
        isPublished: true,
        publishedAt: new Date(),
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
    const key = `sk-${Date.now()}-${Math.random().toString(36).substr(2, 24)}`;

    return this.prisma.apiKey.create({
      data: {
        name,
        key,
        userId,
        scopes,
      },
    });
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