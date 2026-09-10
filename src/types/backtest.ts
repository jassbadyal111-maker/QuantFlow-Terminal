export type NavView =
  | 'dashboard'
  | 'backtest'
  | 'strategies'
  | 'research'
  | 'risk'
  | 'trades'
  | 'compare'
  | 'reports'
  | 'market-data'
  | 'settings';

export type StrategyType =
  | 'momentum'
  | 'mean-reversion'
  | 'volatility-breakout'
  | 'arbitrage'
  | 'market-making'
  | 'ml-trend';

export interface Strategy {
  id: string;
  name: string;
  version: string;
  type: StrategyType;
  author: string;
  symbol: string;
  timeframe: string;
  description: string;
  sharpe: number;
  returnPct: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
  tradesCount: number;
  status: 'ACTIVE' | 'DEVELOPMENT' | 'BACKTESTED' | 'ARCHIVED';
  lastRun: string;
  code: string;
  parameters: Record<string, number | string | boolean>;
}

export interface BacktestConfig {
  strategyId: string;
  exchange: string;
  symbol: string;
  timeframe: '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
  dateRange: {
    start: string;
    end: string;
    preset: '3M' | '6M' | '1Y' | '3Y' | 'ALL';
  };
  initialCapital: number;
  leverage: number;
  positionSizing: {
    type: 'fixed_usd' | 'percent_equity' | 'vol_target' | 'kelly';
    value: number; // e.g. 10000 USD or 20% equity
  };
  indicators: {
    emaFast: number;
    emaSlow: number;
    atrPeriod: number;
    rsiPeriod: number;
    bbLength: number;
    bbStdDev: number;
  };
  entryRules: {
    longCond: 'EMA_CROSSOVER' | 'BOLLINGER_BREAKOUT' | 'RSI_OVERSOLD' | 'MOMENTUM_FILTER';
    shortCond: 'EMA_CROSSUNDER' | 'BOLLINGER_REVERSAL' | 'RSI_OVERBOUGHT' | 'MOMENTUM_FILTER';
    allowShorting: boolean;
    useVolFilter: boolean;
    volFilterMultiplier: number;
  };
  exitRules: {
    stopLossAtr: number;
    takeProfitAtr: number;
    trailingStop: boolean;
    breakevenAfterAtr: number;
    maxHoldBars: number;
  };
  execution: {
    makerFeeBps: number;
    takerFeeBps: number;
    slippageModel: 'fixed' | 'linear_impact' | 'sqrt_impact';
    slippageBps: number;
    fundingRate8hBps: number;
    latencyMs: number;
  };
}

export interface CandleData {
  time: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  emaFast?: number;
  emaSlow?: number;
  rsi?: number;
  atr?: number;
  bbUpper?: number;
  bbLower?: number;
  marker?: TradeMarker;
}

export interface TradeMarker {
  id: string;
  time: string;
  position: 'aboveBar' | 'belowBar';
  color: string;
  shape: 'arrowUp' | 'arrowDown' | 'circle';
  text: string;
  price: number;
  side: 'BUY' | 'SELL' | 'EXIT';
  pnl?: number;
}

export interface Trade {
  id: string;
  timestamp: string;
  exitTimestamp: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice: number;
  size: number;
  notional: number;
  pnl: number;
  pnlPercent: number;
  fees: number;
  funding: number;
  netPnl: number;
  slippageBps: number;
  exitReason: 'TAKE_PROFIT' | 'STOP_LOSS' | 'SIGNAL_REVERSAL' | 'TIME_STOP' | 'TRAILING_STOP';
  durationBars: number;
  mfe: number; // Max Favorable Excursion %
  mae: number; // Max Adverse Excursion %
}

export interface Order {
  id: string;
  tradeId: string;
  timestamp: string;
  symbol: string;
  type: 'MARKET' | 'LIMIT' | 'STOP_MARKET';
  side: 'BUY' | 'SELL';
  price: number;
  avgFillPrice: number;
  amount: number;
  status: 'FILLED' | 'PARTIAL' | 'CANCELLED';
  fee: number;
  slippage: number;
}

export interface EquityPoint {
  time: string;
  equity: number;
  benchmarkEquity: number;
  drawdownPct: number;
  pnl: number;
  cumulativePnl: number;
}

export interface PerformanceMetrics {
  totalReturn: number;
  annualizedReturn: number;
  benchmarkReturn: number;
  alpha: number;
  beta: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  maxDrawdown: number;
  maxDrawdownDurationDays: number;
  winRate: number;
  profitFactor: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  avgTradePnl: number;
  avgWin: number;
  avgLoss: number;
  winLossRatio: number;
  expectancy: number;
  totalFeesPaid: number;
  totalFundingPaid: number;
  recoveryFactor: number;
  dailyVolAnnualized: number;
  valueAtRisk95: number;
  expectedShortfall95: number;
}

export interface MonthlyReturn {
  year: number;
  months: (number | null)[]; // index 0..11 for Jan..Dec
  ytd: number;
}

export interface StressScenario {
  id: string;
  name: string;
  date: string;
  description: string;
  shockPct: number;
  portfolioLoss: number;
  portfolioLossPct: number;
  marginUtilization: number;
  liquidationRisk: 'SAFE' | 'WARNING' | 'CRITICAL';
}

export interface RiskMetrics {
  assetExposures: {
    symbol: string;
    notional: number;
    pct: number;
    side: 'LONG' | 'SHORT';
    delta: number;
  }[];
  netExposure: number;
  grossExposure: number;
  currentLeverage: number;
  maxAllowedLeverage: number;
  var95_1D: number;
  var99_1D: number;
  cvar99_1D: number;
  liquidationPriceBtc: number;
  liquidationDistancePct: number;
  stressScenarios: StressScenario[];
  correlationMatrix: {
    symbols: string[];
    matrix: number[][];
  };
}

export interface OptimizationHeatmapCell {
  xValue: number; // e.g. Fast EMA / Lookback
  yValue: number; // e.g. ATR Multiplier / SL
  sharpe: number;
  returnPct: number;
  maxDd: number;
  trades: number;
}

export interface MonteCarloPath {
  pathId: number;
  points: { step: number; equity: number }[];
  finalReturn: number;
  maxDd: number;
}

export interface RegimeAnalysis {
  regime: 'Bull Trend' | 'Bear Trend' | 'High Volatility' | 'Rangebound Chop';
  periodPct: number;
  trades: number;
  winRate: number;
  profitFactor: number;
  returnPct: number;
  avgPnl: number;
}

export interface BacktestResult {
  config: BacktestConfig;
  candles: CandleData[];
  trades: Trade[];
  orders: Order[];
  equityCurve: EquityPoint[];
  metrics: PerformanceMetrics;
  monthlyReturns: MonthlyReturn[];
  logs: string[];
}
