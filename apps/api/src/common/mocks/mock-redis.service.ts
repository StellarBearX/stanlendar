import { Injectable } from '@nestjs/common';

@Injectable()
export class MockRedisService {
  private store = new Map<string, any>();
  private expiry = new Map<string, number>();

  async get(key: string): Promise<string | null> {
    if (this.isExpired(key)) {
      this.store.delete(key);
      this.expiry.delete(key);
      return null;
    }
    return this.store.get(key) || null;
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    this.store.set(key, value);
    if (ttl) {
      this.expiry.set(key, Date.now() + ttl * 1000);
    }
  }

  async del(key: string): Promise<number> {
    const existed = this.store.has(key);
    this.store.delete(key);
    this.expiry.delete(key);
    return existed ? 1 : 0;
  }

  async exists(key: string): Promise<number> {
    if (this.isExpired(key)) {
      this.store.delete(key);
      this.expiry.delete(key);
      return 0;
    }
    return this.store.has(key) ? 1 : 0;
  }

  async expire(key: string, ttl: number): Promise<number> {
    if (this.store.has(key)) {
      this.expiry.set(key, Date.now() + ttl * 1000);
      return 1;
    }
    return 0;
  }

  async ttl(key: string): Promise<number> {
    const expiryTime = this.expiry.get(key);
    if (!expiryTime) return -1;
    
    const remaining = Math.ceil((expiryTime - Date.now()) / 1000);
    return remaining > 0 ? remaining : -2;
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return Array.from(this.store.keys()).filter(key => regex.test(key));
  }

  async flushall(): Promise<void> {
    this.store.clear();
    this.expiry.clear();
  }

  async ping(): Promise<string> {
    return 'PONG';
  }

  // Hash operations
  async hget(key: string, field: string): Promise<string | null> {
    const hash = this.store.get(key);
    return hash && typeof hash === 'object' ? hash[field] || null : null;
  }

  async hset(key: string, field: string, value: string): Promise<number> {
    let hash = this.store.get(key);
    if (!hash || typeof hash !== 'object') {
      hash = {};
      this.store.set(key, hash);
    }
    const isNew = !hash.hasOwnProperty(field);
    hash[field] = value;
    return isNew ? 1 : 0;
  }

  async hdel(key: string, field: string): Promise<number> {
    const hash = this.store.get(key);
    if (hash && typeof hash === 'object' && hash.hasOwnProperty(field)) {
      delete hash[field];
      return 1;
    }
    return 0;
  }

  // List operations
  async lpush(key: string, ...values: string[]): Promise<number> {
    let list = this.store.get(key);
    if (!Array.isArray(list)) {
      list = [];
      this.store.set(key, list);
    }
    list.unshift(...values);
    return list.length;
  }

  async rpop(key: string): Promise<string | null> {
    const list = this.store.get(key);
    if (Array.isArray(list) && list.length > 0) {
      return list.pop() || null;
    }
    return null;
  }

  async llen(key: string): Promise<number> {
    const list = this.store.get(key);
    return Array.isArray(list) ? list.length : 0;
  }

  private isExpired(key: string): boolean {
    const expiryTime = this.expiry.get(key);
    return expiryTime ? Date.now() > expiryTime : false;
  }
}