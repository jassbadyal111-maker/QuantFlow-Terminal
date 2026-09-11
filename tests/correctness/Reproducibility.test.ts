import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BacktestEngine } from '../../src/engine/BacktestEngine';
import { stableStringify, hashStable } from '../../src/core/StableSerialization';
import { makeFlatSeries } from '../fixtures/fixtures';
import { BacktestConfig } from '../../src/types/backtest';
import { DataValidator } from '../../src/data/validation/DataValidator';

function baseConfig(): BacktestConfig {
  return {
    strategyId:'strat-ema-crossover',exchange:'MOCK',symbol:'BTCUSDT',timeframe:'1m',
    dateRange:{start:'2025-01-01T00:00:00.000Z',end:'2025-01-01T00:29:00.000Z',preset:'3M'},initialCapital:100000,leverage:2,marginMode:'CROSS',
    positionSizing:{type:'fixed_usd',value:10000},indicators:{emaFast:2,emaSlow:3,atrPeriod:2,rsiPeriod:2,bbLength:2,bbStdDev:2},
    entryRules:{longCond:'EMA_CROSSOVER',shortCond:'EMA_CROSSUNDER',allowShorting:true,useVolFilter:false,volFilterMultiplier:0},
    exitRules:{stopLossAtr:1,takeProfitAtr:1,trailingStop:false,breakevenAfterAtr:0,maxHoldBars:10},
    execution:{makerFeeBps:2,takerFeeBps:5,slippageModel:'fixed',slippageBps:1,fundingRate8hBps:0,latencyMs:0}
  };
}

describe('reproducibility and look-ahead boundaries', () => {
  it('stable serialization is independent of object insertion order', () => {
    assert.equal(stableStringify({b:2,a:1}), stableStringify({a:1,b:2}));
    assert.equal(hashStable({b:2,a:1}), hashStable({a:1,b:2}));
  });

  it('changes the run hash when a result-affecting execution input changes', () => {
    const config = baseConfig();
    const hash = BacktestEngine.generateRunHash(config, 'ABC12345', 7);
    assert.equal(hash, BacktestEngine.generateRunHash(config, 'ABC12345', 7));
    assert.notEqual(hash, BacktestEngine.generateRunHash({...config, leverage:3}, 'ABC12345', 7));
    assert.notEqual(hash, BacktestEngine.generateRunHash({...config, execution:{...config.execution, slippageBps:2}}, 'ABC12345', 7));
    assert.notEqual(hash, BacktestEngine.generateRunHash(config, 'DEF67890', 7));
  });

  it('future candle edits do not alter an independently sliced early dataset checksum', () => {
    const candles = makeFlatSeries(40);
    const early = candles.slice(0, 20);
    const before = DataValidator.calculateChecksum(early);
    candles[39] = {...candles[39], close:999};
    assert.equal(DataValidator.calculateChecksum(candles.slice(0,20)), before);
  });
});
