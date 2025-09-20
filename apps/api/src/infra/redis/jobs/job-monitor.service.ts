import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Cron, CronExpression } from '@nestjs/schedule';

export interface QueueHealth {
  name: string;
  isHealthy: boolean;
  stats: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: number;
  };
  issues: string[];
  lastChecked: Date;
}

export interface JobMetrics {
  totalJobs: number;
  successRate: number;
  averageProcessingTime: number;
  failureReasons: Record<string, number>;
  hourlyThroughput: number;
}

@Injectable()
export class JobMonitorService implements OnModuleInit {
  private readonly logger = new Logger(JobMonitorService.name);
  private readonly maxActiveJobs = 10;
  private readonly maxWaitingJobs = 100;
  private readonly maxFailedJobs = 50;

  constructor(
    @InjectQueue('sync') private readonly syncQueue: Queue,
  ) {}

  async onModuleInit() {
    this.logger.log('Job monitor service initialized');
    
    // Set up queue event listeners
    this.setupQueueEventListeners();
    
    // Perform initial health check
    await this.checkQueueHealth();
  }

  /**
   * Check overall queue health
   */
  async checkQueueHealth(): Promise<QueueHealth> {
    const stats = await this.getQueueStats();
    const issues: string[] = [];
    
    // Check for issues
    if (stats.active > this.maxActiveJobs) {
      issues.push(`Too many active jobs: ${stats.active} (max: ${this.maxActiveJobs})`);
    }
    
    if (stats.waiting > this.maxWaitingJobs) {
      issues.push(`Too many waiting jobs: ${stats.waiting} (max: ${this.maxWaitingJobs})`);
    }
    
    if (stats.failed > this.maxFailedJobs) {
      issues.push(`Too many failed jobs: ${stats.failed} (max: ${this.maxFailedJobs})`);
    }

    // Check if queue is paused
    const isPaused = await this.syncQueue.isPaused();
    if (isPaused) {
      issues.push('Queue is paused');
    }

    const isHealthy = issues.length === 0;
    
    const health: QueueHealth = {
      name: 'sync',
      isHealthy,
      stats,
      issues,
      lastChecked: new Date(),
    };

    if (!isHealthy) {
      this.logger.warn('Queue health issues detected:', issues);
    } else {
      this.logger.debug('Queue health check passed');
    }

    return health;
  }

  /**
   * Get detailed job metrics
   */
  async getJobMetrics(hours = 24): Promise<JobMetrics> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    // Get recent jobs
    const completed = await this.syncQueue.getCompleted(0, 1000);
    const failed = await this.syncQueue.getFailed(0, 1000);
    
    // Filter by time range
    const recentCompleted = completed.filter(job => 
      job.finishedOn && new Date(job.finishedOn) > since
    );
    
    const recentFailed = failed.filter(job => 
      job.finishedOn && new Date(job.finishedOn) > since
    );

    const totalJobs = recentCompleted.length + recentFailed.length;
    const successRate = totalJobs > 0 ? (recentCompleted.length / totalJobs) * 100 : 0;

    // Calculate average processing time
    const processingTimes = recentCompleted
      .filter(job => job.processedOn && job.finishedOn)
      .map(job => job.finishedOn! - job.processedOn!);
    
    const averageProcessingTime = processingTimes.length > 0
      ? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length
      : 0;

    // Collect failure reasons
    const failureReasons: Record<string, number> = {};
    recentFailed.forEach(job => {
      const reason = job.failedReason || 'Unknown error';
      failureReasons[reason] = (failureReasons[reason] || 0) + 1;
    });

    // Calculate hourly throughput
    const hourlyThroughput = totalJobs / hours;

    return {
      totalJobs,
      successRate,
      averageProcessingTime,
      failureReasons,
      hourlyThroughput,
    };
  }

  /**
   * Get queue statistics
   */
  private async getQueueStats() {
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
    };
  }

  /**
   * Set up queue event listeners for monitoring
   */
  private setupQueueEventListeners() {
    this.syncQueue.on('completed', (job, result) => {
      this.logger.log(`Job ${job.id} completed successfully`);
      this.logger.debug(`Job result:`, result);
    });

    this.syncQueue.on('failed', (job, err) => {
      this.logger.error(`Job ${job.id} failed:`, err);
    });

    this.syncQueue.on('stalled', (job) => {
      this.logger.warn(`Job ${job.id} stalled`);
    });

    this.syncQueue.on('progress', (job, progress) => {
      this.logger.debug(`Job ${job.id} progress: ${progress}%`);
    });

    this.syncQueue.on('paused', () => {
      this.logger.warn('Queue paused');
    });

    this.syncQueue.on('resumed', () => {
      this.logger.log('Queue resumed');
    });

    this.syncQueue.on('error', (error) => {
      this.logger.error('Queue error:', error);
    });
  }

  /**
   * Scheduled health check (every 5 minutes)
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async scheduledHealthCheck() {
    try {
      const health = await this.checkQueueHealth();
      
      if (!health.isHealthy) {
        this.logger.warn('Scheduled health check failed:', health.issues);
        // Here you could send alerts, notifications, etc.
      }
    } catch (error) {
      this.logger.error('Scheduled health check error:', error);
    }
  }

  /**
   * Scheduled cleanup (every hour)
   */
  @Cron(CronExpression.EVERY_HOUR)
  async scheduledCleanup() {
    try {
      // Clean completed jobs older than 24 hours
      await this.syncQueue.clean(24 * 60 * 60 * 1000, 'completed');
      
      // Clean failed jobs older than 7 days
      await this.syncQueue.clean(7 * 24 * 60 * 60 * 1000, 'failed');
      
      this.logger.log('Scheduled cleanup completed');
    } catch (error) {
      this.logger.error('Scheduled cleanup error:', error);
    }
  }

  /**
   * Get stuck jobs (active for too long)
   */
  async getStuckJobs(maxAge = 30 * 60 * 1000): Promise<any[]> {
    const active = await this.syncQueue.getActive();
    const now = Date.now();
    
    return active.filter(job => {
      const age = now - job.processedOn!;
      return age > maxAge;
    });
  }

  /**
   * Force cleanup of stuck jobs
   */
  async cleanupStuckJobs(): Promise<number> {
    const stuckJobs = await this.getStuckJobs();
    
    for (const job of stuckJobs) {
      try {
        await job.moveToFailed(new Error('Job stuck - forced cleanup'), true);
        this.logger.warn(`Moved stuck job ${job.id} to failed`);
      } catch (error) {
        this.logger.error(`Failed to cleanup stuck job ${job.id}:`, error);
      }
    }
    
    return stuckJobs.length;
  }

  /**
   * Get queue insights for debugging
   */
  async getQueueInsights() {
    const health = await this.checkQueueHealth();
    const metrics = await this.getJobMetrics();
    const stuckJobs = await this.getStuckJobs();
    
    return {
      health,
      metrics,
      stuckJobsCount: stuckJobs.length,
      queueName: 'sync',
      timestamp: new Date(),
    };
  }
}