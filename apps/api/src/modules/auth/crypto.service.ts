import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { EncryptedToken } from './interfaces/auth.interface';

@Injectable()
export class CryptoService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyVersion = 1;
  private readonly encryptionKey: Buffer;

  constructor(private configService: ConfigService) {
    const key = this.configService.get<string>('ENCRYPTION_KEY');
    if (!key || key.length !== 64) {
      throw new Error('ENCRYPTION_KEY must be 64 characters (32 bytes) hex string');
    }
    this.encryptionKey = Buffer.from(key, 'hex');
  }

  /**
   * Encrypts a token using AES-256-GCM with user-specific AAD
   */
  encryptToken(token: string, userId: string): EncryptedToken {
    const iv = crypto.randomBytes(12); // 96-bit IV for GCM
    const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);
    cipher.setAAD(Buffer.from(userId, 'utf8')); // Additional authenticated data

    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag();

    return {
      data: encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
      keyVersion: this.keyVersion,
    };
  }

  /**
   * Decrypts a token using AES-256-GCM with user-specific AAD
   */
  decryptToken(encrypted: EncryptedToken, userId: string): string {
    if (encrypted.keyVersion !== this.keyVersion) {
      throw new Error(`Unsupported key version: ${encrypted.keyVersion}`);
    }

    const iv = Buffer.from(encrypted.iv, 'hex');
    const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, iv);
    decipher.setAAD(Buffer.from(userId, 'utf8'));
    decipher.setAuthTag(Buffer.from(encrypted.tag, 'hex'));

    let decrypted = decipher.update(encrypted.data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Generates a cryptographically secure random string for PKCE code verifier
   */
  generateCodeVerifier(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  /**
   * Generates PKCE code challenge from verifier using SHA256
   */
  generateCodeChallenge(verifier: string): string {
    return crypto
      .createHash('sha256')
      .update(verifier)
      .digest('base64url');
  }

  /**
   * Generates a secure random state parameter
   */
  generateState(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  /**
   * Generates a secure random string for various purposes
   */
  generateSecureRandom(bytes: number = 32): string {
    return crypto.randomBytes(bytes).toString('base64url');
  }
}