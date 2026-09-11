import { CandleData } from '../../src/types/backtest';
import { FundingRateRecord } from '../../src/types/marketData';

export function makeCandle(timestamp: number, open: number, high: number, low: number, close: number, volume = 1000): CandleData {
  return {
    timestamp,
    time: new Date(timestamp).toISOString().slice(0, 16).replace('T', ' '),
    open,
    high,
    low,
    close,
    volume,
  };
}

export function makeFlatSeries(count: number, startTimestamp = 1735689600000, price = 100): CandleData[] {
  return Array.from({ length: count }, (_, i) => makeCandle(startTimestamp + i * 60_000, price, price, price, price));
}

export function makeFunding(timestamp: number, rate: number, symbol = 'BTCUSDT'): FundingRateRecord {
  return {
    timestamp,
    time: new Date(timestamp).toISOString().slice(0, 16).replace('T', ' '),
    symbol,
    rate,
    intervalHours: 8,
    markPrice: 100,
  };
}
