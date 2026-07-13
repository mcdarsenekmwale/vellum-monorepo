import { Controller, Get, Injectable } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PrismaService } from '../../shared/prisma/prisma.service';

@ApiTags('Health')
@Controller('api/health')
@Injectable()
export class HealthController {
  constructor(private prisma: PrismaService) {}

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
  @ApiOperation({ summary: 'Readiness check with database connectivity' })
  @ApiResponse({ status: 200, description: 'Service is ready' })
  @ApiResponse({ status: 503, description: 'Service is not ready' })
  async readiness() {
    let dbStatus = 'unknown';
    let dbLatencyMs: number | null = null;
    let dbError: string | null = null;

    try {
      const start = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      dbLatencyMs = Date.now() - start;
      dbStatus = 'connected';
    } catch (error: any) {
      dbStatus = 'disconnected';
      dbError = error?.message || 'Unknown database error';
    }

    return {
      status: dbStatus === 'connected' ? 'ready' : 'degraded',
      timestamp: new Date().toISOString(),
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
        error: dbError,
      },
    };
  }

  @Get('debug')
  @ApiOperation({ summary: 'Debug database schema' })
  async debug() {
    const results: any = {};
    
    try {
      results.articleTableExists = await this.prisma.$queryRaw`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'Article')`;
    } catch (error: any) {
      results.articleTableExistsError = error?.message;
    }
    
    try {
      results.articleColumns = await this.prisma.$queryRaw`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'Article' ORDER BY ordinal_position`;
    } catch (error: any) {
      results.articleColumnsError = error?.message;
    }
    
    try {
      const start = Date.now();
      results.rawArticles = await this.prisma.$queryRaw`SELECT id, slug, title, excerpt, readMinutes, categoryId, authorId, likesCount, views, featured, isPublished, createdAt, updatedAt FROM "Article" WHERE "isPublished" = true AND "deletedAt" IS NULL LIMIT 3`;
      results.rawQueryLatency = Date.now() - start;
    } catch (error: any) {
      results.rawArticlesError = {
        message: error?.message,
        code: error?.code,
        stack: error?.stack,
      };
    }
    
    try {
      const start = Date.now();
      results.prismaArticles = await this.prisma.article.findMany({
        where: { isPublished: true, deletedAt: null },
        take: 3,
      });
      results.prismaQueryLatency = Date.now() - start;
    } catch (error: any) {
      results.prismaArticlesError = {
        message: error?.message,
        code: error?.code,
        stack: error?.stack,
      };
    }
    
    return {
      timestamp: new Date().toISOString(),
      ...results,
    };
  }
}
