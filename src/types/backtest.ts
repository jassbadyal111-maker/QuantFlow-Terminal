import { ExecutionRecord, FundingEvent, LiquidationEvent, TradeLedgerEntry } from './marketData';

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

export interface DatasetMetadata {
  id: string;
  datasetId?: string;
  name?: string;
  exchange?: 'BINANCE' | 'BYBIT' | 'MOCK';
  marketType?: 'PERPETUAL' | 'SPOT';
  source: 'DEMO_SYNTHETIC' | 'EXCHANGE_API' | 'LOCAL_CACHE';
  providerName: string;
  symbol: string;
  timeframe: string;
  dateRange?: {
    start: string;
    end: string;
  };
  startTime?: string;
  endTime?: string;
  totalBars?: number;
  rowCount?: number;
  downloadedAt?: string;
  checksum?: string;
  schemaVersion?: string;
  missingBarsCount?: number;
  missingIntervals?: number;
  duplicateCount?: number;
  duplicateRows?: number;
  minPrice?: number;
  maxPrice?: number;
  minVolume?: number;
  maxVolume?: number;
  timezone: string;
  seed?: number;
  version?: string;
  isSynthetic: boolean;
  validationStatus: 'PASSED' | 'WARNINGS' | 'FAILED';
  validationNotes?: string[];
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
  marginMode?: 'CROSS' | 'ISOLATED';
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
    bidAskSpreadBps?: number;
    slippageModel: 'fixed' | 'linear_impact' | 'sqrt_impact';
    slippageBps: number;
    fundingRate8hBps: number;
    latencyMs: number;
    partialFillProbability?: number;
  };
  sameBarExecutionPolicy?: 'NEXT_BAR' | 'OPEN' | 'CLOSE';
  intrabarPolicy?: 'CONSERVATIVE' | 'OHLC_SEQUENCE' | 'TICK_DATA';
  dataset?: DatasetMetadata;
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
  exitReason: 'TAKE_PROFIT' | 'STOP_LOSS' | 'SIGNAL_REVERSAL' | 'TIME_STOP' | 'TRAILING_STOP' | 'LIQUIDATION' | 'MANUAL';
  durationBars: number;
  durationMs?: number;
  mfe: number; // Max Favorable Excursion %
  mae: number; // Max Adverse Excursion %
  entryOrderId?: string;
  exitOrderId?: string;
}

export interface Order {
  id: string;
  tradeId: string;
  timestamp: string;
  symbol: string;
  type: 'MARKET' | 'LIMIT' | 'STOP_MARKET' | 'STOP_LIMIT';
  side: 'BUY' | 'SELL';
  price: number;
  avgFillPrice: number;
  amount: number;
  filledAmount?: number;
  status: 'FILLED' | 'PARTIAL' | 'CANCELLED' | 'REJECTED';
  fee: number;
  slippage: number;
  latencyMs?: number;
  rejectionReason?: string;
}

export interface Position {
  symbol: string;
  side: 'LONG' | 'SHORT';
  size: number;
  notional: number;
  entryPrice: number;
  currentPrice: number;
  leverage: number;
  marginMode: 'CROSS' | 'ISOLATED';
  initialMargin: number;
  maintenanceMargin: number;
  unrealizedPnl: number;
  liquidationPrice: number;
}

export interface EquityPoint {
  time: string;
  timestamp?: number;
  equity: number;
  benchmarkEquity: number;
  drawdownPct: number;
  pnl: number;
  cumulativePnl: number;
  cashBalance?: number;
  positionNotional?: number;
  unrealizedPnl?: number;
  realizedPnl?: number;
  cumulativeFees?: number;
  cumulativeFunding?: number;
  marginUtilization?: number;
  netExposure?: number;
  grossExposure?: number;
}

export interface PerformanceMetrics {
  totalReturn: number;
  annualizedReturn: number;
  cagr?: number;
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
  payoffRatio?: number;
  expectancy: number;
  turnover?: number;
  totalFeesPaid: number;
  totalFundingPaid: number;
  totalSlippagePaid?: number;
  recoveryFactor: number;
  dailyVolAnnualized: number;
  valueAtRisk95: number;
  expectedShortfall95: number;
  exposureRatio?: number;
  avgTradeDurationHours?: number;
  maxConsecutiveLosses?: number;
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
  winRate?: number;
  profitFactor?: number;
}

export interface MonteCarloPath {
  pathId: number;
  points: { step: number; equity: number }[];
  finalReturn: number;
  maxDd: number;
}

export interface MonteCarloAnalysis {
  paths: MonteCarloPath[];
  percentiles: {
    percentile: string;
    finalEquity: number;
    returnPct: number;
    maxDd: number;
  }[];
  probabilityOfRuin: number; // % of paths that suffered >50% drawdown or liquidation
  confidenceInterval95: [number, number];
  medianSharpe: number;
  simulatedPathsCount: number;
}

export interface WalkForwardWindow {
  window: string;
  inSampleRange: string;
  outOfSampleRange: string;
  inSampleReturn: number;
  inSampleSharpe: number;
  outOfSampleReturn: number;
  outOfSampleSharpe: number;
  wfe: number; // Walk Forward Efficiency % (OOS return / IS return)
  robustnessStatus: 'ROBUST' | 'DEGRADED' | 'OVERFIT';
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

export interface ValidationWarning {
  id: string;
  type: 'LOOKAHEAD_BIAS' | 'CURVE_FITTING' | 'DATA_GAP' | 'UNREALISTIC_EXECUTION' | 'SMALL_SAMPLE_SIZE';
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  message: string;
  metricValue?: string;
  recommendation: string;
}

export interface BacktestResult {
  runId: string;
  timestamp: string;
  reproducibilityHash: string;
  engineVersion: string;
  isDeterministic: boolean;
  dataset: DatasetMetadata;
  config: BacktestConfig;
  candles: CandleData[];
  trades: Trade[];
  orders: Order[];
  equityCurve: EquityPoint[];
  metrics: PerformanceMetrics;
  monthlyReturns: MonthlyReturn[];
  validationWarnings: ValidationWarning[];
  logs: string[];
  executionRecords?: ExecutionRecord[];
  fundingEvents?: FundingEvent[];
  liquidationEvents?: LiquidationEvent[];
  tradeLedger?: TradeLedgerEntry[];
  invariantsPassed?: boolean;
  invariantCheckErrors?: string[];
}

export interface BacktestRunRecord {
  id: string;
  name: string;
  timestamp: string;
  strategyId: string;
  strategyName: string;
  strategyVersion: string;
  symbol: string;
  timeframe: string;
  dateRange: string;
  reproducibilityHash: string;
  datasetSource: string;
  isSynthetic: boolean;
  config: BacktestConfig;
  metrics: PerformanceMetrics;
  tradesCount: number;
  result: BacktestResult;
}
