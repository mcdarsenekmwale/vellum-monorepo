import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CreateCommentDto } from './dto/comments.dto';

@Injectable()
export class CommentsService {
  constructor(private prisma: PrismaService) {}

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

  async deleteComment(userId: string, commentId: string) {
    const comment = await this.prisma.comment.findUnique({ where: { id: commentId } });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.authorId !== userId) {
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