import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheService } from './services/cache.service';
import { CacheInterceptor, CacheInvalidationInterceptor } from './interceptors/cache.interceptor';
import { QueryOptimizerService } from '../infra/database/query-optimizer.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    CacheService,
    CacheInterceptor,
    CacheInvalidationInterceptor,
    QueryOptimizerService,
  ],
  exports: [
    CacheService,
    CacheInterceptor,
    CacheInvalidationInterceptor,
    QueryOptimizerService,
  ],
})
export class PerformanceModule {}