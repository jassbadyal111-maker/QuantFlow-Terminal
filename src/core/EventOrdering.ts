export const BACKTEST_EVENT_ORDER = [
  'MARKET_DATA_VALIDATION',
  'FUNDING_EVENT',
  'EXISTING_POSITION_RISK_CHECK',
  'STOP_LOSS_TAKE_PROFIT',
  'LIQUIDATION_CHECK',
  'STRATEGY_SIGNAL',
  'NEW_ORDER_SUBMISSION',
  'ORDER_EXECUTION',
  'POSITION_UPDATE',
  'FEE_ACCOUNTING',
  'EQUITY_CALCULATION',
  'LEDGER_UPDATE',
  'ANALYTICS_SNAPSHOT',
] as const;

export type BacktestEventStage = typeof BACKTEST_EVENT_ORDER[number];

export const DEFAULT_INTRABAR_POLICY = 'CONSERVATIVE' as const;
export const DEFAULT_SAME_BAR_EXECUTION_POLICY = 'CLOSE' as const;

export function assertEventOrder(actual: BacktestEventStage[]): void {
  const expected = [...BACKTEST_EVENT_ORDER];
  if (actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) {
    throw new Error(`Non-deterministic backtest event ordering: expected ${expected.join(' > ')}, actual ${actual.join(' > ')}`);
  }
}
