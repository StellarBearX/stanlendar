import { describe, it, expect, beforeAll } from '@jest/globals';

const API_URL = process.env.API_URL || 'http://localhost:3001';
const WEB_URL = process.env.WEB_URL || 'http://localhost:3000';

describe('Smoke Tests - Production Deployment', () => {
  beforeAll(() => {
    console.log(`Testing API at: ${API_URL}`);
    console.log(`Testing Web at: ${WEB_URL}`);
  });

  describe('API Health Checks', () => {
    it('should respond to health check', async () => {
      const response = await fetch(`${API_URL}/health`);
      expect(response.status).toBe(200);
      
      const health = await response.json();
      expect(health.status).toBe('healthy');
      expect(health.checks.database.status).toBe('healthy');
      expect(health.checks.redis.status).toBe('healthy');
    });

    it('should respond to readiness check', async () => {
      const response = await fetch(`${API_URL}/health/ready`);
      expect(response.status).toBe(200);
      
      const readiness = await response.json();
      expect(readiness.status).toBe('ready');
    });

    it('should respond to liveness check', async () => {
      const response = await fetch(`${API_URL}/health/live`);
      expect(response.status).toBe(200);
      
      const liveness = await response.json();
      expect(liveness.status).toBe('alive');
    });

    it('should have proper CORS headers', async () => {
      const response = await fetch(`${API_URL}/health`, {
        method: 'OPTIONS',
      });
      
      expect(response.headers.get('access-control-allow-origin')).toBeTruthy();
      expect(response.headers.get('access-control-allow-methods')).toBeTruthy();
    });

    it('should have security headers', async () => {
      const response = await fetch(`${API_URL}/health`);
      
      expect(response.headers.get('x-frame-options')).toBe('DENY');
      expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    });
  });

  describe('API Authentication', () => {
    it('should reject unauthenticated requests to protected endpoints', async () => {
      const response = await fetch(`${API_URL}/api/subjects`);
      expect(response.status).toBe(401);
    });

    it('should have Google OAuth endpoint available', async () => {
      const response = await fetch(`${API_URL}/auth/google`, {
        method: 'GET',
        redirect: 'manual',
      });
      
      // Should redirect to Google OAuth
      expect([302, 307]).toContain(response.status);
    });
  });

  describe('Web Application', () => {
    it('should serve the main page', async () => {
      const response = await fetch(WEB_URL);
      expect(response.status).toBe(200);
      
      const html = await response.text();
      expect(html).toContain('Class Schedule Sync');
    });

    it('should have proper security headers', async () => {
      const response = await fetch(WEB_URL);
      
      expect(response.headers.get('x-frame-options')).toBe('DENY');
      expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    });

    it('should serve static assets', async () => {
      const response = await fetch(`${WEB_URL}/_next/static/css/app/layout.css`);
      // CSS might not exist, but should not return 500
      expect(response.status).not.toBe(500);
    });

    it('should redirect to login when accessing protected routes', async () => {
      const response = await fetch(`${WEB_URL}/dashboard`, {
        redirect: 'manual',
      });
      
      // Should redirect to login or return login page
      expect([200, 302, 307]).toContain(response.status);
    });
  });

  describe('API Performance', () => {
    it('should respond to health check within 1 second', async () => {
      const start = Date.now();
      const response = await fetch(`${API_URL}/health`);
      const duration = Date.now() - start;
      
      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(1000);
    });

    it('should handle concurrent requests', async () => {
      const requests = Array(10).fill(null).map(() => 
        fetch(`${API_URL}/health`)
      );
      
      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });

  describe('Database Connectivity', () => {
    it('should have working database connection', async () => {
      const response = await fetch(`${API_URL}/health`);
      const health = await response.json();
      
      expect(health.checks.database.status).toBe('healthy');
      expect(health.checks.database.responseTime).toBeLessThan(1000);
    });
  });

  describe('Redis Connectivity', () => {
    it('should have working Redis connection', async () => {
      const response = await fetch(`${API_URL}/health`);
      const health = await response.json();
      
      expect(health.checks.redis.status).toBe('healthy');
      expect(health.checks.redis.responseTime).toBeLessThan(500);
    });
  });

  describe('Environment Configuration', () => {
    it('should be running in production mode', async () => {
      const response = await fetch(`${API_URL}/health`);
      const health = await response.json();
      
      expect(health.environment).toBe('production');
    });

    it('should have proper version information', async () => {
      const response = await fetch(`${API_URL}/health`);
      const health = await response.json();
      
      expect(health.version).toBeTruthy();
      expect(typeof health.version).toBe('string');
    });
  });
});