import { Module } from '@nestjs/common';
import { HighlightsController } from './highlights.controller';
import { HighlightsService } from './highlights.service';
import { PrismaModule } from '../../shared/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [HighlightsController],
  providers: [HighlightsService],
})
export class HighlightsModule {}