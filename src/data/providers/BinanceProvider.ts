import { CandleData } from '../../types/backtest';
import { DatasetMetadata } from '../../types/dataset';
import { FundingRateRecord, MarketDataError, MarketTrade, OpenInterestRecord } from '../../types/marketData';
import { DataValidator } from '../validation/DataValidator';
import { BinanceFundingProvider } from './FundingProvider';
import { calculateExpectedRowCount, timeframeToMs } from '../../utils/timeframe';

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
      case '3m': return '3m';
      case '5m': return '5m';
      case '15m': return '15m';
      case '30m': return '30m';
      case '1h': return '1h';
      case '2h': return '2h';
      case '4h': return '4h';
      case '6h': return '6h';
      case '8h': return '8h';
      case '12h': return '12h';
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
        const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (resp.status === 429 || resp.status === 418) {
          throw new MarketDataError(
            'RATE_LIMITED',
            'Binance rate limit reached (HTTP 429/418). Please wait before requesting further historical data.',
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
   * Loads real historical klines with full date-range pagination
   * Never silently truncates or substitutes data.
   */
  public async getCandles(
    symbol: string,
    timeframe: string,
    startDate?: string,
    endDate?: string,
    options?: { count?: number; marketType?: 'PERPETUAL' | 'SPOT'; onProgress?: (msg: string) => void }
  ): Promise<{ candles: CandleData[]; metadata: DatasetMetadata }> {
    const cleanSymbol = symbol.replace('/', '').toUpperCase();
    const interval = this.normalizeInterval(timeframe);
    const isPerp = options?.marketType !== 'SPOT';
    const baseUrl = isPerp
      ? 'https://fapi.binance.com/fapi/v1/klines'
      : 'https://api.binance.com/api/v3/klines';

    const intervalMs = timeframeToMs(timeframe);
    const endTimestamp = endDate ? new Date(endDate).getTime() : Date.now();
    let startTimestamp: number;

    if (startDate) {
      startTimestamp = new Date(startDate).getTime();
    } else {
      const count = options?.count || 300;
      startTimestamp = endTimestamp - count * intervalMs;
    }

    if (isNaN(startTimestamp) || isNaN(endTimestamp) || endTimestamp <= startTimestamp) {
      throw new MarketDataError(
        'INVALID_DATA',
        `Invalid date range requested: ${startDate} to ${endDate}`
      );
    }

    const expectedRowCount = calculateExpectedRowCount(startTimestamp, endTimestamp, timeframe);
    const CHUNK_SIZE = 1000;
    const allCandlesMap = new Map<number, CandleData>();
    let currentStart = startTimestamp;
    let requestsCount = 0;
    const MAX_REQUESTS = 60; // Safeguard against endless loop

    while (currentStart < endTimestamp && requestsCount < MAX_REQUESTS) {
      requestsCount++;
      const limit = Math.min(CHUNK_SIZE, Math.max(1, Math.ceil((endTimestamp - currentStart) / intervalMs) + 1));
      let url = `${baseUrl}?symbol=${cleanSymbol}&interval=${interval}&limit=${limit}&startTime=${currentStart}&endTime=${endTimestamp}`;

      const rawRows = await this.fetchWithRetry(url);
      if (!Array.isArray(rawRows) || rawRows.length === 0) {
        break;
      }

      for (const row of rawRows) {
        const ts = Number(row[0]);
        if (ts >= startTimestamp && ts <= endTimestamp && !allCandlesMap.has(ts)) {
          const open = parseFloat(row[1]);
          const high = parseFloat(row[2]);
          const low = parseFloat(row[3]);
          const close = parseFloat(row[4]);
          const volume = parseFloat(row[5]);

          if (isNaN(open) || isNaN(high) || isNaN(low) || isNaN(close)) {
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
      // Respect rate limit
      if (requestsCount % 5 === 0) {
        await new Promise((r) => setTimeout(r, 80));
      }
    }

    const candles = Array.from(allCandlesMap.values()).sort((a, b) => a.timestamp - b.timestamp);

    if (candles.length === 0) {
      throw new MarketDataError(
        'INSUFFICIENT_DATA',
        `No candles returned by Binance for ${symbol} on ${timeframe} between ${startDate || new Date(startTimestamp).toISOString()} and ${endDate || new Date(endTimestamp).toISOString()}.`
      );
    }

    // Exact Range Coverage Validation
    if (startDate && endDate) {
      const coverage = DataValidator.validateRangeCoverage(candles, startDate, endDate, timeframe);
      if (!coverage.valid) {
        throw new MarketDataError(
          'DATA_INCOMPLETE',
          `Binance dataset incomplete: ${coverage.errors[0]}`
        );
      }
    }

    const validation = DataValidator.validate(candles, timeframe, {
      requestedStart: startDate,
      requestedEnd: endDate,
    });

    if (!validation.valid) {
      throw new MarketDataError(
        'DATA_INVALID',
        `Binance dataset failed integrity validation: ${validation.errors[0]}`
      );
    }

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
      requestedStart: startDate,
      requestedEnd: endDate,
      actualStart: candles[0].time,
      actualEnd: candles[candles.length - 1].time,
      dateRange: {
        start: candles[0].time,
        end: candles[candles.length - 1].time,
      },
      startTime: candles[0].time,
      endTime: candles[candles.length - 1].time,
      totalBars: candles.length,
      rowCount: candles.length,
      expectedRowCount,
      downloadedAt: new Date().toISOString(),
      checksum,
      schemaVersion: 'v2.1',
      validationStatus: validation.valid ? (validation.warnings.length > 0 ? 'WARNINGS' : 'PASSED') : 'FAILED',
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

  public async getFundingRates(
    symbol: string,
    options?: { startTime?: number; endTime?: number; limit?: number }
  ): Promise<FundingRateRecord[]> {
    return this.fundingProvider.getHistoricalFundingRates(symbol, options);
  }

  public async getOpenInterest(symbol: string): Promise<OpenInterestRecord> {
    const cleanSymbol = symbol.replace('/', '').toUpperCase();
    const url = `https://fapi.binance.com/fapi/v1/openInterest?symbol=${cleanSymbol}`;
    try {
      const data = await this.fetchWithRetry(url, 1);
      const oiQty = parseFloat(data.openInterest);
      return {
        timestamp: Number(data.time),
        time: new Date(Number(data.time)).toISOString().slice(0, 16).replace('T', ' '),
        symbol,
        openInterest: oiQty,
        // No hardcoded 64000 assumption; strictly omit or leave undefined if USD notional is not returned directly by exchange
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
