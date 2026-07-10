import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class LikesService {
  constructor(private prisma: PrismaService) {}

  async toggleLike(userId: string, articleSlug?: string, highlightId?: string, commentId?: string) {
    if (!articleSlug && !highlightId && !commentId) {
      throw new BadRequestException('One of articleSlug, highlightId, or commentId is required');
    }

    const existingLike = await this.prisma.like.findFirst({
      where: {
        userId,
        articleSlug,
        highlightId,
        commentId,
      },
    });

    if (existingLike) {
      await this.prisma.like.delete({ where: { id: existingLike.id } });

      if (articleSlug) {
        await this.prisma.article.update({ where: { slug: articleSlug }, data: { likesCount: { decrement: 1 } } });
      } else if (highlightId) {
        await this.prisma.highlight.update({ where: { id: highlightId }, data: { likesCount: { decrement: 1 } } });
      } else if (commentId) {
        await this.prisma.comment.update({ where: { id: commentId }, data: { likesCount: { decrement: 1 } } });
      }

      return { liked: false };
    }

    await this.prisma.like.create({
      data: { userId, articleSlug, highlightId, commentId },
    });

    if (articleSlug) {
      await this.prisma.article.update({ where: { slug: articleSlug }, data: { likesCount: { increment: 1 } } });
    } else if (highlightId) {
      await this.prisma.highlight.update({ where: { id: highlightId }, data: { likesCount: { increment: 1 } } });
    } else if (commentId) {
      await this.prisma.comment.update({ where: { id: commentId }, data: { likesCount: { increment: 1 } } });
    }

    return { liked: true };
  }

  async getLikedArticles(userId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [likes, total] = await Promise.all([
      this.prisma.like.findMany({
        where: { userId, articleSlug: { not: null } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.like.count({ where: { userId, articleSlug: { not: null } } }),
    ]);

    const articleSlugs = likes.map((l) => l.articleSlug).filter(Boolean);
    const articles = await this.prisma.article.findMany({
      where: { slug: { in: articleSlugs as string[] }, isPublished: true },
      include: {
        author: { select: { id: true, handle: true, name: true, avatar: true } },
        category: true,
      },
    });

    return { data: articles, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async getLikedHighlights(userId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [likes, total] = await Promise.all([
      this.prisma.like.findMany({
        where: { userId, highlightId: { not: null } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.like.count({ where: { userId, highlightId: { not: null } } }),
    ]);

    const highlightIds = likes.map((l) => l.highlightId).filter(Boolean);
    const highlights = await this.prisma.highlight.findMany({
      where: { id: { in: highlightIds as string[] }, isPublished: true },
      include: {
        author: { select: { id: true, handle: true, name: true, avatar: true } },
      },
    });

    return { data: highlights, total, page, limit, pages: Math.ceil(total / limit) };
  }
}