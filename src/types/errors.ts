/**
 * ApexQuant / QuantFlow Terminal
 * Typed Financial & Backtesting Error Hierarchy
 *
 * Provides structured, actionable errors for dataset integrity,
 * execution simulation, funding, liquidation, accounting invariants,
 * and reproducibility checks.
 */

export type QuantErrorCode =
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
  | 'INSUFFICIENT_DATA'
  | 'INVALID_CONFIGURATION';

export interface ErrorContext {
  timestamp?: number | string;
  symbol?: string;
  position?: any;
  event?: string;
  expected?: any;
  actual?: any;
  difference?: any;
  technicalDetails?: string;
  context?: Record<string, any>;
}

export class QuantFlowError extends Error {
  public readonly code: QuantErrorCode;
  public readonly timestamp?: number | string;
  public readonly symbol?: string;
  public readonly expected?: any;
  public readonly actual?: any;
  public readonly difference?: any;
  public readonly context?: Record<string, any>;
  public readonly technicalDetails?: string;
  public readonly retryable: boolean;

  constructor(
    code: QuantErrorCode,
    message: string,
    details?: ErrorContext,
    retryable: boolean = false
  ) {
    super(message);
    this.name = 'QuantFlowError';
    this.code = code;
    this.timestamp = details?.timestamp;
    this.symbol = details?.symbol;
    this.expected = details?.expected;
    this.actual = details?.actual;
    this.difference = details?.difference;
    this.context = details?.context;
    this.technicalDetails = details?.technicalDetails;
    this.retryable = retryable;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  public toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      timestamp: this.timestamp,
      symbol: this.symbol,
      expected: this.expected,
      actual: this.actual,
      difference: this.difference,
      context: this.context,
      technicalDetails: this.technicalDetails,
    };
  }
}

export class DatasetIncompleteError extends QuantFlowError {
  constructor(message: string, details?: ErrorContext) {
    super('DATASET_INCOMPLETE', message, details, false);
    this.name = 'DatasetIncompleteError';
  }
}

export class DatasetInvalidError extends QuantFlowError {
  constructor(message: string, details?: ErrorContext) {
    super('DATASET_INVALID', message, details, false);
    this.name = 'DatasetInvalidError';
  }
}

export class DatasetGapError extends QuantFlowError {
  constructor(message: string, details?: ErrorContext) {
    super('DATASET_GAP', message, details, false);
    this.name = 'DatasetGapError';
  }
}

export class DatasetDuplicateError extends QuantFlowError {
  constructor(message: string, details?: ErrorContext) {
    super('DATASET_DUPLICATE', message, details, false);
    this.name = 'DatasetDuplicateError';
  }
}

export class PaginationLimitError extends QuantFlowError {
  constructor(message: string, details?: ErrorContext) {
    super('PAGINATION_LIMIT', message, details, false);
    this.name = 'PaginationLimitError';
  }
}

export class FundingDataMissingError extends QuantFlowError {
  constructor(message: string, details?: ErrorContext) {
    super('FUNDING_DATA_MISSING', message, details, false);
    this.name = 'FundingDataMissingError';
  }
}

export class ExecutionError extends QuantFlowError {
  constructor(message: string, details?: ErrorContext) {
    super('EXECUTION_ERROR', message, details, false);
    this.name = 'ExecutionError';
  }
}

export class AccountingInvariantError extends QuantFlowError {
  constructor(message: string, details?: ErrorContext) {
    super('ACCOUNTING_INVARIANT_FAILED', message, details, false);
    this.name = 'AccountingInvariantError';
  }
}

export class LiquidationError extends QuantFlowError {
  constructor(message: string, details?: ErrorContext) {
    super('LIQUIDATION_ERROR', message, details, false);
    this.name = 'LiquidationError';
  }
}

export class ReproducibilityError extends QuantFlowError {
  constructor(message: string, details?: ErrorContext) {
    super('REPRODUCIBILITY_ERROR', message, details, false);
    this.name = 'ReproducibilityError';
  }
}
