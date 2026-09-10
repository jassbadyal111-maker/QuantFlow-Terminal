import { BacktestConfig, BacktestResult, CandleData } from '../types/backtest';
import { BacktestEngine } from '../engine/BacktestEngine';
import { createMarketDataProvider } from '../data/MarketDataProvider';
import { DatasetMetadata } from '../types/dataset';

export { BacktestEngine };

/**
 * Executes a deterministic event-driven backtest asynchronously
 */
export async function runBacktestAsync(
  config: BacktestConfig,
  preloaded?: { candles: CandleData[]; metadata: DatasetMetadata },
  onProgress?: (progress: number, status: string) => void
): Promise<BacktestResult> {
  const provider = createMarketDataProvider(config.exchange || 'mock');
  const engine = new BacktestEngine(config, provider, preloaded);
  return await engine.execute(onProgress);
}

/**
 * Synchronous execution wrapper for instant UI updates (with mock or preloaded data)
 */
export function runSimulatedBacktest(
  config: BacktestConfig,
  preloaded?: { candles: CandleData[]; metadata: DatasetMetadata },
  onProgress?: (progress: number, status: string) => void
): BacktestResult {
  const provider = createMarketDataProvider(config.exchange || 'mock');
  const engine = new BacktestEngine(config, provider, preloaded);
  return engine.executeSync(onProgress);
}

