import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../../src/data/MarketDataProvider';
import { makeCandle } from '../fixtures/fixtures';

describe('deterministic property checks', () => {
  it('seeded generation is deterministic', () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 1000; i++) assert.equal(a(), b());
  });

  it('valid generated OHLC values preserve structural constraints', () => {
    const rng = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const open = 50 + rng() * 100;
      const close = 50 + rng() * 100;
      const high = Math.max(open, close) + rng() * 10;
      const low = Math.min(open, close) - rng() * 10;
      const c = makeCandle(1735689600000 + i * 60_000, open, high, low, close, 1000);
      assert.ok(Number.isFinite(c.close));
      assert.ok(c.high >= Math.max(c.open, c.close));
      assert.ok(c.low <= Math.min(c.open, c.close));
      assert.ok(c.high >= c.low);
    }
  });
});
