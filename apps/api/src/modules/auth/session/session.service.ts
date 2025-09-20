import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { CryptoService } from '../crypto.service';

export interface SessionData {
  userId: string;
  email: string;
  lastActivity: Date;
  ipAddress: string;
  userAgent: string;
  tokenFamily?: string;
}

@Injectable()
export class SessionService {
  private redis: Redis;
  private readonly sessionTTL = 24 * 60 * 60; // 24 hours in seconds

  constructor(
    private configService: ConfigService,
    private cryptoService: CryptoService,
  ) {
    this.redis = new Redis({
      host: this.configService.get('REDIS_HOST', 'localhost'),
      port: this.configService.get('REDIS_PORT', 6379),
      password: this.configService.get('REDIS_PASSWORD'),
      keyPrefix: 'session:',
    });
  }

  /**
   * Creates a new session
   */
  async createSession(
    userId: string,
    email: string,
    ipAddress: string,
    userAgent: string,
    tokenFamily?: string,
  ): Promise<string> {
    const sessionId = this.cryptoService.generateSecureRandom(32);
    
    const sessionData: SessionData = {
      userId,
      email,
      lastActivity: new Date(),
      ipAddress,
      userAgent,
      tokenFamily,
    };

    await this.redis.setex(
      sessionId,
      this.sessionTTL,
      JSON.stringify(sessionData)
    );

    // Track user sessions for management
    await this.redis.sadd(`user_sessions:${userId}`, sessionId);
    await this.redis.expire(`user_sessions:${userId}`, this.sessionTTL);

    return sessionId;
  }

  /**
   * Retrieves session data
   */
  async getSession(sessionId: string): Promise<SessionData | null> {
    const data = await this.redis.get(sessionId);
    if (!data) {
      return null;
    }

    try {
      const sessionData = JSON.parse(data) as SessionData;
      sessionData.lastActivity = new Date(sessionData.lastActivity);
      return sessionData;
    } catch (error) {
      console.error('Error parsing session data:', error);
      return null;
    }
  }

  /**
   * Updates session activity
   */
  async updateSessionActivity(sessionId: string): Promise<void> {
    const sessionData = await this.getSession(sessionId);
    if (!sessionData) {
      return;
    }

    sessionData.lastActivity = new Date();
    
    await this.redis.setex(
      sessionId,
      this.sessionTTL,
      JSON.stringify(sessionData)
    );
  }

  /**
   * Destroys a session
   */
  async destroySession(sessionId: string): Promise<void> {
    const sessionData = await this.getSession(sessionId);
    
    if (sessionData) {
      // Remove from user sessions set
      await this.redis.srem(`user_sessions:${sessionData.userId}`, sessionId);
    }
    
    await this.redis.del(sessionId);
  }

  /**
   * Destroys all sessions for a user
   */
  async destroyAllUserSessions(userId: string): Promise<void> {
    const sessionIds = await this.redis.smembers(`user_sessions:${userId}`);
    
    if (sessionIds.length > 0) {
      // Delete all session data
      await this.redis.del(...sessionIds);
      
      // Clear the user sessions set
      await this.redis.del(`user_sessions:${userId}`);
    }
  }

  /**
   * Gets all active sessions for a user
   */
  async getUserSessions(userId: string): Promise<SessionData[]> {
    const sessionIds = await this.redis.smembers(`user_sessions:${userId}`);
    const sessions: SessionData[] = [];

    for (const sessionId of sessionIds) {
      const sessionData = await this.getSession(sessionId);
      if (sessionData) {
        sessions.push(sessionData);
      } else {
        // Clean up invalid session ID
        await this.redis.srem(`user_sessions:${userId}`, sessionId);
      }
    }

    return sessions;
  }

  /**
   * Cleans up expired sessions
   */
  async cleanupExpiredSessions(): Promise<void> {
    // This would typically be run as a scheduled job
    // For now, we rely on Redis TTL for cleanup
    console.log('Session cleanup would run here');
  }

  /**
   * Gets session statistics
   */
  async getSessionStats(): Promise<{
    totalSessions: number;
    activeSessions: number;
  }> {
    const keys = await this.redis.keys('session:*');
    const totalSessions = keys.length;
    
    // Count sessions active in last hour
    let activeSessions = 0;
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    for (const key of keys) {
      const sessionData = await this.getSession(key.replace('session:', ''));
      if (sessionData && sessionData.lastActivity > oneHourAgo) {
        activeSessions++;
      }
    }

    return {
      totalSessions,
      activeSessions,
    };
  }
}