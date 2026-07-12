import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getDashboardStats() {
    const [userCount, articleCount, highlightCount, commentCount] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.article.count({ where: { isPublished: true } }),
      this.prisma.highlight.count({ where: { isPublished: true } }),
      this.prisma.comment.count(),
    ]);

    return {
      users: userCount,
      articles: articleCount,
      highlights: highlightCount,
      comments: commentCount,
    };
  }

  async listUsers(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

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
          role: true,
          isActive: true,
          createdAt: true,
        },
      }),
      this.prisma.user.count(),
    ]);

    return { data: users, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async updateUserRole(userId: string, role: Role) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { role },
    });
  }

  async toggleUserStatus(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    return this.prisma.user.update({
      where: { id: userId },
      data: { isActive: !user.isActive },
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

    return { data: articles, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async deleteArticle(articleId: string) {
    return this.prisma.article.update({
      where: { id: articleId },
      data: { deletedAt: new Date() },
    });
  }

  async listAuditLogs(page = 1, limit = 50) {
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, handle: true, name: true } },
        },
      }),
      this.prisma.auditLog.count(),
    ]);

    return { data: logs, total, page, limit, pages: Math.ceil(total / limit) };
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
      },
    });

    await this.prisma.comment.create({
      data: { articleSlug: article1.slug, authorId: user1.id, body: 'Great article! Very informative.' },
    });
    await this.prisma.comment.create({
      data: { articleSlug: article1.slug, authorId: user2.id, body: 'Thanks for sharing this!' },
    });
    await this.prisma.comment.create({
      data: { articleSlug: article2.slug, authorId: user1.id, body: 'Node.js is awesome!' },
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
      data: { userId: creator.id, actorId: user1.id, kind: 'FOLLOW', body: 'John Doe started following you' },
    });

    await this.prisma.notification.create({
      data: { userId: creator.id, actorId: user2.id, kind: 'LIKE', articleSlug: article1.slug, body: 'Jane Doe liked your article' },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: admin.id,
        action: 'CREATE_USER',
        resource: 'User',
        details: { email: 'admin@vellum.com', role: 'ADMIN' },
      },
    });

    return { message: 'Seed data created successfully!' };
  }
}