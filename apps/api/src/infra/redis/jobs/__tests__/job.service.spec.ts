import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bull';
import { JobService } from '../job.service';
import { SyncJobData } from '../sync-job.processor';
import { Queue, Job } from 'bull';

describe('JobService', () => {
  let service: JobService;
  let mockQueue: jest.Mocked<Queue>;

  beforeEach(async () => {
    mockQueue = {
      add: jest.fn(),
      getJob: jest.fn(),
      getJobs: jest.fn(),
      getWaiting: jest.fn(),
      getActive: jest.fn(),
      getCompleted: jest.fn(),
      getFailed: jest.fn(),
      getDelayed: jest.fn(),
      getPaused: jest.fn(),
      clean: jest.fn(),
      pause: jest.fn(),
      resume: jest.fn(),
      isPaused: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobService,
        {
          provide: getQueueToken('sync'),
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<JobService>(JobService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createSyncJob', () => {
    it('should create a sync job with default options', async () => {
      const jobData: SyncJobData = {
        userId: 'user-123',
        direction: 'upsert-to-google',
        range: { from: '2024-01-01', to: '2024-01-31' },
        idempotencyKey: 'test-key-123',
      };

      const mockJob = { id: 'job-123' } as Job<SyncJobData>;
      mockQueue.add.mockResolvedValue(mockJob);

      const result = await service.createSyncJob(jobData);

      expect(mockQueue.add).toHaveBeenCalledWith('calendar-sync', jobData, {
        priority: 0,
        delay: 0,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 10,
        removeOnFail: 50,
      });
      expect(result).toBe(mockJob);
    });

    it('should create a sync job with custom options', async () => {
      const jobData: SyncJobData = {
        userId: 'user-123',
        direction: 'upsert-to-google',
        range: { from: '2024-01-01', to: '2024-01-31' },
        idempotencyKey: 'test-key-123',
      };

      const options = {
        priority: 5,
        delay: 1000,
        attempts: 5,
        backoff: { type: 'fixed' as const, delay: 1000 },
        removeOnComplete: 20,
        removeOnFail: 100,
      };

      const mockJob = { id: 'job-123' } as Job<SyncJobData>;
      mockQueue.add.mockResolvedValue(mockJob);

      await service.createSyncJob(jobData, options);

      expect(mockQueue.add).toHaveBeenCalledWith('calendar-sync', jobData, {
        priority: 5,
        delay: 1000,
        attempts: 5,
        backoff: { type: 'fixed', delay: 1000 },
        removeOnComplete: 20,
        removeOnFail: 100,
      });
    });
  });

  describe('getJobStatus', () => {
    it('should return job status for existing job', async () => {
      const mockJob = {
        id: 'job-123',
        name: 'calendar-sync',
        data: { userId: 'user-123' },
        progress: jest.fn().mockReturnValue(50),
        getState: jest.fn().mockResolvedValue('active'),
        timestamp: 1640995200000, // 2022-01-01
        processedOn: 1640995260000, // 2022-01-01 + 1min
        finishedOn: undefined,
        failedReason: undefined,
        returnvalue: undefined,
        attemptsMade: 1,
        opts: { attempts: 3 },
      } as any;

      mockQueue.getJob.mockResolvedValue(mockJob);

      const result = await service.getJobStatus('job-123');

      expect(result).toEqual({
        id: 'job-123',
        name: 'calendar-sync',
        data: { userId: 'user-123' },
        progress: 50,
        state: 'active',
        createdAt: new Date(1640995200000),
        processedAt: new Date(1640995260000),
        finishedAt: undefined,
        failedReason: undefined,
        result: undefined,
        attempts: 1,
        maxAttempts: 3,
      });
    });

    it('should return null for non-existent job', async () => {
      mockQueue.getJob.mockResolvedValue(null);

      const result = await service.getJobStatus('non-existent');

      expect(result).toBeNull();
    });

    it('should handle completed job', async () => {
      const mockJob = {
        id: 'job-123',
        name: 'calendar-sync',
        data: { userId: 'user-123' },
        progress: jest.fn().mockReturnValue(100),
        getState: jest.fn().mockResolvedValue('completed'),
        timestamp: 1640995200000,
        processedOn: 1640995260000,
        finishedOn: 1640995320000, // 2022-01-01 + 2min
        failedReason: undefined,
        returnvalue: { summary: { created: 5 } },
        attemptsMade: 1,
        opts: { attempts: 3 },
      } as any;

      mockQueue.getJob.mockResolvedValue(mockJob);

      const result = await service.getJobStatus('job-123');

      expect(result?.state).toBe('completed');
      expect(result?.finishedAt).toEqual(new Date(1640995320000));
      expect(result?.result).toEqual({ summary: { created: 5 } });
    });
  });

  describe('getUserJobs', () => {
    it('should return jobs for specific user', async () => {
      const mockJobs = [
        {
          id: 'job-1',
          name: 'calendar-sync',
          data: { userId: 'user-123' },
          progress: jest.fn().mockReturnValue(100),
          getState: jest.fn().mockResolvedValue('completed'),
          timestamp: 1640995200000,
          processedOn: 1640995260000,
          finishedOn: 1640995320000,
          failedReason: undefined,
          returnvalue: { summary: { created: 5 } },
          attemptsMade: 1,
          opts: { attempts: 3 },
        },
        {
          id: 'job-2',
          name: 'calendar-sync',
          data: { userId: 'user-456' }, // Different user
          progress: jest.fn().mockReturnValue(50),
          getState: jest.fn().mockResolvedValue('active'),
          timestamp: 1640995300000,
          processedOn: 1640995360000,
          finishedOn: undefined,
          failedReason: undefined,
          returnvalue: undefined,
          attemptsMade: 1,
          opts: { attempts: 3 },
        },
        {
          id: 'job-3',
          name: 'calendar-sync',
          data: { userId: 'user-123' }, // Same user as job-1
          progress: jest.fn().mockReturnValue(0),
          getState: jest.fn().mockResolvedValue('waiting'),
          timestamp: 1640995400000,
          processedOn: undefined,
          finishedOn: undefined,
          failedReason: undefined,
          returnvalue: undefined,
          attemptsMade: 0,
          opts: { attempts: 3 },
        },
      ] as any;

      mockQueue.getJobs.mockResolvedValue(mockJobs);

      const result = await service.getUserJobs('user-123');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('job-1');
      expect(result[1].id).toBe('job-3');
    });

    it('should respect limit parameter', async () => {
      mockQueue.getJobs.mockResolvedValue([]);

      await service.getUserJobs('user-123', 25);

      expect(mockQueue.getJobs).toHaveBeenCalledWith(
        ['waiting', 'active', 'completed', 'failed'],
        0,
        24, // limit - 1
      );
    });
  });

  describe('cancelJob', () => {
    it('should cancel waiting job', async () => {
      const mockJob = {
        getState: jest.fn().mockResolvedValue('waiting'),
        remove: jest.fn().mockResolvedValue(undefined),
      } as any;

      mockQueue.getJob.mockResolvedValue(mockJob);

      const result = await service.cancelJob('job-123');

      expect(result).toBe(true);
      expect(mockJob.remove).toHaveBeenCalled();
    });

    it('should not cancel active job', async () => {
      const mockJob = {
        getState: jest.fn().mockResolvedValue('active'),
        remove: jest.fn(),
      } as any;

      mockQueue.getJob.mockResolvedValue(mockJob);

      const result = await service.cancelJob('job-123');

      expect(result).toBe(false);
      expect(mockJob.remove).not.toHaveBeenCalled();
    });

    it('should not cancel completed job', async () => {
      const mockJob = {
        getState: jest.fn().mockResolvedValue('completed'),
        remove: jest.fn(),
      } as any;

      mockQueue.getJob.mockResolvedValue(mockJob);

      const result = await service.cancelJob('job-123');

      expect(result).toBe(false);
      expect(mockJob.remove).not.toHaveBeenCalled();
    });

    it('should return false for non-existent job', async () => {
      mockQueue.getJob.mockResolvedValue(null);

      const result = await service.cancelJob('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('retryJob', () => {
    it('should retry failed job', async () => {
      const mockJob = {
        getState: jest.fn().mockResolvedValue('failed'),
        retry: jest.fn().mockResolvedValue(undefined),
      } as any;

      mockQueue.getJob.mockResolvedValue(mockJob);

      const result = await service.retryJob('job-123');

      expect(result).toBe(mockJob);
      expect(mockJob.retry).toHaveBeenCalled();
    });

    it('should not retry non-failed job', async () => {
      const mockJob = {
        getState: jest.fn().mockResolvedValue('completed'),
        retry: jest.fn(),
      } as any;

      mockQueue.getJob.mockResolvedValue(mockJob);

      const result = await service.retryJob('job-123');

      expect(result).toBeNull();
      expect(mockJob.retry).not.toHaveBeenCalled();
    });

    it('should return null for non-existent job', async () => {
      mockQueue.getJob.mockResolvedValue(null);

      const result = await service.retryJob('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getQueueStats', () => {
    it('should return queue statistics', async () => {
      mockQueue.getWaiting.mockResolvedValue([1, 2] as any);
      mockQueue.getActive.mockResolvedValue([1] as any);
      mockQueue.getCompleted.mockResolvedValue([1, 2, 3] as any);
      mockQueue.getFailed.mockResolvedValue([1, 2] as any);
      mockQueue.getDelayed.mockResolvedValue([1] as any);
      mockQueue.getPaused.mockResolvedValue([] as any);

      const result = await service.getQueueStats();

      expect(result).toEqual({
        waiting: 2,
        active: 1,
        completed: 3,
        failed: 2,
        delayed: 1,
        paused: 0,
        total: 9,
      });
    });
  });

  describe('cleanJobs', () => {
    it('should clean old jobs', async () => {
      mockQueue.clean.mockResolvedValue([]);

      await service.cleanJobs(3600000); // 1 hour

      expect(mockQueue.clean).toHaveBeenCalledWith(3600000, 'completed');
      expect(mockQueue.clean).toHaveBeenCalledWith(3600000, 'failed');
    });

    it('should use default grace period', async () => {
      mockQueue.clean.mockResolvedValue([]);

      await service.cleanJobs();

      expect(mockQueue.clean).toHaveBeenCalledWith(86400000, 'completed'); // 24 hours
      expect(mockQueue.clean).toHaveBeenCalledWith(86400000, 'failed');
    });
  });

  describe('pauseQueue and resumeQueue', () => {
    it('should pause queue', async () => {
      mockQueue.pause.mockResolvedValue(undefined);

      await service.pauseQueue();

      expect(mockQueue.pause).toHaveBeenCalled();
    });

    it('should resume queue', async () => {
      mockQueue.resume.mockResolvedValue(undefined);

      await service.resumeQueue();

      expect(mockQueue.resume).toHaveBeenCalled();
    });
  });

  describe('findJobByIdempotencyKey', () => {
    it('should find job by idempotency key', async () => {
      const mockJobs = [
        { data: { idempotencyKey: 'key-1' } },
        { data: { idempotencyKey: 'key-2' } },
        { data: { idempotencyKey: 'target-key' } },
      ] as any;

      mockQueue.getJobs.mockResolvedValue(mockJobs);

      const result = await service.findJobByIdempotencyKey('target-key');

      expect(result).toBe(mockJobs[2]);
    });

    it('should return null if no job found', async () => {
      const mockJobs = [
        { data: { idempotencyKey: 'key-1' } },
        { data: { idempotencyKey: 'key-2' } },
      ] as any;

      mockQueue.getJobs.mockResolvedValue(mockJobs);

      const result = await service.findJobByIdempotencyKey('non-existent-key');

      expect(result).toBeNull();
    });
  });

  describe('waitForJobCompletion', () => {
    it('should resolve when job completes', async () => {
      const mockResult = { summary: { created: 5 } };
      const mockJob = {
        getState: jest.fn()
          .mockResolvedValueOnce('active')
          .mockResolvedValueOnce('completed'),
        returnvalue: mockResult,
      } as any;

      mockQueue.getJob.mockResolvedValue(mockJob);

      const result = await service.waitForJobCompletion('job-123', 1000);

      expect(result).toBe(mockResult);
    });

    it('should reject when job fails', async () => {
      const mockJob = {
        getState: jest.fn()
          .mockResolvedValueOnce('active')
          .mockResolvedValueOnce('failed'),
        failedReason: 'Processing error',
      } as any;

      mockQueue.getJob.mockResolvedValue(mockJob);

      await expect(service.waitForJobCompletion('job-123', 1000)).rejects.toThrow(
        'Job job-123 failed: Processing error',
      );
    });

    it('should reject when job times out', async () => {
      const mockJob = {
        getState: jest.fn().mockResolvedValue('active'),
      } as any;

      mockQueue.getJob.mockResolvedValue(mockJob);

      await expect(service.waitForJobCompletion('job-123', 100)).rejects.toThrow(
        'Job job-123 timed out after 100ms',
      );
    });

    it('should reject for non-existent job', async () => {
      mockQueue.getJob.mockResolvedValue(null);

      await expect(service.waitForJobCompletion('non-existent')).rejects.toThrow(
        'Job non-existent not found',
      );
    });
  });
});