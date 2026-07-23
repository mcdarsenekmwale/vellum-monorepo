import { Module } from '@nestjs/common';
import { SuggestedController } from './suggested.controller';
import { SuggestedService } from './suggested.service';
import { PrismaModule } from '../../shared/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SuggestedController],
  providers: [SuggestedService],
})
export class SuggestedModule {}
