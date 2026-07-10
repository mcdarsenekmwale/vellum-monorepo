import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { Role } from '@prisma/client';

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
}