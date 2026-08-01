import { Controller, Get, Injectable, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CacheService } from '../../shared/cache/cache.service';

@ApiTags('Health')
@Controller('api/health')
@Injectable()
export class HealthController {
  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
    private configService: ConfigService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Health check' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  async health() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness check with database and cache connectivity' })
  @ApiResponse({ status: 200, description: 'Service is ready' })
  @ApiResponse({ status: 503, description: 'Service is not ready' })
  async readiness() {
    let dbStatus = 'unknown';
    let dbLatencyMs: number | null = null;
    let dbError: string | null = null;
    let cacheStatus = 'unknown';
    let cacheLatencyMs: number | null = null;
    let cacheError: string | null = null;

    try {
      const start = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      dbLatencyMs = Date.now() - start;
      dbStatus = 'connected';
    } catch {
      dbStatus = 'disconnected';
      // Don't expose internal error details to potential attackers
      dbError = 'Database connection failed';
    }

    try {
      const start = Date.now();
      await this.cache.set('health:ping', { ts: Date.now() }, 10);
      await this.cache.get('health:ping');
      cacheLatencyMs = Date.now() - start;
      cacheStatus = 'connected';
    } catch {
      cacheStatus = 'disconnected';
      cacheError = 'Cache connection failed';
    }

    const cacheInfo = this.cache.getStatus();

    const allReady = dbStatus === 'connected';
    return {
      status: allReady ? 'ready' : 'degraded',
      timestamp: new Date().toISOString(),
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
        error: dbError,
      },
      cache: {
        status: cacheStatus,
        latencyMs: cacheLatencyMs,
        error: cacheError,
      },
    };
  }

  @Get('debug')
  @ApiOperation({ summary: 'Debug database schema (development only)' })
  async debug() {
    if (this.configService.get('NODE_ENV', 'development') !== 'development') {
      throw new ForbiddenException('Debug endpoint is only available in development');
    }

    const results: any = {};
    
    try {
      results.articleTableExists = await this.prisma.$queryRaw`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'Article')`;
    } catch {
      results.articleTableExistsError = 'Query failed';
    }
    
    try {
      results.articleColumns = await this.prisma.$queryRaw`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'Article' ORDER BY ordinal_position`;
    } catch {
      results.articleColumnsError = 'Query failed';
    }
    
    try {
      const start = Date.now();
      results.prismaArticles = await this.prisma.article.findMany({
        where: { isPublished: true, deletedAt: null },
        take: 3,
        select: { id: true, slug: true, title: true, createdAt: true },
      });
      results.prismaQueryLatency = Date.now() - start;
    } catch (error: any) {
      results.prismaArticlesError = { message: error?.message, code: error?.code };
    }
    
    return {
      timestamp: new Date().toISOString(),
      ...results,
    };
  }
}
