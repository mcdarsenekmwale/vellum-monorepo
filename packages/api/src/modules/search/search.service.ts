import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class SearchService {
  constructor(private prisma: PrismaService) { }

  async search(query: string, page = 1, limit = 10, type?: 'users' | 'articles' | 'highlights') {
    try {
      const skip = (page - 1) * limit;

      if (!query.trim()) {
        return { users: [], articles: [], highlights: [], total: 0 };
      }
      if (query.length < 3) {
        return { users: [], articles: [], highlights: [], total: 0 };
      }

      const lowerQuery = query.toLowerCase();

      if (type === 'users') {
        return this.searchUsers(lowerQuery, skip, limit);
      }

      if (type === 'articles') {
        return this.searchArticles(lowerQuery, skip, limit);
      }

      if (type === 'highlights') {
        return this.searchHighlights(lowerQuery, skip, limit);
      }

      const [users, articles, highlights] = await this.prisma.retryOnConnectionError(() =>
        Promise.all([
          this.searchUsers(lowerQuery, skip, limit),
          this.searchArticles(lowerQuery, skip, limit),
          this.searchHighlights(lowerQuery, skip, limit),
        ])
      );

      return {
        users: users.data,
        articles: articles.data,
        highlights: highlights.data,
        total: users.total + articles.total + highlights.total,
      };
    } catch (error) {
      console.error('Search failed:', error);
      throw error;
    }
  }

  private async searchUsers(query: string, skip: number, limit: number) {
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          OR: [
            { handle: { contains: query, mode: 'insensitive' } },
            { name: { contains: query, mode: 'insensitive' } },
            { bio: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },

          ],
          isActive: true,
        },
        select: { id: true, handle: true, name: true, avatar: true, bio: true },
        skip,
        take: limit,
      }),
      this.prisma.user.count({
        where: {
          OR: [
            { handle: { contains: query, mode: 'insensitive' } },
            { name: { contains: query, mode: 'insensitive' } },
            { bio: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
          ],
          isActive: true,
        },
      }),
    ]);

    return { data: users, total };
  }

  private async searchArticles(query: string, skip: number, limit: number) {
    const [articles, total] = await Promise.all([
      this.prisma.article.findMany({
        where: {
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { excerpt: { contains: query, mode: 'insensitive' } },
            { body: { has: query } },
            {
              category: {
                OR: [
                  { name: { contains: query, mode: 'insensitive' } }
                ],
              }
            },
            {
              author: {
                OR: [
                  { handle: { contains: query, mode: 'insensitive' } },
                  { name: { contains: query, mode: 'insensitive' } },
                  { bio: { contains: query, mode: 'insensitive' } },
                  { email: { contains: query, mode: 'insensitive' } },
                ],
              }
            },
            { slug: { contains: query, mode: 'insensitive' } },
          ],
          isPublished: true,
        },
        include: {
          author: { select: { id: true, handle: true, name: true, avatar: true } },
          category: true,
        },
        skip,
        take: limit,
      }),
      this.prisma.article.count({
        where: {
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { excerpt: { contains: query, mode: 'insensitive' } },
            { body: { has: query } },
            {
              category: {
                OR: [
                  { name: { contains: query, mode: 'insensitive' } }
                ],
              }
            }, {
              author: {
                OR: [
                  { handle: { contains: query, mode: 'insensitive' } },
                  { name: { contains: query, mode: 'insensitive' } },
                  { bio: { contains: query, mode: 'insensitive' } },
                  { email: { contains: query, mode: 'insensitive' } },
                ],
              }
            },
          ],
          isPublished: true,
        },
      }),
    ]);

    return { data: articles, total };
  }

  private async searchHighlights(query: string, skip: number, limit: number) {
    const [highlights, total] = await Promise.all([
      this.prisma.highlight.findMany({
        where: {
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
            { handle: { contains: query, mode: 'insensitive' } },
            { music: { contains: query, mode: 'insensitive' } },
          ],
          isPublished: true,
        },
        include: {
          author: { select: { id: true, handle: true, name: true, avatar: true } },
        },
        skip,
        take: limit,
      }),
      this.prisma.highlight.count({
        where: {
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
            { handle: { contains: query, mode: 'insensitive' } },
            { music: { contains: query, mode: 'insensitive' } },
          ],
          isPublished: true,
        },
      }),
    ]);

    return { data: highlights, total };
  }
}