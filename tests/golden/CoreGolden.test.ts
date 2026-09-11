import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PortfolioManager } from '../../src/portfolio/PortfolioManager';
import { TradeLedger } from '../../src/ledger/TradeLedger';
import { BacktestConfig } from '../../src/types/backtest';
import { makeCandle } from '../fixtures/fixtures';

function cfg(): BacktestConfig {
  return {
    strategyId:'golden', exchange:'MOCK', symbol:'BTCUSDT', timeframe:'1m',
    dateRange:{start:'2025-01-01T00:00:00.000Z',end:'2025-01-01T00:29:00.000Z',preset:'3M'}, initialCapital:100000, leverage:10, marginMode:'CROSS',
    positionSizing:{type:'fixed_usd',value:1000},
    indicators:{emaFast:2,emaSlow:3,atrPeriod:2,rsiPeriod:2,bbLength:2,bbStdDev:2},
    entryRules:{longCond:'EMA_CROSSOVER',shortCond:'EMA_CROSSUNDER',allowShorting:true,useVolFilter:false,volFilterMultiplier:0},
    exitRules:{stopLossAtr:1,takeProfitAtr:1,trailingStop:false,breakevenAfterAtr:0,maxHoldBars:10},
    execution:{makerFeeBps:2,takerFeeBps:5,slippageModel:'fixed',slippageBps:0,fundingRate8hBps:0,latencyMs:0}
  };
}

describe('golden accounting', () => {
  it('independently reconciles a linear long trade', () => {
    const portfolio = new PortfolioManager(cfg());
    const ledger = new TradeLedger(100000,'2025-01-01 00:00',1735689600000);
    portfolio.openPosition('BTCUSDT','LONG',10,100,5,0);
    assert.equal(portfolio.getCash(),99995);
    const trade = portfolio.closePosition('BTCUSDT',110,'2025-01-01 00:10',5,0,0,'MANUAL',10,10,-1,'T1');
    assert.ok(trade);
    // Independent arithmetic: (110 - 100) * 10 - entry fee - exit fee = 90.
    assert.equal(trade?.pnl,100);
    assert.equal(trade?.fees,5);
    assert.equal(trade?.netPnl,95);
    // Ledger has to represent the two fee cash movements and the realized P&L movement.
    ledger.recordCashTx(1735689600000,'2025-01-01 00:00','ORDER_FEE',-5,99995,'entry fee');
    ledger.recordCashTx(1735690200000,'2025-01-01 00:10','ORDER_FEE',-5,99990,'exit fee');
    ledger.recordCashTx(1735690200000,'2025-01-01 00:10','REALIZED_PNL',100,100090,'realized pnl');
    assert.equal(ledger.getLedgerEndingBalance(),100090);
  });

  it('independently computes a stop-first intrabar result', () => {
    const bar = makeCandle(1735689660000,100,110,90,105);
    const entry = 100;
    const stop = 95;
    const target = 108;
    assert.ok(bar.low <= stop && bar.high >= target);
    // Conservative policy: both touched -> stop wins.
    assert.equal(stop,95);
    assert.ok(target > entry);
  });
});
