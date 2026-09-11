import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import rising from '../fixtures/rising-1m.json' with { type: 'json' };
import falling from '../fixtures/falling-1m.json' with { type: 'json' };
import invalid from '../fixtures/dataset-invalid.json' with { type: 'json' };
import { DataValidator } from '../../src/data/validation/DataValidator';

describe('golden fixture expectations', () => {
  it('rising fixture has deterministic boundaries and no data gaps', () => {
    assert.equal(rising.length, 6);
    assert.equal(rising[0].open, 100);
    assert.equal(rising[rising.length - 1].close, 112);
    assert.equal(DataValidator.validate(rising as any, '1m').valid, true);
  });

  it('falling fixture has deterministic boundaries and no data gaps', () => {
    assert.equal(falling.length, 6);
    assert.equal(falling[0].open, 100);
    assert.equal(falling[falling.length - 1].close, 87);
    assert.equal(DataValidator.validate(falling as any, '1m').valid, true);
  });

  it('invalid fixture deterministically fails validation', () => {
    const report = DataValidator.validate(invalid as any, '1m');
    assert.equal(report.valid, false);
    assert.equal(report.statistics.duplicateRows, 1);
  });
});
