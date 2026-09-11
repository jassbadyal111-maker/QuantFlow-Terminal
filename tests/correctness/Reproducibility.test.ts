import { BacktestEngine } from '../../src/engine/BacktestEngine';
import { makeFlatSeries } from '../fixtures/fixtures';
import { BacktestConfig } from '../../src/types/backtest';

function baseConfig(): BacktestConfig {
  return {
    strategyId: 'strat-ema-crossover', exchange: 'MOCK', symbol: 'BTCUSDT', timeframe: '1m',
    dateRange: { start: '2025-01-01T00:00:00.000Z', end: '2025-01-01T00:29:00.000Z', preset: '3M' },
    initialCapital: 100000, leverage: 2, marginMode: 'CROSS',
    positionSizing: { type: 'fixed_usd', value: 10000 },
    indicators: { emaFast: 2, emaSlow: 3, atrPeriod: 2, rsiPeriod: 2, bbLength: 2, bbStdDev: 2 },
    entryRules: { longCond: 'EMA_CROSSOVER', shortCond: 'EMA_CROSSUNDER', allowShorting: true, useVolFilter: false, volFilterMultiplier: 0 },
    exitRules: { stopLossAtr: 1, takeProfitAtr: 1, trailingStop: false, breakevenAfterAtr: 0, maxHoldBars: 10 },
    execution: { makerFeeBps: 2, takerFeeBps: 5, slippageModel: 'fixed', slippageBps: 1, fundingRate8hBps: 0, latencyMs: 0 },
  };
}

describe('reproducibility', () => {
  it('hash is stable for identical configuration and dataset checksum', () => {
    const config = baseConfig();
    const checksum = 'ABC12345';
    expect(BacktestEngine.generateRunHash(config, checksum, 7)).toBe(BacktestEngine.generateRunHash(config, checksum, 7));
    expect(BacktestEngine.generateRunHash(config, checksum, 7)).not.toBe(BacktestEngine.generateRunHash({ ...config, leverage: 3 }, checksum, 7));
    expect(BacktestEngine.generateRunHash(config, checksum, 7)).not.toBe(BacktestEngine.generateRunHash(config, 'DEF67890', 7));
  });

  it('future candle changes do not change the checksum of an earlier slice', () => {
    const candles = makeFlatSeries(40);
    const earlyChecksum = BacktestEngine.generateRunHash(baseConfig(), 'EARLY', 42);
    candles[39] = { ...candles[39], close: 999 };
    expect(BacktestEngine.generateRunHash(baseConfig(), 'EARLY', 42)).toBe(earlyChecksum);
  });
});
