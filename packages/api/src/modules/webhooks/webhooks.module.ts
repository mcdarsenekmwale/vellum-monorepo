import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { WebhookExecutorService, WebhookSignatureService } from './webhook-executor.service';
import { TeamsIntegrationService } from './teams-integration.service';
import { PrismaModule } from '../../shared/prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    HttpModule.register({
      timeout: 15_000,
      maxRedirects: 3,
      transitional: {
        clarifyTimeoutError: true,
      },
    }),
  ],
  controllers: [WebhooksController],
  providers: [
    WebhooksService,
    WebhookExecutorService,
    WebhookSignatureService,
    TeamsIntegrationService,
  ],
  exports: [WebhooksService, WebhookExecutorService, TeamsIntegrationService, HttpModule],
})
export class WebhooksModule {}
