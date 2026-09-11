import {
  BacktestConfig,
  BacktestResult,
  CandleData,
  Order,
  Trade,
  EquityPoint,
} from '../types/backtest';
import { MarketDataProvider, MockMarketDataProvider } from '../data/MarketDataProvider';
import { DataValidator } from '../data/validation/DataValidator';
import { STRATEGY_REGISTRY, QuantitativeStrategy, EmaCrossoverStrategy } from '../strategies/Strategy';
import { ExecutionSimulator } from '../execution/ExecutionSimulator';
import { PortfolioManager } from '../portfolio/PortfolioManager';
import { AnalyticsEngine } from '../analytics/AnalyticsEngine';
import { ResearchEngine } from '../research/ResearchEngine';
import { DatasetMetadata, ValidationReport } from '../types/dataset';
import { ExecutionRecord, FundingEvent, LiquidationEvent, MarketDataError, FundingRateRecord } from '../types/marketData';
import { TradeLedger } from '../ledger/TradeLedger';
import { PrecisionPolicy } from '../accounting/PrecisionPolicy';
import { AccountingVerifier } from '../accounting/AccountingVerifier';
import { FundingDataMissingError } from '../types/errors';

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
   * Core deterministic, institutional-grade simulation loop
   */
  public runSimulation(
    rawCandles: CandleData[],
    datasetMetadata: DatasetMetadata,
    onProgress?: (pct: number, msg: string) => void,
    simulationOptions?: { historicalFundingRates?: FundingRateRecord[] }
  ): BacktestResult {
    const logs: string[] = [];
    const timestamp = new Date().toISOString();
    const engineVersion = BacktestEngine.ENGINE_VERSION;

    logs.push(`[SYSTEM] Starting deterministic backtest execution at ${timestamp}`);
    logs.push(`[CONFIG] Strategy: ${this.config.strategyId} | Asset: ${this.config.symbol} | Frame: ${this.config.timeframe}`);
    logs.push(`[ACCOUNT] Capital: $${this.config.initialCapital.toLocaleString()} | Leverage: ${this.config.leverage}x | Margin: ${this.config.marginMode || 'CROSS'}`);
    logs.push(`[EXECUTION] Maker: ${this.config.execution.makerFeeBps} bps | Taker: ${this.config.execution.takerFeeBps} bps | Slippage: ${this.config.execution.slippageBps} bps`);

    // 1. DATA LAYER AUDIT & VALIDATION
    onProgress?.(15, 'Auditing historical dataset integrity & range coverage...');
    const validation: ValidationReport = DataValidator.validate(rawCandles, this.config.timeframe, {
      requestedStart: this.config.dateRange.start,
      requestedEnd: this.config.dateRange.end,
      allowShortFixtures: Boolean(datasetMetadata.isSynthetic || datasetMetadata.source === 'DEMO_SYNTHETIC'),
    });

    logs.push(`[DATA] Dataset: ${datasetMetadata.name || datasetMetadata.symbol} (${rawCandles.length} bars, Source: ${datasetMetadata.source})`);
    logs.push(`[DATA] Range: ${datasetMetadata.startTime || rawCandles[0]?.time} → ${datasetMetadata.endTime || rawCandles[rawCandles.length - 1]?.time}`);

    if (!validation.valid) {
      logs.push(`[VALIDATION] BLOCKED: Critical data integrity errors detected:`);
      validation.errors.forEach((err) => logs.push(`[VALIDATION-ERROR] ${err}`));
      throw new MarketDataError(
        'INVALID_DATA',
        `Backtest blocked due to ${validation.errors.length} critical data integrity violations: ${validation.errors[0]}`
      );
    }

    if (validation.warnings.length > 0) {
      logs.push(`[VALIDATION] Passed with ${validation.warnings.length} non-critical warning(s).`);
      validation.warnings.forEach((w) => logs.push(`[VALIDATION-WARN] ${w}`));
    } else {
      logs.push(`[VALIDATION] Dataset verified: 100% OHLC continuity, timestamps strictly chronological.`);
    }

    // 2. STRATEGY INITIALIZATION
    onProgress?.(30, 'Initializing quantitative strategy and indicators...');
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

    // 3. EXECUTION, PORTFOLIO & AUDIT LEDGER SETUP
    const execution = new ExecutionSimulator(this.config);
    const portfolio = new PortfolioManager(this.config);
    const ledger = new TradeLedger(this.config.initialCapital, candles[0].time, candles[0].timestamp);
    const orders: Order[] = [];
    const fundingEvents: FundingEvent[] = [];
    const liquidationEvents: LiquidationEvent[] = [];
    const equityCurve: EquityPoint[] = [];

    let tradeCounter = 1000;
    let activeTradeMetadata: {
      tradeId: string;
      entryBarIndex: number;
      entryTime: string;
      entryExecutionId?: string;
      stopLossPrice?: number;
      takeProfitPrice?: number;
      trailingStopAtr?: number;
      highestPriceSinceEntry: number;
      lowestPriceSinceEntry: number;
    } | null = null;

    const startBenchmarkPrice = candles[0]?.close || 1;
    const FUNDING_INTERVAL_MS = 8 * 3600 * 1000;

    // Build historical funding rate index if provided
    const historicalFundingMap = new Map<number, number>();
    if (simulationOptions?.historicalFundingRates) {
      for (const rec of simulationOptions.historicalFundingRates) {
        const epoch = Math.round(rec.timestamp / FUNDING_INTERVAL_MS) * FUNDING_INTERVAL_MS;
        historicalFundingMap.set(epoch, rec.rate);
      }
      logs.push(`[FUNDING] Loaded ${historicalFundingMap.size} historical funding settlement epochs.`);
    }

    onProgress?.(50, 'Executing deterministic bar-by-bar matching & risk engine...');

    // =========================================================================
    // INSTITUTIONAL 13-STEP EVENT-DRIVEN SIMULATION LOOP
    // Step 1: Market-data validation (OHLC sanity check per bar)
    // Step 2: Funding event check (8-hour epoch settlement)
    // Step 3: Existing-position risk checks (MFE / MAE updates)
    // Step 4: Stop-loss / take-profit checks (Conservative Worst-Case: SL first)
    // Step 5: Liquidation check (Maintenance Margin check & force liquidation)
    // Step 6: Strategy signal evaluation
    // Step 7: New order submission
    // Step 8: Order execution & fill simulation
    // Step 9: Position update
    // Step 10: Fee accounting
    // Step 11: Equity calculation
    // Step 12: Ledger update
    // Step 13: Analytics snapshot
    // =========================================================================
    for (let i = 0; i < candles.length; i++) {
      const bar = candles[i];
      const prevBar = i > 0 ? candles[i - 1] : null;
      let currentPos = portfolio.getPosition(this.config.symbol);

      // STEP 1: Market-Data Validation Check
      if (bar.high < bar.low || bar.open <= 0 || bar.close <= 0) {
        throw new MarketDataError('INVALID_DATA', `Corrupted OHLC on bar ${i} at ${bar.time}`);
      }

      // STEP 2: Periodic 8-Hour Funding Settlement Check
      if (currentPos && prevBar) {
        const prevEpoch = Math.floor(prevBar.timestamp / FUNDING_INTERVAL_MS);
        const currEpoch = Math.floor(bar.timestamp / FUNDING_INTERVAL_MS);

        if (currEpoch > prevEpoch) {
          const intervalsPassed = currEpoch - prevEpoch;
          for (let ep = 0; ep < intervalsPassed; ep++) {
            const fundingTs = (prevEpoch + ep + 1) * FUNDING_INTERVAL_MS;

            // Resolve funding rate
            let rateForEpoch: number;
            if (historicalFundingMap.has(fundingTs)) {
              rateForEpoch = historicalFundingMap.get(fundingTs)!;
            } else if (!datasetMetadata.isSynthetic && (this.config.execution as any).fundingMode !== 'SIMULATED') {
              if (historicalFundingMap.size > 0) {
                throw new FundingDataMissingError(
                  `Historical funding rate missing for epoch ${new Date(fundingTs).toISOString()} on ${currentPos.symbol}`,
                  { timestamp: fundingTs, symbol: currentPos.symbol }
                );
              } else {
                rateForEpoch = (this.config.execution.fundingRate8hBps ?? 1.0) / 10000;
              }
            } else {
              rateForEpoch = (this.config.execution.fundingRate8hBps ?? 1.0) / 10000;
            }

            // Long pays when funding > 0; short receives
            const multiplier = currentPos.side === 'LONG' ? 1 : -1;
            const payment = PrecisionPolicy.roundCash(currentPos.notional * rateForEpoch * multiplier);

            const cashBefore = portfolio.getCash();
            portfolio.applyFundingPayment(payment);
            const cashAfter = portfolio.getCash();

            const fundingEvent: FundingEvent = {
              timestamp: fundingTs,
              time: new Date(fundingTs).toISOString().slice(0, 16).replace('T', ' '),
              symbol: currentPos.symbol,
              rate: rateForEpoch,
              markPrice: bar.close,
              intervalHours: 8,
              positionNotional: currentPos.notional,
              payment,
              side: currentPos.side,
              cashBefore,
              cashAfter,
            };
            fundingEvents.push(fundingEvent);
            ledger.recordFundingEntry(fundingEvent);

            ledger.recordCashTx(
              fundingTs,
              bar.time,
              'FUNDING',
              -payment,
              cashAfter,
              `8h Funding settlement: ${payment > 0 ? 'Paid' : 'Received'} $${Math.abs(payment)}`
            );

            logs.push(`[FUNDING] 8h epoch settlement @ ${fundingEvent.time}: ${payment > 0 ? 'Paid' : 'Received'} $${Math.abs(payment)}`);
          }
        }
      }

      // B. Mark-to-Market & Liquidation Check
      if (currentPos) {
        const { liquidated, liquidationReason } = portfolio.updateBar(bar, this.config.symbol);
        if (liquidated) {
          const liqResult = portfolio.forceLiquidate(
            this.config.symbol,
            bar,
            activeTradeMetadata?.tradeId || `TRD-${tradeCounter}`
          );

          if (liqResult) {
            liquidationEvents.push(liqResult.liquidationEvent);
            ledger.recordTrade(
              liqResult.trade,
              activeTradeMetadata?.entryExecutionId ? [activeTradeMetadata.entryExecutionId] : [],
              []
            );
            ledger.recordCashTx(
              bar.timestamp,
              bar.time,
              'LIQUIDATION',
              liqResult.trade.netPnl,
              portfolio.getCash(),
              `Forced liquidation: ${liqResult.liquidationEvent.reason}`
            );

            bar.marker = {
              id: `marker-${liqResult.trade.id}`,
              time: bar.time,
              position: currentPos.side === 'LONG' ? 'belowBar' : 'aboveBar',
              color: '#f43f5e',
              shape: 'circle',
              text: 'LIQUIDATION',
              price: currentPos.liquidationPrice,
              side: 'EXIT',
              pnl: liqResult.trade.netPnl,
            };

            logs.push(`[RISK] LIQUIDATION triggered @ Bar ${i} (${bar.time}): ${liquidationReason}`);
            activeTradeMetadata = null;
            currentPos = null;
          }
        }
      }

      // C. Active Position Stops / Trailing Stops / Excursions
      if (currentPos && activeTradeMetadata) {
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

        // Stop Loss & Take Profit Trigger Checks
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
            0,
            exitReason,
            durationBars,
            mfe,
            mae,
            activeTradeMetadata.tradeId
          );

          if (closedTrade) {
            closedTrade.timestamp = activeTradeMetadata.entryTime;
            ledger.recordTrade(
              closedTrade,
              activeTradeMetadata.entryExecutionId ? [activeTradeMetadata.entryExecutionId] : [],
              [exitFill.executionRecord.executionId]
            );
            ledger.recordCashTx(
              bar.timestamp,
              bar.time,
              'REALIZED_PNL',
              closedTrade.netPnl,
              portfolio.getCash(),
              `Realized PnL via ${closedTrade.exitReason}: $${closedTrade.netPnl}`
            );

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
          currentPos = null;
        }
      }

      // D. Strategy Signal Generation
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

      // E. Execute Strategy Signals
      if ((signal.action === 'BUY' || signal.action === 'SELL') && !currentPos) {
        const side = signal.side || (signal.action === 'BUY' ? 'LONG' : 'SHORT');
        const tradeId = `TRD-${++tradeCounter}`;

        // Position Sizing
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
            entryExecutionId: fill.executionRecord.executionId,
            stopLossPrice: signal.stopLossPrice,
            takeProfitPrice: signal.takeProfitPrice,
            trailingStopAtr: signal.trailingStopAtr,
            highestPriceSinceEntry: fill.fillPrice,
            lowestPriceSinceEntry: fill.fillPrice,
          };

          ledger.recordCashTx(
            bar.timestamp,
            bar.time,
            'ORDER_FEE',
            -fill.feePaid,
            portfolio.getCash(),
            `Fee paid for order ${fill.order.id}: $${fill.feePaid}`
          );

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

          logs.push(`[ORDER] Signal: ${signal.action} ${side} | Executed @ $${fill.fillPrice} (Fee: $${fill.feePaid})`);
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
          0,
          'SIGNAL_REVERSAL',
          durationBars,
          mfe,
          mae,
          activeTradeMetadata.tradeId
        );

        if (closedTrade) {
          closedTrade.timestamp = activeTradeMetadata.entryTime;
          ledger.recordTrade(
            closedTrade,
            activeTradeMetadata.entryExecutionId ? [activeTradeMetadata.entryExecutionId] : [],
            [exitFill.executionRecord.executionId]
          );
          ledger.recordCashTx(
            bar.timestamp,
            bar.time,
            'REALIZED_PNL',
            closedTrade.netPnl,
            portfolio.getCash(),
            `Realized PnL via SIGNAL_REVERSAL: $${closedTrade.netPnl}`
          );

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

      // F. Capture Instantaneous Equity Point at Every Bar
      const currentPoint = portfolio.getSnapshot(bar.time, bar.close, startBenchmarkPrice, bar.timestamp);
      equityCurve.push(currentPoint);
    }

    onProgress?.(80, 'Generating risk metrics, ledger audit, and research checks...');

    const trades = portfolio.getClosedTrades();
    const finalPoint = equityCurve[equityCurve.length - 1];
    const finalEquity = finalPoint?.equity ?? this.config.initialCapital;
    const finalPos = portfolio.getPosition(this.config.symbol);

    // Performance Metrics Calculation
    const metrics = AnalyticsEngine.calculateMetrics(
      equityCurve,
      trades,
      this.config.initialCapital,
      portfolio.getTotalFees(),
      portfolio.getTotalFunding(),
      portfolio.getTotalSlippage()
    );

    // Accounting Invariants Full Audit
    const auditReport = AccountingVerifier.audit(
      {
        runId: '',
        timestamp,
        reproducibilityHash: '',
        engineVersion,
        isDeterministic: true,
        dataset: datasetMetadata,
        config: this.config,
        candles,
        trades,
        orders,
        equityCurve,
        metrics,
        monthlyReturns: [],
        validationWarnings: [],
        logs: [],
        executionRecords: execution.getExecutionRecords(),
        fundingEvents,
        liquidationEvents,
        tradeLedger: ledger.getEntries(),
      },
      this.config.initialCapital,
      ledger.getCashTransactions(),
      portfolio.getCash()
    );

    const invariantCheck = ledger.verifyInvariants(
      this.config.initialCapital,
      portfolio.getCash(),
      finalEquity,
      finalPos ? finalPos.unrealizedPnl : 0
    );

    if (auditReport.passed && invariantCheck.passed) {
      logs.push(`[LEDGER] Accounting invariants verified: All 13 invariants satisfied. Cash reconciled.`);
    } else {
      auditReport.violations.forEach((v) => logs.push(`[LEDGER-AUDIT-ERROR] Invariant #${v.invariantId} (${v.name}): ${v.message}`));
      invariantCheck.errors.forEach((err) => logs.push(`[LEDGER-ERROR] ${err}`));
    }

    const monthlyReturns = AnalyticsEngine.calculateMonthlyReturns(equityCurve);

    // Research Validation Checks
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

    logs.push(`[ANALYTICS] Finalized: Total Return: ${metrics.totalReturn}% | Sharpe: ${metrics.sharpeRatio} | MaxDD: ${metrics.maxDrawdown}%`);
    logs.push(`[COMPLETE] Run ${runId} finalized successfully. Total Trades: ${trades.length} | Audit Records: ${execution.getExecutionRecords().length}`);

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
      executionRecords: execution.getExecutionRecords(),
      fundingEvents,
      liquidationEvents,
      tradeLedger: ledger.getEntries(),
      invariantsPassed: auditReport.passed && invariantCheck.passed,
      invariantCheckErrors: [
        ...auditReport.violations.map((v) => `Invariant #${v.invariantId} (${v.name}): ${v.message}`),
        ...invariantCheck.errors,
      ],
      auditReport,
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

    // Fetch candles from configured provider - will throw if incomplete or invalid, no silent fallback
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
