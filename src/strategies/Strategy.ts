import { CandleData, Position } from '../types/backtest';
import { Indicators } from './Indicators';

export interface Signal {
  action: 'BUY' | 'SELL' | 'CLOSE' | 'HOLD';
  side?: 'LONG' | 'SHORT';
  sizePct?: number;
  stopLossPrice?: number;
  takeProfitPrice?: number;
  trailingStopAtr?: number;
  reason: string;
}

export interface StrategyContext {
  symbol: string;
  timeframe: string;
  leverage: number;
  allowShorting: boolean;
  position: Position | null;
  cash: number;
  equity: number;
}

export interface QuantitativeStrategy {
  id: string;
  name: string;
  version: string;
  description: string;
  defaultParams: Record<string, number | boolean | string>;

  /**
   * Pre-computes indicators on full candle series to avoid lookahead bias
   */
  prepare(candles: CandleData[], params: Record<string, any>): CandleData[];

  /**
   * Evaluates bar and produces deterministic trading signal
   */
  onBar(
    barIndex: number,
    candles: CandleData[],
    ctx: StrategyContext,
    params: Record<string, any>
  ): Signal;
}

/**
 * Strategy 1: Exponential Moving Average Crossover
 */
export class EmaCrossoverStrategy implements QuantitativeStrategy {
  id = 'strat-ema-crossover';
  name = 'Dual EMA Crossover with ATR Trailing Stop';
  version = '2.1.0';
  description = 'Trend-following strategy that goes LONG when fast EMA crosses above slow EMA and SHORT on reverse cross.';
  defaultParams = {
    emaFast: 21,
    emaSlow: 55,
    atrPeriod: 14,
    stopLossAtr: 1.8,
    takeProfitAtr: 4.2,
    trailingStop: true,
  };

  prepare(candles: CandleData[], params: Record<string, any>): CandleData[] {
    const fastPeriod = Number(params.fastEma ?? params.emaFast) || 21;
    const slowPeriod = Number(params.slowEma ?? params.emaSlow) || 55;
    const atrPeriod = Number(params.atrPeriod) || 14;

    const closes = candles.map((c) => c.close);
    const highs = candles.map((c) => c.high);
    const lows = candles.map((c) => c.low);

    const emaFastValues = Indicators.ema(closes, fastPeriod);
    const emaSlowValues = Indicators.ema(closes, slowPeriod);
    const atrValues = Indicators.atr(highs, lows, closes, atrPeriod);

    return candles.map((c, i) => ({
      ...c,
      emaFast: emaFastValues[i],
      emaSlow: emaSlowValues[i],
      atr: atrValues[i],
    }));
  }

  onBar(
    barIndex: number,
    candles: CandleData[],
    ctx: StrategyContext,
    params: Record<string, any>
  ): Signal {
    if (barIndex < 1) return { action: 'HOLD', reason: 'Insufficient history' };

    const curr = candles[barIndex];
    const prev = candles[barIndex - 1];

    if (!curr.emaFast || !curr.emaSlow || !prev.emaFast || !prev.emaSlow) {
      return { action: 'HOLD', reason: 'Warming up indicators' };
    }

    const bullCross = prev.emaFast <= prev.emaSlow && curr.emaFast > curr.emaSlow;
    const bearCross = prev.emaFast >= prev.emaSlow && curr.emaFast < curr.emaSlow;
    const atr = curr.atr || (curr.close * 0.02);
    const slDist = atr * (Number(params.stopLossAtr) || 1.8);
    const tpDist = atr * (Number(params.takeProfitAtr) || 4.2);

    // Active position management
    if (ctx.position) {
      if (ctx.position.side === 'LONG' && bearCross) {
        return { action: 'CLOSE', reason: 'EMA Bearish Cross reversal' };
      }
      if (ctx.position.side === 'SHORT' && bullCross) {
        return { action: 'CLOSE', reason: 'EMA Bullish Cross reversal' };
      }
      return { action: 'HOLD', reason: 'Holding position' };
    }

    // New Entry Signals
    if (bullCross) {
      return {
        action: 'BUY',
        side: 'LONG',
        sizePct: 25,
        stopLossPrice: Number((curr.close - slDist).toFixed(2)),
        takeProfitPrice: Number((curr.close + tpDist).toFixed(2)),
        trailingStopAtr: params.trailingStop ? Number(params.stopLossAtr) || 1.8 : undefined,
        reason: `EMA ${params.emaFast} crossed above EMA ${params.emaSlow}`,
      };
    }

    if (bearCross && ctx.allowShorting) {
      return {
        action: 'SELL',
        side: 'SHORT',
        sizePct: 25,
        stopLossPrice: Number((curr.close + slDist).toFixed(2)),
        takeProfitPrice: Number((curr.close - tpDist).toFixed(2)),
        trailingStopAtr: params.trailingStop ? Number(params.stopLossAtr) || 1.8 : undefined,
        reason: `EMA ${params.emaFast} crossed below EMA ${params.emaSlow}`,
      };
    }

    return { action: 'HOLD', reason: 'No crossover detected' };
  }
}

/**
 * Strategy 2: RSI Mean Reversion
 */
export class RsiMeanReversionStrategy implements QuantitativeStrategy {
  id = 'strat-rsi-mean-rev';
  name = 'Statistical RSI Mean Reversion';
  version = '1.8.0';
  description = 'Enters long during extreme oversold market states (RSI < 30) with mean-reversion exit at neutral (RSI > 50).';
  defaultParams = {
    rsiPeriod: 14,
    oversold: 30,
    overbought: 70,
    stopLossPct: 3.5,
    takeProfitPct: 5.0,
  };

  prepare(candles: CandleData[], params: Record<string, any>): CandleData[] {
    const period = Number(params.rsiPeriod) || 14;
    const closes = candles.map((c) => c.close);
    const rsiValues = Indicators.rsi(closes, period);

    return candles.map((c, i) => ({
      ...c,
      rsi: rsiValues[i],
    }));
  }

  onBar(
    barIndex: number,
    candles: CandleData[],
    ctx: StrategyContext,
    params: Record<string, any>
  ): Signal {
    const curr = candles[barIndex];
    const prev = candles[barIndex - 1];
    if (!curr || !prev || curr.rsi === undefined || prev.rsi === undefined) {
      return { action: 'HOLD', reason: 'Warming up RSI' };
    }

    const oversold = Number(params.oversold) || 30;
    const overbought = Number(params.overbought) || 70;

    if (ctx.position) {
      if (ctx.position.side === 'LONG' && curr.rsi >= 50) {
        return { action: 'CLOSE', reason: 'RSI recovered to neutral 50' };
      }
      if (ctx.position.side === 'SHORT' && curr.rsi <= 50) {
        return { action: 'CLOSE', reason: 'RSI cooled to neutral 50' };
      }
      return { action: 'HOLD', reason: 'Holding mean reversion trade' };
    }

    // Entry condition
    if (prev.rsi <= oversold && curr.rsi > oversold) {
      const sl = curr.close * (1 - (Number(params.stopLossPct) || 3.5) / 100);
      const tp = curr.close * (1 + (Number(params.takeProfitPct) || 5.0) / 100);
      return {
        action: 'BUY',
        side: 'LONG',
        sizePct: 20,
        stopLossPrice: Number(sl.toFixed(2)),
        takeProfitPrice: Number(tp.toFixed(2)),
        reason: `RSI oversold bounce from ${prev.rsi.toFixed(1)} to ${curr.rsi.toFixed(1)}`,
      };
    }

    if (prev.rsi >= overbought && curr.rsi < overbought && ctx.allowShorting) {
      const sl = curr.close * (1 + (Number(params.stopLossPct) || 3.5) / 100);
      const tp = curr.close * (1 - (Number(params.takeProfitPct) || 5.0) / 100);
      return {
        action: 'SELL',
        side: 'SHORT',
        sizePct: 20,
        stopLossPrice: Number(sl.toFixed(2)),
        takeProfitPrice: Number(tp.toFixed(2)),
        reason: `RSI overbought reversal from ${prev.rsi.toFixed(1)} to ${curr.rsi.toFixed(1)}`,
      };
    }

    return { action: 'HOLD', reason: 'RSI in neutral bounds' };
  }
}

/**
 * Strategy 3: Volatility Breakout (Bollinger + ATR)
 */
export class BreakoutStrategy implements QuantitativeStrategy {
  id = 'strat-btc-vol-breakout';
  name = 'BTC Volatility Breakout v2.4';
  version = '2.4.1';
  description = 'Dynamic volatility expansion channel with ATR trailing threshold, volume delta filter, and trend alignment.';
  defaultParams = {
    bbLength: 20,
    bbStdDev: 2.0,
    atrPeriod: 14,
    stopLossAtr: 1.8,
    takeProfitAtr: 4.2,
    volFilter: true,
  };

  prepare(candles: CandleData[], params: Record<string, any>): CandleData[] {
    const closes = candles.map((c) => c.close);
    const highs = candles.map((c) => c.high);
    const lows = candles.map((c) => c.low);

    const bb = Indicators.bollingerBands(
      closes,
      Number(params.bbLength) || 20,
      Number(params.bbStdDev) || 2.0
    );
    const atr = Indicators.atr(highs, lows, closes, Number(params.atrPeriod) || 14);

    return candles.map((c, i) => ({
      ...c,
      bbUpper: bb.upper[i],
      bbLower: bb.lower[i],
      atr: atr[i],
    }));
  }

  onBar(
    barIndex: number,
    candles: CandleData[],
    ctx: StrategyContext,
    params: Record<string, any>
  ): Signal {
    const curr = candles[barIndex];
    const prev = candles[barIndex - 1];
    if (!curr || !prev || !curr.bbUpper || !curr.bbLower) {
      return { action: 'HOLD', reason: 'Calculating Bollinger Bands' };
    }

    const atr = curr.atr || curr.close * 0.02;
    const slDist = atr * (Number(params.stopLossAtr) || 1.8);
    const tpDist = atr * (Number(params.takeProfitAtr) || 4.2);

    if (ctx.position) {
      if (ctx.position.side === 'LONG' && curr.close < curr.bbLower) {
        return { action: 'CLOSE', reason: 'Breakout collapsed below lower band' };
      }
      if (ctx.position.side === 'SHORT' && curr.close > curr.bbUpper) {
        return { action: 'CLOSE', reason: 'Breakout collapsed above upper band' };
      }
      return { action: 'HOLD', reason: 'Holding breakout trade' };
    }

    // Long breakout: Close penetrates upper band
    if (curr.close > curr.bbUpper && prev.close <= (prev.bbUpper || curr.bbUpper)) {
      return {
        action: 'BUY',
        side: 'LONG',
        sizePct: 25,
        stopLossPrice: Number((curr.close - slDist).toFixed(2)),
        takeProfitPrice: Number((curr.close + tpDist).toFixed(2)),
        trailingStopAtr: Number(params.stopLossAtr) || 1.8,
        reason: `Upper Bollinger band breakout @ ${curr.close}`,
      };
    }

    // Short breakout: Close penetrates lower band
    if (curr.close < curr.bbLower && prev.close >= (prev.bbLower || curr.bbLower) && ctx.allowShorting) {
      return {
        action: 'SELL',
        side: 'SHORT',
        sizePct: 25,
        stopLossPrice: Number((curr.close + slDist).toFixed(2)),
        takeProfitPrice: Number((curr.close - tpDist).toFixed(2)),
        trailingStopAtr: Number(params.stopLossAtr) || 1.8,
        reason: `Lower Bollinger band breakout @ ${curr.close}`,
      };
    }

    return { action: 'HOLD', reason: 'Price inside volatility bands' };
  }
}

/**
 * Strategy 4: Trend Following Multi-Indicator
 */
export class TrendFollowingStrategy implements QuantitativeStrategy {
  id = 'strat-eth-dual-trend';
  name = 'ETH Multi-EMA Trend Follower';
  version = '1.9.0';
  description = 'Multi-timeframe trend alignment combining EMA 20/100 trend filter with volatility pullbacks.';
  defaultParams = {
    emaFast: 20,
    emaSlow: 100,
    atrPeriod: 14,
    stopLossAtr: 2.0,
    takeProfitAtr: 4.5,
  };

  prepare(candles: CandleData[], params: Record<string, any>): CandleData[] {
    const closes = candles.map((c) => c.close);
    const highs = candles.map((c) => c.high);
    const lows = candles.map((c) => c.low);

    const fast = Indicators.ema(closes, Number(params.emaFast) || 20);
    const slow = Indicators.ema(closes, Number(params.emaSlow) || 100);
    const atr = Indicators.atr(highs, lows, closes, Number(params.atrPeriod) || 14);

    return candles.map((c, i) => ({
      ...c,
      emaFast: fast[i],
      emaSlow: slow[i],
      atr: atr[i],
    }));
  }

  onBar(
    barIndex: number,
    candles: CandleData[],
    ctx: StrategyContext,
    params: Record<string, any>
  ): Signal {
    const curr = candles[barIndex];
    if (!curr || !curr.emaFast || !curr.emaSlow) {
      return { action: 'HOLD', reason: 'Warming indicators' };
    }

    const atr = curr.atr || curr.close * 0.025;
    const isUptrend = curr.emaFast > curr.emaSlow;
    const isDowntrend = curr.emaFast < curr.emaSlow;

    if (ctx.position) {
      if (ctx.position.side === 'LONG' && isDowntrend) {
        return { action: 'CLOSE', reason: 'Macro trend turned bearish' };
      }
      if (ctx.position.side === 'SHORT' && isUptrend) {
        return { action: 'CLOSE', reason: 'Macro trend turned bullish' };
      }
      return { action: 'HOLD', reason: 'Holding trend ride' };
    }

    // Pullback entry in direction of trend
    const prev = candles[barIndex - 1];
    if (isUptrend && prev && curr.close > curr.open && prev.close <= prev.open) {
      return {
        action: 'BUY',
        side: 'LONG',
        sizePct: 20,
        stopLossPrice: Number((curr.close - atr * 2.0).toFixed(2)),
        takeProfitPrice: Number((curr.close + atr * 4.5).toFixed(2)),
        trailingStopAtr: 2.0,
        reason: 'Uptrend continuation after dip',
      };
    }

    if (isDowntrend && prev && curr.close < curr.open && prev.close >= prev.open && ctx.allowShorting) {
      return {
        action: 'SELL',
        side: 'SHORT',
        sizePct: 20,
        stopLossPrice: Number((curr.close + atr * 2.0).toFixed(2)),
        takeProfitPrice: Number((curr.close - atr * 4.5).toFixed(2)),
        trailingStopAtr: 2.0,
        reason: 'Downtrend continuation after pop',
      };
    }

    return { action: 'HOLD', reason: 'Waiting for pullback signal' };
  }
}

export const STRATEGY_REGISTRY: Record<string, QuantitativeStrategy> = {
  'strat-btc-vol-breakout': new BreakoutStrategy(),
  'strat-ema-crossover': new EmaCrossoverStrategy(),
  'strat-rsi-mean-rev': new RsiMeanReversionStrategy(),
  'strat-eth-dual-trend': new TrendFollowingStrategy(),
};
