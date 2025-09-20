import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const { method, url, headers } = request;
    const userAgent = headers['user-agent'];
    const userId = (request as any).user?.id;
    const startTime = Date.now();

    // Generate request ID if not present
    const requestId = headers['x-request-id'] || this.generateRequestId();
    response.setHeader('x-request-id', requestId);

    const logContext = {
      requestId,
      method,
      url,
      userAgent,
      userId,
    };

    this.logger.log(`Incoming request`, logContext);

    return next.handle().pipe(
      tap((data) => {
        const duration = Date.now() - startTime;
        this.logger.log(`Request completed`, {
          ...logContext,
          statusCode: response.statusCode,
          duration,
          responseSize: JSON.stringify(data || {}).length,
        });
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        this.logger.error(`Request failed`, {
          ...logContext,
          duration,
          error: {
            name: error.name,
            message: error.message,
          },
        });
        throw error;
      }),
    );
  }

  private generateRequestId(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }
}