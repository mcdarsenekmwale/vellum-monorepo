import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminSseController } from './admin.sse.controller';
import { AdminService } from './admin.service';
import { SoftDeleteCronService } from './soft-delete-cron.service';
import { WebhookTestService } from './webhook-test.service';
import { MetricsCollectorService } from './metrics-collector.service';
import { ThresholdEvaluatorService } from './threshold-evaluator.service';
import { PrismaModule } from '../../shared/prisma/prisma.module';
import { CacheModule } from '../../shared/cache/cache.module';
import { AccessRequestsModule } from '../access-requests/access-requests.module';
import { WebhooksModule } from '../webhooks/webhooks.module';

@Module({
  imports: [PrismaModule, CacheModule, AccessRequestsModule, WebhooksModule],
  controllers: [AdminController, AdminSseController],
  providers: [AdminService, SoftDeleteCronService, WebhookTestService, MetricsCollectorService, ThresholdEvaluatorService],
  exports: [AdminService, WebhookTestService],
})
export class AdminModule {}