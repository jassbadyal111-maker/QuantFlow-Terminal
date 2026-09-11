import { CandleData } from '../../types/backtest';
import { ValidationReport, ValidationStatistics } from '../../types/dataset';
import { calculateExpectedRowCount, timeframeToMinutes, timeframeToMs } from '../../utils/timeframe';

export class DataValidator {
  public static getTimeframeMinutes(timeframe: string): number {
    return timeframeToMinutes(timeframe);
  }

  public static validateRangeCoverage(
    candles: CandleData[],
    requestedStart: string | undefined,
    requestedEnd: string | undefined,
    timeframe: string
  ): { valid: boolean; errors: string[]; warnings: string[]; expectedCount: number } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const intervalMs = timeframeToMs(timeframe);

    if (!candles || candles.length === 0) {
      return { valid: false, errors: ['Cannot validate range coverage on empty candle dataset.'], warnings: [], expectedCount: 0 };
    }

    const firstTs = candles[0].timestamp;
    const lastTs = candles[candles.length - 1].timestamp;
    let expectedCount = candles.length;

    if (requestedStart) {
      const reqStartMs = new Date(requestedStart).getTime();
      if (Number.isNaN(reqStartMs)) {
        errors.push(`Invalid requested start timestamp: ${requestedStart}`);
      } else if (firstTs !== reqStartMs) {
        errors.push(`Dataset start mismatch: requested ${requestedStart} (${reqStartMs}), actual first candle ${candles[0].time} (${firstTs}).`);
      }
    }

    if (requestedEnd) {
      const reqEndMs = new Date(requestedEnd).getTime();
      if (Number.isNaN(reqEndMs)) {
        errors.push(`Invalid requested end timestamp: ${requestedEnd}`);
      } else {
        const expectedLast = reqEndMs;
        if (lastTs !== expectedLast) {
          errors.push(`Dataset end mismatch: requested ${requestedEnd} (${expectedLast}), actual last candle ${candles[candles.length - 1].time} (${lastTs}).`);
        }
      }
    }

    if (requestedStart && requestedEnd) {
      const startMs = new Date(requestedStart).getTime();
      const endMs = new Date(requestedEnd).getTime();
      if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs >= startMs) {
        expectedCount = calculateExpectedRowCount(startMs, endMs, timeframe);
        if (candles.length !== expectedCount) {
          errors.push(`Dataset row count mismatch: expected ${expectedCount}, actual ${candles.length}. Missing/truncated historical data is not permitted.`);
        }
      }
    }

    // Explicitly verify each adjacent interval rather than treating small gaps as warnings.
    for (let i = 1; i < candles.length; i++) {
      const delta = candles[i].timestamp - candles[i - 1].timestamp;
      if (delta !== intervalMs) {
        errors.push(`Dataset gap/irregular interval at ${candles[i].time}: expected ${intervalMs}ms after ${candles[i - 1].time}, actual ${delta}ms.`);
        break;
      }
    }

    return { valid: errors.length === 0, errors, warnings, expectedCount };
  }

  public static validate(
    candles: CandleData[],
    timeframe: string = '1h',
    rangeOptions?: { requestedStart?: string; requestedEnd?: string }
  ): ValidationReport {
    const warnings: string[] = [];
    const errors: string[] = [];
    const expectedIntervalMinutes = this.getTimeframeMinutes(timeframe);
    const intervalMs = timeframeToMs(timeframe);

    if (!candles || candles.length === 0) {
      return {
        valid: false,
        warnings: [],
        errors: ['Dataset is completely empty (0 rows). Backtest cannot execute.'],
        statistics: { totalBars: 0, duplicateRows: 0, missingIntervals: 0, minPrice: 0, maxPrice: 0, minVolume: 0, maxVolume: 0, startTime: '', endTime: '', expectedIntervalMinutes, abnormalGapsCount: 0, invalidOhlcCount: 0, expectedRowCount: 0, actualRowCount: 0 },
      };
    }

    let duplicateRows = 0;
    let missingIntervals = 0;
    let abnormalGapsCount = 0;
    let invalidOhlcCount = 0;
    let minPrice = Infinity;
    let maxPrice = -Infinity;
    let minVolume = Infinity;
    let maxVolume = -Infinity;
    const seenTimestamps = new Set<number>();

    for (let i = 0; i < candles.length; i++) {
      const c = candles[i];
      if (c.low < minPrice) minPrice = c.low;
      if (c.high > maxPrice) maxPrice = c.high;
      if (c.volume < minVolume) minVolume = c.volume;
      if (c.volume > maxVolume) maxVolume = c.volume;

      if (![c.open, c.high, c.low, c.close].every(Number.isFinite) || c.open <= 0 || c.high <= 0 || c.low <= 0 || c.close <= 0) {
        errors.push(`Invalid price at bar ${i} (${c.time}): O=${c.open}, H=${c.high}, L=${c.low}, C=${c.close}`);
        invalidOhlcCount++;
      }
      if (![c.open, c.high, c.low, c.close].every(Number.isFinite) || c.high < Math.max(c.open, c.close) || c.low > Math.min(c.open, c.close) || c.high < c.low) {
        errors.push(`OHLC structural violation at bar ${i} (${c.time}).`);
        invalidOhlcCount++;
      }
      if (!Number.isFinite(c.volume) || c.volume < 0) {
        errors.push(`Invalid volume at bar ${i} (${c.time}): ${c.volume}`);
      }
      if (seenTimestamps.has(c.timestamp)) duplicateRows++;
      seenTimestamps.add(c.timestamp);

      if (i > 0) {
        const delta = c.timestamp - candles[i - 1].timestamp;
        if (delta <= 0) errors.push(`Non-chronological timestamp at bar ${i}: ${c.timestamp} <= ${candles[i - 1].timestamp}`);
        else if (delta !== intervalMs) {
          const missing = Math.max(1, Math.round(delta / intervalMs) - 1);
          missingIntervals += missing;
          abnormalGapsCount++;
        }
      }
    }

    if (duplicateRows > 0) errors.push(`Detected ${duplicateRows} duplicate timestamp row(s).`);
    if (missingIntervals > 0) errors.push(`Detected ${missingIntervals} missing interval(s). Historical gaps are not permitted.`);

    let expectedRowCount = candles.length;
    if (rangeOptions?.requestedStart || rangeOptions?.requestedEnd) {
      const coverage = this.validateRangeCoverage(candles, rangeOptions.requestedStart, rangeOptions.requestedEnd, timeframe);
      expectedRowCount = coverage.expectedCount;
      errors.push(...coverage.errors);
      warnings.push(...coverage.warnings);
    }

    const stats: ValidationStatistics = {
      totalBars: candles.length,
      duplicateRows,
      missingIntervals,
      minPrice: Number.isFinite(minPrice) ? minPrice : 0,
      maxPrice: Number.isFinite(maxPrice) ? maxPrice : 0,
      minVolume: Number.isFinite(minVolume) ? minVolume : 0,
      maxVolume: Number.isFinite(maxVolume) ? maxVolume : 0,
      startTime: candles[0]?.time || '',
      endTime: candles[candles.length - 1]?.time || '',
      expectedIntervalMinutes,
      abnormalGapsCount,
      invalidOhlcCount,
      expectedRowCount,
      actualRowCount: candles.length,
    };

    return { valid: errors.length === 0, warnings, errors, statistics: stats };
  }

  public static calculateChecksum(candles: CandleData[]): string {
    if (!candles || candles.length === 0) return '00000000';
    let hash = 0x811c9dc5;
    const FNV_PRIME = 0x01000193;
    for (const c of candles) {
      const str = `${c.timestamp}|${c.open.toFixed(8)}|${c.high.toFixed(8)}|${c.low.toFixed(8)}|${c.close.toFixed(8)}|${c.volume.toString()}`;
      for (let j = 0; j < str.length; j++) {
        hash ^= str.charCodeAt(j);
        hash = Math.imul(hash, FNV_PRIME);
      }
    }
    return (hash >>> 0).toString(16).toUpperCase().padStart(8, '0');
  }
}
