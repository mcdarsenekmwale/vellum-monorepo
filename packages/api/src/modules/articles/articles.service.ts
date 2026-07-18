import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CreateArticleDto, UpdateArticleDto, ArticleQueryDto } from './dto/articles.dto';

@Injectable()
export class ArticlesService {
  constructor(private prisma: PrismaService) {}

  async createArticle(userId: string, dto: CreateArticleDto) {
    const category = await this.prisma.category.findUnique({
      where: { slug: dto.categorySlug },
    });

    if (!category) {
      throw new BadRequestException('Category not found');
    }

    const baseSlug = dto.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 100);

    let slug = baseSlug;

    const existingArticle = await this.prisma.article.findUnique({
      where: { slug },
    });

    if (existingArticle) {
      throw new BadRequestException('An article with this title already exists');
    }

    const article = await this.prisma.article.create({
      data: {
        slug,
        title: dto.title,
        excerpt: dto.excerpt,
        body: dto.body,
        cover: dto.cover,
        readMinutes: dto.readMinutes,
        categoryId: category.id,
        authorId: userId,
      },
    });

    return article;
  }

  async getArticle(slug: string, userId?: string) {
    const article = await this.prisma.article.findUnique({
      where: { slug },
      include: {
        author: {
          select: { id: true, handle: true, name: true, avatar: true, bio: true },
        },
        category: true,
      },
    });

    if (!article) {
      throw new NotFoundException('Article not found');
    }

    await this.prisma.article.update({
      where: { slug },
      data: { views: { increment: 1 } },
    });

    const comments = await this.prisma.comment.findMany({
      where: { articleSlug: slug, deletedAt: null, parentId: null },
      include: {
        author: { select: { id: true, handle: true, name: true, avatar: true } },
        replies: {
          include: {
            author: { select: { id: true, handle: true, name: true, avatar: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    let isLiked = false;
    let isBookmarked = false;

    if (userId) {
      isLiked = !!(await this.prisma.like.findFirst({
        where: { userId, articleSlug: slug },
      }));
      isBookmarked = !!(await this.prisma.bookmark.findFirst({
        where: { userId, articleSlug: slug },
      }));
    }

    const commentCount = comments.reduce((acc, c) => acc + 1 + c.replies.length, 0);

    return {
      ...article,
      comments,
      isLiked,
      isBookmarked,
      commentCount,
    };
  }

  async getArticles(query: ArticleQueryDto, userId?: string) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    let whereClause = `"isPublished" = true AND "deletedAt" IS NULL`;
    if (query.category) {
      whereClause += ` AND "categoryId" IN (SELECT "id" FROM "Category" WHERE "slug" = '${query.category}')`;
    }
    if (query.featured !== undefined) {
      whereClause += ` AND "featured" = ${query.featured}`;
    }

    let orderClause = `"createdAt" DESC`;
    if (query.sort === 'trending') {
      orderClause = `"likesCount" DESC`;
    } else if (query.sort === 'views') {
      orderClause = `"views" DESC`;
    }

    try {
      const articles = await this.prisma.$queryRawUnsafe(
        `SELECT a."id", a."slug", a."title", a."excerpt", a."body", a."cover", a."readMinutes", a."categoryId", a."authorId", 
                a."likesCount", a."views", a."featured", a."isPublished", a."publishedAt", a."createdAt", a."updatedAt", a."deletedAt",
                u."id" as "author.id", u."name" as "author.name", u."handle" as "author.handle", u."avatar" as "author.avatar"
         FROM "Article" a
         LEFT JOIN "User" u ON a."authorId" = u."id"
         WHERE ${whereClause} ORDER BY ${orderClause} OFFSET ${skip} LIMIT ${limit}`
      ) as Array<{
        id: string;
        slug: string;
        title: string;
        excerpt: string;
        body: string[];
        cover: string;
        readMinutes: number;
        categoryId: string;
        authorId: string;
        likesCount: number;
        views: number;
        featured: boolean;
        isPublished: boolean;
        publishedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        'author.id': string;
        'author.name': string;
        'author.handle': string;
        'author.avatar': string | null;
      }>;

      const totalResult = await this.prisma.$queryRawUnsafe(
        `SELECT COUNT(*) as count FROM "Article" WHERE ${whereClause}`
      );
      const total = parseInt(totalResult[0].count);

      const formattedArticles = articles.map((article: any) => ({
        ...article,
        author: {
          id: article['author.id'],
          name: article['author.name'],
          handle: article['author.handle'],
          avatar: article['author.avatar'],
        },
      }));

      return {
        data: formattedArticles,
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      };
    } catch (error: any) {
      console.error('Raw query failed, falling back to Prisma query:', error.message);
      
      const where: any = { isPublished: true, deletedAt: null };
      if (query.category) {
        where.category = { slug: query.category };
      }
      if (query.featured !== undefined) {
        where.featured = query.featured;
      }

      let orderBy: any = { createdAt: 'desc' };
      if (query.sort === 'trending') {
        orderBy = { likesCount: 'desc' };
      } else if (query.sort === 'views') {
        orderBy = { views: 'desc' };
      }

      const [articles, total] = await Promise.all([
        this.prisma.article.findMany({
          where,
          orderBy,
          skip,
          take: limit,
          include: {
            author: {
              select: { id: true, handle: true, name: true, avatar: true },
            },
          },
        }),
        this.prisma.article.count({ where }),
      ]);

      return {
        data: articles,
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      };
    }
  }

  async getArticlesByAuthor(handle: string, page = 1, limit = 10) {
    const user = await this.prisma.user.findUnique({
      where: { handle },
    });

    if (!user) {
      throw new NotFoundException('Author not found');
    }

    const skip = (page - 1) * limit;

    const [articles, total] = await Promise.all([
      this.prisma.article.findMany({
        where: { authorId: user.id, isPublished: true, deletedAt: null },
        include: {
          author: {
            select: { id: true, handle: true, name: true, avatar: true },
          },
          category: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.article.count({
        where: { authorId: user.id, isPublished: true, deletedAt: null },
      }),
    ]);

    return {
      data: articles,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  async updateArticle(userId: string, slug: string, dto: UpdateArticleDto) {
    const article = await this.prisma.article.findUnique({
      where: { slug },
    });

    if (!article) {
      throw new NotFoundException('Article not found');
    }

    if (article.authorId !== userId) {
      throw new BadRequestException('You can only update your own articles');
    }

    const data: any = {};

    if (dto.title && dto.title !== article.title) {
      const newSlug = dto.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 100);

      const existingArticle = await this.prisma.article.findFirst({
        where: { slug: newSlug, id: { not: article.id } },
      });

      if (existingArticle) {
        throw new BadRequestException('An article with this title already exists');
      }

      data.slug = newSlug;
      data.title = dto.title;
    }

    if (dto.excerpt !== undefined) data.excerpt = dto.excerpt;
    if (dto.body !== undefined) data.body = dto.body;
    if (dto.cover !== undefined) data.cover = dto.cover;
    if (dto.readMinutes !== undefined) data.readMinutes = dto.readMinutes;

    if (dto.categorySlug) {
      const category = await this.prisma.category.findUnique({
        where: { slug: dto.categorySlug },
      });
      if (!category) {
        throw new BadRequestException('Category not found');
      }
      data.categoryId = category.id;
    }

    if (dto.isPublished !== undefined) {
      data.isPublished = dto.isPublished;
      if (dto.isPublished && !article.publishedAt) {
        data.publishedAt = new Date();
      }
    }

    const updatedArticle = await this.prisma.article.update({
      where: { slug },
      data,
    });

    return updatedArticle;
  }

  async deleteArticle(userId: string, slug: string) {
    const article = await this.prisma.article.findUnique({
      where: { slug },
    });

    if (!article) {
      throw new NotFoundException('Article not found');
    }

    if (article.authorId !== userId) {
      throw new BadRequestException('You can only delete your own articles');
    }

    await this.prisma.article.update({
      where: { slug },
      data: { deletedAt: new Date() },
    });

    return { message: 'Article deleted successfully' };
  }

  async getFeaturedArticles(limit = 5) {
    return this.prisma.article.findMany({
      where: { isPublished: true, featured: true, deletedAt: null },
      include: {
        author: {
          select: { id: true, handle: true, name: true, avatar: true },
        },
        category: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}