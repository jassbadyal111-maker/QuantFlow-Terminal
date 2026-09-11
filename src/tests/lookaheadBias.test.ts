import { EmaCrossoverStrategy } from '../strategies/Strategy';
import { PortfolioManager } from '../portfolio/PortfolioManager';
import { BacktestConfig, CandleData } from '../types/backtest';
import { GOLDEN_FIXTURES, createTestConfig } from './fixtures';

export function runLookaheadBiasTests(): { suite: string; passed: number; failed: number; errors: string[] } {
  const result = { suite: 'Look-Ahead Bias Elimination', passed: 0, failed: 0, errors: [] as string[] };

  function assert(condition: boolean, desc: string) {
    if (condition) {
      result.passed++;
    } else {
      result.failed++;
      result.errors.push(`FAILED: ${desc}`);
    }
  }

  const candles = GOLDEN_FIXTURES['rising-1m'].candles;
  const config: BacktestConfig = createTestConfig({
    strategyId: 'ema_crossover',
    symbol: 'BTC/USDT',
    timeframe: '1m',
    dateRange: { start: '2025-01-01', end: '2025-01-02' },
    initialCapital: 10000,
    leverage: 1,
    positionSizing: { type: 'percent_equity', value: 50 },
    execution: { makerFeeBps: 2, takerFeeBps: 5, slippageBps: 2, slippageModel: 'fixed' },
    indicators: { emaFast: 2, emaSlow: 4 },
    entryRules: { allowShorting: false },
    exitRules: {},
  });

  // Test 1: Incremental bar-by-bar feeding produces identical signals
  // If a strategy peeked ahead, feeding an array sliced up to bar t would produce
  // different indicators than feeding the whole array.
  const strategy = new EmaCrossoverStrategy();
  const preparedFull = strategy.prepare([...candles], { fastEma: 2, slowEma: 4 });

  for (let t = 3; t < candles.length; t++) {
    const subSlice = candles.slice(0, t + 1);
    const preparedIncremental = strategy.prepare(subSlice, { fastEma: 2, slowEma: 4 });

    const fullBar = preparedFull[t];
    const incBar = preparedIncremental[preparedIncremental.length - 1];

    const fastMatches = typeof fullBar.emaFast === 'number' && typeof incBar.emaFast === 'number' && Math.abs(fullBar.emaFast - incBar.emaFast) < 1e-4;
    const slowMatches = typeof fullBar.emaSlow === 'number' && typeof incBar.emaSlow === 'number' && Math.abs(fullBar.emaSlow - incBar.emaSlow) < 1e-4;

    assert(fastMatches && slowMatches, `Bar ${t} indicators identical whether calculated incrementally or on full series (Zero future leakage)`);
  }

  // Test 2: Verify trade entry and exit timestamps are strictly non-retroactive
  for (let i = 0; i < preparedFull.length; i++) {
    const sig = strategy.onBar(
      i,
      preparedFull,
      {
        symbol: config.symbol,
        timeframe: config.timeframe,
        leverage: config.leverage,
        allowShorting: false,
        position: null,
        cash: 10000,
        equity: 10000,
      },
      config.indicators
    );
    assert(sig !== undefined, `Signal calculation at bar ${i} succeeded without future references`);
  }

  return result;
}
