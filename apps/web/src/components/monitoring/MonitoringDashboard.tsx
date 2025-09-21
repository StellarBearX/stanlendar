'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'

interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded'
  timestamp: string
  version: string
  uptime: number
  checks: {
    database: HealthCheck
    redis: HealthCheck
    memory: HealthCheck
  }
}

interface HealthCheck {
  status: 'healthy' | 'unhealthy' | 'degraded'
  responseTime?: number
  error?: string
  details?: any
}

interface MetricsSummary {
  [key: string]: {
    type: 'counter' | 'gauge' | 'histogram'
    value?: number
    total?: number
    count?: number
    avg?: number
    p95?: number
  }
}

export default function MonitoringDashboard() {
  const [autoRefresh, setAutoRefresh] = useState(true)

  const { data: health, isLoading: healthLoading } = useQuery({
    queryKey: ['health'],
    queryFn: () => api.get('/health').then(res => res.data as HealthStatus),
    refetchInterval: autoRefresh ? 30000 : false, // Refresh every 30 seconds
  })

  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['metrics'],
    queryFn: () => api.get('/health/metrics').then(res => res.data.summary as MetricsSummary),
    refetchInterval: autoRefresh ? 30000 : false,
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-100'
      case 'degraded': return 'text-yellow-600 bg-yellow-100'
      case 'unhealthy': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  const formatBytes = (bytes: number) => {
    const mb = bytes / (1024 * 1024)
    return `${mb.toFixed(1)} MB`
  }

  if (healthLoading || metricsLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">System Monitoring</h1>
        <div className="flex items-center space-x-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="mr-2"
            />
            Auto-refresh
          </label>
          <span className="text-sm text-gray-500">
            Last updated: {new Date().toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* Overall Status */}
      {health && (
        <div className="mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">System Status</h2>
                <div className="flex items-center mt-2">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(health.status)}`}>
                    {health.status.toUpperCase()}
                  </span>
                  <span className="ml-4 text-gray-600">
                    Version: {health.version}
                  </span>
                  <span className="ml-4 text-gray-600">
                    Uptime: {formatUptime(health.uptime / 1000)}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-900">
                  {health.status === 'healthy' ? '✅' : health.status === 'degraded' ? '⚠️' : '❌'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Health Checks */}
      {health && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Health Checks</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Object.entries(health.checks).map(([name, check]) => (
              <div key={name} className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900 capitalize">{name}</h3>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(check.status)}`}>
                    {check.status}
                  </span>
                </div>
                
                {check.responseTime && (
                  <div className="text-sm text-gray-600 mb-2">
                    Response Time: {check.responseTime}ms
                  </div>
                )}
                
                {check.error && (
                  <div className="text-sm text-red-600 mb-2">
                    Error: {check.error}
                  </div>
                )}
                
                {check.details && (
                  <div className="text-xs text-gray-500">
                    {name === 'memory' && (
                      <div>
                        <div>Heap Used: {formatBytes(check.details.heapUsedMB * 1024 * 1024)}</div>
                        <div>RSS: {formatBytes(check.details.rssMB * 1024 * 1024)}</div>
                      </div>
                    )}
                    {name === 'database' && (
                      <div>
                        Connected: {check.details.connected ? 'Yes' : 'No'}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metrics */}
      {metrics && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Application Metrics</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* HTTP Requests */}
            {metrics.http_requests_total && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-2">HTTP Requests</h3>
                <div className="text-3xl font-bold text-blue-600">
                  {metrics.http_requests_total.total?.toLocaleString() || 0}
                </div>
                <div className="text-sm text-gray-600">Total requests</div>
              </div>
            )}

            {/* Response Time */}
            {metrics.http_request_duration_ms && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Response Time</h3>
                <div className="text-3xl font-bold text-green-600">
                  {metrics.http_request_duration_ms.avg?.toFixed(0) || 0}ms
                </div>
                <div className="text-sm text-gray-600">
                  P95: {metrics.http_request_duration_ms.p95?.toFixed(0) || 0}ms
                </div>
              </div>
            )}

            {/* Database Queries */}
            {metrics.database_queries_total && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Database Queries</h3>
                <div className="text-3xl font-bold text-purple-600">
                  {metrics.database_queries_total.total?.toLocaleString() || 0}
                </div>
                <div className="text-sm text-gray-600">
                  Avg: {metrics.database_query_duration_ms?.avg?.toFixed(0) || 0}ms
                </div>
              </div>
            )}

            {/* Google API Calls */}
            {metrics.google_api_requests_total && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Google API</h3>
                <div className="text-3xl font-bold text-orange-600">
                  {metrics.google_api_requests_total.total?.toLocaleString() || 0}
                </div>
                <div className="text-sm text-gray-600">
                  Quota: {metrics.google_api_quota_used?.total?.toLocaleString() || 0}
                </div>
              </div>
            )}

            {/* Sync Operations */}
            {metrics.sync_operations_total && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Sync Operations</h3>
                <div className="text-3xl font-bold text-indigo-600">
                  {metrics.sync_operations_total.total?.toLocaleString() || 0}
                </div>
                <div className="text-sm text-gray-600">Total syncs</div>
              </div>
            )}

            {/* Errors */}
            {metrics.errors_total && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Errors</h3>
                <div className="text-3xl font-bold text-red-600">
                  {metrics.errors_total.total?.toLocaleString() || 0}
                </div>
                <div className="text-sm text-gray-600">Total errors</div>
              </div>
            )}

            {/* Memory Usage */}
            {metrics.memory_heap_used_bytes && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Memory Usage</h3>
                <div className="text-3xl font-bold text-yellow-600">
                  {formatBytes(metrics.memory_heap_used_bytes.value || 0)}
                </div>
                <div className="text-sm text-gray-600">Heap used</div>
              </div>
            )}

            {/* Cache Operations */}
            {metrics.cache_operations_total && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Cache</h3>
                <div className="text-3xl font-bold text-teal-600">
                  {metrics.cache_operations_total.total?.toLocaleString() || 0}
                </div>
                <div className="text-sm text-gray-600">Operations</div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">System Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Environment</h3>
            <div className="space-y-2 text-sm text-gray-600">
              <div>Node.js: {process.version}</div>
              <div>Platform: {typeof window !== 'undefined' ? 'Browser' : 'Server'}</div>
              <div>Timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}</div>
            </div>
          </div>
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Monitoring</h3>
            <div className="space-y-2 text-sm text-gray-600">
              <div>Auto-refresh: {autoRefresh ? 'Enabled' : 'Disabled'}</div>
              <div>Refresh interval: 30 seconds</div>
              <div>Data retention: 24 hours</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}