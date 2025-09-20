import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { createHash } from 'crypto';

export interface IdempotencyOptions {
  ttl?: number; // TTL in seconds, default 86400 (24 hours)
  keyPrefix?: string; // Key prefix, default 'idem'
}

export interface IdempotencyResult<T> {
  data: T;
  isFromCache: boolean;
}

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);
  private readonly redis: Redis;
  private readonly defaultTtl = 86400; // 24 hours
  private readonly defaultKeyPrefix = 'idem';

  constructor(private readonly configService: ConfigService) {
    this.redis = new Redis({
      host: this.configService.get('REDIS_HOST') || 'localhost',
      port: this.configService.get('REDIS_PORT') || 6379,
      password: this.configService.get('REDIS_PASSWORD'),
      db: this.configService.get('REDIS_DB') || 0,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
    });

    this.redis.on('error', (error) => {
      this.logger.error('Redis connection error:', error);
    });

    this.redis.on('connect', () => {
      this.logger.log('Connected to Redis for idempotency service');
    });
  }

  /**
   * Ensures idempotent execution of an operation
   * @param key Unique identifier for the operation
   * @param operation Function to execute if not cached
   * @param options Configuration options
   */
  async ensureIdempotent<T>(
    key: string,
    operation: () => Promise<T>,
    options: IdempotencyOptions = {},
  ): Promise<IdempotencyResult<T>> {
    const { ttl = this.defaultTtl, keyPrefix = this.defaultKeyPrefix } = options;
    const cacheKey = `${keyPrefix}:${key}`;

    try {
      // Check if result already exists
      const existing = await this.redis.get(cacheKey);
      if (existing) {
        this.logger.debug(`Idempotency cache hit for key: ${cacheKey}`);
        return {
          data: JSON.parse(existing),
          isFromCache: true,
        };
      }

      // Execute operation
      this.logger.debug(`Executing operation for key: ${cacheKey}`);
      const result = await operation();

      // Cache the result
      await this.redis.setex(cacheKey, ttl, JSON.stringify(result));
      this.logger.debug(`Cached result for key: ${cacheKey}, TTL: ${ttl}s`);

      return {
        data: result,
        isFromCache: false,
      };
    } catch (error) {
      this.logger.error(`Error in idempotent operation for key ${cacheKey}:`, error);
      throw error;
    }
  }

  /**
   * Generates a fingerprint for request deduplication
   * @param userId User identifier
   * @param endpoint API endpoint
   * @param payload Request payload
   */
  generateRequestFingerprint(
    userId: string,
    endpoint: string,
    payload: any,
  ): string {
    const data = {
      userId,
      endpoint,
      payload: this.normalizePayload(payload),
    };

    const hash = createHash('sha256')
      .update(JSON.stringify(data))
      .digest('hex');

    return hash.substring(0, 16); // Use first 16 characters for brevity
  }

  /**
   * Validates idempotency key format
   * @param key Idempotency key to validate
   */
  validateIdempotencyKey(key: string): boolean {
    // Key should be 16-64 characters, alphanumeric with hyphens/underscores
    const keyRegex = /^[a-zA-Z0-9_-]{16,64}$/;
    return keyRegex.test(key);
  }

  /**
   * Manually invalidate an idempotency key
   * @param key Idempotency key to invalidate
   * @param keyPrefix Optional key prefix
   */
  async invalidateKey(key: string, keyPrefix = this.defaultKeyPrefix): Promise<void> {
    const cacheKey = `${keyPrefix}:${key}`;
    await this.redis.del(cacheKey);
    this.logger.debug(`Invalidated idempotency key: ${cacheKey}`);
  }

  /**
   * Get TTL for an idempotency key
   * @param key Idempotency key
   * @param keyPrefix Optional key prefix
   */
  async getKeyTtl(key: string, keyPrefix = this.defaultKeyPrefix): Promise<number> {
    const cacheKey = `${keyPrefix}:${key}`;
    return await this.redis.ttl(cacheKey);
  }

  /**
   * Check if an idempotency key exists
   * @param key Idempotency key
   * @param keyPrefix Optional key prefix
   */
  async keyExists(key: string, keyPrefix = this.defaultKeyPrefix): Promise<boolean> {
    const cacheKey = `${keyPrefix}:${key}`;
    const exists = await this.redis.exists(cacheKey);
    return exists === 1;
  }

  /**
   * Normalize payload for consistent fingerprinting
   * @param payload Request payload
   */
  private normalizePayload(payload: any): any {
    if (payload === null || payload === undefined) {
      return null;
    }

    if (typeof payload !== 'object') {
      return payload;
    }

    if (Array.isArray(payload)) {
      return payload.map(item => this.normalizePayload(item)).sort();
    }

    // Sort object keys for consistent hashing
    const normalized: any = {};
    const sortedKeys = Object.keys(payload).sort();
    
    for (const key of sortedKeys) {
      // Skip undefined values and functions
      if (payload[key] !== undefined && typeof payload[key] !== 'function') {
        normalized[key] = this.normalizePayload(payload[key]);
      }
    }

    return normalized;
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }
}