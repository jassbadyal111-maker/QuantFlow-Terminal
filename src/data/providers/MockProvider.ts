import { CandleData } from '../../types/backtest';
import { DatasetMetadata } from '../../types/dataset';
import { FundingRateRecord, MarketTrade, OpenInterestRecord } from '../../types/marketData';
import { DataValidator } from '../validation/DataValidator';
import { MockFundingProvider } from './FundingProvider';

export function createRng(seed: number = 42) {
  let s = Math.floor(seed);
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class MockProvider {
  public id = 'mock-demo-provider';
  public name = 'ApexQuant Deterministic Synthetic Kline Generator';
  public exchange = 'MOCK' as const;
  public isSynthetic = true;

  private fundingProvider = new MockFundingProvider();

  public async getCandles(
    symbol: string,
    timeframe: string,
    startDate: string,
    endDate: string,
    options?: { seed?: number; count?: number }
  ): Promise<{ candles: CandleData[]; metadata: DatasetMetadata }> {
    const seed = options?.seed ?? 20250228;
    const rng = createRng(seed);

    let basePrice = 50000;
    if (symbol.includes('ETH')) basePrice = 2850;
    else if (symbol.includes('SOL')) basePrice = 175;
    else if (symbol.includes('AVAX')) basePrice = 32;
    else if (symbol.includes('DOGE')) basePrice = 0.18;

    const intervalMinutes = DataValidator.getTimeframeMinutes(timeframe);
    const intervalMs = intervalMinutes * 60 * 1000;

    let startTs: number;
    let endTs: number;

    if (startDate && endDate) {
      startTs = new Date(startDate.includes('T') ? startDate : `${startDate}T00:00:00Z`).getTime();
      endTs = new Date(endDate.includes('T') ? endDate : `${endDate}T23:59:59Z`).getTime();
    } else {
      endTs = new Date(endDate || '2025-02-28T00:00:00Z').getTime();
      const fallbackCount = options?.count ?? 180;
      startTs = endTs - fallbackCount * intervalMs;
    }

    const calculatedBars = Math.max(30, Math.floor((endTs - startTs) / intervalMs) + 1);
    const barCount = calculatedBars;

    const candles: CandleData[] = [];
    let currentClose = basePrice;

    for (let i = 0; i < barCount; i++) {
      const barTs = startTs + i * intervalMs;
      const dateObj = new Date(barTs);
      const timeStr = dateObj.toISOString().slice(0, 16).replace('T', ' ');

      // Deterministic quant process: Sine wave macro cycle + Volatility clustering + Normal noise
      const cycle = Math.sin((i / barCount) * Math.PI * 3.5);
      const trendDrift = cycle * 0.0012 + 0.0004;
      const volCluster = 0.012 + 0.018 * Math.abs(Math.cos(i * 0.15));
      const u1 = rng();
      const u2 = rng();
      const z = Math.sqrt(-2.0 * Math.log(u1 || 0.0001)) * Math.cos(2.0 * Math.PI * u2);
      const barReturn = trendDrift + z * volCluster;

      const open = currentClose;
      let close = open * (1 + barReturn);
      close = Math.max(close, open * 0.7);

      const highWick = Math.abs(close - open) * (0.4 + rng() * 0.9) + open * 0.003;
      const lowWick = Math.abs(close - open) * (0.4 + rng() * 0.9) + open * 0.003;
      const high = Math.max(open, close) + highWick;
      const low = Math.min(open, close) - lowWick;

      const baseVolume = 350 * (basePrice > 1000 ? 1 : 20);
      const volume = Math.round(baseVolume * (0.6 + rng() * 1.8 + Math.abs(barReturn) * 35));

      currentClose = close;

      candles.push({
        time: timeStr,
        timestamp: barTs,
        open: Number(open.toFixed(basePrice < 10 ? 4 : 2)),
        high: Number(high.toFixed(basePrice < 10 ? 4 : 2)),
        low: Number(low.toFixed(basePrice < 10 ? 4 : 2)),
        close: Number(close.toFixed(basePrice < 10 ? 4 : 2)),
        volume,
      });
    }

    const validation = DataValidator.validate(candles, timeframe);
    const checksum = DataValidator.calculateChecksum(candles);

    const metadata: DatasetMetadata = {
      id: `synthetic-${symbol.replace('/', '_')}-${timeframe}-${seed}`,
      datasetId: `MOCK-${symbol}-${timeframe}-${seed}`,
      name: `${symbol} ${timeframe} Synthetic Quantitative Test Feed`,
      exchange: 'MOCK',
      marketType: 'PERPETUAL',
      source: 'DEMO_SYNTHETIC',
      providerName: 'ApexQuant Deterministic Synthetic Feed',
      symbol,
      timeframe,
      dateRange: {
        start: candles[0]?.time || startDate,
        end: candles[candles.length - 1]?.time || endDate,
      },
      startTime: candles[0]?.time || startDate,
      endTime: candles[candles.length - 1]?.time || endDate,
      totalBars: candles.length,
      rowCount: candles.length,
      downloadedAt: new Date().toISOString(),
      checksum,
      schemaVersion: 'v2.1',
      validationStatus: validation.valid ? 'PASSED' : 'WARNINGS',
      missingBarsCount: validation.statistics.missingIntervals,
      missingIntervals: validation.statistics.missingIntervals,
      duplicateCount: validation.statistics.duplicateRows,
      duplicateRows: validation.statistics.duplicateRows,
      minPrice: validation.statistics.minPrice,
      maxPrice: validation.statistics.maxPrice,
      minVolume: validation.statistics.minVolume,
      maxVolume: validation.statistics.maxVolume,
      timezone: 'UTC',
      seed,
      version: 'v4.3-demo',
      isSynthetic: true,
      validationNotes: validation.warnings,
    };

    return { candles, metadata };
  }

  public async getFundingRates(symbol: string): Promise<FundingRateRecord[]> {
    return this.fundingProvider.getHistoricalFundingRates(symbol);
  }

  public async getOpenInterest(symbol: string): Promise<OpenInterestRecord> {
    const now = Date.now();
    return {
      timestamp: now,
      time: new Date(now).toISOString().slice(0, 16).replace('T', ' '),
      symbol,
      openInterest: 12500,
    };
  }

  public async getTrades(symbol: string, limit: number = 50): Promise<MarketTrade[]> {
    const trades: MarketTrade[] = [];
    const now = Date.now();
    const rng = createRng(1337);
    let price = symbol.includes('BTC') ? 50000 : symbol.includes('ETH') ? 2850 : 175;

    for (let i = 0; i < limit; i++) {
      trades.push({
        id: `MOCK-TRD-${100000 + i}`,
        timestamp: now - (limit - i) * 1500,
        price: Number((price * (1 + (rng() - 0.5) * 0.002)).toFixed(2)),
        quantity: Number((0.05 + rng() * 1.5).toFixed(4)),
        side: rng() > 0.48 ? 'BUY' : 'SELL',
      });
    }

    return trades;
  }
}
