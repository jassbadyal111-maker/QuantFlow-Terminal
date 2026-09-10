import {
  BacktestConfig,
  CandleData,
  Trade,
  Order,
  EquityPoint,
  PerformanceMetrics,
  MonthlyReturn,
} from '../types/backtest';
import { generateRealisticCandles } from '../data/mockQuantData';

export interface BacktestResult {
  config: BacktestConfig;
  candles: CandleData[];
  trades: Trade[];
  orders: Order[];
  equityCurve: EquityPoint[];
  metrics: PerformanceMetrics;
  monthlyReturns: MonthlyReturn[];
  logs: string[];
}

export function runSimulatedBacktest(
  config: BacktestConfig,
  onProgress?: (progress: number, status: string) => void
): BacktestResult {
  const logs: string[] = [];
  logs.push(`[INIT] Initializing ApexQuant Engine v4.2.1-prod...`);
  logs.push(`[SETUP] Asset: ${config.symbol} | Exchange: ${config.exchange} | Timeframe: ${config.timeframe}`);
  logs.push(`[CAPITAL] Initial equity: $${config.initialCapital.toLocaleString()} | Leverage: ${config.leverage}x`);
  logs.push(`[FEES] Taker: ${config.execution.takerFeeBps} bps | Maker: ${config.execution.makerFeeBps} bps | Slippage: ${config.execution.slippageBps} bps`);

  onProgress?.(10, 'Loading historical tick & kline cache...');

  // Determine starting price based on asset
  let basePrice = 64200;
  if (config.symbol.includes('ETH')) basePrice = 2850;
  if (config.symbol.includes('SOL')) basePrice = 175;
  if (config.symbol.includes('AVAX')) basePrice = 31.5;
  if (config.symbol.includes('DOGE')) basePrice = 0.185;

  onProgress?.(30, 'Calculating technical indicators & signals...');

  const candles = generateRealisticCandles(basePrice, 120);
  logs.push(`[DATA] Loaded ${candles.length} normalized kline bars from in-memory parquet buffer.`);

  onProgress?.(60, 'Simulating order matching & execution engine...');

  // Generate trades dynamically based on config parameters
  const trades: Trade[] = [];
  const orders: Order[] = [];
  const equityCurve: EquityPoint[] = [];

  let currentEquity = config.initialCapital;
  let benchmarkEquity = config.initialCapital;
  let peakEquity = config.initialCapital;
  let cumulativePnl = 0;
  let totalFeesPaid = 0;
  let totalFundingPaid = 0;

  const startBenchmarkPrice = candles[0].close;

  // Factor in user parameters
  const leverage = config.leverage;
  const slMult = config.exitRules.stopLossAtr;
  const tpMult = config.exitRules.takeProfitAtr;
  const takerFeeRate = (config.execution.takerFeeBps / 10000);
  const slippageRate = (config.execution.slippageBps / 10000);

  // Walk through candles to generate trades and equity curve
  let inPosition = false;
  let activeTrade: Partial<Trade> | null = null;
  let tradeIndex = 1;

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const prevC = i > 0 ? candles[i - 1] : c;

    // Update benchmark equity
    benchmarkEquity = Math.round(config.initialCapital * (c.close / startBenchmarkPrice));

    // Simple strategy condition simulation
    const isEmaCrossUp = (c.emaFast || 0) > (c.emaSlow || 0) && (prevC.emaFast || 0) <= (prevC.emaSlow || 0);
    const isEmaCrossDown = (c.emaFast || 0) < (c.emaSlow || 0) && (prevC.emaFast || 0) >= (prevC.emaSlow || 0);

    // Entry signal
    if (!inPosition && i > 15 && i < candles.length - 8 && (isEmaCrossUp || (i % 14 === 0))) {
      inPosition = true;
      const side: 'LONG' | 'SHORT' = isEmaCrossDown && config.entryRules.allowShorting ? 'SHORT' : 'LONG';
      const entryPrice = c.close * (side === 'LONG' ? (1 + slippageRate) : (1 - slippageRate));
      const positionUsd = config.positionSizing.type === 'percent_equity'
        ? (currentEquity * (config.positionSizing.value / 100)) * leverage
        : config.positionSizing.value * leverage;
      const size = Number((positionUsd / entryPrice).toFixed(4));
      const entryFee = positionUsd * takerFeeRate;
      totalFeesPaid += entryFee;

      activeTrade = {
        id: `TRD-SIM-${1000 + tradeIndex++}`,
        timestamp: c.time,
        symbol: config.symbol,
        side,
        entryPrice: Number(entryPrice.toFixed(2)),
        size,
        notional: Number(positionUsd.toFixed(2)),
        fees: Number(entryFee.toFixed(2)),
        funding: 0,
        slippageBps: config.execution.slippageBps,
        durationBars: 0,
        mfe: 0,
        mae: 0,
      };

      orders.push({
        id: `ORD-${80000 + orders.length + 1}`,
        tradeId: activeTrade.id!,
        timestamp: c.time,
        symbol: config.symbol,
        type: 'MARKET',
        side: side === 'LONG' ? 'BUY' : 'SELL',
        price: c.close,
        avgFillPrice: entryPrice,
        amount: size,
        status: 'FILLED',
        fee: entryFee,
        slippage: config.execution.slippageBps,
      });

      logs.push(`[ORDER] Placed ${side} on ${config.symbol} @ $${entryPrice.toFixed(2)} (Size: ${size})`);
    } else if (inPosition && activeTrade) {
      activeTrade.durationBars = (activeTrade.durationBars || 0) + 1;
      const priceDeltaPct = (c.close - activeTrade.entryPrice!) / activeTrade.entryPrice!;
      const pnlPct = activeTrade.side === 'LONG' ? priceDeltaPct : -priceDeltaPct;

      // Track MFE / MAE
      if (pnlPct > (activeTrade.mfe || 0)) activeTrade.mfe = Number((pnlPct * 100).toFixed(2));
      if (pnlPct < (activeTrade.mae || 0)) activeTrade.mae = Number((pnlPct * 100).toFixed(2));

      // Check Exit Conditions (SL, TP, or signal)
      const hitTP = pnlPct >= (tpMult * 0.015);
      const hitSL = pnlPct <= -(slMult * 0.012);
      const timeExit = (activeTrade.durationBars || 0) >= 12;

      if (hitTP || hitSL || timeExit || i === candles.length - 1) {
        inPosition = false;
        const exitPrice = c.close * (activeTrade.side === 'LONG' ? (1 - slippageRate) : (1 + slippageRate));
        const grossPnl = activeTrade.side === 'LONG'
          ? (exitPrice - activeTrade.entryPrice!) * activeTrade.size!
          : (activeTrade.entryPrice! - exitPrice) * activeTrade.size!;
        const exitFee = (exitPrice * activeTrade.size!) * takerFeeRate;
        totalFeesPaid += exitFee;
        const fundingCost = activeTrade.side === 'LONG' ? (activeTrade.notional! * 0.0003 * ((activeTrade.durationBars || 1) / 2)) : -10;
        totalFundingPaid += fundingCost;

        const netPnl = grossPnl - exitFee - (activeTrade.fees || 0) - fundingCost;
        const finalPnlPct = Number(((netPnl / (activeTrade.notional! / leverage)) * 100).toFixed(2));

        const completedTrade: Trade = {
          ...(activeTrade as Trade),
          exitTimestamp: c.time,
          exitPrice: Number(exitPrice.toFixed(2)),
          pnl: Number(grossPnl.toFixed(2)),
          pnlPercent: finalPnlPct,
          fees: Number(((activeTrade.fees || 0) + exitFee).toFixed(2)),
          funding: Number(fundingCost.toFixed(2)),
          netPnl: Number(netPnl.toFixed(2)),
          exitReason: hitTP ? 'TAKE_PROFIT' : hitSL ? 'STOP_LOSS' : 'SIGNAL_REVERSAL',
        };

        trades.push(completedTrade);
        currentEquity += netPnl;
        cumulativePnl += netPnl;

        orders.push({
          id: `ORD-${80000 + orders.length + 1}`,
          tradeId: completedTrade.id,
          timestamp: c.time,
          symbol: config.symbol,
          type: 'MARKET',
          side: completedTrade.side === 'LONG' ? 'SELL' : 'BUY',
          price: c.close,
          avgFillPrice: exitPrice,
          amount: completedTrade.size,
          status: 'FILLED',
          fee: exitFee,
          slippage: config.execution.slippageBps,
        });

        logs.push(`[FILL] Closed ${completedTrade.side} @ $${exitPrice.toFixed(2)} | Net PnL: $${netPnl.toFixed(2)} (${finalPnlPct}%)`);
        activeTrade = null;
      }
    }

    if (currentEquity > peakEquity) {
      peakEquity = currentEquity;
    }
    const drawdownPct = Number((((currentEquity - peakEquity) / peakEquity) * 100).toFixed(2));

    equityCurve.push({
      time: c.time.split(' ')[0],
      equity: Math.round(currentEquity),
      benchmarkEquity,
      drawdownPct,
      pnl: Math.round(currentEquity - config.initialCapital),
      cumulativePnl: Math.round(cumulativePnl),
    });
  }

  onProgress?.(90, 'Computing Sharpe, Sortino, VaR, and risk statistics...');

  // Compute metrics
  const winningTrades = trades.filter((t) => t.netPnl > 0);
  const losingTrades = trades.filter((t) => t.netPnl <= 0);
  const totalTrades = trades.length;
  const winRate = totalTrades > 0 ? Number(((winningTrades.length / totalTrades) * 100).toFixed(1)) : 0;

  const totalWins = winningTrades.reduce((acc, t) => acc + t.netPnl, 0);
  const totalLosses = Math.abs(losingTrades.reduce((acc, t) => acc + t.netPnl, 0));
  const profitFactor = totalLosses > 0 ? Number((totalWins / totalLosses).toFixed(2)) : 2.5;

  const avgWin = winningTrades.length > 0 ? totalWins / winningTrades.length : 0;
  const avgLoss = losingTrades.length > 0 ? -(totalLosses / losingTrades.length) : 0;
  const winLossRatio = avgLoss !== 0 ? Number((avgWin / Math.abs(avgLoss)).toFixed(2)) : 1.5;

  const totalReturn = Number((((currentEquity - config.initialCapital) / config.initialCapital) * 100).toFixed(2));
  const benchmarkReturn = Number((((benchmarkEquity - config.initialCapital) / config.initialCapital) * 100).toFixed(2));
  const maxDrawdown = Math.min(...equityCurve.map((e) => e.drawdownPct));

  // Sharpe and Sortino estimation
  const sharpeRatio = Number((Math.max(0.5, (totalReturn / 100) / (Math.abs(maxDrawdown / 100) * 0.9 + 0.15) * 1.35)).toFixed(2));
  const sortinoRatio = Number((sharpeRatio * 1.32).toFixed(2));
  const calmarRatio = maxDrawdown !== 0 ? Number((Math.abs(totalReturn / maxDrawdown)).toFixed(2)) : 5.0;

  const metrics: PerformanceMetrics = {
    totalReturn,
    annualizedReturn: Number((totalReturn * 1.4).toFixed(2)),
    benchmarkReturn,
    alpha: Number(((totalReturn - benchmarkReturn) / 100 * 0.6).toFixed(2)),
    beta: 0.45,
    sharpeRatio,
    sortinoRatio,
    calmarRatio,
    maxDrawdown,
    maxDrawdownDurationDays: 12,
    winRate,
    profitFactor,
    totalTrades,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    avgTradePnl: totalTrades > 0 ? Number((cumulativePnl / totalTrades).toFixed(2)) : 0,
    avgWin: Number(avgWin.toFixed(2)),
    avgLoss: Number(avgLoss.toFixed(2)),
    winLossRatio,
    expectancy: Number((((winRate / 100) * avgWin + (1 - winRate / 100) * avgLoss) / Math.abs(avgLoss || 1)).toFixed(2)),
    totalFeesPaid: Number(totalFeesPaid.toFixed(2)),
    totalFundingPaid: Number(totalFundingPaid.toFixed(2)),
    recoveryFactor: maxDrawdown !== 0 ? Number((Math.abs(cumulativePnl / (config.initialCapital * (maxDrawdown / 100)))).toFixed(2)) : 10,
    dailyVolAnnualized: 24.8,
    valueAtRisk95: -2.15,
    expectedShortfall95: -3.42,
  };

  const monthlyReturns: MonthlyReturn[] = [
    {
      year: 2025,
      months: [7.2, 5.8, null, null, null, null, null, null, null, null, null, null],
      ytd: 13.4,
    },
    {
      year: 2024,
      months: [11.2, 14.5, -1.8, 6.9, 8.4, -3.8, 10.5, 6.2, 3.8, 13.5, 17.1, 8.2],
      ytd: totalReturn,
    },
  ];

  logs.push(`[COMPLETE] Backtest run finished in 0.45s. Total trades: ${totalTrades} | Sharpe: ${sharpeRatio} | Return: ${totalReturn}%`);
  onProgress?.(100, 'Backtest completed successfully.');

  return {
    config,
    candles,
    trades,
    orders,
    equityCurve,
    metrics,
    monthlyReturns,
    logs,
  };
}
