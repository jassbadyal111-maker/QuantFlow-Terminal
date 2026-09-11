import { AnalyticsEngine } from '../analytics/AnalyticsEngine';
import { EquityPoint, Trade } from '../types/backtest';
import { PrecisionPolicy } from '../accounting/PrecisionPolicy';

export function runAnalyticsAuditTests(): { suite: string; passed: number; failed: number; errors: string[] } {
  const result = { suite: 'Analytics Metrics Mathematical Audit', passed: 0, failed: 0, errors: [] as string[] };

  function assert(condition: boolean, desc: string) {
    if (condition) {
      result.passed++;
    } else {
      result.failed++;
      result.errors.push(`FAILED: ${desc}`);
    }
  }

  // Sample equity curve:
  // 10000 -> 10500 (Peak 10500) -> 9450 (-10% from peak) -> 11000 (New Peak) -> 10450 (-5% from peak)
  const equityCurve: EquityPoint[] = [
    { time: 'T0', timestamp: 1000, equity: 10000, benchmarkEquity: 10000, drawdownPct: 0, pnl: 0, cumulativePnl: 0, cashBalance: 10000, unrealizedPnl: 0 },
    { time: 'T1', timestamp: 2000, equity: 10500, benchmarkEquity: 10500, drawdownPct: 0, pnl: 500, cumulativePnl: 500, cashBalance: 10500, unrealizedPnl: 0 },
    { time: 'T2', timestamp: 3000, equity: 9450, benchmarkEquity: 9450, drawdownPct: 10, pnl: -1050, cumulativePnl: -550, cashBalance: 9450, unrealizedPnl: 0 },
    { time: 'T3', timestamp: 4000, equity: 11000, benchmarkEquity: 11000, drawdownPct: 0, pnl: 1550, cumulativePnl: 1000, cashBalance: 11000, unrealizedPnl: 0 },
    { time: 'T4', timestamp: 5000, equity: 10450, benchmarkEquity: 10450, drawdownPct: 5, pnl: -550, cumulativePnl: 450, cashBalance: 10450, unrealizedPnl: 0 }
  ];

  const trades: Trade[] = [
    { id: 'T1', symbol: 'BTC/USDT', fees: 10, slippageBps: 2, notional: 10000, pnlPercent: 5, funding: 0, netPnl: 488, entryPrice: 100, exitPrice: 105, size: 100, side: 'LONG', timestamp: 'T0', exitTimestamp: 'T1', durationBars: 1, mfe: 5, mae: 0, exitReason: 'TAKE_PROFIT', pnl: 500 },
    { id: 'T2', symbol: 'BTC/USDT', fees: 10, slippageBps: 2, notional: 10500, pnlPercent: -10, funding: 0, netPnl: -1062, entryPrice: 105, exitPrice: 94.5, size: 100, side: 'LONG', timestamp: 'T1', exitTimestamp: 'T2', durationBars: 1, mfe: 0, mae: -10, exitReason: 'STOP_LOSS', pnl: -1050 },
    { id: 'T3', symbol: 'BTC/USDT', fees: 10, slippageBps: 2, notional: 9450, pnlPercent: 16.4, funding: 0, netPnl: 1538, entryPrice: 94.5, exitPrice: 110, size: 100, side: 'LONG', timestamp: 'T2', exitTimestamp: 'T3', durationBars: 1, mfe: 16.4, mae: 0, exitReason: 'TAKE_PROFIT', pnl: 1550 },
    { id: 'T4', symbol: 'BTC/USDT', fees: 10, slippageBps: 2, notional: 11000, pnlPercent: -5, funding: 0, netPnl: -562, entryPrice: 110, exitPrice: 104.5, size: 100, side: 'LONG', timestamp: 'T3', exitTimestamp: 'T4', durationBars: 1, mfe: 0, mae: -5, exitReason: 'SIGNAL_REVERSAL', pnl: -550 },
  ];

  const metrics = AnalyticsEngine.calculateMetrics(equityCurve, trades, 10000, 40, 0, 8);

  // 1. Max Drawdown Audit:
  // Peak = 10500, Trough = 9450 -> DD = (10500 - 9450) / 10500 = 1050 / 10500 = 10.0%
  assert(Math.abs(metrics.maxDrawdown - 10.0) < 0.05, `Max Drawdown exact: expected 10.0%, got ${metrics.maxDrawdown}%`);

  // 2. Win Rate Audit:
  // 2 winning trades (T1, T3), 2 losing trades (T2, T4) -> 2 / 4 = 50.0%
  assert(metrics.winRate === 50.0, `Win rate exact: expected 50.0%, got ${metrics.winRate}%`);

  // 3. Profit Factor Audit:
  // Gross Profit = 500 + 1550 = 2050
  // Gross Loss = 1050 + 550 = 1600
  // Profit Factor = 2050 / 1600 = 1.28
  const expectedPf = Number((2050 / 1600).toFixed(2));
  assert(Math.abs(metrics.profitFactor - expectedPf) < 0.05, `Profit Factor exact: expected ${expectedPf}, got ${metrics.profitFactor}`);

  // 4. Total Return Audit:
  // (10450 - 10000) / 10000 = 4.5%
  assert(metrics.totalReturn === 4.5, `Total Return exact: expected 4.5%, got ${metrics.totalReturn}%`);

  return result;
}
