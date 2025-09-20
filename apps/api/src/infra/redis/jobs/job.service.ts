import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue, Job, JobOptions } from 'bull';
import { SyncJobData, SyncJobResult } from './sync-job.processor';

export interface JobStatus {
  id: string;
  name: string;
  data: any;
  progress: number;
  state: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | 'paused';
  createdAt: Date;
  processedAt?: Date;
  finishedAt?: Date;
  failedReason?: string;
  result?: any;
  attempts: number;
  maxAttempts: number;
}

export interface CreateSyncJobOptions {
  priority?: number;
  delay?: number;
  attempts?: number;
  backoff?: {
    type: 'fixed' | 'exponential';
    delay: number;
  };
  removeOnComplete?: number;
  removeOnFail?: number;
}

@Injectable()
export class JobService {
  private readonly logger = new Logger(JobService.name);

  constructor(
    @InjectQueue('sync') private readonly syncQueue: Queue,
  ) {}

  /**
   * Create a calendar sync job
   */
  async createSyncJob(
    data: SyncJobData,
    options: CreateSyncJobOptions = {},
  ): Promise<Job<SyncJobData>> {
    const jobOptions: JobOptions = {
      priority: options.priority || 0,
      delay: options.delay || 0,
      attempts: options.attempts || 3,
      backoff: options.backoff || {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: options.removeOnComplete || 10,
      removeOnFail: options.removeOnFail || 50,
    };

    this.logger.log(`Creating sync job for user ${data.userId}`);
    this.logger.debug(`Job options:`, jobOptions);

    const job = await this.syncQueue.add('calendar-sync', data, jobOptions);
    
    this.logger.log(`Created sync job with ID: ${job.id}`);
    return job;
  }

  /**
   * Get job status by ID
   */
  async getJobStatus(jobId: string): Promise<JobStatus | null> {
    const job = await this.syncQueue.getJob(jobId);
    
    if (!job) {
      return null;
    }

    const state = await job.getState();
    
    return {
      id: job.id.toString(),
      name: job.name,
      data: job.data,
      progress: job.progress(),
      state,
      createdAt: new Date(job.timestamp),
      processedAt: job.processedOn ? new Date(job.processedOn) : undefined,
      finishedAt: job.finishedOn ? new Date(job.finishedOn) : undefined,
      failedReason: job.failedReason,
      result: job.returnvalue,
      attempts: job.attemptsMade,
      maxAttempts: job.opts.attempts || 1,
    };
  }

  /**
   * Get all jobs for a user (last 50)
   */
  async getUserJobs(userId: string, limit = 50): Promise<JobStatus[]> {
    const jobs = await this.syncQueue.getJobs(['waiting', 'active', 'completed', 'failed'], 0, limit - 1);
    
    const userJobs = jobs
      .filter(job => job.data.userId === userId)
      .map(async job => {
        const state = await job.getState();
        return {
          id: job.id.toString(),
          name: job.name,
          data: job.data,
          progress: job.progress(),
          state,
          createdAt: new Date(job.timestamp),
          processedAt: job.processedOn ? new Date(job.processedOn) : undefined,
          finishedAt: job.finishedOn ? new Date(job.finishedOn) : undefined,
          failedReason: job.failedReason,
          result: job.returnvalue,
          attempts: job.attemptsMade,
          maxAttempts: job.opts.attempts || 1,
        };
      });

    return Promise.all(userJobs);
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    const job = await this.syncQueue.getJob(jobId);
    
    if (!job) {
      return false;
    }

    const state = await job.getState();
    
    if (state === 'active') {
      this.logger.warn(`Cannot cancel active job ${jobId}`);
      return false;
    }

    if (state === 'completed' || state === 'failed') {
      this.logger.warn(`Cannot cancel ${state} job ${jobId}`);
      return false;
    }

    await job.remove();
    this.logger.log(`Cancelled job ${jobId}`);
    return true;
  }

  /**
   * Retry a failed job
   */
  async retryJob(jobId: string): Promise<Job<SyncJobData> | null> {
    const job = await this.syncQueue.getJob(jobId);
    
    if (!job) {
      return null;
    }

    const state = await job.getState();
    
    if (state !== 'failed') {
      this.logger.warn(`Cannot retry non-failed job ${jobId} (state: ${state})`);
      return null;
    }

    await job.retry();
    this.logger.log(`Retried job ${jobId}`);
    return job;
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    const waiting = await this.syncQueue.getWaiting();
    const active = await this.syncQueue.getActive();
    const completed = await this.syncQueue.getCompleted();
    const failed = await this.syncQueue.getFailed();
    const delayed = await this.syncQueue.getDelayed();
    const paused = await this.syncQueue.getPaused();

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
      paused: paused.length,
      total: waiting.length + active.length + completed.length + failed.length + delayed.length + paused.length,
    };
  }

  /**
   * Clean old jobs
   */
  async cleanJobs(grace: number = 24 * 60 * 60 * 1000): Promise<void> {
    // Clean completed jobs older than grace period
    await this.syncQueue.clean(grace, 'completed');
    
    // Clean failed jobs older than grace period
    await this.syncQueue.clean(grace, 'failed');
    
    this.logger.log(`Cleaned jobs older than ${grace}ms`);
  }

  /**
   * Pause the queue
   */
  async pauseQueue(): Promise<void> {
    await this.syncQueue.pause();
    this.logger.log('Queue paused');
  }

  /**
   * Resume the queue
   */
  async resumeQueue(): Promise<void> {
    await this.syncQueue.resume();
    this.logger.log('Queue resumed');
  }

  /**
   * Check if a job with the same idempotency key exists
   */
  async findJobByIdempotencyKey(idempotencyKey: string): Promise<Job<SyncJobData> | null> {
    const jobs = await this.syncQueue.getJobs(['waiting', 'active', 'completed'], 0, 100);
    
    const existingJob = jobs.find(job => job.data.idempotencyKey === idempotencyKey);
    return existingJob || null;
  }

  /**
   * Wait for job completion
   */
  async waitForJobCompletion(jobId: string, timeout = 30000): Promise<SyncJobResult> {
    const job = await this.syncQueue.getJob(jobId);
    
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Job ${jobId} timed out after ${timeout}ms`));
      }, timeout);

      const checkJob = async () => {
        const state = await job.getState();
        
        if (state === 'completed') {
          clearTimeout(timeoutId);
          resolve(job.returnvalue);
        } else if (state === 'failed') {
          clearTimeout(timeoutId);
          reject(new Error(`Job ${jobId} failed: ${job.failedReason}`));
        } else {
          // Check again in 500ms
          setTimeout(checkJob, 500);
        }
      };

      checkJob();
    });
  }
}