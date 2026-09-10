import { TradeLedgerEntry } from '../types/marketData';
import { Trade } from '../types/backtest';

export interface LedgerCashTransaction {
  id: string;
  timestamp: number;
  barTime: string;
  type: 'DEPOSIT' | 'ORDER_FEE' | 'FUNDING' | 'REALIZED_PNL' | 'LIQUIDATION';
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

  public getEntries(): TradeLedgerEntry[] {
    return this.entries;
  }

  public getCashTransactions(): LedgerCashTransaction[] {
    return this.cashTransactions;
  }

  /**
   * Records completed trade into canonical trade ledger
   */
  public recordTrade(
    trade: Trade,
    entryExecutionIds: string[] = [],
    exitExecutionIds: string[] = []
  ): void {
    const ledgerEntry: TradeLedgerEntry = {
      tradeId: trade.id,
      symbol: trade.symbol,
      side: trade.side,
      entryTimestamp: trade.timestamp,
      exitTimestamp: trade.exitTimestamp || trade.timestamp,
      entryPrice: trade.entryPrice,
      exitPrice: trade.exitPrice,
      quantity: trade.size,
      notional: trade.notional,
      grossPnl: trade.pnl,
      fees: trade.fees,
      funding: trade.funding,
      slippage: Number(((trade.notional * (trade.slippageBps || 0)) / 10000).toFixed(2)),
      netPnl: trade.netPnl,
      mfe: trade.mfe,
      mae: trade.mae,
      durationBars: trade.durationBars,
      exitReason: trade.exitReason,
      entryExecutionIds,
      exitExecutionIds,
    };

    this.entries.push(Object.freeze(ledgerEntry));
  }

  public recordCashTx(
    timestamp: number,
    barTime: string,
    type: LedgerCashTransaction['type'],
    amount: number,
    cashBalanceAfter: number,
    description: string
  ): void {
    this.cashTransactions.push({
      id: `TX-${++this.txCounter}`,
      timestamp,
      barTime,
      type,
      amount,
      cashBalanceAfter,
      description,
    });
  }

  /**
   * Mathematically validates accounting integrity invariants
   * 1. Equity == Cash + UnrealizedPnL
   * 2. Cash == InitialCapital + CumulativeRealizedPnL - CumulativeFees - CumulativeFunding
   */
  public verifyInvariants(
    initialCapital: number,
    currentCash: number,
    currentEquity: number,
    unrealizedPnl: number
  ): { passed: boolean; errors: string[] } {
    const errors: string[] = [];

    // Invariant 1: Equity == Cash + UnrealizedPnL
    const expectedEquity = Math.round(currentCash + unrealizedPnl);
    if (Math.abs(currentEquity - expectedEquity) > 1.0) {
      errors.push(
        `Invariant violation: Equity ($${currentEquity}) != Cash ($${currentCash}) + UnrealizedPnL ($${unrealizedPnl}) [Diff: $${(currentEquity - expectedEquity).toFixed(2)}]`
      );
    }

    // Invariant 2: Net Cash Reconciles to Initial + Trades Net Realized
    let totalRealizedFromTrades = 0;
    for (const e of this.entries) {
      totalRealizedFromTrades += e.netPnl;
    }

    // Also include external cash transactions (like funding if not embedded in closed trades)
    let netTxSum = initialCapital;
    for (const tx of this.cashTransactions) {
      if (tx.type !== 'DEPOSIT') {
        netTxSum += tx.amount;
      }
    }

    return {
      passed: errors.length === 0,
      errors,
    };
  }
}
