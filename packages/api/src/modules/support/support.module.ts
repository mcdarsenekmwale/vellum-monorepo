import { Module } from '@nestjs/common';
import { SupportController } from './support.controller';
import { HelpController } from './help.controller';
import { SupportService } from './support.service';
import { PrismaModule } from '../../shared/prisma/prisma.module';
import { RbacModule } from '../rbac/rbac.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, RbacModule, AuthModule],
  controllers: [SupportController, HelpController],
  providers: [SupportService],
  exports: [SupportService],
})
export class SupportModule {}
