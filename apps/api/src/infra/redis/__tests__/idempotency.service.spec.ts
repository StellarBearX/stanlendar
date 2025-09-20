import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { IdempotencyService } from '../idempotency.service';
import Redis from 'ioredis';

// Mock Redis
jest.mock('ioredis');
const MockedRedis = Redis as jest.MockedClass<typeof Redis>;

describe('IdempotencyService', () => {
  let service: IdempotencyService;
  let mockRedis: jest.Mocked<Redis>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    // Create mock Redis instance
    mockRedis = {
      get: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
      ttl: jest.fn(),
      exists: jest.fn(),
      quit: jest.fn(),
      on: jest.fn(),
    } as any;

    // Mock Redis constructor
    MockedRedis.mockImplementation(() => mockRedis);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdempotencyService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config = {
                REDIS_HOST: 'localhost',
                REDIS_PORT: 6379,
                REDIS_DB: 0,
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<IdempotencyService>(IdempotencyService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('ensureIdempotent', () => {
    it('should execute operation and cache result when key does not exist', async () => {
      const key = 'test-key';
      const expectedResult = { data: 'test-result' };
      const operation = jest.fn().mockResolvedValue(expectedResult);

      mockRedis.get.mockResolvedValue(null);
      mockRedis.setex.mockResolvedValue('OK');

      const result = await service.ensureIdempotent(key, operation);

      expect(mockRedis.get).toHaveBeenCalledWith('idem:test-key');
      expect(operation).toHaveBeenCalledTimes(1);
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'idem:test-key',
        86400,
        JSON.stringify(expectedResult),
      );
      expect(result).toEqual({
        data: expectedResult,
        isFromCache: false,
      });
    });

    it('should return cached result when key exists', async () => {
      const key = 'test-key';
      const cachedResult = { data: 'cached-result' };
      const operation = jest.fn();

      mockRedis.get.mockResolvedValue(JSON.stringify(cachedResult));

      const result = await service.ensureIdempotent(key, operation);

      expect(mockRedis.get).toHaveBeenCalledWith('idem:test-key');
      expect(operation).not.toHaveBeenCalled();
      expect(mockRedis.setex).not.toHaveBeenCalled();
      expect(result).toEqual({
        data: cachedResult,
        isFromCache: true,
      });
    });

    it('should use custom TTL and key prefix', async () => {
      const key = 'test-key';
      const expectedResult = { data: 'test-result' };
      const operation = jest.fn().mockResolvedValue(expectedResult);
      const options = { ttl: 3600, keyPrefix: 'custom' };

      mockRedis.get.mockResolvedValue(null);
      mockRedis.setex.mockResolvedValue('OK');

      await service.ensureIdempotent(key, operation, options);

      expect(mockRedis.get).toHaveBeenCalledWith('custom:test-key');
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'custom:test-key',
        3600,
        JSON.stringify(expectedResult),
      );
    });

    it('should propagate operation errors', async () => {
      const key = 'test-key';
      const error = new Error('Operation failed');
      const operation = jest.fn().mockRejectedValue(error);

      mockRedis.get.mockResolvedValue(null);

      await expect(service.ensureIdempotent(key, operation)).rejects.toThrow(
        'Operation failed',
      );

      expect(operation).toHaveBeenCalledTimes(1);
      expect(mockRedis.setex).not.toHaveBeenCalled();
    });
  });

  describe('generateRequestFingerprint', () => {
    it('should generate consistent fingerprint for same input', () => {
      const userId = 'user-123';
      const endpoint = 'POST /api/sync';
      const payload = { eventIds: ['1', '2'], dryRun: false };

      const fingerprint1 = service.generateRequestFingerprint(userId, endpoint, payload);
      const fingerprint2 = service.generateRequestFingerprint(userId, endpoint, payload);

      expect(fingerprint1).toBe(fingerprint2);
      expect(fingerprint1).toHaveLength(16);
    });

    it('should generate different fingerprints for different inputs', () => {
      const userId = 'user-123';
      const endpoint = 'POST /api/sync';
      const payload1 = { eventIds: ['1', '2'], dryRun: false };
      const payload2 = { eventIds: ['1', '3'], dryRun: false };

      const fingerprint1 = service.generateRequestFingerprint(userId, endpoint, payload1);
      const fingerprint2 = service.generateRequestFingerprint(userId, endpoint, payload2);

      expect(fingerprint1).not.toBe(fingerprint2);
    });

    it('should normalize payload order for consistent fingerprinting', () => {
      const userId = 'user-123';
      const endpoint = 'POST /api/sync';
      const payload1 = { dryRun: false, eventIds: ['2', '1'] };
      const payload2 = { eventIds: ['1', '2'], dryRun: false };

      const fingerprint1 = service.generateRequestFingerprint(userId, endpoint, payload1);
      const fingerprint2 = service.generateRequestFingerprint(userId, endpoint, payload2);

      expect(fingerprint1).toBe(fingerprint2);
    });

    it('should handle null and undefined payloads', () => {
      const userId = 'user-123';
      const endpoint = 'POST /api/sync';

      const fingerprint1 = service.generateRequestFingerprint(userId, endpoint, null);
      const fingerprint2 = service.generateRequestFingerprint(userId, endpoint, undefined);

      expect(fingerprint1).toBe(fingerprint2);
      expect(fingerprint1).toHaveLength(16);
    });
  });

  describe('validateIdempotencyKey', () => {
    it('should validate correct idempotency keys', () => {
      const validKeys = [
        'abcd1234efgh5678',
        'user-123_operation-456',
        'ABCD1234EFGH5678',
        'a'.repeat(16),
        'a'.repeat(64),
      ];

      validKeys.forEach(key => {
        expect(service.validateIdempotencyKey(key)).toBe(true);
      });
    });

    it('should reject invalid idempotency keys', () => {
      const invalidKeys = [
        'short',                    // too short
        'a'.repeat(65),            // too long
        'invalid@key',             // invalid characters
        'invalid key',             // spaces
        'invalid.key',             // dots
        '',                        // empty
      ];

      invalidKeys.forEach(key => {
        expect(service.validateIdempotencyKey(key)).toBe(false);
      });
    });
  });

  describe('invalidateKey', () => {
    it('should delete key from Redis', async () => {
      const key = 'test-key';
      mockRedis.del.mockResolvedValue(1);

      await service.invalidateKey(key);

      expect(mockRedis.del).toHaveBeenCalledWith('idem:test-key');
    });

    it('should use custom key prefix', async () => {
      const key = 'test-key';
      const keyPrefix = 'custom';
      mockRedis.del.mockResolvedValue(1);

      await service.invalidateKey(key, keyPrefix);

      expect(mockRedis.del).toHaveBeenCalledWith('custom:test-key');
    });
  });

  describe('getKeyTtl', () => {
    it('should return TTL for existing key', async () => {
      const key = 'test-key';
      const expectedTtl = 3600;
      mockRedis.ttl.mockResolvedValue(expectedTtl);

      const ttl = await service.getKeyTtl(key);

      expect(mockRedis.ttl).toHaveBeenCalledWith('idem:test-key');
      expect(ttl).toBe(expectedTtl);
    });

    it('should return -1 for non-existent key', async () => {
      const key = 'non-existent-key';
      mockRedis.ttl.mockResolvedValue(-2);

      const ttl = await service.getKeyTtl(key);

      expect(ttl).toBe(-2);
    });
  });

  describe('keyExists', () => {
    it('should return true for existing key', async () => {
      const key = 'test-key';
      mockRedis.exists.mockResolvedValue(1);

      const exists = await service.keyExists(key);

      expect(mockRedis.exists).toHaveBeenCalledWith('idem:test-key');
      expect(exists).toBe(true);
    });

    it('should return false for non-existent key', async () => {
      const key = 'non-existent-key';
      mockRedis.exists.mockResolvedValue(0);

      const exists = await service.keyExists(key);

      expect(exists).toBe(false);
    });
  });

  describe('normalizePayload', () => {
    it('should handle primitive values', () => {
      expect(service['normalizePayload']('string')).toBe('string');
      expect(service['normalizePayload'](123)).toBe(123);
      expect(service['normalizePayload'](true)).toBe(true);
      expect(service['normalizePayload'](null)).toBe(null);
      expect(service['normalizePayload'](undefined)).toBe(null);
    });

    it('should sort array elements', () => {
      const input = [3, 1, 2];
      const result = service['normalizePayload'](input);
      expect(result).toEqual([1, 2, 3]);
    });

    it('should sort object keys', () => {
      const input = { c: 3, a: 1, b: 2 };
      const result = service['normalizePayload'](input);
      expect(Object.keys(result)).toEqual(['a', 'b', 'c']);
    });

    it('should handle nested objects and arrays', () => {
      const input = {
        array: [{ b: 2, a: 1 }, { d: 4, c: 3 }],
        object: { nested: { z: 26, a: 1 } },
      };
      const result = service['normalizePayload'](input);
      
      expect(result.array).toEqual([{ a: 1, b: 2 }, { c: 3, d: 4 }]);
      expect(result.object.nested).toEqual({ a: 1, z: 26 });
    });

    it('should skip undefined values and functions', () => {
      const input = {
        valid: 'value',
        undefined: undefined,
        func: () => {},
      };
      const result = service['normalizePayload'](input);
      
      expect(result).toEqual({ valid: 'value' });
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle Redis connection errors gracefully', async () => {
      const key = 'test-key';
      const operation = jest.fn().mockResolvedValue('result');
      const redisError = new Error('Redis connection failed');

      mockRedis.get.mockRejectedValue(redisError);

      await expect(service.ensureIdempotent(key, operation)).rejects.toThrow(
        'Redis connection failed',
      );
    });

    it('should handle JSON parsing errors for cached values', async () => {
      const key = 'test-key';
      const operation = jest.fn().mockResolvedValue('result');

      mockRedis.get.mockResolvedValue('invalid-json');

      // Should fall back to executing operation
      await expect(service.ensureIdempotent(key, operation)).rejects.toThrow();
    });
  });
});