import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { SoftDeleteCronService } from './soft-delete-cron.service';
import { PrismaModule } from '../../shared/prisma/prisma.module';
import { CacheModule } from '../../shared/cache/cache.module';
import { AccessRequestsModule } from '../access-requests/access-requests.module';

@Module({
  imports: [PrismaModule, CacheModule, AccessRequestsModule],
  controllers: [AdminController],
  providers: [AdminService, SoftDeleteCronService],
  exports: [AdminService],
})
export class AdminModule {}