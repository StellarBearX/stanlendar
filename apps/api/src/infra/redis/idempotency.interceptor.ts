import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, from } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { IdempotencyService, IdempotencyOptions } from './idempotency.service';
import { IDEMPOTENT_KEY } from './idempotent.decorator';
import { IdempotentRequest } from './idempotency.middleware';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);

  constructor(
    private readonly idempotencyService: IdempotencyService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const idempotencyOptions = this.reflector.get<IdempotencyOptions>(
      IDEMPOTENT_KEY,
      context.getHandler(),
    );

    // If method is not marked as idempotent, proceed normally
    if (!idempotencyOptions) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<IdempotentRequest>();
    
    // If no idempotency key is present, proceed normally
    if (!request.idempotencyKey) {
      return next.handle();
    }

    this.logger.debug(`Applying idempotency for key: ${request.idempotencyKey}`);

    return from(
      this.idempotencyService.ensureIdempotent(
        request.idempotencyKey,
        () => next.handle().toPromise(),
        idempotencyOptions,
      ),
    ).pipe(
      switchMap((result) => {
        if (result.isFromCache) {
          this.logger.debug(`Returning cached result for key: ${request.idempotencyKey}`);
          // Add header to indicate this was served from cache
          const response = context.switchToHttp().getResponse();
          response.setHeader('X-Idempotency-Cache', 'HIT');
        } else {
          const response = context.switchToHttp().getResponse();
          response.setHeader('X-Idempotency-Cache', 'MISS');
        }
        
        return from([result.data]);
      }),
    );
  }
}