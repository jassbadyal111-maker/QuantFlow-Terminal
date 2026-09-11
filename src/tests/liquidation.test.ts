import { BacktestEngine } from '../engine/BacktestEngine';
import { BacktestConfig } from '../types/backtest';
import { GOLDEN_FIXTURES, createTestConfig } from './fixtures';

export function runLiquidationTests(): { suite: string; passed: number; failed: number; errors: string[] } {
  const result = { suite: 'Liquidation Mechanics & Ledger Closure', passed: 0, failed: 0, errors: [] as string[] };

  function assert(condition: boolean, desc: string) {
    if (condition) {
      result.passed++;
    } else {
      result.failed++;
      result.errors.push(`FAILED: ${desc}`);
    }
  }

  const fixture = GOLDEN_FIXTURES['liquidation'];
  // Long position at 50,000 with 10x leverage (maintenance margin 0.5%)
  // Bar 2 drops price to 35,000 (-30% drop, far exceeding 10% margin)
  const config: BacktestConfig = createTestConfig({
    strategyId: 'ema_crossover',
    symbol: 'BTC/USDT',
    timeframe: '1m',
    dateRange: { start: '2025-01-01', end: '2025-01-02' },
    initialCapital: 10000,
    leverage: 10, // 10x leverage
    positionSizing: { type: 'percent_equity', value: 100 },
    execution: { makerFeeBps: 2, takerFeeBps: 5, slippageBps: 2, slippageModel: 'fixed' },
    indicators: { emaFast: 1, emaSlow: 2 },
    entryRules: { allowShorting: false },
    exitRules: {},
  });

  const engine = new BacktestEngine(config, undefined, {
    candles: fixture.candles,
    metadata: fixture.metadata,
  });

  const runResult = engine.runSimulation(fixture.candles, fixture.metadata);

  // 1. Verify liquidation event emitted
  assert(runResult.liquidationEvents.length >= 1, `Liquidation event emitted during severe crash (${runResult.liquidationEvents.length} event)`);

  if (runResult.liquidationEvents.length > 0) {
    const liqEvent = runResult.liquidationEvents[0];
    assert(liqEvent.symbol === 'BTC/USDT', 'Liquidation event references correct symbol');
    assert(liqEvent.bankruptcyPrice !== undefined, 'Liquidation event contains bankruptcy price');
    assert(liqEvent.maintenanceMargin !== undefined, 'Liquidation event contains maintenance margin');
  }

  // 2. Verify trade closed with exitReason = 'LIQUIDATION'
  const liqTrade = runResult.trades.find(t => t.exitReason === 'LIQUIDATION');
  assert(liqTrade !== undefined, 'Trade closed with exitReason === "LIQUIDATION"');

  // 3. Verify ledger records liquidation
  const ledgerLiq = runResult.tradeLedger?.filter(e => e.eventType === 'LIQUIDATION');
  assert(ledgerLiq !== undefined && ledgerLiq.length >= 1, 'TradeLedger contains immutable liquidation record');

  // 4. Invariants hold post-liquidation
  assert(runResult.invariantsPassed === true, 'Accounting invariants satisfied post-liquidation');

  return result;
}
