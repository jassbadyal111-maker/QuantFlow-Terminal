import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { roundAccounting, nearlyEqual } from '../../src/core/Precision';

describe('precision policy', () => {
  it('does not round intermediate-looking values below the defined output boundary', () => {
    const value = 0.123456789;
    assert.equal(roundAccounting(value, 8), 0.12345679);
  });

  it('keeps repeated fee accumulation within one accounting unit', () => {
    let total = 0;
    for (let i = 0; i < 100000; i++) total += 0.000001;
    assert.equal(nearlyEqual(roundAccounting(total, 8), 0.1, 1e-8), true);
  });
});
