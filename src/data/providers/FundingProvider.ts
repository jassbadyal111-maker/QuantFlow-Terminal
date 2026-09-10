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
    const limit = options?.limit || 100;
    let url = `https://fapi.binance.com/fapi/v1/fundingRate?symbol=${cleanSymbol}&limit=${limit}`;
    if (options?.startTime) url += `&startTime=${options.startTime}`;
    if (options?.endTime) url += `&endTime=${options.endTime}`;

    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (!resp.ok) {
        throw new Error(`Binance funding API returned HTTP ${resp.status}`);
      }
      const data = await resp.json();
      if (!Array.isArray(data)) {
        throw new Error('Malformed funding response');
      }

      return data.map((item: any) => ({
        timestamp: Number(item.fundingTime),
        time: new Date(Number(item.fundingTime)).toISOString().slice(0, 16).replace('T', ' '),
        symbol: item.symbol,
        rate: parseFloat(item.fundingRate),
        markPrice: item.markPrice ? parseFloat(item.markPrice) : undefined,
        intervalHours: 8,
      }));
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
    const limit = options?.limit || 100;
    let url = `https://api.bybit.com/v5/market/funding/history?category=linear&symbol=${cleanSymbol}&limit=${limit}`;
    if (options?.startTime) url += `&startTime=${options.startTime}`;
    if (options?.endTime) url += `&endTime=${options.endTime}`;

    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (!resp.ok) {
        throw new Error(`Bybit funding API returned HTTP ${resp.status}`);
      }
      const data = await resp.json();
      const list = data?.result?.list;
      if (!Array.isArray(list)) {
        throw new Error('Malformed Bybit funding response');
      }

      return list.map((item: any) => ({
        timestamp: Number(item.fundingRateTimestamp),
        time: new Date(Number(item.fundingRateTimestamp)).toISOString().slice(0, 16).replace('T', ' '),
        symbol: item.symbol,
        rate: parseFloat(item.fundingRate),
        intervalHours: 8,
      })).reverse();
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
    // Deterministic synthetic funding history with regime oscillations
    const records: FundingRateRecord[] = [];
    const count = options?.limit || 60;
    const now = options?.endTime || Date.now();
    const intervalMs = 8 * 60 * 60 * 1000;

    for (let i = count - 1; i >= 0; i--) {
      const ts = now - i * intervalMs;
      // Typical perpetual funding oscillates between -0.01% and +0.03%
      const cycle = Math.sin(i * 0.18);
      const rate = Number((0.0001 + cycle * 0.0002).toFixed(6));
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
