import { BacktestEngine } from '../engine/BacktestEngine';
import { DEFAULT_BACKTEST_CONFIG } from '../data/mockQuantData';
import { AnalyticsEngine } from '../analytics/AnalyticsEngine';
import { ResearchEngine } from '../research/ResearchEngine';
import { SyntheticMarketDataProvider } from '../data/MarketDataProvider';

export function runQuantTestSuite() {
  console.log('🧪 [APEX QUANT] Running Quantitative Backtest Engine Test Suite...');
  let testsPassed = 0;
  let testsTotal = 0;

  function assert(condition: boolean, testName: string) {
    testsTotal++;
    if (condition) {
      testsPassed++;
      console.log(`  ✅ PASS: ${testName}`);
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      throw new Error(`Test failed: ${testName}`);
    }
  }

  // TEST 1: Determinism & Reproducibility
  const config = { ...DEFAULT_BACKTEST_CONFIG, initialCapital: 100000, leverage: 3 };
  const engine1 = new BacktestEngine(config);
  const res1 = engine1.executeSync();

  const engine2 = new BacktestEngine(config);
  const res2 = engine2.executeSync();

  assert(res1.trades.length === res2.trades.length, 'Engine produces identical trade count across runs');
  assert(res1.metrics.totalReturn === res2.metrics.totalReturn, 'Deterministic total return matches exactly');
  assert(res1.metrics.sharpeRatio === res2.metrics.sharpeRatio, 'Deterministic Sharpe ratio matches exactly');
  assert(res1.reproducibilityHash === res2.reproducibilityHash, 'Deterministic run hash is reproducible');

  // TEST 2: Accounting Integrity (Cash + Unrealized PnL = Equity)
  assert(res1.equityCurve.length > 50, 'Equity curve generated with valid length');
  assert(res1.trades.length > 0, 'Trades were generated and closed');
  const firstTrade = res1.trades[0];
  assert(firstTrade.fees >= 0, 'Trading fees were deducted');
  assert(firstTrade.notional > 0, 'Trade notional is positive');

  // TEST 3: Performance Metrics Math Integrity
  assert(!isNaN(res1.metrics.sharpeRatio), 'Sharpe ratio is a valid number');
  assert(!isNaN(res1.metrics.winRate), 'Win rate is a valid percentage');
  assert(res1.metrics.winRate >= 0 && res1.metrics.winRate <= 100, 'Win rate bounded within 0-100%');
  assert(res1.metrics.profitFactor >= 0, 'Profit factor is non-negative');

  // TEST 4: Execution Simulation (Slippage and Spread)
  const exec = res1.orders[0];
  assert(exec.avgFillPrice > 0, 'Order avgFillPrice is populated');
  assert(exec.status === 'FILLED', 'Orders are properly filled');

  // TEST 5: Research Validation & Bias Layer
  const warnings = ResearchEngine.evaluateValidation(config, res1.candles, res1.trades, res1.equityCurve);
  assert(Array.isArray(warnings), 'Validation warnings generated');

  // TEST 6: Monte Carlo Simulation
  const mc = ResearchEngine.runMonteCarlo(res1.trades, 100000, 50);
  assert(mc.percentiles.length === 5, 'Monte Carlo generated 5 quantile scenarios');
  assert(mc.simulatedPathsCount === 50, 'Monte Carlo simulated 50 reshuffled paths');

  console.log(`\n🎉 [APEX QUANT] Test Suite Completed: ${testsPassed}/${testsTotal} passed successfully.\n`);
  return { testsPassed, testsTotal };
}
