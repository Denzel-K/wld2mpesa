"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisService = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const config_1 = require("../config");
class RedisService {
    constructor() {
        this.client = null;
        if (config_1.config.REDIS_URL) {
            this.client = new ioredis_1.default(config_1.config.REDIS_URL, {
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
    async get(key) {
        if (!this.client)
            return null;
        return this.client.get(key);
    }
    async set(key, value, ttlSeconds) {
        if (!this.client)
            return;
        if (ttlSeconds) {
            await this.client.set(key, value, 'EX', ttlSeconds);
        }
        else {
            await this.client.set(key, value);
        }
    }
    async del(key) {
        if (!this.client)
            return;
        await this.client.del(key);
    }
    /**
     * Simple distributed rate limiter
     */
    async isRateLimited(key, limit, windowSeconds) {
        if (!this.client)
            return false;
        const current = await this.client.incr(key);
        if (current === 1) {
            await this.client.expire(key, windowSeconds);
        }
        return current > limit;
    }
}
exports.redisService = new RedisService();
//# sourceMappingURL=redisService.js.map