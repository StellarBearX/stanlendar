import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { StructuredLoggerService } from './logger.service'
import { MetricsService } from './metrics.service'
import { performance, PerformanceObserver } from 'perf_hooks'

export interface PerformanceEntry {
  name: string
  type: 'measure' | 'mark' | 'navigation' | 'resource'
  startTime: number
  duration: number
  timestamp: string
  context?: any
}

export interface PerformanceThreshold {
  name: string
  maxDuration: number
  enabled: boolean
}

export interface PerformanceDashboard {
  overview: {
    avgResponseTime: number
    p95ResponseTime: number
    slowestEndpoints: Array<{ endpoint: string; avgDuration: number }>
    errorRate: number
  }
  database: {
    avgQueryTime: number
    slowestQueries: Array<{ query: string; avgDuration: number }>
    connectionPoolUsage: number
  }
  googleApi: {
    avgRequestTime: number
    quotaUsage: number
    errorRate: number
  }
  memory: {
    heapUsed: number
    heapTotal: number
    rss: number
  }
  system: {
    cpuUsage: number
    uptime: number
    nodeVersion: string
  }
}

@Injectable()
export class PerformanceMonitorService {
  private performanceEntries: PerformanceEntry[] = []
  private readonly maxEntries = 10000
  private observer: PerformanceObserver

  private readonly thresholds: PerformanceThreshold[] = [
    { name: 'http_request', maxDuration: 1000, enabled: true },
    { name: 'database_query', maxDuration: 500, enabled: true },
    { name: 'google_api_call', maxDuration: 2000, enabled: true },
    { name: 'sync_operation', maxDuration: 10000, enabled: true },
    { name: 'import_operation', maxDuration: 30000, enabled: true },
  ]

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: StructuredLoggerService,
    private readonly metricsService: MetricsService,
  ) {
    this.setupPerformanceObserver()
    this.startSystemMonitoring()
  }

  private setupPerformanceObserver(): void {
    this.observer = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      
      for (const entry of entries) {
        this.recordPerformanceEntry({
          name: entry.name,
          type: entry.entryType as any,
          startTime: entry.startTime,
          duration: entry.duration,
          timestamp: new Date().toISOString(),
        })
      }
    })

    this.observer.observe({ entryTypes: ['measure', 'mark'] })
  }

  private startSystemMonitoring(): void {
    // Monitor system metrics every 30 seconds
    setInterval(() => {
      this.recordSystemMetrics()
    }, 30000)

    // Clean up old entries every hour
    setInterval(() => {
      this.cleanupOldEntries()
    }, 60 * 60 * 1000)
  }

  // Performance measurement methods
  startMeasurement(name: string, context?: any): string {
    const markName = `${name}-start-${Date.now()}`
    performance.mark(markName)
    
    return markName
  }

  endMeasurement(startMark: string, name: string, context?: any): number {
    const endMark = `${name}-end-${Date.now()}`
    performance.mark(endMark)
    
    const measureName = `${name}-${Date.now()}`
    performance.measure(measureName, startMark, endMark)
    
    const measure = performance.getEntriesByName(measureName)[0]
    const duration = measure.duration

    // Check thresholds
    this.checkThreshold(name, duration, context)

    // Clean up marks
    performance.clearMarks(startMark)
    performance.clearMarks(endMark)
    performance.clearMeasures(measureName)

    return duration
  }

  // Convenience wrapper for measuring async operations
  async measureAsync<T>(name: string, operation: () => Promise<T>, context?: any): Promise<T> {
    const startMark = this.startMeasurement(name, context)
    const startTime = Date.now()
    
    try {
      const result = await operation()
      const duration = this.endMeasurement(startMark, name, context)
      
      // Record success metrics
      this.metricsService.recordHistogram(`${name}_duration_ms`, duration, {
        success: 'true',
        ...this.flattenContext(context),
      })
      
      return result
    } catch (error) {
      const duration = Date.now() - startTime
      
      // Record failure metrics
      this.metricsService.recordHistogram(`${name}_duration_ms`, duration, {
        success: 'false',
        ...this.flattenContext(context),
      })
      
      // Log performance issue with error
      this.logger.warn(`Performance measurement failed: ${name}`, {
        duration,
        error,
        context,
        type: 'performance',
      })
      
      throw error
    }
  }

  // Convenience wrapper for measuring sync operations
  measureSync<T>(name: string, operation: () => T, context?: any): T {
    const startMark = this.startMeasurement(name, context)
    const startTime = Date.now()
    
    try {
      const result = operation()
      const duration = this.endMeasurement(startMark, name, context)
      
      // Record success metrics
      this.metricsService.recordHistogram(`${name}_duration_ms`, duration, {
        success: 'true',
        ...this.flattenContext(context),
      })
      
      return result
    } catch (error) {
      const duration = Date.now() - startTime
      
      // Record failure metrics
      this.metricsService.recordHistogram(`${name}_duration_ms`, duration, {
        success: 'false',
        ...this.flattenContext(context),
      })
      
      throw error
    }
  }

  private recordPerformanceEntry(entry: PerformanceEntry): void {
    this.performanceEntries.push(entry)
    
    // Prevent memory leaks
    if (this.performanceEntries.length > this.maxEntries) {
      this.performanceEntries = this.performanceEntries.slice(-this.maxEntries / 2)
    }

    // Log slow operations
    if (entry.duration > 1000) {
      this.logger.warn(`Slow operation detected: ${entry.name}`, {
        duration: entry.duration,
        type: 'performance',
      })
    }
  }

  private checkThreshold(name: string, duration: number, context?: any): void {
    const threshold = this.thresholds.find(t => 
      t.enabled && name.includes(t.name)
    )
    
    if (threshold && duration > threshold.maxDuration) {
      this.logger.warn(`Performance threshold exceeded: ${name}`, {
        duration,
        threshold: threshold.maxDuration,
        context,
        type: 'performance_threshold',
      })
      
      this.metricsService.incrementCounter('performance_threshold_exceeded_total', 1, {
        operation: name,
        threshold: threshold.name,
      })
    }
  }

  private recordSystemMetrics(): void {
    // Memory metrics
    const memUsage = process.memoryUsage()
    this.metricsService.setGauge('memory_heap_used_bytes', memUsage.heapUsed)
    this.metricsService.setGauge('memory_heap_total_bytes', memUsage.heapTotal)
    this.metricsService.setGauge('memory_rss_bytes', memUsage.rss)
    this.metricsService.setGauge('memory_external_bytes', memUsage.external)

    // CPU metrics
    const cpuUsage = process.cpuUsage()
    this.metricsService.setGauge('cpu_user_microseconds', cpuUsage.user)
    this.metricsService.setGauge('cpu_system_microseconds', cpuUsage.system)

    // Process metrics
    this.metricsService.setGauge('process_uptime_seconds', process.uptime())
    
    // Event loop lag
    const start = process.hrtime.bigint()
    setImmediate(() => {
      const lag = Number(process.hrtime.bigint() - start) / 1000000 // Convert to ms
      this.metricsService.setGauge('event_loop_lag_ms', lag)
      
      if (lag > 100) {
        this.logger.warn('High event loop lag detected', {
          lag,
          type: 'performance',
        })
      }
    })
  }

  private flattenContext(context?: any): Record<string, string> {
    if (!context) return {}
    
    const flattened: Record<string, string> = {}
    for (const [key, value] of Object.entries(context)) {
      if (typeof value === 'string' || typeof value === 'number') {
        flattened[key] = String(value)
      }
    }
    return flattened
  }

  private cleanupOldEntries(): void {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000 // 24 hours
    
    this.performanceEntries = this.performanceEntries.filter(entry => 
      new Date(entry.timestamp).getTime() > cutoff
    )
    
    this.logger.info('Cleaned up old performance entries', {
      remainingEntries: this.performanceEntries.length,
      type: 'cleanup',
    })
  }

  // Query methods
  getPerformanceEntries(name?: string, limit: number = 100): PerformanceEntry[] {
    let entries = this.performanceEntries
    
    if (name) {
      entries = entries.filter(entry => entry.name.includes(name))
    }
    
    return entries
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit)
  }

  getSlowOperations(minDuration: number = 1000, limit: number = 50): PerformanceEntry[] {
    return this.performanceEntries
      .filter(entry => entry.duration >= minDuration)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit)
  }

  getPerformanceStats(name?: string): {
    count: number
    avgDuration: number
    minDuration: number
    maxDuration: number
    p50: number
    p95: number
    p99: number
  } {
    let entries = this.performanceEntries
    
    if (name) {
      entries = entries.filter(entry => entry.name.includes(name))
    }
    
    if (entries.length === 0) {
      return {
        count: 0,
        avgDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        p50: 0,
        p95: 0,
        p99: 0,
      }
    }
    
    const durations = entries.map(e => e.duration).sort((a, b) => a - b)
    
    return {
      count: entries.length,
      avgDuration: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      minDuration: durations[0],
      maxDuration: durations[durations.length - 1],
      p50: durations[Math.floor(durations.length * 0.5)],
      p95: durations[Math.floor(durations.length * 0.95)],
      p99: durations[Math.floor(durations.length * 0.99)],
    }
  }

  getDashboard(): PerformanceDashboard {
    const httpStats = this.getPerformanceStats('http_request')
    const dbStats = this.getPerformanceStats('database_query')
    const gapiStats = this.getPerformanceStats('google_api_call')
    const memUsage = process.memoryUsage()
    
    // Get slowest endpoints
    const slowestEndpoints = this.performanceEntries
      .filter(e => e.name.includes('http_request'))
      .reduce((acc, entry) => {
        const endpoint = entry.context?.route || entry.name
        if (!acc[endpoint]) {
          acc[endpoint] = { total: 0, count: 0 }
        }
        acc[endpoint].total += entry.duration
        acc[endpoint].count++
        return acc
      }, {} as Record<string, { total: number; count: number }>)
    
    const slowestEndpointsArray = Object.entries(slowestEndpoints)
      .map(([endpoint, stats]) => ({
        endpoint,
        avgDuration: stats.total / stats.count,
      }))
      .sort((a, b) => b.avgDuration - a.avgDuration)
      .slice(0, 5)

    return {
      overview: {
        avgResponseTime: httpStats.avgDuration,
        p95ResponseTime: httpStats.p95,
        slowestEndpoints: slowestEndpointsArray,
        errorRate: 0, // Would be calculated from error metrics
      },
      database: {
        avgQueryTime: dbStats.avgDuration,
        slowestQueries: [], // Would need query tracking
        connectionPoolUsage: 0, // Would need pool monitoring
      },
      googleApi: {
        avgRequestTime: gapiStats.avgDuration,
        quotaUsage: 0, // Would be tracked separately
        errorRate: 0, // Would be calculated from error metrics
      },
      memory: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        rss: Math.round(memUsage.rss / 1024 / 1024),
      },
      system: {
        cpuUsage: 0, // Would need CPU monitoring
        uptime: Math.round(process.uptime()),
        nodeVersion: process.version,
      },
    }
  }

  // Configuration methods
  updateThreshold(name: string, maxDuration: number): boolean {
    const threshold = this.thresholds.find(t => t.name === name)
    if (threshold) {
      threshold.maxDuration = maxDuration
      this.logger.info(`Performance threshold updated: ${name}`, {
        maxDuration,
        type: 'config',
      })
      return true
    }
    return false
  }

  enableThreshold(name: string, enabled: boolean): boolean {
    const threshold = this.thresholds.find(t => t.name === name)
    if (threshold) {
      threshold.enabled = enabled
      this.logger.info(`Performance threshold ${enabled ? 'enabled' : 'disabled'}: ${name}`, {
        type: 'config',
      })
      return true
    }
    return false
  }

  getThresholds(): PerformanceThreshold[] {
    return [...this.thresholds]
  }

  // Cleanup
  clearEntries(): void {
    this.performanceEntries = []
    this.logger.info('Performance entries cleared', { type: 'admin' })
  }
}