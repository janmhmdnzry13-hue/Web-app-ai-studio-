/**
 * Safe local storage abstraction with in-memory fallback.
 * Guarantees zero runtime crashes in incognito mode, SSR, or quota exceptions.
 */

class MemoryStorage {
  private store: Map<string, string> = new Map();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

class StorageService {
  private storage: Storage | MemoryStorage;

  constructor() {
    this.storage = this.isLocalStorageAvailable() ? window.localStorage : new MemoryStorage();
  }

  private isLocalStorageAvailable(): boolean {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false;
    }
    try {
      const testKey = '__origin_storage_probe__';
      window.localStorage.setItem(testKey, '1');
      window.localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  get<T>(key: string, fallback: T): T {
    try {
      const raw = this.storage.getItem(key);
      if (raw === null || raw === undefined) return fallback;
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  set<T>(key: string, value: T): boolean {
    try {
      this.storage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  remove(key: string): void {
    try {
      this.storage.removeItem(key);
    } catch {
      // Ignore
    }
  }

  clear(): void {
    try {
      this.storage.clear();
    } catch {
      // Ignore
    }
  }
}

export const safeStorage = new StorageService();
