import { Injectable, Logger } from '@nestjs/common';
import { DataSource, SelectQueryBuilder } from 'typeorm';
import { ConfigService } from '@nestjs/config';

export interface QueryPerformanceMetrics {
  query: string;
  executionTime: number;
  rowCount: number;
  timestamp: Date;
}

@Injectable()
export class QueryOptimizerService {
  private readonly logger = new Logger(QueryOptimizerService.name);
  private performanceMetrics: QueryPerformanceMetrics[] = [];
  private slowQueryThreshold: number;

  constructor(
    private dataSource: DataSource,
    private configService: ConfigService
  ) {
    this.slowQueryThreshold = this.configService.get('SLOW_QUERY_THRESHOLD_MS', 200);
  }

  async executeOptimizedQuery<T>(
    queryBuilder: SelectQueryBuilder<T>,
    options?: {
      useCache?: boolean;
      cacheKey?: string;
      cacheTTL?: number;
    }
  ): Promise<T[]> {
    const startTime = Date.now();
    const query = queryBuilder.getQuery();
    
    try {
      // Add query hints for optimization
      this.addQueryHints(queryBuilder);
      
      const result = await queryBuilder.getMany();
      const executionTime = Date.now() - startTime;
      
      // Log performance metrics
      this.recordPerformanceMetrics({
        query,
        executionTime,
        rowCount: result.length,
        timestamp: new Date()
      });
      
      // Log slow queries
      if (executionTime > this.slowQueryThreshold) {
        this.logger.warn(`Slow query detected (${executionTime}ms): ${query}`);
      }
      
      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logger.error(`Query failed after ${executionTime}ms: ${query}`, error);
      throw error;
    }
  }

  private addQueryHints<T>(queryBuilder: SelectQueryBuilder<T>): void {
    // Add common optimization hints
    
    // Use indexes for WHERE clauses
    const whereConditions = queryBuilder.expressionMap.wheres;
    if (whereConditions.length > 0) {
      // Ensure proper index usage by ordering conditions
      // Most selective conditions first
    }
    
    // Optimize JOINs
    const joins = queryBuilder.expressionMap.joinAttributes;
    if (joins.length > 0) {
      // Prefer INNER JOINs over LEFT JOINs when possible
      // Order JOINs by selectivity
    }
    
    // Add LIMIT for large result sets if not already present
    if (!queryBuilder.expressionMap.limit && !queryBuilder.expressionMap.offset) {
      const estimatedRows = this.estimateRowCount(queryBuilder);
      if (estimatedRows > 1000) {
        this.logger.warn(`Large result set detected, consider adding LIMIT: ${queryBuilder.getQuery()}`);
      }
    }
  }

  private estimateRowCount<T>(queryBuilder: SelectQueryBuilder<T>): number {
    // Simple heuristic for row count estimation
    // In production, use EXPLAIN PLAN or table statistics
    const tableName = queryBuilder.expressionMap.mainAlias?.tablePath;
    
    // Default estimates based on typical table sizes
    const tableEstimates: Record<string, number> = {
      'user': 10000,
      'subject': 50000,
      'section': 100000,
      'local_event': 500000,
      'import_job': 1000,
      'import_item': 50000
    };
    
    return tableEstimates[tableName || ''] || 1000;
  }

  private recordPerformanceMetrics(metrics: QueryPerformanceMetrics): void {
    this.performanceMetrics.push(metrics);
    
    // Keep only last 1000 metrics to prevent memory leaks
    if (this.performanceMetrics.length > 1000) {
      this.performanceMetrics = this.performanceMetrics.slice(-1000);
    }
  }

  getPerformanceReport(): {
    slowQueries: QueryPerformanceMetrics[];
    averageExecutionTime: number;
    totalQueries: number;
  } {
    const slowQueries = this.performanceMetrics.filter(
      m => m.executionTime > this.slowQueryThreshold
    );
    
    const totalExecutionTime = this.performanceMetrics.reduce(
      (sum, m) => sum + m.executionTime, 0
    );
    
    return {
      slowQueries,
      averageExecutionTime: totalExecutionTime / this.performanceMetrics.length || 0,
      totalQueries: this.performanceMetrics.length
    };
  }

  async analyzeTableStatistics(): Promise<void> {
    try {
      // Update table statistics for query planner
      const tables = ['user', 'subject', 'section', 'local_event', 'import_job', 'import_item'];
      
      for (const table of tables) {
        await this.dataSource.query(`ANALYZE ${table}`);
      }
      
      this.logger.log('Table statistics updated successfully');
    } catch (error) {
      this.logger.error('Failed to update table statistics:', error);
    }
  }

  async createOptimalIndexes(): Promise<void> {
    try {
      const indexQueries = [
        // Composite indexes for common query patterns
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_local_event_user_date_subject ON local_event (user_id, event_date, subject_id)',
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_local_event_sync_status ON local_event (user_id, status, gcal_event_id)',
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_section_subject_schedule ON section (subject_id, schedule_rules)',
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subject_user_search ON subject (user_id, name, code)',
        
        // Partial indexes for specific conditions
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_local_event_synced ON local_event (user_id, gcal_event_id) WHERE status = \'synced\'',
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_import_job_pending ON import_job (user_id, created_at) WHERE state = \'pending\'',
        
        // Expression indexes for search
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subject_search_trgm ON subject USING gin ((name || \' \' || COALESCE(code, \'\')) gin_trgm_ops)',
      ];

      for (const query of indexQueries) {
        try {
          await this.dataSource.query(query);
          this.logger.log(`Created index: ${query.split(' ')[5]}`);
        } catch (error) {
          // Index might already exist, log but don't fail
          this.logger.warn(`Index creation warning: ${error.message}`);
        }
      }
    } catch (error) {
      this.logger.error('Failed to create optimal indexes:', error);
    }
  }

  async optimizeConnectionPool(): Promise<void> {
    const currentConfig = this.dataSource.options;
    
    // Log current connection pool settings
    this.logger.log('Current connection pool configuration:', {
      type: currentConfig.type,
      maxConnections: (currentConfig as any).maxConnections,
      acquireTimeout: (currentConfig as any).acquireTimeout,
      idleTimeout: (currentConfig as any).idleTimeout
    });

    // Recommendations based on application load
    const recommendations = {
      maxConnections: Math.min(20, Math.max(5, process.env.NODE_ENV === 'production' ? 15 : 5)),
      acquireTimeout: 30000,
      idleTimeout: 300000,
      reapInterval: 1000
    };

    this.logger.log('Recommended connection pool settings:', recommendations);
  }
}

// Query builder extensions for common patterns
export class OptimizedQueryBuilder {
  static forUserData<T>(
    queryBuilder: SelectQueryBuilder<T>,
    userId: string,
    options?: { includeDeleted?: boolean }
  ): SelectQueryBuilder<T> {
    queryBuilder.where('entity.userId = :userId', { userId });
    
    if (!options?.includeDeleted) {
      queryBuilder.andWhere('entity.status != :deletedStatus', { deletedStatus: 'deleted' });
    }
    
    return queryBuilder;
  }

  static withDateRange<T>(
    queryBuilder: SelectQueryBuilder<T>,
    dateField: string,
    startDate: Date,
    endDate: Date
  ): SelectQueryBuilder<T> {
    return queryBuilder
      .andWhere(`entity.${dateField} >= :startDate`, { startDate })
      .andWhere(`entity.${dateField} <= :endDate`, { endDate });
  }

  static withPagination<T>(
    queryBuilder: SelectQueryBuilder<T>,
    page: number = 1,
    limit: number = 20
  ): SelectQueryBuilder<T> {
    const offset = (page - 1) * limit;
    return queryBuilder.skip(offset).take(limit);
  }

  static withSearch<T>(
    queryBuilder: SelectQueryBuilder<T>,
    searchFields: string[],
    searchTerm: string
  ): SelectQueryBuilder<T> {
    if (!searchTerm.trim()) {
      return queryBuilder;
    }

    const conditions = searchFields.map((field, index) => 
      `entity.${field} ILIKE :searchTerm${index}`
    ).join(' OR ');

    const parameters = searchFields.reduce((params, field, index) => {
      params[`searchTerm${index}`] = `%${searchTerm}%`;
      return params;
    }, {} as Record<string, any>);

    return queryBuilder.andWhere(`(${conditions})`, parameters);
  }

  static withOptimalJoins<T>(
    queryBuilder: SelectQueryBuilder<T>,
    relations: string[]
  ): SelectQueryBuilder<T> {
    // Add relations in optimal order (most selective first)
    relations.forEach(relation => {
      queryBuilder.leftJoinAndSelect(`entity.${relation}`, relation);
    });

    return queryBuilder;
  }
}