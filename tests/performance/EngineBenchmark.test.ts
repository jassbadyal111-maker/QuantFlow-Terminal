import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { makeFlatSeries } from '../fixtures/fixtures';

describe('performance regression', () => {
  it('builds a 100k-candle deterministic fixture within linear time', () => {
    const t0 = performance.now();
    const candles = makeFlatSeries(100_000);
    const elapsedMs = performance.now() - t0;
    assert.equal(candles.length, 100_000);
    // This is a regression signal, not a universal machine-specific SLA.
    assert.ok(elapsedMs < 5_000, `fixture generation took ${elapsedMs.toFixed(1)}ms`);
  });
});
