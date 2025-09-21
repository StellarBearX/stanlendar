import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DataSource, SelectQueryBuilder } from 'typeorm';
import { QueryOptimizerService, OptimizedQueryBuilder } from '../query-optimizer.service';

describe('QueryOptimizerService', () => {
  let service: QueryOptimizerService;
  let mockDataSource: jest.Mocked<DataSource>;
  let mockQueryBuilder: jest.Mocked<SelectQueryBuilder<any>>;

  beforeEach(async () => {
    mockDataSource = {
      query: jest.fn(),
      options: {
        type: 'postgres',
        maxConnections: 10
      }
    } as any;

    mockQueryBuilder = {
      getQuery: jest.fn(),
      getMany: jest.fn(),
      expressionMap: {
        wheres: [],
        joinAttributes: [],
        limit: undefined,
        offset: undefined,
        mainAlias: { tablePath: 'user' }
      }
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueryOptimizerService,
        {
          provide: DataSource,
          useValue: mockDataSource
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config: Record<string, any> = {
                SLOW_QUERY_THRESHOLD_MS: 200
              };
              return config[key] || defaultValue;
            })
          }
        }
      ]
    }).compile();

    service = module.get<QueryOptimizerService>(QueryOptimizerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('executeOptimizedQuery', () => {
    it('should execute query and record metrics', async () => {
      const mockResult = [{ id: 1, name: 'test' }];
      mockQueryBuilder.getQuery.mockReturnValue('SELECT * FROM user');
      mockQueryBuilder.getMany.mockResolvedValue(mockResult);

      const result = await service.executeOptimizedQuery(mockQueryBuilder);

      expect(result).toEqual(mockResult);
      expect(mockQueryBuilder.getMany).toHaveBeenCalled();
    });

    it('should log slow queries', async () => {
      const loggerSpy = jest.spyOn((service as any).logger, 'warn').mockImplementation();
      const mockResult = [{ id: 1, name: 'test' }];
      
      mockQueryBuilder.getQuery.mockReturnValue('SELECT * FROM user');
      mockQueryBuilder.getMany.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(mockResult), 250))
      );

      await service.executeOptimizedQuery(mockQueryBuilder);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Slow query detected')
      );
      
      loggerSpy.mockRestore();
    });

    it('should handle query errors', async () => {
      const error = new Error('Query failed');
      mockQueryBuilder.getQuery.mockReturnValue('SELECT * FROM user');
      mockQueryBuilder.getMany.mockRejectedValue(error);

      await expect(service.executeOptimizedQuery(mockQueryBuilder))
        .rejects.toThrow('Query failed');
    });
  });

  describe('getPerformanceReport', () => {
    it('should return performance metrics', () => {
      // Execute some queries to generate metrics
      const report = service.getPerformanceReport();

      expect(report).toHaveProperty('slowQueries');
      expect(report).toHaveProperty('averageExecutionTime');
      expect(report).toHaveProperty('totalQueries');
      expect(Array.isArray(report.slowQueries)).toBe(true);
    });
  });

  describe('analyzeTableStatistics', () => {
    it('should update table statistics', async () => {
      mockDataSource.query.mockResolvedValue(undefined);

      await service.analyzeTableStatistics();

      expect(mockDataSource.query).toHaveBeenCalledTimes(6); // 6 tables
      expect(mockDataSource.query).toHaveBeenCalledWith('ANALYZE user');
      expect(mockDataSource.query).toHaveBeenCalledWith('ANALYZE subject');
    });

    it('should handle errors gracefully', async () => {
      const loggerSpy = jest.spyOn((service as any).logger, 'error').mockImplementation();
      mockDataSource.query.mockRejectedValue(new Error('Database error'));

      await service.analyzeTableStatistics();

      expect(loggerSpy).toHaveBeenCalledWith(
        'Failed to update table statistics:',
        expect.any(Error)
      );
      
      loggerSpy.mockRestore();
    });
  });

  describe('createOptimalIndexes', () => {
    it('should create performance indexes', async () => {
      mockDataSource.query.mockResolvedValue(undefined);

      await service.createOptimalIndexes();

      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('CREATE INDEX CONCURRENTLY')
      );
    });

    it('should handle existing indexes gracefully', async () => {
      const loggerSpy = jest.spyOn((service as any).logger, 'warn').mockImplementation();
      mockDataSource.query.mockRejectedValue(new Error('relation already exists'));

      await service.createOptimalIndexes();

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Index creation warning')
      );
      
      loggerSpy.mockRestore();
    });
  });

  describe('optimizeConnectionPool', () => {
    it('should log connection pool recommendations', async () => {
      const loggerSpy = jest.spyOn((service as any).logger, 'log').mockImplementation();

      await service.optimizeConnectionPool();

      expect(loggerSpy).toHaveBeenCalledWith(
        'Current connection pool configuration:',
        expect.any(Object)
      );
      expect(loggerSpy).toHaveBeenCalledWith(
        'Recommended connection pool settings:',
        expect.any(Object)
      );
      
      loggerSpy.mockRestore();
    });
  });
});

describe('OptimizedQueryBuilder', () => {
  let mockQueryBuilder: jest.Mocked<SelectQueryBuilder<any>>;

  beforeEach(() => {
    mockQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis()
    } as any;
  });

  describe('forUserData', () => {
    it('should add user filter', () => {
      OptimizedQueryBuilder.forUserData(mockQueryBuilder, 'user-123');

      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'entity.userId = :userId',
        { userId: 'user-123' }
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'entity.status != :deletedStatus',
        { deletedStatus: 'deleted' }
      );
    });

    it('should include deleted records when specified', () => {
      OptimizedQueryBuilder.forUserData(
        mockQueryBuilder, 
        'user-123', 
        { includeDeleted: true }
      );

      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'entity.userId = :userId',
        { userId: 'user-123' }
      );
      expect(mockQueryBuilder.andWhere).not.toHaveBeenCalledWith(
        'entity.status != :deletedStatus',
        { deletedStatus: 'deleted' }
      );
    });
  });

  describe('withDateRange', () => {
    it('should add date range filter', () => {
      const startDate = new Date('2023-01-01');
      const endDate = new Date('2023-12-31');

      OptimizedQueryBuilder.withDateRange(
        mockQueryBuilder,
        'createdAt',
        startDate,
        endDate
      );

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'entity.createdAt >= :startDate',
        { startDate }
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'entity.createdAt <= :endDate',
        { endDate }
      );
    });
  });

  describe('withPagination', () => {
    it('should add pagination with default values', () => {
      OptimizedQueryBuilder.withPagination(mockQueryBuilder);

      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(20);
    });

    it('should add pagination with custom values', () => {
      OptimizedQueryBuilder.withPagination(mockQueryBuilder, 3, 50);

      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(100); // (3-1) * 50
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(50);
    });
  });

  describe('withSearch', () => {
    it('should add search conditions', () => {
      OptimizedQueryBuilder.withSearch(
        mockQueryBuilder,
        ['name', 'email'],
        'john'
      );

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        '(entity.name ILIKE :searchTerm0 OR entity.email ILIKE :searchTerm1)',
        {
          searchTerm0: '%john%',
          searchTerm1: '%john%'
        }
      );
    });

    it('should skip empty search terms', () => {
      OptimizedQueryBuilder.withSearch(
        mockQueryBuilder,
        ['name', 'email'],
        '   '
      );

      expect(mockQueryBuilder.andWhere).not.toHaveBeenCalled();
    });
  });

  describe('withOptimalJoins', () => {
    it('should add left joins for relations', () => {
      OptimizedQueryBuilder.withOptimalJoins(
        mockQueryBuilder,
        ['subject', 'section']
      );

      expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
        'entity.subject',
        'subject'
      );
      expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
        'entity.section',
        'section'
      );
    });
  });
});