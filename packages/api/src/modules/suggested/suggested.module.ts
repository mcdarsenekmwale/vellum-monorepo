import { Module } from '@nestjs/common';
import { SuggestedController } from './suggested.controller';
import { SuggestedService } from './suggested.service';
import { PrismaModule } from '../../shared/prisma/prisma.module';
import { CacheModule } from '../../shared/cache/cache.module';

@Module({
  imports: [PrismaModule, CacheModule],
  controllers: [SuggestedController],
  providers: [SuggestedService],
})
export class SuggestedModule {}
