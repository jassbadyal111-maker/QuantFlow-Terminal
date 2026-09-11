import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DataValidator } from '../../src/data/validation/DataValidator';
import { makeCandle, makeFlatSeries } from '../fixtures/fixtures';

describe('dataset integrity', () => {
  it('rejects duplicate timestamps and malformed OHLC', () => {
    const candles = [
      makeCandle(1735689600000, 100, 101, 99, 100),
      makeCandle(1735689660000, 100, 99, 98, 98),
      makeCandle(1735689660000, 98, 100, 97, 99),
    ];
    const report = DataValidator.validate(candles, '1m');
    assert.equal(report.valid, false);
    assert.equal(report.statistics.duplicateRows, 1);
    assert.ok(report.statistics.invalidOhlcCount > 0);
  });

  it('rejects a partial historical range rather than warning', () => {
    const candles = makeFlatSeries(6);
    const report = DataValidator.validate(candles, '1m', {
      requestedStart: '2025-01-01T00:00:00.000Z',
      requestedEnd: '2025-01-01T00:29:00.000Z',
    });
    assert.equal(report.valid, false);
    assert.ok(report.errors.some((e) => e.includes('row count mismatch')));
  });

  it('checksum changes when a candle changes', () => {
    const candles = makeFlatSeries(30);
    const original = DataValidator.calculateChecksum(candles);
    candles[10] = { ...candles[10], close: 101 };
    const changed = DataValidator.calculateChecksum(candles);
    assert.notEqual(changed, original);
  });
});
