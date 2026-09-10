import { BacktestConfig, BacktestResult } from '../types/backtest';
import { BacktestEngine } from '../engine/BacktestEngine';
import { SyntheticMarketDataProvider } from '../data/MarketDataProvider';

export { BacktestEngine };

/**
 * Executes a deterministic event-driven backtest asynchronously
 */
export async function runBacktestAsync(
  config: BacktestConfig,
  onProgress?: (progress: number, status: string) => void
): Promise<BacktestResult> {
  const engine = new BacktestEngine(config, new SyntheticMarketDataProvider());
  return await engine.execute(onProgress);
}

/**
 * Synchronous execution wrapper for instant UI updates
 */
export function runSimulatedBacktest(
  config: BacktestConfig,
  onProgress?: (progress: number, status: string) => void
): BacktestResult {
  const engine = new BacktestEngine(config, new SyntheticMarketDataProvider());
  return engine.executeSync(onProgress);
}
