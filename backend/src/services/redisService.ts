import Redis from 'ioredis';
import { config } from '../config';

class RedisService {
  private client: Redis | null = null;

  constructor() {
    if (config.REDIS_URL) {
      this.client = new Redis(config.REDIS_URL, {
        maxRetriesPerRequest: 3,
      });

      this.client.on('error', (err) => {
        console.error('[Redis] Connection Error:', err);
      });

      this.client.on('connect', () => {
        console.log('[Redis] Connected successfully ✓');
      });
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.client) return null;
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (!this.client) return;
    if (ttlSeconds) {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.client) return;
    await this.client.del(key);
  }

  /**
   * Simple distributed rate limiter
   */
  async isRateLimited(key: string, limit: number, windowSeconds: number): Promise<boolean> {
    if (!this.client) return false;

    const current = await this.client.incr(key);
    if (current === 1) {
      await this.client.expire(key, windowSeconds);
    }

    return current > limit;
  }
}

export const redisService = new RedisService();
