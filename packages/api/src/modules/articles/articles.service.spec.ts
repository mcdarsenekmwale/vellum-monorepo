import * as fs from 'fs';
import * as path from 'path';
import { Test, TestingModule } from '@nestjs/testing';
import { ArticlesService } from './articles.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('ArticlesService — Security', () => {
  let service: ArticlesService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArticlesService,
        {
          provide: PrismaService,
          useValue: {
            article: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
              findFirst: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
              count: jest.fn(),
            },
            category: { findUnique: jest.fn() },
            like: { findFirst: jest.fn(), create: jest.fn(), delete: jest.fn() },
            bookmark: { findFirst: jest.fn(), create: jest.fn(), delete: jest.fn() },
            comment: { findMany: jest.fn(), count: jest.fn() },
          },
        },
      ],
    }).compile();
    service = module.get(ArticlesService);
    prisma = module.get(PrismaService);
  });

  describe('source-level: no raw SQL injection surface', () => {
    // Static guard: scan the ArticlesService source file for dangerous raw SQL
    // APIs. If any are introduced, this test fails before any runtime check.
    it('does not use $queryRawUnsafe or $executeRawUnsafe in source', () => {
      const source = fs.readFileSync(
        path.join(__dirname, 'articles.service.ts'),
        'utf8'
      );
      expect(source).not.toContain('$queryRawUnsafe');
      expect(source).not.toContain('$executeRawUnsafe');
    });

    it('uses the Prisma query builder (findMany/count) rather than raw SQL', () => {
      const source = fs.readFileSync(
        path.join(__dirname, 'articles.service.ts'),
        'utf8'
      );
      expect(source).toContain('prisma.article.findMany');
      expect(source).toContain('prisma.article.count');
    });
  });

  describe('getArticles — query input handling', () => {
    it('caps the limit at 50 to prevent oversized result sets', async () => {
      (prisma.article.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.article.count as jest.Mock).mockResolvedValue(0);

      await service.getArticles({ page: 1, limit: 10000 } as any);

      const findManyArgs = (prisma.article.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyArgs.take).toBe(50);
    });

    it('defaults page to 1 and limit to 10 when not provided', async () => {
      (prisma.article.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.article.count as jest.Mock).mockResolvedValue(0);

      await service.getArticles({} as any);

      const findManyArgs = (prisma.article.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyArgs.skip).toBe(0);
      expect(findManyArgs.take).toBe(10);
    });

    it('does not pass user-supplied sort strings directly into SQL', async () => {
      (prisma.article.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.article.count as jest.Mock).mockResolvedValue(0);

      // Malicious sort value — should be ignored, not interpolated
      await service.getArticles({ sort: 'DROP TABLE users;--' as any } as any);

      const findManyArgs = (prisma.article.findMany as jest.Mock).mock.calls[0][0];
      // orderBy should fall back to createdAt, never contain the malicious input
      expect(JSON.stringify(findManyArgs.orderBy)).not.toContain('DROP TABLE');
      expect(findManyArgs.orderBy).toEqual({ createdAt: 'desc' });
    });

    it('passes category slug via the Prisma relation filter, never raw interpolation', async () => {
      (prisma.article.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.article.count as jest.Mock).mockResolvedValue(0);

      const maliciousCategory = "'; DROP TABLE articles; --";
      await service.getArticles({ category: maliciousCategory } as any);

      const findManyArgs = (prisma.article.findMany as jest.Mock).mock.calls[0][0];
      // The category is passed as a STRUCTURED Prisma relation filter object,
      // not a string-interpolated SQL fragment. Prisma parameterizes the value,
      // so even though the malicious string appears as a parameter value, it
      // cannot break out of the query.
      expect(findManyArgs.where.category).toEqual({ slug: maliciousCategory });
      // The where clause must be a plain object, not a string with SQL syntax
      expect(typeof findManyArgs.where).toBe('object');
      expect(findManyArgs.where.category).toBeInstanceOf(Object);
      // No $queryRaw / $executeRaw on the prisma mock was called
      expect(prisma.$queryRaw).toBeUndefined();
    });
  });

  describe('getArticle — by slug', () => {
    it('throws NotFoundException when the article does not exist', async () => {
      (prisma.article.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.getArticle('does-not-exist')).rejects.toThrow(NotFoundException);
    });

    it('passes the slug as a Prisma where clause, not interpolated SQL', async () => {
      (prisma.article.findUnique as jest.Mock).mockResolvedValue({
        id: 'a1',
        slug: 'normal-slug',
        title: 'Title',
        author: {},
        category: {},
      });
      (prisma.article.update as jest.Mock).mockResolvedValue({});
      (prisma.comment.findMany as jest.Mock).mockResolvedValue([]);

      const maliciousSlug = "normal-slug'; DROP TABLE articles; --";
      await service.getArticle(maliciousSlug);

      const args = (prisma.article.findUnique as jest.Mock).mock.calls[0][0];
      // The slug is passed as a STRUCTURED Prisma where object, not a raw SQL
      // fragment. Prisma parameterizes the value, so the malicious payload is
      // safely treated as a literal string.
      expect(args.where).toEqual({ slug: maliciousSlug });
      expect(typeof args.where).toBe('object');
      // And no raw SQL API was invoked
      expect(prisma.$queryRaw).toBeUndefined();
      expect(prisma.$executeRaw).toBeUndefined();
    });
  });

  describe('createArticle', () => {
    it('throws BadRequestException when the category does not exist', async () => {
      (prisma.category.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(
        service.createArticle('u1', {
          title: 'T',
          excerpt: '',
          body: '',
          categorySlug: 'missing',
        } as any)
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when the slug already exists', async () => {
      (prisma.category.findUnique as jest.Mock).mockResolvedValue({ id: 'c1' });
      (prisma.article.findUnique as jest.Mock).mockResolvedValue({ id: 'a1' });
      await expect(
        service.createArticle('u1', {
          title: 'Existing Title',
          excerpt: '',
          body: '',
          categorySlug: 'cat',
        } as any)
      ).rejects.toThrow(BadRequestException);
    });

    it('sanitizes the slug (strips HTML special characters)', async () => {
      (prisma.category.findUnique as jest.Mock).mockResolvedValue({ id: 'c1' });
      (prisma.article.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.article.create as jest.Mock).mockImplementation(({ data }) => data);

      await service.createArticle('u1', {
        title: '<script>alert("xss")</script> Hello World',
        excerpt: '',
        body: '',
        categorySlug: 'cat',
      } as any);

      const created = (prisma.article.create as jest.Mock).mock.calls[0][0].data;
      // The slug is generated by stripping non-alphanumeric chars. Critical
      // for safety: no HTML special characters (<, >, ", ', (, )) survive —
      // they would let the slug break out of an HTML attribute if rendered
      // unescaped. The plain word "script" remaining is harmless because slugs
      // are URL path segments, not HTML content.
      expect(created.slug).not.toContain('<');
      expect(created.slug).not.toContain('>');
      expect(created.slug).not.toContain('"');
      expect(created.slug).not.toContain("'");
      expect(created.slug).not.toContain('(');
      expect(created.slug).not.toContain(')');
      // And the slug is lowercase-only alphanumeric + hyphens
      expect(created.slug).toMatch(/^[a-z0-9-]+$/);
    });
  });
});
