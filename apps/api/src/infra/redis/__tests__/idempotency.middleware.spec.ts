import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { IdempotencyMiddleware, IdempotentRequest } from '../idempotency.middleware';
import { IdempotencyService } from '../idempotency.service';
import { Response, NextFunction } from 'express';

describe('IdempotencyMiddleware', () => {
  let middleware: IdempotencyMiddleware;
  let idempotencyService: jest.Mocked<IdempotencyService>;
  let mockRequest: Partial<IdempotentRequest>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdempotencyMiddleware,
        {
          provide: IdempotencyService,
          useValue: {
            validateIdempotencyKey: jest.fn(),
            generateRequestFingerprint: jest.fn(),
          },
        },
      ],
    }).compile();

    middleware = module.get<IdempotencyMiddleware>(IdempotencyMiddleware);
    idempotencyService = module.get(IdempotencyService);
    
    mockRequest = {
      method: 'POST',
      path: '/api/sync',
      headers: {},
      body: { test: 'data' },
      user: { id: 'user-123' },
    };
    
    mockResponse = {};
    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('state-changing operations', () => {
    it('should require idempotency key for POST requests', async () => {
      mockRequest.method = 'POST';
      mockRequest.headers = {};

      await expect(
        middleware.use(mockRequest as IdempotentRequest, mockResponse as Response, mockNext),
      ).rejects.toThrow(BadRequestException);

      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should require idempotency key for PUT requests', async () => {
      mockRequest.method = 'PUT';
      mockRequest.headers = {};

      await expect(
        middleware.use(mockRequest as IdempotentRequest, mockResponse as Response, mockNext),
      ).rejects.toThrow(BadRequestException);
    });

    it('should require idempotency key for PATCH requests', async () => {
      mockRequest.method = 'PATCH';
      mockRequest.headers = {};

      await expect(
        middleware.use(mockRequest as IdempotentRequest, mockResponse as Response, mockNext),
      ).rejects.toThrow(BadRequestException);
    });

    it('should require idempotency key for DELETE requests', async () => {
      mockRequest.method = 'DELETE';
      mockRequest.headers = {};

      await expect(
        middleware.use(mockRequest as IdempotentRequest, mockResponse as Response, mockNext),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('non-state-changing operations', () => {
    it('should skip idempotency for GET requests', async () => {
      mockRequest.method = 'GET';
      mockRequest.headers = {};

      await middleware.use(mockRequest as IdempotentRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockRequest.idempotencyKey).toBeUndefined();
    });

    it('should skip idempotency for HEAD requests', async () => {
      mockRequest.method = 'HEAD';
      mockRequest.headers = {};

      await middleware.use(mockRequest as IdempotentRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should skip idempotency for OPTIONS requests', async () => {
      mockRequest.method = 'OPTIONS';
      mockRequest.headers = {};

      await middleware.use(mockRequest as IdempotentRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
    });
  });

  describe('idempotency key extraction', () => {
    it('should extract key from Idempotency-Key header', async () => {
      const idempotencyKey = 'test-key-123456789';
      mockRequest.method = 'POST';
      mockRequest.headers = { 'idempotency-key': idempotencyKey };

      idempotencyService.validateIdempotencyKey.mockReturnValue(true);
      idempotencyService.generateRequestFingerprint.mockReturnValue('fingerprint123');

      await middleware.use(mockRequest as IdempotentRequest, mockResponse as Response, mockNext);

      expect(mockRequest.idempotencyKey).toBe(`${idempotencyKey}:fingerprint123`);
      expect(mockRequest.isIdempotent).toBe(true);
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should extract key from X-Idempotency-Key header', async () => {
      const idempotencyKey = 'test-key-123456789';
      mockRequest.method = 'POST';
      mockRequest.headers = { 'x-idempotency-key': idempotencyKey };

      idempotencyService.validateIdempotencyKey.mockReturnValue(true);
      idempotencyService.generateRequestFingerprint.mockReturnValue('fingerprint123');

      await middleware.use(mockRequest as IdempotentRequest, mockResponse as Response, mockNext);

      expect(mockRequest.idempotencyKey).toBe(`${idempotencyKey}:fingerprint123`);
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should prefer Idempotency-Key over X-Idempotency-Key', async () => {
      const primaryKey = 'primary-key-123456789';
      const fallbackKey = 'fallback-key-123456789';
      mockRequest.method = 'POST';
      mockRequest.headers = {
        'idempotency-key': primaryKey,
        'x-idempotency-key': fallbackKey,
      };

      idempotencyService.validateIdempotencyKey.mockReturnValue(true);
      idempotencyService.generateRequestFingerprint.mockReturnValue('fingerprint123');

      await middleware.use(mockRequest as IdempotentRequest, mockResponse as Response, mockNext);

      expect(mockRequest.idempotencyKey).toBe(`${primaryKey}:fingerprint123`);
    });
  });

  describe('idempotency key validation', () => {
    it('should reject invalid idempotency keys', async () => {
      const invalidKey = 'short';
      mockRequest.method = 'POST';
      mockRequest.headers = { 'idempotency-key': invalidKey };

      idempotencyService.validateIdempotencyKey.mockReturnValue(false);

      await expect(
        middleware.use(mockRequest as IdempotentRequest, mockResponse as Response, mockNext),
      ).rejects.toThrow(BadRequestException);

      expect(idempotencyService.validateIdempotencyKey).toHaveBeenCalledWith(invalidKey);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should accept valid idempotency keys', async () => {
      const validKey = 'valid-key-123456789';
      mockRequest.method = 'POST';
      mockRequest.headers = { 'idempotency-key': validKey };

      idempotencyService.validateIdempotencyKey.mockReturnValue(true);
      idempotencyService.generateRequestFingerprint.mockReturnValue('fingerprint123');

      await middleware.use(mockRequest as IdempotentRequest, mockResponse as Response, mockNext);

      expect(idempotencyService.validateIdempotencyKey).toHaveBeenCalledWith(validKey);
      expect(mockNext).toHaveBeenCalledTimes(1);
    });
  });

  describe('request fingerprinting', () => {
    it('should generate fingerprint with user ID', async () => {
      const idempotencyKey = 'test-key-123456789';
      mockRequest.method = 'POST';
      mockRequest.path = '/api/sync';
      mockRequest.headers = { 'idempotency-key': idempotencyKey };
      mockRequest.body = { eventIds: ['1', '2'] };
      mockRequest.user = { id: 'user-123' };

      idempotencyService.validateIdempotencyKey.mockReturnValue(true);
      idempotencyService.generateRequestFingerprint.mockReturnValue('fingerprint123');

      await middleware.use(mockRequest as IdempotentRequest, mockResponse as Response, mockNext);

      expect(idempotencyService.generateRequestFingerprint).toHaveBeenCalledWith(
        'user-123',
        'POST /api/sync',
        { eventIds: ['1', '2'] },
      );
    });

    it('should handle anonymous users', async () => {
      const idempotencyKey = 'test-key-123456789';
      mockRequest.method = 'POST';
      mockRequest.headers = { 'idempotency-key': idempotencyKey };
      mockRequest.user = undefined;

      idempotencyService.validateIdempotencyKey.mockReturnValue(true);
      idempotencyService.generateRequestFingerprint.mockReturnValue('fingerprint123');

      await middleware.use(mockRequest as IdempotentRequest, mockResponse as Response, mockNext);

      expect(idempotencyService.generateRequestFingerprint).toHaveBeenCalledWith(
        'anonymous',
        'POST /api/sync',
        { test: 'data' },
      );
    });

    it('should extract user ID from JWT sub claim', async () => {
      const idempotencyKey = 'test-key-123456789';
      mockRequest.method = 'POST';
      mockRequest.headers = { 'idempotency-key': idempotencyKey };
      mockRequest.user = { sub: 'jwt-user-456' };

      idempotencyService.validateIdempotencyKey.mockReturnValue(true);
      idempotencyService.generateRequestFingerprint.mockReturnValue('fingerprint123');

      await middleware.use(mockRequest as IdempotentRequest, mockResponse as Response, mockNext);

      expect(idempotencyService.generateRequestFingerprint).toHaveBeenCalledWith(
        'jwt-user-456',
        'POST /api/sync',
        { test: 'data' },
      );
    });
  });

  describe('combined key generation', () => {
    it('should combine idempotency key with fingerprint', async () => {
      const idempotencyKey = 'user-provided-key';
      const fingerprint = 'generated-fingerprint';
      mockRequest.method = 'POST';
      mockRequest.headers = { 'idempotency-key': idempotencyKey };

      idempotencyService.validateIdempotencyKey.mockReturnValue(true);
      idempotencyService.generateRequestFingerprint.mockReturnValue(fingerprint);

      await middleware.use(mockRequest as IdempotentRequest, mockResponse as Response, mockNext);

      expect(mockRequest.idempotencyKey).toBe(`${idempotencyKey}:${fingerprint}`);
      expect(mockRequest.isIdempotent).toBe(true);
    });
  });

  describe('error messages', () => {
    it('should provide clear error for missing idempotency key', async () => {
      mockRequest.method = 'POST';
      mockRequest.headers = {};

      try {
        await middleware.use(mockRequest as IdempotentRequest, mockResponse as Response, mockNext);
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.getResponse()).toEqual({
          error: 'IDEMPOTENCY_KEY_REQUIRED',
          message: 'Idempotency-Key header is required for this operation',
        });
      }
    });

    it('should provide clear error for invalid idempotency key', async () => {
      mockRequest.method = 'POST';
      mockRequest.headers = { 'idempotency-key': 'invalid' };

      idempotencyService.validateIdempotencyKey.mockReturnValue(false);

      try {
        await middleware.use(mockRequest as IdempotentRequest, mockResponse as Response, mockNext);
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.getResponse()).toEqual({
          error: 'INVALID_IDEMPOTENCY_KEY',
          message: 'Idempotency key must be 16-64 characters, alphanumeric with hyphens/underscores',
        });
      }
    });
  });
});