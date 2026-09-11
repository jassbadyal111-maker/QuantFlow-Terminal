import { DataValidator } from '../data/validation/DataValidator';
import { GOLDEN_FIXTURES } from './fixtures';

export function runDatasetIntegrityTests(): { suite: string; passed: number; failed: number; errors: string[] } {
  const result = { suite: 'Dataset Integrity & Strict Validation Barrier', passed: 0, failed: 0, errors: [] as string[] };

  function assert(condition: boolean, desc: string) {
    if (condition) {
      result.passed++;
    } else {
      result.failed++;
      result.errors.push(`FAILED: ${desc}`);
    }
  }

  // 1. Missing Candle Gap Test: triggers DATASET_GAP error or validation failure
  const gapFixture = GOLDEN_FIXTURES['missing-candle'];
  const gapReport = DataValidator.validate(gapFixture.candles, '1m');
  assert(!gapReport.valid || gapReport.errors.length > 0 || gapReport.warnings.length > 0, 'Missing candle interval detected by DataValidator');

  // 2. Duplicate Candle Timestamp Test: triggers duplicate error
  const dupFixture = GOLDEN_FIXTURES['duplicate-candle'];
  const dupReport = DataValidator.validate(dupFixture.candles, '1m');
  assert(!dupReport.valid && dupReport.errors.some(e => e.includes('Chronological') || e.includes('Duplicate') || e.includes('timestamp') || e.includes('sequence')), 'Duplicate candle timestamp rejected with error');

  // 3. Invalid OHLC Geometry Test: High < Low
  const invalidFixture = GOLDEN_FIXTURES['invalid-ohlc'];
  const invReport = DataValidator.validate(invalidFixture.candles, '1m');
  assert(!invReport.valid && invReport.errors.some(e => e.includes('High < Low') || e.includes('corrupted') || e.includes('Invalid')), 'Corrupted candle (High < Low) strictly rejected');

  // 4. Valid Dataset Continuity: rising-1m passes with 100% validity
  const validFixture = GOLDEN_FIXTURES['rising-1m'];
  const validReport = DataValidator.validate(validFixture.candles, '1m');
  assert(validReport.valid === true && validReport.errors.length === 0, 'Clean chronological dataset passes validation without errors');

  return result;
}
