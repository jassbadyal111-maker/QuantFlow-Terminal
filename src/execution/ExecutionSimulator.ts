import { BacktestConfig, CandleData, Order, Position, Trade } from '../types/backtest';

export interface FillResult {
  filled: boolean;
  order: Order;
  trade?: Trade;
  rejectionReason?: string;
  fillPrice: number;
  feePaid: number;
  slippagePaid: number;
}

export class ExecutionSimulator {
  private config: BacktestConfig;
  private orderCounter = 10000;

  constructor(config: BacktestConfig) {
    this.config = config;
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
  public getExecutionPrice(
    midPrice: number,
    side: 'BUY' | 'SELL',
    notional: number,
    orderType: 'MARKET' | 'LIMIT'
  ): { execPrice: number; slippageBps: number; feeRate: number } {
    const spreadBps = this.config.execution.bidAskSpreadBps || 1.0;
    const halfSpreadPct = (spreadBps / 2) / 10000;
    const slippageBps = orderType === 'MARKET' ? this.calculateSlippageBps(notional) : 0;
    const slippagePct = slippageBps / 10000;

    let execPrice = midPrice;
    if (side === 'BUY') {
      // Crossing the spread upward + slippage
      execPrice = midPrice * (1 + halfSpreadPct + slippagePct);
    } else {
      // Crossing the spread downward - slippage
      execPrice = midPrice * (1 - halfSpreadPct - slippagePct);
    }

    const feeRate = orderType === 'MARKET'
      ? (this.config.execution.takerFeeBps / 10000)
      : (this.config.execution.makerFeeBps / 10000);

    return {
      execPrice: Number(execPrice.toFixed(midPrice < 10 ? 4 : 2)),
      slippageBps,
      feeRate,
    };
  }

  /**
   * Simulates filling a market entry order with slippage, fees, and latency tracking
   */
  public fillMarketOrder(
    bar: CandleData,
    side: 'BUY' | 'SELL',
    positionNotional: number,
    tradeId: string
  ): FillResult {
    const { execPrice, slippageBps, feeRate } = this.getExecutionPrice(
      bar.close,
      side,
      positionNotional,
      'MARKET'
    );

    const feePaid = Number((positionNotional * feeRate).toFixed(2));
    const slippagePaid = Number((positionNotional * (slippageBps / 10000)).toFixed(2));
    const size = Number((positionNotional / execPrice).toFixed(4));

    const order: Order = {
      id: `ORD-EXEC-${++this.orderCounter}`,
      tradeId,
      timestamp: bar.time,
      symbol: this.config.symbol,
      type: 'MARKET',
      side,
      price: bar.close,
      avgFillPrice: execPrice,
      amount: size,
      filledAmount: size,
      status: 'FILLED',
      fee: feePaid,
      slippage: slippagePaid,
      latencyMs: this.config.execution.latencyMs || 15,
    };

    return {
      filled: true,
      order,
      fillPrice: execPrice,
      feePaid,
      slippagePaid,
    };
  }

  /**
   * Calculates funding fee for holding perpetual positions across 8-hour funding intervals
   */
  public calculateFundingPayment(positionNotional: number, side: 'LONG' | 'SHORT', barsHeld: number, timeframe: string): number {
    const fundingRate8h = (this.config.execution.fundingRate8hBps || 1.0) / 10000;
    
    // Estimate number of 8-hour intervals passed
    let hoursPerBar = 4;
    if (timeframe === '1m') hoursPerBar = 1 / 60;
    else if (timeframe === '5m') hoursPerBar = 5 / 60;
    else if (timeframe === '15m') hoursPerBar = 0.25;
    else if (timeframe === '1h') hoursPerBar = 1;
    else if (timeframe === '4h') hoursPerBar = 4;
    else if (timeframe === '1d') hoursPerBar = 24;

    const totalHours = barsHeld * hoursPerBar;
    const intervals = totalHours / 8;

    // Long pays when funding is positive; Short receives
    const fundingMultiplier = side === 'LONG' ? 1 : -1;
    return Number((positionNotional * fundingRate8h * intervals * fundingMultiplier).toFixed(2));
  }
}
