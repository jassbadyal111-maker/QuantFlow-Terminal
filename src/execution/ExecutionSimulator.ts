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
    const notionalScale = Math.max(0.1, notional / 100000);
    if (model === 'linear_impact') {
      return Number((baseBps * (0.8 + 0.2 * notionalScale)).toFixed(2));
    } else if (model === 'sqrt_impact') {
      return Number((baseBps * Math.sqrt(notionalScale)).toFixed(2));
    }
    return baseBps;
  }

  /**
   * Calculates Bid/Ask execution price including spread and slippage
   */
  public getMarketExecutionPrice(
    midPrice: number,
    side: 'BUY' | 'SELL',
    notional: number
  ): { execPrice: number; slippageBps: number; feeRate: number } {
    const spreadBps = this.config.execution.bidAskSpreadBps ?? 1.0;
    const halfSpreadPct = (spreadBps / 2) / 10000;
    const slippageBps = this.calculateSlippageBps(notional);
    const slippagePct = slippageBps / 10000;

    let execPrice = midPrice;
    if (side === 'BUY') {
      // Buys execute against Ask: ask = mid + halfSpread + slippage
      execPrice = midPrice * (1 + halfSpreadPct + slippagePct);
    } else {
      // Sells execute against Bid: bid = mid - halfSpread - slippage
      execPrice = midPrice * (1 - halfSpreadPct - slippagePct);
    }

    const feeRate = (this.config.execution.takerFeeBps ?? 5.0) / 10000;

    return {
      execPrice: Number(execPrice.toFixed(midPrice < 10 ? 4 : 2)),
      slippageBps,
      feeRate,
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

    // Support configurable partial fill simulation if configured
    const partialFillProb = this.config.execution.partialFillProbability ?? 0;
    const isPartial = partialFillProb > 0 && Math.random() < partialFillProb;
    const fillRatio = isPartial ? 0.75 : 1.0;

    const filledNotional = Number((positionNotional * fillRatio).toFixed(2));
    const feePaid = Number((filledNotional * feeRate).toFixed(2));
    const slippagePaid = Number((filledNotional * (slippageBps / 10000)).toFixed(2));
    const totalSize = Number((positionNotional / execPrice).toFixed(4));
    const filledSize = Number((filledNotional / execPrice).toFixed(4));

    const orderId = `ORD-EXEC-${++this.orderCounter}`;

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
      orderId,
      timestamp: bar.time,
      requestedPrice: bar.close,
      fillPrice: execPrice,
      quantity: filledSize,
      notional: filledNotional,
      fee: feePaid,
      slippage: slippagePaid,
      liquiditySide: 'TAKER',
      status: isPartial ? 'PARTIAL' : 'FILLED',
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
        amount: Number((positionNotional / limitPrice).toFixed(4)),
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
          orderId,
          timestamp: bar.time,
          requestedPrice: limitPrice,
          fillPrice: 0,
          quantity: 0,
          notional: 0,
          fee: 0,
          slippage: 0,
          liquiditySide: 'MAKER',
          status: 'REJECTED',
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
      orderId,
      timestamp: bar.time,
      requestedPrice: limitPrice,
      fillPrice,
      quantity: size,
      notional: positionNotional,
      fee: feePaid,
      slippage: 0,
      liquiditySide: 'MAKER',
      status: 'FILLED',
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
          amount: Number((positionNotional / stopPrice).toFixed(4)),
          filledAmount: 0,
          status: 'REJECTED',
          fee: 0,
          slippage: 0,
        },
        executionRecord: {
          orderId,
          timestamp: bar.time,
          requestedPrice: stopPrice,
          fillPrice: 0,
          quantity: 0,
          notional: 0,
          fee: 0,
          slippage: 0,
          liquiditySide: 'TAKER',
          status: 'REJECTED',
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
