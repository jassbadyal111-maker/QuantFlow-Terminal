import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BacktestError } from '../../src/core/BacktestErrors';

describe('phase 4.5 requirement contracts', () => {
  it('typed error carries audit context', () => {
    const error = new BacktestError('DATASET_GAP', 'Missing candle interval.', {
      timestamp: 1735689660000,
      symbol: 'BTCUSDT',
      expected: 60_000,
      actual: 120_000,
      context: { previousTimestamp: 1735689600000 },
    });
    assert.equal(error.code, 'DATASET_GAP');
    assert.equal(error.timestamp, 1735689660000);
    assert.equal(error.symbol, 'BTCUSDT');
    assert.equal(error.expected, 60_000);
    assert.equal(error.actual, 120_000);
    assert.deepEqual(error.context, { previousTimestamp: 1735689600000 });
  });

  it('required typed failure codes exist', () => {
    const required = ['DATASET_INCOMPLETE','DATASET_INVALID','DATASET_GAP','DATASET_DUPLICATE','PAGINATION_LIMIT','FUNDING_DATA_MISSING','EXECUTION_ERROR','ACCOUNTING_INVARIANT_FAILED','LIQUIDATION_ERROR','REPRODUCIBILITY_ERROR'];
    for (const code of required) {
      assert.doesNotThrow(() => new BacktestError(code as any, code));
    }
  });
});
