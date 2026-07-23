import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class SuggestedService {
  constructor(private prisma: PrismaService) {}

  async getSuggestedArticles(userId: string | undefined, limit = 4, offset = 0) {
    try {
      const followedAuthorIds = userId
        ? await this.getFollowedAuthorIds(userId)
        : [];

      const articles = await this.prisma.article.findMany({
        where: {
          isPublished: true,
          deletedAt: null,
          ...(followedAuthorIds.length > 0
            ? { authorId: { notIn: followedAuthorIds } }
            : {}),
          ...(userId ? { authorId: { not: userId } } : {}),
        },
        include: {
          author: {
            select: { id: true, handle: true, name: true, avatar: true, bio: true },
          },
          category: true,
        },
        orderBy: [
          { featured: 'desc' },
          { likesCount: 'desc' },
          { createdAt: 'desc' },
        ],
        skip: offset,
        take: limit + 1,
      });

      const hasMore = articles.length > limit;
      const data = articles.slice(0, limit);

      const enriched = await this.enrichWithUserState(data, userId);

      return {
        data: enriched,
        hasMore,
        limit,
        offset,
      };
    } catch (error: any) {
      console.error('[SuggestedService] getSuggestedArticles error:', error.message);
      console.error('[SuggestedService] Error stack:', error.stack);
      throw error;
    }
  }

  async getReplacementArticle(
    userId: string | undefined,
    excludeArticleId: string,
    excludeAuthorId: string,
  ) {
    try {
      const followedAuthorIds = userId
        ? await this.getFollowedAuthorIds(userId)
        : [];

      const excludedIds = new Set([...followedAuthorIds, excludeAuthorId]);

      const articles = await this.prisma.article.findMany({
        where: {
          isPublished: true,
          deletedAt: null,
          id: { not: excludeArticleId },
          ...(excludedIds.size > 0
            ? { authorId: { notIn: Array.from(excludedIds) } }
            : {}),
          ...(userId ? { authorId: { not: userId } } : {}),
        },
        include: {
          author: {
            select: { id: true, handle: true, name: true, avatar: true, bio: true },
          },
          category: true,
        },
        orderBy: [
          { featured: 'desc' },
          { likesCount: 'desc' },
          { createdAt: 'desc' },
        ],
        take: 1,
      });

      if (articles.length === 0) {
        return null;
      }

      const enriched = await this.enrichWithUserState(articles, userId);
      return enriched[0];
    } catch (error: any) {
      console.error('[SuggestedService] getReplacementArticle error:', error.message);
      throw error;
    }
  }

  private async getFollowedAuthorIds(userId: string): Promise<string[]> {
    try {
      const follows = await this.prisma.follow.findMany({
        where: { followerId: userId },
        select: { followingId: true },
      });
      return follows.map((f) => f.followingId);
    } catch (error: any) {
      console.error('[SuggestedService] getFollowedAuthorIds error:', error.message);
      return [];
    }
  }

  private async enrichWithUserState(
    articles: any[],
    userId: string | undefined,
  ) {
    if (!userId || articles.length === 0) {
      return articles.map((a) => ({ ...a, isLiked: false, isBookmarked: false }));
    }

    const articleIds = articles.map((a) => a.id);
    const articleSlugs = articles.map((a) => a.slug);

    const [likes, bookmarks] = await Promise.all([
      this.prisma.like.findMany({
        where: { userId, articleSlug: { in: articleSlugs } },
        select: { articleSlug: true },
      }),
      this.prisma.bookmark.findMany({
        where: { userId, articleSlug: { in: articleSlugs } },
        select: { articleSlug: true },
      }),
    ]);

    const likedSlugs = new Set(likes.map((l) => l.articleSlug));
    const bookmarkedSlugs = new Set(bookmarks.map((b) => b.articleSlug));

    return articles.map((a) => ({
      ...a,
      isLiked: likedSlugs.has(a.slug),
      isBookmarked: bookmarkedSlugs.has(a.slug),
    }));
  }

  async getSuggestedAuthors(userId: string | undefined, limit = 5, offset = 0) {
    try {
      const followedAuthorIds = userId
        ? await this.getFollowedAuthorIds(userId)
        : [];

      const users = await this.prisma.user.findMany({
        where: {
          isActive: true,
          deletedAt: null,
          role: { in: ['CREATOR', 'ADMIN', 'MODERATOR'] },
          ...(followedAuthorIds.length > 0
            ? { id: { notIn: followedAuthorIds } }
            : {}),
          ...(userId ? { id: { not: userId } } : {}),
        },
        select: {
          id: true,
          handle: true,
          name: true,
          avatar: true,
          bio: true,
          _count: {
            select: {
              followers: true,
              articles: { where: { isPublished: true, deletedAt: null } },
            },
          },
        },
        orderBy: [
          { followers: { _count: 'desc' } },
          { createdAt: 'desc' },
        ],
        skip: offset,
        take: limit + 1,
      });

      const hasMore = users.length > limit;
      const data = users.slice(0, limit).map((u) => ({
        id: u.id,
        handle: u.handle,
        name: u.name,
        avatar: u.avatar,
        bio: u.bio,
        followersCount: u._count.followers,
        articlesCount: u._count.articles,
      }));

      return {
        data,
        hasMore,
        limit,
        offset,
      };
    } catch (error: any) {
      console.error('[SuggestedService] getSuggestedAuthors error:', error.message);
      throw error;
    }
  }

  async getReplacementAuthor(
    userId: string | undefined,
    excludeAuthorId: string,
  ) {
    try {
      const followedAuthorIds = userId
        ? await this.getFollowedAuthorIds(userId)
        : [];

      const excludedIds = new Set([...followedAuthorIds, excludeAuthorId]);

      const users = await this.prisma.user.findMany({
        where: {
          isActive: true,
          deletedAt: null,
          role: { in: ['CREATOR', 'ADMIN', 'MODERATOR'] },
          ...(excludedIds.size > 0
            ? { id: { notIn: Array.from(excludedIds) } }
            : {}),
          ...(userId ? { id: { not: userId } } : {}),
        },
        select: {
          id: true,
          handle: true,
          name: true,
          avatar: true,
          bio: true,
          _count: {
            select: {
              followers: true,
              articles: { where: { isPublished: true, deletedAt: null } },
            },
          },
        },
        orderBy: [
          { followers: { _count: 'desc' } },
          { createdAt: 'desc' },
        ],
        take: 1,
      });

      if (users.length === 0) {
        return null;
      }

      const u = users[0];
      return {
        id: u.id,
        handle: u.handle,
        name: u.name,
        avatar: u.avatar,
        bio: u.bio,
        followersCount: u._count.followers,
        articlesCount: u._count.articles,
      };
    } catch (error: any) {
      console.error('[SuggestedService] getReplacementAuthor error:', error.message);
      throw error;
    }
  }
}
