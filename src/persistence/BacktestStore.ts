import { BacktestResult } from '../types/backtest';
import { BacktestSnapshot, ExecutionAssumptions, ValidationReport } from '../types/dataset';
import { DataValidator } from '../data/validation/DataValidator';

const STORAGE_KEY_SNAPSHOTS = 'apexquant_backtest_snapshots_v3';

export class BacktestStore {
  /**
   * Builds a complete, immutable BacktestSnapshot from a BacktestResult
   */
  public static createSnapshot(result: BacktestResult, customId?: string): BacktestSnapshot {
    const assumptions: ExecutionAssumptions = {
      makerFeeBps: result.config.execution.makerFeeBps,
      takerFeeBps: result.config.execution.takerFeeBps,
      slippageModel: result.config.execution.slippageModel,
      slippageBps: result.config.execution.slippageBps,
      bidAskSpreadBps: result.config.execution.bidAskSpreadBps ?? 1.0,
      latencyMs: result.config.execution.latencyMs || 15,
      partialFillRatio: result.config.execution.partialFillProbability ? 0.75 : 1.0,
      fundingMode: result.dataset?.isSynthetic ? 'SIMULATED' : 'HISTORICAL',
    };

    const valReport: ValidationReport = {
      valid: result.dataset.validationStatus !== 'FAILED',
      warnings: result.dataset.validationNotes || [],
      errors: result.dataset.validationStatus === 'FAILED' ? (result.dataset.validationNotes || ['Validation failed']) : [],
      statistics: {
        totalBars: result.candles.length,
        duplicateRows: result.dataset.duplicateRows ?? result.dataset.duplicateCount ?? 0,
        missingIntervals: result.dataset.missingIntervals ?? result.dataset.missingBarsCount ?? 0,
        minPrice: result.dataset.minPrice ?? 0,
        maxPrice: result.dataset.maxPrice ?? 0,
        minVolume: result.dataset.minVolume ?? 0,
        maxVolume: result.dataset.maxVolume ?? 0,
        startTime: result.dataset.startTime || result.candles[0]?.time || '',
        endTime: result.dataset.endTime || result.candles[result.candles.length - 1]?.time || '',
        expectedIntervalMinutes: DataValidator.getTimeframeMinutes(result.config.timeframe),
        abnormalGapsCount: 0,
        invalidOhlcCount: 0,
      },
    };

    const snapshotId = customId || `SNAP-${result.reproducibilityHash.slice(5, 12)}-${Date.now().toString().slice(-4)}`;

    return {
      snapshotId,
      runId: result.runId,
      createdAt: new Date().toISOString(),
      engineVersion: result.engineVersion || 'ApexQuant Core v4.3.0',
      strategyVersion: '1.0.0',
      datasetMetadata: result.dataset,
      config: result.config,
      metrics: result.metrics,
      trades: result.trades,
      orders: result.orders,
      equityCurve: result.equityCurve,
      validationReport: valReport,
      executionAssumptions: assumptions,
      reproducibilityHash: result.reproducibilityHash,
    };
  }

  /**
   * Saves a snapshot to local persistence
   */
  public static saveSnapshot(snapshot: BacktestSnapshot): void {
    const list = this.getAllSnapshots();
    const updated = [snapshot, ...list.filter((s) => s.snapshotId !== snapshot.snapshotId)].slice(0, 40);
    try {
      localStorage.setItem(STORAGE_KEY_SNAPSHOTS, JSON.stringify(updated));
    } catch (e) {
      console.warn('LocalStorage limit reached when saving BacktestSnapshot', e);
    }
  }

  /**
   * Retrieves all saved snapshots
   */
  public static getAllSnapshots(): BacktestSnapshot[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_SNAPSHOTS);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  /**
   * Gets a specific snapshot by id or runId
   */
  public static getSnapshot(id: string): BacktestSnapshot | null {
    const all = this.getAllSnapshots();
    return all.find((s) => s.snapshotId === id || s.runId === id) || null;
  }

  /**
   * Deletes a snapshot
   */
  public static deleteSnapshot(id: string): void {
    const all = this.getAllSnapshots().filter((s) => s.snapshotId !== id && s.runId !== id);
    try {
      localStorage.setItem(STORAGE_KEY_SNAPSHOTS, JSON.stringify(all));
    } catch {
      // ignore
    }
  }

  /**
   * Export snapshot as downloadable JSON string
   */
  public static exportSnapshotJson(snapshot: BacktestSnapshot): string {
    return JSON.stringify(snapshot, null, 2);
  }

  /**
   * Import snapshot from JSON string
   */
  public static importSnapshotJson(jsonStr: string): BacktestSnapshot {
    const parsed = JSON.parse(jsonStr) as BacktestSnapshot;
    if (!parsed.snapshotId || !parsed.reproducibilityHash || !parsed.config) {
      throw new Error('Invalid BacktestSnapshot schema: missing required identifiers.');
    }
    this.saveSnapshot(parsed);
    return parsed;
  }
}
