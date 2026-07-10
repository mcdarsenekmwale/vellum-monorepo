import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CreateHighlightDto, UpdateHighlightDto } from './dto/highlights.dto';

@Injectable()
export class HighlightsService {
  constructor(private prisma: PrismaService) {}

  async createHighlight(userId: string, dto: CreateHighlightDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    const highlight = await this.prisma.highlight.create({
      data: {
        title: dto.title,
        cover: dto.cover,
        videoUrl: dto.videoUrl,
        thumbnailUrl: dto.thumbnailUrl,
        handle: dto.handle || user.handle,
        authorId: userId,
        description: dto.description,
        music: dto.music,
        aspectRatio: dto.aspectRatio,
        duration: dto.duration,
      },
    });

    return highlight;
  }

  async getHighlight(id: string, userId?: string) {
    const highlight = await this.prisma.highlight.findUnique({
      where: { id },
      include: {
        author: {
          select: { id: true, handle: true, name: true, avatar: true },
        },
        comments: {
          where: { deletedAt: null },
          include: {
            author: { select: { id: true, handle: true, name: true, avatar: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!highlight) {
      throw new NotFoundException('Highlight not found');
    }

    let isLiked = false;
    let isBookmarked = false;

    if (userId) {
      isLiked = !!(await this.prisma.like.findFirst({
        where: { userId, highlightId: id },
      }));
      isBookmarked = !!(await this.prisma.bookmark.findFirst({
        where: { userId, highlightId: id },
      }));
    }

    return { ...highlight, isLiked, isBookmarked };
  }

  async getHighlights(page = 1, limit = 10, userId?: string) {
    const skip = (page - 1) * limit;

    const [highlights, total] = await this.prisma.retryOnConnectionError(() =>
      Promise.all([
        this.prisma.highlight.findMany({
          where: { isPublished: true, deletedAt: null },
          include: {
            author: {
              select: { id: true, handle: true, name: true, avatar: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        this.prisma.highlight.count({ where: { isPublished: true, deletedAt: null } }),
      ])
    );

    const highlightsWithMeta = await Promise.all(
      highlights.map(async (h) => {
        const isLiked = userId
          ? !!(await this.prisma.retryOnConnectionError(() =>
              this.prisma.like.findFirst({ where: { userId, highlightId: h.id } })
            ))
          : false;
        const isBookmarked = userId
          ? !!(await this.prisma.retryOnConnectionError(() =>
              this.prisma.bookmark.findFirst({ where: { userId, highlightId: h.id } })
            ))
          : false;
        return { ...h, isLiked, isBookmarked };
      })
    );

    return { data: highlightsWithMeta, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async updateHighlight(userId: string, id: string, dto: UpdateHighlightDto) {
    const highlight = await this.prisma.highlight.findUnique({ where: { id } });

    if (!highlight) {
      throw new NotFoundException('Highlight not found');
    }

    if (highlight.authorId !== userId) {
      throw new BadRequestException('You can only update your own highlights');
    }

    const data: any = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.cover !== undefined) data.cover = dto.cover;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.isPublished !== undefined) {
      data.isPublished = dto.isPublished;
      if (dto.isPublished && !highlight.publishedAt) {
        data.publishedAt = new Date();
      }
    }

    return this.prisma.highlight.update({ where: { id }, data });
  }

  async deleteHighlight(userId: string, id: string) {
    const highlight = await this.prisma.highlight.findUnique({ where: { id } });

    if (!highlight) {
      throw new NotFoundException('Highlight not found');
    }

    if (highlight.authorId !== userId) {
      throw new BadRequestException('You can only delete your own highlights');
    }

    await this.prisma.highlight.update({ where: { id }, data: { deletedAt: new Date() } });
    return { message: 'Highlight deleted successfully' };
  }
}