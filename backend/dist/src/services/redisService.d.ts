declare class RedisService {
    private client;
    constructor();
    get(key: string): Promise<string | null>;
    set(key: string, value: string, ttlSeconds?: number): Promise<void>;
    del(key: string): Promise<void>;
    /**
     * Simple distributed rate limiter
     */
    isRateLimited(key: string, limit: number, windowSeconds: number): Promise<boolean>;
}
export declare const redisService: RedisService;
export {};
//# sourceMappingURL=redisService.d.ts.map