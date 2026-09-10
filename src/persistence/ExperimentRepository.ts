import { BacktestResult, BacktestRunRecord, Strategy } from '../types/backtest';

const STORAGE_KEY_RUNS = 'apexquant_saved_runs_v2';
const STORAGE_KEY_STRATEGIES = 'apexquant_saved_strategies_v2';
const STORAGE_KEY_COMPARE = 'apexquant_compare_sets_v2';

export class ExperimentRepository {
  /**
   * Retrieves all saved backtest run records
   */
  static getSavedRuns(): BacktestRunRecord[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY_RUNS);
      if (!data) return [];
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  /**
   * Saves a backtest result as an immutable experiment record
   */
  static saveRun(result: BacktestResult, customName?: string): BacktestRunRecord {
    const runs = this.getSavedRuns();
    const id = result.runId || `RUN-${Date.now()}`;
    const name = customName || `${result.config.symbol} ${result.config.strategyId} (${result.metrics.totalReturn}% Ret)`;

    const record: BacktestRunRecord = {
      id,
      name,
      timestamp: result.timestamp || new Date().toISOString(),
      strategyId: result.config.strategyId,
      strategyName: result.config.strategyId,
      strategyVersion: '1.0.0',
      symbol: result.config.symbol,
      timeframe: result.config.timeframe,
      dateRange: `${result.config.dateRange.start} → ${result.config.dateRange.end}`,
      reproducibilityHash: result.reproducibilityHash,
      datasetSource: result.dataset?.source || 'DEMO_SYNTHETIC',
      isSynthetic: result.dataset?.isSynthetic ?? true,
      config: result.config,
      metrics: result.metrics,
      tradesCount: result.trades.length,
      result,
    };

    // Prepend to top and limit to 50 saved experiments
    const updated = [record, ...runs.filter((r) => r.id !== id)].slice(0, 50);
    try {
      localStorage.setItem(STORAGE_KEY_RUNS, JSON.stringify(updated));
    } catch (e) {
      console.warn('LocalStorage limit exceeded when saving run', e);
    }
    return record;
  }

  /**
   * Deletes a run by ID
   */
  static deleteRun(id: string): void {
    const runs = this.getSavedRuns();
    const filtered = runs.filter((r) => r.id !== id);
    try {
      localStorage.setItem(STORAGE_KEY_RUNS, JSON.stringify(filtered));
    } catch {}
  }

  /**
   * Retrieves comparison set IDs
   */
  static getComparisonRunIds(): string[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY_COMPARE);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  /**
   * Saves list of run IDs selected for side-by-side comparison
   */
  static saveComparisonRunIds(ids: string[]): void {
    try {
      localStorage.setItem(STORAGE_KEY_COMPARE, JSON.stringify(ids));
    } catch {}
  }

  /**
   * Exports all experiments and strategies as a JSON bundle
   */
  static exportWorkspaceJson(): string {
    const runs = this.getSavedRuns();
    const payload = {
      exportedAt: new Date().toISOString(),
      app: 'ApexQuant Terminal',
      version: '4.3.0',
      runs,
    };
    return JSON.stringify(payload, null, 2);
  }

  /**
   * Exports trade log to downloadable CSV format
   */
  static exportTradesCsv(result: BacktestResult): string {
    const headers = [
      'Trade ID',
      'Entry Time',
      'Exit Time',
      'Symbol',
      'Side',
      'Entry Price',
      'Exit Price',
      'Size',
      'Notional',
      'Net PnL ($)',
      'PnL (%)',
      'Fees ($)',
      'Funding ($)',
      'Slippage (bps)',
      'Exit Reason',
      'Duration (Bars)',
      'MFE (%)',
      'MAE (%)',
    ];

    const rows = result.trades.map((t) => [
      t.id,
      t.timestamp,
      t.exitTimestamp,
      t.symbol,
      t.side,
      t.entryPrice,
      t.exitPrice,
      t.size,
      t.notional,
      t.netPnl,
      t.pnlPercent,
      t.fees,
      t.funding,
      t.slippageBps,
      t.exitReason,
      t.durationBars,
      t.mfe,
      t.mae,
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }
}
