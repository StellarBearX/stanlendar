import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ArgumentsHost } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { GlobalExceptionFilter } from '../global-exception.filter';

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let mockResponse: any;
  let mockRequest: any;
  let mockHost: ArgumentsHost;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GlobalExceptionFilter],
    }).compile();

    filter = module.get<GlobalExceptionFilter>(GlobalExceptionFilter);

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn(),
    };

    mockRequest = {
      url: '/test',
      method: 'GET',
      headers: {
        'user-agent': 'test-agent',
        'x-request-id': 'test-request-id',
      },
      user: { id: 'user-123' },
    };

    mockHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    } as ArgumentsHost;
  });

  describe('HTTP Exceptions', () => {
    it('should handle HttpException with proper error response', () => {
      const exception = new HttpException('Test error', HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'BAD_REQUEST',
          message: 'Test error',
          details: undefined,
          timestamp: expect.any(String),
          path: '/test',
          requestId: 'test-request-id',
        },
      });
    });

    it('should handle HttpException with custom error object', () => {
      const exception = new HttpException(
        {
          error: 'CUSTOM_ERROR',
          message: 'Custom error message',
          details: { field: 'value' },
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.UNPROCESSABLE_ENTITY);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'CUSTOM_ERROR',
          message: 'Custom error message',
          details: { field: 'value' },
          timestamp: expect.any(String),
          path: '/test',
          requestId: 'test-request-id',
        },
      });
    });

    it('should handle unauthorized errors with user-friendly message', () => {
      const exception = new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);

      filter.catch(exception, mockHost);

      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Please sign in to access this resource',
          timestamp: expect.any(String),
          path: '/test',
          requestId: 'test-request-id',
        },
      });
    });
  });

  describe('Database Exceptions', () => {
    it('should handle unique constraint violation', () => {
      const exception = new QueryFailedError(
        'SELECT * FROM test',
        [],
        {
          code: '23505',
          constraint: 'unique_email',
        } as any,
      );

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'DUPLICATE_ENTRY',
          message: 'This record already exists',
          details: { constraint: 'unique_email' },
          timestamp: expect.any(String),
          path: '/test',
          requestId: 'test-request-id',
        },
      });
    });

    it('should handle foreign key constraint violation', () => {
      const exception = new QueryFailedError(
        'INSERT INTO test',
        [],
        {
          code: '23503',
          constraint: 'fk_user_id',
        } as any,
      );

      filter.catch(exception, mockHost);

      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'INVALID_REFERENCE',
          message: 'Referenced record does not exist',
          details: { constraint: 'fk_user_id' },
          timestamp: expect.any(String),
          path: '/test',
          requestId: 'test-request-id',
        },
      });
    });

    it('should handle check constraint violation', () => {
      const exception = new QueryFailedError(
        'UPDATE test',
        [],
        {
          code: '23514',
          constraint: 'check_status',
        } as any,
      );

      filter.catch(exception, mockHost);

      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Data validation failed',
          details: { constraint: 'check_status' },
          timestamp: expect.any(String),
          path: '/test',
          requestId: 'test-request-id',
        },
      });
    });
  });

  describe('Generic Exceptions', () => {
    it('should handle TokenExpiredError', () => {
      const exception = new Error('Token expired');
      exception.name = 'TokenExpiredError';

      filter.catch(exception, mockHost);

      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Your session has expired. Please sign in again.',
          timestamp: expect.any(String),
          path: '/test',
          requestId: 'test-request-id',
        },
      });
    });

    it('should handle JsonWebTokenError', () => {
      const exception = new Error('Invalid token');
      exception.name = 'JsonWebTokenError';

      filter.catch(exception, mockHost);

      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid authentication token',
          timestamp: expect.any(String),
          path: '/test',
          requestId: 'test-request-id',
        },
      });
    });

    it('should handle connection errors', () => {
      const exception = new Error('connect ECONNREFUSED 127.0.0.1:5432');

      filter.catch(exception, mockHost);

      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'External service is temporarily unavailable. Please try again later.',
          timestamp: expect.any(String),
          path: '/test',
          requestId: 'test-request-id',
        },
      });
    });

    it('should handle unknown errors', () => {
      const exception = new Error('Unknown error');

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred. Please try again later.',
          timestamp: expect.any(String),
          path: '/test',
          requestId: 'test-request-id',
        },
      });
    });

    it('should handle non-Error exceptions', () => {
      const exception = 'String error';

      filter.catch(exception, mockHost);

      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
          timestamp: expect.any(String),
          path: '/test',
          requestId: 'test-request-id',
        },
      });
    });
  });

  describe('Request sanitization', () => {
    it('should sanitize sensitive fields in request body', () => {
      const mockRequestWithSensitiveData = {
        ...mockRequest,
        body: {
          email: 'test@example.com',
          password: 'secret123',
          token: 'jwt-token',
          normalField: 'normal-value',
        },
      };

      mockHost = {
        switchToHttp: () => ({
          getResponse: () => mockResponse,
          getRequest: () => mockRequestWithSensitiveData,
        }),
      } as ArgumentsHost;

      const exception = new Error('Test error');
      const logSpy = jest.spyOn(filter['logger'], 'error').mockImplementation();

      filter.catch(exception, mockHost);

      expect(logSpy).toHaveBeenCalledWith(
        'Unhandled exception',
        expect.objectContaining({
          request: expect.objectContaining({
            body: {
              email: 'test@example.com',
              password: '[REDACTED]',
              token: '[REDACTED]',
              normalField: 'normal-value',
            },
          }),
        }),
      );

      logSpy.mockRestore();
    });
  });
});