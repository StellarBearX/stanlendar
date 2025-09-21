import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

export interface LogContext {
  userId?: string
  correlationId?: string
  route?: string
  method?: string
  statusCode?: number
  latency?: number
  gapiQuotaCost?: number
  retryCount?: number
  idempotencyKey?: string
  error?: Error
  [key: string]: any
}

export interface StructuredLog {
  timestamp: string
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  context?: LogContext
  service: string
  environment: string
}

@Injectable()
export class StructuredLoggerService implements NestLoggerService {
  private readonly service = 'class-schedule-sync-api'
  private readonly environment: string
  private readonly logLevel: string

  constructor(private configService: ConfigService) {
    this.environment = this.configService.get('NODE_ENV', 'development')
    this.logLevel = this.configService.get('LOG_LEVEL', 'info')
  }

  private shouldLog(level: string): boolean {
    const levels = ['debug', 'info', 'warn', 'error']
    const currentLevelIndex = levels.indexOf(this.logLevel)
    const messageLevelIndex = levels.indexOf(level)
    return messageLevelIndex >= currentLevelIndex
  }

  private formatLog(level: 'debug' | 'info' | 'warn' | 'error', message: string, context?: LogContext): StructuredLog {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: context ? this.sanitizeContext(context) : undefined,
      service: this.service,
      environment: this.environment,
    }
  }

  private sanitizeContext(context: LogContext): LogContext {
    const sanitized = { ...context }
    
    // Remove sensitive information
    if (sanitized.error) {
      sanitized.error = {
        name: sanitized.error.name,
        message: sanitized.error.message,
        stack: this.environment === 'development' ? sanitized.error.stack : undefined,
      } as any
    }

    // Remove any keys that might contain sensitive data
    const sensitiveKeys = ['password', 'token', 'secret', 'key', 'authorization']
    Object.keys(sanitized).forEach(key => {
      if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
        sanitized[key] = '[REDACTED]'
      }
    })

    return sanitized
  }

  private output(log: StructuredLog): void {
    if (this.environment === 'development') {
      // Pretty print for development
      const colorMap = {
        debug: '\x1b[36m', // cyan
        info: '\x1b[32m',  // green
        warn: '\x1b[33m',  // yellow
        error: '\x1b[31m', // red
      }
      const reset = '\x1b[0m'
      const color = colorMap[log.level]
      
      console.log(`${color}[${log.timestamp}] ${log.level.toUpperCase()}${reset} ${log.message}`)
      if (log.context) {
        console.log(`${color}Context:${reset}`, JSON.stringify(log.context, null, 2))
      }
    } else {
      // JSON output for production
      console.log(JSON.stringify(log))
    }
  }

  debug(message: string, context?: LogContext): void {
    if (this.shouldLog('debug')) {
      this.output(this.formatLog('debug', message, context))
    }
  }

  info(message: string, context?: LogContext): void {
    if (this.shouldLog('info')) {
      this.output(this.formatLog('info', message, context))
    }
  }

  warn(message: string, context?: LogContext): void {
    if (this.shouldLog('warn')) {
      this.output(this.formatLog('warn', message, context))
    }
  }

  error(message: string, context?: LogContext): void {
    if (this.shouldLog('error')) {
      this.output(this.formatLog('error', message, context))
    }
  }

  // NestJS LoggerService interface methods
  log(message: any, context?: string): void {
    this.info(typeof message === 'string' ? message : JSON.stringify(message), { context })
  }

  verbose(message: any, context?: string): void {
    this.debug(typeof message === 'string' ? message : JSON.stringify(message), { context })
  }

  // Convenience methods for common scenarios
  logRequest(method: string, route: string, context: LogContext = {}): void {
    this.info(`${method} ${route}`, {
      ...context,
      method,
      route,
      type: 'request',
    })
  }

  logResponse(method: string, route: string, statusCode: number, latency: number, context: LogContext = {}): void {
    const level = statusCode >= 400 ? 'warn' : 'info'
    this[level](`${method} ${route} ${statusCode} ${latency}ms`, {
      ...context,
      method,
      route,
      statusCode,
      latency,
      type: 'response',
    })
  }

  logGoogleApiCall(operation: string, quotaCost: number, context: LogContext = {}): void {
    this.info(`Google API: ${operation}`, {
      ...context,
      operation,
      gapiQuotaCost: quotaCost,
      type: 'google_api',
    })
  }

  logDatabaseQuery(query: string, duration: number, context: LogContext = {}): void {
    const level = duration > 1000 ? 'warn' : 'debug'
    this[level](`Database query: ${duration}ms`, {
      ...context,
      query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
      duration,
      type: 'database',
    })
  }

  logSyncOperation(operation: string, eventsCount: number, duration: number, context: LogContext = {}): void {
    this.info(`Sync ${operation}: ${eventsCount} events in ${duration}ms`, {
      ...context,
      operation,
      eventsCount,
      duration,
      type: 'sync',
    })
  }

  logSecurityEvent(event: string, context: LogContext = {}): void {
    this.warn(`Security event: ${event}`, {
      ...context,
      event,
      type: 'security',
    })
  }

  logPerformanceMetric(metric: string, value: number, unit: string, context: LogContext = {}): void {
    this.info(`Performance: ${metric} = ${value}${unit}`, {
      ...context,
      metric,
      value,
      unit,
      type: 'performance',
    })
  }
}