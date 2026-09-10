import { CandleData } from '../../types/backtest';
import { DatasetMetadata } from '../../types/dataset';
import { FundingRateRecord, MarketDataError, MarketTrade, OpenInterestRecord } from '../../types/marketData';
import { DataValidator } from '../validation/DataValidator';
import { BinanceFundingProvider } from './FundingProvider';

export class BinanceProvider {
  public id = 'binance-provider';
  public name = 'Binance USDT-M Futures Public REST';
  public exchange = 'BINANCE' as const;
  public isSynthetic = false;

  private fundingProvider = new BinanceFundingProvider();

  /**
   * Translates application timeframe to Binance interval parameter
   */
  private normalizeInterval(timeframe: string): string {
    const tf = timeframe.toLowerCase();
    switch (tf) {
      case '1m': return '1m';
      case '5m': return '5m';
      case '15m': return '15m';
      case '30m': return '30m';
      case '1h': return '1h';
      case '4h': return '4h';
      case '1d': return '1d';
      default: return '1h';
    }
  }

  /**
   * Executes a fetch with retry and rate-limit backoff
   */
  private async fetchWithRetry(url: string, retries: number = 2): Promise<any> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (resp.status === 429) {
          throw new MarketDataError(
            'RATE_LIMITED',
            'Binance rate limit reached (HTTP 429). Please wait before requesting further historical data.',
            `URL: ${url}`,
            true
          );
        }
        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status} - ${resp.statusText}`);
        }
        return await resp.json();
      } catch (err: any) {
        if (err instanceof MarketDataError && err.code === 'RATE_LIMITED') {
          throw err;
        }
        if (attempt === retries) {
          throw new MarketDataError(
            'DATA_FETCH_FAILED',
            `Failed to fetch market data from Binance: ${err.message || String(err)}`,
            `Endpoint: ${url}. If running in browser sandbox, direct exchange connection may be restricted by network or CORS policies.`,
            true
          );
        }
        // Exponential backoff
        await new Promise((r) => setTimeout(r, 400 * Math.pow(2, attempt)));
      }
    }
  }

  /**
   * Loads real historical klines with pagination
   */
  public async getCandles(
    symbol: string,
    timeframe: string,
    startDate?: string,
    endDate?: string,
    options?: { count?: number; marketType?: 'PERPETUAL' | 'SPOT' }
  ): Promise<{ candles: CandleData[]; metadata: DatasetMetadata }> {
    const cleanSymbol = symbol.replace('/', '').toUpperCase();
    const interval = this.normalizeInterval(timeframe);
    const isPerp = options?.marketType !== 'SPOT';
    const baseUrl = isPerp
      ? 'https://fapi.binance.com/fapi/v1/klines'
      : 'https://api.binance.com/api/v3/klines';

    const intervalMinutes = DataValidator.getTimeframeMinutes(timeframe);
    const intervalMs = intervalMinutes * 60 * 1000;

    let targetCount = options?.count || 200;
    const endTimestamp = endDate ? new Date(endDate).getTime() : Date.now();
    let startTimestamp = startDate ? new Date(startDate).getTime() : endTimestamp - targetCount * intervalMs;

    // Paginate in chunks of 500 up to targetCount (capped at 1500 for fast UI response)
    const MAX_CHUNK = 500;
    const allCandlesMap = new Map<number, CandleData>();
    let currentStart = startTimestamp;

    const maxLoops = Math.min(4, Math.ceil(targetCount / MAX_CHUNK));

    for (let loop = 0; loop < maxLoops; loop++) {
      const remaining = targetCount - allCandlesMap.size;
      if (remaining <= 0) break;
      const limit = Math.min(MAX_CHUNK, remaining);

      let url = `${baseUrl}?symbol=${cleanSymbol}&interval=${interval}&limit=${limit}`;
      if (currentStart) {
        url += `&startTime=${currentStart}`;
      }
      if (endTimestamp) {
        url += `&endTime=${endTimestamp}`;
      }

      const rawRows = await this.fetchWithRetry(url);
      if (!Array.isArray(rawRows) || rawRows.length === 0) {
        break;
      }

      for (const row of rawRows) {
        const ts = Number(row[0]);
        if (!allCandlesMap.has(ts)) {
          const open = parseFloat(row[1]);
          const high = parseFloat(row[2]);
          const low = parseFloat(row[3]);
          const close = parseFloat(row[4]);
          const volume = parseFloat(row[5]);

          if (isNaN(open) || isNaN(close)) {
            throw new MarketDataError('INVALID_DATA', `Malformed OHLCV candle row received from Binance at timestamp ${ts}`);
          }

          allCandlesMap.set(ts, {
            timestamp: ts,
            time: new Date(ts).toISOString().slice(0, 16).replace('T', ' '),
            open,
            high,
            low,
            close,
            volume,
          });
        }
      }

      const lastTs = Number(rawRows[rawRows.length - 1][0]);
      if (lastTs <= currentStart || rawRows.length < limit) {
        break;
      }
      currentStart = lastTs + intervalMs;
      // Brief pause between paginated calls to respect rate limit
      await new Promise((r) => setTimeout(r, 60));
    }

    const candles = Array.from(allCandlesMap.values()).sort((a, b) => a.timestamp - b.timestamp);

    if (candles.length === 0) {
      throw new MarketDataError(
        'INSUFFICIENT_DATA',
        `No candles returned by Binance for ${symbol} on ${timeframe}. Please check symbol and date range.`
      );
    }

    const validation = DataValidator.validate(candles, timeframe);
    const checksum = DataValidator.calculateChecksum(candles);

    const metadata: DatasetMetadata = {
      id: `binance-${cleanSymbol}-${timeframe}-${checksum.slice(0, 6)}`,
      datasetId: `BINANCE-${cleanSymbol}-${timeframe}-${candles[0].timestamp}`,
      name: `${symbol} ${timeframe} Real Binance ${isPerp ? 'USDT-M Futures' : 'Spot'} Klines`,
      exchange: 'BINANCE',
      marketType: isPerp ? 'PERPETUAL' : 'SPOT',
      source: 'EXCHANGE_API',
      providerName: 'Binance REST API',
      symbol,
      timeframe,
      dateRange: {
        start: candles[0].time,
        end: candles[candles.length - 1].time,
      },
      startTime: candles[0].time,
      endTime: candles[candles.length - 1].time,
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
      version: 'v2.1-live',
      isSynthetic: false,
      validationNotes: validation.warnings,
    };

    return { candles, metadata };
  }

  public async getFundingRates(symbol: string): Promise<FundingRateRecord[]> {
    return this.fundingProvider.getHistoricalFundingRates(symbol);
  }

  public async getOpenInterest(symbol: string): Promise<OpenInterestRecord> {
    const cleanSymbol = symbol.replace('/', '').toUpperCase();
    const url = `https://fapi.binance.com/fapi/v1/openInterest?symbol=${cleanSymbol}`;
    try {
      const data = await this.fetchWithRetry(url, 1);
      return {
        timestamp: Number(data.time),
        time: new Date(Number(data.time)).toISOString().slice(0, 16).replace('T', ' '),
        symbol,
        openInterest: parseFloat(data.openInterest),
        openInterestValue: parseFloat(data.openInterest) * 64000,
      };
    } catch (err: any) {
      throw new MarketDataError('DATA_FETCH_FAILED', `Failed to fetch Open Interest for ${symbol}: ${err.message}`);
    }
  }

  public async getTrades(symbol: string, limit: number = 50): Promise<MarketTrade[]> {
    const cleanSymbol = symbol.replace('/', '').toUpperCase();
    const url = `https://fapi.binance.com/fapi/v1/trades?symbol=${cleanSymbol}&limit=${limit}`;
    try {
      const data = await this.fetchWithRetry(url, 1);
      if (!Array.isArray(data)) return [];
      return data.map((t: any) => ({
        id: String(t.id),
        timestamp: Number(t.time),
        price: parseFloat(t.price),
        quantity: parseFloat(t.qty),
        side: t.isBuyerMaker ? 'SELL' : 'BUY',
      }));
    } catch {
      return [];
    }
  }
}
