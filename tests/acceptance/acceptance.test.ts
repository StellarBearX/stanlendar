import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

/**
 * Acceptance Tests - Final Requirements Validation
 * 
 * This test suite validates that all requirements from the requirements.md
 * are properly implemented and working in the production environment.
 */

const API_URL = process.env.API_URL || 'http://localhost:3001';
const WEB_URL = process.env.WEB_URL || 'http://localhost:3000';

describe('Acceptance Tests - All Requirements', () => {
  beforeAll(() => {
    console.log('🎯 Running acceptance tests against:');
    console.log(`   API: ${API_URL}`);
    console.log(`   Web: ${WEB_URL}`);
  });

  describe('Requirement 1: Google OAuth Authentication', () => {
    it('should provide Google OAuth sign-in endpoint', async () => {
      const response = await fetch(`${API_URL}/auth/google`, {
        method: 'GET',
        redirect: 'manual',
      });
      
      // Should redirect to Google OAuth
      expect([302, 307]).toContain(response.status);
      
      const location = response.headers.get('location');
      expect(location).toContain('accounts.google.com');
      expect(location).toContain('oauth2');
      expect(location).toContain('scope=openid%20email%20profile');
    });

    it('should have OAuth callback endpoint', async () => {
      // Test that callback endpoint exists (will return error without valid code)
      const response = await fetch(`${API_URL}/auth/google/callback`);
      expect([400, 401, 422]).toContain(response.status); // Expected without valid OAuth code
    });

    it('should protect authenticated endpoints', async () => {
      const response = await fetch(`${API_URL}/api/subjects`);
      expect(response.status).toBe(401);
      
      const error = await response.json();
      expect(error.message).toContain('Unauthorized');
    });
  });

  describe('Requirement 2: Calendar View with Color Coding', () => {
    it('should serve calendar dashboard page', async () => {
      const response = await fetch(`${WEB_URL}/dashboard`);
      expect([200, 302]).toContain(response.status); // 200 if public, 302 if redirect to login
    });

    it('should have calendar view switching endpoints', async () => {
      // Test that the frontend serves the calendar component
      const response = await fetch(`${WEB_URL}/dashboard`);
      if (response.status === 200) {
        const html = await response.text();
        expect(html).toContain('calendar'); // Should contain calendar-related content
      }
    });
  });

  describe('Requirement 3: Spotlight Search Filtering', () => {
    it('should have search endpoint available', async () => {
      const response = await fetch(`${API_URL}/api/spotlight/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'test' }),
      });
      
      // Should return 401 (unauthorized) since we're not authenticated
      expect(response.status).toBe(401);
    });

    it('should serve spotlight filter component', async () => {
      const response = await fetch(`${WEB_URL}/dashboard`);
      if (response.status === 200) {
        const html = await response.text();
        // Should contain search/filter related elements
        expect(html.toLowerCase()).toMatch(/(search|filter|spotlight)/);
      }
    });
  });

  describe('Requirement 4: Quick Add Class Feature', () => {
    it('should have quick add endpoint', async () => {
      const response = await fetch(`${API_URL}/api/subjects/quick-add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectName: 'Test Subject',
          sectionCode: '001',
          days: ['MO', 'WE'],
          startTime: '09:00',
          endTime: '10:30',
          room: 'Room 101',
          startDate: '2024-01-15',
          endDate: '2024-05-15',
        }),
      });
      
      // Should return 401 (unauthorized) since we're not authenticated
      expect(response.status).toBe(401);
    });
  });

  describe('Requirement 5: CSV/XLSX Import System', () => {
    it('should have file upload endpoint', async () => {
      const response = await fetch(`${API_URL}/api/import/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      
      // Should return 401 (unauthorized) or 400 (bad request) since we're not authenticated
      expect([400, 401]).toContain(response.status);
    });

    it('should serve import page', async () => {
      const response = await fetch(`${WEB_URL}/dashboard/import`);
      expect([200, 302]).toContain(response.status);
    });
  });

  describe('Requirement 6: Google Calendar Sync', () => {
    it('should have sync endpoint', async () => {
      const response = await fetch(`${API_URL}/api/sync/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          direction: 'upsert-to-google',
          range: { from: '2024-01-01', to: '2024-12-31' },
        }),
      });
      
      // Should return 401 (unauthorized) since we're not authenticated
      expect(response.status).toBe(401);
    });
  });

  describe('Requirement 7: Automatic Reminders', () => {
    it('should have reminder settings endpoint', async () => {
      const response = await fetch(`${API_URL}/api/reminders/settings`);
      
      // Should return 401 (unauthorized) since we're not authenticated
      expect(response.status).toBe(401);
    });
  });

  describe('Requirement 8: Saved Filter Combinations', () => {
    it('should have saved filters endpoint', async () => {
      const response = await fetch(`${API_URL}/api/spotlight/saved-filters`);
      
      // Should return 401 (unauthorized) since we're not authenticated
      expect(response.status).toBe(401);
    });
  });

  describe('Requirement 9: Timezone Handling', () => {
    it('should handle timezone consistently in API responses', async () => {
      const response = await fetch(`${API_URL}/health`);
      expect(response.status).toBe(200);
      
      const health = await response.json();
      expect(health.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });

  describe('Requirement 10: Security and Privacy', () => {
    it('should enforce HTTPS in production', async () => {
      if (process.env.NODE_ENV === 'production') {
        expect(API_URL).toMatch(/^https:/);
        expect(WEB_URL).toMatch(/^https:/);
      }
    });

    it('should have proper security headers', async () => {
      const response = await fetch(`${API_URL}/health`);
      
      expect(response.headers.get('x-frame-options')).toBe('DENY');
      expect(response.headers.get('x-content-type-options')).toBe('nosniff');
      expect(response.headers.get('referrer-policy')).toBeTruthy();
    });

    it('should have CORS properly configured', async () => {
      const response = await fetch(`${API_URL}/health`, {
        method: 'OPTIONS',
      });
      
      const corsOrigin = response.headers.get('access-control-allow-origin');
      expect(corsOrigin).toBeTruthy();
    });

    it('should validate input on API endpoints', async () => {
      const response = await fetch(`${API_URL}/api/subjects/quick-add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invalid: 'data' }),
      });
      
      // Should return validation error or unauthorized
      expect([400, 401, 422]).toContain(response.status);
    });
  });
});

describe('Performance Requirements', () => {
  it('should respond to health check within 1 second', async () => {
    const start = Date.now();
    const response = await fetch(`${API_URL}/health`);
    const duration = Date.now() - start;
    
    expect(response.status).toBe(200);
    expect(duration).toBeLessThan(1000);
  });

  it('should handle concurrent requests', async () => {
    const concurrentRequests = 10;
    const requests = Array(concurrentRequests).fill(null).map(() => 
      fetch(`${API_URL}/health`)
    );
    
    const start = Date.now();
    const responses = await Promise.all(requests);
    const duration = Date.now() - start;
    
    responses.forEach(response => {
      expect(response.status).toBe(200);
    });
    
    // All requests should complete within 3 seconds
    expect(duration).toBeLessThan(3000);
  });

  it('should have reasonable frontend load time', async () => {
    const start = Date.now();
    const response = await fetch(WEB_URL);
    const duration = Date.now() - start;
    
    expect([200, 302]).toContain(response.status);
    expect(duration).toBeLessThan(3000); // 3 second timeout for initial load
  });
});

describe('Error Handling Requirements', () => {
  it('should handle 404 errors gracefully', async () => {
    const response = await fetch(`${API_URL}/api/nonexistent-endpoint`);
    expect(response.status).toBe(404);
    
    const error = await response.json();
    expect(error).toHaveProperty('error');
    expect(error.error).toHaveProperty('message');
  });

  it('should handle malformed JSON gracefully', async () => {
    const response = await fetch(`${API_URL}/api/subjects/quick-add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid json{',
    });
    
    expect([400, 401]).toContain(response.status);
  });

  it('should serve custom error pages for frontend', async () => {
    const response = await fetch(`${WEB_URL}/nonexistent-page`);
    expect([404, 200]).toContain(response.status); // 200 if SPA handles routing
  });
});

describe('Database and Infrastructure', () => {
  it('should have healthy database connection', async () => {
    const response = await fetch(`${API_URL}/health`);
    expect(response.status).toBe(200);
    
    const health = await response.json();
    expect(health.checks.database.status).toBe('healthy');
    expect(health.checks.database.responseTime).toBeLessThan(1000);
  });

  it('should have healthy Redis connection', async () => {
    const response = await fetch(`${API_URL}/health`);
    expect(response.status).toBe(200);
    
    const health = await response.json();
    expect(health.checks.redis.status).toBe('healthy');
    expect(health.checks.redis.responseTime).toBeLessThan(500);
  });

  it('should be running in production mode', async () => {
    if (process.env.NODE_ENV === 'production') {
      const response = await fetch(`${API_URL}/health`);
      const health = await response.json();
      
      expect(health.environment).toBe('production');
    }
  });
});

describe('API Documentation and Standards', () => {
  it('should return proper JSON content type', async () => {
    const response = await fetch(`${API_URL}/health`);
    expect(response.headers.get('content-type')).toContain('application/json');
  });

  it('should have consistent error response format', async () => {
    const response = await fetch(`${API_URL}/api/subjects`);
    expect(response.status).toBe(401);
    
    const error = await response.json();
    expect(error).toHaveProperty('error');
    expect(error.error).toHaveProperty('message');
  });

  it('should support OPTIONS requests for CORS', async () => {
    const response = await fetch(`${API_URL}/health`, {
      method: 'OPTIONS',
    });
    
    expect([200, 204]).toContain(response.status);
  });
});