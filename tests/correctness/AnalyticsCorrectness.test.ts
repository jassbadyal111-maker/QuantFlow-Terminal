import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AnalyticsEngine } from '../../src/analytics/AnalyticsEngine';
import { EquityPoint, Trade } from '../../src/types/backtest';

function point(time: string, equity: number, prevPeak: number, benchmark = 100): EquityPoint {
  const dd = ((equity - prevPeak) / prevPeak) * 100;
  return { time, equity, benchmarkEquity: benchmark, drawdownPct: dd, pnl: equity - 100, cumulativePnl: equity - 100 };
}

describe('analytics correctness', () => {
  it('calculates total return and trade stats from supplied data', () => {
    const curve = [point('2025-01-01 00:00', 100, 100), point('2025-01-02 00:00', 110, 100, 105), point('2025-01-03 00:00', 105, 110, 102)];
    const trades: Trade[] = [
      { id:'T1', timestamp:'2025-01-01 00:00', exitTimestamp:'2025-01-02 00:00', symbol:'BTCUSDT', side:'LONG', entryPrice:100, exitPrice:110, size:1, notional:100, pnl:10, pnlPercent:10, fees:1, funding:0, netPnl:9, slippageBps:0, exitReason:'TAKE_PROFIT', durationBars:1, mfe:0, mae:0 },
      { id:'T2', timestamp:'2025-01-02 00:00', exitTimestamp:'2025-01-03 00:00', symbol:'BTCUSDT', side:'LONG', entryPrice:110, exitPrice:105, size:1, notional:110, pnl:-5, pnlPercent:-4.5, fees:1, funding:0, netPnl:-6, slippageBps:0, exitReason:'STOP_LOSS', durationBars:1, mfe:0, mae:0 },
    ];
    const metrics = AnalyticsEngine.calculateMetrics(curve, trades, 100, 2, 0, 0);
    assert.equal(metrics.totalReturn, 5);
    assert.equal(metrics.totalTrades, 2);
    assert.equal(metrics.winningTrades, 1);
    assert.equal(metrics.losingTrades, 1);
    assert.equal(metrics.avgTradePnl, 2.5);
  });

  it('does not invent trade metrics when there are no trades', () => {
    const metrics = AnalyticsEngine.calculateMetrics([], [], 100, 0, 0, 0);
    assert.equal(metrics.totalTrades, 0);
    assert.equal(metrics.winRate, 0);
    assert.equal(metrics.sharpeRatio, 0);
  });
});
