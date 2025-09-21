import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class EnhancedSecurityMiddleware implements NestMiddleware {
  constructor(private configService: ConfigService) {}

  use(req: Request, res: Response, next: NextFunction) {
    // Generate nonce for CSP
    const nonce = crypto.randomBytes(16).toString('base64');
    (req as any).nonce = nonce;

    // Enhanced security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '0'); // Disable XSS filter as CSP is more effective
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    res.setHeader('X-Download-Options', 'noopen');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    
    // Permissions Policy (formerly Feature Policy)
    res.setHeader(
      'Permissions-Policy',
      'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), speaker=(), vibrate=(), fullscreen=(self), sync-xhr=()'
    );

    // Strict Transport Security (HSTS)
    if (this.configService.get('NODE_ENV') === 'production') {
      res.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains; preload'
      );
    }

    // Enhanced Content Security Policy
    const cspDirectives = [
      "default-src 'self'",
      `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self'",
      "connect-src 'self'",
      "media-src 'none'",
      "object-src 'none'",
      "child-src 'none'",
      "frame-src 'none'",
      "worker-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "base-uri 'self'",
      "manifest-src 'self'",
      "upgrade-insecure-requests"
    ];

    res.setHeader('Content-Security-Policy', cspDirectives.join('; '));

    // Remove server information
    res.removeHeader('X-Powered-By');
    res.removeHeader('Server');

    // Add security-related request ID for audit logging
    const requestId = crypto.randomUUID();
    (req as any).securityRequestId = requestId;
    res.setHeader('X-Request-ID', requestId);

    next();
  }
}

@Injectable()
export class RequestSizeMiddleware implements NestMiddleware {
  private readonly maxJsonSize = 1024 * 1024; // 1MB
  private readonly maxFileSize = 10 * 1024 * 1024; // 10MB

  use(req: Request, res: Response, next: NextFunction) {
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    const contentType = req.headers['content-type'] || '';

    // Check request size limits
    if (contentType.includes('multipart/form-data')) {
      if (contentLength > this.maxFileSize) {
        return res.status(413).json({
          statusCode: 413,
          message: 'File too large',
          error: 'Payload Too Large'
        });
      }
    } else if (contentLength > this.maxJsonSize) {
      return res.status(413).json({
        statusCode: 413,
        message: 'Request too large',
        error: 'Payload Too Large'
      });
    }

    next();
  }
}

@Injectable()
export class AuditLoggingMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();
    const { method, originalUrl, ip, headers } = req;
    const userAgent = headers['user-agent'] || '';
    const requestId = (req as any).securityRequestId;
    const userId = (req as any).user?.id;

    // Log sensitive operations
    const sensitiveEndpoints = [
      '/auth/',
      '/sync/',
      '/import/',
      '/users/',
      '/calendar-accounts/'
    ];

    const isSensitive = sensitiveEndpoints.some(endpoint => 
      originalUrl.includes(endpoint)
    );

    if (isSensitive) {
      console.log(JSON.stringify({
        type: 'AUDIT_LOG',
        timestamp: new Date().toISOString(),
        requestId,
        userId,
        method,
        url: originalUrl,
        ip,
        userAgent,
        headers: this.sanitizeHeaders(headers)
      }));
    }

    res.on('finish', () => {
      const duration = Date.now() - start;
      const { statusCode } = res;

      if (isSensitive || statusCode >= 400) {
        console.log(JSON.stringify({
          type: 'AUDIT_LOG_RESPONSE',
          timestamp: new Date().toISOString(),
          requestId,
          userId,
          method,
          url: originalUrl,
          statusCode,
          duration,
          ip
        }));
      }
    });

    next();
  }

  private sanitizeHeaders(headers: any): any {
    const sanitized = { ...headers };
    
    // Remove sensitive headers from logs
    delete sanitized.authorization;
    delete sanitized.cookie;
    delete sanitized['x-csrf-token'];
    
    return sanitized;
  }
}

@Injectable()
export class IpWhitelistMiddleware implements NestMiddleware {
  private allowedIps: string[];

  constructor(private configService: ConfigService) {
    const whitelist = this.configService.get<string>('IP_WHITELIST', '');
    this.allowedIps = whitelist.split(',').filter(Boolean);
  }

  use(req: Request, res: Response, next: NextFunction) {
    // Skip if no whitelist configured
    if (this.allowedIps.length === 0) {
      return next();
    }

    const clientIp = this.getClientIp(req);
    
    if (!this.allowedIps.includes(clientIp)) {
      return res.status(403).json({
        statusCode: 403,
        message: 'Access denied',
        error: 'Forbidden'
      });
    }

    next();
  }

  private getClientIp(req: Request): string {
    return (
      req.headers['x-forwarded-for'] as string ||
      req.headers['x-real-ip'] as string ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      ''
    ).split(',')[0].trim();
  }
}