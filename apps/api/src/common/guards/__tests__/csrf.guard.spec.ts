import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CsrfGuard, CSRF_EXEMPT_KEY } from '../csrf.guard';
import { Request } from 'express';

describe('CsrfGuard', () => {
  let guard: CsrfGuard;
  let reflector: Reflector;
  let mockExecutionContext: ExecutionContext;
  let mockRequest: Partial<Request>;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new CsrfGuard(reflector);

    mockRequest = {
      method: 'POST',
      headers: {},
      session: {}
    };

    mockExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest as Request,
        getResponse: jest.fn(),
        getNext: jest.fn()
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
      getArgs: jest.fn(),
      getArgByIndex: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
      getType: jest.fn()
    };
  });

  describe('canActivate', () => {
    it('should allow requests to exempt routes', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);

      const result = guard.canActivate(mockExecutionContext);
      expect(result).toBe(true);
    });

    it('should allow GET requests without CSRF check', () => {
      mockRequest.method = 'GET';
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      const result = guard.canActivate(mockExecutionContext);
      expect(result).toBe(true);
    });

    it('should allow requests with Bearer token', () => {
      mockRequest.headers!.authorization = 'Bearer valid-token';
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      const result = guard.canActivate(mockExecutionContext);
      expect(result).toBe(true);
    });

    it('should throw ForbiddenException when CSRF token is missing', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      expect(() => guard.canActivate(mockExecutionContext))
        .toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when CSRF token is invalid', () => {
      mockRequest.headers!['x-csrf-token'] = 'invalid-token';
      (mockRequest.session as any).csrfToken = 'valid-token';
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      expect(() => guard.canActivate(mockExecutionContext))
        .toThrow(ForbiddenException);
    });

    it('should allow requests with valid CSRF token', () => {
      const validToken = 'valid-csrf-token';
      mockRequest.headers!['x-csrf-token'] = validToken;
      (mockRequest.session as any).csrfToken = validToken;
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      const result = guard.canActivate(mockExecutionContext);
      expect(result).toBe(true);
    });

    it('should handle different HTTP methods correctly', () => {
      const methods = ['POST', 'PUT', 'PATCH', 'DELETE'];
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      methods.forEach(method => {
        mockRequest.method = method;
        expect(() => guard.canActivate(mockExecutionContext))
          .toThrow(ForbiddenException);
      });
    });
  });

  describe('generateToken', () => {
    it('should generate a valid token', () => {
      const token = CsrfGuard.generateToken();
      expect(typeof token).toBe('string');
      expect(token.length).toBe(64); // 32 bytes * 2 (hex)
    });

    it('should generate unique tokens', () => {
      const token1 = CsrfGuard.generateToken();
      const token2 = CsrfGuard.generateToken();
      expect(token1).not.toBe(token2);
    });
  });
});