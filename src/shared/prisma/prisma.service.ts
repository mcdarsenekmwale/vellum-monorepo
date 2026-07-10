import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(configService: ConfigService) {
    const databaseUrl = configService.get<string>('DATABASE_URL');
    const connectionLimit = configService.get<string>('PRISMA_CONNECTION_LIMIT', '5');
    const poolTimeout = configService.get<string>('PRISMA_POOL_TIMEOUT', '10');
    const connectionTimeout = configService.get<string>('PRISMA_CONNECTION_TIMEOUT', '5');

    const urlWithParams = databaseUrl
      ? `${databaseUrl}${databaseUrl.includes('?') ? '&' : '?'}connection_limit=${connectionLimit}&pool_timeout=${poolTimeout}&connect_timeout=${connectionTimeout}`
      : undefined;

    super({
      datasources: urlWithParams
        ? {
            db: {
              url: urlWithParams,
            },
          }
        : undefined,
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });
  }

  async onModuleInit() {
    const maxRetries = 5;
    const retryDelay = 3000;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.$connect();
        this.logger.log('Prisma client connected successfully');
        return;
      } catch (error) {
        this.logger.error(`Prisma connection attempt ${attempt}/${maxRetries} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        if (attempt < maxRetries) {
          this.logger.log(`Retrying in ${retryDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }
    this.logger.error('Prisma connection failed after all retries');
    throw new Error('Failed to connect to database after multiple attempts');
  }

  async onModuleDestroy() {
    try {
      await this.$disconnect();
      this.logger.log('Prisma client disconnected');
    } catch (error) {
      this.logger.error(`Error disconnecting Prisma client: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async $runCommandRaw(query: string) {
    return this.$queryRawUnsafe(query);
  }

  async retryOnConnectionError<T>(fn: () => Promise<T>): Promise<T> {
    const maxRetries = 3;
    const delay = 2000;
    const retryableCodes = ['P1001', 'P2024'];
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        if (error?.code && retryableCodes.includes(error.code) && attempt < maxRetries) {
          this.logger.warn(`Connection error (${error.code}), retrying attempt ${attempt}/${maxRetries}...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          throw error;
        }
      }
    }
    throw new Error('Operation failed after retries');
  }
}
