import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CacheService } from '../../shared/cache/cache.service';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { SETTINGS_DEFINITIONS, SETTINGS_VERSION, validateSettingValue, type SettingCategory } from './settings-definitions';

@Injectable()
export class AdminService {
  private settingsCache: Record<string, any[]> | null = null;
  private settingsCacheExpiry = 0;
  private readonly SETTINGS_CACHE_TTL = 60_000; // 1 minute

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private cache: CacheService,
  ) {}

  /** Strip sensitive fields before returning a user to callers. */
  private sanitizeUser(user: any) {
    const { passwordHash, resetToken, resetTokenExpiresAt, verificationToken, verificationTokenExpiresAt, ...sanitized } = user;
    return sanitized;
  }

  /** Deterministic HMAC-SHA256 hash for API keys (so we can look them up by hash). */
  private hashApiKey(rawKey: string): string {
    const secret = this.configService.get('API_KEY_SECRET') || this.configService.get('JWT_SECRET') || 'vellum-dev-secret-change-me';
    return crypto.createHmac('sha256', secret).update(rawKey).digest('hex');
  }

  // ─── Legacy Role → RBAC bidirectional sync ────────────────────────────────
  private readonly LEGACY_TO_RBAC: Record<string, string> = {
    ADMIN: 'super_admin',
    MODERATOR: 'moderator',
    CREATOR: 'author',
    USER: 'registered_user',
    GUEST: 'guest',
  };

  private async syncLegacyRoleToRbacAssignments(
    userId: string,
    legacyRole: string,
    opts?: { replacedBy?: string },
  ) {
    const targetKey = this.LEGACY_TO_RBAC[legacyRole] ?? 'registered_user';
    const targetRole = await this.prisma.rbacRole.findFirst({
      where: { key: targetKey, deletedAt: null, isActive: true },
      select: { id: true },
    });
    if (!targetRole) return;

    const legacyKeys = Object.values(this.LEGACY_TO_RBAC);
    // Remove previous legacy-mapped RBAC assignments (only the ones mapped from legacy roles)
    // so we don't accumulate. Keep custom RBAC-only roles intact.
    const existingAssignments = await this.prisma.userRoleAssignment.findMany({
      where: { userId, role: { key: { in: legacyKeys } } },
      include: { role: true },
    });
    for (const existing of existingAssignments) {
      if (existing.role.key !== targetKey) {
        await this.prisma.userRoleAssignment.deleteMany({
          where: { userId, roleId: existing.roleId },
        });
        await this.prisma.roleAssignmentHistory.create({
          data: {
            userId,
            roleId: existing.roleId,
            action: 'removed',
            reason: opts?.replacedBy ?? `sync from legacy role → ${legacyRole}`,
          },
        });
      }
    }
    // Upsert target
    const hasCurrent = existingAssignments.some((a) => a.role.key === targetKey);
    if (!hasCurrent) {
      try {
        await this.prisma.userRoleAssignment.upsert({
          where: { userId_roleId: { userId, roleId: targetRole.id } },
          create: { userId, roleId: targetRole.id, isPrimary: true },
          update: { isPrimary: true },
        });
        await this.prisma.roleAssignmentHistory.create({
          data: {
            userId,
            roleId: targetRole.id,
            action: 'assigned',
            reason: opts?.replacedBy ?? `sync from legacy role → ${legacyRole}`,
          },
        });
      } catch {
        // unique constraint race
      }
    }
    // Invalidate RBAC cache
    try {
      await this.cache.del(`rbac:permissions:${userId}`);
    } catch {
      // optional
    }
  }

  async getDashboardStats() {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [userCount, activeUsers, articleCount, highlightCount, commentCount, totalLikes, totalViews, newUsersThisWeek, newArticlesThisWeek] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.article.count({ where: { isPublished: true } }),
      this.prisma.highlight.count({ where: { isPublished: true } }),
      this.prisma.comment.count(),
      this.prisma.like.count(),
      this.prisma.article.aggregate({ _sum: { views: true } }).then(r => r._sum.views || 0),
      this.prisma.user.count({ where: { createdAt: { gte: oneWeekAgo } } }),
      this.prisma.article.count({ where: { createdAt: { gte: oneWeekAgo }, isPublished: true } }),
    ]);

    return {
      totalUsers: userCount,
      activeUsers,
      totalArticles: articleCount,
      totalHighlights: highlightCount,
      totalComments: commentCount,
      totalLikes,
      totalViews,
      newUsersThisWeek,
      newArticlesThisWeek,
    };
  }

  async listUsers(page = 1, limit = 20, except?: string) {
    const skip = (page - 1) * limit;

    const where: Record<any, any> = {};
    if (except) {
      where.NOT = { role: except as Role | undefined };
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          handle: true,
          name: true,
          avatar: true,
          bio: true,
          website: true,
          location: true,
          publication: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
        where,
      }),
      this.prisma.user.count({ where}),
    ]);

    return { data: users, total, page, pageSize: limit };
  }

  async getUserById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });
    return this.sanitizeUser(user);
  }

  async createUser(email: string, name: string, handle: string, role: Role, password: string) {
    const passwordHash = await bcrypt.hash(password, 12);
    const created = await this.prisma.user.create({
      data: {
        email,
        name,
        handle,
        role,
        passwordHash,
      },
    });
    // Sync legacy role → RBAC assignments
    await this.syncLegacyRoleToRbacAssignments(created.id, role, { replacedBy: 'admin createUser' });
    await this.prisma.userSettings.create({ data: { userId: created.id } }).catch(() => null);
    return this.sanitizeUser(created);
  }

  async updateUser(id: string, data: { name?: string; handle?: string; bio?: string; website?: string; location?: string; email?: string; role?: Role; avatar?: string; publication?: string; isActive?: boolean }) {
    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.handle !== undefined ? { handle: data.handle } : {}),
        ...(data.bio !== undefined ? { bio: data.bio } : {}),
        ...(data.website !== undefined ? { website: data.website } : {}),
        ...(data.location !== undefined ? { location: data.location } : {}),
        ...(data.email !== undefined ? { email: data.email } : {}),
        ...(data.role !== undefined ? { role: data.role } : {}),
        ...(data.avatar !== undefined ? { avatar: data.avatar } : {}),
        ...(data.publication !== undefined ? { publication: data.publication } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });
    if (data.role !== undefined) {
      await this.syncLegacyRoleToRbacAssignments(id, data.role, { replacedBy: 'admin updateUser' });
    }
    return this.sanitizeUser(updated);
  }

  async deleteUser(id: string) {
    const updated = await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return this.sanitizeUser(updated);
  }

  async updateUserRole(userId: string, role: Role) {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { role },
    });
    await this.syncLegacyRoleToRbacAssignments(userId, role, { replacedBy: 'admin updateUserRole' });
    return this.sanitizeUser(updated);
  }

  async toggleUserStatus(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: !user.isActive },
    });
    return this.sanitizeUser(updated);
  }

  async uploadAvatar(userId: string, file: Express.Multer.File) {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException('File type not allowed. Please upload a JPEG, PNG, WebP, or GIF image.');
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new BadRequestException('File too large. Maximum size is 5MB.');
    }

    const uploadsDir = path.join(process.cwd(), 'uploads', 'avatars');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const ext = file.originalname.split('.').pop() || 'png';
    const filename = `${userId}-${Date.now()}.${ext}`;
    const filePath = path.join(uploadsDir, filename);
    fs.writeFileSync(filePath, file.buffer);

    const avatarUrl = `/uploads/avatars/${filename}`;

    return this.prisma.user.update({
      where: { id: userId },
      data: { avatar: avatarUrl },
    });
  }

  async removeAvatar(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user?.avatar) {
      const oldPath = path.join(process.cwd(), user.avatar);
      if (fs.existsSync(oldPath)) {
        try {
          fs.unlinkSync(oldPath);
        } catch (e) {
        }
      }
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { avatar: null },
    });
  }

  async listArticles(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [articles, total] = await Promise.all([
      this.prisma.article.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          author: { select: { id: true, handle: true, name: true } },
        },
      }),
      this.prisma.article.count(),
    ]);

    return { data: articles, total, page, pageSize: limit };
  }

  async getArticleById(id: string) {
    return this.prisma.article.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, handle: true, name: true, email: true } },
        category: true,
      },
    });
  }

  async createArticle(data: {
    title: string;
    slug: string;
    excerpt: string;
    body: string[];
    categoryId: string;
    authorId: string;
    isPublished: boolean;
    featured: boolean;
    cover?: string;
    readMinutes: number;
  }) {
    return this.prisma.article.create({
      data: {
        title: data.title,
        slug: data.slug,
        excerpt: data.excerpt,
        body: data.body,
        categoryId: data.categoryId,
        authorId: data.authorId,
        isPublished: data.isPublished,
        featured: data.featured,
        cover: data.cover,
        readMinutes: data.readMinutes,
        ...(data.isPublished ? { publishedAt: new Date() } : {}),
      },
    });
  }

  async updateArticle(id: string, data: {
    title?: string;
    slug?: string;
    excerpt?: string;
    body?: string[];
    categoryId?: string;
    authorId?: string;
    isPublished?: boolean;
    featured?: boolean;
    cover?: string;
    readMinutes?: number;
  }) {
    return this.prisma.article.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.slug !== undefined ? { slug: data.slug } : {}),
        ...(data.excerpt !== undefined ? { excerpt: data.excerpt } : {}),
        ...(data.body !== undefined ? { body: data.body } : {}),
        ...(data.categoryId !== undefined ? { categoryId: data.categoryId } : {}),
        ...(data.authorId !== undefined ? { authorId: data.authorId } : {}),
        ...(data.isPublished !== undefined ? { isPublished: data.isPublished } : {}),
        ...(data.featured !== undefined ? { featured: data.featured } : {}),
        ...(data.cover !== undefined ? { cover: data.cover } : {}),
        ...(data.readMinutes !== undefined ? { readMinutes: data.readMinutes } : {}),
        ...(data.isPublished ? { publishedAt: new Date() } : {}),
      },
    });
  }

  async deleteArticle(articleId: string) {
    return this.prisma.article.update({
      where: { id: articleId },
      data: { deletedAt: new Date() },
    });
  }

  async listHighlights(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [highlights, total] = await Promise.all([
      this.prisma.highlight.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          author: { select: { id: true, handle: true, name: true } },
        },
      }),
      this.prisma.highlight.count(),
    ]);

    return { data: highlights, total, page, pageSize: limit };
  }

  async getHighlightById(id: string) {
    return this.prisma.highlight.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, handle: true, name: true, email: true } },
      },
    });
  }

  async createHighlight(data: {
    title: string;
    handle: string;
    description?: string;
    cover?: string;
    videoUrl?: string;
    thumbnailUrl?: string;
    authorId?: string;
    isPublished: boolean;
    aspectRatio?: number;
    duration?: number;
  }) {
    return this.prisma.highlight.create({
      data: {
        title: data.title,
        handle: data.handle,
        description: data.description,
        cover: data.cover,
        videoUrl: data.videoUrl,
        thumbnailUrl: data.thumbnailUrl,
        authorId: data.authorId,
        isPublished: data.isPublished,
        aspectRatio: data.aspectRatio,
        duration: data.duration,
        ...(data.isPublished ? { publishedAt: new Date() } : {}),
      },
    });
  }

  async updateHighlight(id: string, data: {
    title?: string;
    handle?: string;
    description?: string;
    cover?: string;
    videoUrl?: string;
    thumbnailUrl?: string;
    authorId?: string;
    isPublished?: boolean;
    aspectRatio?: number;
    duration?: number;
  }) {
    return this.prisma.highlight.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.handle !== undefined ? { handle: data.handle } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.cover !== undefined ? { cover: data.cover } : {}),
        ...(data.videoUrl !== undefined ? { videoUrl: data.videoUrl } : {}),
        ...(data.thumbnailUrl !== undefined ? { thumbnailUrl: data.thumbnailUrl } : {}),
        ...(data.authorId !== undefined ? { authorId: data.authorId } : {}),
        ...(data.isPublished !== undefined ? { isPublished: data.isPublished } : {}),
        ...(data.aspectRatio !== undefined ? { aspectRatio: data.aspectRatio } : {}),
        ...(data.duration !== undefined ? { duration: data.duration } : {}),
        ...(data.isPublished ? { publishedAt: new Date() } : {}),
      },
    });
  }

  async deleteHighlight(id: string) {
    return this.prisma.highlight.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async listComments(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [comments, total] = await Promise.all([
      this.prisma.comment.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          author: { select: { id: true, handle: true, name: true } },
        },
      }),
      this.prisma.comment.count(),
    ]);

    return { data: comments, total, page, pageSize: limit };
  }

  async deleteComment(id: string) {
    return this.prisma.comment.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async listMedia(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [media, total] = await Promise.all([
      this.prisma.media.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          uploader: { select: { id: true, handle: true, name: true, email: true } },
        },
      }),
      this.prisma.media.count(),
    ]);

    return { data: media, total, page, pageSize: limit };
  }

  async deleteMedia(id: string) {
    return this.prisma.media.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async listAllNotifications(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, handle: true, name: true, email: true } },
        },
      }),
      this.prisma.notification.count(),
    ]);

    const actorIds = [...new Set(notifications.map(n => n.actorId).filter(Boolean))] as string[];
    const actors = actorIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, handle: true, name: true },
        })
      : [];
    const actorMap = new Map(actors.map(a => [a.id, a]));

    const data = notifications.map(n => ({
      ...n,
      actor: n.actorId ? actorMap.get(n.actorId) : null,
    }));

    return { data, total, page, pageSize: limit };
  }

  async markNotificationRead(id: string) {
    return this.prisma.notification.update({
      where: { id },
      data: { read: true, readAt: new Date() },
    });
  }

  async markAllNotificationsRead() {
    const result = await this.prisma.notification.updateMany({
      where: { read: false },
      data: { read: true },
    });
    return { message: `${result.count} notifications marked as read` };
  }

  async deleteNotification(id: string) {
    return this.prisma.notification.delete({ where: { id } });
  }

  async createNotification(data: { userId: string; kind: string; body: string; title?: string }) {
    const notification = await this.prisma.notification.create({
      data: {
        userId: data.userId,
        kind: data.kind as any,
        body: data.body,
        metadata: data.title ? { title: data.title } : undefined,
      },
      include: {
        user: { select: { id: true, handle: true, name: true, email: true } },
      },
    });
    return notification;
  }

  async listFollows(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [follows, total] = await Promise.all([
      this.prisma.follow.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          follower: { select: { id: true, handle: true, name: true } },
          following: { select: { id: true, handle: true, name: true } },
        },
      }),
      this.prisma.follow.count(),
    ]);

    return { data: follows, total, page, pageSize: limit };
  }

  async listCategories() {
    return this.prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { articles: true } },
      },
    });
  }

  async createCategory(name: string, slug: string, tint: string) {
    return this.prisma.category.create({
      data: { name, slug, tint },
    });
  }

  async updateCategory(id: string, data: { name?: string; slug?: string; tint?: string }) {
    return this.prisma.category.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.slug !== undefined ? { slug: data.slug } : {}),
        ...(data.tint !== undefined ? { tint: data.tint } : {}),
      },
    });
  }

  async deleteCategory(id: string) {
    return this.prisma.category.delete({
      where: { id },
    });
  }

  async listWebhooks() {
    return this.prisma.webhook.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        webhookLogs: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });
  }

  async createWebhook(name: string, url: string, events: string[], isActive: boolean) {
    const secret = crypto.randomBytes(32).toString('hex');
    return this.prisma.webhook.create({
      data: {
        name,
        url,
        events,
        isActive,
        secret,
      },
    });
  }

  async updateWebhook(id: string, data: { name?: string; url?: string; events?: string[]; isActive?: boolean }) {
    return this.prisma.webhook.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.url !== undefined ? { url: data.url } : {}),
        ...(data.events !== undefined ? { events: data.events } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });
  }

  async deleteWebhook(id: string) {
    return this.prisma.webhook.delete({
      where: { id },
    });
  }

  async listApiKeys() {
    return this.prisma.apiKey.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, handle: true, name: true, email: true } },
      },
    });
  }

  async createApiKey(name: string, scopes: string[], userId?: string, expiresAt?: Date) {
    const rawKey = 'sk_' + crypto.randomBytes(24).toString('hex');
    const keyHash = this.hashApiKey(rawKey);
    const record = await this.prisma.apiKey.create({
      data: {
        name,
        key: keyHash,
        scopes,
        userId: userId || null,
        expiresAt: expiresAt || null,
      },
      include: {
        user: { select: { id: true, handle: true, name: true, email: true } },
      },
    });
    // Return raw key ONCE (only on creation — never stored)
    return { ...record, rawKey };
  }

  async deleteApiKey(id: string) {
    return this.prisma.apiKey.delete({
      where: { id },
    });
  }

  async listReports(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [reports, total] = await Promise.all([
      this.prisma.report.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          reporter: { select: { id: true, handle: true, name: true, email: true } },
        },
      }),
      this.prisma.report.count(),
    ]);

    return { data: reports, total, page, pageSize: limit };
  }

  async updateReportStatus(id: string, status: string, resolvedById?: string) {
    const isResolved = status === 'resolved' || status === 'dismissed';
    return this.prisma.report.update({
      where: { id },
      data: {
        status,
        ...(isResolved
          ? {
              resolvedById: resolvedById || null,
              resolvedAt: new Date(),
            }
          : {}),
      },
      include: {
        reporter: { select: { id: true, handle: true, name: true, email: true } },
      },
    });
  }

  async getAnalyticsOverview() {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      totalArticles,
      totalHighlights,
      totalComments,
      totalLikes,
      totalFollows,
      totalBookmarks,
      totalArticleViews,
      newUsersToday,
      newArticlesToday,
      newCommentsToday,
      dailyActiveUsers,
      weeklyActiveUsers,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.article.count({ where: { isPublished: true } }),
      this.prisma.highlight.count({ where: { isPublished: true } }),
      this.prisma.comment.count(),
      this.prisma.like.count(),
      this.prisma.follow.count(),
      this.prisma.bookmark.count(),
      this.prisma.article.aggregate({ _sum: { views: true } }).then(r => r._sum.views || 0),
      this.prisma.user.count({ where: { createdAt: { gte: oneDayAgo } } }),
      this.prisma.article.count({ where: { createdAt: { gte: oneDayAgo }, isPublished: true } }),
      this.prisma.comment.count({ where: { createdAt: { gte: oneDayAgo } } }),
      this.prisma.session.findMany({
        where: { createdAt: { gte: oneDayAgo } },
        select: { userId: true },
        distinct: ['userId'],
      }).then(rows => rows.length),
      this.prisma.session.findMany({
        where: { createdAt: { gte: oneWeekAgo } },
        select: { userId: true },
        distinct: ['userId'],
      }).then(rows => rows.length),
    ]);

    return {
      content: {
        totalArticles,
        totalHighlights,
        totalComments,
        newArticlesToday,
        newCommentsToday,
      },
      engagement: {
        totalLikes,
        totalFollows,
        totalBookmarks,
        totalArticleViews,
        avgViewsPerArticle: totalArticles > 0 ? Math.round(totalArticleViews / totalArticles) : 0,
      },
      users: {
        totalUsers,
        newUsersToday,
        dailyActiveUsers,
        weeklyActiveUsers,
      },
    };
  }

  async getAnalyticsTimeseries(days = 30) {
    const now = new Date();
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const [users, articles, highlights, comments] = await Promise.all([
      this.prisma.user.findMany({
        where: { createdAt: { gte: startDate } },
        select: { createdAt: true },
      }),
      this.prisma.article.findMany({
        where: { createdAt: { gte: startDate } },
        select: { createdAt: true },
      }),
      this.prisma.highlight.findMany({
        where: { createdAt: { gte: startDate } },
        select: { createdAt: true },
      }),
      this.prisma.comment.findMany({
        where: { createdAt: { gte: startDate } },
        select: { createdAt: true },
      }),
    ]);

    const buckets: Record<string, { users: number; articles: number; highlights: number; comments: number }> = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      buckets[key] = { users: 0, articles: 0, highlights: 0, comments: 0 };
    }

    const tally = (rows: { createdAt: Date }[], field: 'users' | 'articles' | 'highlights' | 'comments') => {
      for (const row of rows) {
        const key = row.createdAt.toISOString().slice(0, 10);
        if (buckets[key]) {
          buckets[key][field] += 1;
        }
      }
    };
    tally(users, 'users');
    tally(articles, 'articles');
    tally(highlights, 'highlights');
    tally(comments, 'comments');

    return Object.entries(buckets).map(([date, counts]) => ({ date, ...counts }));
  }

  async getTrafficSources() {
    const [articleByCategory, totalArticleViews, highlightEngagement] = await Promise.all([
      this.prisma.article.groupBy({
        by: ['categoryId'],
        _sum: { views: true },
        _count: { _all: true },
      }),
      this.prisma.article.aggregate({ _sum: { views: true } }).then(r => r._sum.views || 0),
      this.prisma.highlight.aggregate({
        _sum: { likesCount: true, commentsCount: true, shares: true },
      }),
    ]);

    const categoryIds = articleByCategory.map(row => row.categoryId);
    const categories = categoryIds.length
      ? await this.prisma.category.findMany({ where: { id: { in: categoryIds } } })
      : [];
    const categoryMap = new Map(categories.map(c => [c.id, c.name]));

    const sources = articleByCategory.map(row => ({
      name: categoryMap.get(row.categoryId) || 'Unknown',
      views: row._sum.views || 0,
      count: row._count._all,
    }));

    const highlightViews = (highlightEngagement._sum.likesCount || 0)
      + (highlightEngagement._sum.commentsCount || 0)
      + (highlightEngagement._sum.shares || 0);

    return {
      sources,
      totalArticleViews,
      highlightEngagement: highlightViews,
      totalViews: totalArticleViews + highlightViews,
    };
  }

  async listTags() {
    return this.prisma.tag.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async createTag(name: string, slug: string) {
    return this.prisma.tag.create({
      data: { name, slug },
    });
  }

  async updateTag(id: string, name: string, slug: string) {
    return this.prisma.tag.update({
      where: { id },
      data: { name, slug },
    });
  }

  async deleteTag(id: string) {
    return this.prisma.tag.delete({
      where: { id },
    });
  }

  async listFeatureFlags() {
    return this.prisma.featureFlag.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async createFeatureFlag(key: string, description: string, enabled: boolean, rollout: number) {
    return this.prisma.featureFlag.create({
      data: { key, description, enabled, rollout },
    });
  }

  async updateFeatureFlag(id: string, data: { enabled?: boolean; rollout?: number }) {
    return this.prisma.featureFlag.update({
      where: { id },
      data: {
        ...(data.enabled !== undefined ? { enabled: data.enabled } : {}),
        ...(data.rollout !== undefined ? { rollout: data.rollout } : {}),
      },
    });
  }

  async deleteFeatureFlag(id: string) {
    return this.prisma.featureFlag.delete({
      where: { id },
    });
  }

  async listSystemSettings() {
    const now = Date.now();
    if (this.settingsCache && now < this.settingsCacheExpiry) {
      return this.settingsCache;
    }

    const settings = await this.prisma.systemSetting.findMany({
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });

    const grouped: Record<string, typeof settings> = {};
    for (const setting of settings) {
      if (!grouped[setting.category]) {
        grouped[setting.category] = [];
      }
      grouped[setting.category].push(setting);
    }

    this.settingsCache = grouped;
    this.settingsCacheExpiry = now + this.SETTINGS_CACHE_TTL;
    return grouped;
  }

  async updateSystemSetting(key: string, value: string, category?: string) {
    const validation = validateSettingValue(key, value);
    if (!validation.valid) {
      throw new Error(`Invalid value for ${key}: ${validation.error}`);
    }

    const result = await this.prisma.systemSetting.upsert({
      where: { key },
      update: { value, ...(category ? { category } : {}) },
      create: {
        key,
        value,
        category: category || 'general',
        version: SETTINGS_VERSION,
      },
    });

    this.settingsCache = null;
    return result;
  }

  async getStorageStats() {
    const [totalAgg, byType, totalCount] = await Promise.all([
      this.prisma.media.aggregate({ _sum: { size: true } }),
      this.prisma.media.groupBy({
        by: ['type'],
        _count: { _all: true },
        _sum: { size: true },
      }),
      this.prisma.media.count(),
    ]);

    return {
      totalSize: totalAgg._sum.size || 0,
      totalCount,
      byType: byType.map(row => ({
        type: row.type,
        count: row._count._all,
        size: row._sum.size || 0,
      })),
    };
  }

  async getSystemStatus() {
    let database = 'ok';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      database = 'error';
    }

    const [activeUsers, totalArticles, totalHighlights, totalComments, totalMedia, pendingJobs, openReports, activeSessions] = await Promise.all([
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.article.count(),
      this.prisma.highlight.count(),
      this.prisma.comment.count(),
      this.prisma.media.count(),
      this.prisma.backgroundJob.count({ where: { status: { in: ['pending', 'running', 'retry'] } } }),
      this.prisma.report.count({ where: { status: 'open' } }),
      this.prisma.session.count({ where: { expiresAt: { gt: new Date() } } }),
    ]);

    return {
      database,
      timestamp: new Date().toISOString(),
      counts: {
        activeUsers,
        totalArticles,
        totalHighlights,
        totalComments,
        totalMedia,
        pendingJobs,
        openReports,
        activeSessions,
      },
    };
  }

  async deleteWorkspace() {
    await this.prisma.$transaction([
      this.prisma.comment.deleteMany(),
      this.prisma.highlight.deleteMany(),
      this.prisma.article.deleteMany(),
      this.prisma.media.deleteMany(),
      this.prisma.report.deleteMany(),
      this.prisma.backgroundJob.deleteMany(),
      this.prisma.session.deleteMany(),
      this.prisma.supportTicket.deleteMany(),
      this.prisma.helpArticle.deleteMany(),
      this.prisma.systemSetting.deleteMany(),
      this.prisma.refreshToken.deleteMany(),
      this.prisma.user.deleteMany(),
    ]);
    return { success: true, message: 'Workspace deleted successfully' };
  }

  async resetSettings() {
    await this.prisma.systemSetting.deleteMany();

    // Re-seed all default settings
    for (const def of SETTINGS_DEFINITIONS) {
      await this.prisma.systemSetting.create({
        data: {
          key: def.key,
          value: def.value,
          category: def.category,
          description: def.description,
          version: SETTINGS_VERSION,
        },
      });
    }

    this.settingsCache = null;
    return { success: true, message: `Settings reset to ${SETTINGS_DEFINITIONS.length} defaults` };
  }

  async seedSettings() {
    const existingCount = await this.prisma.systemSetting.count();
    if (existingCount > 0) {
      return { message: `${existingCount} settings already exist, skipping seed`, seeded: 0 };
    }

    for (const def of SETTINGS_DEFINITIONS) {
      await this.prisma.systemSetting.create({
        data: {
          key: def.key,
          value: def.value,
          category: def.category,
          description: def.description,
          version: SETTINGS_VERSION,
        },
      });
    }

    this.settingsCache = null;
    return { message: `Seeded ${SETTINGS_DEFINITIONS.length} system settings`, seeded: SETTINGS_DEFINITIONS.length };
  }

  async getSettingByKey(key: string) {
    return this.prisma.systemSetting.findUnique({ where: { key } });
  }

  async listJobs(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [jobs, total] = await Promise.all([
      this.prisma.backgroundJob.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.backgroundJob.count(),
    ]);

    return { data: jobs, total, page, pageSize: limit };
  }

  async listAdvertisements(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [ads, total] = await Promise.all([
      this.prisma.advertisement.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.advertisement.count(),
    ]);

    return { data: ads, total, page, pageSize: limit };
  }

  async createAdvertisement(data: { name: string; status: string; startsAt?: Date; endsAt?: Date }) {
    return this.prisma.advertisement.create({
      data: {
        name: data.name,
        status: data.status,
        startsAt: data.startsAt || null,
        endsAt: data.endsAt || null,
      },
    });
  }

  async updateAdvertisement(id: string, data: { name?: string; status?: string; startsAt?: Date; endsAt?: Date }) {
    return this.prisma.advertisement.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.startsAt !== undefined ? { startsAt: data.startsAt } : {}),
        ...(data.endsAt !== undefined ? { endsAt: data.endsAt } : {}),
      },
    });
  }

  async deleteAdvertisement(id: string) {
    return this.prisma.advertisement.delete({
      where: { id },
    });
  }

  async listAIAgents() {
    return this.prisma.aIAgent.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async createAIAgent(data: { name: string; description?: string; model?: string; status?: string; config?: any }) {
    return this.prisma.aIAgent.create({
      data: {
        name: data.name,
        description: data.description,
        model: data.model,
        status: data.status,
        config: data.config,
      },
    });
  }

  async updateAIAgent(id: string, data: { name?: string; description?: string; model?: string; status?: string; config?: any }) {
    return this.prisma.aIAgent.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.model !== undefined ? { model: data.model } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.config !== undefined ? { config: data.config } : {}),
      },
    });
  }

  async deleteAIAgent(id: string) {
    return this.prisma.aIAgent.delete({
      where: { id },
    });
  }

  async listRoles() {
    const roles: Role[] = [Role.ADMIN, Role.MODERATOR, Role.CREATOR, Role.USER, Role.GUEST];
    const counts = await Promise.all(
      roles.map(role =>
        this.prisma.user.count({ where: { role } }).then(count => ({ role, count })),
      ),
    );
    return counts;
  }

  async listAuditLogs(page = 1, limit = 50) {
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              handle: true,
              name: true,
              role: true,
            },
          },
        },
      }),
      this.prisma.auditLog.count(),
    ]);

    return { data: logs, total, page, pageSize: limit };
  }

  async getAuditLogById(id: string) {
    return this.prisma.auditLog.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            handle: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });
  }

  async getAISettings() {
    const settings = await this.prisma.systemSetting.findMany({
      where: { category: 'ai' },
    });
    const result: Record<string, string> = {};
    for (const s of settings) {
      result[s.key] = s.value;
    }
    return result;
  }

  async updateAISettings(settings: Record<string, any>) {
    const promises = Object.entries(settings).map(([key, value]) =>
      this.prisma.systemSetting.upsert({
        where: { key },
        update: { value: typeof value === 'object' ? JSON.stringify(value) : String(value), category: 'ai' },
        create: { key, value: typeof value === 'object' ? JSON.stringify(value) : String(value), category: 'ai' },
      }),
    );
    await Promise.all(promises);
    this.settingsCache = null;
    return this.getAISettings();
  }

  async testAIModeration(content: string, thresholds?: { high: number; medium: number }) {
    const highThreshold = thresholds?.high ?? 80;
    const mediumThreshold = thresholds?.medium ?? 50;
    
    const categoryWords: Record<string, string[]> = {
      spam: ['free', 'buy now', 'click here', 'win', 'lottery', 'earn money'],
      harassment: ['stupid', 'idiot', 'fool', 'hate', 'die', 'kill'],
      misinformation: ['fake news', 'hoax', 'conspiracy', 'lie', 'false'],
      copyright: ['download', 'cracked', 'pirate', 'illegal', 'free movie'],
      violence: ['violent', 'attack', 'fight', 'weapon', 'shoot'],
      hateSpeech: ['racist', 'nazi', 'terrorist', 'bigot', 'discriminate'],
      selfHarm: ['suicide', 'cut', 'hurt myself', 'die', 'pain'],
      sexualContent: ['sex', 'porn', 'nude', 'erotic', 'adult'],
    };

    let score = 20 + Math.random() * 30;
    let matchedCategory = 'none';
    let confidence = 60 + Math.random() * 35;

    for (const [category, words] of Object.entries(categoryWords)) {
      const matches = words.filter(word => content.toLowerCase().includes(word));
      if (matches.length > 0) {
        score += matches.length * 15 + Math.random() * 20;
        matchedCategory = category;
        confidence = Math.min(99, confidence + matches.length * 10);
        break;
      }
    }

    score = Math.min(100, score);

    let riskLevel = 'low';
    if (score >= highThreshold) riskLevel = 'high';
    else if (score >= mediumThreshold) riskLevel = 'medium';

    return {
      score: Math.round(score),
      riskLevel,
      category: matchedCategory === 'none' ? 'general' : matchedCategory,
      confidence: Math.round(confidence),
      reasoning: matchedCategory === 'none'
        ? 'The content does not match any known violation patterns. Normal content detected.'
        : `The content contains language patterns consistent with ${matchedCategory}. ${score >= highThreshold ? 'This exceeds the high-risk threshold.' : 'This may require further review.'}`,
      thresholds: { high: highThreshold, medium: mediumThreshold },
    };
  }

  async getReportTrends(days = 30) {
    const now = new Date();
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const reports = await this.prisma.report.findMany({
      where: { createdAt: { gte: startDate } },
      select: { createdAt: true, status: true, priority: true },
    });

    const buckets: Record<string, { total: number; open: number; resolved: number; dismissed: number; critical: number }> = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      buckets[key] = { total: 0, open: 0, resolved: 0, dismissed: 0, critical: 0 };
    }

    for (const report of reports) {
      const key = report.createdAt.toISOString().slice(0, 10);
      if (buckets[key]) {
        buckets[key].total++;
        if (report.status === 'open') buckets[key].open++;
        if (report.status === 'resolved') buckets[key].resolved++;
        if (report.status === 'dismissed') buckets[key].dismissed++;
        if (report.priority === 'critical') buckets[key].critical++;
      }
    }

    const lastWeek = Object.values(buckets).slice(-7);
    const prevWeek = Object.values(buckets).slice(-14, -7);
    const lastWeekTotal = lastWeek.reduce((sum, b) => sum + b.total, 0);
    const prevWeekTotal = prevWeek.length > 0 ? prevWeek.reduce((sum, b) => sum + b.total, 0) : lastWeekTotal;
    const trend = prevWeekTotal > 0 ? Math.round(((lastWeekTotal - prevWeekTotal) / prevWeekTotal) * 100) : 0;

    return {
      daily: Object.entries(buckets).map(([date, counts]) => ({ date, ...counts })),
      trend,
      summary: {
        totalReports: reports.length,
        lastWeekTotal,
        trendDirection: trend > 0 ? 'up' : trend < 0 ? 'down' : 'stable',
      },
    };
  }

  async getReportStats() {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalOpen,
      totalResolved,
      totalDismissed,
      totalCritical,
      totalUnderReview,
      openThisWeek,
      resolvedThisWeek,
      avgAiScore,
    ] = await Promise.all([
      this.prisma.report.count({ where: { status: 'open' } }),
      this.prisma.report.count({ where: { status: 'resolved' } }),
      this.prisma.report.count({ where: { status: 'dismissed' } }),
      this.prisma.report.count({ where: { priority: 'critical' } }),
      this.prisma.report.count({ where: { status: 'under_review' } }),
      this.prisma.report.count({ where: { status: 'open', createdAt: { gte: oneWeekAgo } } }),
      this.prisma.report.count({ where: { status: 'resolved', createdAt: { gte: oneWeekAgo } } }),
      this.prisma.report.aggregate({ _avg: { aiScore: true } }).then(r => r._avg.aiScore ?? 0),
    ]);

    return {
      openCount: totalOpen,
      resolvedCount: totalResolved,
      dismissedCount: totalDismissed,
      criticalCount: totalCritical,
      underReviewCount: totalUnderReview,
      openTrend: openThisWeek > 0 ? '+12%' : '-5%',
      resolvedTrend: resolvedThisWeek > 0 ? '+8%' : '-3%',
      criticalTrend: totalCritical > 0 ? '+25%' : '0%',
      aiScoreTrend: avgAiScore > 50 ? '+5%' : '-2%',
    };
  }

  async listHelpArticles(params?: { category?: string; search?: string }) {
    const where: Record<string, any> = { isPublished: true };
    if (params?.category && params.category !== 'All') {
      where.category = params.category;
    }
    if (params?.search) {
      where.OR = [
        { title: { contains: params.search, mode: 'insensitive' } },
        { description: { contains: params.search, mode: 'insensitive' } },
        { category: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const articles = await this.prisma.helpArticle.findMany({
      where,
      orderBy: [{ popular: 'desc' }, { createdAt: 'desc' }],
    });

    return articles;
  }

  async getHelpArticleBySlug(slug: string) {
    const article = await this.prisma.helpArticle.findUnique({
      where: { slug },
    });
    if (article) {
      await this.prisma.helpArticle.update({
        where: { slug },
        data: { views: { increment: 1 } },
      });
    }
    return article;
  }

  async getHelpArticleById(id: string) {
    return this.prisma.helpArticle.findUnique({
      where: { id },
    });
  }

  async createHelpArticle(data: {
    slug: string;
    title: string;
    description: string;
    content: string[];
    category: string;
    icon: string;
    readMinutes?: number;
    popular?: boolean;
    isPublished?: boolean;
  }) {
    return this.prisma.helpArticle.create({
      data: {
        slug: data.slug,
        title: data.title,
        description: data.description,
        content: data.content,
        category: data.category,
        icon: data.icon,
        readMinutes: data.readMinutes ?? 3,
        popular: data.popular ?? false,
        isPublished: data.isPublished ?? true,
      },
    });
  }

  async updateHelpArticle(id: string, data: Partial<{
    slug: string;
    title: string;
    description: string;
    content: string[];
    category: string;
    icon: string;
    readMinutes: number;
    popular: boolean;
    isPublished: boolean;
  }>) {
    return this.prisma.helpArticle.update({
      where: { id },
      data,
    });
  }

  async deleteHelpArticle(id: string) {
    return this.prisma.helpArticle.delete({
      where: { id },
    });
  }

  async createSupportTicket(userId: string, data: { subject: string; message: string; priority: string }) {
    const count = await this.prisma.supportTicket.count();
    const ticketNumber = `TKT-${String(count + 1).padStart(6, '0')}`;
    const priorityMap: Record<string, string> = {
      low: 'LOW', medium: 'MEDIUM', high: 'HIGH', critical: 'CRITICAL', emergency: 'EMERGENCY',
    };
    return this.prisma.supportTicket.create({
      data: {
        ticketNumber,
        subject: data.subject,
        message: data.message,
        priority: (priorityMap[data.priority.toLowerCase()] ?? 'MEDIUM') as any,
        status: 'NEW',
        userId,
      },
      include: {
        user: { select: { id: true, email: true, name: true, handle: true } },
      },
    });
  }

  async listSupportTickets(params?: { page?: number; limit?: number; status?: string; priority?: string }) {
    const skip = ((params?.page ?? 1) - 1) * (params?.limit ?? 20);
    const where: Record<string, any> = { deletedAt: null };
    if (params?.status) {
      const statusMap: Record<string, string> = {
        open: 'NEW', in_progress: 'IN_PROGRESS', resolved: 'RESOLVED', closed: 'CLOSED',
      };
      where.status = statusMap[params.status.toLowerCase()] ?? params.status.toUpperCase();
    }
    if (params?.priority) {
      where.priority = params.priority.toUpperCase();
    }

    const [tickets, total] = await Promise.all([
      this.prisma.supportTicket.findMany({
        where,
        skip,
        take: params?.limit ?? 20,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, email: true, name: true, handle: true, avatar: true } },
          assignee: { select: { id: true, email: true, name: true, handle: true, avatar: true } },
        },
      }),
      this.prisma.supportTicket.count({ where }),
    ]);

    return { data: tickets, total, page: params?.page ?? 1, pageSize: params?.limit ?? 20 };
  }

  async updateSupportTicketStatus(id: string, status: string) {
    const statusMap: Record<string, string> = {
      open: 'NEW', assigned: 'ASSIGNED', in_progress: 'IN_PROGRESS',
      waiting_on_customer: 'WAITING_ON_CUSTOMER', waiting_on_internal: 'WAITING_ON_INTERNAL',
      escalated: 'ESCALATED', resolved: 'RESOLVED', closed: 'CLOSED', reopened: 'REOPENED',
    };
    const mappedStatus = statusMap[status.toLowerCase()] ?? status.toUpperCase();
    return this.prisma.supportTicket.update({
      where: { id },
      data: { status: mappedStatus as any },
      include: {
        user: { select: { id: true, email: true, name: true, handle: true } },
      },
    });
  }

  async getSupportTicket(id: string) {
    return this.prisma.supportTicket.findFirst({
      where: { id, deletedAt: null },
      include: {
        user: { select: { id: true, email: true, name: true, handle: true, avatar: true } },
        assignee: { select: { id: true, email: true, name: true, handle: true, avatar: true } },
        department: true,
        category: true,
        messages: {
          include: { author: { select: { id: true, name: true, avatar: true } } },
          orderBy: { createdAt: 'asc' },
        },
        statusHistory: {
          include: { changedBy: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async seedData() {
    const existingUsers = await this.prisma.user.count();
    if (existingUsers > 0) {
      return { message: 'Seed data already exists, skipping...' };
    }

    const passwordHash = await bcrypt.hash('password123', 12);
    const now = new Date();

    const admin = await this.prisma.user.create({
      data: {
        email: 'admin@vellum.com',
        passwordHash,
        handle: 'vellumadmin',
        name: 'Vellum Admin',
        role: 'ADMIN',
        emailVerified: now,
        bio: 'Founder and admin of Vellum',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    });

    const moderator = await this.prisma.user.create({
      data: {
        email: 'moderator@vellum.com',
        passwordHash,
        handle: 'vellummod',
        name: 'Vellum Moderator',
        role: 'MODERATOR',
        emailVerified: now,
        bio: 'Community moderator',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    });

    const creator = await this.prisma.user.create({
      data: {
        email: 'creator@vellum.com',
        passwordHash,
        handle: 'contentcreator',
        name: 'Content Creator',
        role: 'CREATOR',
        emailVerified: now,
        bio: 'Tech content creator',
        publication: 'Tech Insights',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    });

    const user1 = await this.prisma.user.create({
      data: {
        email: 'user1@example.com',
        passwordHash,
        handle: 'johndoe',
        name: 'John Doe',
        emailVerified: now,
        bio: 'Tech enthusiast',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    });

    const user2 = await this.prisma.user.create({
      data: {
        email: 'user2@example.com',
        passwordHash,
        handle: 'janedoe',
        name: 'Jane Doe',
        emailVerified: now,
        bio: 'Writer and editor',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    });

    await this.prisma.userSettings.create({ data: { userId: admin.id } });
    await this.prisma.userSettings.create({ data: { userId: moderator.id } });
    await this.prisma.userSettings.create({ data: { userId: creator.id } });
    await this.prisma.userSettings.create({ data: { userId: user1.id } });
    await this.prisma.userSettings.create({ data: { userId: user2.id } });

    const techCategory = await this.prisma.category.create({
      data: { name: 'Technology', slug: 'technology', tint: '#3B82F6' },
    });
    await this.prisma.category.create({ data: { name: 'Business', slug: 'business', tint: '#8B5CF6' } });
    await this.prisma.category.create({ data: { name: 'Science', slug: 'science', tint: '#06B6D4' } });
    await this.prisma.category.create({ data: { name: 'Health', slug: 'health', tint: '#10B981' } });
    await this.prisma.category.create({ data: { name: 'Entertainment', slug: 'entertainment', tint: '#F59E0B' } });
    await this.prisma.category.create({ data: { name: 'Sports', slug: 'sports', tint: '#EF4444' } });

    const article1 = await this.prisma.article.create({
      data: {
        slug: 'introduction-to-react-native',
        title: 'Introduction to React Native',
        excerpt: 'Learn the basics of React Native development',
        body: ['React Native is a popular framework for building mobile applications using React.'],
        cover: 'https://example.com/react-native-cover.jpg',
        readMinutes: 5,
        categoryId: techCategory.id,
        authorId: creator.id,
        isPublished: true,
        publishedAt: now,
        likesCount: 120,
        views: 5000,
        commentsCount: 2,
        createdAt: now,
        updatedAt: now,
      },
    });

    const article2 = await this.prisma.article.create({
      data: {
        slug: 'nodejs-best-practices',
        title: 'Node.js Best Practices',
        excerpt: 'Essential tips for building scalable Node.js applications',
        body: ['Building scalable Node.js applications requires careful planning.'],
        cover: 'https://example.com/nodejs-cover.jpg',
        readMinutes: 8,
        categoryId: techCategory.id,
        authorId: creator.id,
        isPublished: true,
        publishedAt: now,
        likesCount: 85,
        views: 3200,
        commentsCount: 1,
        createdAt: now,
        updatedAt: now,
      },
    });

    await this.prisma.article.create({
      data: {
        slug: 'typescript-fundamentals',
        title: 'TypeScript Fundamentals',
        excerpt: 'Master TypeScript for better code quality',
        body: ['TypeScript adds optional static typing to JavaScript.'],
        cover: 'https://example.com/typescript-cover.jpg',
        readMinutes: 6,
        categoryId: techCategory.id,
        authorId: user1.id,
        isPublished: true,
        publishedAt: now,
        likesCount: 67,
        views: 2100,
        commentsCount: 0,
        createdAt: now,
        updatedAt: now,
      },
    });

    await this.prisma.highlight.create({
      data: {
        title: 'React Hooks Tutorial',
        handle: creator.handle,
        authorId: creator.id,
        description: 'Learn React Hooks in 5 minutes',
        videoUrl: 'https://example.com/hooks-video.mp4',
        thumbnailUrl: 'https://example.com/hooks-thumb.jpg',
        duration: 300,
        likesCount: 250,
        commentsCount: 30,
        shares: 45,
        isPublished: true,
        publishedAt: now,
        createdAt: now,
        updatedAt: now,
      },
    });

    await this.prisma.highlight.create({
      data: {
        title: 'CSS Grid Layout',
        handle: user2.handle,
        authorId: user2.id,
        description: 'Master CSS Grid in 3 minutes',
        videoUrl: 'https://example.com/css-grid-video.mp4',
        thumbnailUrl: 'https://example.com/css-grid-thumb.jpg',
        duration: 180,
        likesCount: 180,
        commentsCount: 22,
        shares: 30,
        isPublished: true,
        publishedAt: now,
        createdAt: now,
        updatedAt: now,
      },
    });

    await this.prisma.comment.create({
      data: { articleSlug: article1.slug, authorId: user1.id, body: 'Great article! Very informative.', likesCount: 5, createdAt: now, updatedAt: now },
    });
    await this.prisma.comment.create({
      data: { articleSlug: article1.slug, authorId: user2.id, body: 'Thanks for sharing this!', likesCount: 3, createdAt: now, updatedAt: now },
    });
    await this.prisma.comment.create({
      data: { articleSlug: article2.slug, authorId: user1.id, body: 'Node.js is awesome!', likesCount: 2, createdAt: now, updatedAt: now },
    });

    await this.prisma.like.create({ data: { userId: user1.id, articleSlug: article1.slug } });
    await this.prisma.like.create({ data: { userId: user2.id, articleSlug: article1.slug } });
    await this.prisma.like.create({ data: { userId: user1.id, articleSlug: article2.slug } });

    await this.prisma.bookmark.create({ data: { userId: user1.id, articleSlug: article1.slug } });
    await this.prisma.bookmark.create({ data: { userId: user2.id, articleSlug: article2.slug } });

    await this.prisma.follow.create({ data: { followerId: user1.id, followingId: creator.id } });
    await this.prisma.follow.create({ data: { followerId: user2.id, followingId: creator.id } });
    await this.prisma.follow.create({ data: { followerId: user1.id, followingId: user2.id } });

    await this.prisma.notification.create({
      data: { userId: creator.id, actorId: user1.id, kind: 'FOLLOW', body: 'John Doe started following you', read: false, createdAt: now },
    });

    await this.prisma.notification.create({
      data: { userId: creator.id, actorId: user2.id, kind: 'LIKE', articleSlug: article1.slug, body: 'Jane Doe liked your article', read: false, createdAt: now },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: admin.id,
        action: 'CREATE_USER',
        resource: 'User',
        details: { email: 'admin@vellum.com', role: 'ADMIN' },
        createdAt: now,
      },
    });

    await this.prisma.helpArticle.createMany({
      data: [
        {
          slug: 'getting-started',
          title: 'Getting started with Vellum Admin',
          description: 'Learn the fundamentals of navigating the admin dashboard, understanding key metrics, and managing your first workflow.',
          content: [
            'Welcome to Vellum Admin! This guide will help you get started with the admin dashboard.',
            'The dashboard provides a comprehensive overview of your platform including user statistics, content metrics, and system health.',
            'Key sections include Users, Articles, Highlights, Comments, Analytics, and Settings.',
            'Use the sidebar navigation to access different sections of the admin panel.',
            'The dashboard stats cards show real-time metrics for your platform.',
          ],
          category: 'Basics',
          icon: 'BookOpen',
          readMinutes: 3,
          popular: true,
          isPublished: true,
        },
        {
          slug: 'user-roles',
          title: 'Managing user roles and permissions',
          description: 'Configure RBAC policies, create custom roles, and audit permission grants across your organization.',
          content: [
            'Vellum Admin uses Role-Based Access Control (RBAC) to manage permissions.',
            'Available roles include: ADMIN, MODERATOR, CREATOR, USER, and GUEST.',
            'Admins have full access to all features and settings.',
            'Moderators can manage content, review reports, and handle user issues.',
            'Creators can publish and manage their own content.',
            'Regular users have basic access to browse and interact with content.',
          ],
          category: 'Access',
          icon: 'Users',
          readMinutes: 5,
          popular: true,
          isPublished: true,
        },
        {
          slug: 'moderation-rules',
          title: 'Configuring moderation rules',
          description: 'Set up automated content filtering, keyword detection, and escalation thresholds for your community.',
          content: [
            'Content moderation helps keep your community safe and welcoming.',
            'Configure automated rules for detecting spam, harassment, and other violations.',
            'Set up keyword filters to automatically flag or hide content containing specific words.',
            'Use AI-powered moderation to detect policy violations at scale.',
            'Review flagged content in the moderation queue and take action as needed.',
            'Create custom rules and escalation workflows for your team.',
          ],
          category: 'Trust & Safety',
          icon: 'Shield',
          readMinutes: 8,
          popular: true,
          isPublished: true,
        },
        {
          slug: 'webhooks',
          title: 'Building a webhook integration',
          description: 'Receive real-time event notifications, verify signatures, and handle retries with idempotency.',
          content: [
            'Webhooks allow your application to receive real-time notifications when events happen on Vellum.',
            'To get started, create a webhook endpoint in the Webhooks section of admin settings.',
            'Configure which events you want to receive and provide a secure URL.',
            'Each webhook includes a signature header that you can use to verify the request authenticity.',
            'Implement idempotency to handle retries safely by checking the event ID.',
            'Monitor webhook delivery and view logs in the admin dashboard.',
          ],
          category: 'Developers',
          icon: 'Code',
          readMinutes: 6,
          isPublished: true,
        },
        {
          slug: 'analytics',
          title: 'Understanding analytics events',
          description: 'Deep dive into event schemas, custom properties, and funnel analysis for product insights.',
          content: [
            'Analytics provide valuable insights into how users interact with your platform.',
            'Track key metrics like user growth, content engagement, and retention rates.',
            'Use the overview dashboard to see high-level trends and key performance indicators.',
            'Drill down into specific metrics using the time series charts.',
            'Analyze traffic sources to understand where your users are coming from.',
            'Export data for further analysis in your preferred tools.',
          ],
          category: 'Analytics',
          icon: 'BarChart3',
          readMinutes: 7,
          isPublished: true,
        },
        {
          slug: 'ai-best-practices',
          title: 'AI automation best practices',
          description: 'Optimize prompt engineering, manage model costs, and evaluate AI-generated outputs at scale.',
          content: [
            'AI-powered features can help automate moderation and content review.',
            'Follow best practices for prompt engineering to get the best results.',
            'Monitor AI costs and usage to stay within budget.',
            'Evaluate AI outputs for accuracy and bias regularly.',
            'Use human-in-the-loop review for high-stakes decisions.',
            'Continuously improve AI performance with feedback loops.',
          ],
          category: 'AI',
          icon: 'Sparkles',
          readMinutes: 9,
          popular: true,
          isPublished: true,
        },
        {
          slug: 'api-keys',
          title: 'Managing API keys and secrets',
          description: 'Rotate credentials, set scoped permissions, and monitor usage across environments.',
          content: [
            'API keys allow developers to integrate with Vellum programmatically.',
            'Create API keys with specific scopes to limit access to needed endpoints.',
            'Rotate keys regularly to maintain security.',
            'Monitor API usage and set up alerts for unusual activity.',
            'Use different keys for development, staging, and production environments.',
            'Never expose API keys in client-side code or public repositories.',
          ],
          category: 'Developers',
          icon: 'Zap',
          readMinutes: 4,
          isPublished: true,
        },
        {
          slug: 'content-policy',
          title: 'Content policy enforcement',
          description: 'Draft, version, and enforce community guidelines with automated flagging and human review.',
          content: [
            'Clear content policies help maintain a healthy community.',
            'Draft your community guidelines and make them accessible to all users.',
            'Use version control to track changes to your policies over time.',
            'Automate flagging of content that may violate policies.',
            'Set up workflows for human review of flagged content.',
            'Communicate policy changes clearly to your community.',
          ],
          category: 'Trust & Safety',
          icon: 'Shield',
          readMinutes: 10,
          isPublished: true,
        },
        {
          slug: 'custom-reports',
          title: 'Building custom reports',
          description: 'Use the report builder to create shareable dashboards with filters, segments, and scheduled delivery.',
          content: [
            'Custom reports help you track the metrics that matter most to your team.',
            'Use the report builder to create dashboards with the data you need.',
            'Apply filters and segments to focus on specific user groups or time periods.',
            'Schedule regular delivery of reports to stakeholders via email.',
            'Share reports with team members with appropriate permissions.',
            'Export report data in CSV or JSON formats.',
          ],
          category: 'Analytics',
          icon: 'BarChart3',
          readMinutes: 6,
          isPublished: true,
        },
      ],
    });

    return { message: 'Seed data created successfully!' };
  }
}
