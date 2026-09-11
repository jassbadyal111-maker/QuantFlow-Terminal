import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BACKTEST_EVENT_ORDER, assertEventOrder } from '../../src/core/EventOrdering';

describe('event ordering', () => {
  it('matches the documented deterministic order', () => {
    assert.deepEqual(BACKTEST_EVENT_ORDER, [
      'MARKET_DATA_VALIDATION', 'FUNDING_EVENT', 'EXISTING_POSITION_RISK_CHECK', 'STOP_LOSS_TAKE_PROFIT',
      'LIQUIDATION_CHECK', 'STRATEGY_SIGNAL', 'NEW_ORDER_SUBMISSION', 'ORDER_EXECUTION', 'POSITION_UPDATE',
      'FEE_ACCOUNTING', 'EQUITY_CALCULATION', 'LEDGER_UPDATE', 'ANALYTICS_SNAPSHOT'
    ]);
  });

  it('rejects accidental reordering', () => {
    const wrong = [...BACKTEST_EVENT_ORDER];
    const a = wrong.indexOf('FUNDING_EVENT');
    const b = wrong.indexOf('STRATEGY_SIGNAL');
    [wrong[a], wrong[b]] = [wrong[b], wrong[a]];
    assert.throws(() => assertEventOrder(wrong), /Non-deterministic backtest event ordering/);
  });
});
