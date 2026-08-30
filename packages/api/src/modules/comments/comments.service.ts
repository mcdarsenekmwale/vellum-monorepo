import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CreateCommentDto } from './dto/comments.dto';
import { NotificationKind } from '@prisma/client';

@Injectable()
export class CommentsService {
  constructor(
    private prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createComment(userId: string, dto: CreateCommentDto) {
    if (!dto.articleSlug && !dto.highlightId) {
      throw new BadRequestException('Either articleSlug or highlightId is required');
    }

    if (dto.parentId) {
      const parentComment = await this.prisma.comment.findUnique({ where: { id: dto.parentId } });
      if (!parentComment) {
        throw new BadRequestException('Parent comment not found');
      }
    }

    const comment = await this.prisma.comment.create({
      data: {
        body: dto.body,
        articleSlug: dto.articleSlug,
        highlightId: dto.highlightId,
        authorId: userId,
        parentId: dto.parentId,
      },
      include: {
        author: { select: { id: true, handle: true, name: true, avatar: true } },
      },
    });

    if (dto.articleSlug) {
      const article = await this.prisma.article.findUnique({ where: { slug: dto.articleSlug } });
      if (article) {
        const commentCount = await this.prisma.comment.count({ where: { articleSlug: dto.articleSlug, deletedAt: null } });
        await this.prisma.article.update({
          where: { slug: dto.articleSlug },
          data: { commentsCount: commentCount },
        });
      }
    }

    if (dto.highlightId) {
      const highlight = await this.prisma.highlight.findUnique({ where: { id: dto.highlightId } });
      if (highlight) {
        const commentCount = await this.prisma.comment.count({ where: { highlightId: dto.highlightId, deletedAt: null } });
        await this.prisma.highlight.update({
          where: { id: dto.highlightId },
          data: { commentsCount: commentCount },
        });
      }
    }

    if (dto.parentId) {
      const parentComment = await this.prisma.comment.findUnique({ where: { id: dto.parentId } });
      if (parentComment && parentComment.authorId !== userId) {
        const n1 = await this.prisma.notification.create({
          data: {
            userId: parentComment.authorId,
            actorId: userId,
            kind: NotificationKind.REPLY,
            articleSlug: dto.articleSlug,
            highlightId: dto.highlightId,
            commentId: parentComment.id,
            body: dto.body.slice(0, 200),
          },
        });
        this.eventEmitter.emit('notification.created', {
          notificationId: n1.id,
          userId: n1.userId,
          actorId: n1.actorId ?? null,
          kind: n1.kind,
          articleSlug: n1.articleSlug ?? null,
          highlightId: n1.highlightId ?? null,
          commentId: n1.commentId ?? null,
          previewText: n1.body ?? null,
          linkHref: null,
        });
      }
    } else if (dto.articleSlug) {
      const article = await this.prisma.article.findUnique({ where: { slug: dto.articleSlug } });
      if (article && article.authorId !== userId) {
        const n2 = await this.prisma.notification.create({
          data: {
            userId: article.authorId,
            actorId: userId,
            kind: NotificationKind.COMMENT,
            articleSlug: dto.articleSlug,
            commentId: comment.id,
            body: dto.body.slice(0, 200),
          },
        });
        this.eventEmitter.emit('notification.created', {
          notificationId: n2.id,
          userId: n2.userId,
          actorId: n2.actorId ?? null,
          kind: n2.kind,
          articleSlug: n2.articleSlug ?? null,
          highlightId: n2.highlightId ?? null,
          commentId: n2.commentId ?? null,
          previewText: n2.body ?? null,
          linkHref: null,
        });
      }
    } else if (dto.highlightId) {
      const highlight = await this.prisma.highlight.findUnique({ where: { id: dto.highlightId } });
      if (highlight && highlight.authorId && highlight.authorId !== userId) {
        const n3 = await this.prisma.notification.create({
          data: {
            userId: highlight.authorId,
            actorId: userId,
            kind: NotificationKind.COMMENT,
            highlightId: dto.highlightId,
            commentId: comment.id,
            body: dto.body.slice(0, 200),
          },
        });
        this.eventEmitter.emit('notification.created', {
          notificationId: n3.id,
          userId: n3.userId,
          actorId: n3.actorId ?? null,
          kind: n3.kind,
          articleSlug: n3.articleSlug ?? null,
          highlightId: n3.highlightId ?? null,
          commentId: n3.commentId ?? null,
          previewText: n3.body ?? null,
          linkHref: null,
        });
      }
    }

    return comment;
  }

  async getComments(articleSlug?: string, highlightId?: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null, parentId: null };
    if (articleSlug) where.articleSlug = articleSlug;
    if (highlightId) where.highlightId = highlightId;

    const [comments, total] = await Promise.all([
      this.prisma.comment.findMany({
        where,
        include: {
          author: { select: { id: true, handle: true, name: true, avatar: true } },
          replies: {
            include: { author: { select: { id: true, handle: true, name: true, avatar: true } } },
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.comment.count({ where }),
    ]);

    return { data: comments, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async updateComment(userId: string, commentId: string, body: string) {
    const comment = await this.prisma.comment.findUnique({ where: { id: commentId } });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.authorId !== userId) {
      throw new BadRequestException('You can only update your own comments');
    }

    return this.prisma.comment.update({ where: { id: commentId }, data: { body } });
  }

  async deleteComment(userId: string, commentId: string, userRole?: string) {
    const comment = await this.prisma.comment.findUnique({ where: { id: commentId } });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    // Author can delete their own; moderators/admins can delete any
    if (comment.authorId !== userId && userRole !== 'MODERATOR' && userRole !== 'ADMIN') {
      throw new BadRequestException('You can only delete your own comments');
    }

    await this.prisma.comment.update({ where: { id: commentId }, data: { deletedAt: new Date() } });

    if (comment.articleSlug) {
      const commentCount = await this.prisma.comment.count({ where: { articleSlug: comment.articleSlug, deletedAt: null } });
      await this.prisma.article.update({
        where: { slug: comment.articleSlug },
        data: { commentsCount: commentCount },
      });
    }

    if (comment.highlightId) {
      const commentCount = await this.prisma.comment.count({ where: { highlightId: comment.highlightId, deletedAt: null } });
      await this.prisma.highlight.update({
        where: { id: comment.highlightId },
        data: { commentsCount: commentCount },
      });
    }

    return { message: 'Comment deleted successfully' };
  }
}