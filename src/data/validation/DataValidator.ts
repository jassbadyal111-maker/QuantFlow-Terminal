import { CandleData } from '../../types/backtest';
import { ValidationReport, ValidationStatistics } from '../../types/dataset';

export class DataValidator {
  /**
   * Helper to convert timeframe string (e.g. '1m', '5m', '15m', '1h', '4h', '1d') into minutes
   */
  public static getTimeframeMinutes(timeframe: string): number {
    switch (timeframe.toLowerCase()) {
      case '1m': return 1;
      case '3m': return 3;
      case '5m': return 5;
      case '15m': return 15;
      case '30m': return 30;
      case '1h': return 60;
      case '2h': return 120;
      case '4h': return 240;
      case '6h': return 360;
      case '8h': return 480;
      case '12h': return 720;
      case '1d': return 1440;
      case '1w': return 10080;
      default: return 60;
    }
  }

  /**
   * Comprehensive OHLCV quantitative integrity audit
   */
  public static validate(
    candles: CandleData[],
    timeframe: string = '1h'
  ): ValidationReport {
    const warnings: string[] = [];
    const errors: string[] = [];

    const expectedIntervalMinutes = this.getTimeframeMinutes(timeframe);
    const intervalMs = expectedIntervalMinutes * 60 * 1000;

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

      // 2. Impossible Prices
      if (c.open <= 0 || c.high <= 0 || c.low <= 0 || c.close <= 0) {
        errors.push(`Impossible non-positive price at bar ${i} (${c.time}): O=${c.open}, H=${c.high}, L=${c.low}, C=${c.close}`);
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
    };

    return {
      valid: isValid,
      warnings,
      errors,
      statistics: stats,
    };
  }

  /**
   * Deterministic Checksum Generator for dataset versioning
   */
  public static calculateChecksum(candles: CandleData[]): string {
    if (candles.length === 0) return '00000000';
    let hash = 0;
    const step = Math.max(1, Math.floor(candles.length / 50));
    for (let i = 0; i < candles.length; i += step) {
      const c = candles[i];
      const str = `${c.timestamp}:${c.open}:${c.high}:${c.low}:${c.close}:${c.volume}`;
      for (let j = 0; j < str.length; j++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(j);
        hash |= 0;
      }
    }
    return Math.abs(hash).toString(16).toUpperCase().padStart(8, '0');
  }
}
