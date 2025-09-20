import { HttpException, HttpStatus } from '@nestjs/common';

export class ConflictEtagException extends HttpException {
  constructor(message = 'Resource was modified by another process') {
    super(
      {
        error: 'CONFLICT_ETAG',
        message,
        details: {
          suggestion: 'Please refresh the data and try again',
        },
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class QuotaExceededException extends HttpException {
  constructor(quotaType = 'API', resetTime?: Date) {
    super(
      {
        error: 'QUOTA_EXCEEDED',
        message: `${quotaType} quota exceeded`,
        details: {
          quotaType,
          resetTime: resetTime?.toISOString(),
          suggestion: 'Please try again later or contact support',
        },
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

export class ExternalServiceException extends HttpException {
  constructor(service: string, originalError?: string) {
    super(
      {
        error: 'SERVICE_UNAVAILABLE',
        message: `${service} service is temporarily unavailable`,
        details: {
          service,
          originalError,
          suggestion: 'Please try again in a few minutes',
        },
      },
      HttpStatus.BAD_GATEWAY,
    );
  }
}

export class ValidationException extends HttpException {
  constructor(errors: Record<string, string[]>) {
    super(
      {
        error: 'VALIDATION_FAILED',
        message: 'Input validation failed',
        details: {
          errors,
          suggestion: 'Please check the highlighted fields and try again',
        },
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

export class BusinessLogicException extends HttpException {
  constructor(code: string, message: string, details?: Record<string, any>) {
    super(
      {
        error: code,
        message,
        details: {
          ...details,
          suggestion: 'Please review your input and try again',
        },
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class AuthenticationException extends HttpException {
  constructor(message = 'Authentication failed') {
    super(
      {
        error: 'UNAUTHORIZED',
        message,
        details: {
          suggestion: 'Please sign in again',
        },
      },
      HttpStatus.UNAUTHORIZED,
    );
  }
}

export class AuthorizationException extends HttpException {
  constructor(resource: string) {
    super(
      {
        error: 'FORBIDDEN',
        message: `Access denied to ${resource}`,
        details: {
          resource,
          suggestion: 'Contact support if you believe this is an error',
        },
      },
      HttpStatus.FORBIDDEN,
    );
  }
}