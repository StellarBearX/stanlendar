import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { CacheService, CacheOptions } from '../services/cache.service';
import { Request } from 'express';

export const CACHE_KEY_METADATA = 'cache_key';
export const CACHE_TTL_METADATA = 'cache_ttl';

export const CacheKey = (key: string) => (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) => {
  if (descriptor) {
    Reflect.defineMetadata(CACHE_KEY_METADATA, key, descriptor.value);
    return descriptor;
  }
  Reflect.defineMetadata(CACHE_KEY_METADATA, key, target);
  return target;
};

export const CacheTTL = (ttl: number) => (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) => {
  if (descriptor) {
    Reflect.defineMetadata(CACHE_TTL_METADATA, ttl, descriptor.value);
    return descriptor;
  }
  Reflect.defineMetadata(CACHE_TTL_METADATA, ttl, target);
  return target;
};

@Injectable()
export class CacheInterceptor implements NestInterceptor {
  constructor(
    private cacheService: CacheService,
    private reflector: Reflector
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest<Request>();
    const handler = context.getHandler();
    
    // Only cache GET requests
    if (request.method !== 'GET') {
      return next.handle();
    }

    // Get cache configuration from metadata
    const cacheKey = this.reflector.get<string>(CACHE_KEY_METADATA, handler);
    const cacheTTL = this.reflector.get<number>(CACHE_TTL_METADATA, handler);
    
    if (!cacheKey) {
      return next.handle();
    }

    // Build cache key with request parameters
    const fullCacheKey = this.buildCacheKey(cacheKey, request);
    
    // Try to get from cache
    const cachedResult = await this.cacheService.get(fullCacheKey);
    if (cachedResult !== null) {
      return of(cachedResult);
    }

    // Execute handler and cache result
    return next.handle().pipe(
      tap(async (response) => {
        if (response && !this.isErrorResponse(response)) {
          const options: CacheOptions = {
            ttl: cacheTTL || 300, // Default 5 minutes
            prefix: 'http_cache'
          };
          
          await this.cacheService.set(fullCacheKey, response, options);
        }
      })
    );
  }

  private buildCacheKey(baseKey: string, request: Request): string {
    const userId = (request as any).user?.id || 'anonymous';
    const queryString = new URLSearchParams(request.query as any).toString();
    const pathParams = JSON.stringify(request.params);
    
    return `${baseKey}:${userId}:${request.path}:${pathParams}:${queryString}`;
  }

  private isErrorResponse(response: any): boolean {
    return response && response.statusCode && response.statusCode >= 400;
  }
}

@Injectable()
export class CacheInvalidationInterceptor implements NestInterceptor {
  constructor(private cacheService: CacheService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest<Request>();
    
    // Only invalidate cache for state-changing operations
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(async (response) => {
        if (response && !this.isErrorResponse(response)) {
          await this.invalidateRelatedCache(request);
        }
      })
    );
  }

  private async invalidateRelatedCache(request: Request): Promise<void> {
    const userId = (request as any).user?.id;
    if (!userId) return;

    // Invalidate user-specific caches based on the endpoint
    const patterns = this.getCacheInvalidationPatterns(request.path, userId);
    
    for (const pattern of patterns) {
      await this.cacheService.invalidatePattern(pattern, { prefix: 'http_cache' });
    }
  }

  private getCacheInvalidationPatterns(path: string, userId: string): string[] {
    const patterns: string[] = [];
    
    if (path.includes('/subjects')) {
      patterns.push(`*subjects*:${userId}:*`);
      patterns.push(`*events*:${userId}:*`);
      patterns.push(`*spotlight*:${userId}:*`);
    }
    
    if (path.includes('/sections')) {
      patterns.push(`*sections*:${userId}:*`);
      patterns.push(`*events*:${userId}:*`);
    }
    
    if (path.includes('/events')) {
      patterns.push(`*events*:${userId}:*`);
      patterns.push(`*calendar*:${userId}:*`);
    }
    
    if (path.includes('/sync')) {
      patterns.push(`*sync*:${userId}:*`);
      patterns.push(`*events*:${userId}:*`);
      patterns.push(`*calendar*:${userId}:*`);
    }
    
    if (path.includes('/import')) {
      patterns.push(`*import*:${userId}:*`);
      patterns.push(`*subjects*:${userId}:*`);
      patterns.push(`*sections*:${userId}:*`);
      patterns.push(`*events*:${userId}:*`);
    }

    return patterns;
  }

  private isErrorResponse(response: any): boolean {
    return response && response.statusCode && response.statusCode >= 400;
  }
}