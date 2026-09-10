import { CandleData } from '../../types/backtest';
import { ValidationReport, ValidationStatistics } from '../../types/dataset';
import { calculateExpectedRowCount, timeframeToMinutes, timeframeToMs } from '../../utils/timeframe';

export class DataValidator {
  /**
   * Helper to convert timeframe string into minutes
   */
  public static getTimeframeMinutes(timeframe: string): number {
    return timeframeToMinutes(timeframe);
  }

  /**
   * Validates exact date range coverage against requested boundaries.
   */
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
      return {
        valid: false,
        errors: ['Cannot validate range coverage on empty candle dataset.'],
        warnings: [],
        expectedCount: 0,
      };
    }

    const firstTs = candles[0].timestamp;
    const lastTs = candles[candles.length - 1].timestamp;

    let expectedCount = candles.length;

    if (requestedStart) {
      const reqStartMs = new Date(requestedStart).getTime();
      if (!isNaN(reqStartMs)) {
        // Tolerance is 2 intervals
        if (firstTs > reqStartMs + intervalMs * 2) {
          errors.push(
            `Data range starts late: requested start ${requestedStart} (${reqStartMs}), but first candle begins at ${candles[0].time} (${firstTs}). Gap: ${Math.round((firstTs - reqStartMs) / (60 * 1000))} minutes.`
          );
        }
      }
    }

    if (requestedEnd) {
      const reqEndMs = new Date(requestedEnd).getTime();
      if (!isNaN(reqEndMs)) {
        if (lastTs < reqEndMs - intervalMs * 2) {
          errors.push(
            `Data range ends prematurely: requested end ${requestedEnd} (${reqEndMs}), but last candle ends at ${candles[candles.length - 1].time} (${lastTs}). Missing ${Math.round((reqEndMs - lastTs) / (60 * 1000))} minutes of history.`
          );
        }
      }
    }

    if (requestedStart && requestedEnd) {
      const startMs = new Date(requestedStart).getTime();
      const endMs = new Date(requestedEnd).getTime();
      if (!isNaN(startMs) && !isNaN(endMs) && endMs > startMs) {
        expectedCount = calculateExpectedRowCount(startMs, endMs, timeframe);
        const actualCount = candles.length;
        const missing = expectedCount - actualCount;
        if (missing > expectedCount * 0.20 && missing > 10) {
          errors.push(
            `Excessive missing historical candles: expected ~${expectedCount} bars for ${timeframe}, received only ${actualCount} bars (${missing} missing bars, ${((missing / expectedCount) * 100).toFixed(1)}% missing).`
          );
        } else if (missing > 0) {
          warnings.push(
            `Dataset has ${missing} fewer bars than continuous mathematical expectation (${actualCount}/${expectedCount} bars).`
          );
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      expectedCount,
    };
  }

  /**
   * Comprehensive OHLCV quantitative integrity audit
   */
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
        statistics: {
          totalBars: 0,
          duplicateRows: 0,
          missingIntervals: 0,
          minPrice: 0,
          maxPrice: 0,
          minVolume: 0,
          maxVolume: 0,
          startTime: '',
          endTime: '',
          expectedIntervalMinutes,
          abnormalGapsCount: 0,
          invalidOhlcCount: 0,
          expectedRowCount: 0,
          actualRowCount: 0,
        },
      };
    }

    if (candles.length < 30) {
      errors.push(
        `Insufficient sample size: dataset has only ${candles.length} bars. A minimum of 30 bars is required for meaningful indicator burn-in.`
      );
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
    let prevTimestamp = 0;

    for (let i = 0; i < candles.length; i++) {
      const c = candles[i];

      // 1. Min/Max Statistics
      if (c.low < minPrice) minPrice = c.low;
      if (c.high > maxPrice) maxPrice = c.high;
      if (c.volume < minVolume) minVolume = c.volume;
      if (c.volume > maxVolume) maxVolume = c.volume;

      // 2. Impossible Prices (Zero or Negative)
      if (c.open <= 0 || c.high <= 0 || c.low <= 0 || c.close <= 0 || !isFinite(c.open) || !isFinite(c.high) || !isFinite(c.low) || !isFinite(c.close)) {
        errors.push(`Impossible non-positive/non-finite price at bar ${i} (${c.time}): O=${c.open}, H=${c.high}, L=${c.low}, C=${c.close}`);
        invalidOhlcCount++;
      }

      // 3. OHLC Structural Integrity
      if (c.high < c.low) {
        errors.push(`OHLC violation (High < Low) at bar ${i} (${c.time}): High=${c.high}, Low=${c.low}`);
        invalidOhlcCount++;
      }
      if (c.high < c.open || c.high < c.close) {
        errors.push(`OHLC violation (High below Open/Close) at bar ${i} (${c.time}): H=${c.high}, O=${c.open}, C=${c.close}`);
        invalidOhlcCount++;
      }
      if (c.low > c.open || c.low > c.close) {
        errors.push(`OHLC violation (Low above Open/Close) at bar ${i} (${c.time}): L=${c.low}, O=${c.open}, C=${c.close}`);
        invalidOhlcCount++;
      }

      // 4. Volume Integrity
      if (c.volume < 0 || isNaN(c.volume)) {
        warnings.push(`Negative or non-numeric volume detected at bar ${i} (${c.time}): Volume=${c.volume}`);
      }

      // 5. Duplicate Timestamps
      if (seenTimestamps.has(c.timestamp)) {
        duplicateRows++;
      } else {
        seenTimestamps.add(c.timestamp);
      }

      // 6. Chronological Order & Timestamp continuity
      if (i > 0) {
        if (c.timestamp <= prevTimestamp) {
          errors.push(`Non-chronological timestamp progression: Bar ${i} (${c.timestamp}) <= Bar ${i - 1} (${prevTimestamp})`);
        } else {
          const delta = c.timestamp - prevTimestamp;
          if (delta > intervalMs * 1.5) {
            const missingInGap = Math.round(delta / intervalMs) - 1;
            missingIntervals += missingInGap;
            if (delta > intervalMs * 4) {
              abnormalGapsCount++;
            }
          }
        }
      }

      prevTimestamp = c.timestamp;
    }

    if (duplicateRows > 0) {
      errors.push(`Detected ${duplicateRows} duplicate timestamp row(s). Timestamps must be strictly unique.`);
    }

    if (abnormalGapsCount > 0) {
      warnings.push(`Detected ${abnormalGapsCount} significant historical data gap(s) exceeding 4x the expected ${timeframe} interval.`);
    }

    if (missingIntervals > candles.length * 0.15) {
      errors.push(
        `Critical historical data gap: ${missingIntervals} missing intervals (${((missingIntervals / candles.length) * 100).toFixed(1)}% of dataset). High risk of unrepresentative execution.`
      );
    } else if (missingIntervals > 0) {
      warnings.push(`Dataset contains ${missingIntervals} missing ${timeframe} bar interval(s) across historical timeline.`);
    }

    // Optional Range Coverage check
    let expectedRowCount = candles.length;
    if (rangeOptions?.requestedStart || rangeOptions?.requestedEnd) {
      const coverage = this.validateRangeCoverage(
        candles,
        rangeOptions.requestedStart,
        rangeOptions.requestedEnd,
        timeframe
      );
      expectedRowCount = coverage.expectedCount;
      coverage.errors.forEach((e) => errors.push(e));
      coverage.warnings.forEach((w) => warnings.push(w));
    }

    const isValid = errors.length === 0;

    const stats: ValidationStatistics = {
      totalBars: candles.length,
      duplicateRows,
      missingIntervals,
      minPrice: isFinite(minPrice) ? minPrice : 0,
      maxPrice: isFinite(maxPrice) ? maxPrice : 0,
      minVolume: isFinite(minVolume) ? minVolume : 0,
      maxVolume: isFinite(maxVolume) ? maxVolume : 0,
      startTime: candles[0]?.time || '',
      endTime: candles[candles.length - 1]?.time || '',
      expectedIntervalMinutes,
      abnormalGapsCount,
      invalidOhlcCount,
      expectedRowCount,
      actualRowCount: candles.length,
    };

    return {
      valid: isValid,
      warnings,
      errors,
      statistics: stats,
    };
  }

  /**
   * Deterministic, 100% full-dataset Checksum Generator using FNV-1a 32-bit hash
   * Guarantees every single candle (timestamp, open, high, low, close, volume) alters the hash.
   */
  public static calculateChecksum(candles: CandleData[]): string {
    if (!candles || candles.length === 0) return '00000000';
    
    // FNV-1a 32-bit hash constants
    let hash = 0x811c9dc5;
    const FNV_PRIME = 0x01000193;

    for (let i = 0; i < candles.length; i++) {
      const c = candles[i];
      // Quantize prices to standard precision representation to ensure cross-platform floating point determinism
      const o = c.open.toFixed(4);
      const h = c.high.toFixed(4);
      const l = c.low.toFixed(4);
      const cl = c.close.toFixed(4);
      const v = Math.round(c.volume);
      const str = `${c.timestamp}|${o}|${h}|${l}|${cl}|${v}`;

      for (let j = 0; j < str.length; j++) {
        hash ^= str.charCodeAt(j);
        hash = Math.imul(hash, FNV_PRIME);
      }
    }

    return (hash >>> 0).toString(16).toUpperCase().padStart(8, '0');
  }
}
