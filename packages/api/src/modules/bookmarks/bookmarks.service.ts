import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class BookmarksService {
  constructor(private prisma: PrismaService) {}

  async toggleBookmark(userId: string, articleSlug?: string, highlightId?: string) {
    if (!articleSlug && !highlightId) {
      throw new BadRequestException('Either articleSlug or highlightId is required');
    }

    const existingBookmark = await this.prisma.bookmark.findFirst({
      where: { userId, articleSlug, highlightId },
    });

    if (existingBookmark) {
      await this.prisma.bookmark.delete({ where: { id: existingBookmark.id } });
      return { bookmarked: false };
    }

    await this.prisma.bookmark.create({ data: { userId, articleSlug, highlightId } });
    return { bookmarked: true };
  }

  async getBookmarkedArticles(userId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [bookmarks, total] = await Promise.all([
      this.prisma.bookmark.findMany({
        where: { userId, articleSlug: { not: null } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.bookmark.count({ where: { userId, articleSlug: { not: null } } }),
    ]);

    const articleSlugs = bookmarks.map((b) => b.articleSlug).filter(Boolean);
    const articles = await this.prisma.article.findMany({
      where: { slug: { in: articleSlugs as string[] }, isPublished: true },
      include: {
        author: { select: { id: true, handle: true, name: true, avatar: true } },
        category: true,
      },
    });

    return { data: articles, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async getBookmarkedHighlights(userId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [bookmarks, total] = await Promise.all([
      this.prisma.bookmark.findMany({
        where: { userId, highlightId: { not: null } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.bookmark.count({ where: { userId, highlightId: { not: null } } }),
    ]);

    const highlightIds = bookmarks.map((b) => b.highlightId).filter(Boolean);
    const highlights = await this.prisma.highlight.findMany({
      where: { id: { in: highlightIds as string[] }, isPublished: true },
      include: {
        author: { select: { id: true, handle: true, name: true, avatar: true } },
      },
    });

    return { data: highlights, total, page, limit, pages: Math.ceil(total / limit) };
  }
}