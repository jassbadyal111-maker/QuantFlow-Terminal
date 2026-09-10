import React, { useState } from 'react';
import {
  BacktestConfig,
  CandleData,
  Trade,
  Order,
  EquityPoint,
  PerformanceMetrics,
  MonthlyReturn,
  Strategy,
} from '../../types/backtest';
import { TradingCandleChart } from '../charts/TradingCandleChart';
import { EquityCurveChart } from '../charts/EquityCurveChart';
import {
  formatCurrency,
  formatPercent,
  formatNumber,
  formatCompactUSD,
  getPnlTextColor,
  getPnlBgColor,
} from '../../utils/formatters';
import {
  Sliders,
  Play,
  Square,
  BarChart2,
  ListOrdered,
  FileCheck,
  Calendar,
  Shield,
  Terminal as TerminalIcon,
  ChevronRight,
  ChevronLeft,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  AlertCircle,
  Download,
  Info,
  Maximize2,
  Filter,
} from 'lucide-react';

interface BacktestViewProps {
  config: BacktestConfig;
  onConfigChange: (newConfig: Partial<BacktestConfig>) => void;
  strategies: Strategy[];
  candles: CandleData[];
  trades: Trade[];
  orders: Order[];
  equityCurve: EquityPoint[];
  metrics: PerformanceMetrics;
  monthlyReturns: MonthlyReturn[];
  logs: string[];
  isRunning: boolean;
  progress: number;
  statusMessage: string;
  onRunBacktest: () => void;
  onStopBacktest: () => void;
  onSelectTrade?: (trade: Trade) => void;
}

type BottomTab = 'trades' | 'orders' | 'metrics' | 'monthly' | 'risk' | 'logs';
type ChartViewMode = 'candles' | 'equity' | 'drawdown' | 'split';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const BacktestView: React.FC<BacktestViewProps> = ({
  config,
  onConfigChange,
  strategies,
  candles,
  trades,
  orders,
  equityCurve,
  metrics,
  monthlyReturns,
  logs,
  isRunning,
  progress,
  statusMessage,
  onRunBacktest,
  onStopBacktest,
  onSelectTrade,
}) => {
  const [configOpen, setConfigOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<BottomTab>('trades');
  const [chartMode, setChartMode] = useState<ChartViewMode>('candles');
  const [tradeFilter, setTradeFilter] = useState<'ALL' | 'LONG' | 'SHORT' | 'WIN' | 'LOSS'>('ALL');
  const [selectedTradeModal, setSelectedTradeModal] = useState<Trade | null>(null);

  const filteredTrades = trades.filter((t) => {
    if (tradeFilter === 'LONG') return t.side === 'LONG';
    if (tradeFilter === 'SHORT') return t.side === 'SHORT';
    if (tradeFilter === 'WIN') return t.netPnl > 0;
    if (tradeFilter === 'LOSS') return t.netPnl <= 0;
    return true;
  });

  return (
    <div className="flex-1 flex overflow-hidden h-[calc(100vh-3.5rem)] select-none">
      {/* LEFT CONFIGURATION PANEL (Collapsible) */}
      <div
        className={`${
          configOpen ? 'w-80' : 'w-0'
        } shrink-0 border-r border-[#1a2333] bg-[#090d14] flex flex-col transition-all duration-200 overflow-hidden z-10`}
      >
        {/* Config Panel Header */}
        <div className="p-2.5 border-b border-[#1a2333] bg-[#0b0f17] flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
            <Sliders className="w-3.5 h-3.5 text-emerald-400" />
            <span>Backtest Configuration</span>
          </div>
          <button
            onClick={() => setConfigOpen(false)}
            className="p-1 rounded hover:bg-[#141d2c] text-slate-400 hover:text-slate-200"
            title="Collapse configuration panel"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Scrollable Configuration Fields */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4 text-xs font-sans">
          {/* Strategy Selection */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-tight font-mono-data">
              Strategy Algorithm
            </label>
            <select
              aria-label="Strategy Algorithm"
              value={config.strategyId}
              onChange={(e) => onConfigChange({ strategyId: e.target.value })}
              className="w-full bg-[#0e1420] border border-[#1e2739] text-slate-200 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-emerald-500/50 font-mono-data"
            >
              {strategies.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.symbol})
                </option>
              ))}
            </select>
          </div>

          {/* Capital & Leverage */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-mono-data uppercase">Initial Capital ($)</label>
              <input
                type="number"
                aria-label="Initial Capital ($)"
                value={config.initialCapital}
                onChange={(e) => onConfigChange({ initialCapital: Number(e.target.value) })}
                step="10000"
                min="1000"
                className="w-full bg-[#0e1420] border border-[#1e2739] text-slate-200 rounded px-2 py-1 text-xs font-mono-data focus:border-emerald-500/50"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-mono-data uppercase">Leverage (x)</label>
              <select
                aria-label="Leverage (x)"
                value={config.leverage}
                onChange={(e) => onConfigChange({ leverage: Number(e.target.value) })}
                className="w-full bg-[#0e1420] border border-[#1e2739] text-slate-200 rounded px-2 py-1 text-xs font-mono-data focus:border-emerald-500/50"
              >
                {[1, 2, 3, 5, 10, 20].map((lev) => (
                  <option key={lev} value={lev}>
                    {lev}x Leverage
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Position Sizing */}
          <div className="space-y-1.5 p-2 rounded bg-[#0d121c] border border-[#1a2333]">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-slate-300">Position Sizing</span>
              <span className="text-[10px] text-emerald-400 font-mono-data">Dynamic</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select
                aria-label="Position Sizing Type"
                value={config.positionSizing.type}
                onChange={(e) =>
                  onConfigChange({
                    positionSizing: {
                      ...config.positionSizing,
                      type: e.target.value as any,
                    },
                  })
                }
                className="bg-[#090d14] border border-[#1c2436] text-slate-300 rounded px-2 py-1 text-[11px]"
              >
                <option value="percent_equity">% of Equity</option>
                <option value="fixed_usd">Fixed USD</option>
                <option value="vol_target">Vol Target</option>
                <option value="kelly">Quarter Kelly</option>
              </select>
              <input
                type="number"
                aria-label="Position Sizing Value"
                value={config.positionSizing.value}
                onChange={(e) =>
                  onConfigChange({
                    positionSizing: {
                      ...config.positionSizing,
                      value: Number(e.target.value),
                    },
                  })
                }
                className="bg-[#090d14] border border-[#1c2436] text-slate-200 rounded px-2 py-1 text-[11px] font-mono-data"
              />
            </div>
          </div>

          {/* Indicators & Signal Rules */}
          <div className="space-y-2 p-2.5 rounded bg-[#0d121c] border border-[#1a2333]">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-300 text-[11px]">Technical Indicators</span>
              <span className="text-[10px] text-slate-400 font-mono-data">Signals</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[10px] text-slate-400 font-mono-data">EMA Fast</span>
                <input
                  type="number"
                  aria-label="EMA Fast"
                  value={config.indicators.emaFast}
                  onChange={(e) =>
                    onConfigChange({
                      indicators: { ...config.indicators, emaFast: Number(e.target.value) },
                    })
                  }
                  className="w-full bg-[#090d14] border border-[#1c2436] text-slate-200 rounded px-2 py-1 font-mono-data text-[11px]"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-mono-data">EMA Slow</span>
                <input
                  type="number"
                  aria-label="EMA Slow"
                  value={config.indicators.emaSlow}
                  onChange={(e) =>
                    onConfigChange({
                      indicators: { ...config.indicators, emaSlow: Number(e.target.value) },
                    })
                  }
                  className="w-full bg-[#090d14] border border-[#1c2436] text-slate-200 rounded px-2 py-1 font-mono-data text-[11px]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[10px] text-slate-400 font-mono-data">ATR Period</span>
                <input
                  type="number"
                  aria-label="ATR Period"
                  value={config.indicators.atrPeriod}
                  onChange={(e) =>
                    onConfigChange({
                      indicators: { ...config.indicators, atrPeriod: Number(e.target.value) },
                    })
                  }
                  className="w-full bg-[#090d14] border border-[#1c2436] text-slate-200 rounded px-2 py-1 font-mono-data text-[11px]"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-mono-data">RSI Period</span>
                <input
                  type="number"
                  aria-label="RSI Period"
                  value={config.indicators.rsiPeriod}
                  onChange={(e) =>
                    onConfigChange({
                      indicators: { ...config.indicators, rsiPeriod: Number(e.target.value) },
                    })
                  }
                  className="w-full bg-[#090d14] border border-[#1c2436] text-slate-200 rounded px-2 py-1 font-mono-data text-[11px]"
                />
              </div>
            </div>
          </div>

          {/* Risk Management / SL & TP */}
          <div className="space-y-2 p-2.5 rounded bg-[#0d121c] border border-[#1a2333]">
            <span className="font-semibold text-slate-300 text-[11px]">Exit & Stop Loss Rules</span>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[10px] text-slate-400 font-mono-data">Stop Loss (x ATR)</span>
                <input
                  type="number"
                  step="0.1"
                  aria-label="Stop Loss (x ATR)"
                  value={config.exitRules.stopLossAtr}
                  onChange={(e) =>
                    onConfigChange({
                      exitRules: { ...config.exitRules, stopLossAtr: Number(e.target.value) },
                    })
                  }
                  className="w-full bg-[#090d14] border border-[#1c2436] text-rose-400 font-mono-data rounded px-2 py-1 text-[11px]"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-mono-data">Take Profit (x ATR)</span>
                <input
                  type="number"
                  step="0.1"
                  aria-label="Take Profit (x ATR)"
                  value={config.exitRules.takeProfitAtr}
                  onChange={(e) =>
                    onConfigChange({
                      exitRules: { ...config.exitRules, takeProfitAtr: Number(e.target.value) },
                    })
                  }
                  className="w-full bg-[#090d14] border border-[#1c2436] text-emerald-400 font-mono-data rounded px-2 py-1 text-[11px]"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1 text-[11px] text-slate-300">
              <span>Trailing ATR Stop</span>
              <input
                type="checkbox"
                aria-label="Trailing ATR Stop"
                checked={config.exitRules.trailingStop}
                onChange={(e) =>
                  onConfigChange({
                    exitRules: { ...config.exitRules, trailingStop: e.target.checked },
                  })
                }
                className="accent-emerald-500 rounded"
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-300">
              <span>Allow Short Positions</span>
              <input
                type="checkbox"
                aria-label="Allow Short Positions"
                checked={config.entryRules.allowShorting}
                onChange={(e) =>
                  onConfigChange({
                    entryRules: { ...config.entryRules, allowShorting: e.target.checked },
                  })
                }
                className="accent-emerald-500 rounded"
              />
            </div>
          </div>

          {/* Execution & Slippage Settings */}
          <div className="space-y-2 p-2.5 rounded bg-[#0d121c] border border-[#1a2333]">
            <span className="font-semibold text-slate-300 text-[11px]">Execution, Fees & Slippage</span>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[10px] text-slate-400 font-mono-data">Taker Fee (bps)</span>
                <input
                  type="number"
                  step="0.5"
                  aria-label="Taker Fee (bps)"
                  value={config.execution.takerFeeBps}
                  onChange={(e) =>
                    onConfigChange({
                      execution: { ...config.execution, takerFeeBps: Number(e.target.value) },
                    })
                  }
                  className="w-full bg-[#090d14] border border-[#1c2436] text-slate-200 font-mono-data rounded px-2 py-1 text-[11px]"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-mono-data">Slippage (bps)</span>
                <input
                  type="number"
                  step="0.5"
                  aria-label="Slippage (bps)"
                  value={config.execution.slippageBps}
                  onChange={(e) =>
                    onConfigChange({
                      execution: { ...config.execution, slippageBps: Number(e.target.value) },
                    })
                  }
                  className="w-full bg-[#090d14] border border-[#1c2436] text-slate-200 font-mono-data rounded px-2 py-1 text-[11px]"
                />
              </div>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 font-mono-data">Slippage Model</span>
              <select
                aria-label="Slippage Model"
                value={config.execution.slippageModel}
                onChange={(e) =>
                  onConfigChange({
                    execution: { ...config.execution, slippageModel: e.target.value as any },
                  })
                }
                className="w-full bg-[#090d14] border border-[#1c2436] text-slate-300 rounded px-2 py-1 text-[11px]"
              >
                <option value="fixed">Fixed bps per execution</option>
                <option value="linear_impact">Linear Market Impact</option>
                <option value="sqrt_impact">Square-Root Liquidity Decay</option>
              </select>
            </div>
          </div>
        </div>

        {/* Bottom Run Button inside panel */}
        <div className="p-2.5 border-t border-[#1a2333] bg-[#0b0f17]">
          {isRunning ? (
            <button
              onClick={onStopBacktest}
              className="w-full py-2 rounded bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Stop Backtest ({progress}%)</span>
            </button>
          ) : (
            <button
              onClick={onRunBacktest}
              className="w-full py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Run Simulation</span>
            </button>
          )}
        </div>
      </div>

      {/* Toggle button if collapsed */}
      {!configOpen && (
        <button
          onClick={() => setConfigOpen(true)}
          className="w-5 bg-[#090d14] hover:bg-[#131b28] border-r border-[#1a2333] flex items-center justify-center text-slate-400 hover:text-slate-200"
          title="Open Configuration Panel"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}

      {/* MAIN WORKSPACE AREA */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#080b10]">
        {/* KPI Strip above chart */}
        <div className="px-3 py-1.5 border-b border-[#1a2333] bg-[#0b0f17] flex items-center justify-between text-xs font-mono-data overflow-x-auto">
          <div className="flex items-center gap-4 shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 text-[11px]">NET RETURN:</span>
              <span className={`font-bold text-sm ${getPnlTextColor(metrics.totalReturn)}`}>
                {formatPercent(metrics.totalReturn)}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 text-[11px]">SHARPE:</span>
              <span className="font-bold text-slate-100">{metrics.sharpeRatio.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 text-[11px]">SORTINO:</span>
              <span className="font-bold text-slate-200">{metrics.sortinoRatio.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 text-[11px]">MAX DD:</span>
              <span className="font-bold text-rose-400">{metrics.maxDrawdown.toFixed(2)}%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 text-[11px]">WIN RATE:</span>
              <span className="text-slate-200">{metrics.winRate.toFixed(1)}%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 text-[11px]">PROFIT FACTOR:</span>
              <span className="text-slate-200">{metrics.profitFactor.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 text-[11px]">TRADES:</span>
              <span className="text-slate-200">{metrics.totalTrades}</span>
            </div>
          </div>

          {/* Chart View Switcher */}
          <div className="flex items-center gap-1 bg-[#090d14] rounded border border-[#1a2333] p-0.5 shrink-0 ml-2">
            <button
              onClick={() => setChartMode('candles')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                chartMode === 'candles'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Candles
            </button>
            <button
              onClick={() => setChartMode('equity')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                chartMode === 'equity'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Equity Curve
            </button>
            <button
              onClick={() => setChartMode('split')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                chartMode === 'split'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Split View
            </button>
          </div>
        </div>

        {/* Primary Chart Area */}
        <div className="p-3 bg-[#080b10] flex-1 min-h-[300px] overflow-y-auto">
          {chartMode === 'candles' && (
            <TradingCandleChart
              candles={candles}
              symbol={config.symbol}
              timeframe={config.timeframe}
              height={380}
            />
          )}
          {chartMode === 'equity' && (
            <EquityCurveChart
              data={equityCurve}
              initialCapital={config.initialCapital}
              height={380}
            />
          )}
          {chartMode === 'split' && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
              <TradingCandleChart
                candles={candles}
                symbol={config.symbol}
                timeframe={config.timeframe}
                height={340}
              />
              <EquityCurveChart
                data={equityCurve}
                initialCapital={config.initialCapital}
                height={340}
              />
            </div>
          )}
        </div>

        {/* BOTTOM ANALYTICAL TABS */}
        <div className="border-t border-[#1a2333] bg-[#090d14] flex flex-col h-64 shrink-0 overflow-hidden">
          {/* Tabs Navigation */}
          <div className="flex items-center justify-between border-b border-[#1a2333] px-3 bg-[#0b0f17] text-xs">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveTab('trades')}
                className={`px-3 py-2 border-b-2 font-medium transition-colors flex items-center gap-1.5 ${
                  activeTab === 'trades'
                    ? 'border-emerald-400 text-emerald-400 bg-[#131b29]'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <ListOrdered className="w-3.5 h-3.5" />
                <span>Closed Trades ({trades.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('orders')}
                className={`px-3 py-2 border-b-2 font-medium transition-colors flex items-center gap-1.5 ${
                  activeTab === 'orders'
                    ? 'border-emerald-400 text-emerald-400 bg-[#131b29]'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <BarChart2 className="w-3.5 h-3.5" />
                <span>Order Fills ({orders.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('metrics')}
                className={`px-3 py-2 border-b-2 font-medium transition-colors flex items-center gap-1.5 ${
                  activeTab === 'metrics'
                    ? 'border-emerald-400 text-emerald-400 bg-[#131b29]'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileCheck className="w-3.5 h-3.5" />
                <span>Full Metrics Table</span>
              </button>

              <button
                onClick={() => setActiveTab('monthly')}
                className={`px-3 py-2 border-b-2 font-medium transition-colors flex items-center gap-1.5 ${
                  activeTab === 'monthly'
                    ? 'border-emerald-400 text-emerald-400 bg-[#131b29]'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Monthly Returns</span>
              </button>

              <button
                onClick={() => setActiveTab('logs')}
                className={`px-3 py-2 border-b-2 font-medium transition-colors flex items-center gap-1.5 ${
                  activeTab === 'logs'
                    ? 'border-emerald-400 text-emerald-400 bg-[#131b29]'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <TerminalIcon className="w-3.5 h-3.5" />
                <span>Engine Logs</span>
              </button>
            </div>

            {/* Quick Filters for Trades */}
            {activeTab === 'trades' && (
              <div className="flex items-center gap-1 text-[11px] font-mono-data">
                <span className="text-slate-400 text-[10px]">Filter:</span>
                {(['ALL', 'LONG', 'SHORT', 'WIN', 'LOSS'] as const).map((flt) => (
                  <button
                    key={flt}
                    onClick={() => setTradeFilter(flt)}
                    className={`px-1.5 py-0.5 rounded text-[10px] ${
                      tradeFilter === flt
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {flt}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Tab Content Panes */}
          <div className="flex-1 overflow-y-auto p-2 bg-[#090d14]">
            {/* TRADES TAB */}
            {activeTab === 'trades' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono-data">
                  <thead className="bg-[#0e1420] text-slate-400 border-b border-[#1c2436] text-[10px] uppercase sticky top-0">
                    <tr>
                      <th className="py-1.5 px-2">Trade ID</th>
                      <th className="py-1.5 px-2">Time (In/Out)</th>
                      <th className="py-1.5 px-2">Side</th>
                      <th className="py-1.5 px-2 text-right">Entry</th>
                      <th className="py-1.5 px-2 text-right">Exit</th>
                      <th className="py-1.5 px-2 text-right">Size</th>
                      <th className="py-1.5 px-2 text-right">Net PnL ($)</th>
                      <th className="py-1.5 px-2 text-right">PnL (%)</th>
                      <th className="py-1.5 px-2 text-right">Fees & Funding</th>
                      <th className="py-1.5 px-2 text-right">Exit Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#172030]/60">
                    {filteredTrades.map((t) => (
                      <tr
                        key={t.id}
                        onClick={() => setSelectedTradeModal(t)}
                        className="hover:bg-[#121a28] cursor-pointer transition-colors"
                      >
                        <td className="py-1.5 px-2 text-slate-300 font-semibold">{t.id}</td>
                        <td className="py-1.5 px-2 text-slate-400 text-[10px]">
                          <div>{t.timestamp}</div>
                          <div className="text-slate-500">{t.exitTimestamp}</div>
                        </td>
                        <td className="py-1.5 px-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              t.side === 'LONG'
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                            }`}
                          >
                            {t.side}
                          </span>
                        </td>
                        <td className="py-1.5 px-2 text-right text-slate-300">{formatCurrency(t.entryPrice)}</td>
                        <td className="py-1.5 px-2 text-right text-slate-300">{formatCurrency(t.exitPrice)}</td>
                        <td className="py-1.5 px-2 text-right text-slate-400">{t.size}</td>
                        <td className={`py-1.5 px-2 text-right font-bold ${getPnlTextColor(t.netPnl)}`}>
                          {t.netPnl > 0 ? `+${formatCurrency(t.netPnl)}` : formatCurrency(t.netPnl)}
                        </td>
                        <td className={`py-1.5 px-2 text-right font-bold ${getPnlTextColor(t.pnlPercent)}`}>
                          {formatPercent(t.pnlPercent)}
                        </td>
                        <td className="py-1.5 px-2 text-right text-slate-400 text-[10px]">
                          ${(t.fees + t.funding).toFixed(2)}
                        </td>
                        <td className="py-1.5 px-2 text-right">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#162030] text-slate-300 border border-[#233148]">
                            {t.exitReason}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ORDERS TAB */}
            {activeTab === 'orders' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono-data">
                  <thead className="bg-[#0e1420] text-slate-400 border-b border-[#1c2436] text-[10px] uppercase sticky top-0">
                    <tr>
                      <th className="py-1.5 px-2">Order ID</th>
                      <th className="py-1.5 px-2">Timestamp</th>
                      <th className="py-1.5 px-2">Type</th>
                      <th className="py-1.5 px-2">Side</th>
                      <th className="py-1.5 px-2 text-right">Order Price</th>
                      <th className="py-1.5 px-2 text-right">Avg Fill</th>
                      <th className="py-1.5 px-2 text-right">Amount</th>
                      <th className="py-1.5 px-2 text-center">Status</th>
                      <th className="py-1.5 px-2 text-right">Fee</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#172030]/60">
                    {orders.map((o) => (
                      <tr key={o.id} className="hover:bg-[#121a28]">
                        <td className="py-1.5 px-2 text-slate-300 font-semibold">{o.id}</td>
                        <td className="py-1.5 px-2 text-slate-400 text-[10px]">{o.timestamp}</td>
                        <td className="py-1.5 px-2 text-slate-400 text-[10px]">{o.type}</td>
                        <td className="py-1.5 px-2">
                          <span
                            className={
                              o.side === 'BUY' ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'
                            }
                          >
                            {o.side}
                          </span>
                        </td>
                        <td className="py-1.5 px-2 text-right text-slate-300">{formatCurrency(o.price)}</td>
                        <td className="py-1.5 px-2 text-right text-slate-300">{formatCurrency(o.avgFillPrice)}</td>
                        <td className="py-1.5 px-2 text-right text-slate-400">{o.amount}</td>
                        <td className="py-1.5 px-2 text-center">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                            {o.status}
                          </span>
                        </td>
                        <td className="py-1.5 px-2 text-right text-slate-400">${o.fee.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* METRICS TAB */}
            {activeTab === 'metrics' && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-2 font-mono-data text-xs">
                <div className="space-y-1.5 p-2 rounded bg-[#0d121c] border border-[#1a2333]">
                  <div className="text-[10px] uppercase text-slate-400">Return Profile</div>
                  <div className="flex justify-between"><span>Cumulative Return:</span> <span className="font-bold text-emerald-400">{formatPercent(metrics.totalReturn)}</span></div>
                  <div className="flex justify-between"><span>Annualized Return:</span> <span className="text-slate-200">{formatPercent(metrics.annualizedReturn)}</span></div>
                  <div className="flex justify-between"><span>Benchmark Return:</span> <span className="text-slate-400">{formatPercent(metrics.benchmarkReturn)}</span></div>
                  <div className="flex justify-between"><span>Alpha vs BTC:</span> <span className="text-emerald-400">+{metrics.alpha}</span></div>
                  <div className="flex justify-between"><span>Beta:</span> <span className="text-slate-300">{metrics.beta}</span></div>
                </div>

                <div className="space-y-1.5 p-2 rounded bg-[#0d121c] border border-[#1a2333]">
                  <div className="text-[10px] uppercase text-slate-400">Risk-Adjusted Performance</div>
                  <div className="flex justify-between"><span>Sharpe Ratio (Rf=4%):</span> <span className="font-bold text-slate-100">{metrics.sharpeRatio.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Sortino Ratio:</span> <span className="font-bold text-slate-100">{metrics.sortinoRatio.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Calmar Ratio:</span> <span className="text-slate-200">{metrics.calmarRatio.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Profit Factor:</span> <span className="text-slate-200">{metrics.profitFactor.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Recovery Factor:</span> <span className="text-slate-200">{metrics.recoveryFactor.toFixed(2)}</span></div>
                </div>

                <div className="space-y-1.5 p-2 rounded bg-[#0d121c] border border-[#1a2333]">
                  <div className="text-[10px] uppercase text-slate-400">Trade Statistics</div>
                  <div className="flex justify-between"><span>Total Closed Trades:</span> <span className="text-slate-200">{metrics.totalTrades}</span></div>
                  <div className="flex justify-between"><span>Win Rate:</span> <span className="font-bold text-emerald-400">{metrics.winRate.toFixed(1)}%</span></div>
                  <div className="flex justify-between"><span>Avg Winning Trade:</span> <span className="text-emerald-400">{formatCurrency(metrics.avgWin)}</span></div>
                  <div className="flex justify-between"><span>Avg Losing Trade:</span> <span className="text-rose-400">{formatCurrency(metrics.avgLoss)}</span></div>
                  <div className="flex justify-between"><span>Win/Loss Ratio:</span> <span className="text-slate-200">{metrics.winLossRatio.toFixed(2)}</span></div>
                </div>

                <div className="space-y-1.5 p-2 rounded bg-[#0d121c] border border-[#1a2333]">
                  <div className="text-[10px] uppercase text-slate-400">Drawdown & Frictional Costs</div>
                  <div className="flex justify-between"><span>Max Drawdown:</span> <span className="font-bold text-rose-400">{metrics.maxDrawdown.toFixed(2)}%</span></div>
                  <div className="flex justify-between"><span>Max DD Duration:</span> <span className="text-slate-300">{metrics.maxDrawdownDurationDays} days</span></div>
                  <div className="flex justify-between"><span>Total Commissions:</span> <span className="text-slate-300">${metrics.totalFeesPaid.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Funding Rate Paid:</span> <span className="text-slate-300">${metrics.totalFundingPaid.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>1-Day 95% VaR:</span> <span className="text-rose-400">{metrics.valueAtRisk95}%</span></div>
                </div>
              </div>
            )}

            {/* MONTHLY RETURNS TAB */}
            {activeTab === 'monthly' && (
              <div className="p-2 overflow-x-auto">
                <table className="w-full text-center text-xs font-mono-data">
                  <thead>
                    <tr className="text-slate-400 border-b border-[#1c2436]">
                      <th className="py-1 px-2 text-left">Year</th>
                      {MONTH_NAMES.map((m) => (
                        <th key={m} className="py-1 px-2 font-normal">
                          {m}
                        </th>
                      ))}
                      <th className="py-1 px-2 text-right font-bold text-slate-300">YTD</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#172030]">
                    {monthlyReturns.map((row) => (
                      <tr key={row.year}>
                        <td className="py-2 px-2 text-left font-semibold text-slate-200">{row.year}</td>
                        {row.months.map((val, idx) => (
                          <td key={idx} className="py-2 px-1">
                            {val !== null ? (
                              <div
                                className={`px-1 py-0.5 rounded text-[10px] ${
                                  val >= 0
                                    ? 'bg-emerald-500/10 text-emerald-400'
                                    : 'bg-rose-500/10 text-rose-400'
                                }`}
                              >
                                {val > 0 ? `+${val}%` : `${val}%`}
                              </div>
                            ) : (
                              <span className="text-slate-500">-</span>
                            )}
                          </td>
                        ))}
                        <td
                          className={`py-2 px-2 text-right font-bold ${
                            row.ytd >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {row.ytd > 0 ? `+${row.ytd}%` : `${row.ytd}%`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* LOGS TAB */}
            {activeTab === 'logs' && (
              <div className="p-2 space-y-1 font-mono-data text-[11px] text-slate-300">
                {logs.map((log, i) => (
                  <div key={i} className="leading-relaxed">
                    <span className="text-slate-500">[{new Date().toISOString().slice(11, 19)}]</span>{' '}
                    <span className={log.includes('COMPLETE') ? 'text-emerald-400 font-bold' : log.includes('FILL') ? 'text-cyan-400' : 'text-slate-300'}>
                      {log}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* TRADE EXECUTION DETAIL MODAL / DRAWER */}
      {selectedTradeModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-lg bg-[#0e131d] border border-[#222d42] rounded-lg shadow-2xl p-4 font-sans select-text">
            <div className="flex items-center justify-between border-b border-[#1c2436] pb-2 mb-3">
              <div className="flex items-center gap-2">
                <span className="font-mono-data font-bold text-slate-100 text-sm">{selectedTradeModal.id}</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    selectedTradeModal.side === 'LONG'
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : 'bg-rose-500/15 text-rose-400'
                  }`}
                >
                  {selectedTradeModal.side}
                </span>
                <span className="text-xs text-slate-400">{selectedTradeModal.symbol}</span>
              </div>
              <button
                onClick={() => setSelectedTradeModal(null)}
                className="text-slate-400 hover:text-slate-200 p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs font-mono-data">
              <div className="flex justify-between py-1 border-b border-[#161f30]">
                <span className="text-slate-400">Entry Execution Price:</span>
                <span className="text-slate-200 font-semibold">{formatCurrency(selectedTradeModal.entryPrice)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#161f30]">
                <span className="text-slate-400">Exit Execution Price:</span>
                <span className="text-slate-200 font-semibold">{formatCurrency(selectedTradeModal.exitPrice)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#161f30]">
                <span className="text-slate-400">Position Quantity:</span>
                <span className="text-slate-300">{selectedTradeModal.size}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#161f30]">
                <span className="text-slate-400">Notional Exposure:</span>
                <span className="text-slate-300">{formatCurrency(selectedTradeModal.notional)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#161f30]">
                <span className="text-slate-400">Net Realized PnL:</span>
                <span className={`font-bold text-sm ${getPnlTextColor(selectedTradeModal.netPnl)}`}>
                  {formatCurrency(selectedTradeModal.netPnl)} ({formatPercent(selectedTradeModal.pnlPercent)})
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#161f30]">
                <span className="text-slate-400">Exchange Fees Paid:</span>
                <span className="text-slate-300">${selectedTradeModal.fees.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#161f30]">
                <span className="text-slate-400">Funding Rate PnL:</span>
                <span className="text-slate-300">${selectedTradeModal.funding.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#161f30]">
                <span className="text-slate-400">Execution Slippage:</span>
                <span className="text-slate-300">{selectedTradeModal.slippageBps} bps</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#161f30]">
                <span className="text-slate-400">Exit Trigger Reason:</span>
                <span className="text-emerald-400 font-semibold">{selectedTradeModal.exitReason}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Max Adverse / Favorable Excursion:</span>
                <span className="text-slate-300">
                  MAE: <span className="text-rose-400">{selectedTradeModal.mae}%</span> · MFE:{' '}
                  <span className="text-emerald-400">+{selectedTradeModal.mfe}%</span>
                </span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[#1c2436] flex justify-end">
              <button
                onClick={() => setSelectedTradeModal(null)}
                className="px-3 py-1.5 rounded bg-[#162132] text-slate-200 hover:bg-[#1e2c44] text-xs font-medium"
              >
                Close Drilldown
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
