import { FundingRateRecord, MarketDataError } from '../../types/marketData';

export interface FundingRateQueryOptions { startTime?: number; endTime?: number; limit?: number; }
export interface IFundingProvider { getHistoricalFundingRates(symbol: string, options?: FundingRateQueryOptions): Promise<FundingRateRecord[]>; }

export class BinanceFundingProvider implements IFundingProvider {
  public async getHistoricalFundingRates(symbol:string,options?:FundingRateQueryOptions):Promise<FundingRateRecord[]> {
    const clean=symbol.replace('/','').toUpperCase(); const start=options?.startTime; const end=options?.endTime ?? Date.now();
    const map=new Map<number,FundingRateRecord>(); let current=start; let requests=0; const MAX_REQUESTS=30;
    try {
      while(true){
        if(requests>=MAX_REQUESTS) throw new MarketDataError('PAGINATION_LIMIT',`Binance funding pagination limit reached before the requested interval completed.`,undefined,false,{symbol,expected:`funding data through ${end}`,actual:map.size,context:{requests,maxRequests:MAX_REQUESTS}});
        requests++; let url=`https://fapi.binance.com/fapi/v1/fundingRate?symbol=${clean}&limit=1000`; if(current!==undefined)url+=`&startTime=${current}`; if(end)url+=`&endTime=${end}`;
        const resp=await fetch(url,{signal:AbortSignal.timeout(6000)}); if(!resp.ok)throw new Error(`Binance funding API returned HTTP ${resp.status}`); const data=await resp.json(); if(!Array.isArray(data)||data.length===0)break;
        for(const item of data){const ts=Number(item.fundingTime);if(!Number.isFinite(ts)||map.has(ts))continue;map.set(ts,{timestamp:ts,time:new Date(ts).toISOString().slice(0,16).replace('T',' '),symbol:item.symbol,rate:Number(item.fundingRate),markPrice:item.markPrice?Number(item.markPrice):undefined,intervalHours:8});}
        const lastTs=Number(data[data.length-1].fundingTime); if(!Number.isFinite(lastTs)||lastTs<=(current??0)||data.length<1000||lastTs>=end)break; current=lastTs+1; await new Promise(r=>setTimeout(r,60));
      }
      return Array.from(map.values()).sort((a,b)=>a.timestamp-b.timestamp);
    } catch(err:any) {
      if(err instanceof MarketDataError) throw err;
      throw new MarketDataError('FUNDING_DATA_MISSING',`Historical funding data unavailable for ${symbol} on Binance.`,err.message||String(err),true,{symbol,context:{start,end}});
    }
  }
}

export class BybitFundingProvider implements IFundingProvider {
  public async getHistoricalFundingRates(symbol:string,options?:FundingRateQueryOptions):Promise<FundingRateRecord[]> {
    const clean=symbol.replace('/','').toUpperCase(); const start=options?.startTime; const end=options?.endTime ?? Date.now();
    const map=new Map<number,FundingRateRecord>(); let current=start; let requests=0; const MAX_REQUESTS=30;
    try {
      while(true){
        if(requests>=MAX_REQUESTS)throw new MarketDataError('PAGINATION_LIMIT',`Bybit funding pagination limit reached before the requested interval completed.`,undefined,false,{symbol,expected:`funding data through ${end}`,actual:map.size,context:{requests,maxRequests:MAX_REQUESTS}});
        requests++; let url=`https://api.bybit.com/v5/market/funding/history?category=linear&symbol=${clean}&limit=200`; if(current!==undefined)url+=`&startTime=${current}`; if(end)url+=`&endTime=${end}`;
        const resp=await fetch(url,{signal:AbortSignal.timeout(6000)}); if(!resp.ok)throw new Error(`Bybit funding API returned HTTP ${resp.status}`); const data=await resp.json(); if(data.retCode!==0&&data.retCode!==undefined)throw new Error(`Bybit error [${data.retCode}]: ${data.retMsg}`); const list=data?.result?.list; if(!Array.isArray(list)||list.length===0)break;
        for(const item of list){const ts=Number(item.fundingRateTimestamp);if(!Number.isFinite(ts)||map.has(ts))continue;map.set(ts,{timestamp:ts,time:new Date(ts).toISOString().slice(0,16).replace('T',' '),symbol:item.symbol,rate:Number(item.fundingRate),intervalHours:8});}
        let maxTs=0;for(const item of list){const ts=Number(item.fundingRateTimestamp);if(ts>maxTs)maxTs=ts;} if(!Number.isFinite(maxTs)||maxTs<=(current??0)||list.length<200||maxTs>=end)break; current=maxTs+1; await new Promise(r=>setTimeout(r,60));
      }
      return Array.from(map.values()).sort((a,b)=>a.timestamp-b.timestamp);
    } catch(err:any) {
      if(err instanceof MarketDataError) throw err;
      throw new MarketDataError('FUNDING_DATA_MISSING',`Historical funding data unavailable for ${symbol} on Bybit.`,err.message||String(err),true,{symbol,context:{start,end}});
    }
  }
}

export class MockFundingProvider implements IFundingProvider {
  public async getHistoricalFundingRates(symbol:string,options?:FundingRateQueryOptions):Promise<FundingRateRecord[]> {
    const end=options?.endTime??Date.now(); const start=options?.startTime??(end-60*8*60*60*1000); const interval=8*60*60*1000; const first=Math.ceil(start/interval)*interval; const records:FundingRateRecord[]=[]; let idx=0;
    for(let ts=first;ts<=end;ts+=interval){idx++;const cycle=Math.sin(idx*0.18);records.push({timestamp:ts,time:new Date(ts).toISOString().slice(0,16).replace('T',' '),symbol,rate:Number((0.0001+cycle*0.00015).toFixed(6)),intervalHours:8});}
    return records;
  }
}
