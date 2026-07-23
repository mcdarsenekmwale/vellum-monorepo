import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { NotificationKind, Prisma } from '@prisma/client';

@Injectable()
export class LikesService {
  constructor(private prisma: PrismaService) {}

  async toggleLike(userId: string, articleSlug?: string, highlightId?: string, commentId?: string) {
    if (!articleSlug && !highlightId && !commentId) {
      throw new BadRequestException('One of articleSlug, highlightId, or commentId is required');
    }

    const where = { userId, articleSlug, highlightId, commentId };
    const targetKey = articleSlug ? 'articleSlug' : highlightId ? 'highlightId' : 'commentId';
    const targetValue = articleSlug || highlightId || commentId;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existingLike = await tx.like.findFirst({ where });

        if (existingLike) {
          await tx.like.delete({ where: { id: existingLike.id } });
          await this.decrementCount(tx, targetKey, targetValue as string);
          return { liked: false };
        }

        await tx.like.create({ data: { userId, articleSlug, highlightId, commentId } });
        await this.incrementCount(tx, targetKey, targetValue as string);
        await this.maybeCreateNotification(tx, userId, targetKey, targetValue as string, articleSlug, highlightId, commentId);
        return { liked: true };
      });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        const existingLike = await this.prisma.like.findFirst({ where });
        if (existingLike) {
          return { liked: true };
        }
      }
      throw error;
    }
  }

  private async incrementCount(tx: any, targetKey: string, targetValue: string) {
    if (targetKey === 'articleSlug') {
      await tx.article.update({ where: { slug: targetValue }, data: { likesCount: { increment: 1 } } });
    } else if (targetKey === 'highlightId') {
      await tx.highlight.update({ where: { id: targetValue }, data: { likesCount: { increment: 1 } } });
    } else if (targetKey === 'commentId') {
      await tx.comment.update({ where: { id: targetValue }, data: { likesCount: { increment: 1 } } });
    }
  }

  private async decrementCount(tx: any, targetKey: string, targetValue: string) {
    if (targetKey === 'articleSlug') {
      await tx.article.update({ where: { slug: targetValue }, data: { likesCount: { decrement: 1 } } });
    } else if (targetKey === 'highlightId') {
      await tx.highlight.update({ where: { id: targetValue }, data: { likesCount: { decrement: 1 } } });
    } else if (targetKey === 'commentId') {
      await tx.comment.update({ where: { id: targetValue }, data: { likesCount: { decrement: 1 } } });
    }
  }

  private async maybeCreateNotification(
    tx: any,
    userId: string,
    targetKey: string,
    targetValue: string,
    articleSlug?: string,
    highlightId?: string,
    commentId?: string,
  ) {
    let authorId: string | null = null;

    if (targetKey === 'articleSlug') {
      const article = await tx.article.findUnique({ where: { slug: targetValue }, select: { authorId: true } });
      authorId = article?.authorId || null;
    } else if (targetKey === 'highlightId') {
      const highlight = await tx.highlight.findUnique({ where: { id: targetValue }, select: { authorId: true } });
      authorId = highlight?.authorId || null;
    } else if (targetKey === 'commentId') {
      const comment = await tx.comment.findUnique({ where: { id: targetValue }, select: { authorId: true } });
      authorId = comment?.authorId || null;
    }

    if (authorId && authorId !== userId) {
      await tx.notification.create({
        data: {
          userId: authorId,
          actorId: userId,
          kind: NotificationKind.LIKE,
          articleSlug: articleSlug || null,
          highlightId: highlightId || null,
          commentId: commentId || null,
        },
      });
    }
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
