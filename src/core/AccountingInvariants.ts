import { TradeLedger } from '../ledger/TradeLedger';
import { ExecutionRecord, FundingEvent, LiquidationEvent } from '../types/marketData';
import { EquityPoint, Position, Trade } from '../types/backtest';
import { ACCOUNTING_PRECISION, nearlyEqual } from './Precision';
import { BacktestError } from './BacktestErrors';

export interface InvariantContext {
  timestamp?: number | string;
  symbol?: string;
  position?: Position | null;
  event?: string;
}

export interface AccountingAudit {
  passed: boolean;
  errors: BacktestError[];
}

function violation(message: string, expected: unknown, actual: unknown, context: InvariantContext = {}): BacktestError {
  const difference = typeof expected === 'number' && typeof actual === 'number' ? expected - actual : undefined;
  return new BacktestError('ACCOUNTING_INVARIANT_FAILED', message, {
    timestamp: context.timestamp,
    symbol: context.symbol,
    expected,
    actual,
    context: { position: context.position, event: context.event, difference },
  });
}

export function assertPositionQuantity(position: Position | null, context: InvariantContext = {}): void {
  if (!position) return;
  if (!Number.isFinite(position.size) || position.size < -ACCOUNTING_PRECISION.tolerance) {
    throw violation('Position quantity must be finite and non-negative.', 0, position.size, context);
  }
}

export function assertEquityPoint(point: EquityPoint, cash: number, unrealizedPnl: number, context: InvariantContext = {}): void {
  const expected = cash + unrealizedPnl;
  if (!nearlyEqual(point.equity, expected, Math.max(ACCOUNTING_PRECISION.tolerance, 1e-6))) {
    throw violation('Equity point does not reconcile to portfolio cash plus unrealized P&L.', expected, point.equity, context);
  }
}

export function auditExecutionLinks(executions: ExecutionRecord[], trades: Trade[]): BacktestError[] {
  const errors: BacktestError[] = [];
  const executionIds = new Set(executions.map((e) => e.executionId));
  for (const trade of trades) {
    const entryIds = (trade.entryOrderId ? executions.filter((e) => e.orderId === trade.entryOrderId).map((e) => e.executionId) : []);
    const exitIds = (trade.exitOrderId ? executions.filter((e) => e.orderId === trade.exitOrderId).map((e) => e.executionId) : []);
    if (trade.entryOrderId && entryIds.some((id) => !executionIds.has(id))) {
      errors.push(violation('Closed trade references an invalid entry execution.', 'existing execution', entryIds, { symbol: trade.symbol, event: trade.id }));
    }
    if (trade.exitOrderId && exitIds.some((id) => !executionIds.has(id))) {
      errors.push(violation('Closed trade references an invalid exit execution.', 'existing execution', exitIds, { symbol: trade.symbol, event: trade.id }));
    }
  }
  return errors;
}

export function auditFunding(events: FundingEvent[], ledger: TradeLedger): BacktestError[] {
  const errors: BacktestError[] = [];
  const fundingTx = ledger.getCashTransactions().filter((tx) => tx.type === 'FUNDING');
  if (events.length !== fundingTx.length) {
    errors.push(violation('Every funding event must have exactly one funding ledger transaction.', events.length, fundingTx.length, { event: 'FUNDING' }));
  }
  for (const event of events) {
    const tx = fundingTx.find((candidate) => candidate.timestamp === event.timestamp);
    if (!tx) continue;
    const expectedCashAfter = Number((event.cashBefore - event.payment).toFixed(8));
    if (!nearlyEqual(event.cashAfter, expectedCashAfter, 1e-6) || !nearlyEqual(tx.cashBalanceAfter, event.cashAfter, 1e-6)) {
      errors.push(violation('Funding cash movement and ledger balance disagree.', expectedCashAfter, tx.cashBalanceAfter, {
        timestamp: event.timestamp,
        symbol: event.symbol,
        event: 'FUNDING',
      }));
    }
  }
  return errors;
}

export function auditLiquidations(events: LiquidationEvent[], trades: Trade[], ledger: TradeLedger, executions: ExecutionRecord[]): BacktestError[] {
  const errors: BacktestError[] = [];
  const liquidationTrades = trades.filter((trade) => trade.exitReason === 'LIQUIDATION');
  const liquidationTx = ledger.getCashTransactions().filter((tx) => tx.type === 'LIQUIDATION');
  if (events.length !== liquidationTrades.length || events.length !== liquidationTx.length) {
    errors.push(violation('Liquidation must produce event, trade and ledger records.', events.length, {
      events: events.length,
      trades: liquidationTrades.length,
      ledger: liquidationTx.length,
    }, { event: 'LIQUIDATION' }));
  }
  for (const event of events) {
    const hasExec = executions.some((exec) => exec.timestamp === event.time && exec.symbol === event.symbol && exec.filledQuantity > 0);
    if (!hasExec) {
      errors.push(violation('Liquidation event must have a corresponding filled execution record.', 'filled execution', false, {
        timestamp: event.timestamp,
        symbol: event.symbol,
        event: 'LIQUIDATION',
      }));
    }
  }
  return errors;
}

export function reconcileLedgerCash(initialCapital: number, ledger: TradeLedger, currentCash: number): BacktestError[] {
  const expected = ledger.getCashTransactions().reduce((balance, tx) => balance + tx.amount, 0);
  if (!nearlyEqual(expected, currentCash, 1e-6)) {
    return [violation('TradeLedger cash transactions do not reconcile to portfolio cash.', currentCash, expected, { event: 'LEDGER' })];
  }
  if (!nearlyEqual(expected, initialCapital + ledger.getCashTransactions().slice(1).reduce((sum, tx) => sum + tx.amount, 0), 1e-6)) {
    return [violation('Cash ledger does not reconcile to initial capital plus all explicit cash movements.', initialCapital, expected, { event: 'LEDGER' })];
  }
  return [];
}

export function auditExecutionsHaveLedgerCashEffects(executions: ExecutionRecord[], ledger: TradeLedger): BacktestError[] {
  const feeTx = ledger.getCashTransactions().filter((tx) => tx.type === 'ORDER_FEE');
  const executionFeeTotal = executions.reduce((sum, execution) => sum + execution.fee, 0);
  const ledgerFeeTotal = -feeTx.reduce((sum, tx) => sum + tx.amount, 0);
  return nearlyEqual(executionFeeTotal, ledgerFeeTotal, 1e-6)
    ? []
    : [violation('Execution fees must reconcile to fee ledger movements.', executionFeeTotal, ledgerFeeTotal, { event: 'EXECUTION_FEE' })];
}
