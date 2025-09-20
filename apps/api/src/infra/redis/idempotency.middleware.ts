import { Injectable, NestMiddleware, BadRequestException, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { IdempotencyService } from './idempotency.service';

export interface IdempotentRequest extends Request {
  idempotencyKey?: string;
  isIdempotent?: boolean;
}

@Injectable()
export class IdempotencyMiddleware implements NestMiddleware {
  private readonly logger = new Logger(IdempotencyMiddleware.name);

  constructor(private readonly idempotencyService: IdempotencyService) {}

  async use(req: IdempotentRequest, res: Response, next: NextFunction) {
    // Only apply to state-changing operations
    if (!this.isStateChangingOperation(req.method)) {
      return next();
    }

    const idempotencyKey = this.extractIdempotencyKey(req);
    
    if (!idempotencyKey) {
      // Idempotency key is required for state-changing operations
      throw new BadRequestException({
        error: 'IDEMPOTENCY_KEY_REQUIRED',
        message: 'Idempotency-Key header is required for this operation',
      });
    }

    if (!this.idempotencyService.validateIdempotencyKey(idempotencyKey)) {
      throw new BadRequestException({
        error: 'INVALID_IDEMPOTENCY_KEY',
        message: 'Idempotency key must be 16-64 characters, alphanumeric with hyphens/underscores',
      });
    }

    // Generate request fingerprint for additional validation
    const userId = this.extractUserId(req);
    const fingerprint = this.idempotencyService.generateRequestFingerprint(
      userId || 'anonymous',
      `${req.method} ${req.path}`,
      req.body,
    );

    // Combine idempotency key with fingerprint for uniqueness
    const combinedKey = `${idempotencyKey}:${fingerprint}`;

    // Store for use in controllers
    req.idempotencyKey = combinedKey;
    req.isIdempotent = true;

    this.logger.debug(`Idempotency middleware applied for key: ${combinedKey}`);
    next();
  }

  private isStateChangingOperation(method: string): boolean {
    return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase());
  }

  private extractIdempotencyKey(req: Request): string | undefined {
    return req.headers['idempotency-key'] as string || 
           req.headers['x-idempotency-key'] as string;
  }

  private extractUserId(req: any): string | undefined {
    // Extract user ID from JWT token or session
    return req.user?.id || req.user?.sub;
  }
}