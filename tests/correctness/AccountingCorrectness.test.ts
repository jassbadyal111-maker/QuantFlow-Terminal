import { TradeLedger } from '../../src/ledger/TradeLedger';
import { auditExecutionsHaveLedgerCashEffects, auditFunding, auditLiquidations, assertEquityPoint, assertPositionQuantity, reconcileLedgerCash } from '../../src/core/AccountingInvariants';
import { ExecutionRecord, FundingEvent, LiquidationEvent } from '../../src/types/marketData';
import { EquityPoint, Position } from '../../src/types/backtest';

describe('accounting invariants', () => {
  it('reconciles ledger cash to all explicit movements', () => {
    const ledger = new TradeLedger(100000, '2025-01-01 00:00', 1735689600000);
    ledger.recordCashTx(1735689660000, '2025-01-01 00:01', 'ORDER_FEE', -10, 99990, 'fee');
    ledger.recordCashTx(1735689720000, '2025-01-01 00:02', 'FUNDING', -5, 99985, 'funding');
    expect(reconcileLedgerCash(100000, ledger, 99985)).toHaveLength(0);
  });

  it('catches corrupted equity', () => {
    const point: EquityPoint = { time: '2025-01-01 00:00', equity: 999, benchmarkEquity: 1000, drawdownPct: 0, pnl: 0, cumulativePnl: 0 };
    expect(() => assertEquityPoint(point, 1000, 0, { timestamp: 1735689600000, symbol: 'BTCUSDT' })).toThrow('Equity point');
  });

  it('rejects impossible position quantities', () => {
    const position = { symbol: 'BTCUSDT', side: 'LONG', size: -1, notional: 100, entryPrice: 100, currentPrice: 100, leverage: 1, marginMode: 'CROSS', initialMargin: 100, maintenanceMargin: 1, unrealizedPnl: 0, liquidationPrice: 0 } as Position;
    expect(() => assertPositionQuantity(position, { symbol: 'BTCUSDT', timestamp: 1 })).toThrow('non-negative');
  });

  it('requires funding event and ledger count to reconcile', () => {
    const ledger = new TradeLedger(100000, '2025-01-01 00:00', 1735689600000);
    const event: FundingEvent = {
      timestamp: 1735689600000, time: '2025-01-01 00:00', symbol: 'BTCUSDT', rate: 0.0001, markPrice: 100, intervalHours: 8,
      positionNotional: 10000, payment: 1, side: 'LONG', cashBefore: 100000, cashAfter: 99999,
    };
    expect(auditFunding([event], ledger).length).toBe(1);
  });

  it('requires liquidation to have an execution', () => {
    const ledger = new TradeLedger(100000, '2025-01-01 00:00', 1735689600000);
    const event: LiquidationEvent = {
      timestamp: 1735689600000, time: '2025-01-01 00:00', symbol: 'BTCUSDT', side: 'LONG', quantity: 1,
      liquidationPrice: 90, bankruptcyPrice: 89, maintenanceMargin: 100, loss: 10, fee: 1, reason: 'test',
    };
    expect(auditLiquidations([event], [], ledger, []).length).toBe(1);
  });

  it('reconciles execution fees to fee ledger movements', () => {
    const ledger = new TradeLedger(100000, '2025-01-01 00:00', 1735689600000);
    ledger.recordCashTx(1735689600000, '2025-01-01 00:00', 'ORDER_FEE', -5, 99995, 'fee');
    const execution: ExecutionRecord = {
      executionId: 'E1', orderId: 'O1', timestamp: '2025-01-01 00:00', symbol: 'BTCUSDT', side: 'BUY', orderType: 'MARKET',
      requestedPrice: 100, fillPrice: 100, requestedQuantity: 1, filledQuantity: 1, remainingQuantity: 0, fee: 5, feeRate: 0.0005,
      slippage: 0, latency: 0, liquiditySource: 'TAKER', status: 'FILLED'
    };
    expect(auditExecutionsHaveLedgerCashEffects([execution], ledger)).toHaveLength(0);
  });
});
