import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ExecutionSimulator } from '../../src/execution/ExecutionSimulator';
import { BacktestConfig } from '../../src/types/backtest';
import { makeCandle } from '../fixtures/fixtures';

function config(overrides: Partial<BacktestConfig['execution']> = {}): BacktestConfig {
  return {
    strategyId: 'strat-test', exchange: 'MOCK', symbol: 'BTCUSDT', timeframe: '1m',
    dateRange: { start: '2025-01-01T00:00:00.000Z', end: '2025-01-01T00:05:00.000Z', preset: '3M' },
    initialCapital: 100000, leverage: 10, marginMode: 'CROSS',
    positionSizing: { type: 'fixed_usd', value: 10000 },
    indicators: { emaFast: 2, emaSlow: 3, atrPeriod: 2, rsiPeriod: 2, bbLength: 2, bbStdDev: 2 },
    entryRules: { longCond: 'EMA_CROSSOVER', shortCond: 'EMA_CROSSUNDER', allowShorting: true, useVolFilter: false, volFilterMultiplier: 0 },
    exitRules: { stopLossAtr: 1, takeProfitAtr: 1, trailingStop: false, breakevenAfterAtr: 0, maxHoldBars: 10 },
    execution: { makerFeeBps: 2, takerFeeBps: 5, slippageModel: 'fixed', slippageBps: 0, fundingRate8hBps: 0, latencyMs: 0, ...overrides },
  };
}

describe('execution simulator', () => {
  const bar = makeCandle(1735689600000, 100, 110, 90, 105);

  it('fills deterministic market buy with explicit fee and no randomness', () => {
    const sim = new ExecutionSimulator(config());
    const a = sim.fillMarketOrder(bar, 'BUY', 10000, 'T1');
    const b = sim.fillMarketOrder(bar, 'BUY', 10000, 'T2');
    assert.equal(a.fillPrice, b.fillPrice);
    assert.equal(a.executionRecord.filledQuantity, b.executionRecord.filledQuantity);
    assert.equal(a.feePaid, b.feePaid);
  });

  it('does not fill a limit order unless touched', () => {
    const sim = new ExecutionSimulator(config());
    const result = sim.fillLimitOrder({ ...bar, low: 101 }, 'BUY', 100, 10000, 'T1');
    assert.equal(result.filled, false);
    assert.equal(result.executionRecord.filledQuantity, 0);
  });

  it('fills a touched limit at the documented price rule', () => {
    const sim = new ExecutionSimulator(config());
    const result = sim.fillLimitOrder({ ...bar, open: 98, low: 95 }, 'BUY', 100, 10000, 'T1');
    assert.equal(result.filled, true);
    assert.equal(result.fillPrice, 98);
    assert.equal(result.executionRecord.liquiditySource, 'MAKER');
  });

  it('stop buy triggers on high and executes as market', () => {
    const sim = new ExecutionSimulator(config());
    const result = sim.fillStopOrder(bar, 'BUY', 108, 10000, 'T1');
    assert.equal(result.filled, true);
    assert.equal(result.executionRecord.orderType, 'MARKET');
  });
});
