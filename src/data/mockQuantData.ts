import {
  Strategy,
  BacktestConfig,
  CandleData,
  Trade,
  Order,
  EquityPoint,
  PerformanceMetrics,
  MonthlyReturn,
  RiskMetrics,
  OptimizationHeatmapCell,
  RegimeAnalysis,
} from '../types/backtest';

export const INITIAL_STRATEGIES: Strategy[] = [
  {
    id: 'strat-btc-vol-breakout',
    name: 'BTC Volatility Breakout v2.4',
    version: '2.4.1',
    type: 'volatility-breakout',
    author: 'Desk Alpha (M. Vance)',
    symbol: 'BTC/USDT',
    timeframe: '4h',
    description: 'Dynamic volatility expansion channel with ATR trailing threshold, volume delta filter, and trend alignment.',
    sharpe: 2.41,
    returnPct: 142.85,
    maxDrawdown: -8.42,
    winRate: 64.2,
    profitFactor: 2.34,
    tradesCount: 168,
    status: 'ACTIVE',
    lastRun: '2025-02-28 14:00 UTC',
    code: `// ApexQuant Volatility Breakout v2.4
import { Strategy, Context, Bar } from '@apexquant/core';

export class BtcVolBreakout extends Strategy {
  private fastEma = this.params.int('fastEma', 21);
  private slowEma = this.params.int('slowEma', 55);
  private atrPeriod = this.params.int('atrPeriod', 14);
  private atrMult = this.params.float('atrMult', 2.5);

  onBar(ctx: Context, bar: Bar) {
    const trend = bar.ema(this.fastEma) > bar.ema(this.slowEma);
    const upperBand = bar.close + (bar.atr(this.atrPeriod) * this.atrMult);
    const volumeSurge = bar.volume > bar.avgVolume(20) * 1.35;

    if (trend && bar.close > upperBand && volumeSurge && !ctx.hasLong()) {
      ctx.orderLong({
        sizePct: 0.25,
        stopLossAtr: 1.8,
        takeProfitAtr: 4.2
      });
    }
  }
}`,
    parameters: {
      fastEma: 21,
      slowEma: 55,
      atrPeriod: 14,
      atrMult: 2.5,
      stopLossAtr: 1.8,
      takeProfitAtr: 4.2,
      leverage: 3,
    },
  },
  {
    id: 'strat-eth-dual-trend',
    name: 'ETH Multi-EMA Trend Follower',
    version: '1.9.0',
    type: 'momentum',
    author: 'Quant Team #2',
    symbol: 'ETH/USDT',
    timeframe: '1h',
    description: 'Triple exponential smoothing with adaptive trailing ATR stops and funding rate carry bias.',
    sharpe: 1.88,
    returnPct: 98.40,
    maxDrawdown: -11.20,
    winRate: 58.6,
    profitFactor: 1.95,
    tradesCount: 242,
    status: 'ACTIVE',
    lastRun: '2025-02-27 18:30 UTC',
    code: `// ETH Dual EMA Trend Engine
export default function runStrategy(bar, portfolio) {
  const ema20 = bar.indicators.ema(20);
  const ema100 = bar.indicators.ema(100);
  if (ema20 > ema100 && portfolio.position === 0) {
    return { action: 'BUY', size: '20%' };
  }
}`,
    parameters: {
      emaFast: 20,
      emaSlow: 100,
      atrStop: 2.2,
      leverage: 2,
    },
  },
  {
    id: 'strat-sol-mean-rev',
    name: 'SOL Statistical Mean Reversion',
    version: '3.1.2',
    type: 'mean-reversion',
    author: 'Desk HFT (S. Chen)',
    symbol: 'SOL/USDT',
    timeframe: '15m',
    description: 'Bollinger Band 2.5-sigma exhaustion with orderbook bid-ask imbalance confirmation.',
    sharpe: 2.15,
    returnPct: 114.20,
    maxDrawdown: -7.80,
    winRate: 71.4,
    profitFactor: 2.18,
    tradesCount: 412,
    status: 'DEVELOPMENT',
    lastRun: '2025-02-26 09:15 UTC',
    code: `// SOL Mean Reversion Scalp`,
    parameters: {
      bbLength: 20,
      stdDev: 2.5,
      rsiThreshold: 28,
      takeProfitTicks: 45,
    },
  },
  {
    id: 'strat-perp-funding-arb',
    name: 'Perp Basis & Funding Harvester',
    version: '4.0.0',
    type: 'arbitrage',
    author: 'Systematic Yield Desk',
    symbol: 'BTC/USDT',
    timeframe: '8h',
    description: 'Delta-neutral perpetual funding rate arbitrage capturing annualized 8-hour yields while hedging spot on CME/Binance.',
    sharpe: 3.42,
    returnPct: 38.65,
    maxDrawdown: -2.10,
    winRate: 88.5,
    profitFactor: 4.12,
    tradesCount: 84,
    status: 'ACTIVE',
    lastRun: '2025-02-28 00:00 UTC',
    code: `// Delta Neutral Funding Arbitrage`,
    parameters: {
      minSpreadBps: 12,
      targetLeverage: 1.5,
      rebalanceThresholdBps: 25,
    },
  },
  {
    id: 'strat-ml-regime-alpha',
    name: 'Deep Regime Crypto Alpha v1.2',
    version: '1.2.4',
    type: 'ml-trend',
    author: 'Quant ML Research',
    symbol: 'BTC/USDT',
    timeframe: '4h',
    description: 'Hidden Markov Model + LightGBM classifier for market regime identification and dynamic leverage adjustment.',
    sharpe: 2.05,
    returnPct: 126.50,
    maxDrawdown: -9.15,
    winRate: 61.8,
    profitFactor: 2.21,
    tradesCount: 195,
    status: 'BACKTESTED',
    lastRun: '2025-02-25 12:00 UTC',
    code: `// HMM Regime Switching Classifier`,
    parameters: {
      hmmStates: 4,
      thresholdConfidence: 0.75,
    },
  },
];

export const SAMPLE_STRATEGIES = INITIAL_STRATEGIES;

export const DEFAULT_BACKTEST_CONFIG: BacktestConfig = {
  strategyId: 'strat-btc-vol-breakout',
  exchange: 'Binance Futures',
  symbol: 'BTC/USDT',
  timeframe: '4h',
  dateRange: {
    start: '2024-01-01',
    end: '2025-02-28',
    preset: '1Y',
  },
  initialCapital: 100000,
  leverage: 3,
  positionSizing: {
    type: 'percent_equity',
    value: 25,
  },
  indicators: {
    emaFast: 21,
    emaSlow: 55,
    atrPeriod: 14,
    rsiPeriod: 14,
    bbLength: 20,
    bbStdDev: 2.0,
  },
  entryRules: {
    longCond: 'EMA_CROSSOVER',
    shortCond: 'EMA_CROSSUNDER',
    allowShorting: true,
    useVolFilter: true,
    volFilterMultiplier: 1.35,
  },
  exitRules: {
    stopLossAtr: 1.8,
    takeProfitAtr: 4.2,
    trailingStop: true,
    breakevenAfterAtr: 2.0,
    maxHoldBars: 48,
  },
  execution: {
    makerFeeBps: 1.2,
    takerFeeBps: 3.0,
    slippageModel: 'linear_impact',
    slippageBps: 2.5,
    fundingRate8hBps: 1.0,
    latencyMs: 15,
  },
};

// Generate 120 realistic high-resolution candles for BTC
export function generateRealisticCandles(startPrice: number = 62400, count: number = 100): CandleData[] {
  const candles: CandleData[] = [];
  let currentClose = startPrice;
  const now = new Date('2025-02-28T00:00:00Z');

  // Trend seed components
  for (let i = count - 1; i >= 0; i--) {
    const candleTime = new Date(now.getTime() - i * 4 * 3600 * 1000);
    const timeStr = candleTime.toISOString().slice(0, 16).replace('T', ' ');

    // Quant random walk with drift & volatility clustering
    const cycle = Math.sin((count - i) / 12);
    const drift = cycle * 0.003 + 0.0008;
    const volatility = 0.015 + (Math.sin(i * 0.3) > 0.6 ? 0.02 : 0.005);
    const changePct = drift + (Math.random() - 0.49) * volatility * 2;

    const open = currentClose;
    const close = Math.round(open * (1 + changePct));
    const range = Math.abs(close - open);
    const wickHigh = range * (0.3 + Math.random() * 0.7) + (close * 0.004);
    const wickLow = range * (0.3 + Math.random() * 0.7) + (close * 0.004);

    const high = Math.round(Math.max(open, close) + wickHigh);
    const low = Math.round(Math.min(open, close) - wickLow);
    const volume = Math.round(450 + Math.random() * 1800 + (range / open > 0.02 ? 2200 : 0));

    currentClose = close;

    candles.push({
      time: timeStr,
      timestamp: candleTime.getTime(),
      open,
      high,
      low,
      close,
      volume,
    });
  }

  // Calculate EMA 21, EMA 55, and ATR
  let ema21 = candles[0].close;
  let ema55 = candles[0].close;
  const k21 = 2 / (21 + 1);
  const k55 = 2 / (55 + 1);

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    ema21 = c.close * k21 + ema21 * (1 - k21);
    ema55 = c.close * k55 + ema55 * (1 - k55);

    c.emaFast = Math.round(ema21);
    c.emaSlow = Math.round(ema55);
    c.rsi = Math.round(42 + 25 * Math.sin(i / 6) + (Math.random() - 0.5) * 10);
    c.atr = Math.round(c.close * 0.022);
    c.bbUpper = Math.round(ema21 + c.atr * 2);
    c.bbLower = Math.round(ema21 - c.atr * 2);

    // Place simulated execution trade markers
    if (i === 18) {
      c.marker = {
        id: 'tm-1',
        time: c.time,
        position: 'belowBar',
        color: '#10b981',
        shape: 'arrowUp',
        text: 'BUY LONG $61,240',
        price: c.low,
        side: 'BUY',
      };
    } else if (i === 32) {
      c.marker = {
        id: 'tm-2',
        time: c.time,
        position: 'aboveBar',
        color: '#38bdf8',
        shape: 'circle',
        text: 'TP EXIT +$3,480 (+5.6%)',
        price: c.high,
        side: 'EXIT',
        pnl: 3480,
      };
    } else if (i === 48) {
      c.marker = {
        id: 'tm-3',
        time: c.time,
        position: 'aboveBar',
        color: '#f43f5e',
        shape: 'arrowDown',
        text: 'SELL SHORT $68,410',
        price: c.high,
        side: 'SELL',
      };
    } else if (i === 60) {
      c.marker = {
        id: 'tm-4',
        time: c.time,
        position: 'belowBar',
        color: '#38bdf8',
        shape: 'circle',
        text: 'EXIT SHORT +$2,120 (+3.1%)',
        price: c.low,
        side: 'EXIT',
        pnl: 2120,
      };
    } else if (i === 74) {
      c.marker = {
        id: 'tm-5',
        time: c.time,
        position: 'belowBar',
        color: '#10b981',
        shape: 'arrowUp',
        text: 'BUY LONG $73,150',
        price: c.low,
        side: 'BUY',
      };
    } else if (i === 86) {
      c.marker = {
        id: 'tm-6',
        time: c.time,
        position: 'aboveBar',
        color: '#f43f5e',
        shape: 'circle',
        text: 'STOP LOSS -$1,240 (-1.7%)',
        price: c.high,
        side: 'EXIT',
        pnl: -1240,
      };
    } else if (i === 92) {
      c.marker = {
        id: 'tm-7',
        time: c.time,
        position: 'belowBar',
        color: '#10b981',
        shape: 'arrowUp',
        text: 'BUY LONG $76,400',
        price: c.low,
        side: 'BUY',
      };
    }
  }

  return candles;
}

export const INITIAL_CANDLES = generateRealisticCandles(62400, 100);

export const SAMPLE_TRADES: Trade[] = [
  {
    id: 'TRD-9042',
    timestamp: '2025-02-27 16:00',
    exitTimestamp: '2025-02-28 08:00',
    symbol: 'BTC/USDT',
    side: 'LONG',
    entryPrice: 76420.5,
    exitPrice: 79210.0,
    size: 1.85,
    notional: 141377.92,
    pnl: 5160.58,
    pnlPercent: 3.65,
    fees: 56.55,
    funding: -12.4,
    netPnl: 5091.63,
    slippageBps: 2.1,
    exitReason: 'TAKE_PROFIT',
    durationBars: 6,
    mfe: 4.12,
    mae: -0.45,
  },
  {
    id: 'TRD-9041',
    timestamp: '2025-02-24 12:00',
    exitTimestamp: '2025-02-25 04:00',
    symbol: 'BTC/USDT',
    side: 'LONG',
    entryPrice: 73150.0,
    exitPrice: 71910.0,
    size: 1.5,
    notional: 109725.0,
    pnl: -1860.0,
    pnlPercent: -1.7,
    fees: 43.89,
    funding: 8.5,
    netPnl: -1895.39,
    slippageBps: 3.4,
    exitReason: 'STOP_LOSS',
    durationBars: 4,
    mfe: 0.85,
    mae: -1.92,
  },
  {
    id: 'TRD-9040',
    timestamp: '2025-02-21 08:00',
    exitTimestamp: '2025-02-23 00:00',
    symbol: 'BTC/USDT',
    side: 'SHORT',
    entryPrice: 68410.0,
    exitPrice: 66290.0,
    size: 2.0,
    notional: 136820.0,
    pnl: 4240.0,
    pnlPercent: 3.1,
    fees: 54.72,
    funding: 42.1,
    netPnl: 4227.38,
    slippageBps: 1.8,
    exitReason: 'TAKE_PROFIT',
    durationBars: 10,
    mfe: 3.55,
    mae: -0.32,
  },
  {
    id: 'TRD-9039',
    timestamp: '2025-02-18 20:00',
    exitTimestamp: '2025-02-20 04:00',
    symbol: 'BTC/USDT',
    side: 'LONG',
    entryPrice: 61240.0,
    exitPrice: 64720.0,
    size: 2.2,
    notional: 134728.0,
    pnl: 7656.0,
    pnlPercent: 5.68,
    fees: 53.89,
    funding: -18.2,
    netPnl: 7583.91,
    slippageBps: 2.5,
    exitReason: 'TAKE_PROFIT',
    durationBars: 8,
    mfe: 6.2,
    mae: -0.8,
  },
  {
    id: 'TRD-9038',
    timestamp: '2025-02-14 04:00',
    exitTimestamp: '2025-02-16 12:00',
    symbol: 'ETH/USDT',
    side: 'LONG',
    entryPrice: 2840.5,
    exitPrice: 3012.0,
    size: 35.0,
    notional: 99417.5,
    pnl: 6002.5,
    pnlPercent: 6.04,
    fees: 39.76,
    funding: -15.4,
    netPnl: 5947.34,
    slippageBps: 1.9,
    exitReason: 'TAKE_PROFIT',
    durationBars: 14,
    mfe: 6.8,
    mae: -1.1,
  },
  {
    id: 'TRD-9037',
    timestamp: '2025-02-10 16:00',
    exitTimestamp: '2025-02-11 08:00',
    symbol: 'SOL/USDT',
    side: 'SHORT',
    entryPrice: 178.5,
    exitPrice: 184.2,
    size: 400.0,
    notional: 71400.0,
    pnl: -2280.0,
    pnlPercent: -3.19,
    fees: 28.56,
    funding: 6.2,
    netPnl: -2302.36,
    slippageBps: 4.2,
    exitReason: 'STOP_LOSS',
    durationBars: 4,
    mfe: 0.45,
    mae: -3.4,
  },
  {
    id: 'TRD-9036',
    timestamp: '2025-02-06 00:00',
    exitTimestamp: '2025-02-08 12:00',
    symbol: 'BTC/USDT',
    side: 'LONG',
    entryPrice: 58900.0,
    exitPrice: 61400.0,
    size: 1.8,
    notional: 106020.0,
    pnl: 4500.0,
    pnlPercent: 4.24,
    fees: 42.4,
    funding: -8.9,
    netPnl: 4448.7,
    slippageBps: 2.0,
    exitReason: 'TAKE_PROFIT',
    durationBars: 15,
    mfe: 4.9,
    mae: -0.65,
  },
  {
    id: 'TRD-9035',
    timestamp: '2025-02-02 12:00',
    exitTimestamp: '2025-02-03 20:00',
    symbol: 'BTC/USDT',
    side: 'SHORT',
    entryPrice: 57400.0,
    exitPrice: 55850.0,
    size: 1.5,
    notional: 86100.0,
    pnl: 2325.0,
    pnlPercent: 2.7,
    fees: 34.44,
    funding: 14.8,
    netPnl: 2305.36,
    slippageBps: 1.5,
    exitReason: 'TAKE_PROFIT',
    durationBars: 8,
    mfe: 3.1,
    mae: -0.4,
  },
  {
    id: 'TRD-9034',
    timestamp: '2025-01-29 08:00',
    exitTimestamp: '2025-01-30 16:00',
    symbol: 'AVAX/USDT',
    side: 'LONG',
    entryPrice: 32.4,
    exitPrice: 31.2,
    size: 2000.0,
    notional: 64800.0,
    pnl: -2400.0,
    pnlPercent: -3.7,
    fees: 25.92,
    funding: -4.1,
    netPnl: -2430.02,
    slippageBps: 5.1,
    exitReason: 'STOP_LOSS',
    durationBars: 8,
    mfe: 1.2,
    mae: -3.9,
  },
  {
    id: 'TRD-9033',
    timestamp: '2025-01-24 16:00',
    exitTimestamp: '2025-01-27 00:00',
    symbol: 'BTC/USDT',
    side: 'LONG',
    entryPrice: 52100.0,
    exitPrice: 56450.0,
    size: 2.0,
    notional: 104200.0,
    pnl: 8700.0,
    pnlPercent: 8.35,
    fees: 41.68,
    funding: -22.5,
    netPnl: 8635.82,
    slippageBps: 2.2,
    exitReason: 'TRAILING_STOP',
    durationBars: 14,
    mfe: 9.1,
    mae: -0.9,
  },
];

export const SAMPLE_ORDERS: Order[] = [
  {
    id: 'ORD-88219',
    tradeId: 'TRD-9042',
    timestamp: '2025-02-28 08:00:12',
    symbol: 'BTC/USDT',
    type: 'LIMIT',
    side: 'SELL',
    price: 79210.0,
    avgFillPrice: 79208.5,
    amount: 1.85,
    status: 'FILLED',
    fee: 28.25,
    slippage: 1.5,
  },
  {
    id: 'ORD-88218',
    tradeId: 'TRD-9042',
    timestamp: '2025-02-27 16:00:04',
    symbol: 'BTC/USDT',
    type: 'MARKET',
    side: 'BUY',
    price: 76420.5,
    avgFillPrice: 76422.1,
    amount: 1.85,
    status: 'FILLED',
    fee: 28.3,
    slippage: 1.6,
  },
  {
    id: 'ORD-88217',
    tradeId: 'TRD-9041',
    timestamp: '2025-02-25 04:00:02',
    symbol: 'BTC/USDT',
    type: 'STOP_MARKET',
    side: 'SELL',
    price: 71910.0,
    avgFillPrice: 71905.2,
    amount: 1.5,
    status: 'FILLED',
    fee: 21.57,
    slippage: 4.8,
  },
  {
    id: 'ORD-88216',
    tradeId: 'TRD-9041',
    timestamp: '2025-02-24 12:00:00',
    symbol: 'BTC/USDT',
    type: 'LIMIT',
    side: 'BUY',
    price: 73150.0,
    avgFillPrice: 73150.0,
    amount: 1.5,
    status: 'FILLED',
    fee: 22.32,
    slippage: 0.0,
  },
  {
    id: 'ORD-88215',
    tradeId: 'TRD-9040',
    timestamp: '2025-02-23 00:00:05',
    symbol: 'BTC/USDT',
    type: 'LIMIT',
    side: 'BUY',
    price: 66290.0,
    avgFillPrice: 66290.0,
    amount: 2.0,
    status: 'FILLED',
    fee: 27.36,
    slippage: 0.0,
  },
];

export function generateEquityHistory(initialCapital: number = 100000, pointsCount: number = 120): EquityPoint[] {
  const points: EquityPoint[] = [];
  let currentEquity = initialCapital;
  let benchmarkEquity = initialCapital;
  let peakEquity = initialCapital;
  let cumulativePnl = 0;

  const now = new Date('2025-02-28');

  for (let i = pointsCount - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 3600 * 1000);
    const dateStr = d.toISOString().slice(0, 10);

    // Strategy drift vs benchmark drift
    const btcDailyReturn = 0.0018 + (Math.sin(i / 10) * 0.015) + (Math.random() - 0.48) * 0.025;
    benchmarkEquity = Math.round(benchmarkEquity * (1 + btcDailyReturn));

    // Quant strategy has higher Sharpe, less downside
    const stratDailyReturn = btcDailyReturn > 0
      ? btcDailyReturn * 1.25 + 0.0015 + (Math.random() - 0.4) * 0.008
      : btcDailyReturn * 0.35 + (Math.random() - 0.4) * 0.006;

    const dayPnl = Math.round(currentEquity * stratDailyReturn);
    currentEquity += dayPnl;
    cumulativePnl += dayPnl;

    if (currentEquity > peakEquity) {
      peakEquity = currentEquity;
    }

    const drawdownPct = Number((((currentEquity - peakEquity) / peakEquity) * 100).toFixed(2));

    points.push({
      time: dateStr,
      equity: currentEquity,
      benchmarkEquity,
      drawdownPct,
      pnl: dayPnl,
      cumulativePnl,
    });
  }

  return points;
}

export const SAMPLE_EQUITY_CURVE = generateEquityHistory(100000, 120);

export const SAMPLE_PERFORMANCE: PerformanceMetrics = {
  totalReturn: 142.85,
  annualizedReturn: 88.40,
  benchmarkReturn: 52.10,
  alpha: 0.36,
  beta: 0.48,
  sharpeRatio: 2.41,
  sortinoRatio: 3.18,
  calmarRatio: 10.5,
  maxDrawdown: -8.42,
  maxDrawdownDurationDays: 14,
  winRate: 64.2,
  profitFactor: 2.34,
  totalTrades: 168,
  winningTrades: 108,
  losingTrades: 60,
  avgTradePnl: 850.32,
  avgWin: 1845.20,
  avgLoss: -810.15,
  winLossRatio: 2.28,
  expectancy: 0.89,
  totalFeesPaid: 4218.40,
  totalFundingPaid: 612.30,
  recoveryFactor: 16.96,
  dailyVolAnnualized: 26.4,
  valueAtRisk95: -2.15,
  expectedShortfall95: -3.42,
};

export const SAMPLE_MONTHLY_RETURNS: MonthlyReturn[] = [
  {
    year: 2025,
    months: [8.4, 6.2, null, null, null, null, null, null, null, null, null, null],
    ytd: 15.1,
  },
  {
    year: 2024,
    months: [12.4, 15.8, -2.1, 7.4, 9.2, -4.5, 11.2, 6.8, 4.1, 14.3, 18.2, 8.9],
    ytd: 142.8,
  },
  {
    year: 2023,
    months: [14.2, 3.8, 9.5, -1.8, 5.2, 8.4, 2.1, -3.4, 7.8, 16.4, 11.2, 14.5],
    ytd: 118.5,
  },
];

export const SAMPLE_RISK_METRICS: RiskMetrics = {
  assetExposures: [
    { symbol: 'BTC/USDT', notional: 141377.92, pct: 58.2, side: 'LONG', delta: 1.85 },
    { symbol: 'ETH/USDT', notional: 58400.0, pct: 24.0, side: 'LONG', delta: 20.5 },
    { symbol: 'SOL/USDT', notional: 28600.0, pct: 11.8, side: 'SHORT', delta: -160.0 },
    { symbol: 'AVAX/USDT', notional: 14600.0, pct: 6.0, side: 'LONG', delta: 450.0 },
  ],
  netExposure: 185977.92,
  grossExposure: 242977.92,
  currentLeverage: 1.71,
  maxAllowedLeverage: 5.0,
  var95_1D: -2.15,
  var99_1D: -3.85,
  cvar99_1D: -5.12,
  liquidationPriceBtc: 38450.0,
  liquidationDistancePct: 49.68,
  stressScenarios: [
    {
      id: 'scen-1',
      name: 'FTX Collapse Liquidity Cascade',
      date: 'Nov 2022',
      description: 'Exchange run with correlated crypto selloff, funding dislocations, and altcoin capitulation.',
      shockPct: -38.5,
      portfolioLoss: -24150.0,
      portfolioLossPct: -9.94,
      marginUtilization: 52.4,
      liquidationRisk: 'SAFE',
    },
    {
      id: 'scen-2',
      name: 'COVID Black Thursday Liquidation',
      date: 'Mar 2020',
      description: 'Mass liquidation spiral, orderbook vacuum, -50% 24h drop, funding rates -0.375% per 8h.',
      shockPct: -51.2,
      portfolioLoss: -42800.0,
      portfolioLossPct: -17.61,
      marginUtilization: 78.6,
      liquidationRisk: 'WARNING',
    },
    {
      id: 'scen-3',
      name: 'Luna / Terra Algorithmic Implosion',
      date: 'May 2022',
      description: 'Stablecoin depeg, multi-billion liquidation debt, high volatility regime.',
      shockPct: -32.0,
      portfolioLoss: -18900.0,
      portfolioLossPct: -7.78,
      marginUtilization: 44.1,
      liquidationRisk: 'SAFE',
    },
    {
      id: 'scen-4',
      name: 'China Mining & Perp Ban Flash',
      date: 'May 2021',
      description: 'Sudden hash rate exodus and forced retail margin unwinding.',
      shockPct: -28.4,
      portfolioLoss: -16200.0,
      portfolioLossPct: -6.67,
      marginUtilization: 38.9,
      liquidationRisk: 'SAFE',
    },
  ],
  correlationMatrix: {
    symbols: ['BTC', 'ETH', 'SOL', 'AVAX', 'BNB'],
    matrix: [
      [1.00, 0.88, 0.74, 0.71, 0.82],
      [0.88, 1.00, 0.79, 0.76, 0.85],
      [0.74, 0.79, 1.00, 0.84, 0.72],
      [0.71, 0.76, 0.84, 1.00, 0.69],
      [0.82, 0.85, 0.72, 0.69, 1.00],
    ],
  },
};

// Heatmap data: Lookback (Fast EMA) vs Stop Loss (ATR Multiplier)
export const SAMPLE_HEATMAP_CELLS: OptimizationHeatmapCell[] = [
  { xValue: 10, yValue: 1.0, sharpe: 1.12, returnPct: 45.2, maxDd: -18.4, trades: 310 },
  { xValue: 10, yValue: 1.5, sharpe: 1.45, returnPct: 62.1, maxDd: -14.2, trades: 260 },
  { xValue: 10, yValue: 2.0, sharpe: 1.82, returnPct: 84.5, maxDd: -11.5, trades: 220 },
  { xValue: 10, yValue: 2.5, sharpe: 1.95, returnPct: 92.4, maxDd: -10.1, trades: 195 },
  { xValue: 10, yValue: 3.0, sharpe: 1.70, returnPct: 78.0, maxDd: -12.4, trades: 175 },

  { xValue: 15, yValue: 1.0, sharpe: 1.35, returnPct: 58.4, maxDd: -15.8, trades: 275 },
  { xValue: 15, yValue: 1.5, sharpe: 1.78, returnPct: 82.0, maxDd: -12.1, trades: 230 },
  { xValue: 15, yValue: 2.0, sharpe: 2.15, returnPct: 112.4, maxDd: -9.4, trades: 190 },
  { xValue: 15, yValue: 2.5, sharpe: 2.32, returnPct: 128.6, maxDd: -8.8, trades: 172 },
  { xValue: 15, yValue: 3.0, sharpe: 2.04, returnPct: 104.2, maxDd: -10.2, trades: 154 },

  { xValue: 21, yValue: 1.0, sharpe: 1.52, returnPct: 71.0, maxDd: -14.1, trades: 240 },
  { xValue: 21, yValue: 1.5, sharpe: 1.98, returnPct: 102.5, maxDd: -10.8, trades: 205 },
  { xValue: 21, yValue: 2.0, sharpe: 2.41, returnPct: 142.8, maxDd: -8.4, trades: 168 }, // Optimal Peak
  { xValue: 21, yValue: 2.5, sharpe: 2.38, returnPct: 139.2, maxDd: -8.6, trades: 152 },
  { xValue: 21, yValue: 3.0, sharpe: 2.18, returnPct: 118.0, maxDd: -9.5, trades: 138 },

  { xValue: 30, yValue: 1.0, sharpe: 1.40, returnPct: 64.2, maxDd: -15.2, trades: 195 },
  { xValue: 30, yValue: 1.5, sharpe: 1.84, returnPct: 91.0, maxDd: -11.6, trades: 170 },
  { xValue: 30, yValue: 2.0, sharpe: 2.12, returnPct: 116.4, maxDd: -9.8, trades: 145 },
  { xValue: 30, yValue: 2.5, sharpe: 2.08, returnPct: 112.1, maxDd: -10.1, trades: 130 },
  { xValue: 30, yValue: 3.0, sharpe: 1.92, returnPct: 98.5, maxDd: -11.0, trades: 118 },

  { xValue: 50, yValue: 1.0, sharpe: 1.20, returnPct: 51.5, maxDd: -17.2, trades: 150 },
  { xValue: 50, yValue: 1.5, sharpe: 1.58, returnPct: 74.0, maxDd: -13.5, trades: 132 },
  { xValue: 50, yValue: 2.0, sharpe: 1.85, returnPct: 94.2, maxDd: -11.2, trades: 115 },
  { xValue: 50, yValue: 2.5, sharpe: 1.80, returnPct: 89.0, maxDd: -11.8, trades: 104 },
  { xValue: 50, yValue: 3.0, sharpe: 1.65, returnPct: 76.5, maxDd: -12.9, trades: 94 },
];

export const SAMPLE_WALK_FORWARD = [
  { window: 'Window 1 (2023 H1)', inSampleReturn: 64.2, outOfSampleReturn: 52.4, wfe: 81.6 },
  { window: 'Window 2 (2023 H2)', inSampleReturn: 58.1, outOfSampleReturn: 48.7, wfe: 83.8 },
  { window: 'Window 3 (2024 H1)', inSampleReturn: 76.5, outOfSampleReturn: 68.2, wfe: 89.1 },
  { window: 'Window 4 (2024 H2)', inSampleReturn: 82.4, outOfSampleReturn: 74.6, wfe: 90.5 },
];

export const SAMPLE_REGIME_ANALYSIS: RegimeAnalysis[] = [
  { regime: 'Bull Trend', periodPct: 42, trades: 78, winRate: 74.4, profitFactor: 3.12, returnPct: 88.5, avgPnl: 1134 },
  { regime: 'Rangebound Chop', periodPct: 28, trades: 44, winRate: 52.3, profitFactor: 1.48, returnPct: 16.2, avgPnl: 368 },
  { regime: 'High Volatility', periodPct: 18, trades: 31, winRate: 61.3, profitFactor: 2.15, returnPct: 34.8, avgPnl: 1122 },
  { regime: 'Bear Trend', periodPct: 12, trades: 15, winRate: 46.7, profitFactor: 1.18, returnPct: 3.35, avgPnl: 223 },
];

export const SAMPLE_MONTE_CARLO = [
  { percentile: '95th Percentile (Optimistic)', finalEquity: 312500, returnPct: 212.5, maxDd: -5.2 },
  { percentile: '75th Percentile (Upper Bound)', finalEquity: 274800, returnPct: 174.8, maxDd: -6.9 },
  { percentile: '50th Percentile (Median Path)', finalEquity: 242850, returnPct: 142.8, maxDd: -8.4 },
  { percentile: '25th Percentile (Lower Bound)', finalEquity: 204200, returnPct: 104.2, maxDd: -10.8 },
  { percentile: '5th Percentile (Stress Path)', finalEquity: 168400, returnPct: 68.4, maxDd: -14.2 },
];
