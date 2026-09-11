import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { makeFunding, makeFlatSeries } from '../fixtures/fixtures';

describe('funding alignment', () => {
  it('applies an exact-boundary funding record once at that timestamp', () => {
    const candles = makeFlatSeries(2, 1735689600000, 100);
    const event = makeFunding(candles[1].timestamp, 0.0001);
    const eligible = candles.filter((c) => c.timestamp >= event.timestamp);
    assert.equal(eligible.length, 1);
    assert.equal(eligible[0].timestamp, event.timestamp);
  });

  it('applies a between-candle funding record at the first following checkpoint', () => {
    const candles = makeFlatSeries(3, 1735689600000, 100);
    const event = makeFunding(candles[1].timestamp + 30_000, 0.0001);
    const checkpoint = candles.find((c) => c.timestamp >= event.timestamp);
    assert.equal(checkpoint?.timestamp, candles[2].timestamp);
  });
});
