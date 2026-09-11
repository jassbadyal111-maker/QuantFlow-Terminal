import { BacktestError } from './BacktestErrors';
import { nearlyEqual } from './Precision';
import { BacktestConfig, BacktestResult, EquityPoint, Trade } from '../types/backtest';
import { ExecutionRecord, FundingEvent, LiquidationEvent } from '../types/marketData';
import { TradeLedger } from '../ledger/TradeLedger';
import { DataValidator } from '../data/validation/DataValidator';

export interface IntegrityAudit {
  passed: boolean;
  errors: BacktestError[];
}

export function auditBacktestIntegrity(
  config: BacktestConfig,
  candles: BacktestResult['candles'],
  metadata: BacktestResult['dataset'],
  executions: ExecutionRecord[],
  trades: Trade[],
  equityCurve: EquityPoint[],
  fundingEvents: FundingEvent[],
  liquidationEvents: LiquidationEvent[],
  ledger: TradeLedger,
  cash: number,
  initialCapital: number,
): IntegrityAudit {
  const errors: BacktestError[] = [];
  const report = DataValidator.validate(candles, config.timeframe, {
    requestedStart: config.dateRange.start,
    requestedEnd: config.dateRange.end,
  });
  if (!report.valid || metadata.validationStatus === 'FAILED') {
    errors.push(new BacktestError('DATASET_INVALID', 'Historical dataset failed strict validation.', {
      symbol: config.symbol,
      expected: { valid: true, source: 'EXCHANGE_API' },
      actual: { report, metadata },
      context: { stage: 'dataset-validation' },
    }));
  }

  if (metadata.source === 'EXCHANGE_API' && metadata.isSynthetic) {
    errors.push(new BacktestError('DATASET_INVALID', 'Exchange historical dataset is marked synthetic.', {
      symbol: config.symbol,
      actual: metadata,
      context: { stage: 'dataset-validation' },
    }));
  }

  const fundingMode = config.execution.fundingMode || (metadata.source === 'EXCHANGE_API' ? 'HISTORICAL' : 'SIMULATED');
  if (metadata.marketType === 'PERPETUAL' && fundingMode === 'HISTORICAL' && fundingEvents.some((e) => e.rate === config.execution.fundingRate8hBps / 10000)) {
    errors.push(new BacktestError('FUNDING_DATA_MISSING', 'Historical mode must not source funding from the legacy config rate.', {
      symbol: config.symbol,
      expected: 'funding rates from historical provider records',
      actual: config.execution.fundingRate8hBps,
      context: { fundingMode },
    }));
  }

  for (const execution of executions) {
    if (!Number.isFinite(execution.filledQuantity) || execution.filledQuantity < 0) {
      errors.push(new BacktestError('EXECUTION_ERROR', 'Execution contains invalid fill quantity.', {
        timestamp: execution.timestamp,
        symbol: execution.symbol,
        expected: 'finite quantity >= 0',
        actual: execution.filledQuantity,
        context: { executionId: execution.executionId, orderId: execution.orderId },
      }));
    }
  }

  if (equityCurve.length > 0) {
    const last = equityCurve[equityCurve.length - 1];
    const expected = (last.cashBalance ?? cash) + (last.unrealizedPnl ?? 0);
    if (!nearlyEqual(last.equity, expected, 1e-6)) {
      errors.push(new BacktestError('ACCOUNTING_INVARIANT_FAILED', 'Ending equity does not reconcile to cash plus unrealized P&L.', {
        timestamp: last.timestamp,
        symbol: config.symbol,
        expected,
        actual: last.equity,
        context: { stage: 'ending-equity' },
      }));
    }
    for (const point of equityCurve) {
      const pointExpected = (point.cashBalance ?? 0) + (point.unrealizedPnl ?? 0);
      if (!nearlyEqual(point.equity, pointExpected, 1e-6)) {
        errors.push(new BacktestError('ACCOUNTING_INVARIANT_FAILED', 'Equity curve point does not reconcile to its portfolio state.', {
          timestamp: point.timestamp,
          symbol: config.symbol,
          expected: pointExpected,
          actual: point.equity,
          context: { stage: 'equity-curve' },
        }));
        break;
      }
    }
  }

  const ledgerBalance = ledger.getCashTransactions().reduce((sum, tx) => sum + tx.amount, 0);
  if (!nearlyEqual(ledgerBalance, cash, 1e-6)) {
    errors.push(new BacktestError('ACCOUNTING_INVARIANT_FAILED', 'TradeLedger ending balance differs from portfolio cash.', {
      expected: cash,
      actual: ledgerBalance,
      symbol: config.symbol,
      context: { stage: 'ledger-reconciliation' },
    }));
  }

  const executionByOrder = new Map<string, number>();
  for (const execution of executions) executionByOrder.set(execution.orderId, (executionByOrder.get(execution.orderId) || 0) + 1);
  for (const trade of trades) {
    if (trade.entryOrderId && !executionByOrder.has(trade.entryOrderId)) {
      errors.push(new BacktestError('ACCOUNTING_INVARIANT_FAILED', 'Trade entry references an order without an execution.', {
        symbol: trade.symbol,
        context: { tradeId: trade.id, orderId: trade.entryOrderId },
      }));
    }
    if (trade.exitOrderId && !executionByOrder.has(trade.exitOrderId)) {
      errors.push(new BacktestError('ACCOUNTING_INVARIANT_FAILED', 'Trade exit references an order without an execution.', {
        symbol: trade.symbol,
        context: { tradeId: trade.id, orderId: trade.exitOrderId },
      }));
    }
  }

  if (fundingEvents.length !== ledger.getCashTransactions().filter((tx) => tx.type === 'FUNDING').length) {
    errors.push(new BacktestError('ACCOUNTING_INVARIANT_FAILED', 'Funding event count does not match funding ledger transaction count.', {
      symbol: config.symbol,
      expected: fundingEvents.length,
      actual: ledger.getCashTransactions().filter((tx) => tx.type === 'FUNDING').length,
      context: { stage: 'funding-reconciliation' },
    }));
  }

  if (liquidationEvents.length > 0 && !trades.some((trade) => trade.exitReason === 'LIQUIDATION')) {
    errors.push(new BacktestError('LIQUIDATION_ERROR', 'Liquidation event exists without a corresponding closed liquidation trade.', {
      symbol: config.symbol,
      context: { stage: 'liquidation-reconciliation' },
    }));
  }

  if (!Number.isFinite(cash) || !Number.isFinite(initialCapital)) {
    errors.push(new BacktestError('ACCOUNTING_INVARIANT_FAILED', 'Cash or starting capital is non-finite.', {
      symbol: config.symbol,
      expected: 'finite values',
      actual: { cash, initialCapital },
    }));
  }

  return { passed: errors.length === 0, errors };
}
