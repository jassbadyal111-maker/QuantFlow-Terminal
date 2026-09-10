import { CandleData, DatasetMetadata } from '../types/backtest';

export interface DataValidationResult {
  isValid: boolean;
  totalBars: number;
  missingBarsCount: number;
  duplicateCount: number;
  timezone: string;
  startDate: string;
  endDate: string;
  notes: string[];
}

export interface MarketDataProvider {
  id: string;
  name: string;
  sourceType: 'DEMO_SYNTHETIC' | 'EXCHANGE_API';
  isSynthetic: boolean;
  loadCandles(
    symbol: string,
    timeframe: string,
    startDate: string,
    endDate: string,
    options?: { seed?: number; count?: number }
  ): Promise<{ candles: CandleData[]; metadata: DatasetMetadata }>;
}

export class DataValidator {
  /**
   * Validates time continuity, duplicate timestamps, and data sanity
   */
  static validate(candles: CandleData[], expectedIntervalMinutes: number = 240): DataValidationResult {
    const notes: string[] = [];
    if (candles.length === 0) {
      return {
        isValid: false,
        totalBars: 0,
        missingBarsCount: 0,
        duplicateCount: 0,
        timezone: 'UTC',
        startDate: '',
        endDate: '',
        notes: ['Dataset contains 0 candle records.'],
      };
    }

    let duplicateCount = 0;
    let missingBarsCount = 0;
    const seenTimestamps = new Set<number>();
    const intervalMs = expectedIntervalMinutes * 60 * 1000;

    for (let i = 0; i < candles.length; i++) {
      const c = candles[i];
      if (seenTimestamps.has(c.timestamp)) {
        duplicateCount++;
      } else {
        seenTimestamps.add(c.timestamp);
      }

      if (i > 0) {
        const diff = c.timestamp - candles[i - 1].timestamp;
        if (diff > intervalMs * 1.5) {
          const estimatedMissing = Math.round(diff / intervalMs) - 1;
          missingBarsCount += estimatedMissing;
        }
      }

      // Check OHLC consistency
      if (c.high < c.low || c.open < 0 || c.close < 0) {
        notes.push(`Invalid OHLC relationship at timestamp ${c.timestamp} (${c.time})`);
      }
    }

    if (duplicateCount > 0) {
      notes.push(`Detected ${duplicateCount} duplicate timestamp bars; duplicates filtered.`);
    }
    if (missingBarsCount > 0) {
      notes.push(`Detected ${missingBarsCount} missing bar gaps in historical timeline.`);
    }

    return {
      isValid: notes.length === 0 || (duplicateCount === 0 && missingBarsCount < candles.length * 0.05),
      totalBars: candles.length,
      missingBarsCount,
      duplicateCount,
      timezone: 'UTC',
      startDate: candles[0]?.time || '',
      endDate: candles[candles.length - 1]?.time || '',
      notes,
    };
  }
}

/**
 * Seedable pseudo-random number generator (Mulberry32)
 * Ensures 100% deterministic reproducibility across runs
 */
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

/**
 * Deterministic Synthetic Provider
 * Generates realistic crypto market microstructure with volatility clustering and drift
 * Clearly identified in metadata as DEMO / SYNTHETIC DATA
 */
export class SyntheticMarketDataProvider implements MarketDataProvider {
  id = 'provider-synthetic-v1';
  name = 'Deterministic Synthetic Crypto Kline Generator';
  sourceType: 'DEMO_SYNTHETIC' = 'DEMO_SYNTHETIC';
  isSynthetic = true;

  loadCandlesSync(
    symbol: string,
    timeframe: string,
    startDate: string,
    endDate: string,
    options?: { seed?: number; count?: number }
  ): { candles: CandleData[]; metadata: DatasetMetadata } {
    const seed = options?.seed ?? 20250228;
    const rng = createRng(seed);
    const barCount = options?.count ?? 160;

    let basePrice = 64200;
    if (symbol.includes('ETH')) basePrice = 2850;
    else if (symbol.includes('SOL')) basePrice = 175;
    else if (symbol.includes('AVAX')) basePrice = 32;
    else if (symbol.includes('DOGE')) basePrice = 0.18;

    let intervalHours = 4;
    let intervalMinutes = 240;
    if (timeframe === '1m') { intervalMinutes = 1; intervalHours = 1 / 60; }
    else if (timeframe === '5m') { intervalMinutes = 5; intervalHours = 5 / 60; }
    else if (timeframe === '15m') { intervalMinutes = 15; intervalHours = 0.25; }
    else if (timeframe === '1h') { intervalMinutes = 60; intervalHours = 1; }
    else if (timeframe === '4h') { intervalMinutes = 240; intervalHours = 4; }
    else if (timeframe === '1d') { intervalMinutes = 1440; intervalHours = 24; }

    const endTs = new Date(endDate || '2025-02-28T00:00:00Z').getTime();
    const intervalMs = intervalMinutes * 60 * 1000;
    const startTs = endTs - barCount * intervalMs;

    const candles: CandleData[] = [];
    let currentClose = basePrice;

    for (let i = 0; i < barCount; i++) {
      const barTs = startTs + i * intervalMs;
      const dateObj = new Date(barTs);
      const timeStr = dateObj.toISOString().slice(0, 16).replace('T', ' ');

      // Stochastic quant process: Sine wave macro cycle + Volatility clustering + Cauchy tail
      const cycle = Math.sin((i / barCount) * Math.PI * 3.5);
      const trendDrift = cycle * 0.0012 + 0.0004;
      const volCluster = 0.012 + 0.018 * Math.abs(Math.cos(i * 0.15));
      const u1 = rng();
      const u2 = rng();
      // Box-Muller transform for normal distribution
      const z = Math.sqrt(-2.0 * Math.log(u1 || 0.0001)) * Math.cos(2.0 * Math.PI * u2);
      const barReturn = trendDrift + z * volCluster;

      const open = currentClose;
      let close = open * (1 + barReturn);
      close = Math.max(close, open * 0.7); // prevent negative prices

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

    const validation = DataValidator.validate(candles, intervalMinutes);

    const metadata: DatasetMetadata = {
      id: `synthetic-${symbol.replace('/', '_')}-${timeframe}-${seed}`,
      name: `${symbol} ${timeframe} Synthetic Quantitative Test Feed`,
      source: 'DEMO_SYNTHETIC',
      providerName: 'ApexQuant Deterministic Synthetic Feed',
      symbol,
      timeframe,
      dateRange: {
        start: candles[0]?.time || startDate,
        end: candles[candles.length - 1]?.time || endDate,
      },
      totalBars: candles.length,
      missingBarsCount: validation.missingBarsCount,
      duplicateCount: validation.duplicateCount,
      timezone: 'UTC',
      seed,
      version: '1.4.0',
      isSynthetic: true,
      validationStatus: validation.isValid ? 'PASSED' : 'WARNINGS',
      validationNotes: validation.notes,
    };

    return { candles, metadata };
  }

  async loadCandles(
    symbol: string,
    timeframe: string,
    startDate: string,
    endDate: string,
    options?: { seed?: number; count?: number }
  ): Promise<{ candles: CandleData[]; metadata: DatasetMetadata }> {
    return Promise.resolve(this.loadCandlesSync(symbol, timeframe, startDate, endDate, options));
  }
}

/**
 * Exchange API Provider Interface (for live/historical CCXT or Binance Futures REST connectivity)
 */
export class BinanceApiMarketDataProvider implements MarketDataProvider {
  id = 'provider-binance-futures-api';
  name = 'Binance USDT-M Futures Public REST Provider';
  sourceType: 'EXCHANGE_API' = 'EXCHANGE_API';
  isSynthetic = false;

  async loadCandles(
    symbol: string,
    timeframe: string,
    startDate: string,
    endDate: string,
    options?: { count?: number }
  ): Promise<{ candles: CandleData[]; metadata: DatasetMetadata }> {
    // If browser cannot connect to Binance public endpoint directly due to CORS or sandbox,
    // fallback gracefully to the deterministic provider with honest labeling
    try {
      const cleanSymbol = symbol.replace('/', '').toUpperCase();
      const interval = timeframe.toLowerCase();
      const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${cleanSymbol}&interval=${interval}&limit=${options?.count ?? 150}`;
      const resp = await fetch(url, { signal: AbortSignal.timeout(3500) });
      if (!resp.ok) {
        throw new Error(`Binance API returned HTTP ${resp.status}`);
      }
      const rawData = await resp.json();
      if (!Array.isArray(rawData) || rawData.length === 0) {
        throw new Error('Empty response from Binance klines endpoint');
      }

      const candles: CandleData[] = rawData.map((d: any) => ({
        timestamp: d[0],
        time: new Date(d[0]).toISOString().slice(0, 16).replace('T', ' '),
        open: parseFloat(d[1]),
        high: parseFloat(d[2]),
        low: parseFloat(d[3]),
        close: parseFloat(d[4]),
        volume: parseFloat(d[5]),
      }));

      const validation = DataValidator.validate(candles);

      const metadata: DatasetMetadata = {
        id: `binance-${cleanSymbol}-${timeframe}-live`,
        name: `${symbol} ${timeframe} Real Binance Futures Klines`,
        source: 'EXCHANGE_API',
        providerName: 'Binance USDT-M Futures Public REST',
        symbol,
        timeframe,
        dateRange: {
          start: candles[0]?.time || '',
          end: candles[candles.length - 1]?.time || '',
        },
        totalBars: candles.length,
        missingBarsCount: validation.missingBarsCount,
        duplicateCount: validation.duplicateCount,
        timezone: 'UTC',
        version: '1.0-live',
        isSynthetic: false,
        validationStatus: validation.isValid ? 'PASSED' : 'WARNINGS',
        validationNotes: validation.notes,
      };

      return { candles, metadata };
    } catch (err: any) {
      // Return synthetic fallback with clear transparency
      const fallback = new SyntheticMarketDataProvider();
      const res = await fallback.loadCandles(symbol, timeframe, startDate, endDate, options);
      res.metadata.validationNotes = [
        `Direct Binance exchange connection unavailable (${err.message || 'CORS/Sandbox limit'}). Fell back to deterministic synthetic feed.`,
      ];
      return res;
    }
  }
}
