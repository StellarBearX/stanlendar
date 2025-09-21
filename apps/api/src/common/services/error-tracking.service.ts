import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { StructuredLoggerService, LogContext } from './logger.service'
import { MetricsService } from './metrics.service'

export interface ErrorEvent {
  id: string
  timestamp: string
  level: 'warning' | 'error' | 'critical'
  message: string
  error?: Error
  context?: LogContext
  fingerprint: string
  count: number
  firstSeen: string
  lastSeen: string
}

export interface AlertRule {
  name: string
  condition: (events: ErrorEvent[]) => boolean
  severity: 'low' | 'medium' | 'high' | 'critical'
  cooldown: number // minutes
  enabled: boolean
}

@Injectable()
export class ErrorTrackingService {
  private errorEvents = new Map<string, ErrorEvent>()
  private alertCooldowns = new Map<string, number>()
  private readonly maxEvents = 10000 // Prevent memory leaks

  private readonly alertRules: AlertRule[] = [
    {
      name: 'high_error_rate',
      condition: (events) => {
        const recentErrors = events.filter(e => 
          Date.now() - new Date(e.lastSeen).getTime() < 5 * 60 * 1000 // Last 5 minutes
        )
        return recentErrors.length > 10
      },
      severity: 'high',
      cooldown: 15,
      enabled: true,
    },
    {
      name: 'critical_error',
      condition: (events) => {
        return events.some(e => e.level === 'critical')
      },
      severity: 'critical',
      cooldown: 5,
      enabled: true,
    },
    {
      name: 'database_errors',
      condition: (events) => {
        const dbErrors = events.filter(e => 
          e.context?.type === 'database' && 
          Date.now() - new Date(e.lastSeen).getTime() < 10 * 60 * 1000
        )
        return dbErrors.length > 5
      },
      severity: 'high',
      cooldown: 10,
      enabled: true,
    },
    {
      name: 'google_api_errors',
      condition: (events) => {
        const gapiErrors = events.filter(e => 
          e.context?.type === 'google_api' && 
          Date.now() - new Date(e.lastSeen).getTime() < 15 * 60 * 1000
        )
        return gapiErrors.length > 3
      },
      severity: 'medium',
      cooldown: 20,
      enabled: true,
    },
    {
      name: 'sync_failures',
      condition: (events) => {
        const syncErrors = events.filter(e => 
          e.context?.type === 'sync' && 
          Date.now() - new Date(e.lastSeen).getTime() < 30 * 60 * 1000
        )
        return syncErrors.length > 2
      },
      severity: 'medium',
      cooldown: 30,
      enabled: true,
    },
  ]

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: StructuredLoggerService,
    private readonly metricsService: MetricsService,
  ) {
    // Clean up old events periodically
    setInterval(() => this.cleanupOldEvents(), 60 * 60 * 1000) // Every hour
  }

  captureError(error: Error, context?: LogContext, level: 'warning' | 'error' | 'critical' = 'error'): void {
    const fingerprint = this.generateFingerprint(error, context)
    const now = new Date().toISOString()
    const eventId = `${fingerprint}-${Date.now()}`

    let errorEvent = this.errorEvents.get(fingerprint)
    
    if (errorEvent) {
      // Update existing error
      errorEvent.count++
      errorEvent.lastSeen = now
      errorEvent.level = this.getHigherLevel(errorEvent.level, level)
    } else {
      // Create new error event
      errorEvent = {
        id: eventId,
        timestamp: now,
        level,
        message: error.message,
        error,
        context,
        fingerprint,
        count: 1,
        firstSeen: now,
        lastSeen: now,
      }
      
      this.errorEvents.set(fingerprint, errorEvent)
    }

    // Log the error
    this.logger.error(`Error captured: ${error.message}`, {
      ...context,
      errorId: eventId,
      fingerprint,
      count: errorEvent.count,
      level,
    })

    // Record metrics
    this.metricsService.incrementCounter('errors_total', 1, {
      level,
      type: context?.type || 'unknown',
    })

    // Check alert rules
    this.checkAlertRules()

    // Prevent memory leaks
    if (this.errorEvents.size > this.maxEvents) {
      this.cleanupOldEvents()
    }
  }

  captureException(message: string, context?: LogContext, level: 'warning' | 'error' | 'critical' = 'error'): void {
    const error = new Error(message)
    this.captureError(error, context, level)
  }

  getErrorEvents(): ErrorEvent[] {
    return Array.from(this.errorEvents.values()).sort((a, b) => 
      new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime()
    )
  }

  getErrorEvent(fingerprint: string): ErrorEvent | undefined {
    return this.errorEvents.get(fingerprint)
  }

  getErrorStats(): {
    totalErrors: number
    recentErrors: number
    criticalErrors: number
    topErrors: Array<{ fingerprint: string; count: number; message: string }>
  } {
    const events = this.getErrorEvents()
    const now = Date.now()
    const oneHourAgo = now - 60 * 60 * 1000

    const recentErrors = events.filter(e => 
      new Date(e.lastSeen).getTime() > oneHourAgo
    )

    const criticalErrors = events.filter(e => e.level === 'critical')

    const topErrors = events
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map(e => ({
        fingerprint: e.fingerprint,
        count: e.count,
        message: e.message,
      }))

    return {
      totalErrors: events.length,
      recentErrors: recentErrors.length,
      criticalErrors: criticalErrors.length,
      topErrors,
    }
  }

  private generateFingerprint(error: Error, context?: LogContext): string {
    // Create a unique fingerprint for grouping similar errors
    const components = [
      error.name,
      error.message,
      context?.route || '',
      context?.method || '',
      context?.type || '',
    ]

    // Include stack trace for more specific grouping
    if (error.stack) {
      const stackLines = error.stack.split('\n').slice(0, 3) // First 3 lines
      components.push(...stackLines)
    }

    return Buffer.from(components.join('|')).toString('base64').substring(0, 16)
  }

  private getHigherLevel(current: string, new_: string): 'warning' | 'error' | 'critical' {
    const levels = { warning: 1, error: 2, critical: 3 }
    return levels[new_] > levels[current] ? new_ as any : current as any
  }

  private checkAlertRules(): void {
    const events = this.getErrorEvents()
    const now = Date.now()

    for (const rule of this.alertRules) {
      if (!rule.enabled) continue

      // Check cooldown
      const lastAlert = this.alertCooldowns.get(rule.name)
      if (lastAlert && now - lastAlert < rule.cooldown * 60 * 1000) {
        continue
      }

      // Check condition
      if (rule.condition(events)) {
        this.triggerAlert(rule, events)
        this.alertCooldowns.set(rule.name, now)
      }
    }
  }

  private triggerAlert(rule: AlertRule, events: ErrorEvent[]): void {
    const alert = {
      rule: rule.name,
      severity: rule.severity,
      timestamp: new Date().toISOString(),
      message: `Alert triggered: ${rule.name}`,
      affectedEvents: events.length,
      recentErrors: events.filter(e => 
        Date.now() - new Date(e.lastSeen).getTime() < 15 * 60 * 1000
      ).length,
    }

    // Log the alert
    this.logger.warn(`Alert triggered: ${rule.name}`, {
      alert,
      type: 'alert',
    })

    // Record metrics
    this.metricsService.incrementCounter('alerts_triggered_total', 1, {
      rule: rule.name,
      severity: rule.severity,
    })

    // In a real implementation, you would send this to external alerting systems
    // like PagerDuty, Slack, email, etc.
    this.sendAlert(alert)
  }

  private async sendAlert(alert: any): Promise<void> {
    // Mock implementation - in production, integrate with:
    // - PagerDuty
    // - Slack webhooks
    // - Email notifications
    // - SMS alerts
    // - Discord webhooks
    
    const webhookUrl = this.configService.get('ALERT_WEBHOOK_URL')
    if (webhookUrl) {
      try {
        // Example webhook payload
        const payload = {
          text: `🚨 ${alert.severity.toUpperCase()} Alert: ${alert.message}`,
          attachments: [
            {
              color: this.getAlertColor(alert.severity),
              fields: [
                { title: 'Rule', value: alert.rule, short: true },
                { title: 'Severity', value: alert.severity, short: true },
                { title: 'Affected Events', value: alert.affectedEvents, short: true },
                { title: 'Recent Errors', value: alert.recentErrors, short: true },
              ],
              timestamp: alert.timestamp,
            },
          ],
        }

        // In production, use a proper HTTP client
        this.logger.info('Alert would be sent to webhook', { 
          webhookUrl, 
          payload,
          type: 'alert_webhook',
        })
      } catch (error) {
        this.logger.error('Failed to send alert webhook', { error })
      }
    }
  }

  private getAlertColor(severity: string): string {
    switch (severity) {
      case 'critical': return '#ff0000'
      case 'high': return '#ff8800'
      case 'medium': return '#ffaa00'
      case 'low': return '#ffdd00'
      default: return '#cccccc'
    }
  }

  private cleanupOldEvents(): void {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000 // 7 days
    
    for (const [fingerprint, event] of this.errorEvents.entries()) {
      if (new Date(event.lastSeen).getTime() < cutoff) {
        this.errorEvents.delete(fingerprint)
      }
    }

    this.logger.info('Cleaned up old error events', {
      remainingEvents: this.errorEvents.size,
      type: 'cleanup',
    })
  }

  // Admin methods
  clearErrors(): void {
    this.errorEvents.clear()
    this.logger.info('All error events cleared', { type: 'admin' })
  }

  updateAlertRule(name: string, updates: Partial<AlertRule>): boolean {
    const rule = this.alertRules.find(r => r.name === name)
    if (rule) {
      Object.assign(rule, updates)
      this.logger.info(`Alert rule updated: ${name}`, { updates, type: 'admin' })
      return true
    }
    return false
  }

  getAlertRules(): AlertRule[] {
    return [...this.alertRules]
  }
}