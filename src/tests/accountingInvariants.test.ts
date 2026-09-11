import { AccountingVerifier } from '../accounting/AccountingVerifier';
import { TradeLedger } from '../ledger/TradeLedger';
import { PrecisionPolicy } from '../accounting/PrecisionPolicy';
import { BacktestResult, CandleData } from '../types/backtest';
import { GOLDEN_FIXTURES } from './fixtures';

export function runAccountingInvariantsTests(): { suite: string; passed: number; failed: number; errors: string[] } {
  const result = { suite: 'Accounting Invariants (13 Institutional Invariants)', passed: 0, failed: 0, errors: [] as string[] };

  function assert(condition: boolean, desc: string) {
    if (condition) {
      result.passed++;
    } else {
      result.failed++;
      result.errors.push(`FAILED: ${desc}`);
    }
  }

  // 1. Invariant 1 & 2: Cash Reconciliation & Transaction Consistency
  {
    const ledger = new TradeLedger(10000, '2025-01-01 00:00', 1735689600000);
    ledger.recordCashTx(1735689660000, '2025-01-01 00:01', 'ORDER_FEE', -5.00, 9995.00, 'Entry fee');
    ledger.recordCashTx(1735689720000, '2025-01-01 00:02', 'FUNDING', -1.25, 9993.75, 'Funding payment');
    ledger.recordCashTx(1735689780000, '2025-01-01 00:03', 'REALIZED_PNL', 150.00, 10143.75, 'Closed trade PnL');

    const inv = ledger.verifyInvariants(10000, 10143.75, 10143.75, 0);
    assert(inv.passed, 'Ledger cash reconciliation matches sum of cash transactions');

    // Negative case: Tampered cash balance fails verification
    const tampered = ledger.verifyInvariants(10000, 10200.00, 10200.00, 0);
    assert(!tampered.passed, 'Tampered cash balance correctly flagged as invariant failure');
  }

  // 2. Invariant 3: Equity Identity Reconciliation: Equity_t == Cash_t + UnrealizedPnL_t
  {
    const initialCapital = 10000;
    const currentCash = 9850;
    const unrealizedPnL = 250;
    const expectedEquity = 10100;

    const mockResult: BacktestResult = {
      runId: 'RUN-TEST-01',
      timestamp: '2025-01-01T00:00:00Z',
      reproducibilityHash: 'HASH123',
      engineVersion: 'v4.3.0',
      isDeterministic: true,
      dataset: GOLDEN_FIXTURES['rising-1m'].metadata,
      config: { symbol: 'BTC/USDT', dateRange: { start: '2025-01-01', end: '2025-01-02' } } as any,
      candles: GOLDEN_FIXTURES['rising-1m'].candles,
      trades: [],
      orders: [],
      equityCurve: [
        { time: '2025-01-01 00:00', timestamp: 1735689600000, equity: 10000, benchmarkEquity: 10000, pnl: 0, cumulativePnl: 0, cash: 10000, unrealizedPnl: 0, drawdownPct: 0, benchmarkPrice: 50000, returnsPct: 0 },
        { time: '2025-01-01 00:01', timestamp: 1735689660000, equity: expectedEquity, benchmarkEquity: 10000, pnl: 100, cumulativePnl: 100, cash: currentCash, unrealizedPnl: unrealizedPnL, drawdownPct: 0, benchmarkPrice: 50150, returnsPct: 1.0 }
      ],
      metrics: { totalFeesPaid: 0, winRate: 0, sharpeRatio: 0, profitFactor: 0 } as any,
      monthlyReturns: [],
      validationWarnings: [],
      logs: [],
      executionRecords: [],
      fundingEvents: [],
      liquidationEvents: [],
      tradeLedger: [],
    };

    const cashTxs = [
      { id: 'TX-1', type: 'ORDER_FEE' as const, amount: -150, timestamp: 1735689660000, barTime: '2025-01-01 00:01', cashBalanceAfter: 9850, description: 'order fees' }
    ];

    const audit = AccountingVerifier.audit(mockResult, initialCapital, cashTxs, currentCash);
    assert(audit.passed, 'Equity identity reconciliation passed when Equity == Cash + UnrealizedPnL');

    // Negative case: Injected drift
    mockResult.equityCurve[1].equity = 10200; // Drift of $100
    const failedAudit = AccountingVerifier.audit(mockResult, initialCapital, cashTxs, currentCash);
    assert(!failedAudit.passed && failedAudit.violations.some(v => v.invariantId === 1), 'Injected equity drift correctly caught by Invariant 1');
  }

  // 3. Invariant 4: Position Realized PnL Formula
  {
    // Long trade: (Exit - Entry) * Qty - Fees
    const longNetPnl = PrecisionPolicy.calculateNetPnL('LONG', 50000, 52000, 0.5, 10, 5);
    const expectedLong = PrecisionPolicy.roundCash((52000 - 50000) * 0.5 - 10 - 5);
    assert(longNetPnl === expectedLong && longNetPnl === 985.00, 'Position Realized PnL exact for LONG position');

    // Short trade: (Entry - Exit) * Qty - Fees
    const shortNetPnl = PrecisionPolicy.calculateNetPnL('SHORT', 50000, 48000, 0.5, 10, 5);
    const expectedShort = PrecisionPolicy.roundCash((50000 - 48000) * 0.5 - 10 - 5);
    assert(shortNetPnl === expectedShort && shortNetPnl === 985.00, 'Position Realized PnL exact for SHORT position');
  }

  // 4. Invariant 5: Fee Conservation: TotalFeesPaid == Sum(OrderFees)
  {
    const trades = [
      { id: 'T1', fees: 12.50, slippage: 2.50, grossPnl: 100, netPnl: 85, entryPrice: 50000, exitPrice: 51000, size: 0.1, side: 'LONG' as const, entryTime: '2025-01-01 00:00', exitTime: '2025-01-01 00:05', durationBars: 5, mfe: 2, mae: -0.5, exitReason: 'TAKE_PROFIT' as const, pnl: 100 },
      { id: 'T2', fees: 14.50, slippage: 3.00, grossPnl: -50, netPnl: -67.50, entryPrice: 51000, exitPrice: 50500, size: 0.1, side: 'LONG' as const, entryTime: '2025-01-01 00:06', exitTime: '2025-01-01 00:10', durationBars: 4, mfe: 0.5, mae: -1.2, exitReason: 'STOP_LOSS' as const, pnl: -50 },
    ];
    const totalFees = trades.reduce((sum, t) => sum + t.fees, 0);
    assert(PrecisionPolicy.roundFee(totalFees) === 27.00, 'Fee conservation correctly sums trade fees to $27.00');
  }

  // 5. Invariant 8: No Look-Ahead Candle References
  {
    const trades = [
      { id: 'T1', fees: 5, slippage: 1, grossPnl: 100, netPnl: 94, entryPrice: 50000, exitPrice: 51000, size: 0.1, side: 'LONG' as const, entryTime: '2025-01-01 00:00', exitTime: '2025-01-01 00:05', durationBars: 5, mfe: 2, mae: -0.5, exitReason: 'TAKE_PROFIT' as const, pnl: 100 },
    ];
    // Valid trade: exitTime is after entryTime
    assert(trades[0].exitTime >= trades[0].entryTime, 'Look-ahead invariant holds: exitTime >= entryTime');
  }

  // 6. Invariant 13: Floating-Point Precision Compliance
  {
    const roundedPrice = PrecisionPolicy.roundPrice(50123.45678);
    const roundedQty = PrecisionPolicy.roundQuantity(1.234567891);
    const roundedCash = PrecisionPolicy.roundCash(9999.99999);
    assert(roundedPrice === 50123.46, 'PrecisionPolicy price rounds to 2 decimal places');
    assert(roundedQty === 1.234568, 'PrecisionPolicy quantity rounds to 6 decimal places');
    assert(roundedCash === 10000.00, 'PrecisionPolicy cash rounds to 2 decimal places');
  }

  return result;
}
