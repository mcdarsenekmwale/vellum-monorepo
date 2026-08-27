import {
  Controller, Sse, UseGuards, MessageEvent, Req, OnModuleInit,
} from '@nestjs/common';
import { Request } from 'express';
import { interval, from, Observable, switchMap } from 'rxjs';
import { map } from 'rxjs/operators';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { MetricsCollectorService } from './metrics-collector.service';
import { CacheService } from '../../shared/cache/cache.service';

@Controller('api/admin')
export class AdminSseController implements OnModuleInit {
  constructor(
    private readonly metrics: MetricsCollectorService,
    private readonly cache: CacheService,
  ) {}

  onModuleInit() {
    const client = this.cache.getClient?.();
    if (client && typeof (client as any).subscribe === 'function') {
      (client as any).subscribe('admin:status:alerts').catch(() => {});
      if (typeof (client as any).on === 'function') {
        (client as any).on('message', (channel: string, message: string) => {
          if (channel !== 'admin:status:alerts') return;
        });
      }
    }
  }

  @Sse('metrics/stream')
  @UseGuards(JwtAuthGuard, AdminGuard)
  stream(@Req() _req: Request): Observable<MessageEvent> {
    return interval(15_000).pipe(
      switchMap(() => from(this.metrics.getLatestStatuses()).pipe(
        map((statuses) => {
          const sArr: any[] = statuses as any[];
          const overall = sArr.every((s) => s.status === 'healthy') ? 'operational'
            : sArr.some((s) => s.status === 'down') ? 'outage' : 'degraded';
          return {
            type: 'snapshot',
            data: { overall, updatedAt: new Date().toISOString(), statuses: sArr },
          } as MessageEvent;
        }),
      )),
    );
  }
}
