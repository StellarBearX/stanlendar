import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

export interface MetricValue {
  value: number
  timestamp: number
  labels?: Record<string, string>
}

export interface Counter extends MetricValue {
  type: 'counter'
}

export interface Gauge extends MetricValue {
  type: 'gauge'
}

export interface Histogram extends MetricValue {
  type: 'histogram'
  buckets?: number[]
}

export type Metric = Counter | Gauge | Histogram

@Injectable()
export class MetricsService {
  private metrics = new Map<string, Metric[]>()
  private readonly maxMetricsPerKey = 1000 // Prevent memory leaks

  constructor(private configService: ConfigService) {}

  private addMetric(name: string, metric: Metric): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, [])
    }

    const metrics = this.metrics.get(name)!
    metrics.push(metric)

    // Keep only recent metrics to prevent memory leaks
    if (metrics.length > this.maxMetricsPerKey) {
      metrics.splice(0, metrics.length - this.maxMetricsPerKey)
    }
  }

  // Counter methods
  incrementCounter(name: string, value: number = 1, labels?: Record<string, string>): void {
    this.addMetric(name, {
      type: 'counter',
      value,
      timestamp: Date.now(),
      labels,
    })
  }

  // Gauge methods
  setGauge(name: string, value: number, labels?: Record<string, string>): void {
    this.addMetric(name, {
      type: 'gauge',
      value,
      timestamp: Date.now(),
      labels,
    })
  }

  // Histogram methods
  recordHistogram(name: string, value: number, labels?: Record<string, string>): void {
    this.addMetric(name, {
      type: 'histogram',
      value,
      timestamp: Date.now(),
      labels,
    })
  }

  // Application-specific metrics
  recordHttpRequest(method: string, route: string, statusCode: number, duration: number): void {
    this.incrementCounter('http_requests_total', 1, {
      method,
      route,
      status_code: statusCode.toString(),
    })

    this.recordHistogram('http_request_duration_ms', duration, {
      method,
      route,
    })
  }

  recordDatabaseQuery(operation: string, duration: number, success: boolean): void {
    this.incrementCounter('database_queries_total', 1, {
      operation,
      success: success.toString(),
    })

    this.recordHistogram('database_query_duration_ms', duration, {
      operation,
    })
  }

  recordGoogleApiCall(operation: string, statusCode: number, quotaCost: number, duration: number): void {
    this.incrementCounter('google_api_requests_total', 1, {
      operation,
      status_code: statusCode.toString(),
    })

    this.incrementCounter('google_api_quota_used', quotaCost, {
      operation,
    })

    this.recordHistogram('google_api_request_duration_ms', duration, {
      operation,
    })
  }

  recordSyncOperation(direction: string, eventsCount: number, duration: number, success: boolean): void {
    this.incrementCounter('sync_operations_total', 1, {
      direction,
      success: success.toString(),
    })

    this.setGauge('sync_events_processed', eventsCount, {
      direction,
    })

    this.recordHistogram('sync_operation_duration_ms', duration, {
      direction,
    })
  }

  recordAuthEvent(event: string, success: boolean): void {
    this.incrementCounter('auth_events_total', 1, {
      event,
      success: success.toString(),
    })
  }

  recordImportOperation(sourceType: string, rowsProcessed: number, duration: number, success: boolean): void {
    this.incrementCounter('import_operations_total', 1, {
      source_type: sourceType,
      success: success.toString(),
    })

    this.setGauge('import_rows_processed', rowsProcessed, {
      source_type: sourceType,
    })

    this.recordHistogram('import_operation_duration_ms', duration, {
      source_type: sourceType,
    })
  }

  recordCacheOperation(operation: string, hit: boolean): void {
    this.incrementCounter('cache_operations_total', 1, {
      operation,
      result: hit ? 'hit' : 'miss',
    })
  }

  recordQueueJob(jobType: string, status: 'completed' | 'failed' | 'retried', duration?: number): void {
    this.incrementCounter('queue_jobs_total', 1, {
      job_type: jobType,
      status,
    })

    if (duration !== undefined) {
      this.recordHistogram('queue_job_duration_ms', duration, {
        job_type: jobType,
      })
    }
  }

  // System metrics
  recordMemoryUsage(): void {
    const memUsage = process.memoryUsage()
    this.setGauge('memory_heap_used_bytes', memUsage.heapUsed)
    this.setGauge('memory_heap_total_bytes', memUsage.heapTotal)
    this.setGauge('memory_external_bytes', memUsage.external)
    this.setGauge('memory_rss_bytes', memUsage.rss)
  }

  recordCpuUsage(): void {
    const cpuUsage = process.cpuUsage()
    this.setGauge('cpu_user_microseconds', cpuUsage.user)
    this.setGauge('cpu_system_microseconds', cpuUsage.system)
  }

  // Metric retrieval methods
  getMetric(name: string): Metric[] | undefined {
    return this.metrics.get(name)
  }

  getAllMetrics(): Record<string, Metric[]> {
    const result: Record<string, Metric[]> = {}
    for (const [name, metrics] of this.metrics.entries()) {
      result[name] = [...metrics]
    }
    return result
  }

  getMetricsSummary(): Record<string, any> {
    const summary: Record<string, any> = {}
    
    for (const [name, metrics] of this.metrics.entries()) {
      if (metrics.length === 0) continue

      const latest = metrics[metrics.length - 1]
      
      if (latest.type === 'counter') {
        // Sum all counter values
        summary[name] = {
          type: 'counter',
          total: metrics.reduce((sum, m) => sum + m.value, 0),
          latest: latest.value,
          timestamp: latest.timestamp,
        }
      } else if (latest.type === 'gauge') {
        // Use latest gauge value
        summary[name] = {
          type: 'gauge',
          value: latest.value,
          timestamp: latest.timestamp,
        }
      } else if (latest.type === 'histogram') {
        // Calculate histogram statistics
        const values = metrics.map(m => m.value)
        values.sort((a, b) => a - b)
        
        summary[name] = {
          type: 'histogram',
          count: values.length,
          min: values[0],
          max: values[values.length - 1],
          avg: values.reduce((sum, v) => sum + v, 0) / values.length,
          p50: values[Math.floor(values.length * 0.5)],
          p95: values[Math.floor(values.length * 0.95)],
          p99: values[Math.floor(values.length * 0.99)],
          timestamp: latest.timestamp,
        }
      }
    }

    return summary
  }

  // Prometheus-style metrics export
  exportPrometheusMetrics(): string {
    const lines: string[] = []
    const summary = this.getMetricsSummary()

    for (const [name, data] of Object.entries(summary)) {
      const metricName = name.replace(/[^a-zA-Z0-9_]/g, '_')
      
      if (data.type === 'counter') {
        lines.push(`# TYPE ${metricName} counter`)
        lines.push(`${metricName} ${data.total}`)
      } else if (data.type === 'gauge') {
        lines.push(`# TYPE ${metricName} gauge`)
        lines.push(`${metricName} ${data.value}`)
      } else if (data.type === 'histogram') {
        lines.push(`# TYPE ${metricName} histogram`)
        lines.push(`${metricName}_count ${data.count}`)
        lines.push(`${metricName}_sum ${data.count * data.avg}`)
        lines.push(`${metricName}_bucket{le="50"} ${data.p50}`)
        lines.push(`${metricName}_bucket{le="95"} ${data.p95}`)
        lines.push(`${metricName}_bucket{le="99"} ${data.p99}`)
        lines.push(`${metricName}_bucket{le="+Inf"} ${data.max}`)
      }
    }

    return lines.join('\n')
  }

  // Clear old metrics to prevent memory leaks
  clearOldMetrics(olderThanMs: number = 24 * 60 * 60 * 1000): void {
    const cutoff = Date.now() - olderThanMs
    
    for (const [name, metrics] of this.metrics.entries()) {
      const filtered = metrics.filter(m => m.timestamp > cutoff)
      this.metrics.set(name, filtered)
    }
  }

  // Reset all metrics
  reset(): void {
    this.metrics.clear()
  }
}