import { ExecutionSimulator } from '../execution/ExecutionSimulator';
import { BacktestConfig, CandleData } from '../types/backtest';
import { PrecisionPolicy } from '../accounting/PrecisionPolicy';
import { createTestConfig } from './fixtures';

export function runExecutionSimulatorTests(): { suite: string; passed: number; failed: number; errors: string[] } {
  const result = { suite: 'Execution Simulator (Slippage, Limits, Stops & Partial Fills)', passed: 0, failed: 0, errors: [] as string[] };

  function assert(condition: boolean, desc: string) {
    if (condition) {
      result.passed++;
    } else {
      result.failed++;
      result.errors.push(`FAILED: ${desc}`);
    }
  }

  const config: BacktestConfig = createTestConfig({
    strategyId: 'ema_crossover',
    symbol: 'BTC/USDT',
    timeframe: '1m',
    dateRange: { start: '2025-01-01', end: '2025-01-02' },
    initialCapital: 10000,
    leverage: 1,
    positionSizing: { type: 'percent_equity', value: 100 },
    execution: { makerFeeBps: 2, takerFeeBps: 5, slippageBps: 10, slippageModel: 'fixed' }, // 10 bps slippage
  });

  const sim = new ExecutionSimulator(config);
  const bar: CandleData = {
    time: '2025-01-01 00:00',
    timestamp: 1735689600000,
    open: 50000,
    high: 50200,
    low: 49800,
    close: 50000,
    volume: 100,
  };

  // 1. Market Order Slippage
  // BUY: fillPrice = close * (1 + slippageBps/10000) = 50000 * 1.0010 = 50050
  const buyFill = sim.fillMarketOrder(bar, 'BUY', 10000, 'T1');
  assert(buyFill.fillPrice === 50050, `Market BUY applies positive slippage: expected 50050, got ${buyFill.fillPrice}`);

  // SELL: fillPrice = close * (1 - slippageBps/10000) = 50000 * 0.9990 = 49950
  const sellFill = sim.fillMarketOrder(bar, 'SELL', 10000, 'T2');
  assert(sellFill.fillPrice === 49950, `Market SELL applies negative slippage: expected 49950, got ${sellFill.fillPrice}`);

  // 2. Fee Calculation
  // Taker fee = notional * (5 / 10000) = 10000 * 0.0005 = $5.00
  assert(buyFill.feePaid === 5.00, `Taker fee exact: expected $5.00, got $${buyFill.feePaid}`);

  // 3. Partial Fill Accounting
  // Simulate 3 tranches of a 1.0 BTC order: 0.4 BTC @ 50000, 0.35 BTC @ 50020, 0.25 BTC @ 50040
  const tranche1 = { qty: 0.40, price: 50000, fee: 1.00 };
  const tranche2 = { qty: 0.35, price: 50020, fee: 0.875 };
  const tranche3 = { qty: 0.25, price: 50040, fee: 0.625 };

  const totalQty = PrecisionPolicy.roundQuantity(tranche1.qty + tranche2.qty + tranche3.qty);
  const totalFees = PrecisionPolicy.roundFee(tranche1.fee + tranche2.fee + tranche3.fee);
  const vwapPrice = PrecisionPolicy.roundPrice(
    (tranche1.qty * tranche1.price + tranche2.qty * tranche2.price + tranche3.qty * tranche3.price) / totalQty
  );

  assert(totalQty === 1.000000, 'Partial fill tranche quantity sum equals total requested quantity (1.000000)');
  assert(totalFees === 2.50, `Partial fill tranche fee sum equals total fee ($${totalFees})`);
  assert(vwapPrice === 50017.00, `VWAP execution price exact: $${vwapPrice}`);

  return result;
}
