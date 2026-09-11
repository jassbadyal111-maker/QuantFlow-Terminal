import { BacktestError } from './BacktestErrors';
import { nearlyEqual } from './Precision';
import { Trade, Position, EquityPoint } from '../types/backtest';
import { ExecutionRecord, FundingEvent, LiquidationEvent } from '../types/marketData';
import { TradeLedger } from '../ledger/TradeLedger';

export interface AccountingSummary {
  startingCapital: number;
  realizedPnl: number;
  unrealizedPnl: number;
  fees: number;
  funding: number;
  executionCosts: number;
  liquidationLosses: number;
  otherCashFlows: number;
  endingCash: number;
  endingEquity: number;
}

export interface AccountingCheckResult { passed: boolean; errors: BacktestError[]; }

export function reconcileAccounting(
  summary: AccountingSummary,
  executions: ExecutionRecord[],
  trades: Trade[],
  fundingEvents: FundingEvent[],
  liquidationEvents: LiquidationEvent[],
  equityCurve: EquityPoint[],
  ledger: TradeLedger,
  context: { symbol?: string; timestamp?: number | string } = {},
): AccountingCheckResult {
  const errors: BacktestError[] = [];
  const execFees = executions.reduce((sum, e) => sum + e.fee, 0);
  const tradeFees = trades.reduce((sum, t) => sum + t.fees, 0);
  const funding = fundingEvents.reduce((sum, e) => sum + e.payment, 0);
  const liquidationLosses = liquidationEvents.reduce((sum, e) => sum + e.loss, 0);

  if (!nearlyEqual(execFees, summary.fees, 1e-6)) {
    errors.push(new BacktestError('ACCOUNTING_INVARIANT_FAILED', 'Execution fee total does not reconcile to accounting summary.', {
      ...context, expected: summary.fees, actual: execFees, context: { executionFeeTotal: execFees },
    }));
  }
  if (!nearlyEqual(tradeFees, summary.fees, 1e-6)) {
    errors.push(new BacktestError('ACCOUNTING_INVARIANT_FAILED', 'Trade fee total does not reconcile to accounting summary.', {
      ...context, expected: summary.fees, actual: tradeFees, context: { tradeFeeTotal: tradeFees },
    }));
  }
  if (!nearlyEqual(funding, summary.funding, 1e-6)) {
    errors.push(new BacktestError('ACCOUNTING_INVARIANT_FAILED', 'Funding event total does not reconcile to accounting summary.', {
      ...context, expected: summary.funding, actual: funding,
    }));
  }
  if (liquidationEvents.length > 0 && liquidationLosses < 0) {
    errors.push(new BacktestError('LIQUIDATION_ERROR', 'Liquidation losses must be non-negative in the audit summary.', {
      ...context, expected: '>= 0', actual: liquidationLosses,
    }));
  }

  const endingEquation = summary.startingCapital + summary.realizedPnl + summary.unrealizedPnl
    - summary.fees - summary.funding - summary.executionCosts - summary.liquidationLosses + summary.otherCashFlows;
  if (!nearlyEqual(endingEquation, summary.endingEquity, 1e-6)) {
    errors.push(new BacktestError('ACCOUNTING_INVARIANT_FAILED', 'Starting capital + P&L - costs + cash flows does not equal ending equity.', {
      ...context, expected: endingEquation, actual: summary.endingEquity,
      context: { summary, difference: endingEquation - summary.endingEquity },
    }));
  }

  const ledgerEnding = ledger.getLedgerEndingBalance();
  if (!nearlyEqual(ledgerEnding, summary.endingCash, 1e-6)) {
    errors.push(new BacktestError('ACCOUNTING_INVARIANT_FAILED', 'Ledger ending balance does not equal ending portfolio cash.', {
      ...context, expected: summary.endingCash, actual: ledgerEnding,
    }));
  }

  if (equityCurve.length > 0) {
    const last = equityCurve[equityCurve.length - 1];
    const stateEquity = (last.cashBalance ?? summary.endingCash) + (last.unrealizedPnl ?? 0);
    if (!nearlyEqual(last.equity, stateEquity, 1e-6)) {
      errors.push(new BacktestError('ACCOUNTING_INVARIANT_FAILED', 'Final equity checkpoint does not equal portfolio state.', {
        timestamp: last.timestamp, symbol: context.symbol, expected: stateEquity, actual: last.equity,
      }));
    }
  }

  return { passed: errors.length === 0, errors };
}

export function assertPositionState(position: Position | null, context: { timestamp?: number|string; symbol?: string } = {}): void {
  if (!position) return;
  if (!Number.isFinite(position.size) || position.size < -1e-8) {
    throw new BacktestError('ACCOUNTING_INVARIANT_FAILED', 'Position quantity is negative or non-finite.', {
      ...context, expected: 'finite quantity >= 0', actual: position.size, context: { position },
    });
  }
  if (!Number.isFinite(position.unrealizedPnl) || !Number.isFinite(position.currentPrice)) {
    throw new BacktestError('ACCOUNTING_INVARIANT_FAILED', 'Position mark-to-market contains a non-finite value.', {
      ...context, expected: 'finite unrealized P&L and price', actual: { unrealizedPnl: position.unrealizedPnl, currentPrice: position.currentPrice },
    });
  }
}
