import { Injectable, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { NotificationKind, Prisma } from '@prisma/client';

@Injectable()
export class LikesService {
  constructor(
    private prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async toggleLike(userId: string, articleSlug?: string, highlightId?: string, commentId?: string) {
    if (!articleSlug && !highlightId && !commentId) {
      throw new BadRequestException('One of articleSlug, highlightId, or commentId is required');
    }

    const where = { userId, articleSlug, highlightId, commentId };
    const targetKey = articleSlug ? 'articleSlug' : highlightId ? 'highlightId' : 'commentId';
    const targetValue = articleSlug || highlightId || commentId;

    const MAX_RETRIES = 2;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const txResult = await this.prisma.$transaction(async (tx) => {
          const existingLike = await tx.like.findFirst({ where });

          if (existingLike) {
            try {
              await tx.like.delete({ where: { id: existingLike.id } });
            } catch (deleteError: any) {
              if (deleteError?.code === 'P2025') {
                return { liked: false, createdNotification: null };
              }
              throw deleteError;
            }
            await this.decrementCount(tx, targetKey, targetValue as string);
            return { liked: false, createdNotification: null };
          }

          try {
            await tx.like.create({ data: { userId, articleSlug, highlightId, commentId } });
          } catch (createError: any) {
            if (createError?.code === 'P2002') {
              return { liked: true, createdNotification: null };
            }
            throw createError;
          }
          await this.incrementCount(tx, targetKey, targetValue as string);
          const createdNotification = await this.maybeCreateNotification(tx, userId, targetKey, targetValue as string, articleSlug, highlightId, commentId);
          return { liked: true, createdNotification };
        });

        // Emit notification.created AFTER transaction commits successfully
        if (txResult.createdNotification) {
          const n = txResult.createdNotification;
          this.eventEmitter.emit('notification.created', {
            notificationId: n.id,
            userId: n.userId,
            actorId: n.actorId ?? null,
            kind: n.kind,
            articleSlug: n.articleSlug ?? null,
            highlightId: n.highlightId ?? null,
            commentId: n.commentId ?? null,
            previewText: n.body ?? null,
            linkHref: null,
          });
        }
        return { liked: txResult.liked };
      } catch (error: any) {
        const isRetryable =
          error?.code === 'P2002' ||
          error?.code === 'P2025' ||
          error?.code === 'P2034';

        if (isRetryable && attempt < MAX_RETRIES) {
          continue;
        }
        throw error;
      }
    }

    throw new Error('Failed to toggle like after multiple attempts');
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
  ): Promise<any | null> {
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
      return await tx.notification.create({
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
    return null;
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
