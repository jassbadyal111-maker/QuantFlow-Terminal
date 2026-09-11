export type BacktestErrorCode =
  | 'DATASET_INCOMPLETE'
  | 'DATASET_INVALID'
  | 'DATASET_GAP'
  | 'DATASET_DUPLICATE'
  | 'PAGINATION_LIMIT'
  | 'FUNDING_DATA_MISSING'
  | 'EXECUTION_ERROR'
  | 'ACCOUNTING_INVARIANT_FAILED'
  | 'LIQUIDATION_ERROR'
  | 'REPRODUCIBILITY_ERROR'
  | 'INVALID_CONFIGURATION';

export interface BacktestErrorContext {
  timestamp?: number | string;
  symbol?: string;
  expected?: unknown;
  actual?: unknown;
  context?: Record<string, unknown>;
}

export class BacktestError extends Error {
  public readonly code: BacktestErrorCode;
  public readonly timestamp?: number | string;
  public readonly symbol?: string;
  public readonly expected?: unknown;
  public readonly actual?: unknown;
  public readonly context?: Record<string, unknown>;

  constructor(code: BacktestErrorCode, message: string, details: BacktestErrorContext = {}) {
    super(message);
    this.name = 'BacktestError';
    this.code = code;
    this.timestamp = details.timestamp;
    this.symbol = details.symbol;
    this.expected = details.expected;
    this.actual = details.actual;
    this.context = details.context;
  }
}
