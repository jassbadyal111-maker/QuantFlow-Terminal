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

  private normalizeInterval(timeframe: string): string {
    const tf = timeframe.toLowerCase();
    switch (tf) {
      case '1m': return '1m'; case '3m': return '3m'; case '5m': return '5m'; case '15m': return '15m'; case '30m': return '30m';
      case '1h': return '1h'; case '2h': return '2h'; case '4h': return '4h'; case '6h': return '6h'; case '8h': return '8h'; case '12h': return '12h'; case '1d': return '1d';
      default: throw new MarketDataError('INVALID_CONFIGURATION', `Unsupported Binance interval: ${timeframe}`);
    }
  }

  private async fetchWithRetry(url: string, retries: number = 2): Promise<any> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (resp.status === 429 || resp.status === 418) throw new MarketDataError('RATE_LIMITED', 'Binance rate limit reached (HTTP 429/418).', `URL: ${url}`, true);
        if (!resp.ok) throw new Error(`HTTP ${resp.status} - ${resp.statusText}`);
        return await resp.json();
      } catch (err: any) {
        if (err instanceof MarketDataError && err.code === 'RATE_LIMITED') throw err;
        if (attempt === retries) throw new MarketDataError('DATA_FETCH_FAILED', `Failed to fetch market data from Binance: ${err.message || String(err)}`, `Endpoint: ${url}`, true);
        await new Promise((r) => setTimeout(r, 400 * Math.pow(2, attempt)));
      }
    }
  }

  public async getCandles(symbol:string,timeframe:string,startDate?:string,endDate?:string,options?:{count?:number;marketType?:'PERPETUAL'|'SPOT';onProgress?:(msg:string)=>void}):Promise<{candles:CandleData[];metadata:DatasetMetadata}> {
    const cleanSymbol=symbol.replace('/','').toUpperCase(); const interval=this.normalizeInterval(timeframe); const isPerp=options?.marketType!=='SPOT';
    const baseUrl=isPerp?'https://fapi.binance.com/fapi/v1/klines':'https://api.binance.com/api/v3/klines'; const intervalMs=timeframeToMs(timeframe);
    const endTimestamp=endDate?new Date(endDate).getTime():Date.now(); const startTimestamp=startDate?new Date(startDate).getTime():endTimestamp-(options?.count||300)*intervalMs;
    if(!Number.isFinite(startTimestamp)||!Number.isFinite(endTimestamp)||endTimestamp<=startTimestamp) throw new MarketDataError('INVALID_CONFIGURATION',`Invalid date range requested: ${startDate} to ${endDate}`);
    const expectedRowCount=calculateExpectedRowCount(startTimestamp,endTimestamp,timeframe); const CHUNK_SIZE=1000; const allCandlesMap=new Map<number,CandleData>();
    let currentStart=startTimestamp; let requestsCount=0; const MAX_REQUESTS=60;
    while(currentStart<endTimestamp){
      if(requestsCount>=MAX_REQUESTS) throw new MarketDataError('PAGINATION_LIMIT',`Binance pagination limit reached before requested range completed.`,undefined,false,{symbol,expected:expectedRowCount,actual:allCandlesMap.size,context:{requestsCount,maxRequests:MAX_REQUESTS,currentStart,endTimestamp,timeframe}});
      requestsCount++;
      const remaining=Math.ceil((endTimestamp-currentStart)/intervalMs)+1; const limit=Math.min(CHUNK_SIZE,Math.max(1,remaining));
      const url=`${baseUrl}?symbol=${cleanSymbol}&interval=${interval}&limit=${limit}&startTime=${currentStart}&endTime=${endTimestamp}`;
      const rawRows=await this.fetchWithRetry(url);
      if(!Array.isArray(rawRows)||rawRows.length===0) break;
      for(const row of rawRows){
        const ts=Number(row[0]); if(ts<startTimestamp||ts>endTimestamp||allCandlesMap.has(ts)) continue;
        const open=Number(row[1]),high=Number(row[2]),low=Number(row[3]),close=Number(row[4]),volume=Number(row[5]);
        if(![open,high,low,close,volume].every(Number.isFinite)) throw new MarketDataError('DATASET_INVALID',`Malformed OHLCV candle row received from Binance at timestamp ${ts}`,undefined,false,{timestamp:ts,symbol});
        allCandlesMap.set(ts,{timestamp:ts,time:new Date(ts).toISOString().slice(0,16).replace('T',' '),open,high,low,close,volume});
      }
      const lastTs=Number(rawRows[rawRows.length-1][0]);
      if(!Number.isFinite(lastTs)||lastTs<=currentStart) break;
      currentStart=lastTs+intervalMs;
      if(requestsCount%5===0) await new Promise((r)=>setTimeout(r,80));
    }

    const candles=Array.from(allCandlesMap.values()).sort((a,b)=>a.timestamp-b.timestamp);
    if(candles.length===0) throw new MarketDataError('DATASET_INCOMPLETE',`No candles returned by Binance for ${symbol} on ${timeframe}.`);
    if(startDate&&endDate){
      const coverage=DataValidator.validateRangeCoverage(candles,startDate,endDate,timeframe);
      if(!coverage.valid) throw new MarketDataError('DATASET_INCOMPLETE',`Binance dataset incomplete: ${coverage.errors[0]}`,undefined,false,{symbol,expected:coverage.expectedCount,actual:candles.length,context:{coverage}});
    }
    const validation=DataValidator.validate(candles,timeframe,{requestedStart:startDate,requestedEnd:endDate});
    if(!validation.valid) throw new MarketDataError('DATASET_INVALID',`Binance dataset failed integrity validation: ${validation.errors[0]}`,undefined,false,{symbol,expected:validation.statistics.expectedRowCount,actual:validation.statistics.actualRowCount,context:{errors:validation.errors}});
    const checksum=DataValidator.calculateChecksum(candles);
    const metadata:DatasetMetadata={id:`binance-${cleanSymbol}-${timeframe}-${checksum.slice(0,6)}`,datasetId:`BINANCE-${cleanSymbol}-${timeframe}-${candles[0].timestamp}`,name:`${symbol} ${timeframe} Real Binance ${isPerp?'USDT-M Futures':'Spot'} Klines`,exchange:'BINANCE',marketType:isPerp?'PERPETUAL':'SPOT',source:'EXCHANGE_API',providerName:'Binance REST API',symbol,timeframe,requestedStart:startDate,requestedEnd:endDate,actualStart:candles[0].time,actualEnd:candles[candles.length-1].time,dateRange:{start:candles[0].time,end:candles[candles.length-1].time},startTime:candles[0].time,endTime:candles[candles.length-1].time,totalBars:candles.length,rowCount:candles.length,expectedRowCount,downloadedAt:new Date().toISOString(),checksum,schemaVersion:'v2.1',validationStatus:'PASSED',missingBarsCount:0,missingIntervals:0,duplicateCount:0,duplicateRows:0,minPrice:validation.statistics.minPrice,maxPrice:validation.statistics.maxPrice,minVolume:validation.statistics.minVolume,maxVolume:validation.statistics.maxVolume,timezone:'UTC',version:'v2.1-live',isSynthetic:false,validationNotes:validation.warnings};
    return {candles,metadata};
  }

  public async getFundingRates(symbol:string,options?:{startTime?:number;endTime?:number}):Promise<FundingRateRecord[]>{return this.fundingProvider.getHistoricalFundingRates(symbol,options);}
  public async getOpenInterest(symbol:string):Promise<OpenInterestRecord>{const clean=symbol.replace('/','').toUpperCase(); const data=await this.fetchWithRetry(`https://fapi.binance.com/fapi/v1/openInterest?symbol=${clean}`,1); const ts=Number(data.time); const oi=Number(data.openInterest); return {timestamp:ts,time:new Date(ts).toISOString().slice(0,16).replace('T',' '),symbol,openInterest:oi};}
  public async getTrades(symbol:string,limit:number=50):Promise<MarketTrade[]>{const clean=symbol.replace('/','').toUpperCase(); const data=await this.fetchWithRetry(`https://fapi.binance.com/fapi/v1/trades?symbol=${clean}&limit=${limit}`,1); if(!Array.isArray(data)) return []; return data.map((t:any)=>({id:String(t.id),timestamp:Number(t.time),price:Number(t.price),quantity:Number(t.qty),side:t.isBuyerMaker?'SELL':'BUY'}));}
}
