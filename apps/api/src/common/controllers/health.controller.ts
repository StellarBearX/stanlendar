import { Controller, Get } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { DataSource } from 'typeorm'
import { StructuredLoggerService } from '../services/logger.service'
import { MetricsService } from '../services/metrics.service'
import { Public } from '../../modules/auth/decorators/public.decorator'
import Redis from 'ioredis'

export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded'
  timestamp: string
  version: string
  uptime: number
  checks: {
    database: HealthCheck
    redis: HealthCheck
    memory: HealthCheck
    disk?: HealthCheck
  }
  metrics?: any
}

export interface HealthCheck {
  status: 'healthy' | 'unhealthy' | 'degraded'
  responseTime?: number
  error?: string
  details?: any
}

@Controller('health')
export class HealthController {
  private readonly version: string
  private readonly startTime: number

  constructor(
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
    private readonly logger: StructuredLoggerService,
    private readonly metricsService: MetricsService,
  ) {
    this.version = this.configService.get('npm_package_version', '1.0.0')
    this.startTime = Date.now()
  }

  @Get()
  @Public()
  async getHealth(): Promise<HealthStatus> {
    const startTime = Date.now()
    
    try {
      const [databaseCheck, redisCheck, memoryCheck] = await Promise.all([
        this.checkDatabase(),
        this.checkRedis(),
        this.checkMemory(),
      ])

      const overallStatus = this.determineOverallStatus([
        databaseCheck,
        redisCheck,
        memoryCheck,
      ])

      const health: HealthStatus = {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        version: this.version,
        uptime: Date.now() - this.startTime,
        checks: {
          database: databaseCheck,
          redis: redisCheck,
          memory: memoryCheck,
        },
      }

      // Log health check
      this.logger.info('Health check completed', {
        status: overallStatus,
        duration: Date.now() - startTime,
        type: 'health_check',
      })

      // Record metrics
      this.metricsService.recordHistogram('health_check_duration_ms', Date.now() - startTime)
      this.metricsService.incrementCounter('health_checks_total', 1, {
        status: overallStatus,
      })

      return health
    } catch (error) {
      this.logger.error('Health check failed', { error })
      
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        version: this.version,
        uptime: Date.now() - this.startTime,
        checks: {
          database: { status: 'unhealthy', error: 'Health check failed' },
          redis: { status: 'unhealthy', error: 'Health check failed' },
          memory: { status: 'unhealthy', error: 'Health check failed' },
        },
      }
    }
  }

  @Get('ready')
  @Public()
  async getReadiness(): Promise<{ status: string; timestamp: string }> {
    // Readiness check - can the service handle requests?
    const databaseCheck = await this.checkDatabase()
    const redisCheck = await this.checkRedis()

    const isReady = databaseCheck.status === 'healthy' && redisCheck.status === 'healthy'

    return {
      status: isReady ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
    }
  }

  @Get('live')
  @Public()
  async getLiveness(): Promise<{ status: string; timestamp: string }> {
    // Liveness check - is the service alive?
    return {
      status: 'alive',
      timestamp: new Date().toISOString(),
    }
  }

  @Get('metrics')
  @Public()
  async getMetrics(): Promise<any> {
    // Update system metrics before returning
    this.metricsService.recordMemoryUsage()
    this.metricsService.recordCpuUsage()

    return {
      summary: this.metricsService.getMetricsSummary(),
      prometheus: this.metricsService.exportPrometheusMetrics(),
    }
  }

  @Get('metrics/prometheus')
  @Public()
  async getPrometheusMetrics(): Promise<string> {
    // Update system metrics before returning
    this.metricsService.recordMemoryUsage()
    this.metricsService.recordCpuUsage()

    return this.metricsService.exportPrometheusMetrics()
  }

  private async checkDatabase(): Promise<HealthCheck> {
    const startTime = Date.now()
    
    try {
      await this.dataSource.query('SELECT 1')
      
      const responseTime = Date.now() - startTime
      const status = responseTime > 1000 ? 'degraded' : 'healthy'
      
      return {
        status,
        responseTime,
        details: {
          connected: this.dataSource.isInitialized,
          connectionCount: this.dataSource.driver.master ? 1 : 0,
        },
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: error.message,
      }
    }
  }

  private async checkRedis(): Promise<HealthCheck> {
    const startTime = Date.now()
    
    try {
      const redis = new Redis(this.configService.get('REDIS_URL'))
      await redis.ping()
      await redis.disconnect()
      
      const responseTime = Date.now() - startTime
      const status = responseTime > 500 ? 'degraded' : 'healthy'
      
      return {
        status,
        responseTime,
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: error.message,
      }
    }
  }

  private checkMemory(): HealthCheck {
    const memUsage = process.memoryUsage()
    const heapUsedMB = memUsage.heapUsed / 1024 / 1024
    const heapTotalMB = memUsage.heapTotal / 1024 / 1024
    const rssMB = memUsage.rss / 1024 / 1024
    
    // Consider unhealthy if using more than 1GB heap or 2GB RSS
    const status = heapUsedMB > 1024 || rssMB > 2048 ? 'degraded' : 'healthy'
    
    return {
      status,
      details: {
        heapUsedMB: Math.round(heapUsedMB),
        heapTotalMB: Math.round(heapTotalMB),
        rssMB: Math.round(rssMB),
        externalMB: Math.round(memUsage.external / 1024 / 1024),
      },
    }
  }

  private determineOverallStatus(checks: HealthCheck[]): 'healthy' | 'unhealthy' | 'degraded' {
    const hasUnhealthy = checks.some(check => check.status === 'unhealthy')
    const hasDegraded = checks.some(check => check.status === 'degraded')
    
    if (hasUnhealthy) return 'unhealthy'
    if (hasDegraded) return 'degraded'
    return 'healthy'
  }
}