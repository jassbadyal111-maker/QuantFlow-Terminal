import { TradeLedgerEntry, FundingEvent } from '../types/marketData';
import { Trade } from '../types/backtest';
import { PrecisionPolicy } from '../accounting/PrecisionPolicy';

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
      amount: PrecisionPolicy.roundCash(initialCapital),
      cashBalanceAfter: PrecisionPolicy.roundCash(initialCapital),
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
      eventType: trade.exitReason === 'LIQUIDATION' ? 'LIQUIDATION' : 'TRADE',
      tradeId: trade.id,
      symbol: trade.symbol,
      side: trade.side,
      entryTimestamp: trade.timestamp,
      exitTimestamp: trade.exitTimestamp || trade.timestamp,
      entryPrice: PrecisionPolicy.roundPrice(trade.entryPrice),
      exitPrice: PrecisionPolicy.roundPrice(trade.exitPrice),
      quantity: PrecisionPolicy.roundQuantity(trade.size),
      notional: PrecisionPolicy.roundCash(trade.notional),
      grossPnl: PrecisionPolicy.roundPnl(trade.pnl),
      fees: PrecisionPolicy.roundFee(trade.fees),
      funding: PrecisionPolicy.roundFunding(trade.funding || 0),
      slippage: Number(((trade.notional * (trade.slippageBps || 0)) / 10000).toFixed(2)),
      netPnl: PrecisionPolicy.roundPnl(trade.netPnl),
      mfe: trade.mfe,
      mae: trade.mae,
      durationBars: trade.durationBars,
      exitReason: trade.exitReason,
      entryExecutionIds,
      exitExecutionIds,
    };

    this.entries.push(Object.freeze(ledgerEntry));
  }

  public recordFundingEntry(fundingEvent: FundingEvent): void {
    const entry: TradeLedgerEntry = {
      eventType: 'FUNDING',
      tradeId: `FUND-${fundingEvent.timestamp}`,
      symbol: fundingEvent.symbol,
      side: fundingEvent.side,
      entryTimestamp: fundingEvent.time,
      exitTimestamp: fundingEvent.time,
      entryPrice: PrecisionPolicy.roundPrice(fundingEvent.markPrice),
      exitPrice: PrecisionPolicy.roundPrice(fundingEvent.markPrice),
      quantity: 0,
      notional: PrecisionPolicy.roundCash(fundingEvent.positionNotional),
      grossPnl: 0,
      fees: 0,
      funding: PrecisionPolicy.roundFunding(fundingEvent.payment),
      slippage: 0,
      netPnl: PrecisionPolicy.roundPnl(-fundingEvent.payment),
      mfe: 0,
      mae: 0,
      durationBars: 0,
      exitReason: 'FUNDING',
      entryExecutionIds: [],
      exitExecutionIds: [],
    };
    this.entries.push(Object.freeze(entry));
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
      amount: PrecisionPolicy.roundCash(amount),
      cashBalanceAfter: PrecisionPolicy.roundCash(cashBalanceAfter),
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
    const expectedEquity = PrecisionPolicy.roundCash(currentCash + unrealizedPnl);
    const actualEquity = PrecisionPolicy.roundCash(currentEquity);
    if (!PrecisionPolicy.areMonetaryEqual(actualEquity, expectedEquity, 0.05)) {
      errors.push(
        `Invariant violation: Equity ($${actualEquity}) != Cash ($${currentCash}) + UnrealizedPnL ($${unrealizedPnl}) [Diff: $${(actualEquity - expectedEquity).toFixed(2)}]`
      );
    }

    // Invariant 2: Net Cash Reconciles to Initial + All Cash Movements
    let netTxSum = initialCapital;
    for (const tx of this.cashTransactions) {
      if (tx.type !== 'DEPOSIT') {
        netTxSum += tx.amount;
      }
    }
    const roundedNetTxSum = PrecisionPolicy.roundCash(netTxSum);
    const roundedCurrentCash = PrecisionPolicy.roundCash(currentCash);
    if (!PrecisionPolicy.areMonetaryEqual(roundedCurrentCash, roundedNetTxSum, 0.05)) {
      errors.push(
        `Invariant violation: Portfolio Cash ($${roundedCurrentCash}) does not reconcile with starting capital + ledger cash movements ($${roundedNetTxSum}) [Diff: $${(roundedCurrentCash - roundedNetTxSum).toFixed(2)}]`
      );
    }

    return {
      passed: errors.length === 0,
      errors,
    };
  }
}
