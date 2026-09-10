import { CandleData } from '../../types/backtest';
import { DatasetMetadata } from '../../types/dataset';
import { CachedDatasetRecord, DatasetStore } from './DatasetStore';
import { DataValidator } from '../validation/DataValidator';

export interface StorageUsageReport {
  totalDatasets: number;
  totalBars: number;
  estimatedBytes: number;
  formattedSize: string;
}

export class CacheManager {
  public static readonly SCHEMA_VERSION = 'v2.1';

  /**
   * Generates deterministic unique cache key:
   * exchange + symbol + timeframe + start + end + dataset version
   */
  public static buildKey(
    exchange: string,
    symbol: string,
    timeframe: string,
    startDate: string,
    endDate: string,
    version: string = this.SCHEMA_VERSION
  ): string {
    const cleanSym = symbol.replace('/', '').toUpperCase();
    const cleanEx = exchange.toUpperCase();
    const cleanTf = timeframe.toLowerCase();
    const s = startDate.replace(/[^0-9]/g, '').slice(0, 10);
    const e = endDate.replace(/[^0-9]/g, '').slice(0, 10);
    return `${cleanEx}_${cleanSym}_${cleanTf}_${s}_${e}_${version}`;
  }

  public static async get(key: string): Promise<CachedDatasetRecord | null> {
    return DatasetStore.get(key);
  }

  public static async set(
    key: string,
    metadata: DatasetMetadata,
    candles: CandleData[]
  ): Promise<void> {
    metadata.source = 'LOCAL_CACHE';
    metadata.checksum = metadata.checksum || DataValidator.calculateChecksum(candles);
    metadata.schemaVersion = this.SCHEMA_VERSION;
    await DatasetStore.set(key, metadata, candles);
  }

  public static async delete(key: string): Promise<void> {
    await DatasetStore.delete(key);
  }

  public static async listAll(): Promise<CachedDatasetRecord[]> {
    return DatasetStore.getAll();
  }

  public static async clear(): Promise<void> {
    await DatasetStore.clear();
  }

  public static async getStorageUsage(): Promise<StorageUsageReport> {
    const all = await DatasetStore.getAll();
    let totalBytes = 0;
    let totalBars = 0;

    for (const item of all) {
      totalBytes += item.sizeBytes || 0;
      totalBars += item.candles?.length || 0;
    }

    const mb = totalBytes / (1024 * 1024);
    const formatted = mb >= 1 ? `${mb.toFixed(2)} MB` : `${(totalBytes / 1024).toFixed(1)} KB`;

    return {
      totalDatasets: all.length,
      totalBars,
      estimatedBytes: totalBytes,
      formattedSize: formatted,
    };
  }
}
