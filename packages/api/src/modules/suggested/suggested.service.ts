import { Injectable, Logger, BadRequestException, Optional } from "@nestjs/common";
import { PrismaService } from "../../shared/prisma/prisma.service";
import { CacheService } from "../../shared/cache/cache.service";

// ─── Pagination / validation constants ────────────────────────────────────────

const SUGGESTED_MAX_LIMIT = 50;          // hard cap — never return more than this in one page
const SUGGESTED_MAX_OFFSET = 5000;       // prevent massive skip values (DB performance)
const CACHE_TTL_SEC_ARTICLES = 60;       // 1 minute — feed changes in real time
const CACHE_TTL_SEC_AUTHORS = 5 * 60;    // 5 minutes — author list is slower moving

// Only CREATOR role is considered a "content author" for suggestions.
// Admin/staff roles should not surface as people to follow organically,
// and regular USER/GUEST accounts can't publish articles anyway.
const AUTHOR_ROLES: ReadonlySet<string> = new Set(["CREATOR"]);

export type AuthorSuggestion = {
  id: string;
  handle: string;
  name: string;
  avatar: string | null;
  bio: string | null;
  followersCount: number;
  articlesCount: number;
};

export type ArticleSuggestionState = {
  isLiked: boolean;
  isBookmarked: boolean;
};

export type ArticleAuthorStub = {
  id: string;
  handle: string;
  name: string;
  avatar: string | null;
  bio: string | null;
};

export type ArticleCategoryStub = {
  id: string;
  name?: string | null;
  [k: string]: any;
};

export type ArticleSuggestion = {
  id: string;
  slug: string | null;
  authorId: string;
  isPublished: boolean;
  featured: boolean;
  likesCount: number;
  createdAt: Date;
  categoryId?: string | null;
  title?: string | null;
  author: ArticleAuthorStub;
  category: ArticleCategoryStub | null;
} & ArticleSuggestionState;

export type PaginatedResult<T> = {
  data: T[];
  hasMore: boolean;
  limit: number;
  offset: number;
};

@Injectable()
export class SuggestedService {
  private readonly logger = new Logger(SuggestedService.name);

  constructor(
    private prisma: PrismaService,
    @Optional() private cache?: CacheService,
  ) {}

  // ─── Public getters (typed) ─────────────────────────────────────────────────

  async getSuggestedArticles(
    userId: string | undefined,
    limit = 4,
    offset = 0,
  ): Promise<PaginatedResult<ArticleSuggestion>> {
    const cleanLimit = this.validateLimit(limit, "articles");
    const cleanOffset = this.validateOffset(offset, "articles");

    const cacheKey = this.keyFor("articles", userId, cleanLimit, cleanOffset);
    try {
      if (this.cache) {
        const cached = await this.cache.get<PaginatedResult<ArticleSuggestion>>(cacheKey);
        if (cached) return cached;
      }
    } catch (err) {
      this.warnCache("get", err);
    }

    try {
      const followedAuthorIds = userId ? await this.getFollowedAuthorIds(userId) : [];

      const articles = await this.prisma.article.findMany({
        where: {
          isPublished: true,
          deletedAt: null,
          authorId: {
            ...(followedAuthorIds.length > 0 ? { notIn: followedAuthorIds } : {}),
            ...(userId ? { not: userId } : {}),
          },
        },
        include: {
          author: {
            select: { id: true, handle: true, name: true, avatar: true, bio: true },
          },
          category: true,
        },
        orderBy: [
          { featured: "desc" as const },
          { likesCount: "desc" as const },
          { createdAt: "desc" as const },
        ],
        skip: cleanOffset,
        take: cleanLimit + 1,
      });

      const hasMore = articles.length > cleanLimit;
      const sliced = articles.slice(0, cleanLimit);
      const data = await this.enrichWithUserState(sliced, userId);

      const result: PaginatedResult<ArticleSuggestion> = {
        data,
        hasMore,
        limit: cleanLimit,
        offset: cleanOffset,
      };

      try {
        if (this.cache) {
          await this.cache.set(cacheKey, result, CACHE_TTL_SEC_ARTICLES);
        }
      } catch (err) {
        this.warnCache("set", err);
      }

      return result;
    } catch (error: any) {
      this.logger.error(
        {
          msg: "getSuggestedArticles failed",
          userId: userId ?? "guest",
          limit: cleanLimit,
          offset: cleanOffset,
          error: error?.message,
        },
        error?.stack,
      );
      throw error;
    }
  }

  async getReplacementArticle(
    userId: string | undefined,
    excludeArticleId: string,
    excludeAuthorId: string,
  ): Promise<ArticleSuggestion | null> {
    if (!excludeArticleId || typeof excludeArticleId !== "string" || excludeArticleId.trim().length === 0) {
      throw new BadRequestException("excludeArticleId is required");
    }
    if (!excludeAuthorId || typeof excludeAuthorId !== "string" || excludeAuthorId.trim().length === 0) {
      throw new BadRequestException("excludeAuthorId is required");
    }
    if (excludeArticleId.length > 120 || excludeAuthorId.length > 120) {
      throw new BadRequestException("ID parameters are too long");
    }

    try {
      const followedAuthorIds = userId ? await this.getFollowedAuthorIds(userId) : [];
      const excludedIds = new Set([...followedAuthorIds, excludeAuthorId]);

      const articles = await this.prisma.article.findMany({
        where: {
          isPublished: true,
          deletedAt: null,
          id: { not: excludeArticleId },
          authorId: {
            ...(excludedIds.size > 0 ? { notIn: Array.from(excludedIds) } : {}),
            ...(userId ? { not: userId } : {}),
          },
        },
        include: {
          author: {
            select: { id: true, handle: true, name: true, avatar: true, bio: true },
          },
          category: true,
        },
        orderBy: [
          { featured: "desc" as const },
          { likesCount: "desc" as const },
          { createdAt: "desc" as const },
        ],
        take: 1,
      });

      if (articles.length === 0) return null;
      const enriched = await this.enrichWithUserState(articles, userId);
      return enriched[0] ?? null;
    } catch (error: any) {
      this.logger.error(
        {
          msg: "getReplacementArticle failed",
          userId: userId ?? "guest",
          excludeArticleId,
          excludeAuthorId,
          error: error?.message,
        },
        error?.stack,
      );
      throw error;
    }
  }

  async getSuggestedAuthors(
    userId: string | undefined,
    limit = 5,
    offset = 0,
  ): Promise<PaginatedResult<AuthorSuggestion>> {
    const cleanLimit = this.validateLimit(limit, "authors");
    const cleanOffset = this.validateOffset(offset, "authors");

    const cacheKey = this.keyFor("authors", userId, cleanLimit, cleanOffset);
    try {
      if (this.cache) {
        const cached = await this.cache.get<PaginatedResult<AuthorSuggestion>>(cacheKey);
        if (cached) return cached;
      }
    } catch (err) {
      this.warnCache("get", err);
    }

    try {
      const followedAuthorIds = userId ? await this.getFollowedAuthorIds(userId) : [];

      const users = await this.prisma.user.findMany({
        where: {
          isActive: true,
          deletedAt: null,
          role: { in: Array.from(AUTHOR_ROLES) as any[] },
          id: {
            ...(followedAuthorIds.length > 0 ? { notIn: followedAuthorIds } : {}),
            ...(userId ? { not: userId } : {}),
          },
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
          { followers: { _count: "desc" as const } },
          { createdAt: "desc" as const },
        ],
        skip: cleanOffset,
        take: cleanLimit + 1,
      });

      const hasMore = users.length > cleanLimit;
      const data = users.slice(0, cleanLimit).map<AuthorSuggestion>((u: any) => ({
        id: u.id,
        handle: u.handle,
        name: u.name,
        avatar: u.avatar,
        bio: u.bio,
        followersCount: u._count.followers,
        articlesCount: u._count.articles,
      }));

      const result: PaginatedResult<AuthorSuggestion> = {
        data,
        hasMore,
        limit: cleanLimit,
        offset: cleanOffset,
      };

      try {
        if (this.cache) {
          await this.cache.set(cacheKey, result, CACHE_TTL_SEC_AUTHORS);
        }
      } catch (err) {
        this.warnCache("set", err);
      }

      return result;
    } catch (error: any) {
      this.logger.error(
        {
          msg: "getSuggestedAuthors failed",
          userId: userId ?? "guest",
          limit: cleanLimit,
          offset: cleanOffset,
          error: error?.message,
        },
        error?.stack,
      );
      throw error;
    }
  }

  async getReplacementAuthor(
    userId: string | undefined,
    excludeAuthorId: string,
  ): Promise<AuthorSuggestion | null> {
    if (!excludeAuthorId || typeof excludeAuthorId !== "string" || excludeAuthorId.trim().length === 0) {
      throw new BadRequestException("excludeAuthorId is required");
    }
    if (excludeAuthorId.length > 120) {
      throw new BadRequestException("excludeAuthorId is too long");
    }

    try {
      const followedAuthorIds = userId ? await this.getFollowedAuthorIds(userId) : [];
      const excludedIds = new Set([...followedAuthorIds, excludeAuthorId]);

      const users = await this.prisma.user.findMany({
        where: {
          isActive: true,
          deletedAt: null,
          role: { in: Array.from(AUTHOR_ROLES) as any[] },
          id: {
            ...(excludedIds.size > 0 ? { notIn: Array.from(excludedIds) } : {}),
            ...(userId ? { not: userId } : {}),
          },
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
          { followers: { _count: "desc" as const } },
          { createdAt: "desc" as const },
        ],
        take: 1,
      });

      if (users.length === 0) return null;
      const u: any = users[0];
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
      this.logger.error(
        {
          msg: "getReplacementAuthor failed",
          userId: userId ?? "guest",
          excludeAuthorId,
          error: error?.message,
        },
        error?.stack,
      );
      throw error;
    }
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private validateLimit(limit: unknown, scope: "articles" | "authors"): number {
    if (typeof limit !== "number" || !Number.isFinite(limit)) {
      throw new BadRequestException(`Invalid limit for ${scope}`);
    }
    if (limit < 0) {
      throw new BadRequestException(`limit must be >= 0 for ${scope}`);
    }
    if (limit === 0) return 0;
    return Math.min(Math.floor(limit), SUGGESTED_MAX_LIMIT);
  }

  private validateOffset(offset: unknown, scope: "articles" | "authors"): number {
    if (typeof offset !== "number" || !Number.isFinite(offset)) {
      throw new BadRequestException(`Invalid offset for ${scope}`);
    }
    if (offset < 0) {
      throw new BadRequestException(`offset must be >= 0 for ${scope}`);
    }
    if (offset > SUGGESTED_MAX_OFFSET) {
      throw new BadRequestException(
        `offset too large for ${scope} (max ${SUGGESTED_MAX_OFFSET}); please paginate earlier or contact support`,
      );
    }
    return Math.floor(offset);
  }

  /**
   * Resolve followed authors for userId — restricted to active,
   * non-deleted accounts (BUG #7).
   */
  private async getFollowedAuthorIds(userId: string): Promise<string[]> {
    try {
      const follows = await this.prisma.follow.findMany({
        where: {
          followerId: userId,
          following: {
            isActive: true,
            deletedAt: null,
          },
        },
        select: { followingId: true },
      });
      return follows.map((f) => f.followingId);
    } catch (error: any) {
      this.logger.error(
        { msg: "getFollowedAuthorIds failed", userId, error: error?.message },
        error?.stack,
      );
      return [];
    }
  }

  private async enrichWithUserState(
    articles: Array<{ id: string; slug?: string | null; [k: string]: any }>,
    userId: string | undefined,
  ): Promise<ArticleSuggestion[]> {
    // Fast path — no user or empty list = default false flags
    if (!userId || articles.length === 0) {
      return articles.map<ArticleSuggestion>((a) => ({
        ...(a as any),
        isLiked: false,
        isBookmarked: false,
      }));
    }

    // Filter slugs safely — null slugs can't match Like/Bookmark (which also are nullable slugs)
    const slugs = articles
      .map((a) => a.slug)
      .filter((s): s is string => typeof s === "string" && s.length > 0);

    const [likes, bookmarks] = await Promise.all([
      slugs.length
        ? this.prisma.like.findMany({
            where: { userId, articleSlug: { in: slugs } },
            select: { articleSlug: true },
          })
        : Promise.resolve([] as Array<{ articleSlug: string | null }>),
      slugs.length
        ? this.prisma.bookmark.findMany({
            where: { userId, articleSlug: { in: slugs } },
            select: { articleSlug: true },
          })
        : Promise.resolve([] as Array<{ articleSlug: string | null }>),
    ]).catch((err) => {
      this.logger.error(
        { msg: "enrichWithUserState query failed", userId, error: err?.message },
        err?.stack,
      );
      return [[], []] as const;
    });

    const likedSlugs = new Set<string>(likes.map((l) => l.articleSlug).filter((s): s is string => !!s));
    const bookmarkedSlugs = new Set<string>(bookmarks.map((b) => b.articleSlug).filter((s): s is string => !!s));

    return articles.map<ArticleSuggestion>((a) => {
      const slug = typeof a.slug === "string" ? a.slug : null;
      return {
        ...(a as any),
        isLiked: slug ? likedSlugs.has(slug) : false,
        isBookmarked: slug ? bookmarkedSlugs.has(slug) : false,
      };
    });
  }

  private keyFor(
    kind: "articles" | "authors",
    userId: string | undefined,
    limit: number,
    offset: number,
  ): string {
    const u = userId ? `u:${userId}` : "u:guest";
    return `suggested:${kind}:${u}:limit=${limit}:offset=${offset}`;
  }

  private warnCache(kind: "get" | "set", err: unknown): void {
    const msg = err instanceof Error ? err.message : String(err);
    this.logger.warn(`cache.${kind} failed: ${msg}`);
  }
}
