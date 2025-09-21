import { Test, TestingModule } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'
import { MetricsService } from '../metrics.service'

describe('MetricsService', () => {
  let service: MetricsService
  let configService: jest.Mocked<ConfigService>

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MetricsService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile()

    service = module.get<MetricsService>(MetricsService)
    configService = module.get(ConfigService)
  })

  describe('counter metrics', () => {
    it('should increment counter', () => {
      service.incrementCounter('test_counter', 5, { label: 'value' })

      const metrics = service.getMetric('test_counter')
      expect(metrics).toHaveLength(1)
      expect(metrics[0]).toMatchObject({
        type: 'counter',
        value: 5,
        labels: { label: 'value' },
      })
    })

    it('should increment counter multiple times', () => {
      service.incrementCounter('test_counter', 1)
      service.incrementCounter('test_counter', 2)
      service.incrementCounter('test_counter', 3)

      const metrics = service.getMetric('test_counter')
      expect(metrics).toHaveLength(3)
      
      const summary = service.getMetricsSummary()
      expect(summary.test_counter.total).toBe(6)
    })
  })

  describe('gauge metrics', () => {
    it('should set gauge value', () => {
      service.setGauge('test_gauge', 42, { instance: 'server1' })

      const metrics = service.getMetric('test_gauge')
      expect(metrics).toHaveLength(1)
      expect(metrics[0]).toMatchObject({
        type: 'gauge',
        value: 42,
        labels: { instance: 'server1' },
      })
    })

    it('should update gauge value', () => {
      service.setGauge('test_gauge', 10)
      service.setGauge('test_gauge', 20)

      const summary = service.getMetricsSummary()
      expect(summary.test_gauge.value).toBe(20)
    })
  })

  describe('histogram metrics', () => {
    it('should record histogram values', () => {
      service.recordHistogram('test_histogram', 100)
      service.recordHistogram('test_histogram', 200)
      service.recordHistogram('test_histogram', 300)

      const summary = service.getMetricsSummary()
      expect(summary.test_histogram).toMatchObject({
        type: 'histogram',
        count: 3,
        min: 100,
        max: 300,
        avg: 200,
      })
    })

    it('should calculate percentiles correctly', () => {
      // Add 100 values from 1 to 100
      for (let i = 1; i <= 100; i++) {
        service.recordHistogram('test_histogram', i)
      }

      const summary = service.getMetricsSummary()
      expect(summary.test_histogram.p50).toBe(50)
      expect(summary.test_histogram.p95).toBe(95)
      expect(summary.test_histogram.p99).toBe(99)
    })
  })

  describe('application-specific metrics', () => {
    it('should record HTTP request metrics', () => {
      service.recordHttpRequest('GET', '/api/users', 200, 150)

      const requestMetrics = service.getMetric('http_requests_total')
      const durationMetrics = service.getMetric('http_request_duration_ms')

      expect(requestMetrics).toHaveLength(1)
      expect(requestMetrics[0]).toMatchObject({
        type: 'counter',
        value: 1,
        labels: {
          method: 'GET',
          route: '/api/users',
          status_code: '200',
        },
      })

      expect(durationMetrics).toHaveLength(1)
      expect(durationMetrics[0]).toMatchObject({
        type: 'histogram',
        value: 150,
      })
    })

    it('should record database query metrics', () => {
      service.recordDatabaseQuery('SELECT', 250, true)

      const queryMetrics = service.getMetric('database_queries_total')
      const durationMetrics = service.getMetric('database_query_duration_ms')

      expect(queryMetrics).toHaveLength(1)
      expect(queryMetrics[0].labels).toMatchObject({
        operation: 'SELECT',
        success: 'true',
      })

      expect(durationMetrics).toHaveLength(1)
      expect(durationMetrics[0].value).toBe(250)
    })

    it('should record Google API call metrics', () => {
      service.recordGoogleApiCall('createEvent', 200, 5, 1000)

      const requestMetrics = service.getMetric('google_api_requests_total')
      const quotaMetrics = service.getMetric('google_api_quota_used')
      const durationMetrics = service.getMetric('google_api_request_duration_ms')

      expect(requestMetrics).toHaveLength(1)
      expect(quotaMetrics).toHaveLength(1)
      expect(durationMetrics).toHaveLength(1)

      expect(quotaMetrics[0].value).toBe(5)
    })

    it('should record sync operation metrics', () => {
      service.recordSyncOperation('upsert-to-google', 15, 3000, true)

      const syncMetrics = service.getMetric('sync_operations_total')
      const eventsMetrics = service.getMetric('sync_events_processed')
      const durationMetrics = service.getMetric('sync_operation_duration_ms')

      expect(syncMetrics).toHaveLength(1)
      expect(eventsMetrics).toHaveLength(1)
      expect(durationMetrics).toHaveLength(1)

      expect(eventsMetrics[0].value).toBe(15)
    })
  })

  describe('system metrics', () => {
    it('should record memory usage', () => {
      service.recordMemoryUsage()

      const heapUsed = service.getMetric('memory_heap_used_bytes')
      const heapTotal = service.getMetric('memory_heap_total_bytes')
      const rss = service.getMetric('memory_rss_bytes')
      const external = service.getMetric('memory_external_bytes')

      expect(heapUsed).toHaveLength(1)
      expect(heapTotal).toHaveLength(1)
      expect(rss).toHaveLength(1)
      expect(external).toHaveLength(1)

      expect(heapUsed[0].value).toBeGreaterThan(0)
    })

    it('should record CPU usage', () => {
      service.recordCpuUsage()

      const userCpu = service.getMetric('cpu_user_microseconds')
      const systemCpu = service.getMetric('cpu_system_microseconds')

      expect(userCpu).toHaveLength(1)
      expect(systemCpu).toHaveLength(1)

      expect(userCpu[0].value).toBeGreaterThanOrEqual(0)
      expect(systemCpu[0].value).toBeGreaterThanOrEqual(0)
    })
  })

  describe('metrics export', () => {
    it('should export Prometheus format', () => {
      service.incrementCounter('test_counter', 5)
      service.setGauge('test_gauge', 42)
      service.recordHistogram('test_histogram', 100)

      const prometheus = service.exportPrometheusMetrics()

      expect(prometheus).toContain('# TYPE test_counter counter')
      expect(prometheus).toContain('test_counter 5')
      expect(prometheus).toContain('# TYPE test_gauge gauge')
      expect(prometheus).toContain('test_gauge 42')
      expect(prometheus).toContain('# TYPE test_histogram histogram')
      expect(prometheus).toContain('test_histogram_count 1')
    })

    it('should get all metrics', () => {
      service.incrementCounter('counter1', 1)
      service.setGauge('gauge1', 10)

      const allMetrics = service.getAllMetrics()

      expect(allMetrics).toHaveProperty('counter1')
      expect(allMetrics).toHaveProperty('gauge1')
      expect(allMetrics.counter1).toHaveLength(1)
      expect(allMetrics.gauge1).toHaveLength(1)
    })

    it('should get metrics summary', () => {
      service.incrementCounter('test_counter', 1)
      service.incrementCounter('test_counter', 2)
      service.setGauge('test_gauge', 42)

      const summary = service.getMetricsSummary()

      expect(summary.test_counter).toMatchObject({
        type: 'counter',
        total: 3,
        latest: 2,
      })

      expect(summary.test_gauge).toMatchObject({
        type: 'gauge',
        value: 42,
      })
    })
  })

  describe('memory management', () => {
    it('should limit metrics per key', () => {
      // Add more metrics than the limit
      for (let i = 0; i < 1500; i++) {
        service.incrementCounter('test_counter', 1)
      }

      const metrics = service.getMetric('test_counter')
      expect(metrics.length).toBeLessThanOrEqual(1000)
    })

    it('should clear old metrics', () => {
      service.incrementCounter('test_counter', 1)
      service.setGauge('test_gauge', 10)

      service.clearOldMetrics(0) // Clear all metrics

      const allMetrics = service.getAllMetrics()
      expect(Object.keys(allMetrics)).toHaveLength(0)
    })

    it('should reset all metrics', () => {
      service.incrementCounter('test_counter', 1)
      service.setGauge('test_gauge', 10)

      service.reset()

      const allMetrics = service.getAllMetrics()
      expect(Object.keys(allMetrics)).toHaveLength(0)
    })
  })
})