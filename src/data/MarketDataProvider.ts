import { CandleData } from '../types/backtest';
import { DatasetMetadata, ValidationReport } from '../types/dataset';
import { FundingRateRecord, MarketDataError, MarketTrade, OpenInterestRecord } from '../types/marketData';
import { BinanceProvider } from './providers/BinanceProvider';
import { BybitProvider } from './providers/BybitProvider';
import { MockProvider, createRng } from './providers/MockProvider';
import { DataValidator } from './validation/DataValidator';

export { createRng, DataValidator };

export interface MarketDataProvider {
  id: string;
  name: string;
  exchange: 'BINANCE' | 'BYBIT' | 'MOCK';
  isSynthetic: boolean;
  getCandles(symbol: string, timeframe: string, startDate?: string, endDate?: string, options?: { count?: number; seed?: number; marketType?: 'PERPETUAL' | 'SPOT' }): Promise<{ candles: CandleData[]; metadata: DatasetMetadata }>;
  getTrades(symbol: string, limit?: number): Promise<MarketTrade[]>;
  getFundingRates(symbol: string, options?: { startTime?: number; endTime?: number }): Promise<FundingRateRecord[]>;
  getOpenInterest(symbol: string): Promise<OpenInterestRecord>;
  validateDataset(candles: CandleData[], timeframe?: string): ValidationReport;
}

export class MockMarketDataProvider implements MarketDataProvider {
  public id = 'provider-mock';
  public name = 'ApexQuant Deterministic Synthetic Feed';
  public exchange = 'MOCK' as const;
  public isSynthetic = true;
  private provider = new MockProvider();
  public async getCandles(symbol:string,timeframe:string,startDate?:string,endDate?:string,options?:{count?:number;seed?:number;marketType?:'PERPETUAL'|'SPOT'}):Promise<{candles:CandleData[];metadata:DatasetMetadata}>{ return this.provider.getCandles(symbol,timeframe,startDate||'',endDate||'',options); }
  public async getTrades(symbol:string,limit?:number):Promise<MarketTrade[]>{ return this.provider.getTrades(symbol,limit); }
  public async getFundingRates(symbol:string,options?:{startTime?:number;endTime?:number}):Promise<FundingRateRecord[]>{ return this.provider.getFundingRates(symbol); }
  public async getOpenInterest(symbol:string):Promise<OpenInterestRecord>{ return this.provider.getOpenInterest(symbol); }
  public validateDataset(candles:CandleData[],timeframe='1h'):ValidationReport{ return DataValidator.validate(candles,timeframe); }
  public loadCandlesSync(symbol:string,timeframe:string,startDate:string,endDate:string,options?:{seed?:number;count?:number}):{candles:CandleData[];metadata:DatasetMetadata} {
    const seed=options?.seed??20250228; const intervalMinutes=DataValidator.getTimeframeMinutes(timeframe); const intervalMs=intervalMinutes*60*1000;
    const startTs=new Date(startDate.includes('T')?startDate:`${startDate}T00:00:00Z`).getTime(); const endTs=new Date(endDate.includes('T')?endDate:`${endDate}T23:59:59Z`).getTime();
    const count=Math.max(30,Math.floor((endTs-startTs)/intervalMs)+1); const rng=createRng(seed); const basePrice=symbol.includes('ETH')?2850:symbol.includes('SOL')?175:symbol.includes('AVAX')?32:64200; const candles:CandleData[]=[]; let currentClose=basePrice;
    for(let i=0;i<count;i++){ const barTs=startTs+i*intervalMs; const open=currentClose; const cycle=Math.sin((i/count)*Math.PI*3.5); const drift=cycle*0.0012+0.0004; const vol=0.012+0.018*Math.abs(Math.cos(i*0.15)); const u1=rng(); const u2=rng(); const z=Math.sqrt(-2*Math.log(u1||0.0001))*Math.cos(2*Math.PI*u2); const close=Math.max(open*(1+drift+z*vol),open*0.7); const high=Math.max(open,close)+Math.abs(close-open)*(0.4+rng()*0.9)+open*0.003; const low=Math.min(open,close)-Math.abs(close-open)*(0.4+rng()*0.9)-open*0.003; currentClose=close; candles.push({timestamp:barTs,time:new Date(barTs).toISOString().slice(0,16).replace('T',' '),open:Number(open.toFixed(2)),high:Number(high.toFixed(2)),low:Number(low.toFixed(2)),close:Number(close.toFixed(2)),volume:Math.round(350*(0.6+rng()*1.8))}); }
    const validation=DataValidator.validate(candles,timeframe); const checksum=DataValidator.calculateChecksum(candles); const metadata:DatasetMetadata={id:`synthetic-${symbol.replace('/','_')}-${timeframe}-${seed}`,datasetId:`MOCK-${symbol}-${timeframe}-${seed}`,name:`${symbol} ${timeframe} Synthetic Quantitative Test Feed`,exchange:'MOCK',marketType:'PERPETUAL',source:'DEMO_SYNTHETIC',providerName:'ApexQuant Deterministic Synthetic Feed',symbol,timeframe,dateRange:{start:candles[0].time,end:candles[candles.length-1].time},startTime:candles[0].time,endTime:candles[candles.length-1].time,totalBars:candles.length,rowCount:candles.length,downloadedAt:new Date().toISOString(),checksum,schemaVersion:'v2.1',validationStatus:validation.valid?'PASSED':'FAILED',missingBarsCount:validation.statistics.missingIntervals,missingIntervals:validation.statistics.missingIntervals,duplicateCount:validation.statistics.duplicateRows,duplicateRows:validation.statistics.duplicateRows,minPrice:validation.statistics.minPrice,maxPrice:validation.statistics.maxPrice,minVolume:validation.statistics.minVolume,maxVolume:validation.statistics.maxVolume,timezone:'UTC',seed,version:'v4.3-demo',isSynthetic:true,validationNotes:validation.warnings}; return {candles,metadata};
  }
}

export const SyntheticMarketDataProvider = MockMarketDataProvider;

export class BinanceMarketDataProvider implements MarketDataProvider {
  public id='provider-binance'; public name='Binance USDT-M Futures Public REST'; public exchange='BINANCE' as const; public isSynthetic=false; private provider=new BinanceProvider();
  public async getCandles(symbol:string,timeframe:string,startDate?:string,endDate?:string,options?:{count?:number;marketType?:'PERPETUAL'|'SPOT'}):Promise<{candles:CandleData[];metadata:DatasetMetadata}>{return this.provider.getCandles(symbol,timeframe,startDate,endDate,options);}
  public async getTrades(symbol:string,limit?:number):Promise<MarketTrade[]>{return this.provider.getTrades(symbol,limit);}
  public async getFundingRates(symbol:string,options?:{startTime?:number;endTime?:number}):Promise<FundingRateRecord[]>{return this.provider.getFundingRates(symbol,options);}
  public async getOpenInterest(symbol:string):Promise<OpenInterestRecord>{return this.provider.getOpenInterest(symbol);}
  public validateDataset(candles:CandleData[],timeframe='1h'):ValidationReport{return DataValidator.validate(candles,timeframe);}
}

export class BybitMarketDataProvider implements MarketDataProvider {
  public id='provider-bybit'; public name='Bybit v5 Public Unified Market Data'; public exchange='BYBIT' as const; public isSynthetic=false; private provider=new BybitProvider();
  public async getCandles(symbol:string,timeframe:string,startDate?:string,endDate?:string,options?:{count?:number;marketType?:'PERPETUAL'|'SPOT'}):Promise<{candles:CandleData[];metadata:DatasetMetadata}>{return this.provider.getCandles(symbol,timeframe,startDate,endDate,options);}
  public async getTrades(symbol:string,limit?:number):Promise<MarketTrade[]>{return this.provider.getTrades(symbol,limit);}
  public async getFundingRates(symbol:string,options?:{startTime?:number;endTime?:number}):Promise<FundingRateRecord[]>{return this.provider.getFundingRates(symbol,options);}
  public async getOpenInterest(symbol:string):Promise<OpenInterestRecord>{return this.provider.getOpenInterest(symbol);}
  public validateDataset(candles:CandleData[],timeframe='1h'):ValidationReport{return DataValidator.validate(candles,timeframe);}
}

export function createMarketDataProvider(exchange:string):MarketDataProvider {
  const ex=(exchange||'').trim().toLowerCase();
  switch(ex){
    case 'binance': case 'binance futures': case 'binance futures (public rest)': return new BinanceMarketDataProvider();
    case 'bybit': case 'bybit linear': case 'bybit linear (public rest)': return new BybitMarketDataProvider();
    case 'mock': case 'demo': case 'synthetic': return new MockMarketDataProvider();
    default: throw new MarketDataError('INVALID_CONFIGURATION',`Unsupported market-data provider "${exchange}". Select Binance, Bybit, or explicitly select Mock Demo.`);
  }
}
