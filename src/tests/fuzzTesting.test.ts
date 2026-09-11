import { BacktestEngine } from '../engine/BacktestEngine';
import { BacktestConfig, CandleData } from '../types/backtest';
import { DatasetMetadata } from '../types/dataset';
import { createTestConfig } from './fixtures';

export function runFuzzTests(): { suite: string; passed: number; failed: number; errors: string[] } {
  const result = { suite: 'Property-Based & Fuzz Invariant Testing (50 Iterations)', passed: 0, failed: 0, errors: [] as string[] };

  function assert(condition: boolean, desc: string) {
    if (condition) {
      result.passed++;
    } else {
      result.failed++;
      result.errors.push(`FAILED: ${desc}`);
    }
  }

  const ITERATIONS = 50;
  let allRunsClean = true;

  for (let runIdx = 0; runIdx < ITERATIONS; runIdx++) {
    // Generate pseudo-random deterministic synthetic series
    const candles: CandleData[] = [];
    let price = 50000 + (runIdx * 137) % 5000;
    const baseTs = 1735689600000;

    for (let b = 0; b < 60; b++) {
      const step = ((Math.sin(runIdx * 10 + b) * 200) + ((b % 7) - 3) * 50);
      const open = Math.max(100, price);
      const close = Math.max(100, open + step);
      const high = Math.max(open, close) + Math.abs(Math.cos(b) * 80);
      const low = Math.min(open, close) - Math.abs(Math.sin(b) * 80);
      price = close;

      candles.push({
        time: `2025-01-01 ${String(Math.floor(b / 60)).padStart(2, '0')}:${String(b % 60).padStart(2, '0')}`,
        timestamp: baseTs + b * 60000,
        open: Number(open.toFixed(2)),
        high: Number(high.toFixed(2)),
        low: Number(low.toFixed(2)),
        close: Number(close.toFixed(2)),
        volume: 100 + (b * 13) % 200,
      });
    }

    const metadata: DatasetMetadata = {
      id: `fuzz-run-${runIdx}`,
      name: `Fuzz Run ${runIdx}`,
      symbol: 'BTC/USDT',
      timeframe: '1m',
      source: 'DEMO_SYNTHETIC',
      isSynthetic: true,
      candleCount: candles.length,
      startTime: candles[0].time,
      endTime: candles[candles.length - 1].time,
      completeness: 1.0,
      hasGaps: false,
      checksum: `FUZZ-${runIdx}`,
      generatedAt: new Date().toISOString(),
    };

    const config: BacktestConfig = createTestConfig({
      strategyId: 'ema_crossover',
      symbol: 'BTC/USDT',
      timeframe: '1m',
      dateRange: { start: '2025-01-01', end: '2025-01-02' },
      initialCapital: 10000,
      leverage: 1 + (runIdx % 5),
      positionSizing: { type: 'percent_equity', value: 25 + (runIdx % 50) },
      execution: { makerFeeBps: 2, takerFeeBps: 5, slippageBps: 2, slippageModel: 'fixed' },
      indicators: { emaFast: 3, emaSlow: 7 },
      entryRules: { allowShorting: runIdx % 2 === 0 },
      exitRules: {},
    });

    try {
      const engine = new BacktestEngine(config, undefined, { candles, metadata });
      const res = engine.runSimulation(candles, metadata);

      // Property invariants:
      // 1. Total return is finite (no NaN or Infinity)
      if (!Number.isFinite(res.metrics.totalReturn)) allRunsClean = false;
      // 2. All trade quantities > 0
      for (const t of res.trades) {
        if (t.size <= 0) allRunsClean = false;
        if (t.fees < 0) allRunsClean = false;
      }
      // 3. Invariants verified
      if (!res.invariantsPassed) {
        allRunsClean = false;
      }
    } catch (err) {
      allRunsClean = false;
    }
  }

  assert(allRunsClean, 'All 50 randomized fuzz backtests executed with 100% finite metrics, valid trades, and passing invariants');

  return result;
}
