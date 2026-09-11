import {
  BacktestConfig,
  BacktestResult,
  CandleData,
  Order,
  Trade,
  EquityPoint,
} from '../types/backtest';
import { MarketDataProvider, createMarketDataProvider, MockMarketDataProvider } from '../data/MarketDataProvider';
import { DataValidator } from '../data/validation/DataValidator';
import { STRATEGY_REGISTRY, QuantitativeStrategy } from '../strategies/Strategy';
import { ExecutionSimulator } from '../execution/ExecutionSimulator';
import { PortfolioManager } from '../portfolio/PortfolioManager';
import { AnalyticsEngine } from '../analytics/AnalyticsEngine';
import { ResearchEngine } from '../research/ResearchEngine';
import { DatasetMetadata, ValidationReport } from '../types/dataset';
import { ExecutionRecord, FundingEvent, LiquidationEvent, MarketDataError, FundingRateRecord } from '../types/marketData';
import { TradeLedger } from '../ledger/TradeLedger';
import { auditBacktestIntegrity } from '../core/BacktestIntegrity';
import { hashStable } from '../core/StableSerialization';

export class BacktestEngine {
  public static readonly ENGINE_VERSION = 'ApexQuant Core v4.3.0-prod';
  private config: BacktestConfig;
  private dataProvider: MarketDataProvider;
  private preloadedCandles?: CandleData[];
  private preloadedMetadata?: DatasetMetadata;
  private preloadedFunding?: FundingRateRecord[];

  constructor(config: BacktestConfig, dataProvider?: MarketDataProvider, preloaded?: { candles: CandleData[]; metadata: DatasetMetadata; fundingRates?: FundingRateRecord[] }) {
    this.config = config;
    this.dataProvider = dataProvider || createMarketDataProvider(config.exchange);
    if (preloaded) {
      this.preloadedCandles = preloaded.candles;
      this.preloadedMetadata = preloaded.metadata;
      this.preloadedFunding = preloaded.fundingRates;
    }
  }

  public static generateRunHash(config: BacktestConfig, datasetChecksum = '00000000', seed = 42, fundingChecksum = 'NONE'): string {
    const canonical = {
      engineVersion: this.ENGINE_VERSION,
      seed,
      datasetChecksum,
      fundingChecksum,
      strategyId: config.strategyId,
      exchange: config.exchange,
      symbol: config.symbol,
      timeframe: config.timeframe,
      dateRange: config.dateRange,
      initialCapital: config.initialCapital,
      leverage: config.leverage,
      marginMode: config.marginMode || 'CROSS',
      positionSizing: config.positionSizing,
      indicators: config.indicators,
      entryRules: config.entryRules,
      exitRules: config.exitRules,
      execution: config.execution,
      sameBarExecutionPolicy: config.sameBarExecutionPolicy || 'CLOSE',
      intrabarPolicy: config.intrabarPolicy || 'CONSERVATIVE',
    };
    return `APEX-${hashStable(canonical)}`;
  }

  private resolveFundingMode(metadata: DatasetMetadata): 'HISTORICAL' | 'SIMULATED' | 'IGNORED' {
    if (metadata.source === 'EXCHANGE_API') return 'HISTORICAL';
    return this.config.execution.fundingMode || 'SIMULATED';
  }

  private fundingForTimestamp(fundingRates: FundingRateRecord[], previousTimestamp: number, currentTimestamp: number): FundingRateRecord[] {
    return fundingRates.filter((rate) => rate.timestamp > previousTimestamp && rate.timestamp <= currentTimestamp);
  }

  public runSimulation(rawCandles: CandleData[], datasetMetadata: DatasetMetadata, onProgress?: (pct: number, msg: string) => void, fundingRates: FundingRateRecord[] = []): BacktestResult {
    const logs: string[] = [];
    const timestamp = datasetMetadata.actualStart || rawCandles[0]?.time || new Date(0).toISOString();
    const engineVersion = BacktestEngine.ENGINE_VERSION;
    const fundingMode = this.resolveFundingMode(datasetMetadata);

    logs.push(`[SYSTEM] Starting deterministic backtest execution`);
    logs.push(`[CONFIG] Strategy: ${this.config.strategyId} | Asset: ${this.config.symbol} | Frame: ${this.config.timeframe}`);
    logs.push(`[ACCOUNT] Capital: $${this.config.initialCapital.toLocaleString()} | Leverage: ${this.config.leverage}x | Margin: ${this.config.marginMode || 'CROSS'}`);
    logs.push(`[EXECUTION] Maker: ${this.config.execution.makerFeeBps} bps | Taker: ${this.config.execution.takerFeeBps} bps | Slippage: ${this.config.execution.slippageBps} bps`);
    logs.push(`[FUNDING] Mode: ${fundingMode}`);

    onProgress?.(15, 'Auditing historical dataset integrity & range coverage...');
    const validation: ValidationReport = DataValidator.validate(rawCandles, this.config.timeframe, { requestedStart: this.config.dateRange.start, requestedEnd: this.config.dateRange.end });
    if (!validation.valid) throw new MarketDataError('DATASET_INVALID', `Backtest blocked: ${validation.errors[0]}`, undefined, false, { symbol: this.config.symbol, expected: validation.statistics.expectedRowCount, actual: validation.statistics.actualRowCount, context: { errors: validation.errors } });
    if (datasetMetadata.source === 'EXCHANGE_API' && datasetMetadata.isSynthetic) throw new MarketDataError('DATASET_INVALID', 'Historical exchange dataset is marked synthetic.', undefined, false, { symbol: this.config.symbol, actual: datasetMetadata });
    if (datasetMetadata.source === 'EXCHANGE_API' && this.config.marketType !== 'SPOT') {
      if (fundingMode !== 'HISTORICAL' || fundingRates.length === 0) throw new MarketDataError('FUNDING_DATA_MISSING', `Historical perpetual backtest requires historical funding data for ${this.config.symbol}.`, undefined, false, { symbol: this.config.symbol, expected: 'non-empty historical funding records', actual: fundingRates.length, context: { fundingMode } });
    }

    onProgress?.(30, 'Initializing quantitative strategy and indicators...');
    const strategy: QuantitativeStrategy | undefined = STRATEGY_REGISTRY[this.config.strategyId];
    if (!strategy) throw new MarketDataError('INVALID_CONFIGURATION', `Unknown strategy ID: ${this.config.strategyId}. No strategy fallback is permitted.`);
    logs.push(`[STRATEGY] Initialized ${strategy.name} (${strategy.version})`);
    const activeParams = { ...strategy.defaultParams, ...this.config.indicators, ...this.config.entryRules, ...this.config.exitRules };
    const candles = strategy.prepare(rawCandles, activeParams);

    const execution = new ExecutionSimulator(this.config);
    const portfolio = new PortfolioManager(this.config);
    const ledger = new TradeLedger(this.config.initialCapital, candles[0].time, candles[0].timestamp);
    const orders: Order[] = [];
    const fundingEvents: FundingEvent[] = [];
    const liquidationEvents: LiquidationEvent[] = [];
    const equityCurve: EquityPoint[] = [];
    let tradeCounter = 1000;
    let activeTradeMetadata: { tradeId:string; entryBarIndex:number; entryTime:string; entryExecutionId?:string; stopLossPrice?:number; takeProfitPrice?:number; trailingStopAtr?:number; highestPriceSinceEntry:number; lowestPriceSinceEntry:number } | null = null;
    const startBenchmarkPrice = candles[0]?.close || 1;

    onProgress?.(50, 'Executing deterministic bar-by-bar matching & risk engine...');
    for(let i=0;i<candles.length;i++){
      const bar=candles[i]; const prevBar=i>0?candles[i-1]:null; let currentPos=portfolio.getPosition(this.config.symbol);

      // Deterministic order: funding -> existing-position risk -> protective exits -> liquidation -> signal -> order/execution -> position/fees -> equity -> ledger/analytics.
      if(currentPos && prevBar && fundingMode!=='IGNORED'){
        const dueRates=this.fundingForTimestamp(fundingRates,prevBar.timestamp,bar.timestamp);
        if(fundingMode==='HISTORICAL' && dueRates.length===0 && fundingRates.some(r=>r.timestamp>prevBar.timestamp&&r.timestamp<=bar.timestamp)) throw new MarketDataError('FUNDING_DATA_MISSING','Funding timestamp alignment failed.',undefined,false,{timestamp:bar.timestamp,symbol:this.config.symbol});
        for(const rate of dueRates){
          const markPrice=rate.markPrice??bar.close; const notional=Math.abs(currentPos.size*markPrice); const payment=Number((notional*rate.rate*(currentPos.side==='LONG'?1:-1)).toFixed(8)); const cashBefore=portfolio.getCash(); portfolio.applyFundingPayment(payment); const cashAfter=portfolio.getCash();
          const evt:FundingEvent={timestamp:rate.timestamp,time:rate.time,symbol:currentPos.symbol,rate:rate.rate,markPrice,intervalHours:rate.intervalHours,positionNotional:notional,payment,side:currentPos.side,cashBefore,cashAfter}; fundingEvents.push(evt);
          ledger.recordCashTx(rate.timestamp,rate.time,'FUNDING',-payment,cashAfter,`Historical funding ${payment>0?'paid':'received'} $${Math.abs(payment).toFixed(8)}`);
        }
      }

      if(currentPos){
        const risk=portfolio.updateBar(bar,this.config.symbol);
        if(risk.liquidated){
          const liq=portfolio.forceLiquidate(this.config.symbol,bar,activeTradeMetadata?.tradeId||`TRD-${++tradeCounter}`);
          if(liq){ liquidationEvents.push(liq.liquidationEvent); ledger.recordTrade(liq.trade,activeTradeMetadata?.entryExecutionId?[activeTradeMetadata.entryExecutionId]:[],[]); ledger.recordCashTx(bar.timestamp,bar.time,'LIQUIDATION',liq.trade.netPnl,portfolio.getCash(),`Forced liquidation: ${liq.liquidationEvent.reason}`); activeTradeMetadata=null; currentPos=null; }
        }
      }

      if(currentPos && activeTradeMetadata){
        if(bar.high>activeTradeMetadata.highestPriceSinceEntry)activeTradeMetadata.highestPriceSinceEntry=bar.high;
        if(bar.low<activeTradeMetadata.lowestPriceSinceEntry)activeTradeMetadata.lowestPriceSinceEntry=bar.low;
        // Conservative intrabar policy: stops are evaluated before targets; trailing stops use prior-bar ATR/close only.
        if(activeTradeMetadata.trailingStopAtr && prevBar?.atr){
          const trailDist=prevBar.atr*activeTradeMetadata.trailingStopAtr; const reference=prevBar.close;
          const newSl=currentPos.side==='LONG'?Number((reference-trailDist).toFixed(8)):Number((reference+trailDist).toFixed(8));
          if(!activeTradeMetadata.stopLossPrice || (currentPos.side==='LONG'?newSl>activeTradeMetadata.stopLossPrice:newSl<activeTradeMetadata.stopLossPrice))activeTradeMetadata.stopLossPrice=newSl;
        }
        let shouldExit=false; let exitPrice=bar.close; let exitReason:Trade['exitReason']='SIGNAL_REVERSAL';
        const stop=activeTradeMetadata.stopLossPrice; const tp=activeTradeMetadata.takeProfitPrice;
        if(currentPos.side==='LONG'){
          if(stop && bar.open<=stop){shouldExit=true;exitPrice=bar.open;exitReason='STOP_LOSS';}
          else if(stop && bar.low<=stop){shouldExit=true;exitPrice=stop;exitReason='STOP_LOSS';}
          else if(tp && bar.open>=tp){shouldExit=true;exitPrice=bar.open;exitReason='TAKE_PROFIT';}
          else if(tp && bar.high>=tp){shouldExit=true;exitPrice=tp;exitReason='TAKE_PROFIT';}
        }else{
          if(stop && bar.open>=stop){shouldExit=true;exitPrice=bar.open;exitReason='STOP_LOSS';}
          else if(stop && bar.high>=stop){shouldExit=true;exitPrice=stop;exitReason='STOP_LOSS';}
          else if(tp && bar.open<=tp){shouldExit=true;exitPrice=bar.open;exitReason='TAKE_PROFIT';}
          else if(tp && bar.low<=tp){shouldExit=true;exitPrice=tp;exitReason='TAKE_PROFIT';}
        }
        if(shouldExit){
          const exitFill=execution.fillMarketOrder({...bar,close:exitPrice},currentPos.side==='LONG'?'SELL':'BUY',currentPos.notional,activeTradeMetadata.tradeId); orders.push(exitFill.order);
          const closed=portfolio.closePosition(this.config.symbol,exitFill.fillPrice,bar.time,exitFill.feePaid,exitFill.slippagePaid,0,exitReason,i-activeTradeMetadata.entryBarIndex,0,0,activeTradeMetadata.tradeId);
          if(closed){ closed.timestamp=activeTradeMetadata.entryTime; ledger.recordTrade(closed,activeTradeMetadata.entryExecutionId?[activeTradeMetadata.entryExecutionId]:[],[exitFill.executionRecord.executionId]); if(exitFill.feePaid>0)ledger.recordCashTx(bar.timestamp,bar.time,'ORDER_FEE',-exitFill.feePaid,portfolio.getCash(),`Fee paid for ${exitFill.order.id}`); ledger.recordCashTx(bar.timestamp,bar.time,'REALIZED_PNL',closed.pnl,portfolio.getCash(),`Realized P&L via ${closed.exitReason}`); }
          activeTradeMetadata=null; currentPos=null;
        }
      }

      const signal=strategy.onBar(i,candles,{symbol:this.config.symbol,timeframe:this.config.timeframe,leverage:this.config.leverage,allowShorting:this.config.entryRules.allowShorting,position:currentPos,cash:portfolio.getCash(),equity:portfolio.getCash() + (currentPos?.unrealizedPnl||0)},activeParams);
      if((signal.action==='BUY'||signal.action==='SELL')&&!currentPos){
        const side=signal.side||(signal.action==='BUY'?'LONG':'SHORT'); const tradeId=`TRD-${++tradeCounter}`; const sizing=this.config.positionSizing; const notionalUsd=sizing.type==='percent_equity'?portfolio.getCash()*(sizing.value/100)*this.config.leverage:sizing.value*this.config.leverage; const requiredMargin=notionalUsd/this.config.leverage;
        if(requiredMargin>portfolio.getCash())throw new MarketDataError('EXECUTION_ERROR',`Insufficient margin for order ${tradeId}.`,undefined,false,{timestamp:bar.timestamp,symbol:this.config.symbol,expected:`<= ${portfolio.getCash()}`,actual:requiredMargin,context:{notionalUsd,leverage:this.config.leverage}});
        const fill=execution.fillMarketOrder(bar,side==='LONG'?'BUY':'SELL',notionalUsd,tradeId); orders.push(fill.order); const filledQty=fill.order.filledAmount??fill.order.amount;
        if(filledQty<=0)throw new MarketDataError('EXECUTION_ERROR',`Order ${fill.order.id} produced zero fill.`,undefined,false,{timestamp:bar.timestamp,symbol:this.config.symbol,expected:'> 0',actual:filledQty});
        portfolio.openPosition(this.config.symbol,side,filledQty,fill.fillPrice,fill.feePaid,fill.slippagePaid); if(fill.feePaid>0)ledger.recordCashTx(bar.timestamp,bar.time,'ORDER_FEE',-fill.feePaid,portfolio.getCash(),`Fee paid for order ${fill.order.id}`);
        activeTradeMetadata={tradeId,entryBarIndex:i,entryTime:bar.time,entryExecutionId:fill.executionRecord.executionId,stopLossPrice:signal.stopLossPrice,takeProfitPrice:signal.takeProfitPrice,trailingStopAtr:signal.trailingStopAtr,highestPriceSinceEntry:fill.fillPrice,lowestPriceSinceEntry:fill.fillPrice};
      } else if(signal.action==='CLOSE'&&currentPos&&activeTradeMetadata){
        const exitFill=execution.fillMarketOrder(bar,currentPos.side==='LONG'?'SELL':'BUY',currentPos.notional,activeTradeMetadata.tradeId); orders.push(exitFill.order); const closed=portfolio.closePosition(this.config.symbol,exitFill.fillPrice,bar.time,exitFill.feePaid,exitFill.slippagePaid,0,'SIGNAL_REVERSAL',i-activeTradeMetadata.entryBarIndex,0,0,activeTradeMetadata.tradeId);
        if(closed){closed.timestamp=activeTradeMetadata.entryTime;ledger.recordTrade(closed,activeTradeMetadata.entryExecutionId?[activeTradeMetadata.entryExecutionId]:[],[exitFill.executionRecord.executionId]);if(exitFill.feePaid>0)ledger.recordCashTx(bar.timestamp,bar.time,'ORDER_FEE',-exitFill.feePaid,portfolio.getCash(),`Fee paid for ${exitFill.order.id}`);ledger.recordCashTx(bar.timestamp,bar.time,'REALIZED_PNL',closed.pnl,portfolio.getCash(),`Realized P&L via SIGNAL_REVERSAL`);}
        activeTradeMetadata=null;
      }

      const currentPoint=portfolio.getSnapshot(bar.time,bar.close,startBenchmarkPrice,bar.timestamp); equityCurve.push(currentPoint);
      const posAfter=portfolio.getPosition(this.config.symbol); if(posAfter&&(!Number.isFinite(posAfter.size)||posAfter.size<0))throw new MarketDataError('ACCOUNTING_INVARIANT_FAILED','Position quantity invariant failed.',undefined,false,{timestamp:bar.timestamp,symbol:this.config.symbol,expected:'finite >= 0',actual:posAfter.size});
    }

    onProgress?.(80,'Generating risk metrics, ledger audit, and research checks...');
    const trades=portfolio.getClosedTrades(); const finalPoint=equityCurve[equityCurve.length-1]; const finalEquity=finalPoint?.equity??this.config.initialCapital; const finalPos=portfolio.getPosition(this.config.symbol);
    const invariantCheck=ledger.verifyInvariants(this.config.initialCapital,portfolio.getCash(),finalEquity,finalPos?finalPos.unrealizedPnl:0);
    if(!invariantCheck.passed)throw new MarketDataError('ACCOUNTING_INVARIANT_FAILED',invariantCheck.errors[0],undefined,false,{timestamp:finalPoint?.timestamp,symbol:this.config.symbol,expected:'ledger/equity reconciliation',actual:invariantCheck.errors,context:{errors:invariantCheck.errors}});

    const metrics=AnalyticsEngine.calculateMetrics(equityCurve,trades,this.config.initialCapital,portfolio.getTotalFees(),portfolio.getTotalFunding(),portfolio.getTotalSlippage());
    const monthlyReturns=AnalyticsEngine.calculateMonthlyReturns(equityCurve);
    const validationWarnings=ResearchEngine.evaluateValidation(this.config,candles,trades,equityCurve);
    const checksum=datasetMetadata.checksum||DataValidator.calculateChecksum(rawCandles);
    const fundingChecksum=fundingRates.length?hashStable(fundingRates):'NONE';
    const reproducibilityHash=BacktestEngine.generateRunHash(this.config,checksum,datasetMetadata.seed||42,fundingChecksum);
    const runId=`RUN-${reproducibilityHash.slice(5)}-${hashStable({checksum,tradeCount:trades.length,executionCount:execution.getExecutionRecords().length}) .slice(0,6)}`;
    const audit=auditBacktestIntegrity(this.config,rawCandles,datasetMetadata,execution.getExecutionRecords(),trades,equityCurve,fundingEvents,liquidationEvents,ledger,portfolio.getCash(),this.config.initialCapital);
    if(!audit.passed)throw new MarketDataError('ACCOUNTING_INVARIANT_FAILED',audit.errors[0].message,undefined,false,{timestamp:audit.errors[0].timestamp,symbol:audit.errors[0].symbol,expected:audit.errors[0].expected,actual:audit.errors[0].actual,context:audit.errors[0].context});
    onProgress?.(100,'Backtest simulation complete.');
    return {runId,timestamp,reproducibilityHash,engineVersion,isDeterministic:true,dataset:datasetMetadata,config:this.config,candles,trades,orders,equityCurve,metrics,monthlyReturns,validationWarnings,logs,executionRecords:execution.getExecutionRecords(),fundingEvents,liquidationEvents,tradeLedger:ledger.getEntries(),invariantsPassed:true,invariantCheckErrors:[] ,integrity:{datasetComplete:true,historicalFunding:fundingMode==='HISTORICAL',accountingReconciled:true,deterministic:true,critical:false,warnings:validationWarnings.map(v=>v.message),errors:[]}};
  }

  public executeSync(onProgress?: (pct:number,msg:string)=>void): BacktestResult {
    if(this.preloadedCandles&&this.preloadedMetadata)return this.runSimulation(this.preloadedCandles,this.preloadedMetadata,onProgress,this.preloadedFunding||[]);
    if(this.dataProvider instanceof MockMarketDataProvider) { const res=this.dataProvider.loadCandlesSync(this.config.symbol,this.config.timeframe,this.config.dateRange.start,this.config.dateRange.end,{seed:20250228,count:180}); return this.runSimulation(res.candles,res.metadata,onProgress,this.preloadedFunding||[]); }
    throw new MarketDataError('INVALID_CONFIGURATION','executeSync requires an explicit preloaded dataset or Mock Demo provider. Use async execute() for historical exchange data.');
  }

  public async execute(onProgress?: (pct:number,msg:string)=>void):Promise<BacktestResult>{
    if(this.preloadedCandles&&this.preloadedMetadata)return this.runSimulation(this.preloadedCandles,this.preloadedMetadata,onProgress,this.preloadedFunding||[]);
    onProgress?.(10,`Connecting to ${this.dataProvider.name}...`);
    const res=await this.dataProvider.getCandles(this.config.symbol,this.config.timeframe,this.config.dateRange.start,this.config.dateRange.end,{count:180});
    const fundingMode=this.resolveFundingMode(res.metadata);
    const fundingRates=fundingMode==='IGNORED'?[]:await this.dataProvider.getFundingRates(this.config.symbol,{startTime:new Date(this.config.dateRange.start).getTime(),endTime:new Date(this.config.dateRange.end).getTime()});
    if(fundingMode==='HISTORICAL'&&this.config.exchange.toLowerCase()!=='mock'&&fundingRates.length===0)throw new MarketDataError('FUNDING_DATA_MISSING',`No historical funding records returned for ${this.config.symbol}. Historical perpetual backtest is blocked.`,undefined,false,{symbol:this.config.symbol});
    return this.runSimulation(res.candles,res.metadata,onProgress,fundingRates);
  }
}
