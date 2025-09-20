import { Injectable, NestMiddleware, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private redis: Redis;
  private options: RateLimitOptions;

  constructor(private configService: ConfigService) {
    this.redis = new Redis({
      host: this.configService.get('REDIS_HOST', 'localhost'),
      port: this.configService.get('REDIS_PORT', 6379),
      password: this.configService.get('REDIS_PASSWORD'),
      keyPrefix: 'rate_limit:',
    });

    this.options = {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 100, // 100 requests per 15 minutes
      keyGenerator: (req: Request) => req.ip,
    };
  }

  async use(req: Request, res: Response, next: NextFunction) {
    const key = this.options.keyGenerator!(req);
    const windowStart = Math.floor(Date.now() / this.options.windowMs);
    const redisKey = `${key}:${windowStart}`;

    try {
      const current = await this.redis.incr(redisKey);
      
      if (current === 1) {
        // Set expiration for the key
        await this.redis.expire(redisKey, Math.ceil(this.options.windowMs / 1000));
      }

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', this.options.maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, this.options.maxRequests - current));
      res.setHeader('X-RateLimit-Reset', new Date(Date.now() + this.options.windowMs).toISOString());

      if (current > this.options.maxRequests) {
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: 'Too many requests',
            error: 'Rate limit exceeded',
          },
          HttpStatus.TOO_MANY_REQUESTS
        );
      }

      next();
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      
      // If Redis is down, allow the request but log the error
      console.error('Rate limiting error:', error);
      next();
    }
  }
}

@Injectable()
export class AuthRateLimitMiddleware implements NestMiddleware {
  private redis: Redis;

  constructor(private configService: ConfigService) {
    this.redis = new Redis({
      host: this.configService.get('REDIS_HOST', 'localhost'),
      port: this.configService.get('REDIS_PORT', 6379),
      password: this.configService.get('REDIS_PASSWORD'),
      keyPrefix: 'auth_rate_limit:',
    });
  }

  async use(req: Request, res: Response, next: NextFunction) {
    // More restrictive rate limiting for auth endpoints
    const key = req.ip;
    const windowStart = Math.floor(Date.now() / (5 * 60 * 1000)); // 5 minute window
    const redisKey = `${key}:${windowStart}`;
    const maxRequests = 10; // 10 auth requests per 5 minutes

    try {
      const current = await this.redis.incr(redisKey);
      
      if (current === 1) {
        await this.redis.expire(redisKey, 5 * 60); // 5 minutes
      }

      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - current));

      if (current > maxRequests) {
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: 'Too many authentication attempts',
            error: 'Auth rate limit exceeded',
          },
          HttpStatus.TOO_MANY_REQUESTS
        );
      }

      next();
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      
      console.error('Auth rate limiting error:', error);
      next();
    }
  }
}