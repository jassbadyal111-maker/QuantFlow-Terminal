/**
 * Quantitative Timeframe & Timestamp Utilities for ApexQuant Terminal
 * Strictly timestamp-based, UTC-normalized, non-approximate time arithmetic.
 */

export type SupportedTimeframe = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d';

export const TIMEFRAME_MINUTES: Record<SupportedTimeframe, number> = {
  '1m': 1,
  '5m': 5,
  '15m': 15,
  '30m': 30,
  '1h': 60,
  '4h': 240,
  '1d': 1440,
};

export const TIMEFRAME_MS: Record<SupportedTimeframe, number> = {
  '1m': 60 * 1000,
  '5m': 5 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '30m': 30 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '4h': 4 * 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
};

/**
 * Returns exact milliseconds for a supported timeframe.
 */
export function timeframeToMs(timeframe: string): number {
  const tf = timeframe.toLowerCase() as SupportedTimeframe;
  if (TIMEFRAME_MS[tf]) {
    return TIMEFRAME_MS[tf];
  }
  // Fallback parsing for arbitrary formats like 2h, 12h, 3d, 1w
  const num = parseInt(timeframe, 10);
  if (!isNaN(num)) {
    if (timeframe.endsWith('m')) return num * 60 * 1000;
    if (timeframe.endsWith('h')) return num * 60 * 60 * 1000;
    if (timeframe.endsWith('d')) return num * 24 * 60 * 60 * 1000;
    if (timeframe.endsWith('w')) return num * 7 * 24 * 60 * 60 * 1000;
  }
  return 60 * 60 * 1000; // default 1h
}

/**
 * Returns exact minutes for a supported timeframe.
 */
export function timeframeToMinutes(timeframe: string): number {
  return Math.round(timeframeToMs(timeframe) / (60 * 1000));
}

/**
 * Calculates the exact expected next timestamp given the current timestamp and timeframe.
 */
export function expectedNextTimestamp(currentTimestamp: number, timeframe: string): number {
  return currentTimestamp + timeframeToMs(timeframe);
}

/**
 * Normalizes any timestamp or ISO string into a standard UTC string format "YYYY-MM-DD HH:mm".
 */
export function normalizeToUtcIso(timestamp: number | string): string {
  const date = typeof timestamp === 'number' ? new Date(timestamp) : new Date(timestamp);
  if (isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 16).replace('T', ' ');
}

/**
 * Computes exact expected row count between start and end timestamps.
 * Does NOT guess from array lengths; uses mathematically exact interval divisions.
 */
export function calculateExpectedRowCount(
  startMs: number,
  endMs: number,
  timeframe: string
): number {
  if (endMs <= startMs) return 0;
  const step = timeframeToMs(timeframe);
  return Math.floor((endMs - startMs) / step) + 1;
}

/**
 * Validates whether two consecutive timestamps match the expected timeframe interval.
 */
export function validateInterval(
  t1: number,
  t2: number,
  timeframe: string,
  toleranceRatio: number = 0.15
): { valid: boolean; gapMs: number; expectedMs: number; isDuplicate: boolean; isReversed: boolean } {
  const expectedMs = timeframeToMs(timeframe);
  const diff = t2 - t1;

  if (diff === 0) {
    return { valid: false, gapMs: 0, expectedMs, isDuplicate: true, isReversed: false };
  }
  if (diff < 0) {
    return { valid: false, gapMs: diff, expectedMs, isDuplicate: false, isReversed: true };
  }

  const allowedMax = expectedMs * (1 + toleranceRatio);
  const allowedMin = expectedMs * (1 - toleranceRatio);
  const valid = diff >= allowedMin && diff <= allowedMax;

  return {
    valid,
    gapMs: diff - expectedMs,
    expectedMs,
    isDuplicate: false,
    isReversed: false,
  };
}

export interface DetectedGap {
  startMs: number;
  endMs: number;
  startTime: string;
  endTime: string;
  expectedMs: number;
  actualMs: number;
  missingCandlesEstimate: number;
}

/**
 * Detects all abnormal gaps in a series of timestamps.
 */
export function findGaps(timestamps: number[], timeframe: string): DetectedGap[] {
  const gaps: DetectedGap[] = [];
  const expectedMs = timeframeToMs(timeframe);
  const maxAllowedDiff = expectedMs * 1.5;

  for (let i = 1; i < timestamps.length; i++) {
    const prev = timestamps[i - 1];
    const curr = timestamps[i];
    const diff = curr - prev;

    if (diff > maxAllowedDiff) {
      const missingCandles = Math.max(1, Math.round(diff / expectedMs) - 1);
      gaps.push({
        startMs: prev,
        endMs: curr,
        startTime: normalizeToUtcIso(prev),
        endTime: normalizeToUtcIso(curr),
        expectedMs,
        actualMs: diff,
        missingCandlesEstimate: missingCandles,
      });
    }
  }

  return gaps;
}

/**
 * Deduplicates and sorts items chronologically by timestamp.
 */
export function deduplicateAndSortCandles<T extends { timestamp: number }>(items: T[]): T[] {
  const map = new Map<number, T>();
  for (const item of items) {
    map.set(item.timestamp, item);
  }
  return Array.from(map.values()).sort((a, b) => a.timestamp - b.timestamp);
}
