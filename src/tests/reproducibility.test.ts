import { BacktestEngine } from '../engine/BacktestEngine';
import { BacktestConfig } from '../types/backtest';
import { GOLDEN_FIXTURES, createTestConfig } from './fixtures';

export function runReproducibilityTests(): { suite: string; passed: number; failed: number; errors: string[] } {
  const result = { suite: 'Deterministic Reproducibility (10 Run Invariance)', passed: 0, failed: 0, errors: [] as string[] };

  function assert(condition: boolean, desc: string) {
    if (condition) {
      result.passed++;
    } else {
      result.failed++;
      result.errors.push(`FAILED: ${desc}`);
    }
  }

  const fixture = GOLDEN_FIXTURES['rising-1m'];
  const config: BacktestConfig = createTestConfig({
    strategyId: 'ema_crossover',
    symbol: 'BTC/USDT',
    timeframe: '1m',
    dateRange: { start: '2025-01-01', end: '2025-01-02' },
    initialCapital: 10000,
    leverage: 1,
    positionSizing: { type: 'percent_equity', value: 50 },
    execution: { makerFeeBps: 2, takerFeeBps: 5, slippageBps: 2, slippageModel: 'fixed' },
    indicators: { emaFast: 2, emaSlow: 4 },
    entryRules: { allowShorting: false },
    exitRules: {},
  });

  const runs = [];
  for (let i = 0; i < 10; i++) {
    const engine = new BacktestEngine(config, undefined, {
      candles: fixture.candles,
      metadata: fixture.metadata,
    });
    runs.push(engine.runSimulation(fixture.candles, fixture.metadata));
  }

  const firstRun = runs[0];
  let allMatched = true;

  for (let i = 1; i < runs.length; i++) {
    const currentRun = runs[i];
    if (currentRun.reproducibilityHash !== firstRun.reproducibilityHash) allMatched = false;
    if (currentRun.trades.length !== firstRun.trades.length) allMatched = false;
    if (currentRun.equityCurve[currentRun.equityCurve.length - 1]?.equity !== firstRun.equityCurve[firstRun.equityCurve.length - 1]?.equity) allMatched = false;
    if (currentRun.metrics.sharpeRatio !== firstRun.metrics.sharpeRatio) allMatched = false;
    if (currentRun.metrics.totalReturn !== firstRun.metrics.totalReturn) allMatched = false;
  }

  assert(allMatched, '10 consecutive runs yielded bit-for-bit identical hashes, trades, equity curves and metrics');
  assert(firstRun.invariantsPassed === true, 'Invariants pass on reproducible runs');

  return result;
}
