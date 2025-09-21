import { BadRequestException } from '@nestjs/common';
import { SanitizationPipe, SqlInjectionPipe, XssProtectionPipe } from '../sanitization.pipe';
import { IsString, IsEmail } from 'class-validator';

class TestDto {
  @IsString()
  name: string;

  @IsEmail()
  email: string;
}

describe('SanitizationPipe', () => {
  let pipe: SanitizationPipe;

  beforeEach(() => {
    pipe = new SanitizationPipe();
  });

  describe('sanitizeObject', () => {
    it('should sanitize HTML tags from strings', async () => {
      const value = {
        name: '<script>alert("xss")</script>John Doe',
        email: 'john@example.com'
      };

      const result = await pipe.transform(value, { metatype: TestDto });
      expect(result.name).toBe('John Doe');
      expect(result.email).toBe('john@example.com');
    });

    it('should handle nested objects', async () => {
      const value = {
        name: 'John <b>Doe</b>',
        email: 'john@example.com',
        nested: {
          field: '<img src="x" onerror="alert(1)">test'
        }
      };

      const result = await pipe.transform(value, { metatype: TestDto });
      expect(result.name).toBe('John Doe');
    });

    it('should prevent prototype pollution', async () => {
      const value = {
        name: 'John',
        email: 'john@example.com',
        '__proto__': { polluted: true },
        'constructor': { polluted: true }
      };

      const result = await pipe.transform(value, { metatype: TestDto });
      
      // Check that the polluted properties were not copied
      expect(result).toHaveProperty('name', 'John');
      expect(result).toHaveProperty('email', 'john@example.com');
      expect(Object.hasOwnProperty.call(result, '__proto__')).toBe(false);
      expect(Object.hasOwnProperty.call(result, 'constructor')).toBe(false);
      
      // Verify prototype wasn't actually polluted
      expect((Object.prototype as any).polluted).toBeUndefined();
    });

    it('should trim whitespace', async () => {
      const value = {
        name: '  John Doe  ',
        email: '  john@example.com  '
      };

      const result = await pipe.transform(value, { metatype: TestDto });
      expect(result.name).toBe('John Doe');
      expect(result.email).toBe('john@example.com');
    });

    it('should handle arrays', async () => {
      const value = {
        name: 'John',
        email: 'john@example.com',
        tags: ['<script>alert(1)</script>tag1', 'tag2<img src=x>']
      };

      const result = await pipe.transform(value, { metatype: TestDto });
      expect(Array.isArray(result.tags)).toBe(true);
    });
  });

  describe('validation', () => {
    it('should throw BadRequestException for invalid data', async () => {
      const value = {
        name: 'John',
        email: 'invalid-email'
      };

      await expect(pipe.transform(value, { metatype: TestDto }))
        .rejects.toThrow(BadRequestException);
    });

    it('should pass valid data', async () => {
      const value = {
        name: 'John Doe',
        email: 'john@example.com'
      };

      const result = await pipe.transform(value, { metatype: TestDto });
      expect(result).toBeInstanceOf(TestDto);
      expect(result.name).toBe('John Doe');
      expect(result.email).toBe('john@example.com');
    });
  });
});

describe('SqlInjectionPipe', () => {
  let pipe: SqlInjectionPipe;

  beforeEach(() => {
    pipe = new SqlInjectionPipe();
  });

  it('should detect SQL injection attempts', () => {
    const maliciousInputs = [
      "'; DROP TABLE users; --",
      "1' OR '1'='1",
      "UNION SELECT * FROM users",
      "'; EXEC xp_cmdshell('dir'); --",
      "1; WAITFOR DELAY '00:00:05'; --"
    ];

    maliciousInputs.forEach(input => {
      expect(() => pipe.transform(input, { type: 'query' }))
        .toThrow(BadRequestException);
    });
  });

  it('should allow safe strings', () => {
    const safeInputs = [
      'John Doe',
      'user@example.com',
      'Some normal text with numbers 123',
      'Text with special chars: !@#$%^&*()'
    ];

    safeInputs.forEach(input => {
      expect(() => pipe.transform(input, { type: 'query' }))
        .not.toThrow();
    });
  });
});

describe('XssProtectionPipe', () => {
  let pipe: XssProtectionPipe;

  beforeEach(() => {
    pipe = new XssProtectionPipe();
  });

  it('should detect XSS attempts', () => {
    const maliciousInputs = [
      '<script>alert("xss")</script>',
      'javascript:alert(1)',
      '<img src="x" onerror="alert(1)">',
      '<iframe src="javascript:alert(1)"></iframe>',
      '<object data="javascript:alert(1)"></object>',
      '<embed src="javascript:alert(1)">',
      '<link rel="stylesheet" href="javascript:alert(1)">',
      '<meta http-equiv="refresh" content="0;url=javascript:alert(1)">'
    ];

    maliciousInputs.forEach(input => {
      expect(() => pipe.transform(input, { type: 'body' }))
        .toThrow(BadRequestException);
    });
  });

  it('should allow safe HTML-like strings', () => {
    const safeInputs = [
      'This is a <test> string',
      'Email: user@example.com',
      'Price: $10.99',
      'Temperature: 20°C'
    ];

    safeInputs.forEach(input => {
      expect(() => pipe.transform(input, { type: 'body' }))
        .not.toThrow();
    });
  });
});