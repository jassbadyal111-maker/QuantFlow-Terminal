import { BacktestConfig, CandleData, EquityPoint, Position, Trade } from '../types/backtest';
import { LiquidationEvent } from '../types/marketData';

export class PortfolioManager {
  private initialCapital: number;
  private cash: number;
  private leverage: number;
  private marginMode: 'CROSS' | 'ISOLATED';
  private positions: Map<string, Position> = new Map();
  private closedTrades: Trade[] = [];
  private totalFeesPaid = 0;
  private totalFundingPaid = 0;
  private totalSlippagePaid = 0;
  private peakEquity: number;

  constructor(config: BacktestConfig) {
    this.initialCapital = config.initialCapital;
    this.cash = config.initialCapital;
    this.leverage = config.leverage || 1;
    this.marginMode = config.marginMode || 'CROSS';
    this.peakEquity = config.initialCapital;
  }

  public getPosition(symbol: string): Position | null {
    return this.positions.get(symbol) || null;
  }

  public getAllPositions(): Position[] {
    return Array.from(this.positions.values());
  }

  public getCash(): number {
    return this.cash;
  }

  public getClosedTrades(): Trade[] {
    return this.closedTrades;
  }

  public getTotalFees(): number {
    return this.totalFeesPaid;
  }

  public getTotalFunding(): number {
    return this.totalFundingPaid;
  }

  public getTotalSlippage(): number {
    return this.totalSlippagePaid;
  }

  /**
   * Applies an 8h periodic funding payment (positive = paid by account, negative = received)
   */
  public applyFundingPayment(payment: number): void {
    this.totalFundingPaid += payment;
    this.cash -= payment;
  }

  /**
   * Calculates maintenance margin requirement based on leverage tier
   */
  public getMaintenanceMarginRate(leverage: number): number {
    if (leverage >= 20) return 0.025; // 2.5%
    if (leverage >= 10) return 0.015; // 1.5%
    if (leverage >= 5) return 0.01;   // 1.0%
    return 0.005;                     // 0.5%
  }

  /**
   * Calculates exact liquidation price for perpetual futures contracts
   */
  public calculateLiquidationPrice(
    entryPrice: number,
    side: 'LONG' | 'SHORT',
    leverage: number
  ): number {
    const mmr = this.getMaintenanceMarginRate(leverage);
    if (side === 'LONG') {
      const liq = entryPrice * (1 - (1 / leverage) + mmr);
      return Math.max(0, Number(liq.toFixed(2)));
    } else {
      const liq = entryPrice * (1 + (1 / leverage) - mmr);
      return Number(liq.toFixed(2));
    }
  }

  /**
   * Opens or adds to a position
   */
  public openPosition(
    symbol: string,
    side: 'LONG' | 'SHORT',
    size: number,
    fillPrice: number,
    fee: number,
    slippage: number
  ): Position {
    const notional = Number((size * fillPrice).toFixed(2));
    const initialMargin = Number((notional / this.leverage).toFixed(2));
    const maintenanceMargin = Number((notional * this.getMaintenanceMarginRate(this.leverage)).toFixed(2));
    const liquidationPrice = this.calculateLiquidationPrice(fillPrice, side, this.leverage);

    this.totalFeesPaid += fee;
    this.totalSlippagePaid += slippage;
    this.cash -= fee; // Deduct execution fee directly from cash balance

    const position: Position = {
      symbol,
      side,
      size,
      notional,
      entryPrice: fillPrice,
      currentPrice: fillPrice,
      leverage: this.leverage,
      marginMode: this.marginMode,
      initialMargin,
      maintenanceMargin,
      unrealizedPnl: 0,
      liquidationPrice,
    };

    this.positions.set(symbol, position);
    return position;
  }

  /**
   * Closes an active position and registers the completed trade
   */
  public closePosition(
    symbol: string,
    exitPrice: number,
    exitTime: string,
    fee: number,
    slippage: number,
    funding: number,
    exitReason: Trade['exitReason'],
    durationBars: number,
    mfe: number,
    mae: number,
    tradeId: string
  ): Trade | null {
    const pos = this.positions.get(symbol);
    if (!pos) return null;

    this.totalFeesPaid += fee;
    this.totalSlippagePaid += slippage;

    // Directional gross P&L calculation
    let grossPnl = 0;
    if (pos.side === 'LONG') {
      grossPnl = (exitPrice - pos.entryPrice) * pos.size;
    } else {
      grossPnl = (pos.entryPrice - exitPrice) * pos.size;
    }

    const netPnl = Number((grossPnl - fee - funding).toFixed(2));
    const pnlPercent = Number(((grossPnl / pos.notional) * 100 * pos.leverage).toFixed(2));

    // Update cash balance with realized PnL minus costs
    this.cash += netPnl;

    const trade: Trade = {
      id: tradeId,
      timestamp: exitTime,
      exitTimestamp: exitTime,
      symbol,
      side: pos.side,
      entryPrice: pos.entryPrice,
      exitPrice,
      size: pos.size,
      notional: pos.notional,
      pnl: Number(grossPnl.toFixed(2)),
      pnlPercent,
      fees: Number(fee.toFixed(2)),
      funding: Number(funding.toFixed(2)),
      netPnl,
      slippageBps: Number(((slippage / pos.notional) * 10000).toFixed(1)),
      exitReason,
      durationBars,
      mfe: Number(mfe.toFixed(2)),
      mae: Number(mae.toFixed(2)),
    };

    this.positions.delete(symbol);
    this.closedTrades.push(trade);
    return trade;
  }

  /**
   * Force liquidates a breached position with mandatory liquidation penalty and audit event
   */
  public forceLiquidate(
    symbol: string,
    bar: CandleData,
    tradeId: string,
    penaltyRate: number = 0.01 // 1% liquidation fee/penalty
  ): { trade: Trade; liquidationEvent: LiquidationEvent } | null {
    const pos = this.positions.get(symbol);
    if (!pos) return null;

    const penalty = Number((pos.notional * penaltyRate).toFixed(2));
    const fillPrice = pos.liquidationPrice;

    let grossPnl = 0;
    if (pos.side === 'LONG') {
      grossPnl = (fillPrice - pos.entryPrice) * pos.size;
    } else {
      grossPnl = (pos.entryPrice - fillPrice) * pos.size;
    }

    const netLoss = grossPnl - penalty;
    this.totalFeesPaid += penalty;
    this.cash += netLoss;

    const trade: Trade = {
      id: tradeId,
      timestamp: bar.time,
      exitTimestamp: bar.time,
      symbol,
      side: pos.side,
      entryPrice: pos.entryPrice,
      exitPrice: fillPrice,
      size: pos.size,
      notional: pos.notional,
      pnl: Number(grossPnl.toFixed(2)),
      pnlPercent: -100,
      fees: penalty,
      funding: 0,
      netPnl: Number(netLoss.toFixed(2)),
      slippageBps: 0,
      exitReason: 'LIQUIDATION',
      durationBars: 1,
      mfe: 0,
      mae: -100,
    };

    this.positions.delete(symbol);
    this.closedTrades.push(trade);

    const bankruptcyPrice = pos.side === 'LONG'
      ? pos.entryPrice * (1 - (1 / this.leverage))
      : pos.entryPrice * (1 + (1 / this.leverage));

    const liquidationEvent: LiquidationEvent = {
      timestamp: bar.timestamp,
      time: bar.time,
      symbol,
      side: pos.side,
      quantity: pos.size,
      liquidationPrice: pos.liquidationPrice,
      bankruptcyPrice: Number(bankruptcyPrice.toFixed(2)),
      maintenanceMargin: pos.maintenanceMargin,
      loss: Number(Math.abs(netLoss).toFixed(2)),
      fee: penalty,
      reason: `Bar extreme touched liquidation price of $${pos.liquidationPrice}`,
    };

    return { trade, liquidationEvent };
  }

  /**
   * Updates mark prices across all positions and checks for liquidation breaches
   */
  public updateBar(
    bar: CandleData,
    symbol: string
  ): { liquidated: boolean; liquidationReason?: string } {
    const pos = this.positions.get(symbol);
    if (!pos) return { liquidated: false };

    pos.currentPrice = bar.close;

    // Check liquidation breach on bar extremes
    if (pos.side === 'LONG' && bar.low <= pos.liquidationPrice) {
      return {
        liquidated: true,
        liquidationReason: `Bar low ${bar.low} breached long liquidation price ${pos.liquidationPrice}`,
      };
    }
    if (pos.side === 'SHORT' && bar.high >= pos.liquidationPrice) {
      return {
        liquidated: true,
        liquidationReason: `Bar high ${bar.high} breached short liquidation price ${pos.liquidationPrice}`,
      };
    }

    // Mark-to-Market unrealized PnL
    if (pos.side === 'LONG') {
      pos.unrealizedPnl = Number(((bar.close - pos.entryPrice) * pos.size).toFixed(2));
    } else {
      pos.unrealizedPnl = Number(((pos.entryPrice - bar.close) * pos.size).toFixed(2));
    }

    return { liquidated: false };
  }

  /**
   * Computes instantaneous portfolio snapshot with deterministic audit figures
   */
  public getSnapshot(
    barTime: string,
    benchmarkPrice: number,
    startBenchmarkPrice: number,
    timestamp?: number
  ): EquityPoint {
    let totalUnrealized = 0;
    let totalMarginUsed = 0;
    let grossExposure = 0;
    let netExposure = 0;

    for (const pos of this.positions.values()) {
      totalUnrealized += pos.unrealizedPnl;
      totalMarginUsed += pos.initialMargin;
      grossExposure += pos.notional;
      netExposure += pos.side === 'LONG' ? pos.notional : -pos.notional;
    }

    const currentEquity = Number((this.cash + totalUnrealized).toFixed(2));
    if (currentEquity > this.peakEquity) {
      this.peakEquity = currentEquity;
    }

    const drawdownPct = this.peakEquity > 0
      ? Number((((currentEquity - this.peakEquity) / this.peakEquity) * 100).toFixed(2))
      : 0;

    const benchmarkEquity = Math.round(
      this.initialCapital * (benchmarkPrice / (startBenchmarkPrice || 1))
    );

    const marginUtilization = currentEquity > 0
      ? Number(((totalMarginUsed / currentEquity) * 100).toFixed(1))
      : 100;

    const realizedPnl = Number((this.cash - this.initialCapital + this.totalFeesPaid + this.totalFundingPaid).toFixed(2));

    return {
      time: barTime.split(' ')[0] || barTime,
      timestamp,
      equity: Number(currentEquity.toFixed(2)),
      benchmarkEquity,
      drawdownPct,
      pnl: Number((currentEquity - this.initialCapital).toFixed(2)),
      cumulativePnl: Number((currentEquity - this.initialCapital).toFixed(2)),
      cash: Number(this.cash.toFixed(2)),
      cashBalance: Number(this.cash.toFixed(2)),
      positionNotional: Math.round(grossExposure),
      unrealizedPnl: Number(totalUnrealized.toFixed(2)),
      realizedPnl,
      cumulativeFees: Number(this.totalFeesPaid.toFixed(2)),
      cumulativeFunding: Number(this.totalFundingPaid.toFixed(2)),
      marginUtilization,
      grossExposure: Math.round(grossExposure),
      netExposure: Math.round(netExposure),
    };
  }
}
