import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';
import { 
  EnhancedSecurityMiddleware, 
  RequestSizeMiddleware, 
  AuditLoggingMiddleware,
  IpWhitelistMiddleware 
} from '../security-enhanced.middleware';

describe('EnhancedSecurityMiddleware', () => {
  let middleware: EnhancedSecurityMiddleware;
  let configService: ConfigService;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    configService = new ConfigService();
    middleware = new EnhancedSecurityMiddleware(configService);
    
    mockRequest = {};
    mockResponse = {
      setHeader: jest.fn(),
      removeHeader: jest.fn()
    };
    mockNext = jest.fn();
  });

  it('should set security headers', () => {
    middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
    expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
    expect(mockResponse.setHeader).toHaveBeenCalledWith('X-XSS-Protection', '0');
    expect(mockResponse.setHeader).toHaveBeenCalledWith('Referrer-Policy', 'strict-origin-when-cross-origin');
    expect(mockResponse.removeHeader).toHaveBeenCalledWith('X-Powered-By');
    expect(mockResponse.removeHeader).toHaveBeenCalledWith('Server');
  });

  it('should set HSTS header in production', () => {
    jest.spyOn(configService, 'get').mockReturnValue('production');
    
    middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockResponse.setHeader).toHaveBeenCalledWith(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  });

  it('should generate nonce and request ID', () => {
    middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

    expect((mockRequest as any).nonce).toBeDefined();
    expect((mockRequest as any).securityRequestId).toBeDefined();
    expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Request-ID', expect.any(String));
  });

  it('should call next middleware', () => {
    middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
    expect(mockNext).toHaveBeenCalled();
  });
});

describe('RequestSizeMiddleware', () => {
  let middleware: RequestSizeMiddleware;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    middleware = new RequestSizeMiddleware();
    
    mockRequest = {
      headers: {}
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    mockNext = jest.fn();
  });

  it('should allow requests within size limits', () => {
    mockRequest.headers!['content-length'] = '1000';
    mockRequest.headers!['content-type'] = 'application/json';

    middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
    expect(mockNext).toHaveBeenCalled();
  });

  it('should reject large JSON requests', () => {
    mockRequest.headers!['content-length'] = '2000000'; // 2MB
    mockRequest.headers!['content-type'] = 'application/json';

    middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
    
    expect(mockResponse.status).toHaveBeenCalledWith(413);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: 413,
      message: 'Request too large',
      error: 'Payload Too Large'
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should reject large file uploads', () => {
    mockRequest.headers!['content-length'] = '20000000'; // 20MB
    mockRequest.headers!['content-type'] = 'multipart/form-data';

    middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
    
    expect(mockResponse.status).toHaveBeenCalledWith(413);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: 413,
      message: 'File too large',
      error: 'Payload Too Large'
    });
  });

  it('should allow file uploads within limits', () => {
    mockRequest.headers!['content-length'] = '5000000'; // 5MB
    mockRequest.headers!['content-type'] = 'multipart/form-data';

    middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
    expect(mockNext).toHaveBeenCalled();
  });
});

describe('AuditLoggingMiddleware', () => {
  let middleware: AuditLoggingMiddleware;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    middleware = new AuditLoggingMiddleware();
    
    mockRequest = {
      method: 'POST',
      originalUrl: '/auth/login',
      ip: '127.0.0.1',
      headers: {
        'user-agent': 'test-agent',
        'authorization': 'Bearer token'
      }
    };
    
    mockResponse = {
      on: jest.fn((event, callback) => {
        if (event === 'finish') {
          setTimeout(() => callback(), 0);
        }
      }),
      statusCode: 200
    };
    
    mockNext = jest.fn();
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should log sensitive operations', (done) => {
    middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('"type":"AUDIT_LOG"')
    );
    expect(mockNext).toHaveBeenCalled();
    
    // Wait for async logging to complete
    setTimeout(() => {
      done();
    }, 50);
  });

  it('should sanitize sensitive headers', (done) => {
    middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

    const logCall = consoleSpy.mock.calls[0][0];
    const logData = JSON.parse(logCall);
    
    expect(logData.headers).not.toHaveProperty('authorization');
    expect(logData.headers).not.toHaveProperty('cookie');
    
    // Wait for async logging to complete
    setTimeout(() => {
      done();
    }, 50);
  });

  it('should not log non-sensitive operations', () => {
    mockRequest.originalUrl = '/health';
    
    middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
    
    expect(consoleSpy).not.toHaveBeenCalled();
    expect(mockNext).toHaveBeenCalled();
  });
});

describe('IpWhitelistMiddleware', () => {
  let middleware: IpWhitelistMiddleware;
  let configService: ConfigService;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    configService = new ConfigService();
    
    mockRequest = {
      headers: {},
      connection: { remoteAddress: '127.0.0.1' },
      socket: { remoteAddress: '127.0.0.1' }
    };
    
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    
    mockNext = jest.fn();
  });

  it('should allow all IPs when no whitelist is configured', () => {
    jest.spyOn(configService, 'get').mockReturnValue('');
    middleware = new IpWhitelistMiddleware(configService);

    middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
    expect(mockNext).toHaveBeenCalled();
  });

  it('should allow whitelisted IPs', () => {
    jest.spyOn(configService, 'get').mockReturnValue('127.0.0.1,192.168.1.1');
    middleware = new IpWhitelistMiddleware(configService);

    middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
    expect(mockNext).toHaveBeenCalled();
  });

  it('should block non-whitelisted IPs', () => {
    jest.spyOn(configService, 'get').mockReturnValue('192.168.1.1');
    middleware = new IpWhitelistMiddleware(configService);

    middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
    
    expect(mockResponse.status).toHaveBeenCalledWith(403);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: 403,
      message: 'Access denied',
      error: 'Forbidden'
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should handle X-Forwarded-For header', () => {
    mockRequest.headers!['x-forwarded-for'] = '192.168.1.1, 10.0.0.1';
    jest.spyOn(configService, 'get').mockReturnValue('192.168.1.1');
    middleware = new IpWhitelistMiddleware(configService);

    middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
    expect(mockNext).toHaveBeenCalled();
  });
});