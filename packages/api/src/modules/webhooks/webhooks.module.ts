import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { WebhookExecutorService, WebhookSignatureService } from './webhook-executor.service';
import { TeamsIntegrationService } from './teams-integration.service';
import { PrismaModule } from '../../shared/prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [WebhooksController],
  providers: [
    WebhooksService,
    WebhookExecutorService,
    WebhookSignatureService,
    TeamsIntegrationService,
  ],
  exports: [WebhooksService, WebhookExecutorService, TeamsIntegrationService],
})
export class WebhooksModule {}
