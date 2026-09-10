import {
  BacktestConfig,
  BacktestResult,
  CandleData,
  Order,
  Trade,
} from '../types/backtest';
import { MarketDataProvider, MockMarketDataProvider } from '../data/MarketDataProvider';
import { DataValidator } from '../data/validation/DataValidator';
import { STRATEGY_REGISTRY, QuantitativeStrategy, EmaCrossoverStrategy } from '../strategies/Strategy';
import { ExecutionSimulator } from '../execution/ExecutionSimulator';
import { PortfolioManager } from '../portfolio/PortfolioManager';
import { AnalyticsEngine } from '../analytics/AnalyticsEngine';
import { ResearchEngine } from '../research/ResearchEngine';
import { DatasetMetadata, ValidationReport } from '../types/dataset';
import { MarketDataError } from '../types/marketData';

export class BacktestEngine {
  public static readonly ENGINE_VERSION = 'ApexQuant Core v4.3.0-prod';
  private config: BacktestConfig;
  private dataProvider: MarketDataProvider;
  private preloadedCandles?: CandleData[];
  private preloadedMetadata?: DatasetMetadata;

  constructor(
    config: BacktestConfig,
    dataProvider?: MarketDataProvider,
    preloaded?: { candles: CandleData[]; metadata: DatasetMetadata }
  ) {
    this.config = config;
    this.dataProvider = dataProvider || new MockMarketDataProvider();
    if (preloaded) {
      this.preloadedCandles = preloaded.candles;
      this.preloadedMetadata = preloaded.metadata;
    }
  }

  /**
   * Deterministic Hash for Run Reproducibility
   * Integrates engine version, strategy version, params, exchange, market, symbol, timeframe,
   * dataset checksum/seed, initial capital, leverage, margin, fees, and slippage.
   */
  public static generateRunHash(
    config: BacktestConfig,
    datasetChecksum: string = '00000000',
    seed: number = 42
  ): string {
    const raw = [
      this.ENGINE_VERSION,
      config.strategyId,
      config.exchange || 'MOCK',
      config.symbol,
      config.timeframe,
      config.dateRange.start,
      config.dateRange.end,
      datasetChecksum,
      config.initialCapital,
      config.leverage,
      config.marginMode || 'CROSS',
      config.execution.makerFeeBps,
      config.execution.takerFeeBps,
      config.execution.slippageBps,
      config.execution.slippageModel,
      JSON.stringify(config.indicators),
      JSON.stringify(config.entryRules),
      JSON.stringify(config.exitRules),
      seed,
    ].join('::');

    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = ((hash << 5) - hash) + raw.charCodeAt(i);
      hash |= 0;
    }
    return `APEX-${Math.abs(hash).toString(16).toUpperCase().padStart(8, '0')}`;
  }

  /**
   * Core event-driven simulation loop executed against validated candles and dataset metadata
   */
  public runSimulation(
    rawCandles: CandleData[],
    datasetMetadata: DatasetMetadata,
    onProgress?: (pct: number, msg: string) => void
  ): BacktestResult {
    const logs: string[] = [];
    const timestamp = new Date().toISOString();
    const engineVersion = BacktestEngine.ENGINE_VERSION;

    logs.push(`[SYSTEM] Starting deterministic backtest execution at ${timestamp}`);
    logs.push(`[CONFIG] Strategy: ${this.config.strategyId} | Asset: ${this.config.symbol} | Frame: ${this.config.timeframe}`);
    logs.push(`[ACCOUNT] Capital: $${this.config.initialCapital.toLocaleString()} | Leverage: ${this.config.leverage}x | Margin: ${this.config.marginMode || 'CROSS'}`);
    logs.push(`[EXECUTION] Maker: ${this.config.execution.makerFeeBps} bps | Taker: ${this.config.execution.takerFeeBps} bps | Slippage: ${this.config.execution.slippageBps} bps`);

    // 1. DATA LAYER AUDIT & VALIDATION
    onProgress?.(15, 'Validating historical dataset integrity...');
    const validation: ValidationReport = DataValidator.validate(rawCandles, this.config.timeframe);

    logs.push(`[DATA] Dataset: ${datasetMetadata.name || datasetMetadata.symbol} (${rawCandles.length} bars, Source: ${datasetMetadata.source})`);
    logs.push(`[DATA] Range: ${datasetMetadata.startTime || rawCandles[0]?.time} → ${datasetMetadata.endTime || rawCandles[rawCandles.length - 1]?.time}`);

    if (!validation.valid) {
      logs.push(`[VALIDATION] BLOCKED: Critical data integrity errors detected:`);
      validation.errors.forEach((err) => logs.push(`[VALIDATION-ERROR] ${err}`));
      throw new MarketDataError(
        'INVALID_DATA',
        `Backtest blocked due to ${validation.errors.length} critical data integrity violations in dataset: ${validation.errors[0]}`
      );
    }

    if (validation.warnings.length > 0) {
      logs.push(`[VALIDATION] Passed with ${validation.warnings.length} non-critical warning(s).`);
      validation.warnings.forEach((w) => logs.push(`[VALIDATION-WARN] ${w}`));
    } else {
      logs.push(`[VALIDATION] Dataset verified: 100% OHLC continuity, timestamps strictly chronological.`);
    }

    // 2. STRATEGY SELECTION & INDICATOR PREPARATION
    onProgress?.(35, 'Initializing quantitative strategy and indicators...');
    const strategy: QuantitativeStrategy =
      STRATEGY_REGISTRY[this.config.strategyId] || new EmaCrossoverStrategy();

    logs.push(`[STRATEGY] Initialized ${strategy.name} (${strategy.version})`);

    const activeParams = {
      ...strategy.defaultParams,
      ...this.config.indicators,
      ...this.config.entryRules,
      ...this.config.exitRules,
    };

    const candles = strategy.prepare(rawCandles, activeParams);

    // 3. EXECUTION & PORTFOLIO ENGINE SETUP
    const execution = new ExecutionSimulator(this.config);
    const portfolio = new PortfolioManager(this.config);
    const orders: Order[] = [];
    let tradeCounter = 1000;
    let activeTradeMetadata: {
      tradeId: string;
      entryBarIndex: number;
      entryTime: string;
      stopLossPrice?: number;
      takeProfitPrice?: number;
      trailingStopAtr?: number;
      highestPriceSinceEntry: number;
      lowestPriceSinceEntry: number;
    } | null = null;

    const startBenchmarkPrice = candles[0]?.close || 1;

    onProgress?.(55, 'Executing bar-by-bar matching engine & risk policies...');

    // 4. EVENT-DRIVEN BAR-BY-BAR LOOP
    for (let i = 0; i < candles.length; i++) {
      const bar = candles[i];
      const currentPos = portfolio.getPosition(this.config.symbol);

      // A. Check Liquidation on current bar
      if (currentPos) {
        const { liquidated, liquidationReason } = portfolio.updateBar(bar, this.config.symbol);
        if (liquidated) {
          const liqFill = execution.fillMarketOrder(
            bar,
            currentPos.side === 'LONG' ? 'SELL' : 'BUY',
            currentPos.notional,
            activeTradeMetadata?.tradeId || `TRD-${tradeCounter}`
          );
          orders.push(liqFill.order);

          const closedTrade = portfolio.closePosition(
            this.config.symbol,
            currentPos.liquidationPrice,
            bar.time,
            liqFill.feePaid,
            liqFill.slippagePaid,
            0,
            'LIQUIDATION',
            i - (activeTradeMetadata?.entryBarIndex || i),
            0,
            -100,
            activeTradeMetadata?.tradeId || `TRD-${tradeCounter}`
          );

          if (closedTrade) {
            bar.marker = {
              id: `marker-${closedTrade.id}`,
              time: bar.time,
              position: currentPos.side === 'LONG' ? 'belowBar' : 'aboveBar',
              color: '#f43f5e',
              shape: 'circle',
              text: 'LIQUIDATION',
              price: currentPos.liquidationPrice,
              side: 'EXIT',
              pnl: closedTrade.netPnl,
            };
          }

          logs.push(`[RISK] LIQUIDATION triggered @ Bar ${i} (${bar.time}): ${liquidationReason}`);
          activeTradeMetadata = null;
          continue;
        }

        // B. Excursions & Trailing Stop Updates
        if (activeTradeMetadata) {
          if (bar.high > activeTradeMetadata.highestPriceSinceEntry) {
            activeTradeMetadata.highestPriceSinceEntry = bar.high;
          }
          if (bar.low < activeTradeMetadata.lowestPriceSinceEntry) {
            activeTradeMetadata.lowestPriceSinceEntry = bar.low;
          }

          // Dynamic Trailing Stop Adjustment
          if (activeTradeMetadata.trailingStopAtr && bar.atr) {
            const trailDist = bar.atr * activeTradeMetadata.trailingStopAtr;
            if (currentPos.side === 'LONG') {
              const newSl = Number((bar.close - trailDist).toFixed(2));
              if (!activeTradeMetadata.stopLossPrice || newSl > activeTradeMetadata.stopLossPrice) {
                activeTradeMetadata.stopLossPrice = newSl;
              }
            } else {
              const newSl = Number((bar.close + trailDist).toFixed(2));
              if (!activeTradeMetadata.stopLossPrice || newSl < activeTradeMetadata.stopLossPrice) {
                activeTradeMetadata.stopLossPrice = newSl;
              }
            }
          }

          // C. Stop Loss & Take Profit Trigger Checks
          let shouldExit = false;
          let exitPrice = bar.close;
          let exitReason: Trade['exitReason'] = 'SIGNAL_REVERSAL';

          if (currentPos.side === 'LONG') {
            if (activeTradeMetadata.stopLossPrice && bar.low <= activeTradeMetadata.stopLossPrice) {
              shouldExit = true;
              exitPrice = activeTradeMetadata.stopLossPrice;
              exitReason = 'STOP_LOSS';
            } else if (activeTradeMetadata.takeProfitPrice && bar.high >= activeTradeMetadata.takeProfitPrice) {
              shouldExit = true;
              exitPrice = activeTradeMetadata.takeProfitPrice;
              exitReason = 'TAKE_PROFIT';
            }
          } else {
            if (activeTradeMetadata.stopLossPrice && bar.high >= activeTradeMetadata.stopLossPrice) {
              shouldExit = true;
              exitPrice = activeTradeMetadata.stopLossPrice;
              exitReason = 'STOP_LOSS';
            } else if (activeTradeMetadata.takeProfitPrice && bar.low <= activeTradeMetadata.takeProfitPrice) {
              shouldExit = true;
              exitPrice = activeTradeMetadata.takeProfitPrice;
              exitReason = 'TAKE_PROFIT';
            }
          }

          if (shouldExit) {
            const exitFill = execution.fillMarketOrder(
              { ...bar, close: exitPrice },
              currentPos.side === 'LONG' ? 'SELL' : 'BUY',
              currentPos.notional,
              activeTradeMetadata.tradeId
            );
            orders.push(exitFill.order);

            const durationBars = i - activeTradeMetadata.entryBarIndex;
            const funding = execution.calculateFundingPayment(
              currentPos.notional,
              currentPos.side,
              durationBars,
              this.config.timeframe
            );

            const mfe = currentPos.side === 'LONG'
              ? ((activeTradeMetadata.highestPriceSinceEntry - currentPos.entryPrice) / currentPos.entryPrice) * 100
              : ((currentPos.entryPrice - activeTradeMetadata.lowestPriceSinceEntry) / currentPos.entryPrice) * 100;

            const mae = currentPos.side === 'LONG'
              ? ((activeTradeMetadata.lowestPriceSinceEntry - currentPos.entryPrice) / currentPos.entryPrice) * 100
              : ((currentPos.entryPrice - activeTradeMetadata.highestPriceSinceEntry) / currentPos.entryPrice) * 100;

            const closedTrade = portfolio.closePosition(
              this.config.symbol,
              exitPrice,
              bar.time,
              exitFill.feePaid,
              exitFill.slippagePaid,
              funding,
              exitReason,
              durationBars,
              mfe,
              mae,
              activeTradeMetadata.tradeId
            );

            if (closedTrade) {
              closedTrade.timestamp = activeTradeMetadata.entryTime;
              bar.marker = {
                id: `marker-${closedTrade.id}`,
                time: bar.time,
                position: currentPos.side === 'LONG' ? 'aboveBar' : 'belowBar',
                color: closedTrade.netPnl >= 0 ? '#10b981' : '#f43f5e',
                shape: 'circle',
                text: `${exitReason.replace('_', ' ')} (${closedTrade.netPnl >= 0 ? '+' : ''}$${closedTrade.netPnl})`,
                price: exitPrice,
                side: 'EXIT',
                pnl: closedTrade.netPnl,
              };
              logs.push(`[FILL] Trade ${closedTrade.id} closed @ $${exitPrice} via ${exitReason}. Net P&L: $${closedTrade.netPnl}`);
            }

            activeTradeMetadata = null;
            continue;
          }
        }
      }

      // D. Generate Strategy Signal
      const signal = strategy.onBar(
        i,
        candles,
        {
          symbol: this.config.symbol,
          timeframe: this.config.timeframe,
          leverage: this.config.leverage,
          allowShorting: this.config.entryRules.allowShorting,
          position: currentPos,
          cash: portfolio.getCash(),
          equity: portfolio.getCash(),
        },
        activeParams
      );

      // E. Execute Strategy Signal
      if (signal.action === 'BUY' || signal.action === 'SELL') {
        if (!currentPos) {
          const side = signal.side || (signal.action === 'BUY' ? 'LONG' : 'SHORT');
          const tradeId = `TRD-${++tradeCounter}`;

          // Position Sizing calculation
          const sizing = this.config.positionSizing;
          let notionalUsd = 25000;
          if (sizing.type === 'percent_equity') {
            notionalUsd = portfolio.getCash() * (sizing.value / 100) * this.config.leverage;
          } else {
            notionalUsd = sizing.value * this.config.leverage;
          }

          // Pre-Trade Margin Check
          const requiredMargin = notionalUsd / this.config.leverage;
          if (requiredMargin <= portfolio.getCash()) {
            const fill = execution.fillMarketOrder(
              bar,
              side === 'LONG' ? 'BUY' : 'SELL',
              notionalUsd,
              tradeId
            );
            orders.push(fill.order);

            portfolio.openPosition(
              this.config.symbol,
              side,
              fill.order.amount,
              fill.fillPrice,
              fill.feePaid,
              fill.slippagePaid
            );

            activeTradeMetadata = {
              tradeId,
              entryBarIndex: i,
              entryTime: bar.time,
              stopLossPrice: signal.stopLossPrice,
              takeProfitPrice: signal.takeProfitPrice,
              trailingStopAtr: signal.trailingStopAtr,
              highestPriceSinceEntry: fill.fillPrice,
              lowestPriceSinceEntry: fill.fillPrice,
            };

            bar.marker = {
              id: `marker-${tradeId}`,
              time: bar.time,
              position: side === 'LONG' ? 'belowBar' : 'aboveBar',
              color: side === 'LONG' ? '#10b981' : '#38bdf8',
              shape: side === 'LONG' ? 'arrowUp' : 'arrowDown',
              text: `${side} @ $${fill.fillPrice}`,
              price: fill.fillPrice,
              side: side === 'LONG' ? 'BUY' : 'SELL',
            };

            logs.push(`[ORDER] Signal: ${signal.action} ${side} submitted | [FILL] Executed @ $${fill.fillPrice} (Fee: $${fill.feePaid})`);
          }
        }
      } else if (signal.action === 'CLOSE' && currentPos && activeTradeMetadata) {
        const exitFill = execution.fillMarketOrder(
          bar,
          currentPos.side === 'LONG' ? 'SELL' : 'BUY',
          currentPos.notional,
          activeTradeMetadata.tradeId
        );
        orders.push(exitFill.order);

        const durationBars = i - activeTradeMetadata.entryBarIndex;
        const funding = execution.calculateFundingPayment(
          currentPos.notional,
          currentPos.side,
          durationBars,
          this.config.timeframe
        );

        const mfe = currentPos.side === 'LONG'
          ? ((activeTradeMetadata.highestPriceSinceEntry - currentPos.entryPrice) / currentPos.entryPrice) * 100
          : ((currentPos.entryPrice - activeTradeMetadata.lowestPriceSinceEntry) / currentPos.entryPrice) * 100;

        const mae = currentPos.side === 'LONG'
          ? ((activeTradeMetadata.lowestPriceSinceEntry - currentPos.entryPrice) / currentPos.entryPrice) * 100
          : ((currentPos.entryPrice - activeTradeMetadata.highestPriceSinceEntry) / currentPos.entryPrice) * 100;

        const closedTrade = portfolio.closePosition(
          this.config.symbol,
          exitFill.fillPrice,
          bar.time,
          exitFill.feePaid,
          exitFill.slippagePaid,
          funding,
          'SIGNAL_REVERSAL',
          durationBars,
          mfe,
          mae,
          activeTradeMetadata.tradeId
        );

        if (closedTrade) {
          closedTrade.timestamp = activeTradeMetadata.entryTime;
          bar.marker = {
            id: `marker-${closedTrade.id}`,
            time: bar.time,
            position: currentPos.side === 'LONG' ? 'aboveBar' : 'belowBar',
            color: closedTrade.netPnl >= 0 ? '#10b981' : '#f43f5e',
            shape: 'circle',
            text: `CLOSE (${closedTrade.netPnl >= 0 ? '+' : ''}$${closedTrade.netPnl})`,
            price: exitFill.fillPrice,
            side: 'EXIT',
            pnl: closedTrade.netPnl,
          };
          logs.push(`[FILL] Signal close ${closedTrade.id} @ $${exitFill.fillPrice}. Net P&L: $${closedTrade.netPnl}`);
        }

        activeTradeMetadata = null;
      }
    }

    onProgress?.(80, 'Generating equity curve, risk statistics, and audit reports...');

    // 5. BUILD COMPLETE EQUITY CURVE (Benchmark calculated strictly from this exact dataset)
    const equityCurve = candles.map((c) => {
      const snap = portfolio.getSnapshot(c.time, c.close, startBenchmarkPrice);
      return snap;
    });

    const trades = portfolio.getClosedTrades();

    // 6. METRICS & MONTHLY RETURNS CALCULATION
    const metrics = AnalyticsEngine.calculateMetrics(
      equityCurve,
      trades,
      this.config.initialCapital,
      portfolio.getTotalFees(),
      portfolio.getTotalFunding(),
      portfolio.getTotalSlippage()
    );

    const monthlyReturns = AnalyticsEngine.calculateMonthlyReturns(equityCurve);

    // 7. RESEARCH VALIDATION CHECKS
    const validationWarnings = ResearchEngine.evaluateValidation(
      this.config,
      candles,
      trades,
      equityCurve
    );

    const checksum = datasetMetadata.checksum || DataValidator.calculateChecksum(rawCandles);
    const reproducibilityHash = BacktestEngine.generateRunHash(
      this.config,
      checksum,
      datasetMetadata.seed || 42
    );
    const runId = `RUN-${reproducibilityHash.slice(5, 11)}-${Date.now().toString().slice(-4)}`;

    logs.push(`[ANALYTICS] Metrics calculated: Return: ${metrics.totalReturn}% | Sharpe: ${metrics.sharpeRatio} | MaxDD: ${metrics.maxDrawdown}%`);
    logs.push(`[COMPLETE] Run ${runId} finalized successfully. Total Trades: ${trades.length}`);

    onProgress?.(100, 'Backtest simulation complete.');

    return {
      runId,
      timestamp,
      reproducibilityHash,
      engineVersion,
      isDeterministic: true,
      dataset: datasetMetadata,
      config: this.config,
      candles,
      trades,
      orders,
      equityCurve,
      metrics,
      monthlyReturns,
      validationWarnings,
      logs,
    };
  }

  /**
   * Synchronous execution method using preloaded data or MockProvider
   */
  public executeSync(onProgress?: (pct: number, msg: string) => void): BacktestResult {
    if (this.preloadedCandles && this.preloadedMetadata) {
      return this.runSimulation(this.preloadedCandles, this.preloadedMetadata, onProgress);
    }

    if (this.dataProvider instanceof MockMarketDataProvider) {
      const res = this.dataProvider.loadCandlesSync(
        this.config.symbol,
        this.config.timeframe,
        this.config.dateRange.start,
        this.config.dateRange.end,
        { seed: 20250228, count: 180 }
      );
      return this.runSimulation(res.candles, res.metadata, onProgress);
    }

    throw new MarketDataError(
      'INVALID_DATA',
      'executeSync requires preloaded dataset or MockMarketDataProvider. Use async execute() for live exchange historical providers.'
    );
  }

  /**
   * Asynchronous execution fetching from configured provider without silent fallback
   */
  public async execute(onProgress?: (pct: number, msg: string) => void): Promise<BacktestResult> {
    if (this.preloadedCandles && this.preloadedMetadata) {
      return this.runSimulation(this.preloadedCandles, this.preloadedMetadata, onProgress);
    }

    onProgress?.(10, `Connecting to ${this.dataProvider.name}...`);

    // Fetch candles from configured provider - WILL THROW if provider fails, no silent fallback
    const res = await this.dataProvider.getCandles(
      this.config.symbol,
      this.config.timeframe,
      this.config.dateRange.start,
      this.config.dateRange.end,
      { count: 180 }
    );

    return this.runSimulation(res.candles, res.metadata, onProgress);
  }
}
