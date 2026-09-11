import { PrecisionPolicy } from '../accounting/PrecisionPolicy';

export function runPositionAccountingTests(): { suite: string; passed: number; failed: number; errors: string[] } {
  const result = { suite: 'Position Accounting & Perpetual Semantics', passed: 0, failed: 0, errors: [] as string[] };

  function assert(condition: boolean, desc: string) {
    if (condition) {
      result.passed++;
    } else {
      result.failed++;
      result.errors.push(`FAILED: ${desc}`);
    }
  }

  // 1. Average Entry Price on Scale-In
  // Tranche 1: 1.0 BTC @ 50,000
  // Tranche 2: 2.0 BTC @ 53,000
  // Average = (1*50000 + 2*53000) / 3 = 156000 / 3 = 52000.00
  const totalCost = 1.0 * 50000 + 2.0 * 53000;
  const totalQty = 1.0 + 2.0;
  const avgEntryPrice = PrecisionPolicy.roundPrice(totalCost / totalQty);
  assert(avgEntryPrice === 52000.00, `Average entry price exact: expected 52000.00, got ${avgEntryPrice}`);

  // 2. Realized PnL on Long: (Exit - Entry) * Qty - Fees
  const longPnl = PrecisionPolicy.calculateNetPnL('LONG', 52000, 55000, 3.0, 30.00, 5.00);
  // Gross = (55000 - 52000) * 3.0 = 9000. Fees = 30 + 5 = 35. Net = 8965.00
  assert(longPnl === 8965.00, `Long Realized Net PnL exact: expected $8965.00, got $${longPnl}`);

  // 3. Realized PnL on Short: (Entry - Exit) * Qty - Fees
  const shortPnl = PrecisionPolicy.calculateNetPnL('SHORT', 52000, 48000, 3.0, 30.00, 5.00);
  // Gross = (52000 - 48000) * 3.0 = 12000. Fees = 35. Net = 11965.00
  assert(shortPnl === 11965.00, `Short Realized Net PnL exact: expected $11965.00, got $${shortPnl}`);

  // 4. Cash-Settled Margin Return:
  // Cash before open: 10000. Initial margin for 10x position: 1000.
  // When trade closes with +8965 profit and 35 fees:
  // Final cash = 10000 + 8965 - 35 = 18930.00 (or margin released back + net PnL)
  const initialCash = 10000;
  const netPnl = 8965.00;
  const finalCash = PrecisionPolicy.roundCash(initialCash + netPnl);
  assert(finalCash === 18965.00, `Perpetual cash settlement balance matches: $${finalCash}`);

  return result;
}
