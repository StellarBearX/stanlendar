import { SetMetadata } from '@nestjs/common';

export const IDEMPOTENT_KEY = 'idempotent';

/**
 * Decorator to mark controller methods as idempotent
 * @param options Configuration options for idempotency
 */
export const Idempotent = (options: { ttl?: number; keyPrefix?: string } = {}) =>
  SetMetadata(IDEMPOTENT_KEY, options);