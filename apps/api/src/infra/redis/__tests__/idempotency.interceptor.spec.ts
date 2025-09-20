import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of } from 'rxjs';
import { IdempotencyInterceptor } from '../idempotency.interceptor';
import { IdempotencyService } from '../idempotency.service';
import { IdempotentRequest } from '../idempotency.middleware';

describe('IdempotencyInterceptor', () => {
  let interceptor: IdempotencyInterceptor;
  let idempotencyService: jest.Mocked<IdempotencyService>;
  let reflector: jest.Mocked<Reflector>;
  let executionContext: jest.Mocked<ExecutionContext>;
  let callHandler: jest.Mocked<CallHandler>;
  let mockRequest: Partial<IdempotentRequest>;
  let mockResponse: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdempotencyInterceptor,
        {
          provide: IdempotencyService,
          useValue: {
            ensureIdempotent: jest.fn(),
          },
        },
        {
          provide: Reflector,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    interceptor = module.get<IdempotencyInterceptor>(IdempotencyInterceptor);
    idempotencyService = module.get(IdempotencyService);
    reflector = module.get(Reflector);

    mockRequest = {
      idempotencyKey: 'test-key:fingerprint',
    };

    mockResponse = {
      setHeader: jest.fn(),
    };

    executionContext = {
      getHandler: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
        getResponse: jest.fn().mockReturnValue(mockResponse),
      }),
    } as any;

    callHandler = {
      handle: jest.fn(),
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('non-idempotent methods', () => {
    it('should proceed normally when method is not marked as idempotent', (done) => {
      const expectedResult = { data: 'test-result' };
      
      reflector.get.mockReturnValue(undefined); // No idempotency options
      callHandler.handle.mockReturnValue(of(expectedResult));

      const result$ = interceptor.intercept(executionContext, callHandler);

      result$.subscribe({
        next: (result) => {
          expect(result).toBe(expectedResult);
          expect(idempotencyService.ensureIdempotent).not.toHaveBeenCalled();
          expect(reflector.get).toHaveBeenCalledWith('idempotent', executionContext.getHandler());
          done();
        },
      });
    });
  });

  describe('idempotent methods without key', () => {
    it('should proceed normally when no idempotency key is present', (done) => {
      const expectedResult = { data: 'test-result' };
      const idempotencyOptions = { ttl: 3600 };
      
      mockRequest.idempotencyKey = undefined;
      reflector.get.mockReturnValue(idempotencyOptions);
      callHandler.handle.mockReturnValue(of(expectedResult));

      const result$ = interceptor.intercept(executionContext, callHandler);

      result$.subscribe({
        next: (result) => {
          expect(result).toBe(expectedResult);
          expect(idempotencyService.ensureIdempotent).not.toHaveBeenCalled();
          done();
        },
      });
    });
  });

  describe('idempotent methods with key', () => {
    it('should apply idempotency when method is marked and key is present', (done) => {
      const expectedResult = { data: 'test-result' };
      const idempotencyOptions = { ttl: 3600, keyPrefix: 'custom' };
      
      reflector.get.mockReturnValue(idempotencyOptions);
      callHandler.handle.mockReturnValue(of(expectedResult));
      idempotencyService.ensureIdempotent.mockResolvedValue({
        data: expectedResult,
        isFromCache: false,
      });

      const result$ = interceptor.intercept(executionContext, callHandler);

      result$.subscribe({
        next: (result) => {
          expect(result).toBe(expectedResult);
          expect(idempotencyService.ensureIdempotent).toHaveBeenCalledWith(
            'test-key:fingerprint',
            expect.any(Function),
            idempotencyOptions,
          );
          expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Idempotency-Cache', 'MISS');
          done();
        },
      });
    });

    it('should return cached result when available', (done) => {
      const cachedResult = { data: 'cached-result' };
      const idempotencyOptions = { ttl: 3600 };
      
      reflector.get.mockReturnValue(idempotencyOptions);
      idempotencyService.ensureIdempotent.mockResolvedValue({
        data: cachedResult,
        isFromCache: true,
      });

      const result$ = interceptor.intercept(executionContext, callHandler);

      result$.subscribe({
        next: (result) => {
          expect(result).toBe(cachedResult);
          expect(callHandler.handle).not.toHaveBeenCalled();
          expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Idempotency-Cache', 'HIT');
          done();
        },
      });
    });

    it('should execute operation when not cached', (done) => {
      const expectedResult = { data: 'fresh-result' };
      const idempotencyOptions = { ttl: 1800 };
      
      reflector.get.mockReturnValue(idempotencyOptions);
      callHandler.handle.mockReturnValue(of(expectedResult));
      
      // Mock the operation execution
      idempotencyService.ensureIdempotent.mockImplementation(async (key, operation) => {
        const result = await operation();
        return { data: result, isFromCache: false };
      });

      const result$ = interceptor.intercept(executionContext, callHandler);

      result$.subscribe({
        next: (result) => {
          expect(result).toBe(expectedResult);
          expect(callHandler.handle).toHaveBeenCalledTimes(1);
          expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Idempotency-Cache', 'MISS');
          done();
        },
      });
    });

    it('should use default options when none provided', (done) => {
      const expectedResult = { data: 'test-result' };
      
      reflector.get.mockReturnValue({}); // Empty options
      callHandler.handle.mockReturnValue(of(expectedResult));
      idempotencyService.ensureIdempotent.mockResolvedValue({
        data: expectedResult,
        isFromCache: false,
      });

      const result$ = interceptor.intercept(executionContext, callHandler);

      result$.subscribe({
        next: (result) => {
          expect(result).toBe(expectedResult);
          expect(idempotencyService.ensureIdempotent).toHaveBeenCalledWith(
            'test-key:fingerprint',
            expect.any(Function),
            {}, // Empty options passed through
          );
          done();
        },
      });
    });
  });

  describe('error handling', () => {
    it('should propagate errors from idempotency service', (done) => {
      const error = new Error('Idempotency service error');
      const idempotencyOptions = { ttl: 3600 };
      
      reflector.get.mockReturnValue(idempotencyOptions);
      idempotencyService.ensureIdempotent.mockRejectedValue(error);

      const result$ = interceptor.intercept(executionContext, callHandler);

      result$.subscribe({
        error: (err) => {
          expect(err).toBe(error);
          done();
        },
      });
    });

    it('should propagate errors from operation execution', (done) => {
      const operationError = new Error('Operation failed');
      const idempotencyOptions = { ttl: 3600 };
      
      reflector.get.mockReturnValue(idempotencyOptions);
      idempotencyService.ensureIdempotent.mockRejectedValue(operationError);

      const result$ = interceptor.intercept(executionContext, callHandler);

      result$.subscribe({
        error: (err) => {
          expect(err).toBe(operationError);
          done();
        },
      });
    });
  });

  describe('cache headers', () => {
    it('should set cache HIT header for cached results', (done) => {
      const cachedResult = { data: 'cached' };
      const idempotencyOptions = { ttl: 3600 };
      
      reflector.get.mockReturnValue(idempotencyOptions);
      idempotencyService.ensureIdempotent.mockResolvedValue({
        data: cachedResult,
        isFromCache: true,
      });

      const result$ = interceptor.intercept(executionContext, callHandler);

      result$.subscribe({
        next: () => {
          expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Idempotency-Cache', 'HIT');
          done();
        },
      });
    });

    it('should set cache MISS header for fresh results', (done) => {
      const freshResult = { data: 'fresh' };
      const idempotencyOptions = { ttl: 3600 };
      
      reflector.get.mockReturnValue(idempotencyOptions);
      callHandler.handle.mockReturnValue(of(freshResult));
      idempotencyService.ensureIdempotent.mockResolvedValue({
        data: freshResult,
        isFromCache: false,
      });

      const result$ = interceptor.intercept(executionContext, callHandler);

      result$.subscribe({
        next: () => {
          expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Idempotency-Cache', 'MISS');
          done();
        },
      });
    });
  });

  describe('operation execution', () => {
    it('should convert CallHandler observable to Promise for idempotency service', (done) => {
      const expectedResult = { data: 'test-result' };
      const idempotencyOptions = { ttl: 3600 };
      
      reflector.get.mockReturnValue(idempotencyOptions);
      callHandler.handle.mockReturnValue(of(expectedResult));
      
      idempotencyService.ensureIdempotent.mockImplementation(async (key, operation) => {
        const result = await operation();
        expect(result).toBe(expectedResult);
        return { data: result, isFromCache: false };
      });

      const result$ = interceptor.intercept(executionContext, callHandler);

      result$.subscribe({
        next: (result) => {
          expect(result).toBe(expectedResult);
          done();
        },
      });
    });
  });
});