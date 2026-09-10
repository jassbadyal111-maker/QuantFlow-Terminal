import { FundingRateRecord, MarketDataError } from '../../types/marketData';

export interface FundingRateQueryOptions {
  startTime?: number;
  endTime?: number;
  limit?: number;
}

export interface IFundingProvider {
  getHistoricalFundingRates(
    symbol: string,
    options?: FundingRateQueryOptions
  ): Promise<FundingRateRecord[]>;
}

export class BinanceFundingProvider implements IFundingProvider {
  public async getHistoricalFundingRates(
    symbol: string,
    options?: FundingRateQueryOptions
  ): Promise<FundingRateRecord[]> {
    const cleanSymbol = symbol.replace('/', '').toUpperCase();
    const startTime = options?.startTime;
    const endTime = options?.endTime || Date.now();

    const recordsMap = new Map<number, FundingRateRecord>();
    let currentStart = startTime;
    let requestsCount = 0;
    const MAX_REQUESTS = 30;

    try {
      while (requestsCount < MAX_REQUESTS) {
        requestsCount++;
        const limit = 1000;
        let url = `https://fapi.binance.com/fapi/v1/fundingRate?symbol=${cleanSymbol}&limit=${limit}`;
        if (currentStart) url += `&startTime=${currentStart}`;
        if (endTime) url += `&endTime=${endTime}`;

        const resp = await fetch(url, { signal: AbortSignal.timeout(6000) });
        if (!resp.ok) {
          throw new Error(`Binance funding API returned HTTP ${resp.status}`);
        }
        const data = await resp.json();
        if (!Array.isArray(data) || data.length === 0) {
          break;
        }

        for (const item of data) {
          const ts = Number(item.fundingTime);
          if (!recordsMap.has(ts)) {
            recordsMap.set(ts, {
              timestamp: ts,
              time: new Date(ts).toISOString().slice(0, 16).replace('T', ' '),
              symbol: item.symbol,
              rate: parseFloat(item.fundingRate),
              markPrice: item.markPrice ? parseFloat(item.markPrice) : undefined,
              intervalHours: 8,
            });
          }
        }

        const lastTs = Number(data[data.length - 1].fundingTime);
        if (lastTs <= (currentStart || 0) || data.length < limit || lastTs >= endTime) {
          break;
        }
        currentStart = lastTs + 1000;
        await new Promise((r) => setTimeout(r, 60));
      }

      return Array.from(recordsMap.values()).sort((a, b) => a.timestamp - b.timestamp);
    } catch (err: any) {
      throw new MarketDataError(
        'FUNDING_UNAVAILABLE',
        `Historical funding data unavailable for ${symbol} on Binance.`,
        err.message || String(err),
        true
      );
    }
  }
}

export class BybitFundingProvider implements IFundingProvider {
  public async getHistoricalFundingRates(
    symbol: string,
    options?: FundingRateQueryOptions
  ): Promise<FundingRateRecord[]> {
    const cleanSymbol = symbol.replace('/', '').toUpperCase();
    const startTime = options?.startTime;
    const endTime = options?.endTime || Date.now();

    const recordsMap = new Map<number, FundingRateRecord>();
    let currentStart = startTime;
    let requestsCount = 0;
    const MAX_REQUESTS = 30;

    try {
      while (requestsCount < MAX_REQUESTS) {
        requestsCount++;
        const limit = 200;
        let url = `https://api.bybit.com/v5/market/funding/history?category=linear&symbol=${cleanSymbol}&limit=${limit}`;
        if (currentStart) url += `&startTime=${currentStart}`;
        if (endTime) url += `&endTime=${endTime}`;

        const resp = await fetch(url, { signal: AbortSignal.timeout(6000) });
        if (!resp.ok) {
          throw new Error(`Bybit funding API returned HTTP ${resp.status}`);
        }
        const data = await resp.json();
        const list = data?.result?.list;
        if (!Array.isArray(list) || list.length === 0) {
          break;
        }

        for (const item of list) {
          const ts = Number(item.fundingRateTimestamp);
          if (!recordsMap.has(ts)) {
            recordsMap.set(ts, {
              timestamp: ts,
              time: new Date(ts).toISOString().slice(0, 16).replace('T', ' '),
              symbol: item.symbol,
              rate: parseFloat(item.fundingRate),
              intervalHours: 8,
            });
          }
        }

        let maxTsInBatch = 0;
        for (const item of list) {
          const ts = Number(item.fundingRateTimestamp);
          if (ts > maxTsInBatch) maxTsInBatch = ts;
        }

        if (maxTsInBatch <= (currentStart || 0) || list.length < limit || maxTsInBatch >= endTime) {
          break;
        }
        currentStart = maxTsInBatch + 1000;
        await new Promise((r) => setTimeout(r, 60));
      }

      return Array.from(recordsMap.values()).sort((a, b) => a.timestamp - b.timestamp);
    } catch (err: any) {
      throw new MarketDataError(
        'FUNDING_UNAVAILABLE',
        `Historical funding data unavailable for ${symbol} on Bybit.`,
        err.message || String(err),
        true
      );
    }
  }
}

export class MockFundingProvider implements IFundingProvider {
  public async getHistoricalFundingRates(
    symbol: string,
    options?: FundingRateQueryOptions
  ): Promise<FundingRateRecord[]> {
    const records: FundingRateRecord[] = [];
    const intervalMs = 8 * 60 * 60 * 1000; // standard 8h funding cycle

    const endTime = options?.endTime || Date.now();
    const startTime = options?.startTime || (endTime - 60 * intervalMs);

    // Snap to 8h UTC funding epochs: 00:00, 08:00, 16:00
    const firstFundingTs = Math.ceil(startTime / intervalMs) * intervalMs;

    let idx = 0;
    for (let ts = firstFundingTs; ts <= endTime; ts += intervalMs) {
      idx++;
      // Oscillating funding cycle (typical perpetual funding between -0.01% and +0.03%)
      const cycle = Math.sin(idx * 0.18);
      const rate = Number((0.0001 + cycle * 0.00015).toFixed(6));
      records.push({
        timestamp: ts,
        time: new Date(ts).toISOString().slice(0, 16).replace('T', ' '),
        symbol,
        rate,
        intervalHours: 8,
      });
    }

    return records;
  }
}
