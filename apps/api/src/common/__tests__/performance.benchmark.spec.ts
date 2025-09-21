import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../app.module';
import { CacheService } from '../services/cache.service';
import { QueryOptimizerService } from '../../infra/database/query-optimizer.service';

describe('Performance Benchmarks', () => {
  let app: INestApplication;
  let cacheService: CacheService;
  let queryOptimizer: QueryOptimizerService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    cacheService = app.get<CacheService>(CacheService);
    queryOptimizer = app.get<QueryOptimizerService>(QueryOptimizerService);
    
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('API Response Times', () => {
    const performanceThresholds = {
      fast: 100,    // < 100ms
      medium: 500,  // < 500ms
      slow: 1000    // < 1000ms
    };

    it('should respond to health check quickly', async () => {
      const start = Date.now();
      
      const response = await request(app.getHttpServer())
        .get('/api/health')
        .expect(200);
      
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(performanceThresholds.fast);
    });

    it('should handle concurrent requests efficiently', async () => {
      const concurrentRequests = 10;
      const start = Date.now();
      
      const promises = Array.from({ length: concurrentRequests }, () =>
        request(app.getHttpServer()).get('/api/health')
      );
      
      const responses = await Promise.all(promises);
      const duration = Date.now() - start;
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
      
      // Average response time should be reasonable
      const averageTime = duration / concurrentRequests;
      expect(averageTime).toBeLessThan(performanceThresholds.medium);
    });

    it('should handle large payload efficiently', async () => {
      const largePayload = {
        subjects: Array.from({ length: 100 }, (_, i) => ({
          name: `Subject ${i}`,
          code: `SUB${i.toString().padStart(3, '0')}`,
          colorHex: '#FF0000'
        }))
      };
      
      const start = Date.now();
      
      const response = await request(app.getHttpServer())
        .post('/api/subjects/batch')
        .send(largePayload);
      
      const duration = Date.now() - start;
      
      // Should handle large payloads within reasonable time
      expect(duration).toBeLessThan(performanceThresholds.slow);
    });
  });

  describe('Cache Performance', () => {
    it('should cache and retrieve data quickly', async () => {
      const testData = { id: 1, name: 'test', data: 'x'.repeat(1000) };
      
      // Set operation
      const setStart = Date.now();
      await cacheService.set('perf-test', testData);
      const setDuration = Date.now() - setStart;
      
      // Get operation
      const getStart = Date.now();
      const retrieved = await cacheService.get('perf-test');
      const getDuration = Date.now() - getStart;
      
      expect(retrieved).toEqual(testData);
      expect(setDuration).toBeLessThan(50); // Cache set should be very fast
      expect(getDuration).toBeLessThan(10); // Cache get should be extremely fast
    });

    it('should handle batch operations efficiently', async () => {
      const batchSize = 100;
      const keyValuePairs: Array<[string, any]> = Array.from(
        { length: batchSize },
        (_, i) => [`batch-key-${i}`, { id: i, data: `data-${i}` }]
      );
      
      // Batch set
      const setStart = Date.now();
      await cacheService.mset(keyValuePairs);
      const setDuration = Date.now() - setStart;
      
      // Batch get
      const keys = keyValuePairs.map(([key]) => key);
      const getStart = Date.now();
      const results = await cacheService.mget(keys);
      const getDuration = Date.now() - getStart;
      
      expect(results).toHaveLength(batchSize);
      expect(setDuration).toBeLessThan(200); // Batch operations should be efficient
      expect(getDuration).toBeLessThan(100);
    });

    it('should handle cache invalidation patterns efficiently', async () => {
      // Set up test data
      const keys = Array.from({ length: 50 }, (_, i) => `user:123:data:${i}`);
      for (const key of keys) {
        await cacheService.set(key, { data: key });
      }
      
      // Invalidate pattern
      const start = Date.now();
      await cacheService.invalidatePattern('user:123:*');
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(100);
      
      // Verify invalidation
      const results = await cacheService.mget(keys);
      expect(results.every(result => result === null)).toBe(true);
    });
  });

  describe('Database Query Performance', () => {
    it('should generate performance report', () => {
      const report = queryOptimizer.getPerformanceReport();
      
      expect(report).toHaveProperty('slowQueries');
      expect(report).toHaveProperty('averageExecutionTime');
      expect(report).toHaveProperty('totalQueries');
      expect(Array.isArray(report.slowQueries)).toBe(true);
      expect(typeof report.averageExecutionTime).toBe('number');
      expect(typeof report.totalQueries).toBe('number');
    });

    it('should handle table statistics update', async () => {
      const start = Date.now();
      await queryOptimizer.analyzeTableStatistics();
      const duration = Date.now() - start;
      
      // Statistics update should complete within reasonable time
      expect(duration).toBeLessThan(5000); // 5 seconds max
    });
  });

  describe('Memory Usage', () => {
    it('should not have memory leaks in cache operations', async () => {
      const initialMemory = process.memoryUsage();
      
      // Perform many cache operations
      for (let i = 0; i < 1000; i++) {
        await cacheService.set(`leak-test-${i}`, { data: 'x'.repeat(100) });
        await cacheService.get(`leak-test-${i}`);
        await cacheService.del(`leak-test-${i}`);
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory increase should be minimal (less than 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });

    it('should handle large data sets without excessive memory usage', async () => {
      const initialMemory = process.memoryUsage();
      
      // Create large dataset
      const largeData = Array.from({ length: 10000 }, (_, i) => ({
        id: i,
        name: `Item ${i}`,
        description: 'x'.repeat(100)
      }));
      
      await cacheService.set('large-dataset', largeData, { compress: true });
      const retrieved = await cacheService.get('large-dataset', { compress: true });
      
      expect(retrieved).toHaveLength(10000);
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
      
      // Clean up
      await cacheService.del('large-dataset');
    });
  });

  describe('Stress Testing', () => {
    it('should handle high request volume', async () => {
      const requestCount = 100;
      const concurrency = 10;
      const batches = requestCount / concurrency;
      
      const results: number[] = [];
      
      for (let batch = 0; batch < batches; batch++) {
        const batchStart = Date.now();
        
        const promises = Array.from({ length: concurrency }, () =>
          request(app.getHttpServer()).get('/api/health')
        );
        
        const responses = await Promise.all(promises);
        const batchDuration = Date.now() - batchStart;
        
        // All requests should succeed
        responses.forEach(response => {
          expect(response.status).toBe(200);
        });
        
        results.push(batchDuration);
      }
      
      // Calculate statistics
      const avgBatchTime = results.reduce((sum, time) => sum + time, 0) / results.length;
      const maxBatchTime = Math.max(...results);
      
      expect(avgBatchTime).toBeLessThan(1000); // Average batch should be under 1s
      expect(maxBatchTime).toBeLessThan(2000);  // Max batch should be under 2s
    });

    it('should maintain performance under sustained load', async () => {
      const duration = 10000; // 10 seconds
      const interval = 100;   // Request every 100ms
      const start = Date.now();
      const results: number[] = [];
      
      while (Date.now() - start < duration) {
        const requestStart = Date.now();
        
        const response = await request(app.getHttpServer())
          .get('/api/health');
        
        const requestDuration = Date.now() - requestStart;
        results.push(requestDuration);
        
        expect(response.status).toBe(200);
        
        // Wait for next interval
        const elapsed = Date.now() - requestStart;
        if (elapsed < interval) {
          await new Promise(resolve => setTimeout(resolve, interval - elapsed));
        }
      }
      
      // Performance should not degrade significantly over time
      const firstHalf = results.slice(0, Math.floor(results.length / 2));
      const secondHalf = results.slice(Math.floor(results.length / 2));
      
      const firstHalfAvg = firstHalf.reduce((sum, time) => sum + time, 0) / firstHalf.length;
      const secondHalfAvg = secondHalf.reduce((sum, time) => sum + time, 0) / secondHalf.length;
      
      // Second half should not be significantly slower than first half
      expect(secondHalfAvg).toBeLessThan(firstHalfAvg * 2);
    });
  });

  describe('Resource Cleanup', () => {
    it('should clean up resources properly', async () => {
      // Create some resources
      await cacheService.set('cleanup-test-1', { data: 'test' });
      await cacheService.set('cleanup-test-2', { data: 'test' });
      
      // Verify resources exist
      expect(await cacheService.exists('cleanup-test-1')).toBe(true);
      expect(await cacheService.exists('cleanup-test-2')).toBe(true);
      
      // Clean up
      await cacheService.invalidatePattern('cleanup-test-*');
      
      // Verify cleanup
      expect(await cacheService.exists('cleanup-test-1')).toBe(false);
      expect(await cacheService.exists('cleanup-test-2')).toBe(false);
    });
  });
});