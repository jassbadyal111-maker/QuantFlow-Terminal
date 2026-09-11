/**
 * ApexQuant / QuantFlow Terminal
 * Financial Numerical Precision Policy
 *
 * Enforces rigorous, deterministic IEEE-754 precision management:
 * 1. High precision (unrounded floating-point) during internal mathematical accumulation
 * 2. Strict rounding only at defined accounting and output boundaries
 * 3. Epsilon-safe financial comparison helpers to prevent roundoff artifacts
 */

export interface PrecisionConfig {
  priceDecimals: number;
  quantityDecimals: number;
  feeDecimals: number;
  fundingDecimals: number;
  cashDecimals: number;
  equityDecimals: number;
}

export class PrecisionPolicy {
  // Default institutional cryptocurrency perpetual precision
  public static readonly DEFAULT_CONFIG: PrecisionConfig = {
    priceDecimals: 2,       // e.g. 64250.25 USDT
    quantityDecimals: 6,    // e.g. 0.001250 BTC
    feeDecimals: 4,         // e.g. 1.2542 USDT
    fundingDecimals: 6,     // e.g. 0.000100 (1 bps)
    cashDecimals: 2,        // e.g. 100000.50 USDT
    equityDecimals: 2,      // e.g. 104520.75 USDT
  };

  public static readonly EPSILON = 1e-7;

  /**
   * Rounds a price to standard tick precision
   */
  public static roundPrice(price: number, decimals: number = PrecisionPolicy.DEFAULT_CONFIG.priceDecimals): number {
    if (!Number.isFinite(price)) return 0;
    const factor = Math.pow(10, decimals);
    return Math.round((price + Number.EPSILON) * factor) / factor;
  }

  /**
   * Rounds contract/asset quantity to lot precision
   */
  public static roundQuantity(qty: number, decimals: number = PrecisionPolicy.DEFAULT_CONFIG.quantityDecimals): number {
    if (!Number.isFinite(qty)) return 0;
    const factor = Math.pow(10, decimals);
    return Math.round((qty + Number.EPSILON) * factor) / factor;
  }

  /**
   * Rounds cash balances and equity to currency boundary (2 decimals)
   */
  public static roundCash(amount: number): number {
    if (!Number.isFinite(amount)) return 0;
    return Math.round((amount + Number.EPSILON) * 100) / 100;
  }

  /**
   * Rounds fee to fee accounting boundary (4 decimals)
   */
  public static roundFee(fee: number): number {
    if (!Number.isFinite(fee)) return 0;
    return Math.round((fee + Number.EPSILON) * 10000) / 10000;
  }

  /**
   * Rounds funding payment to 4 decimals
   */
  public static roundFunding(funding: number): number {
    if (!Number.isFinite(funding)) return 0;
    return Math.round((funding + Number.EPSILON) * 10000) / 10000;
  }

  /**
   * Rounds realized/unrealized PnL to 2 decimals
   */
  public static roundPnl(pnl: number): number {
    if (!Number.isFinite(pnl)) return 0;
    return Math.round((pnl + Number.EPSILON) * 100) / 100;
  }

  /**
   * Determines if two monetary values are equal within accounting tolerance
   */
  public static areMonetaryEqual(a: number, b: number, tolerance: number = 0.01): boolean {
    return Math.abs(a - b) <= tolerance;
  }

  /**
   * Determines if a position quantity is effectively zero (closed)
   */
  public static isEffectivelyZero(qty: number, tolerance: number = 1e-7): boolean {
    return Math.abs(qty) <= tolerance;
  }

  /**
   * Epsilon-safe floating point addition to prevent cumulative drift
   */
  public static safeAdd(a: number, b: number): number {
    return Number((a + b).toFixed(8));
  }

  /**
   * Calculates realized net PnL for perpetual position
   */
  public static calculateNetPnL(
    side: 'LONG' | 'SHORT',
    entryPrice: number,
    exitPrice: number,
    quantity: number,
    fees: number = 0,
    slippage: number = 0
  ): number {
    const gross = side === 'LONG'
      ? (exitPrice - entryPrice) * quantity
      : (entryPrice - exitPrice) * quantity;
    return PrecisionPolicy.roundCash(gross - fees - slippage);
  }

  /**
   * Validates that a numeric value is neither NaN nor Infinite
   */
  public static isValidNumber(val: any): boolean {
    return typeof val === 'number' && Number.isFinite(val) && !Number.isNaN(val);
  }
}
