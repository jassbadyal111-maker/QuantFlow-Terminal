import { CandleData, Trade } from '../types/backtest';
import { FundingRateRecord } from '../types/marketData';

export interface ExitDecision {
  shouldExit: boolean;
  price: number;
  reason: Trade['exitReason'];
}

/** Conservative OHLC policy: gap-through exits fill at open; when both stop and target are touched, stop wins. */
export function resolveConservativeExit(
  bar: CandleData,
  side: 'LONG' | 'SHORT',
  stopLossPrice?: number,
  takeProfitPrice?: number,
): ExitDecision {
  if (side === 'LONG') {
    if (stopLossPrice !== undefined && bar.open <= stopLossPrice) return { shouldExit: true, price: bar.open, reason: 'STOP_LOSS' };
    if (stopLossPrice !== undefined && bar.low <= stopLossPrice) return { shouldExit: true, price: stopLossPrice, reason: 'STOP_LOSS' };
    if (takeProfitPrice !== undefined && bar.open >= takeProfitPrice) return { shouldExit: true, price: bar.open, reason: 'TAKE_PROFIT' };
    if (takeProfitPrice !== undefined && bar.high >= takeProfitPrice) return { shouldExit: true, price: takeProfitPrice, reason: 'TAKE_PROFIT' };
  } else {
    if (stopLossPrice !== undefined && bar.open >= stopLossPrice) return { shouldExit: true, price: bar.open, reason: 'STOP_LOSS' };
    if (stopLossPrice !== undefined && bar.high >= stopLossPrice) return { shouldExit: true, price: stopLossPrice, reason: 'STOP_LOSS' };
    if (takeProfitPrice !== undefined && bar.open <= takeProfitPrice) return { shouldExit: true, price: bar.open, reason: 'TAKE_PROFIT' };
    if (takeProfitPrice !== undefined && bar.low <= takeProfitPrice) return { shouldExit: true, price: takeProfitPrice, reason: 'TAKE_PROFIT' };
  }
  return { shouldExit: false, price: bar.close, reason: 'SIGNAL_REVERSAL' };
}

export function fundingBetween(
  fundingRates: FundingRateRecord[],
  previousTimestamp: number,
  currentTimestamp: number,
): FundingRateRecord[] {
  return fundingRates
    .filter((rate) => rate.timestamp > previousTimestamp && rate.timestamp <= currentTimestamp)
    .sort((a, b) => a.timestamp - b.timestamp);
}
