import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CryptoService } from '../crypto.service';

describe('CryptoService', () => {
  let service: CryptoService;
  let configService: ConfigService;

  const mockEncryptionKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CryptoService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(mockEncryptionKey),
          },
        },
      ],
    }).compile();

    service = module.get<CryptoService>(CryptoService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('encryptToken and decryptToken', () => {
    it('should encrypt and decrypt token successfully', () => {
      const token = 'test-access-token-12345';
      const userId = 'user-123';

      const encrypted = service.encryptToken(token, userId);
      expect(encrypted).toHaveProperty('data');
      expect(encrypted).toHaveProperty('iv');
      expect(encrypted).toHaveProperty('tag');
      expect(encrypted).toHaveProperty('keyVersion');
      expect(encrypted.keyVersion).toBe(1);

      const decrypted = service.decryptToken(encrypted, userId);
      expect(decrypted).toBe(token);
    });

    it('should fail decryption with wrong userId', () => {
      const token = 'test-access-token-12345';
      const userId = 'user-123';
      const wrongUserId = 'user-456';

      const encrypted = service.encryptToken(token, userId);

      expect(() => {
        service.decryptToken(encrypted, wrongUserId);
      }).toThrow();
    });

    it('should fail decryption with tampered data', () => {
      const token = 'test-access-token-12345';
      const userId = 'user-123';

      const encrypted = service.encryptToken(token, userId);
      encrypted.data = 'tampered-data';

      expect(() => {
        service.decryptToken(encrypted, userId);
      }).toThrow();
    });
  });

  describe('PKCE methods', () => {
    it('should generate valid code verifier', () => {
      const verifier = service.generateCodeVerifier();
      expect(verifier).toBeDefined();
      expect(verifier.length).toBeGreaterThan(40); // Base64url encoded 32 bytes
      expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/); // Base64url characters only
    });

    it('should generate valid code challenge from verifier', () => {
      const verifier = service.generateCodeVerifier();
      const challenge = service.generateCodeChallenge(verifier);

      expect(challenge).toBeDefined();
      expect(challenge.length).toBe(43); // SHA256 base64url is 43 chars
      expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('should generate consistent challenge for same verifier', () => {
      const verifier = 'test-verifier-123';
      const challenge1 = service.generateCodeChallenge(verifier);
      const challenge2 = service.generateCodeChallenge(verifier);

      expect(challenge1).toBe(challenge2);
    });
  });

  describe('generateState', () => {
    it('should generate unique state parameters', () => {
      const state1 = service.generateState();
      const state2 = service.generateState();

      expect(state1).toBeDefined();
      expect(state2).toBeDefined();
      expect(state1).not.toBe(state2);
      expect(state1).toMatch(/^[A-Za-z0-9_-]+$/);
    });
  });

  describe('generateSecureRandom', () => {
    it('should generate random strings of specified length', () => {
      const random16 = service.generateSecureRandom(16);
      const random32 = service.generateSecureRandom(32);

      expect(random16.length).toBeLessThan(random32.length);
      expect(random16).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(random32).toMatch(/^[A-Za-z0-9_-]+$/);
    });
  });

  describe('constructor validation', () => {
    it('should throw error for invalid encryption key', async () => {
      const invalidConfigService = {
        get: jest.fn().mockReturnValue('invalid-key'),
      };

      expect(() => {
        new CryptoService(invalidConfigService as any);
      }).toThrow('ENCRYPTION_KEY must be 64 characters (32 bytes) hex string');
    });
  });
});