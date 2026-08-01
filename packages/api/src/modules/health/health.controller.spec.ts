import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CacheService } from '../../shared/cache/cache.service';
import { ConfigService } from '@nestjs/config';
import { ForbiddenException } from '@nestjs/common';

describe('HealthController — Security', () => {
  let controller: HealthController;
  let prisma: jest.Mocked<PrismaService>;
  let cache: jest.Mocked<CacheService>;
  let configService: jest.Mocked<ConfigService>;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: PrismaService,
          useValue: {
            $queryRaw: jest.fn(),
            article: { findMany: jest.fn() },
          },
        },
        {
          provide: CacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            getStatus: jest.fn().mockReturnValue({ status: 'unknown' }),
          },
        },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();
    controller = module.get(HealthController);
    prisma = module.get(PrismaService);
    cache = module.get(CacheService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  });

  describe('health (basic liveness)', () => {
    it('returns ok status without exposing internal details', async () => {
      const result = await controller.health();
      expect(result.status).toBe('ok');
      expect(result.timestamp).toBeTruthy();
      // The basic liveness check must not leak DB or cache details
      expect((result as any).database).toBeUndefined();
      expect((result as any).cache).toBeUndefined();
    });
  });

  describe('readiness (database/cache connectivity)', () => {
    it('does not expose raw DB error messages on failure', async () => {
      (prisma.$queryRaw as jest.Mock).mockRejectedValue(
        new Error('connection refused: postgres://user:pass@db:5432')
      );
      (cache.set as jest.Mock).mockResolvedValue(undefined);
      (cache.get as jest.Mock).mockResolvedValue(undefined);

      const result = await controller.readiness();

      expect(result.database.status).toBe('disconnected');
      // Critical: error string must NOT contain the underlying message
      expect(result.database.error).toBe('Database connection failed');
      expect(JSON.stringify(result)).not.toContain('postgres://');
      expect(JSON.stringify(result)).not.toContain('user:pass');
      expect(JSON.stringify(result)).not.toContain('5432');
    });

    it('does not expose raw cache error messages on failure', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ '?column?': 1 }]);
      (cache.set as jest.Mock).mockRejectedValue(
        new Error('ECONNREFUSED redis://:secret@redis:6379')
      );

      const result = await controller.readiness();

      expect(result.cache.status).toBe('disconnected');
      expect(result.cache.error).toBe('Cache connection failed');
      expect(JSON.stringify(result)).not.toContain('redis://');
      expect(JSON.stringify(result)).not.toContain('secret');
    });

    it('reports ready=true when DB is connected', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ '?column?': 1 }]);
      (cache.set as jest.Mock).mockResolvedValue(undefined);
      (cache.get as jest.Mock).mockResolvedValue(undefined);

      const result = await controller.readiness();
      expect(result.status).toBe('ready');
      expect(result.database.status).toBe('connected');
    });
  });

  describe('debug endpoint — environment gating', () => {
    it('throws ForbiddenException in production', async () => {
      configService.get.mockImplementation((key: string, fallback?: any) => {
        if (key === 'NODE_ENV') return 'production';
        return fallback;
      });

      await expect(controller.debug()).rejects.toThrow(ForbiddenException);
      // Must NOT execute any database introspection query
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
      expect(prisma.article.findMany).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException in staging', async () => {
      configService.get.mockImplementation((key: string, fallback?: any) => {
        if (key === 'NODE_ENV') return 'staging';
        return fallback;
      });

      await expect(controller.debug()).rejects.toThrow(ForbiddenException);
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('returns schema information only in development', async () => {
      configService.get.mockImplementation((key: string, fallback?: any) => {
        if (key === 'NODE_ENV') return 'development';
        return fallback;
      });
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([
        { exists: true },
      ]);
      (prisma.article.findMany as jest.Mock).mockResolvedValue([
        { id: 'a1', slug: 'slug', title: 'Title', createdAt: new Date() },
      ]);

      const result = await controller.debug();
      expect(result.articleTableExists).toEqual([{ exists: true }]);
      expect(result.prismaArticles).toHaveLength(1);
      // Critical: only the safe field set is returned (no passwordHash, no body)
      const article = result.prismaArticles[0];
      expect(Object.keys(article).sort()).toEqual(
        ['createdAt', 'id', 'slug', 'title'].sort()
      );
    });

    it('uses the NODE_ENV fallback of "development" when unset', async () => {
      // ConfigService.get('NODE_ENV', 'development') — if unset, defaults to dev
      configService.get.mockImplementation((key: string, fallback?: any) => fallback);
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);
      (prisma.article.findMany as jest.Mock).mockResolvedValue([]);

      // Should NOT throw — defaults to development
      const result = await controller.debug();
      expect(result.timestamp).toBeTruthy();
    });
  });
});
