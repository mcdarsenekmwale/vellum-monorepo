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
}
