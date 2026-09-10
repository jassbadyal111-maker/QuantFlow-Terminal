import { CandleData } from '../../types/backtest';
import { DatasetMetadata } from '../../types/dataset';
import { FundingRateRecord, MarketDataError, MarketTrade, OpenInterestRecord } from '../../types/marketData';
import { DataValidator } from '../validation/DataValidator';
import { BybitFundingProvider } from './FundingProvider';

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
        const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
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
    options?: { count?: number; marketType?: 'PERPETUAL' | 'SPOT' }
  ): Promise<{ candles: CandleData[]; metadata: DatasetMetadata }> {
    const cleanSymbol = symbol.replace('/', '').toUpperCase();
    const interval = this.normalizeInterval(timeframe);
    const category = options?.marketType === 'SPOT' ? 'spot' : 'linear';
    const limit = Math.min(200, options?.count || 200);

    let url = `https://api.bybit.com/v5/market/kline?category=${category}&symbol=${cleanSymbol}&interval=${interval}&limit=${limit}`;
    if (startDate) {
      url += `&start=${new Date(startDate).getTime()}`;
    }
    if (endDate) {
      url += `&end=${new Date(endDate).getTime()}`;
    }

    const response = await this.fetchWithRetry(url);
    const rawList = response?.result?.list;

    if (!Array.isArray(rawList) || rawList.length === 0) {
      throw new MarketDataError(
        'INSUFFICIENT_DATA',
        `No candle records returned by Bybit for ${symbol} on interval ${timeframe}.`
      );
    }

    // Bybit returns newest first, so we reverse to ascending
    const candles: CandleData[] = rawList
      .slice()
      .reverse()
      .map((row: any) => {
        const ts = Number(row[0]);
        return {
          timestamp: ts,
          time: new Date(ts).toISOString().slice(0, 16).replace('T', ' '),
          open: parseFloat(row[1]),
          high: parseFloat(row[2]),
          low: parseFloat(row[3]),
          close: parseFloat(row[4]),
          volume: parseFloat(row[5]),
        };
      });

    const validation = DataValidator.validate(candles, timeframe);
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
        openInterestValue: oi * 64000,
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
      const list = data?.result?.list || [];
      return list.map((t: any) => ({
        id: String(t.execId),
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
