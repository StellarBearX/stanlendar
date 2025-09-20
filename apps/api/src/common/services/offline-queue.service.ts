import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

export interface QueuedOperation {
  id: string;
  userId: string;
  operation: string;
  payload: any;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
}

@Injectable()
export class OfflineQueueService {
  private readonly logger = new Logger(OfflineQueueService.name);
  private readonly QUEUE_KEY = 'offline_operations';
  private readonly MAX_QUEUE_SIZE = 1000;

  constructor(@InjectRedis() private readonly redis: Redis) {}

  async queueOperation(
    userId: string,
    operation: string,
    payload: any,
    maxRetries = 3,
  ): Promise<string> {
    const operationId = this.generateOperationId();
    const queuedOperation: QueuedOperation = {
      id: operationId,
      userId,
      operation,
      payload,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries,
    };

    try {
      // Add to user's queue
      const userQueueKey = `${this.QUEUE_KEY}:${userId}`;
      await this.redis.lpush(userQueueKey, JSON.stringify(queuedOperation));
      
      // Trim queue to prevent unlimited growth
      await this.redis.ltrim(userQueueKey, 0, this.MAX_QUEUE_SIZE - 1);
      
      // Set expiration for the queue (7 days)
      await this.redis.expire(userQueueKey, 7 * 24 * 60 * 60);

      this.logger.log(`Queued operation ${operation} for user ${userId}`, {
        operationId,
        operation,
        userId,
      });

      return operationId;
    } catch (error) {
      this.logger.error(`Failed to queue operation`, {
        operationId,
        operation,
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  async getQueuedOperations(userId: string): Promise<QueuedOperation[]> {
    try {
      const userQueueKey = `${this.QUEUE_KEY}:${userId}`;
      const operations = await this.redis.lrange(userQueueKey, 0, -1);
      
      return operations.map(op => JSON.parse(op)).sort((a, b) => a.timestamp - b.timestamp);
    } catch (error) {
      this.logger.error(`Failed to get queued operations for user ${userId}`, {
        error: error.message,
      });
      return [];
    }
  }

  async processQueuedOperations(
    userId: string,
    processor: (operation: QueuedOperation) => Promise<boolean>,
  ): Promise<{ processed: number; failed: number }> {
    const operations = await this.getQueuedOperations(userId);
    let processed = 0;
    let failed = 0;

    for (const operation of operations) {
      try {
        const success = await processor(operation);
        
        if (success) {
          await this.removeOperation(userId, operation.id);
          processed++;
          this.logger.log(`Successfully processed queued operation`, {
            operationId: operation.id,
            operation: operation.operation,
            userId,
          });
        } else {
          // Increment retry count
          operation.retryCount++;
          
          if (operation.retryCount >= operation.maxRetries) {
            await this.removeOperation(userId, operation.id);
            failed++;
            this.logger.warn(`Operation exceeded max retries, removing from queue`, {
              operationId: operation.id,
              operation: operation.operation,
              userId,
              retryCount: operation.retryCount,
            });
          } else {
            await this.updateOperation(userId, operation);
            this.logger.warn(`Operation failed, will retry`, {
              operationId: operation.id,
              operation: operation.operation,
              userId,
              retryCount: operation.retryCount,
            });
          }
        }
      } catch (error) {
        this.logger.error(`Error processing queued operation`, {
          operationId: operation.id,
          operation: operation.operation,
          userId,
          error: error.message,
        });
        failed++;
      }
    }

    return { processed, failed };
  }

  async removeOperation(userId: string, operationId: string): Promise<void> {
    try {
      const userQueueKey = `${this.QUEUE_KEY}:${userId}`;
      const operations = await this.redis.lrange(userQueueKey, 0, -1);
      
      for (let i = 0; i < operations.length; i++) {
        const operation = JSON.parse(operations[i]);
        if (operation.id === operationId) {
          // Remove the specific operation
          await this.redis.lrem(userQueueKey, 1, operations[i]);
          break;
        }
      }
    } catch (error) {
      this.logger.error(`Failed to remove operation ${operationId}`, {
        error: error.message,
      });
    }
  }

  async clearQueue(userId: string): Promise<void> {
    try {
      const userQueueKey = `${this.QUEUE_KEY}:${userId}`;
      await this.redis.del(userQueueKey);
      
      this.logger.log(`Cleared queue for user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to clear queue for user ${userId}`, {
        error: error.message,
      });
    }
  }

  async getQueueStatus(userId: string): Promise<{
    total: number;
    pending: number;
    failed: number;
    oldestTimestamp?: number;
  }> {
    try {
      const operations = await this.getQueuedOperations(userId);
      const failed = operations.filter(op => op.retryCount > 0).length;
      const oldestTimestamp = operations.length > 0 ? operations[0].timestamp : undefined;

      return {
        total: operations.length,
        pending: operations.length - failed,
        failed,
        oldestTimestamp,
      };
    } catch (error) {
      this.logger.error(`Failed to get queue status for user ${userId}`, {
        error: error.message,
      });
      return { total: 0, pending: 0, failed: 0 };
    }
  }

  private async updateOperation(userId: string, operation: QueuedOperation): Promise<void> {
    try {
      const userQueueKey = `${this.QUEUE_KEY}:${userId}`;
      const operations = await this.redis.lrange(userQueueKey, 0, -1);
      
      for (let i = 0; i < operations.length; i++) {
        const existingOperation = JSON.parse(operations[i]);
        if (existingOperation.id === operation.id) {
          // Replace the operation
          await this.redis.lset(userQueueKey, i, JSON.stringify(operation));
          break;
        }
      }
    } catch (error) {
      this.logger.error(`Failed to update operation ${operation.id}`, {
        error: error.message,
      });
    }
  }

  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }
}