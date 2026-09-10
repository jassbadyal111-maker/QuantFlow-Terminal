export interface FundingRateRecord {
  timestamp: number;
  time: string;
  symbol: string;
  rate: number; // e.g. 0.0001 = 0.01%
  markPrice?: number;
  intervalHours: number;
}

export interface OpenInterestRecord {
  timestamp: number;
  time: string;
  symbol: string;
  openInterest: number;
  openInterestValue: number;
}

export interface MarketTrade {
  id: string;
  timestamp: number;
  price: number;
  quantity: number;
  side: 'BUY' | 'SELL';
}

export interface ExecutionRecord {
  orderId: string;
  timestamp: string;
  requestedPrice: number;
  fillPrice: number;
  quantity: number;
  notional: number;
  fee: number;
  slippage: number;
  liquiditySide: 'MAKER' | 'TAKER';
  status: 'FILLED' | 'PARTIAL' | 'REJECTED';
}

export type MarketDataErrorCode =
  | 'DATA_FETCH_FAILED'
  | 'RATE_LIMITED'
  | 'INVALID_DATA'
  | 'DATA_GAP'
  | 'UNSUPPORTED_SYMBOL'
  | 'UNSUPPORTED_TIMEFRAME'
  | 'FUNDING_UNAVAILABLE'
  | 'INSUFFICIENT_DATA'
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
