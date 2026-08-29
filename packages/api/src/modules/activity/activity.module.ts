import { Module } from '@nestjs/common';
import { ActivityAggregatorService } from './activity-aggregator.service';
import { ActivityReminderService } from './activity-reminder.service';
import { ActivityController } from './activity.controller';
import { PrismaModule } from '../../shared/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ActivityController],
  providers: [ActivityAggregatorService, ActivityReminderService],
  exports: [ActivityAggregatorService],
})
export class ActivityModule {}
