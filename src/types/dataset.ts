import { BacktestConfig, CandleData, EquityPoint, Order, PerformanceMetrics, Trade } from './backtest';
import { ExecutionRecord, FundingEvent, LiquidationEvent, TradeLedgerEntry } from './marketData';

export type ExchangeId = 'BINANCE' | 'BYBIT' | 'MOCK';
export type MarketType = 'PERPETUAL' | 'SPOT';
export type ValidationStatus = 'PASSED' | 'WARNINGS' | 'FAILED';

export interface DatasetMetadata {
  id: string;
  datasetId?: string;
  exchange?: ExchangeId;
  marketType?: MarketType;
  symbol: string;
  timeframe: string;
  requestedStart?: string;
  requestedEnd?: string;
  actualStart?: string;
  actualEnd?: string;
  startTime?: string;
  endTime?: string;
  rowCount?: number;
  expectedRowCount?: number;
  source: 'EXCHANGE_API' | 'DEMO_SYNTHETIC' | 'LOCAL_CACHE';
  providerName: string;
  downloadedAt?: string;
  checksum?: string;
  schemaVersion?: string;
  validationStatus: ValidationStatus;
  missingIntervals?: number;
  missingBarsCount?: number;
  duplicateRows?: number;
  duplicateCount?: number;
  minPrice?: number;
  maxPrice?: number;
  minVolume?: number;
  maxVolume?: number;
  timezone: string;
  version?: string;
  isSynthetic: boolean;
  seed?: number;
  validationNotes?: string[];
  name?: string;
  totalBars?: number;
  dateRange?: {
    start: string;
    end: string;
  };
}

export interface ValidationStatistics {
  totalBars: number;
  duplicateRows: number;
  missingIntervals: number;
  minPrice: number;
  maxPrice: number;
  minVolume: number;
  maxVolume: number;
  startTime: string;
  endTime: string;
  expectedIntervalMinutes: number;
  abnormalGapsCount: number;
  invalidOhlcCount: number;
  expectedRowCount?: number;
  actualRowCount?: number;
}

export interface ValidationReport {
  valid: boolean;
  warnings: string[];
  errors: string[];
  statistics: ValidationStatistics;
}

export interface ExecutionAssumptions {
  makerFeeBps: number;
  takerFeeBps: number;
  slippageModel: string;
  slippageBps: number;
  bidAskSpreadBps: number;
  latencyMs: number;
  partialFillRatio: number;
  fundingMode: 'HISTORICAL' | 'SIMULATED' | 'IGNORED';
  sameBarExecutionPolicy?: 'NEXT_BAR' | 'OPEN' | 'CLOSE';
  intrabarPolicy?: 'CONSERVATIVE' | 'OHLC_SEQUENCE' | 'TICK_DATA';
}

export interface BacktestSnapshot {
  snapshotId: string;
  runId: string;
  createdAt: string;
  engineVersion: string;
  strategyVersion: string;
  datasetMetadata: DatasetMetadata;
  config: BacktestConfig;
  metrics: PerformanceMetrics;
  trades: Trade[];
  orders: Order[];
  equityCurve: EquityPoint[];
  validationReport: ValidationReport;
  executionAssumptions: ExecutionAssumptions;
  reproducibilityHash: string;
  executionRecords?: ExecutionRecord[];
  fundingEvents?: FundingEvent[];
  liquidationEvents?: LiquidationEvent[];
  tradeLedger?: TradeLedgerEntry[];
}
