# Phase 4.5 Engineering Report

## Scope

Correctness/accounting/determinism/test-coverage work only. No UI redesign was introduced.

## A) Files changed

New correctness modules: `src/core/Precision.ts`, `src/core/BacktestErrors.ts`, `src/core/AccountingInvariants.ts`, `src/core/Accounting` helpers, `src/core/BacktestIntegrity.ts`, `src/core/BacktestAccounting.ts`, `src/core/EventOrdering.ts`, `src/core/StableSerialization.ts`.

Data integrity changes: `src/data/validation/DataValidator.ts`, `src/data/MarketDataProvider.ts`, `src/data/providers/BinanceProvider.ts`, `src/data/providers/BybitProvider.ts`.

Ledger changes: `src/ledger/TradeLedger.ts`.

Test command changes: `package.json`.

Documentation: `docs/BACKTEST-CORRECTNESS.md`.

## B) Tests added

Deterministic dataset integrity, execution behavior, accounting invariants, precision accumulation, event ordering, intrabar ambiguity, funding timestamp alignment, reproducibility, look-ahead boundary, property-style seeded randomness, and a performance-regression fixture benchmark.

## C) Golden fixtures added

`tests/fixtures/rising-1m.json`, `tests/fixtures/falling-1m.json`, `tests/fixtures/intrabar-both-touched.json`, `tests/fixtures/dataset-invalid.json`, `tests/golden/funding-boundary.json`, plus deterministic fixture builders.

## D) Accounting invariants implemented

Ledger cash transition reconciliation, equity-to-portfolio-state reconciliation, execution fee reconciliation, position quantity sanity, trade execution-link sanity, funding event/ledger count reconciliation, liquidation event/trade/execution reconciliation, and typed error context.

## E) Bugs discovered

The audit identified multiple pre-existing integrity risks: permissive gap/range validation; possible pagination truncation after request caps; unknown exchange/provider falling back to synthetic data; default BacktestEngine dependency on the mock provider; legacy funding configuration being used as an 8-hour funding source; strategy fallback to EMA for unknown strategy IDs; rounded cash/equity values at portfolio boundaries; partial-fill sizing using requested amount instead of filled amount; insufficient ledger enforcement around fee movements; non-canonical run hashing; and non-deterministic demo timestamps/IDs in some non-core paths.

## F) Bugs fixed in this branch

Strict dataset continuity/range checks and explicit pagination-limit failures were added. Unknown providers now raise a typed configuration error instead of silently selecting mock data. A canonical serialization utility and expanded integrity tooling were added. The ledger now verifies every cash transition. Explicit event-order/intrabar policies and deterministic correctness tests were added.

## G) Remaining limitations

The core `BacktestEngine` still needs final production wiring for historical funding injection and the full invariant audit return path. The branch also retains some legacy metric types that represent unavailable analytics as zero rather than null/N/A for UI compatibility. The liquidation model remains a documented deterministic approximation rather than an exact exchange-specific liquidation/insurance-fund model.

## H) Test results

**Not executed in this environment.** Repository cloning from GitHub is blocked by the execution environment's outbound network restrictions, so it would be dishonest to claim passing tests.

## I) Coverage

No coverage percentage is claimed because the suite was not executed here. A `test:coverage` command using the Node test runner's coverage facility was added for CI/local execution.

## J) Performance benchmark

A deterministic 100k-candle fixture generation regression test was added. No engine benchmark result is claimed until the repository is executable in CI/local tooling.

## K) Silent synthetic fallback

**Partially addressed, not fully certified.** The provider factory now rejects unknown providers. The default BacktestEngine constructor and UI demo paths still require final wiring review before this can be certified as globally absent.

## L) Historical funding in historical mode

**Not yet certified.** Real exchange funding providers exist and are used by the provider adapters, but the BacktestEngine simulation loop still contains legacy fixed-rate funding behavior and therefore must be wired to the historical funding records before production-trustworthy status.

## M) Ledger/equity/portfolio reconciliation

The reconciliation primitives and tests are present. A full end-to-end pass has not been executed and is therefore not claimed.

## N) Deterministic identical runs

Canonical serialization and deterministic test contracts are present, but the end-to-end engine still needs final run-hash and funding integration plus an executed test pass before this can be claimed complete.

## Release gate

**Phase 4.5 is NOT DONE.** The branch is an audit hardening branch with significant correctness work committed, but the production engine still needs final wiring and an actual test/coverage run before release.
