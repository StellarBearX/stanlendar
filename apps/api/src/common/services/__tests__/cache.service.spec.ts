import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../cache.service';
import Redis from 'ioredis';

// Mock Redis
jest.mock('ioredis');
const MockedRedis = Redis as jest.MockedClass<typeof Redis>;

describe('CacheService', () => {
  let service: CacheService;
  let mockRedis: jest.Mocked<Redis>;

  beforeEach(async () => {
    const mockRedisInstance = {
      get: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
      mget: jest.fn(),
      keys: jest.fn(),
      incrby: jest.fn(),
      expire: jest.fn(),
      exists: jest.fn(),
      ttl: jest.fn(),
      flushall: jest.fn(),
      quit: jest.fn(),
      on: jest.fn(),
      pipeline: jest.fn(() => ({
        setex: jest.fn(),
        exec: jest.fn()
      }))
    };

    MockedRedis.mockImplementation(() => mockRedisInstance as any);
    mockRedis = mockRedisInstance as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config: Record<string, any> = {
                REDIS_HOST: 'localhost',
                REDIS_PORT: 6379,
                REDIS_PASSWORD: undefined
              };
              return config[key] || defaultValue;
            })
          }
        }
      ]
    }).compile();

    service = module.get<CacheService>(CacheService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('get', () => {
    it('should return cached value', async () => {
      const testData = { id: 1, name: 'test' };
      mockRedis.get.mockResolvedValue(JSON.stringify(testData));

      const result = await service.get('test-key');
      
      expect(result).toEqual(testData);
      expect(mockRedis.get).toHaveBeenCalledWith('test-key');
    });

    it('should return null for non-existent key', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await service.get('non-existent');
      
      expect(result).toBeNull();
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis error'));

      const result = await service.get('error-key');
      
      expect(result).toBeNull();
    });

    it('should handle compressed data', async () => {
      const testData = { id: 1, name: 'test' };
      const compressedData = {
        compressed: true,
        data: JSON.stringify(testData)
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(compressedData));

      const result = await service.get('compressed-key', { compress: true });
      
      expect(result).toEqual(testData);
    });
  });

  describe('set', () => {
    it('should set value with default TTL', async () => {
      const testData = { id: 1, name: 'test' };
      mockRedis.setex.mockResolvedValue('OK');

      await service.set('test-key', testData);
      
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'test-key',
        3600,
        JSON.stringify(testData)
      );
    });

    it('should set value with custom TTL', async () => {
      const testData = { id: 1, name: 'test' };
      mockRedis.setex.mockResolvedValue('OK');

      await service.set('test-key', testData, { ttl: 1800 });
      
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'test-key',
        1800,
        JSON.stringify(testData)
      );
    });

    it('should handle compression option', async () => {
      const testData = { id: 1, name: 'test' };
      mockRedis.setex.mockResolvedValue('OK');

      await service.set('test-key', testData, { compress: true });
      
      const expectedData = {
        compressed: true,
        data: JSON.stringify(testData)
      };
      
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'test-key',
        3600,
        JSON.stringify(expectedData)
      );
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedis.setex.mockRejectedValue(new Error('Redis error'));

      await expect(service.set('error-key', 'value')).resolves.not.toThrow();
    });
  });

  describe('del', () => {
    it('should delete key', async () => {
      mockRedis.del.mockResolvedValue(1);

      await service.del('test-key');
      
      expect(mockRedis.del).toHaveBeenCalledWith('test-key');
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedis.del.mockRejectedValue(new Error('Redis error'));

      await expect(service.del('error-key')).resolves.not.toThrow();
    });
  });

  describe('mget', () => {
    it('should get multiple values', async () => {
      const values = ['{"id":1}', '{"id":2}', null];
      mockRedis.mget.mockResolvedValue(values);

      const result = await service.mget(['key1', 'key2', 'key3']);
      
      expect(result).toEqual([{ id: 1 }, { id: 2 }, null]);
      expect(mockRedis.mget).toHaveBeenCalledWith('key1', 'key2', 'key3');
    });

    it('should handle invalid JSON gracefully', async () => {
      const values = ['{"id":1}', 'invalid-json', null];
      mockRedis.mget.mockResolvedValue(values);

      const result = await service.mget(['key1', 'key2', 'key3']);
      
      expect(result).toEqual([{ id: 1 }, null, null]);
    });
  });

  describe('getOrSet', () => {
    it('should return cached value if exists', async () => {
      const cachedData = { id: 1, name: 'cached' };
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedData));

      const factory = jest.fn().mockResolvedValue({ id: 1, name: 'fresh' });
      const result = await service.getOrSet('test-key', factory);
      
      expect(result).toEqual(cachedData);
      expect(factory).not.toHaveBeenCalled();
    });

    it('should call factory and cache result if not exists', async () => {
      const freshData = { id: 1, name: 'fresh' };
      mockRedis.get.mockResolvedValue(null);
      mockRedis.setex.mockResolvedValue('OK');

      const factory = jest.fn().mockResolvedValue(freshData);
      const result = await service.getOrSet('test-key', factory);
      
      expect(result).toEqual(freshData);
      expect(factory).toHaveBeenCalled();
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'test-key',
        3600,
        JSON.stringify(freshData)
      );
    });
  });

  describe('invalidatePattern', () => {
    it('should delete keys matching pattern', async () => {
      const matchingKeys = ['user:1:profile', 'user:1:settings'];
      mockRedis.keys.mockResolvedValue(matchingKeys);
      mockRedis.del.mockResolvedValue(2);

      await service.invalidatePattern('user:1:*');
      
      expect(mockRedis.keys).toHaveBeenCalledWith('user:1:*');
      expect(mockRedis.del).toHaveBeenCalledWith(...matchingKeys);
    });

    it('should handle no matching keys', async () => {
      mockRedis.keys.mockResolvedValue([]);

      await service.invalidatePattern('non-existent:*');
      
      expect(mockRedis.keys).toHaveBeenCalledWith('non-existent:*');
      expect(mockRedis.del).not.toHaveBeenCalled();
    });
  });

  describe('increment', () => {
    it('should increment counter', async () => {
      mockRedis.incrby.mockResolvedValue(5);

      const result = await service.increment('counter', 2);
      
      expect(result).toBe(5);
      expect(mockRedis.incrby).toHaveBeenCalledWith('counter', 2);
    });

    it('should set expiration if TTL provided', async () => {
      mockRedis.incrby.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      await service.increment('counter', 1, { ttl: 3600 });
      
      expect(mockRedis.expire).toHaveBeenCalledWith('counter', 3600);
    });
  });

  describe('exists', () => {
    it('should return true if key exists', async () => {
      mockRedis.exists.mockResolvedValue(1);

      const result = await service.exists('test-key');
      
      expect(result).toBe(true);
    });

    it('should return false if key does not exist', async () => {
      mockRedis.exists.mockResolvedValue(0);

      const result = await service.exists('test-key');
      
      expect(result).toBe(false);
    });
  });

  describe('ttl', () => {
    it('should return TTL for key', async () => {
      mockRedis.ttl.mockResolvedValue(3600);

      const result = await service.ttl('test-key');
      
      expect(result).toBe(3600);
    });

    it('should handle Redis errors', async () => {
      mockRedis.ttl.mockRejectedValue(new Error('Redis error'));

      const result = await service.ttl('error-key');
      
      expect(result).toBe(-1);
    });
  });
});