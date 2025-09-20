import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
    timestamp: string;
    path: string;
    requestId?: string;
  };
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const errorResponse = this.buildErrorResponse(exception, request);
    
    // Log error with context
    this.logError(exception, request, errorResponse);

    response.status(errorResponse.error.code === 'INTERNAL_ERROR' ? 500 : this.getHttpStatus(exception))
      .json(errorResponse);
  }

  private buildErrorResponse(exception: unknown, request: Request): ApiErrorResponse {
    const timestamp = new Date().toISOString();
    const path = request.url;
    const requestId = request.headers['x-request-id'] as string;

    if (exception instanceof HttpException) {
      return this.handleHttpException(exception, timestamp, path, requestId);
    }

    if (exception instanceof QueryFailedError) {
      return this.handleDatabaseError(exception, timestamp, path, requestId);
    }

    if (exception instanceof Error) {
      return this.handleGenericError(exception, timestamp, path, requestId);
    }

    return {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        timestamp,
        path,
        requestId,
      },
    };
  }

  private handleHttpException(
    exception: HttpException,
    timestamp: string,
    path: string,
    requestId?: string,
  ): ApiErrorResponse {
    const status = exception.getStatus();
    const response = exception.getResponse();

    let code: string;
    let message: string;
    let details: Record<string, any> | undefined;

    if (typeof response === 'object' && response !== null) {
      const responseObj = response as any;
      code = responseObj.error || this.getErrorCodeFromStatus(status);
      message = responseObj.message || exception.message;
      details = responseObj.details;
    } else {
      code = this.getErrorCodeFromStatus(status);
      message = typeof response === 'string' ? response : exception.message;
    }

    return {
      error: {
        code,
        message: this.getUserFriendlyMessage(code, message),
        details,
        timestamp,
        path,
        requestId,
      },
    };
  }

  private handleDatabaseError(
    exception: QueryFailedError,
    timestamp: string,
    path: string,
    requestId?: string,
  ): ApiErrorResponse {
    const pgError = exception.driverError as any;
    
    let code: string;
    let message: string;
    let details: Record<string, any> | undefined;

    switch (pgError?.code) {
      case '23505': // unique_violation
        code = 'DUPLICATE_ENTRY';
        message = 'This record already exists';
        details = { constraint: pgError.constraint };
        break;
      case '23503': // foreign_key_violation
        code = 'INVALID_REFERENCE';
        message = 'Referenced record does not exist';
        details = { constraint: pgError.constraint };
        break;
      case '23514': // check_violation
        code = 'VALIDATION_FAILED';
        message = 'Data validation failed';
        details = { constraint: pgError.constraint };
        break;
      default:
        code = 'DATABASE_ERROR';
        message = 'A database error occurred';
        details = { sqlState: pgError?.code };
    }

    return {
      error: {
        code,
        message,
        details,
        timestamp,
        path,
        requestId,
      },
    };
  }

  private handleGenericError(
    exception: Error,
    timestamp: string,
    path: string,
    requestId?: string,
  ): ApiErrorResponse {
    // Handle specific error types
    if (exception.name === 'TokenExpiredError') {
      return {
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Your session has expired. Please sign in again.',
          timestamp,
          path,
          requestId,
        },
      };
    }

    if (exception.name === 'JsonWebTokenError') {
      return {
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid authentication token',
          timestamp,
          path,
          requestId,
        },
      };
    }

    if (exception.message.includes('ECONNREFUSED')) {
      return {
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'External service is temporarily unavailable. Please try again later.',
          timestamp,
          path,
          requestId,
        },
      };
    }

    return {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred. Please try again later.',
        timestamp,
        path,
        requestId,
      },
    };
  }

  private getErrorCodeFromStatus(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return 'VALIDATION_FAILED';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'RATE_LIMITED';
      case HttpStatus.INTERNAL_SERVER_ERROR:
        return 'INTERNAL_ERROR';
      case HttpStatus.BAD_GATEWAY:
        return 'SERVICE_UNAVAILABLE';
      case HttpStatus.SERVICE_UNAVAILABLE:
        return 'SERVICE_UNAVAILABLE';
      default:
        return 'UNKNOWN_ERROR';
    }
  }

  private getUserFriendlyMessage(code: string, originalMessage: string): string {
    const friendlyMessages: Record<string, string> = {
      UNAUTHORIZED: 'Please sign in to access this resource',
      FORBIDDEN: 'You do not have permission to perform this action',
      NOT_FOUND: 'The requested resource was not found',
      VALIDATION_FAILED: 'Please check your input and try again',
      RATE_LIMITED: 'Too many requests. Please wait a moment and try again',
      SERVICE_UNAVAILABLE: 'Service is temporarily unavailable. Please try again later',
      QUOTA_EXCEEDED: 'Daily quota exceeded. Please try again tomorrow',
      CONFLICT_ETAG: 'This item was modified by another process. Please refresh and try again',
      TOKEN_EXPIRED: 'Your session has expired. Please sign in again',
      DUPLICATE_ENTRY: 'This item already exists',
      INVALID_REFERENCE: 'Referenced item does not exist',
    };

    return friendlyMessages[code] || originalMessage;
  }

  private getHttpStatus(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private logError(exception: unknown, request: Request, errorResponse: ApiErrorResponse) {
    const { method, url, headers, body } = request;
    const userAgent = headers['user-agent'];
    const userId = (request as any).user?.id;

    const logContext = {
      error: {
        name: exception instanceof Error ? exception.name : 'Unknown',
        message: exception instanceof Error ? exception.message : 'Unknown error',
        stack: exception instanceof Error ? exception.stack : undefined,
      },
      request: {
        method,
        url,
        userAgent,
        userId,
        body: this.sanitizeBody(body),
      },
      response: errorResponse,
    };

    if (errorResponse.error.code === 'INTERNAL_ERROR') {
      this.logger.error('Unhandled exception', logContext);
    } else {
      this.logger.warn('Handled exception', logContext);
    }
  }

  private sanitizeBody(body: any): any {
    if (!body || typeof body !== 'object') {
      return body;
    }

    const sanitized = { ...body };
    const sensitiveFields = ['password', 'token', 'secret', 'key'];
    
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }
}