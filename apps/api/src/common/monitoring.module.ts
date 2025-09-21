import { Module, Global } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { StructuredLoggerService } from './services/logger.service'
import { MetricsService } from './services/metrics.service'
import { ErrorTrackingService } from './services/error-tracking.service'
import { PerformanceMonitorService } from './services/performance-monitor.service'
import { HealthController } from './controllers/health.controller'
import { LoggingInterceptor } from './interceptors/logging.interceptor'

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    StructuredLoggerService,
    MetricsService,
    ErrorTrackingService,
    PerformanceMonitorService,
    LoggingInterceptor,
  ],
  controllers: [HealthController],
  exports: [
    StructuredLoggerService,
    MetricsService,
    ErrorTrackingService,
    PerformanceMonitorService,
    LoggingInterceptor,
  ],
})
export class MonitoringModule {}