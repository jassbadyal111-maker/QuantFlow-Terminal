import { runAccountingInvariantsTests } from './accountingInvariants.test';
import { runEventOrderingTests } from './eventOrdering.test';
import { runLookaheadBiasTests } from './lookaheadBias.test';
import { runIntrabarAmbiguityTests } from './intrabarAmbiguity.test';
import { runExecutionSimulatorTests } from './executionSimulator.test';
import { runFundingCorrectnessTests } from './fundingCorrectness.test';
import { runLiquidationTests } from './liquidation.test';
import { runPositionAccountingTests } from './positionAccounting.test';
import { runDatasetIntegrityTests } from './datasetIntegrity.test';
import { runReproducibilityTests } from './reproducibility.test';
import { runAnalyticsAuditTests } from './analyticsAudit.test';
import { runFuzzTests } from './fuzzTesting.test';

export interface SuiteResult {
  suite: string;
  passed: number;
  failed: number;
  errors: string[];
}

export function executeAllSuites(): {
  suites: SuiteResult[];
  totalPassed: number;
  totalFailed: number;
  durationMs: number;
  allPassed: boolean;
} {
  const startTime = Date.now();
  const suites: SuiteResult[] = [
    runAccountingInvariantsTests(),
    runEventOrderingTests(),
    runLookaheadBiasTests(),
    runIntrabarAmbiguityTests(),
    runExecutionSimulatorTests(),
    runFundingCorrectnessTests(),
    runLiquidationTests(),
    runPositionAccountingTests(),
    runDatasetIntegrityTests(),
    runReproducibilityTests(),
    runAnalyticsAuditTests(),
    runFuzzTests(),
  ];

  let totalPassed = 0;
  let totalFailed = 0;

  for (const s of suites) {
    totalPassed += s.passed;
    totalFailed += s.failed;
  }

  const durationMs = Date.now() - startTime;
  const allPassed = totalFailed === 0;

  return {
    suites,
    totalPassed,
    totalFailed,
    durationMs,
    allPassed,
  };
}

// CLI Execution entry point
if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('runAllTests')) {
  console.log('================================================================');
  console.log(' QUANTFLOW-TERMINAL: INSTITUTIONAL CORRECTNESS & AUDIT SUITE');
  console.log(' Phase 4.5 Backtest Correctness & Mathematical Audit Verification');
  console.log('================================================================\n');

  const report = executeAllSuites();

  for (const s of report.suites) {
    const icon = s.failed === 0 ? '✓' : '✗';
    console.log(`${icon} [${s.failed === 0 ? 'PASS' : 'FAIL'}] ${s.suite} (${s.passed} passed, ${s.failed} failed)`);
    if (s.failed > 0) {
      for (const err of s.errors) {
        console.error(`    ↳ ${err}`);
      }
    }
  }

  console.log('\n----------------------------------------------------------------');
  console.log(`TOTAL: ${report.totalPassed} passed, ${report.totalFailed} failed in ${report.durationMs}ms`);
  console.log(`STATUS: ${report.allPassed ? 'ALL AUDIT INVARIANTS PASSED' : 'AUDIT VERIFICATION FAILED'}`);
  console.log('================================================================\n');

  if (!report.allPassed) {
    process.exit(1);
  }
}
