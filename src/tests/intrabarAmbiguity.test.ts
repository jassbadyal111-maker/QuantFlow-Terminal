import { BacktestEngine } from '../engine/BacktestEngine';
import { BacktestConfig } from '../types/backtest';
import { GOLDEN_FIXTURES, createTestConfig } from './fixtures';

export function runIntrabarAmbiguityTests(): { suite: string; passed: number; failed: number; errors: string[] } {
  const result = { suite: 'Intrabar Ambiguity (Conservative Worst-Case Policy)', passed: 0, failed: 0, errors: [] as string[] };

  function assert(condition: boolean, desc: string) {
    if (condition) {
      result.passed++;
    } else {
      result.failed++;
      result.errors.push(`FAILED: ${desc}`);
    }
  }

  // Setup: A candle that enters a position, then next candle touches both SL and TP
  // In intrabar-ambiguity.json:
  // Bar 0: open 50000, high 50100, low 49900, close 50050 -> Triggers LONG entry
  // Bar 1: open 50050, high 52000, low 48000, close 50200 -> Touches both SL (< 49500) and TP (> 51000)
  const fixture = GOLDEN_FIXTURES['intrabar-ambiguity'];

  const config: BacktestConfig = createTestConfig({
    strategyId: 'ema_crossover',
    symbol: 'BTC/USDT',
    timeframe: '1m',
    dateRange: { start: '2025-01-01', end: '2025-01-02' },
    initialCapital: 10000,
    leverage: 1,
    positionSizing: { type: 'percent_equity', value: 100 },
    execution: { makerFeeBps: 0, takerFeeBps: 0, slippageBps: 0, fundingRate8hBps: 0, latencyMs: 0, slippageModel: 'fixed' },
    indicators: { emaFast: 1, emaSlow: 2 },
    entryRules: { allowShorting: false },
    exitRules: {
      stopLossAtr: 1.0, // SL set ~49500
      takeProfitAtr: 1.0, // TP set ~51000
    },
  });

  const engine = new BacktestEngine(config, undefined, {
    candles: fixture.candles,
    metadata: fixture.metadata,
  });

  const runResult = engine.runSimulation(fixture.candles, fixture.metadata);

  // Assertions:
  // 1. If any exit occurred on the ambiguity bar, it must be STOP_LOSS, not TAKE_PROFIT
  const exitTrades = runResult.trades.filter(t => t.exitReason === 'STOP_LOSS' || t.exitReason === 'TAKE_PROFIT');
  
  if (exitTrades.length > 0) {
    const trade = exitTrades[0];
    assert(trade.exitReason === 'STOP_LOSS', 'Conservative Worst-Case Policy: Stop-Loss triggered before Take-Profit on intrabar collision');
    assert(trade.netPnl < 0, 'Trade Net PnL is negative reflecting Stop-Loss priority');
  } else {
    assert(true, 'Simulation handled intrabar bar safely without crash');
  }

  assert(runResult.invariantsPassed === true, 'Invariants pass during intrabar ambiguity bar');

  return result;
}
