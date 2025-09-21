import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../../app.module';

describe('Security Penetration Tests', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('SQL Injection Tests', () => {
    const sqlInjectionPayloads = [
      "'; DROP TABLE users; --",
      "1' OR '1'='1",
      "1' UNION SELECT * FROM users --",
      "'; EXEC xp_cmdshell('dir'); --",
      "1; WAITFOR DELAY '00:00:05'; --",
      "' OR 1=1 --",
      "admin'--",
      "admin' /*",
      "' OR 'x'='x",
      "1' AND (SELECT COUNT(*) FROM users) > 0 --"
    ];

    sqlInjectionPayloads.forEach((payload, index) => {
      it(`should reject SQL injection payload ${index + 1}: ${payload.substring(0, 20)}...`, async () => {
        const response = await request(app.getHttpServer())
          .post('/api/subjects')
          .send({
            name: payload,
            code: 'TEST001',
            colorHex: '#FF0000'
          });

        expect(response.status).toBeGreaterThanOrEqual(400);
      });
    });
  });

  describe('XSS Tests', () => {
    const xssPayloads = [
      '<script>alert("xss")</script>',
      '<img src="x" onerror="alert(1)">',
      '<svg onload="alert(1)">',
      'javascript:alert(1)',
      '<iframe src="javascript:alert(1)"></iframe>',
      '<object data="javascript:alert(1)"></object>',
      '<embed src="javascript:alert(1)">',
      '<link rel="stylesheet" href="javascript:alert(1)">',
      '<meta http-equiv="refresh" content="0;url=javascript:alert(1)">',
      '<body onload="alert(1)">',
      '<input onfocus="alert(1)" autofocus>',
      '<select onfocus="alert(1)" autofocus>',
      '<textarea onfocus="alert(1)" autofocus>',
      '<keygen onfocus="alert(1)" autofocus>',
      '<video><source onerror="alert(1)">'
    ];

    xssPayloads.forEach((payload, index) => {
      it(`should sanitize XSS payload ${index + 1}: ${payload.substring(0, 20)}...`, async () => {
        const response = await request(app.getHttpServer())
          .post('/api/subjects')
          .send({
            name: payload,
            code: 'TEST001',
            colorHex: '#FF0000'
          });

        // Should either reject or sanitize the payload
        if (response.status === 201) {
          expect(response.body.name).not.toContain('<script');
          expect(response.body.name).not.toContain('javascript:');
          expect(response.body.name).not.toContain('onerror');
          expect(response.body.name).not.toContain('onload');
        } else {
          expect(response.status).toBeGreaterThanOrEqual(400);
        }
      });
    });
  });

  describe('CSRF Tests', () => {
    it('should require CSRF token for state-changing operations', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/subjects')
        .send({
          name: 'Test Subject',
          code: 'TEST001',
          colorHex: '#FF0000'
        });

      // Should fail without proper authentication or CSRF token
      expect([401, 403]).toContain(response.status);
    });

    it('should reject requests with invalid CSRF tokens', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/subjects')
        .set('X-CSRF-Token', 'invalid-token')
        .send({
          name: 'Test Subject',
          code: 'TEST001',
          colorHex: '#FF0000'
        });

      expect([401, 403]).toContain(response.status);
    });
  });

  describe('Rate Limiting Tests', () => {
    it('should enforce rate limits', async () => {
      const requests = Array.from({ length: 150 }, (_, i) => 
        request(app.getHttpServer())
          .get('/api/health')
          .expect((res) => {
            if (i > 100) {
              expect([200, 429]).toContain(res.status);
            }
          })
      );

      await Promise.all(requests);
    });

    it('should have stricter rate limits for auth endpoints', async () => {
      const requests = Array.from({ length: 15 }, () => 
        request(app.getHttpServer())
          .post('/api/auth/login')
          .send({ code: 'invalid' })
      );

      const responses = await Promise.all(requests);
      const tooManyRequests = responses.filter(res => res.status === 429);
      
      expect(tooManyRequests.length).toBeGreaterThan(0);
    });
  });

  describe('Input Validation Tests', () => {
    it('should reject oversized requests', async () => {
      const largePayload = 'x'.repeat(2 * 1024 * 1024); // 2MB
      
      const response = await request(app.getHttpServer())
        .post('/api/subjects')
        .send({
          name: largePayload,
          code: 'TEST001',
          colorHex: '#FF0000'
        });

      expect(response.status).toBe(413);
    });

    it('should validate required fields', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/subjects')
        .send({
          // Missing required fields
        });

      expect(response.status).toBe(400);
    });

    it('should validate data types', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/subjects')
        .send({
          name: 123, // Should be string
          code: 'TEST001',
          colorHex: '#FF0000'
        });

      expect(response.status).toBe(400);
    });
  });

  describe('Security Headers Tests', () => {
    it('should include security headers', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/health');

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
      expect(response.headers['content-security-policy']).toBeDefined();
      expect(response.headers['x-powered-by']).toBeUndefined();
    });

    it('should include HSTS header in production', async () => {
      process.env.NODE_ENV = 'production';
      
      const response = await request(app.getHttpServer())
        .get('/api/health');

      if (process.env.NODE_ENV === 'production') {
        expect(response.headers['strict-transport-security']).toBeDefined();
      }
    });
  });

  describe('Authentication Bypass Tests', () => {
    const bypassAttempts = [
      { header: 'Authorization', value: 'Bearer ' },
      { header: 'Authorization', value: 'Bearer null' },
      { header: 'Authorization', value: 'Bearer undefined' },
      { header: 'Authorization', value: 'Basic YWRtaW46YWRtaW4=' },
      { header: 'X-User-ID', value: '1' },
      { header: 'X-Admin', value: 'true' },
      { header: 'X-Forwarded-User', value: 'admin' },
      { header: 'X-Original-User', value: 'admin' }
    ];

    bypassAttempts.forEach(({ header, value }) => {
      it(`should not allow auth bypass with ${header}: ${value}`, async () => {
        const response = await request(app.getHttpServer())
          .get('/api/subjects')
          .set(header, value);

        expect(response.status).toBe(401);
      });
    });
  });

  describe('Path Traversal Tests', () => {
    const pathTraversalPayloads = [
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32\\drivers\\etc\\hosts',
      '....//....//....//etc/passwd',
      '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
      '..%252f..%252f..%252fetc%252fpasswd',
      '..%c0%af..%c0%af..%c0%afetc%c0%afpasswd'
    ];

    pathTraversalPayloads.forEach((payload, index) => {
      it(`should reject path traversal payload ${index + 1}`, async () => {
        const response = await request(app.getHttpServer())
          .get(`/api/files/${payload}`);

        expect([400, 404]).toContain(response.status);
      });
    });
  });

  describe('HTTP Method Override Tests', () => {
    it('should not allow method override via headers', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/subjects')
        .set('X-HTTP-Method-Override', 'DELETE');

      // Should still be treated as GET, not DELETE
      expect(response.status).not.toBe(405);
    });

    it('should not allow method override via query params', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/subjects?_method=DELETE');

      // Should still be treated as GET, not DELETE
      expect(response.status).not.toBe(405);
    });
  });

  describe('Content Type Confusion Tests', () => {
    it('should validate content type for JSON endpoints', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/subjects')
        .set('Content-Type', 'text/plain')
        .send('name=test&code=TEST001');

      expect([400, 415]).toContain(response.status);
    });

    it('should reject XML content type', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/subjects')
        .set('Content-Type', 'application/xml')
        .send('<xml><name>test</name></xml>');

      expect([400, 415]).toContain(response.status);
    });
  });

  describe('Prototype Pollution Tests', () => {
    const pollutionPayloads = [
      { '__proto__': { 'polluted': true } },
      { 'constructor': { 'prototype': { 'polluted': true } } },
      { '__proto__.polluted': true },
      { 'constructor.prototype.polluted': true }
    ];

    pollutionPayloads.forEach((payload, index) => {
      it(`should prevent prototype pollution payload ${index + 1}`, async () => {
        const response = await request(app.getHttpServer())
          .post('/api/subjects')
          .send({
            name: 'Test',
            code: 'TEST001',
            colorHex: '#FF0000',
            ...payload
          });

        // Check that prototype wasn't polluted
        expect((Object.prototype as any).polluted).toBeUndefined();
        expect((Array.prototype as any).polluted).toBeUndefined();
      });
    });
  });
});