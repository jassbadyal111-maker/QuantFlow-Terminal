import { CandleData, BacktestConfig } from '../../types/backtest';
import { DatasetMetadata } from '../../types/dataset';

import rising1m from './rising-1m.json';
import falling1m from './falling-1m.json';
import flatMarket from './flat-market.json';
import gapUp from './gap-up.json';
import gapDown from './gap-down.json';
import largeIntrabarRange from './large-intrabar-range.json';
import missingCandle from './missing-candle.json';
import duplicateCandle from './duplicate-candle.json';
import invalidOhlc from './invalid-ohlc.json';
import fundingBoundary from './funding-boundary.json';
import fundingBetween from './funding-between.json';
import liquidation from './liquidation.json';
import intrabarAmbiguity from './intrabar-ambiguity.json';
import zeroTrade from './zero-trade.json';

export interface FixtureDataset {
  id: string;
  name: string;
  description: string;
  candles: CandleData[];
  metadata: DatasetMetadata;
}

function createMeta(id: string, name: string, candles: CandleData[]): DatasetMetadata {
  return {
    id,
    name,
    symbol: 'BTC/USDT',
    timeframe: '1m',
    source: 'DEMO_SYNTHETIC',
    isSynthetic: true,
    candleCount: candles.length,
    startTime: candles[0]?.time || '',
    endTime: candles[candles.length - 1]?.time || '',
    completeness: 1.0,
    hasGaps: false,
    checksum: `FIX-${id.toUpperCase()}`,
    generatedAt: '2025-01-01T00:00:00Z',
  };
}

export const GOLDEN_FIXTURES: Record<string, FixtureDataset> = {
  'rising-1m': {
    id: 'rising-1m',
    name: 'Rising Market (1m)',
    description: 'Monotonic uptrend with positive momentum, testing long entries, trailing stops and take-profits.',
    candles: rising1m as CandleData[],
    metadata: createMeta('rising-1m', 'Rising Market', rising1m as CandleData[]),
  },
  'falling-1m': {
    id: 'falling-1m',
    name: 'Falling Market (1m)',
    description: 'Monotonic downtrend testing short entries, stop-loss and take-profits.',
    candles: falling1m as CandleData[],
    metadata: createMeta('falling-1m', 'Falling Market', falling1m as CandleData[]),
  },
  'flat-market': {
    id: 'flat-market',
    name: 'Flat Range-Bound Market',
    description: 'Low-volatility consolidation oscillation testing signal rejection and zero churn.',
    candles: flatMarket as CandleData[],
    metadata: createMeta('flat-market', 'Flat Market', flatMarket as CandleData[]),
  },
  'gap-up': {
    id: 'gap-up',
    name: 'Gap Up Jump',
    description: 'Discontinuous jump in price testing fill slippage and execution price gap boundaries.',
    candles: gapUp as CandleData[],
    metadata: createMeta('gap-up', 'Gap Up', gapUp as CandleData[]),
  },
  'gap-down': {
    id: 'gap-down',
    name: 'Gap Down Jump',
    description: 'Discontinuous drop in price testing gap through stop-loss and execution slippage.',
    candles: gapDown as CandleData[],
    metadata: createMeta('gap-down', 'Gap Down', gapDown as CandleData[]),
  },
  'large-intrabar-range': {
    id: 'large-intrabar-range',
    name: 'Large Intrabar Range Wick',
    description: 'Extreme single-bar wick testing high/low excursion vs open/close ordering.',
    candles: largeIntrabarRange as CandleData[],
    metadata: createMeta('large-intrabar-range', 'Large Intrabar Range', largeIntrabarRange as CandleData[]),
  },
  'missing-candle': {
    id: 'missing-candle',
    name: 'Missing Candle Timestamp Gap',
    description: 'Dataset with missing 2-minute interval to test strict gap detection.',
    candles: missingCandle as CandleData[],
    metadata: createMeta('missing-candle', 'Missing Candle', missingCandle as CandleData[]),
  },
  'duplicate-candle': {
    id: 'duplicate-candle',
    name: 'Duplicate Candle Timestamp',
    description: 'Dataset with identical timestamp entries to test duplicate rejection.',
    candles: duplicateCandle as CandleData[],
    metadata: createMeta('duplicate-candle', 'Duplicate Candle', duplicateCandle as CandleData[]),
  },
  'invalid-ohlc': {
    id: 'invalid-ohlc',
    name: 'Invalid OHLC Geometry',
    description: 'Dataset with High < Low corrupted candle to test validation barrier.',
    candles: invalidOhlc as CandleData[],
    metadata: createMeta('invalid-ohlc', 'Invalid OHLC', invalidOhlc as CandleData[]),
  },
  'funding-boundary': {
    id: 'funding-boundary',
    name: '8h Funding Settlement Boundary',
    description: 'Candles crossing exact 08:00 UTC epoch to test cash ledger settlement.',
    candles: fundingBoundary as CandleData[],
    metadata: createMeta('funding-boundary', 'Funding Boundary', fundingBoundary as CandleData[]),
  },
  'funding-between': {
    id: 'funding-between',
    name: 'Between Funding Epochs',
    description: 'Candles between 02:00 and 03:00 UTC ensuring zero funding is charged.',
    candles: fundingBetween as CandleData[],
    metadata: createMeta('funding-between', 'Between Funding Epochs', fundingBetween as CandleData[]),
  },
  'liquidation': {
    id: 'liquidation',
    name: 'Liquidation Scenario',
    description: 'Severe drawdown breaching maintenance margin to test liquidation event and ledger.',
    candles: liquidation as CandleData[],
    metadata: createMeta('liquidation', 'Liquidation Scenario', liquidation as CandleData[]),
  },
  'intrabar-ambiguity': {
    id: 'intrabar-ambiguity',
    name: 'Intrabar SL/TP Ambiguity',
    description: 'Single candle wick touching both Stop-Loss and Take-Profit to test worst-case-first rule.',
    candles: intrabarAmbiguity as CandleData[],
    metadata: createMeta('intrabar-ambiguity', 'Intrabar Ambiguity', intrabarAmbiguity as CandleData[]),
  },
  'zero-trade': {
    id: 'zero-trade',
    name: 'Zero-Trade Market',
    description: 'Market data where entry condition is never met; equity equals initial capital.',
    candles: zeroTrade as CandleData[],
    metadata: createMeta('zero-trade', 'Zero Trade', zeroTrade as CandleData[]),
  },
};

export function createTestConfig(overrides: any = {}): BacktestConfig {
  return {
    strategyId: 'ema_crossover',
    exchange: 'binance',
    symbol: 'BTC/USDT',
    timeframe: '1m',
    dateRange: {
      start: '2025-01-01',
      end: '2025-01-02',
      preset: 'ALL',
      ...(overrides.dateRange || {}),
    },
    initialCapital: 10000,
    leverage: 1,
    marginMode: 'CROSS',
    positionSizing: {
      type: 'percent_equity',
      value: 100,
      ...(overrides.positionSizing || {}),
    },
    indicators: {
      emaFast: 21,
      emaSlow: 55,
      atrPeriod: 14,
      rsiPeriod: 14,
      bbLength: 20,
      bbStdDev: 2,
      ...(overrides.indicators || {}),
    },
    entryRules: {
      longCond: 'EMA_CROSSOVER',
      shortCond: 'EMA_CROSSUNDER',
      allowShorting: false,
      useVolFilter: false,
      volFilterMultiplier: 1.5,
      ...(overrides.entryRules || {}),
    },
    exitRules: {
      stopLossAtr: 1.8,
      takeProfitAtr: 4.2,
      trailingStop: false,
      breakevenAfterAtr: 2.0,
      maxHoldBars: 100,
      ...(overrides.exitRules || {}),
    },
    execution: {
      makerFeeBps: 2,
      takerFeeBps: 5,
      slippageBps: 2,
      slippageModel: 'fixed',
      fundingRate8hBps: 1.0,
      latencyMs: 50,
      ...(overrides.execution || {}),
    },
    sameBarExecutionPolicy: 'CLOSE',
    intrabarPolicy: 'CONSERVATIVE',
    ...overrides,
  } as BacktestConfig;
}
