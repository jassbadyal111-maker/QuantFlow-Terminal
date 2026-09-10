export interface FundingRateRecord {
  timestamp: number;
  time: string;
  symbol: string;
  rate: number; // e.g. 0.0001 = 0.01%
  markPrice?: number;
  intervalHours: number;
}

export interface FundingEvent {
  timestamp: number;
  time: string;
  symbol: string;
  rate: number;
  markPrice: number;
  intervalHours: number;
  positionNotional: number;
  payment: number; // positive = paid, negative = received
  side: 'LONG' | 'SHORT';
  cashBefore: number;
  cashAfter: number;
}

export interface LiquidationEvent {
  timestamp: number;
  time: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  quantity: number;
  liquidationPrice: number;
  bankruptcyPrice: number;
  maintenanceMargin: number;
  loss: number;
  fee: number;
  reason: string;
}

export interface TradeLedgerEntry {
  tradeId: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  entryTimestamp: string;
  exitTimestamp: string;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  notional: number;
  grossPnl: number;
  fees: number;
  funding: number;
  slippage: number;
  netPnl: number;
  mfe: number;
  mae: number;
  durationBars: number;
  exitReason: string;
  entryExecutionIds: string[];
  exitExecutionIds: string[];
}

export interface OpenInterestRecord {
  timestamp: number;
  time: string;
  symbol: string;
  openInterest: number;
  openInterestValue?: number;
}

export interface MarketTrade {
  id: string;
  timestamp: number;
  price: number;
  quantity: number;
  side: 'BUY' | 'SELL';
}

export interface ExecutionRecord {
  executionId: string;
  orderId: string;
  timestamp: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  orderType: 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT';
  requestedPrice: number;
  fillPrice: number;
  requestedQuantity: number;
  filledQuantity: number;
  remainingQuantity: number;
  fee: number;
  feeRate: number;
  slippage: number;
  latency: number;
  liquiditySource: 'MAKER' | 'TAKER';
  status: 'FILLED' | 'PARTIAL' | 'REJECTED';
  // Backward-compatible properties
  quantity?: number;
  notional?: number;
  liquiditySide?: 'MAKER' | 'TAKER';
}

export type MarketDataErrorCode =
  | 'DATA_FETCH_FAILED'
  | 'RATE_LIMITED'
  | 'INVALID_DATA'
  | 'DATA_INCOMPLETE'
  | 'DATA_INVALID'
  | 'DATA_GAP'
  | 'UNSUPPORTED_SYMBOL'
  | 'UNSUPPORTED_TIMEFRAME'
  | 'FUNDING_UNAVAILABLE'
  | 'INSUFFICIENT_DATA'
  | 'EXECUTION_REJECTED'
  | 'INSUFFICIENT_MARGIN'
  | 'LIQUIDATION'
  | 'INVALID_CONFIGURATION'
  | 'REPRODUCIBILITY_ERROR'
  | 'INVARIANT_VIOLATION'
  | 'BACKTEST_FAILED';

export class MarketDataError extends Error {
  public code: MarketDataErrorCode;
  public technicalDetails?: string;
  public retryable: boolean;

  constructor(
    code: MarketDataErrorCode,
    message: string,
    technicalDetails?: string,
    retryable: boolean = false
  ) {
    super(message);
    this.name = 'MarketDataError';
    this.code = code;
    this.technicalDetails = technicalDetails;
    this.retryable = retryable;
  }
}
