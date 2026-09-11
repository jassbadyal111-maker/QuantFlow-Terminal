export const ACCOUNTING_PRECISION = {
  quantity: 8,
  price: 8,
  cash: 8,
  fee: 8,
  funding: 8,
  pnl: 8,
  tolerance: 1e-8,
} as const;

export function roundAccounting(value: number, digits: number = ACCOUNTING_PRECISION.cash): number {
  if (!Number.isFinite(value)) {
    throw new Error(`Non-finite accounting value: ${value}`);
  }
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function assertFiniteAccounting(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be finite; got ${value}`);
  }
}

export function nearlyEqual(a: number, b: number, tolerance: number = ACCOUNTING_PRECISION.tolerance): boolean {
  return Math.abs(a - b) <= tolerance;
}
