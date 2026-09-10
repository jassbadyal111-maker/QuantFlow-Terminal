import { CandleData } from '../../types/backtest';
import { DatasetMetadata } from '../../types/dataset';

export interface CachedDatasetRecord {
  key: string;
  metadata: DatasetMetadata;
  candles: CandleData[];
  cachedAt: number;
  sizeBytes: number;
}

const DB_NAME = 'ApexQuantDataStore';
const STORE_NAME = 'datasets';
const DB_VERSION = 1;

export class DatasetStore {
  private static dbPromise: Promise<IDBDatabase> | null = null;
  private static memoryFallback: Map<string, CachedDatasetRecord> = new Map();

  private static getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        reject(new Error('IndexedDB unavailable'));
        return;
      }

      try {
        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event: any) => {
          const db = event.target.result as IDBDatabase;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'key' });
          }
        };

        request.onsuccess = (event: any) => {
          resolve(event.target.result as IDBDatabase);
        };

        request.onerror = () => {
          reject(request.error);
        };
      } catch (err) {
        reject(err);
      }
    });

    return this.dbPromise;
  }

  public static async set(key: string, metadata: DatasetMetadata, candles: CandleData[]): Promise<void> {
    const sizeBytes = JSON.stringify(candles).length;
    const record: CachedDatasetRecord = {
      key,
      metadata,
      candles,
      cachedAt: Date.now(),
      sizeBytes,
    };

    try {
      const db = await this.getDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(record);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      // Fallback to in-memory + localStorage header
      this.memoryFallback.set(key, record);
      try {
        localStorage.setItem(`apex_cache_meta_${key}`, JSON.stringify(metadata));
      } catch {
        // Ignore localStorage quota limits
      }
    }
  }

  public static async get(key: string): Promise<CachedDatasetRecord | null> {
    try {
      const db = await this.getDB();
      return await new Promise<CachedDatasetRecord | null>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return this.memoryFallback.get(key) || null;
    }
  }

  public static async delete(key: string): Promise<void> {
    try {
      const db = await this.getDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      this.memoryFallback.delete(key);
      try {
        localStorage.removeItem(`apex_cache_meta_${key}`);
      } catch {
        // ignore
      }
    }
  }

  public static async getAll(): Promise<CachedDatasetRecord[]> {
    try {
      const db = await this.getDB();
      return await new Promise<CachedDatasetRecord[]>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return Array.from(this.memoryFallback.values());
    }
  }

  public static async clear(): Promise<void> {
    try {
      const db = await this.getDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      this.memoryFallback.clear();
    }
  }
}
