import { TradeLedgerEntry } from '../types/marketData';
import { Trade } from '../types/backtest';

export interface LedgerCashTransaction {
  id: string;
  timestamp: number;
  barTime: string;
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'ORDER_FEE' | 'FUNDING' | 'REALIZED_PNL' | 'LIQUIDATION' | 'OTHER_CASH_FLOW';
  amount: number;
  cashBalanceAfter: number;
  description: string;
}

export class TradeLedger {
  private entries: TradeLedgerEntry[] = [];
  private cashTransactions: LedgerCashTransaction[] = [];
  private txCounter = 0;

  constructor(initialCapital: number, startTime: string, startTimestamp: number) {
    this.cashTransactions.push({
      id: `TX-${++this.txCounter}`,
      timestamp: startTimestamp,
      barTime: startTime,
      type: 'DEPOSIT',
      amount: initialCapital,
      cashBalanceAfter: initialCapital,
      description: `Initial equity allocation: $${initialCapital.toLocaleString()}`,
    });
  }

  public getEntries(): TradeLedgerEntry[] { return this.entries; }
  public getCashTransactions(): LedgerCashTransaction[] { return this.cashTransactions; }

  public recordTrade(trade: Trade, entryExecutionIds: string[] = [], exitExecutionIds: string[] = []): void {
    const slippage = Number(((trade.notional * (trade.slippageBps || 0)) / 10000).toFixed(8));
    this.entries.push(Object.freeze({
      tradeId: trade.id, symbol: trade.symbol, side: trade.side,
      entryTimestamp: trade.timestamp, exitTimestamp: trade.exitTimestamp || trade.timestamp,
      entryPrice: trade.entryPrice, exitPrice: trade.exitPrice, quantity: trade.size,
      notional: trade.notional, grossPnl: trade.pnl, fees: trade.fees, funding: trade.funding,
      slippage, netPnl: trade.netPnl, mfe: trade.mfe, mae: trade.mae, durationBars: trade.durationBars,
      exitReason: trade.exitReason, entryExecutionIds, exitExecutionIds,
    }));
  }

  public recordCashTx(timestamp: number, barTime: string, type: LedgerCashTransaction['type'], amount: number, cashBalanceAfter: number, description: string): void {
    const previous = this.cashTransactions[this.cashTransactions.length - 1];
    const expectedAfter = previous.cashBalanceAfter + amount;
    if (Math.abs(expectedAfter - cashBalanceAfter) > 1e-8) {
      throw new Error(`Ledger cash transition mismatch at ${barTime}: expected ${expectedAfter}, actual ${cashBalanceAfter}`);
    }
    this.cashTransactions.push({ id: `TX-${++this.txCounter}`, timestamp, barTime, type, amount, cashBalanceAfter, description });
  }

  public getLedgerEndingBalance(): number {
    return this.cashTransactions[this.cashTransactions.length - 1]?.cashBalanceAfter ?? 0;
  }

  public verifyInvariants(initialCapital: number, currentCash: number, currentEquity: number, unrealizedPnl: number): { passed: boolean; errors: string[] } {
    const errors: string[] = [];
    const ledgerBalance = this.getLedgerEndingBalance();
    const expectedEquity = currentCash + unrealizedPnl;
    if (Math.abs(currentEquity - expectedEquity) > 1e-6) {
      errors.push(`Equity reconciliation failed: expected=${expectedEquity}, actual=${currentEquity}, difference=${currentEquity - expectedEquity}`);
    }
    if (Math.abs(ledgerBalance - currentCash) > 1e-6) {
      errors.push(`Ledger cash reconciliation failed: expected=${currentCash}, actual=${ledgerBalance}, difference=${ledgerBalance - currentCash}`);
    }
    const movementSum = this.cashTransactions.reduce((sum, tx) => sum + tx.amount, 0);
    if (Math.abs(movementSum - ledgerBalance) > 1e-6) {
      errors.push(`Ledger movement sum failed: expected=${ledgerBalance}, actual=${movementSum}, difference=${movementSum - ledgerBalance}`);
    }
    if (Math.abs((initialCapital + (movementSum - initialCapital)) - currentCash) > 1e-6) {
      errors.push(`Initial-capital cash identity failed: initial=${initialCapital}, ending=${currentCash}, movements=${movementSum - initialCapital}`);
    }
    return { passed: errors.length === 0, errors };
  }
}
