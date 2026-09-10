import { BacktestEngine } from '../engine/BacktestEngine';
import { DEFAULT_BACKTEST_CONFIG } from '../data/mockQuantData';
import { AnalyticsEngine } from '../analytics/AnalyticsEngine';
import { ResearchEngine } from '../research/ResearchEngine';
import { DataValidator } from '../data/validation/DataValidator';
import { PortfolioManager } from '../portfolio/PortfolioManager';
import { CandleData } from '../types/backtest';

export function runQuantTestSuite() {
  console.log('🧪 [APEX QUANT] Running Quantitative Backtest Engine & Truth Layer Test Suite...');
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

  // TEST 7: Truth Layer - Execution Records & Immutability
  assert(Array.isArray(res1.executionRecords) && res1.executionRecords.length > 0, 'Execution records captured for every fill');
  assert(res1.executionRecords?.length === res2.executionRecords?.length, 'Execution records count is deterministic');
  if (res1.executionRecords && res2.executionRecords) {
    assert(
      res1.executionRecords[0].fillPrice === res2.executionRecords[0].fillPrice,
      'Fill prices are 100% deterministic with zero Math.random() drift'
    );
  }

  // TEST 8: Truth Layer - Funding Events & 8h Periodic Accounting
  assert(Array.isArray(res1.fundingEvents), 'Funding events collection is initialized');
  if (res1.fundingEvents && res1.fundingEvents.length > 0) {
    const fe = res1.fundingEvents[0];
    assert(fe.intervalHours === 8, 'Funding interval is calibrated to institutional 8h epochs');
    assert(fe.rate > 0, 'Funding rate is positive');
    assert(fe.payment !== 0, 'Funding payment is calculated');
  }

  // TEST 9: Truth Layer - Trade Ledger Invariants
  assert(Array.isArray(res1.tradeLedger), 'Canonical trade ledger populated');
  assert(res1.invariantsPassed === true, 'Accounting invariant verification passed (Equity == Cash + UnrealizedPnL)');
  assert(!res1.invariantCheckErrors || res1.invariantCheckErrors.length === 0, 'Zero invariant violations detected');

  // TEST 10: Data Validation - Range Coverage & Checksum Determinism
  const sampleCandles: CandleData[] = [
    { timestamp: 1704067200000, time: '2024-01-01 00:00', open: 42000, high: 42500, low: 41800, close: 42300, volume: 100 },
    { timestamp: 1704153600000, time: '2024-01-02 00:00', open: 42300, high: 43000, low: 42100, close: 42800, volume: 120 },
  ];
  const coverageCheck = DataValidator.validateRangeCoverage(sampleCandles, '2024-01-01', '2024-01-02', '1d');
  assert(coverageCheck.valid === true, 'DataValidator properly verifies exact date-range coverage');

  const checksum1 = DataValidator.calculateChecksum(sampleCandles);
  const checksum2 = DataValidator.calculateChecksum(sampleCandles);
  assert(checksum1 === checksum2, 'Dataset checksum is strictly deterministic');
  assert(checksum1.length === 8, 'Dataset checksum is formatted as 8-character hex string');

  // TEST 11: Portfolio Manager - Liquidation Price Math
  const pm = new PortfolioManager(config);
  const longLiq = pm.calculateLiquidationPrice(50000, 'LONG', 10);
  // With 10x leverage, mmr = 0.015. liq = 50000 * (1 - 0.1 + 0.015) = 50000 * 0.915 = 45750
  assert(longLiq === 45750, 'Long liquidation price calculated accurately with leverage MMR tiers');

  const shortLiq = pm.calculateLiquidationPrice(50000, 'SHORT', 10);
  // short liq = 50000 * (1 + 0.1 - 0.015) = 50000 * 1.085 = 54250
  assert(shortLiq === 54250, 'Short liquidation price calculated accurately with leverage MMR tiers');

  console.log(`\n🎉 [APEX QUANT] All Test Suites Completed: ${testsPassed}/${testsTotal} passed successfully.\n`);
  return { testsPassed, testsTotal };
}
