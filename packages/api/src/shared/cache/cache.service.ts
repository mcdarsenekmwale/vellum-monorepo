import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as redis from 'redis';
import { ConfigService } from '@nestjs/config';

const CACHE_KEY_PREFIX = 'cache:';
const DEFAULT_REDIS_HOST = '127.0.0.1';
const DEFAULT_REDIS_PORT = 6379;
const DEFAULT_REDIS_URL = `redis://${DEFAULT_REDIS_HOST}:${DEFAULT_REDIS_PORT}`;

function buildRedisUrl(configService: ConfigService): string {
  const explicitUrl = configService.get<string>('REDIS_URL');
  if (explicitUrl) return explicitUrl;
  const host = configService.get<string>('REDIS_HOST', DEFAULT_REDIS_HOST);
  const port = configService.get<number>('REDIS_PORT', DEFAULT_REDIS_PORT);
  const password = configService.get<string>('REDIS_PASSWORD');
  const user = configService.get<string>('REDIS_USER');
  if (password || user) {
    const auth = user ? `${user}:${password ?? ''}` : password;
    return `redis://${auth}@${host}:${port}`;
  }
  return `redis://${host}:${port}`;
}

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private client: redis.RedisClientType | null = null;
  private isConnected = false;
  private connectionPromise: Promise<void> | null = null;
  private redisUrl: string;
  private isProd: boolean;
  private enabled: boolean;

  constructor(private configService: ConfigService) {
    const enabledRaw = this.configService.get<string>('REDIS_ENABLED', 'true');
    this.enabled = enabledRaw !== 'false' && enabledRaw !== '0';
    this.redisUrl = buildRedisUrl(this.configService);
    this.isProd = this.configService.get('NODE_ENV') === 'production';
    console.log(`[Cache] Environment: ${this.isProd ? 'production' : 'development'}`);
    console.log(`[Cache] REDIS_ENABLED: ${this.enabled}`);
    const maskedUrl = this.redisUrl.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@');
    console.log(`[Cache] Redis URL configured: ${maskedUrl}`);
  }

  async onModuleInit() {
    if (!this.enabled) {
      console.log('[Cache] REDIS_DISABLED by env (REDIS_ENABLED=false), cache skipped');
      return;
    }
    if (!this.redisUrl) {
      console.warn('[Cache] No REDIS_URL configured, cache disabled');
      return;
    }
    this.connect();
  }

  async onModuleDestroy() {
    if (this.client) {
      try {
        await this.client.quit();
      } catch {
        // ignore
      }
    }
  }

  private async connect() {
    if (this.connectionPromise) return this.connectionPromise;
    
    this.connectionPromise = this.doConnect();
    return this.connectionPromise;
  }

  private async doConnect() {
    try {
      console.log('[Cache] Connecting to Redis...');
      this.client = redis.createClient({ 
        url: this.redisUrl,
        socket: {
          connectTimeout: 5000,
          reconnectStrategy: (retries) => {
            if (retries > 5) {
              console.warn('[Cache] Max reconnection attempts reached, giving up');
              return new Error('Max reconnection attempts reached');
            }
            return Math.min(retries * 100, 3000);
          },
        },
      });

      this.client.on('error', (error) => {
        console.warn('[Cache] Redis error:', error.message);
      });

      this.client.on('ready', () => {
        this.isConnected = true;
        console.log('[Cache] Redis connected successfully');
      });

      await this.client.connect();
    } catch (error) {
      console.warn('[Cache] Redis connection failed, cache disabled. Error:', (error as Error).message);
      this.isConnected = false;
      this.client = null;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.isConnected || !this.client) return null;
    try {
      const value = await this.client.get(key);
      if (typeof value !== 'string') return null;
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    if (!this.isConnected || !this.client) return;
    try {
      const jsonValue = JSON.stringify(value);
      if (ttl) {
        await this.client.set(key, jsonValue, { EX: ttl });
      } else {
        await this.client.set(key, jsonValue);
      }
    } catch (error) {
      console.warn('[Cache] set failed:', (error as Error).message);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.isConnected || !this.client) return;
    try {
      await this.client.del(key);
    } catch (error) {
      console.warn('[Cache] del failed:', (error as Error).message);
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.isConnected || !this.client) return false;
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch {
      return false;
    }
  }

  async keys(pattern: string): Promise<string[]> {
    if (!this.isConnected || !this.client) return [];
    try {
      return this.client.keys(pattern);
    } catch {
      return [];
    }
  }

  async flushAll(): Promise<void> {
    if (!this.isConnected || !this.client) return;
    try {
      await this.client.flushAll();
    } catch (error) {
      console.warn('[Cache] flushAll failed:', (error as Error).message);
    }
  }

  async ping(): Promise<boolean> {
    if (!this.isConnected || !this.client) return false;
    try {
      const resp = await this.client.ping();
      return resp === 'PONG';
    } catch {
      return false;
    }
  }

  async publish(channel: string, message: string): Promise<number> {
    if (!this.isConnected || !this.client) return 0;
    try {
      return await this.client.publish(channel, message);
    } catch {
      return 0;
    }
  }

  async info(section?: string): Promise<string> {
    if (!this.isConnected || !this.client) return '';
    try {
      const resp = await this.client.info(section as any);
      return typeof resp === 'string' ? resp : '';
    } catch {
      return '';
    }
  }

  getStatus() {
    return {
      connected: this.isConnected,
      url: this.redisUrl.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@'),
    };
  }
}