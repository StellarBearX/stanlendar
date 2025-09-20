import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bull';
import { JobMonitorService } from '../job-monitor.service';
import { Queue } from 'bull';

describe('JobMonitorService', () => {
  let service: JobMonitorService;
  let mockQueue: jest.Mocked<Queue>;

  beforeEach(async () => {
    mockQueue = {
      getWaiting: jest.fn(),
      getActive: jest.fn(),
      getCompleted: jest.fn(),
      getFailed: jest.fn(),
      getDelayed: jest.fn(),
      getPaused: jest.fn(),
      isPaused: jest.fn(),
      clean: jest.fn(),
      on: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobMonitorService,
        {
          provide: getQueueToken('sync'),
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<JobMonitorService>(JobMonitorService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('onModuleInit', () => {
    it('should set up queue event listeners', async () => {
      // Mock the queue stats methods for the initial health check
      mockQueue.getWaiting.mockResolvedValue([1, 2] as any);
      mockQueue.getActive.mockResolvedValue([1] as any);
      mockQueue.getCompleted.mockResolvedValue([1, 2, 3] as any);
      mockQueue.getFailed.mockResolvedValue([1, 2] as any);
      mockQueue.getDelayed.mockResolvedValue([1] as any);
      mockQueue.getPaused.mockResolvedValue([] as any);
      mockQueue.isPaused.mockResolvedValue(false);

      await service.onModuleInit();

      expect(mockQueue.on).toHaveBeenCalledWith('completed', expect.any(Function));
      expect(mockQueue.on).toHaveBeenCalledWith('failed', expect.any(Function));
      expect(mockQueue.on).toHaveBeenCalledWith('stalled', expect.any(Function));
      expect(mockQueue.on).toHaveBeenCalledWith('progress', expect.any(Function));
      expect(mockQueue.on).toHaveBeenCalledWith('paused', expect.any(Function));
      expect(mockQueue.on).toHaveBeenCalledWith('resumed', expect.any(Function));
      expect(mockQueue.on).toHaveBeenCalledWith('error', expect.any(Function));
    });
  });

  describe('checkQueueHealth', () => {
    beforeEach(() => {
      mockQueue.getWaiting.mockResolvedValue([1, 2] as any);
      mockQueue.getActive.mockResolvedValue([1] as any);
      mockQueue.getCompleted.mockResolvedValue([1, 2, 3] as any);
      mockQueue.getFailed.mockResolvedValue([1, 2] as any);
      mockQueue.getDelayed.mockResolvedValue([1] as any);
      mockQueue.getPaused.mockResolvedValue([] as any);
      mockQueue.isPaused.mockResolvedValue(false);
    });

    it('should return healthy status when all metrics are normal', async () => {
      const health = await service.checkQueueHealth();

      expect(health).toEqual({
        name: 'sync',
        isHealthy: true,
        stats: {
          waiting: 2,
          active: 1,
          completed: 3,
          failed: 2,
          delayed: 1,
          paused: 0,
        },
        issues: [],
        lastChecked: expect.any(Date),
      });
    });

    it('should detect too many active jobs', async () => {
      mockQueue.getActive.mockResolvedValue(new Array(15) as any); // More than maxActiveJobs (10)

      const health = await service.checkQueueHealth();

      expect(health.isHealthy).toBe(false);
      expect(health.issues).toContain('Too many active jobs: 15 (max: 10)');
    });

    it('should detect too many waiting jobs', async () => {
      mockQueue.getWaiting.mockResolvedValue(new Array(150) as any); // More than maxWaitingJobs (100)

      const health = await service.checkQueueHealth();

      expect(health.isHealthy).toBe(false);
      expect(health.issues).toContain('Too many waiting jobs: 150 (max: 100)');
    });

    it('should detect too many failed jobs', async () => {
      mockQueue.getFailed.mockResolvedValue(new Array(75) as any); // More than maxFailedJobs (50)

      const health = await service.checkQueueHealth();

      expect(health.isHealthy).toBe(false);
      expect(health.issues).toContain('Too many failed jobs: 75 (max: 50)');
    });

    it('should detect paused queue', async () => {
      mockQueue.isPaused.mockResolvedValue(true);

      const health = await service.checkQueueHealth();

      expect(health.isHealthy).toBe(false);
      expect(health.issues).toContain('Queue is paused');
    });

    it('should detect multiple issues', async () => {
      mockQueue.getActive.mockResolvedValue(new Array(15) as any);
      mockQueue.getWaiting.mockResolvedValue(new Array(150) as any);
      mockQueue.isPaused.mockResolvedValue(true);

      const health = await service.checkQueueHealth();

      expect(health.isHealthy).toBe(false);
      expect(health.issues).toHaveLength(3);
      expect(health.issues).toContain('Too many active jobs: 15 (max: 10)');
      expect(health.issues).toContain('Too many waiting jobs: 150 (max: 100)');
      expect(health.issues).toContain('Queue is paused');
    });
  });

  describe('getJobMetrics', () => {
    it('should calculate metrics for completed and failed jobs', async () => {
      const now = Date.now();
      const oneHourAgo = now - 60 * 60 * 1000;

      const completedJobs = [
        {
          finishedOn: now - 30 * 60 * 1000, // 30 minutes ago
          processedOn: now - 35 * 60 * 1000, // 35 minutes ago (5 min processing)
        },
        {
          finishedOn: now - 10 * 60 * 1000, // 10 minutes ago
          processedOn: now - 13 * 60 * 1000, // 13 minutes ago (3 min processing)
        },
      ];

      const failedJobs = [
        {
          finishedOn: now - 20 * 60 * 1000, // 20 minutes ago
          failedReason: 'Network error',
        },
        {
          finishedOn: now - 5 * 60 * 1000, // 5 minutes ago
          failedReason: 'Validation error',
        },
        {
          finishedOn: now - 5 * 60 * 1000, // 5 minutes ago
          failedReason: 'Network error', // Duplicate reason
        },
      ];

      mockQueue.getCompleted.mockResolvedValue(completedJobs as any);
      mockQueue.getFailed.mockResolvedValue(failedJobs as any);

      const metrics = await service.getJobMetrics(1); // 1 hour

      expect(metrics.totalJobs).toBe(5);
      expect(metrics.successRate).toBe(40); // 2 out of 5 succeeded
      expect(metrics.averageProcessingTime).toBe(4 * 60 * 1000); // Average of 5min and 3min
      expect(metrics.failureReasons).toEqual({
        'Network error': 2,
        'Validation error': 1,
      });
      expect(metrics.hourlyThroughput).toBe(5); // 5 jobs in 1 hour
    });

    it('should handle empty job lists', async () => {
      mockQueue.getCompleted.mockResolvedValue([]);
      mockQueue.getFailed.mockResolvedValue([]);

      const metrics = await service.getJobMetrics();

      expect(metrics.totalJobs).toBe(0);
      expect(metrics.successRate).toBe(0);
      expect(metrics.averageProcessingTime).toBe(0);
      expect(metrics.failureReasons).toEqual({});
      expect(metrics.hourlyThroughput).toBe(0);
    });

    it('should filter jobs by time range', async () => {
      const now = Date.now();
      const twoHoursAgo = now - 2 * 60 * 60 * 1000;
      const oneHourAgo = now - 60 * 60 * 1000;

      const completedJobs = [
        { finishedOn: twoHoursAgo }, // Outside range
        { finishedOn: oneHourAgo }, // Inside range
        { finishedOn: now }, // Inside range
      ];

      mockQueue.getCompleted.mockResolvedValue(completedJobs as any);
      mockQueue.getFailed.mockResolvedValue([]);

      const metrics = await service.getJobMetrics(1); // 1 hour

      expect(metrics.totalJobs).toBe(1); // Only jobs within 1 hour (the oneHourAgo job is exactly at the boundary)
    });
  });

  describe('getStuckJobs', () => {
    it('should identify stuck jobs', async () => {
      const now = Date.now();
      const activeJobs = [
        {
          processedOn: now - 10 * 60 * 1000, // 10 minutes ago (not stuck)
        },
        {
          processedOn: now - 45 * 60 * 1000, // 45 minutes ago (stuck)
        },
        {
          processedOn: now - 60 * 60 * 1000, // 1 hour ago (stuck)
        },
      ];

      mockQueue.getActive.mockResolvedValue(activeJobs as any);

      const stuckJobs = await service.getStuckJobs(30 * 60 * 1000); // 30 minutes

      expect(stuckJobs).toHaveLength(2);
      expect(stuckJobs).toEqual([activeJobs[1], activeJobs[2]]);
    });

    it('should return empty array when no stuck jobs', async () => {
      const now = Date.now();
      const activeJobs = [
        { processedOn: now - 5 * 60 * 1000 }, // 5 minutes ago
        { processedOn: now - 10 * 60 * 1000 }, // 10 minutes ago
      ];

      mockQueue.getActive.mockResolvedValue(activeJobs as any);

      const stuckJobs = await service.getStuckJobs(30 * 60 * 1000); // 30 minutes

      expect(stuckJobs).toHaveLength(0);
    });
  });

  describe('cleanupStuckJobs', () => {
    it('should move stuck jobs to failed', async () => {
      const stuckJobs = [
        {
          id: 'job-1',
          moveToFailed: jest.fn().mockResolvedValue(undefined),
        },
        {
          id: 'job-2',
          moveToFailed: jest.fn().mockResolvedValue(undefined),
        },
      ];

      // Mock getStuckJobs
      jest.spyOn(service, 'getStuckJobs').mockResolvedValue(stuckJobs as any);

      const count = await service.cleanupStuckJobs();

      expect(count).toBe(2);
      expect(stuckJobs[0].moveToFailed).toHaveBeenCalledWith(
        new Error('Job stuck - forced cleanup'),
        true,
      );
      expect(stuckJobs[1].moveToFailed).toHaveBeenCalledWith(
        new Error('Job stuck - forced cleanup'),
        true,
      );
    });

    it('should handle errors during cleanup', async () => {
      const stuckJobs = [
        {
          id: 'job-1',
          moveToFailed: jest.fn().mockRejectedValue(new Error('Cleanup failed')),
        },
      ];

      jest.spyOn(service, 'getStuckJobs').mockResolvedValue(stuckJobs as any);

      const count = await service.cleanupStuckJobs();

      expect(count).toBe(1); // Still counts the job even if cleanup failed
    });
  });

  describe('getQueueInsights', () => {
    it('should return comprehensive queue insights', async () => {
      // Mock all dependencies
      mockQueue.getWaiting.mockResolvedValue([1, 2] as any);
      mockQueue.getActive.mockResolvedValue([1] as any);
      mockQueue.getCompleted.mockResolvedValue([1, 2, 3] as any);
      mockQueue.getFailed.mockResolvedValue([1, 2] as any);
      mockQueue.getDelayed.mockResolvedValue([1] as any);
      mockQueue.getPaused.mockResolvedValue([] as any);
      mockQueue.isPaused.mockResolvedValue(false);

      jest.spyOn(service, 'getStuckJobs').mockResolvedValue([]);

      const insights = await service.getQueueInsights();

      expect(insights).toEqual({
        health: expect.objectContaining({
          name: 'sync',
          isHealthy: true,
        }),
        metrics: expect.objectContaining({
          totalJobs: expect.any(Number),
          successRate: expect.any(Number),
        }),
        stuckJobsCount: 0,
        queueName: 'sync',
        timestamp: expect.any(Date),
      });
    });
  });

  describe('scheduled methods', () => {
    it('should have scheduled health check method', () => {
      expect(service.scheduledHealthCheck).toBeDefined();
    });

    it('should have scheduled cleanup method', () => {
      expect(service.scheduledCleanup).toBeDefined();
    });

    it('should handle errors in scheduled health check', async () => {
      jest.spyOn(service, 'checkQueueHealth').mockRejectedValue(new Error('Health check failed'));

      // Should not throw
      await expect(service.scheduledHealthCheck()).resolves.toBeUndefined();
    });

    it('should handle errors in scheduled cleanup', async () => {
      mockQueue.clean.mockRejectedValue(new Error('Cleanup failed'));

      // Should not throw
      await expect(service.scheduledCleanup()).resolves.toBeUndefined();
    });
  });
});