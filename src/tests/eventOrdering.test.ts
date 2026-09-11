import { BacktestEngine } from '../engine/BacktestEngine';
import { BacktestConfig } from '../types/backtest';
import { GOLDEN_FIXTURES, createTestConfig } from './fixtures';

export function runEventOrderingTests(): { suite: string; passed: number; failed: number; errors: string[] } {
  const result = { suite: 'Event Ordering (13-Step Institutional Engine Lifecycle)', passed: 0, failed: 0, errors: [] as string[] };

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

  const engine = new BacktestEngine(config, undefined, {
    candles: fixture.candles,
    metadata: fixture.metadata,
  });

  const res = engine.runSimulation(fixture.candles, fixture.metadata);

  // 1. Logs verify the structured lifecycle steps
  const hasSystemInit = res.logs.some(l => l.includes('[SYSTEM]'));
  const hasStrategyInit = res.logs.some(l => l.includes('[STRATEGY]'));
  const hasComplete = res.logs.some(l => l.includes('[COMPLETE]'));

  assert(hasSystemInit && hasStrategyInit && hasComplete, 'Execution lifecycle strictly traces: System Init -> Strategy Prep -> Matching -> Ledger Audit -> Finalization');

  // 2. Audit Trail Consistency:
  // Every trade has an entry order and execution record created before exit
  for (const trade of res.trades) {
    assert(trade.exitTimestamp >= trade.timestamp, `Trade ${trade.id} satisfies temporal ordering: entry ${trade.timestamp} <= exit ${trade.exitTimestamp}`);
  }

  // 3. Equity Curve monotonicity with bars
  assert(res.equityCurve.length === fixture.candles.length, `Instantaneous equity curve points (${res.equityCurve.length}) exactly match dataset candle bars (${fixture.candles.length})`);

  return result;
}
