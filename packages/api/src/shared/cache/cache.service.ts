import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as redis from 'redis';
import { ConfigService } from '@nestjs/config';

const CACHE_KEY_PREFIX = 'cache:';
const DEFAULT_REDIS_URL = 'redis://localhost:6379';

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private client: redis.RedisClientType | null = null;
  private isConnected = false;
  private connectionPromise: Promise<void> | null = null;
  private redisUrl: string;
  private isProd: boolean;

  constructor(private configService: ConfigService) {
    this.redisUrl = this.configService.get('REDIS_URL', DEFAULT_REDIS_URL);
    this.isProd = this.configService.get('NODE_ENV') === 'production';
    console.log(`[Cache] Environment: ${this.isProd ? 'production' : 'development'}`);
    const maskedUrl = this.redisUrl.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@');
    console.log(`[Cache] Redis URL configured: ${maskedUrl}`);
  }

  async onModuleInit() {
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

  getStatus() {
    return {
      connected: this.isConnected,
      url: this.redisUrl.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@'),
    };
  }
}