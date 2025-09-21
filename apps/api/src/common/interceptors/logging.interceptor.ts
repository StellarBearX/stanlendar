import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common'
import { Observable } from 'rxjs'
import { tap } from 'rxjs/operators'
import { Request, Response } from 'express'
import { StructuredLoggerService } from '../services/logger.service'
import { v4 as uuidv4 } from 'uuid'

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: StructuredLoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>()
    const response = context.switchToHttp().getResponse<Response>()
    const { method, url, headers, body } = request
    
    // Generate correlation ID if not present
    const correlationId = headers['x-correlation-id'] as string || uuidv4()
    request.headers['x-correlation-id'] = correlationId
    response.setHeader('x-correlation-id', correlationId)

    // Extract user ID from request if available
    const userId = (request as any).user?.id

    const startTime = Date.now()

    // Log incoming request
    this.logger.logRequest(method, url, {
      correlationId,
      userId,
      userAgent: headers['user-agent'],
      ip: request.ip,
      bodySize: body ? JSON.stringify(body).length : 0,
    })

    return next.handle().pipe(
      tap({
        next: (data) => {
          const latency = Date.now() - startTime
          
          // Log successful response
          this.logger.logResponse(method, url, response.statusCode, latency, {
            correlationId,
            userId,
            responseSize: data ? JSON.stringify(data).length : 0,
          })

          // Log performance metrics for slow requests
          if (latency > 1000) {
            this.logger.logPerformanceMetric('slow_request', latency, 'ms', {
              correlationId,
              userId,
              route: url,
              method,
            })
          }
        },
        error: (error) => {
          const latency = Date.now() - startTime
          
          // Log error response
          this.logger.error(`${method} ${url} failed`, {
            correlationId,
            userId,
            latency,
            error,
            statusCode: response.statusCode || 500,
          })
        },
      }),
    )
  }
}