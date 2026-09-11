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
    expect(report.valid).toBe(false);
    expect(report.statistics.duplicateRows).toBe(1);
    expect(report.statistics.invalidOhlcCount).toBeGreaterThan(0);
  });

  it('does not accept a small fixture as production-valid historical data', () => {
    const report = DataValidator.validate(makeFlatSeries(6), '1m', {
      requestedStart: '2025-01-01T00:00:00.000Z',
      requestedEnd: '2025-01-01T00:05:00.000Z',
    });
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.includes('Insufficient sample size'))).toBe(true);
  });

  it('checksum changes when a candle changes', () => {
    const candles = makeFlatSeries(30);
    const original = DataValidator.calculateChecksum(candles);
    candles[10] = { ...candles[10], close: 101 };
    const changed = DataValidator.calculateChecksum(candles);
    expect(changed).not.toBe(original);
  });
});
