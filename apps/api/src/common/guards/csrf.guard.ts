import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import * as crypto from 'crypto';

export const CSRF_EXEMPT_KEY = 'csrf_exempt';
export const CsrfExempt = () => (target: any, key?: string, descriptor?: any) => {
  if (descriptor) {
    Reflect.defineMetadata(CSRF_EXEMPT_KEY, true, descriptor.value);
    return descriptor;
  }
  Reflect.defineMetadata(CSRF_EXEMPT_KEY, true, target);
  return target;
};

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Check if CSRF protection is exempted for this route
    const isExempt = this.reflector.getAllAndOverride<boolean>(CSRF_EXEMPT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isExempt) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const method = request.method.toLowerCase();

    // Only check CSRF for state-changing operations
    if (!['post', 'put', 'patch', 'delete'].includes(method)) {
      return true;
    }

    // Skip CSRF for API endpoints with proper authentication
    // In a real app, you might want to implement double-submit cookies or synchronizer tokens
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return true;
    }

    // Check for CSRF token in headers
    const csrfToken = request.headers['x-csrf-token'] as string;
    const sessionCsrfToken = (request as any).session?.csrfToken;

    if (!csrfToken || !sessionCsrfToken) {
      throw new ForbiddenException('CSRF token missing');
    }

    // Verify CSRF token
    if (!this.verifyToken(csrfToken, sessionCsrfToken)) {
      throw new ForbiddenException('Invalid CSRF token');
    }

    return true;
  }

  private verifyToken(providedToken: string, sessionToken: string): boolean {
    try {
      // Use constant-time comparison to prevent timing attacks
      return crypto.timingSafeEqual(
        Buffer.from(providedToken, 'utf8'),
        Buffer.from(sessionToken, 'utf8')
      );
    } catch {
      return false;
    }
  }

  static generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}