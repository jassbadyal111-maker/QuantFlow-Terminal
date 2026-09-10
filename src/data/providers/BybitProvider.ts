import { CandleData } from '../../types/backtest';
import { DatasetMetadata } from '../../types/dataset';
import { FundingRateRecord, MarketDataError, MarketTrade, OpenInterestRecord } from '../../types/marketData';
import { DataValidator } from '../validation/DataValidator';
import { BybitFundingProvider } from './FundingProvider';
import { calculateExpectedRowCount, timeframeToMs } from '../../utils/timeframe';

export class BybitProvider {
  public id = 'bybit-provider';
  public name = 'Bybit v5 Public Unified Market Data';
  public exchange = 'BYBIT' as const;
  public isSynthetic = false;

  private fundingProvider = new BybitFundingProvider();

  private normalizeInterval(timeframe: string): string {
    const tf = timeframe.toLowerCase();
    switch (tf) {
      case '1m': return '1';
      case '3m': return '3';
      case '5m': return '5';
      case '15m': return '15';
      case '30m': return '30';
      case '1h': return '60';
      case '2h': return '120';
      case '4h': return '240';
      case '6h': return '360';
      case '12h': return '720';
      case '1d': return 'D';
      case '1w': return 'W';
      default: return '60';
    }
  }

  private async fetchWithRetry(url: string, retries: number = 2): Promise<any> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (resp.status === 429) {
          throw new MarketDataError(
            'RATE_LIMITED',
            'Bybit rate limit reached (HTTP 429). Please wait before requesting further data.',
            `URL: ${url}`,
            true
          );
        }
        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status} - ${resp.statusText}`);
        }
        const json = await resp.json();
        if (json.retCode !== 0 && json.retCode !== undefined) {
          throw new Error(`Bybit error [${json.retCode}]: ${json.retMsg}`);
        }
        return json;
      } catch (err: any) {
        if (err instanceof MarketDataError && err.code === 'RATE_LIMITED') {
          throw err;
        }
        if (attempt === retries) {
          throw new MarketDataError(
            'DATA_FETCH_FAILED',
            `Failed to fetch market data from Bybit: ${err.message || String(err)}`,
            `Endpoint: ${url}. If running in a restricted sandbox, network access to Bybit endpoints may be limited.`,
            true
          );
        }
        await new Promise((r) => setTimeout(r, 400 * Math.pow(2, attempt)));
      }
    }
  }

  public async getCandles(
    symbol: string,
    timeframe: string,
    startDate?: string,
    endDate?: string,
    options?: { count?: number; marketType?: 'PERPETUAL' | 'SPOT'; onProgress?: (msg: string) => void }
  ): Promise<{ candles: CandleData[]; metadata: DatasetMetadata }> {
    const cleanSymbol = symbol.replace('/', '').toUpperCase();
    const interval = this.normalizeInterval(timeframe);
    const category = options?.marketType === 'SPOT' ? 'spot' : 'linear';
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
    const CHUNK_LIMIT = 200; // Bybit default limit per call
    const allCandlesMap = new Map<number, CandleData>();
    let currentStart = startTimestamp;
    let requestsCount = 0;
    const MAX_REQUESTS = 60;

    while (currentStart < endTimestamp && requestsCount < MAX_REQUESTS) {
      requestsCount++;
      const currentEndChunk = Math.min(endTimestamp, currentStart + CHUNK_LIMIT * intervalMs);
      const url = `https://api.bybit.com/v5/market/kline?category=${category}&symbol=${cleanSymbol}&interval=${interval}&limit=${CHUNK_LIMIT}&start=${currentStart}&end=${currentEndChunk}`;

      const response = await this.fetchWithRetry(url);
      const rawList = response?.result?.list;

      if (!Array.isArray(rawList) || rawList.length === 0) {
        break;
      }

      for (const row of rawList) {
        const ts = Number(row[0]);
        if (ts >= startTimestamp && ts <= endTimestamp && !allCandlesMap.has(ts)) {
          const open = parseFloat(row[1]);
          const high = parseFloat(row[2]);
          const low = parseFloat(row[3]);
          const close = parseFloat(row[4]);
          const volume = parseFloat(row[5]);

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

      // Bybit list is sorted desc (newest first). Find the max timestamp in this batch
      let maxTsInBatch = 0;
      for (const row of rawList) {
        const ts = Number(row[0]);
        if (ts > maxTsInBatch) maxTsInBatch = ts;
      }

      if (maxTsInBatch <= currentStart || currentEndChunk >= endTimestamp) {
        currentStart = currentEndChunk + intervalMs;
      } else {
        currentStart = maxTsInBatch + intervalMs;
      }

      if (requestsCount % 5 === 0) {
        await new Promise((r) => setTimeout(r, 80));
      }
    }

    const candles = Array.from(allCandlesMap.values()).sort((a, b) => a.timestamp - b.timestamp);

    if (candles.length === 0) {
      throw new MarketDataError(
        'INSUFFICIENT_DATA',
        `No candle records returned by Bybit for ${symbol} on interval ${timeframe}.`
      );
    }

    // Exact Range Coverage Validation
    if (startDate && endDate) {
      const coverage = DataValidator.validateRangeCoverage(candles, startDate, endDate, timeframe);
      if (!coverage.valid) {
        throw new MarketDataError(
          'DATA_INCOMPLETE',
          `Bybit dataset incomplete: ${coverage.errors[0]}`
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
        `Bybit dataset failed integrity validation: ${validation.errors[0]}`
      );
    }

    const checksum = DataValidator.calculateChecksum(candles);

    const metadata: DatasetMetadata = {
      id: `bybit-${cleanSymbol}-${timeframe}-${checksum.slice(0, 6)}`,
      datasetId: `BYBIT-${cleanSymbol}-${timeframe}-${candles[0].timestamp}`,
      name: `${symbol} ${timeframe} Real Bybit v5 ${category.toUpperCase()} Klines`,
      exchange: 'BYBIT',
      marketType: category === 'linear' ? 'PERPETUAL' : 'SPOT',
      source: 'EXCHANGE_API',
      providerName: 'Bybit v5 REST API',
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
    const url = `https://api.bybit.com/v5/market/open-interest?category=linear&symbol=${cleanSymbol}&intervalTime=5min&limit=1`;
    try {
      const data = await this.fetchWithRetry(url, 1);
      const item = data?.result?.list?.[0];
      const ts = item ? Number(item.timestamp) : Date.now();
      const oi = item ? parseFloat(item.openInterest) : 0;
      return {
        timestamp: ts,
        time: new Date(ts).toISOString().slice(0, 16).replace('T', ' '),
        symbol,
        openInterest: oi,
        // No hardcoded oi * 64000
      };
    } catch (err: any) {
      throw new MarketDataError('DATA_FETCH_FAILED', `Failed to fetch Bybit Open Interest for ${symbol}: ${err.message}`);
    }
  }

  public async getTrades(symbol: string, limit: number = 50): Promise<MarketTrade[]> {
    const cleanSymbol = symbol.replace('/', '').toUpperCase();
    const url = `https://api.bybit.com/v5/market/recent-trade?category=linear&symbol=${cleanSymbol}&limit=${limit}`;
    try {
      const data = await this.fetchWithRetry(url, 1);
      const list = data?.result?.list;
      if (!Array.isArray(list)) return [];
      return list.map((t: any) => ({
        id: String(t.execId || Math.random()),
        timestamp: Number(t.time),
        price: parseFloat(t.price),
        quantity: parseFloat(t.size),
        side: t.side === 'Buy' ? 'BUY' : 'SELL',
      }));
    } catch {
      return [];
    }
  }
}
