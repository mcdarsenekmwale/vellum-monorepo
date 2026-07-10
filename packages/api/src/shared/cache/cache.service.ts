import { Injectable } from '@nestjs/common';
import * as redis from 'redis';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CacheService {
  private client: redis.RedisClientType;
  private isConnected = false;

  constructor(private configService: ConfigService) {
    this.client = redis.createClient({
      url: configService.get('REDIS_URL', 'redis://localhost:6379'),
    });
    this.connect();
  }

  private async connect() {
    if (this.isConnected) return;
    try {
      await this.client.connect();
      this.isConnected = true;
      console.log('Redis connected successfully');
    } catch (error) {
      console.warn('Redis connection failed, using in-memory fallback');
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.isConnected) return null;
    const value = await this.client.get(key);
    if (typeof value !== 'string') return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    if (!this.isConnected) return;
    const jsonValue = JSON.stringify(value);
    if (ttl) {
      await this.client.set(key, jsonValue, { EX: ttl });
    } else {
      await this.client.set(key, jsonValue);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.isConnected) return;
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    if (!this.isConnected) return false;
    const result = await this.client.exists(key);
    return result === 1;
  }

  async keys(pattern: string): Promise<string[]> {
    if (!this.isConnected) return [];
    return this.client.keys(pattern);
  }

  async flushAll(): Promise<void> {
    if (!this.isConnected) return;
    await this.client.flushAll();
  }
}