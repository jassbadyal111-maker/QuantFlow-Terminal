import { AnalyticsEngine } from '../../src/analytics/AnalyticsEngine';
import { EquityPoint, Trade } from '../../src/types/backtest';

function point(time: string, equity: number, prevPeak: number, benchmark = 100): EquityPoint {
  const dd = ((equity - prevPeak) / prevPeak) * 100;
  return { time, equity, benchmarkEquity: benchmark, drawdownPct: dd, pnl: equity - 100, cumulativePnl: equity - 100 };
}

describe('analytics correctness', () => {
  it('calculates total return and trade stats from supplied data', () => {
    const curve = [
      point('2025-01-01 00:00', 100, 100),
      point('2025-01-02 00:00', 110, 100, 105),
      point('2025-01-03 00:00', 105, 110, 102),
    ];
    const trades: Trade[] = [
      { id: 'T1', timestamp: '2025-01-01 00:00', exitTimestamp: '2025-01-02 00:00', symbol: 'BTCUSDT', side: 'LONG', entryPrice: 100, exitPrice: 110, size: 1, notional: 100, pnl: 10, pnlPercent: 10, fees: 1, funding: 0, netPnl: 9, slippageBps: 0, exitReason: 'TAKE_PROFIT', durationBars: 1, mfe: 0, mae: 0 },
      { id: 'T2', timestamp: '2025-01-02 00:00', exitTimestamp: '2025-01-03 00:00', symbol: 'BTCUSDT', side: 'LONG', entryPrice: 110, exitPrice: 105, size: 1, notional: 110, pnl: -5, pnlPercent: -4.5, fees: 1, funding: 0, netPnl: -6, slippageBps: 0, exitReason: 'STOP_LOSS', durationBars: 1, mfe: 0, mae: 0 },
    ];
    const metrics = AnalyticsEngine.calculateMetrics(curve, trades, 100, 2, 0, 0);
    expect(metrics.totalReturn).toBe(5);
    expect(metrics.totalTrades).toBe(2);
    expect(metrics.winningTrades).toBe(1);
    expect(metrics.losingTrades).toBe(1);
    expect(metrics.avgTradePnl).toBe(2.5);
  });

  it('returns an unavailable-style zero sample for empty source rather than fabricated trade metrics', () => {
    const metrics = AnalyticsEngine.calculateMetrics([], [], 100, 0, 0, 0);
    expect(metrics.totalTrades).toBe(0);
    expect(metrics.winRate).toBe(0);
    expect(metrics.sharpeRatio).toBe(0);
  });
});
