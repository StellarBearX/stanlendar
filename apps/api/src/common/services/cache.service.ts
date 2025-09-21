import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string;
  compress?: boolean;
}

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private redis: Redis;
  private defaultTtl = 3600; // 1 hour

  constructor(private configService: ConfigService) {
    this.redis = new Redis({
      host: this.configService.get('REDIS_HOST', 'localhost'),
      port: this.configService.get('REDIS_PORT', 6379),
      password: this.configService.get('REDIS_PASSWORD'),
      keyPrefix: 'cache:',
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    this.redis.on('error', (error) => {
      this.logger.error('Redis connection error:', error);
    });

    this.redis.on('connect', () => {
      this.logger.log('Redis connected successfully');
    });
  }

  async get<T>(key: string, options?: CacheOptions): Promise<T | null> {
    try {
      const fullKey = this.buildKey(key, options?.prefix);
      const value = await this.redis.get(fullKey);
      
      if (!value) {
        return null;
      }

      const parsed = JSON.parse(value);
      
      if (options?.compress && parsed.compressed) {
        // Decompress if needed (simplified - in production use proper compression)
        return JSON.parse(parsed.data);
      }

      return parsed;
    } catch (error) {
      this.logger.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    try {
      const fullKey = this.buildKey(key, options?.prefix);
      const ttl = options?.ttl || this.defaultTtl;
      
      let serialized: string;
      
      if (options?.compress) {
        // Compress large objects (simplified - in production use proper compression)
        serialized = JSON.stringify({
          compressed: true,
          data: JSON.stringify(value)
        });
      } else {
        serialized = JSON.stringify(value);
      }

      await this.redis.setex(fullKey, ttl, serialized);
    } catch (error) {
      this.logger.error(`Cache set error for key ${key}:`, error);
    }
  }

  async del(key: string, options?: CacheOptions): Promise<void> {
    try {
      const fullKey = this.buildKey(key, options?.prefix);
      await this.redis.del(fullKey);
    } catch (error) {
      this.logger.error(`Cache delete error for key ${key}:`, error);
    }
  }

  async mget<T>(keys: string[], options?: CacheOptions): Promise<(T | null)[]> {
    try {
      const fullKeys = keys.map(key => this.buildKey(key, options?.prefix));
      const values = await this.redis.mget(...fullKeys);
      
      return values.map(value => {
        if (!value) return null;
        try {
          return JSON.parse(value);
        } catch {
          return null;
        }
      });
    } catch (error) {
      this.logger.error('Cache mget error:', error);
      return keys.map(() => null);
    }
  }

  async mset<T>(keyValuePairs: Array<[string, T]>, options?: CacheOptions): Promise<void> {
    try {
      const ttl = options?.ttl || this.defaultTtl;
      const pipeline = this.redis.pipeline();
      
      for (const [key, value] of keyValuePairs) {
        const fullKey = this.buildKey(key, options?.prefix);
        const serialized = JSON.stringify(value);
        pipeline.setex(fullKey, ttl, serialized);
      }
      
      await pipeline.exec();
    } catch (error) {
      this.logger.error('Cache mset error:', error);
    }
  }

  async invalidatePattern(pattern: string, options?: CacheOptions): Promise<void> {
    try {
      const fullPattern = this.buildKey(pattern, options?.prefix);
      const keys = await this.redis.keys(fullPattern);
      
      if (keys.length > 0) {
        await this.redis.del(...keys);
        this.logger.log(`Invalidated ${keys.length} cache keys matching pattern: ${pattern}`);
      }
    } catch (error) {
      this.logger.error(`Cache pattern invalidation error for ${pattern}:`, error);
    }
  }

  async getOrSet<T>(
    key: string, 
    factory: () => Promise<T>, 
    options?: CacheOptions
  ): Promise<T> {
    const cached = await this.get<T>(key, options);
    
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    await this.set(key, value, options);
    return value;
  }

  async increment(key: string, by: number = 1, options?: CacheOptions): Promise<number> {
    try {
      const fullKey = this.buildKey(key, options?.prefix);
      const result = await this.redis.incrby(fullKey, by);
      
      if (options?.ttl) {
        await this.redis.expire(fullKey, options.ttl);
      }
      
      return result;
    } catch (error) {
      this.logger.error(`Cache increment error for key ${key}:`, error);
      return 0;
    }
  }

  async exists(key: string, options?: CacheOptions): Promise<boolean> {
    try {
      const fullKey = this.buildKey(key, options?.prefix);
      const result = await this.redis.exists(fullKey);
      return result === 1;
    } catch (error) {
      this.logger.error(`Cache exists error for key ${key}:`, error);
      return false;
    }
  }

  async ttl(key: string, options?: CacheOptions): Promise<number> {
    try {
      const fullKey = this.buildKey(key, options?.prefix);
      return await this.redis.ttl(fullKey);
    } catch (error) {
      this.logger.error(`Cache TTL error for key ${key}:`, error);
      return -1;
    }
  }

  async flushAll(): Promise<void> {
    try {
      await this.redis.flushall();
      this.logger.log('Cache flushed successfully');
    } catch (error) {
      this.logger.error('Cache flush error:', error);
    }
  }

  private buildKey(key: string, prefix?: string): string {
    return prefix ? `${prefix}:${key}` : key;
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }
}

// Cache decorators for method-level caching
export function Cacheable(options?: CacheOptions) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const cacheService: CacheService = this.cacheService;
      
      if (!cacheService) {
        return method.apply(this, args);
      }

      const cacheKey = `${target.constructor.name}:${propertyName}:${JSON.stringify(args)}`;
      
      return cacheService.getOrSet(
        cacheKey,
        () => method.apply(this, args),
        options
      );
    };
  };
}

export function CacheEvict(keyPattern: string, options?: CacheOptions) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const result = await method.apply(this, args);
      
      const cacheService: CacheService = this.cacheService;
      if (cacheService) {
        await cacheService.invalidatePattern(keyPattern, options);
      }
      
      return result;
    };
  };
}