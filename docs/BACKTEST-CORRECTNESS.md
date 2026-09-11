# Backtest Correctness & Accounting

## 1. Accounting model

QuantFlow treats the perpetual account as a wallet/equity model:

`equity = cash + unrealizedPnL`

Entry/exit notional is not a cash flow by itself. Trading fees, funding, liquidation penalties, deposits, withdrawals and other explicit cash movements are cash flows recorded in `TradeLedger`. Realized P&L changes cash when a position closes. Margin is an encumbrance/risk measurement inside the account, not a second copy of equity.

The audit requires the ledger ending balance to equal portfolio cash within the documented tolerance. Equity checkpoints must reconcile to the portfolio snapshot at the same timestamp.

## 2. Event ordering

The intended deterministic order for each candle is:

1. Market-data validation
2. Funding event settlement
3. Existing-position risk checks
4. Stop-loss / take-profit evaluation
5. Liquidation check
6. Strategy signal evaluation
7. New order submission
8. Order execution
9. Position update
10. Fee accounting
11. Equity calculation
12. Ledger update
13. Analytics snapshot

This ordering is represented in `src/core/EventOrdering.ts`. Tests are expected to fail if a future implementation reorders these stages.

## 3. Position accounting

Positions are linear perpetual-style positions sized in base units with USD notional derived from fill price. Long realized P&L is `(exit - entry) * quantity`; short realized P&L is `(entry - exit) * quantity`. Leverage affects required initial margin and liquidation thresholds, not the directional P&L formula itself.

Scale-in/scale-out must preserve quantity conservation and average-entry semantics. A fully closed position must return to zero quantity within tolerance.

## 4. Funding methodology

Historical mode uses funding records returned by the exchange funding provider. A legacy `fundingRate8hBps` setting is retained only for configuration compatibility and is not a valid historical funding source. Historical funding must not be silently substituted with synthetic funding.

Funding is aligned by effective timestamp. A funding record exactly on a candle timestamp is applied at that timestamp before position risk checks. A record between two candle checkpoints is applied on the first checkpoint at or after its effective timestamp, using the recorded rate and recorded mark price when available.

Simulation/demo mode may use the synthetic funding provider, but the source is explicitly marked synthetic.

## 5. Liquidation methodology

The existing engine uses a deterministic maintenance-margin model by leverage tier. The liquidation price is derived from entry price, leverage and maintenance margin rate rather than a raw `price <= threshold` constant. Bar extremes are used as breach triggers. In gap-through conditions the execution price should be treated conservatively at the bar open where the stop/liquidation threshold is crossed.

This is a model assumption, not an exchange-identical liquidation engine. Exchange-specific tiered maintenance schedules, insurance-fund rules and fee schedules remain a known limitation unless explicitly implemented.

## 6. Execution assumptions

Market executions use the configured slippage model and taker fee. Limit executions require the market range to touch the requested price and use maker liquidity assumptions. Stop orders transition to market execution when their trigger is crossed.

Every execution record contains order identity, requested price/quantity, fill price/quantity, fee, slippage, execution type, liquidity source and status. Partial fills must conserve quantity across all fills of the parent order.

## 7. Intrabar assumptions

Default intrabar policy is conservative. When a candle touches both a long stop and long target, the stop is resolved first. The analogous conservative rule applies to shorts. Gap-through conditional orders use the bar open rather than inventing an unavailable price path.

Without tick data, no implementation can know the true intrabar path. The policy therefore favors the adverse outcome instead of selecting the more profitable touched level.

## 8. Precision policy

Financial calculations keep full JavaScript number precision through intermediate steps where practical. Rounding is applied only at accounting/output boundaries through `src/core/Precision.ts`. The default accounting/output precision is 8 decimal places with a reconciliation tolerance of `1e-8` for core numeric identities and a small practical tolerance for aggregate UI values.

## 9. Dataset integrity policy

Historical backtests require complete coverage of the requested range. Duplicate timestamps, non-chronological timestamps, invalid OHLC structure, missing intervals and row-count/range mismatches are blocking errors.

Real providers must fail explicitly with typed `PAGINATION_LIMIT` / `DATASET_INCOMPLETE` errors when request caps prevent full retrieval. No partial dataset may be silently passed into a historical backtest.

Checksums are computed from timestamp/OHLCV content and are included in reproducibility inputs.

## 10. Reproducibility methodology

Reproducibility inputs include engine version, strategy identity/version inputs, exchange, symbol, timeframe, exact date range, dataset checksum, initial capital, leverage/margin model, execution costs, slippage model, indicators, entry/exit rules and deterministic seed. Serialization should be canonical rather than dependent on object-key insertion order.

Identical inputs must produce identical executions, fills, ledger records, trades, equity curve and analytics. Any input that can affect results must change the run hash.

## 11. Known limitations

The project still needs a complete external test execution/CI pass after this branch is integrated because the current agent environment cannot clone or install dependencies from GitHub. The existing UI also contains demo/sample data sources outside the historical execution path; these must remain explicitly labeled as demo data and must never be used as a fallback for real historical runs.

The liquidation model is deterministic and documented but is not exchange-identical. Analytics also retain legacy zero-valued unavailable metrics for compatibility; future work should migrate these fields to explicit null/N/A states without fabricating statistics.

## 12. Test methodology

Correctness tests use deterministic, version-controlled fixtures. Coverage targets financial-core branches: dataset validation, order/fill behavior, partial fills, funding, liquidation, position quantity conservation, ledger reconciliation, equity reconciliation, look-ahead boundaries, intrabar ambiguity, reproducibility and floating-point accumulation.

No correctness test may use uncontrolled randomness. Any randomized property test must use a fixed seed.
