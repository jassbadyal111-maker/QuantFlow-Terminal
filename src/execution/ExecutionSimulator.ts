import { BacktestConfig, CandleData, Order, Trade } from '../types/backtest';
import { ExecutionRecord } from '../types/marketData';

export interface FillResult {
  filled: boolean;
  order: Order;
  executionRecord: ExecutionRecord;
  trade?: Trade;
  rejectionReason?: string;
  fillPrice: number;
  feePaid: number;
  slippagePaid: number;
  liquiditySide: 'MAKER' | 'TAKER';
}

export class ExecutionSimulator {
  private config: BacktestConfig;
  private orderCounter = 10000;
  private executionCounter = 20000;
  private executionRecords: ExecutionRecord[] = [];

  constructor(config: BacktestConfig) {
    this.config = config;
  }

  public getExecutionRecords(): ExecutionRecord[] {
    return this.executionRecords;
  }

  /**
   * Calculates execution slippage in bps based on configured model and notional size
   */
  public calculateSlippageBps(notional: number): number {
    const baseBps = this.config.execution.slippageBps || 2.5;
    const model = this.config.execution.slippageModel || 'linear_impact';

    if (model === 'fixed') {
      return baseBps;
    }

    // Benchmark against $100k notional standard ticket
    const benchmarkNotional = 100000;
    const sizeRatio = notional / benchmarkNotional;

    if (model === 'sqrt_impact') {
      // Almgren-Chriss square root market impact model
      return Number((baseBps * Math.sqrt(Math.max(0.1, sizeRatio))).toFixed(2));
    }

    // Default: linear market impact
    return Number((baseBps * Math.max(0.5, Math.min(5.0, sizeRatio))).toFixed(2));
  }

  /**
   * Calculates taker execution fill price with realistic bid/ask spread crossing and slippage
   */
  public getMarketExecutionPrice(
    midPrice: number,
    side: 'BUY' | 'SELL',
    positionNotional: number
  ): { execPrice: number; slippageBps: number; feeRate: number } {
    const slippageBps = this.calculateSlippageBps(positionNotional);
    const halfSpreadBps = 0.5; // Baseline 1 bp bid/ask spread
    const totalImpactBps = halfSpreadBps + slippageBps;
    const totalImpactRatio = totalImpactBps / 10000;

    const takerFeeRate = (this.config.execution.takerFeeBps ?? 5.5) / 10000;

    let execPrice = midPrice;
    if (side === 'BUY') {
      // Crossing the spread upwards as aggressive buyer
      execPrice = midPrice * (1 + totalImpactRatio);
    } else {
      // Crossing the spread downwards as aggressive seller
      execPrice = midPrice * (1 - totalImpactRatio);
    }

    return {
      execPrice: Number(execPrice.toFixed(2)),
      slippageBps,
      feeRate: takerFeeRate,
    };
  }

  /**
   * Simulates filling a market order (crossing the spread as taker)
   */
  public fillMarketOrder(
    bar: CandleData,
    side: 'BUY' | 'SELL',
    positionNotional: number,
    tradeId: string
  ): FillResult {
    const { execPrice, slippageBps, feeRate } = this.getMarketExecutionPrice(
      bar.close,
      side,
      positionNotional
    );

    // Deterministic partial fill evaluation if configured (no Math.random)
    const partialFillProb = this.config.execution.partialFillProbability ?? 0;
    const seedHash = ((Math.imul(bar.timestamp ^ this.orderCounter, 0x5bd1e995) >>> 0) % 1000000) / 1000000;
    const isPartial = partialFillProb > 0 && seedHash < partialFillProb;
    const fillRatio = isPartial ? 0.75 : 1.0;

    const filledNotional = Number((positionNotional * fillRatio).toFixed(2));
    const feePaid = Number((filledNotional * feeRate).toFixed(2));
    const slippagePaid = Number((filledNotional * (slippageBps / 10000)).toFixed(2));
    const totalSize = Number((positionNotional / execPrice).toFixed(4));
    const filledSize = Number((filledNotional / execPrice).toFixed(4));

    const orderId = `ORD-EXEC-${++this.orderCounter}`;
    const execId = `EXEC-${++this.executionCounter}`;

    const order: Order = {
      id: orderId,
      tradeId,
      timestamp: bar.time,
      symbol: this.config.symbol,
      type: 'MARKET',
      side,
      price: bar.close,
      avgFillPrice: execPrice,
      amount: totalSize,
      filledAmount: filledSize,
      status: isPartial ? 'PARTIAL' : 'FILLED',
      fee: feePaid,
      slippage: slippagePaid,
      latencyMs: this.config.execution.latencyMs || 15,
    };

    const record: ExecutionRecord = {
      executionId: execId,
      orderId,
      timestamp: bar.time,
      symbol: this.config.symbol,
      side,
      orderType: 'MARKET',
      requestedPrice: bar.close,
      fillPrice: execPrice,
      requestedQuantity: totalSize,
      filledQuantity: filledSize,
      remainingQuantity: Number((totalSize - filledSize).toFixed(4)),
      fee: feePaid,
      feeRate,
      slippage: slippagePaid,
      latency: this.config.execution.latencyMs || 15,
      liquiditySource: 'TAKER',
      status: isPartial ? 'PARTIAL' : 'FILLED',
      quantity: filledSize,
      notional: filledNotional,
      liquiditySide: 'TAKER',
    };

    this.executionRecords.push(record);

    return {
      filled: true,
      order,
      executionRecord: record,
      fillPrice: execPrice,
      feePaid,
      slippagePaid,
      liquiditySide: 'TAKER',
    };
  }

  /**
   * Simulates filling a limit order (resting liquidity maker)
   * Only fills when market touches or crosses the limit price
   */
  public fillLimitOrder(
    bar: CandleData,
    side: 'BUY' | 'SELL',
    limitPrice: number,
    positionNotional: number,
    tradeId: string
  ): FillResult {
    let crossed = false;
    let fillPrice = limitPrice;

    if (side === 'BUY') {
      // Buy limit fills if bar low touches or penetrates below limit price
      if (bar.low <= limitPrice) {
        crossed = true;
        // If bar opened below limit, favorable gap fill at open
        fillPrice = Math.min(limitPrice, bar.open);
      }
    } else {
      // Sell limit fills if bar high touches or penetrates above limit price
      if (bar.high >= limitPrice) {
        crossed = true;
        // If bar opened above limit, favorable gap fill at open
        fillPrice = Math.max(limitPrice, bar.open);
      }
    }

    const orderId = `ORD-LIMIT-${++this.orderCounter}`;
    const execId = `EXEC-${++this.executionCounter}`;
    const totalSize = Number((positionNotional / limitPrice).toFixed(4));

    if (!crossed) {
      const unfilledOrder: Order = {
        id: orderId,
        tradeId,
        timestamp: bar.time,
        symbol: this.config.symbol,
        type: 'LIMIT',
        side,
        price: limitPrice,
        avgFillPrice: 0,
        amount: totalSize,
        filledAmount: 0,
        status: 'REJECTED',
        fee: 0,
        slippage: 0,
        rejectionReason: 'Limit price not touched by market candle',
      };
      return {
        filled: false,
        order: unfilledOrder,
        executionRecord: {
          executionId: execId,
          orderId,
          timestamp: bar.time,
          symbol: this.config.symbol,
          side,
          orderType: 'LIMIT',
          requestedPrice: limitPrice,
          fillPrice: 0,
          requestedQuantity: totalSize,
          filledQuantity: 0,
          remainingQuantity: totalSize,
          fee: 0,
          feeRate: 0,
          slippage: 0,
          latency: this.config.execution.latencyMs || 15,
          liquiditySource: 'MAKER',
          status: 'REJECTED',
          quantity: 0,
          notional: 0,
          liquiditySide: 'MAKER',
        },
        fillPrice: 0,
        feePaid: 0,
        slippagePaid: 0,
        liquiditySide: 'MAKER',
      };
    }

    const feeRate = (this.config.execution.makerFeeBps ?? 2.0) / 10000;
    const feePaid = Number((positionNotional * feeRate).toFixed(2));
    const size = Number((positionNotional / fillPrice).toFixed(4));

    const order: Order = {
      id: orderId,
      tradeId,
      timestamp: bar.time,
      symbol: this.config.symbol,
      type: 'LIMIT',
      side,
      price: limitPrice,
      avgFillPrice: fillPrice,
      amount: size,
      filledAmount: size,
      status: 'FILLED',
      fee: feePaid,
      slippage: 0, // No slippage on passive maker limit orders
      latencyMs: this.config.execution.latencyMs || 15,
    };

    const record: ExecutionRecord = {
      executionId: execId,
      orderId,
      timestamp: bar.time,
      symbol: this.config.symbol,
      side,
      orderType: 'LIMIT',
      requestedPrice: limitPrice,
      fillPrice,
      requestedQuantity: size,
      filledQuantity: size,
      remainingQuantity: 0,
      fee: feePaid,
      feeRate,
      slippage: 0,
      latency: this.config.execution.latencyMs || 15,
      liquiditySource: 'MAKER',
      status: 'FILLED',
      quantity: size,
      notional: positionNotional,
      liquiditySide: 'MAKER',
    };

    this.executionRecords.push(record);

    return {
      filled: true,
      order,
      executionRecord: record,
      fillPrice,
      feePaid,
      slippagePaid: 0,
      liquiditySide: 'MAKER',
    };
  }

  /**
   * Simulates a conditional stop order trigger
   */
  public fillStopOrder(
    bar: CandleData,
    side: 'BUY' | 'SELL',
    stopPrice: number,
    positionNotional: number,
    tradeId: string
  ): FillResult {
    let triggered = false;
    if (side === 'BUY' && bar.high >= stopPrice) {
      triggered = true;
    } else if (side === 'SELL' && bar.low <= stopPrice) {
      triggered = true;
    }

    if (!triggered) {
      const orderId = `ORD-STOP-${++this.orderCounter}`;
      const execId = `EXEC-${++this.executionCounter}`;
      const totalSize = Number((positionNotional / stopPrice).toFixed(4));
      return {
        filled: false,
        order: {
          id: orderId,
          tradeId,
          timestamp: bar.time,
          symbol: this.config.symbol,
          type: 'STOP_MARKET',
          side,
          price: stopPrice,
          avgFillPrice: 0,
          amount: totalSize,
          filledAmount: 0,
          status: 'REJECTED',
          fee: 0,
          slippage: 0,
        },
        executionRecord: {
          executionId: execId,
          orderId,
          timestamp: bar.time,
          symbol: this.config.symbol,
          side,
          orderType: 'STOP',
          requestedPrice: stopPrice,
          fillPrice: 0,
          requestedQuantity: totalSize,
          filledQuantity: 0,
          remainingQuantity: totalSize,
          fee: 0,
          feeRate: 0,
          slippage: 0,
          latency: this.config.execution.latencyMs || 15,
          liquiditySource: 'TAKER',
          status: 'REJECTED',
          quantity: 0,
          notional: 0,
          liquiditySide: 'TAKER',
        },
        fillPrice: 0,
        feePaid: 0,
        slippagePaid: 0,
        liquiditySide: 'TAKER',
      };
    }

    // Stop fills as a market taker order at or beyond stopPrice
    return this.fillMarketOrder(
      { ...bar, close: stopPrice },
      side,
      positionNotional,
      tradeId
    );
  }

  /**
   * Calculates funding fee for holding perpetual positions across 8-hour intervals
   */
  public calculateFundingPayment(
    positionNotional: number,
    side: 'LONG' | 'SHORT',
    barsHeld: number,
    timeframe: string
  ): number {
    const fundingRate8h = (this.config.execution.fundingRate8hBps || 1.0) / 10000;
    
    let hoursPerBar = 1;
    switch (timeframe.toLowerCase()) {
      case '1m': hoursPerBar = 1 / 60; break;
      case '5m': hoursPerBar = 5 / 60; break;
      case '15m': hoursPerBar = 0.25; break;
      case '1h': hoursPerBar = 1; break;
      case '4h': hoursPerBar = 4; break;
      case '1d': hoursPerBar = 24; break;
      default: hoursPerBar = 1;
    }

    const totalHours = barsHeld * hoursPerBar;
    const intervals = totalHours / 8;

    // Long pays when funding is positive; Short receives
    const fundingMultiplier = side === 'LONG' ? 1 : -1;
    return Number((positionNotional * fundingRate8h * intervals * fundingMultiplier).toFixed(2));
  }
}
