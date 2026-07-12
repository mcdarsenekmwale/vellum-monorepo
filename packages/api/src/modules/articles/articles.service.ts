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

    const slug = dto.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 100);

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

    const [articles, total] = await this.prisma.retryOnConnectionError(() =>
      Promise.all([
        this.prisma.article.findMany({
          where,
          include: {
            author: {
              select: { id: true, handle: true, name: true, avatar: true },
            },
            category: true,
          },
          orderBy,
          skip,
          take: limit,
        }),
        this.prisma.article.count({ where }),
      ])
    );

    let articlesWithMeta = articles;

    if (userId) {
      const articleSlugs = articles.map((a) => a.slug);
      const [likedArticles, bookmarkedArticles] = await this.prisma.retryOnConnectionError(() =>
        Promise.all([
          this.prisma.like.findMany({
            where: { userId, articleSlug: { in: articleSlugs } },
            select: { articleSlug: true },
          }),
          this.prisma.bookmark.findMany({
            where: { userId, articleSlug: { in: articleSlugs } },
            select: { articleSlug: true },
          }),
        ])
      );

      const likedSlugs = new Set(likedArticles.map((l) => l.articleSlug));
      const bookmarkedSlugs = new Set(bookmarkedArticles.map((b) => b.articleSlug));

      articlesWithMeta = articles.map((article) => ({
        ...article,
        isLiked: likedSlugs.has(article.slug),
        isBookmarked: bookmarkedSlugs.has(article.slug),
      }));
    }

    return {
      data: articlesWithMeta,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
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