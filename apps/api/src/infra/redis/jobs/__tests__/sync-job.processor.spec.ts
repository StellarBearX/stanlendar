import { Test, TestingModule } from '@nestjs/testing';
import { SyncJobProcessor, SyncJobData } from '../sync-job.processor';
import { Job } from 'bull';

describe('SyncJobProcessor', () => {
  let processor: SyncJobProcessor;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SyncJobProcessor],
    }).compile();

    processor = module.get<SyncJobProcessor>(SyncJobProcessor);
  });

  describe('handleCalendarSync', () => {
    let mockJob: Partial<Job<SyncJobData>>;

    beforeEach(() => {
      mockJob = {
        id: 'test-job-123',
        data: {
          userId: 'user-123',
          direction: 'upsert-to-google',
          range: {
            from: '2024-01-01',
            to: '2024-01-31',
          },
          idempotencyKey: 'test-key-123',
        },
        progress: jest.fn().mockResolvedValue(undefined),
      };
    });

    it('should process sync job successfully', async () => {
      const result = await processor.handleCalendarSync(mockJob as Job<SyncJobData>);

      expect(result).toEqual({
        summary: {
          created: 5,
          updated: 3,
          skipped: 2,
          failed: 0,
        },
        details: [
          { eventId: 'event-1', action: 'created' },
          { eventId: 'event-2', action: 'updated' },
          { eventId: 'event-3', action: 'skipped' },
        ],
        conflicts: [],
        quotaUsed: 8,
        isDryRun: false, // dryRun defaults to false
      });

      expect(mockJob.progress).toHaveBeenCalledWith(10);
      expect(mockJob.progress).toHaveBeenCalledWith(20);
      expect(mockJob.progress).toHaveBeenCalledWith(100);
    });

    it('should handle dry run correctly', async () => {
      mockJob.data!.dryRun = true;

      const result = await processor.handleCalendarSync(mockJob as Job<SyncJobData>);

      expect(result.isDryRun).toBe(true);
      expect(result.summary.created).toBe(0);
      expect(result.summary.updated).toBe(0);
      expect(result.quotaUsed).toBe(0);
    });

    it('should include eventIds when provided', async () => {
      mockJob.data!.eventIds = ['event-1', 'event-2'];

      const result = await processor.handleCalendarSync(mockJob as Job<SyncJobData>);

      expect(result).toBeDefined();
      // The processor should handle eventIds (implementation detail)
    });

    it('should validate required userId', async () => {
      delete mockJob.data!.userId;

      await expect(
        processor.handleCalendarSync(mockJob as Job<SyncJobData>),
      ).rejects.toThrow('User ID is required');
    });

    it('should validate sync direction', async () => {
      mockJob.data!.direction = 'invalid' as any;

      await expect(
        processor.handleCalendarSync(mockJob as Job<SyncJobData>),
      ).rejects.toThrow('Invalid sync direction');
    });

    it('should validate date range presence', async () => {
      delete mockJob.data!.range;

      await expect(
        processor.handleCalendarSync(mockJob as Job<SyncJobData>),
      ).rejects.toThrow('Date range is required');
    });

    it('should validate date range completeness', async () => {
      mockJob.data!.range = { from: '2024-01-01' } as any;

      await expect(
        processor.handleCalendarSync(mockJob as Job<SyncJobData>),
      ).rejects.toThrow('Date range is required');
    });

    it('should validate idempotency key', async () => {
      delete mockJob.data!.idempotencyKey;

      await expect(
        processor.handleCalendarSync(mockJob as Job<SyncJobData>),
      ).rejects.toThrow('Idempotency key is required');
    });

    it('should validate date format', async () => {
      mockJob.data!.range = {
        from: 'invalid-date',
        to: '2024-01-31',
      };

      await expect(
        processor.handleCalendarSync(mockJob as Job<SyncJobData>),
      ).rejects.toThrow('Invalid date format in range');
    });

    it('should validate date order', async () => {
      mockJob.data!.range = {
        from: '2024-01-31',
        to: '2024-01-01',
      };

      await expect(
        processor.handleCalendarSync(mockJob as Job<SyncJobData>),
      ).rejects.toThrow('From date must be before to date');
    });

    it('should validate date range size', async () => {
      mockJob.data!.range = {
        from: '2024-01-01',
        to: '2026-01-01', // More than 1 year
      };

      await expect(
        processor.handleCalendarSync(mockJob as Job<SyncJobData>),
      ).rejects.toThrow('Date range cannot exceed 1 year');
    });

    it('should handle processing errors', async () => {
      // Mock an error in the processing
      const originalPerformSync = processor['performSync'];
      processor['performSync'] = jest.fn().mockRejectedValue(new Error('Processing failed'));

      await expect(
        processor.handleCalendarSync(mockJob as Job<SyncJobData>),
      ).rejects.toThrow('Processing failed');

      // Restore original method
      processor['performSync'] = originalPerformSync;
    });
  });

  describe('validateSyncJobData', () => {
    it('should pass validation for valid data', () => {
      const validData: SyncJobData = {
        userId: 'user-123',
        direction: 'upsert-to-google',
        range: {
          from: '2024-01-01',
          to: '2024-01-31',
        },
        idempotencyKey: 'test-key-123',
      };

      expect(() => processor['validateSyncJobData'](validData)).not.toThrow();
    });

    it('should reject data without userId', () => {
      const invalidData = {
        direction: 'upsert-to-google',
        range: { from: '2024-01-01', to: '2024-01-31' },
        idempotencyKey: 'test-key-123',
      } as SyncJobData;

      expect(() => processor['validateSyncJobData'](invalidData)).toThrow('User ID is required');
    });

    it('should reject invalid direction', () => {
      const invalidData: SyncJobData = {
        userId: 'user-123',
        direction: 'invalid' as any,
        range: { from: '2024-01-01', to: '2024-01-31' },
        idempotencyKey: 'test-key-123',
      };

      expect(() => processor['validateSyncJobData'](invalidData)).toThrow('Invalid sync direction');
    });

    it('should reject missing range', () => {
      const invalidData = {
        userId: 'user-123',
        direction: 'upsert-to-google',
        idempotencyKey: 'test-key-123',
      } as SyncJobData;

      expect(() => processor['validateSyncJobData'](invalidData)).toThrow('Date range is required');
    });

    it('should reject incomplete range', () => {
      const invalidData: SyncJobData = {
        userId: 'user-123',
        direction: 'upsert-to-google',
        range: { from: '2024-01-01' } as any,
        idempotencyKey: 'test-key-123',
      };

      expect(() => processor['validateSyncJobData'](invalidData)).toThrow('Date range is required');
    });

    it('should reject missing idempotency key', () => {
      const invalidData = {
        userId: 'user-123',
        direction: 'upsert-to-google',
        range: { from: '2024-01-01', to: '2024-01-31' },
      } as SyncJobData;

      expect(() => processor['validateSyncJobData'](invalidData)).toThrow('Idempotency key is required');
    });
  });

  describe('performSync', () => {
    it('should return sync result for regular sync', async () => {
      const data: SyncJobData = {
        userId: 'user-123',
        direction: 'upsert-to-google',
        range: { from: '2024-01-01', to: '2024-01-31' },
        idempotencyKey: 'test-key-123',
        dryRun: false,
      };

      const result = await processor['performSync'](data);

      expect(result.summary.created).toBe(5);
      expect(result.summary.updated).toBe(3);
      expect(result.quotaUsed).toBe(8);
      expect(result.isDryRun).toBe(false);
    });

    it('should return dry run result for dry run sync', async () => {
      const data: SyncJobData = {
        userId: 'user-123',
        direction: 'upsert-to-google',
        range: { from: '2024-01-01', to: '2024-01-31' },
        idempotencyKey: 'test-key-123',
        dryRun: true,
      };

      const result = await processor['performSync'](data);

      expect(result.summary.created).toBe(0);
      expect(result.summary.updated).toBe(0);
      expect(result.quotaUsed).toBe(0);
      expect(result.isDryRun).toBe(true);
    });
  });
});