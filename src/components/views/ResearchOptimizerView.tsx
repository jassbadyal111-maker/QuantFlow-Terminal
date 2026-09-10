import React, { useState } from 'react';
import {
  SAMPLE_HEATMAP_CELLS,
  SAMPLE_WALK_FORWARD,
  SAMPLE_REGIME_ANALYSIS,
  SAMPLE_MONTE_CARLO,
  SAMPLE_TRADES,
} from '../../data/mockQuantData';
import { OptimizationHeatmapCell } from '../../types/backtest';
import { ResearchEngine } from '../../research/ResearchEngine';
import {
  Cpu,
  Flame,
  GitCommit,
  TrendingUp,
  AlertTriangle,
  Layers,
  BarChart3,
  CheckCircle2,
  RefreshCw,
  Info,
} from 'lucide-react';
import { formatPercent, formatNumber, formatCurrency } from '../../utils/formatters';

export const ResearchOptimizerView: React.FC = () => {
  const [selectedCell, setSelectedCell] = useState<OptimizationHeatmapCell>(
    SAMPLE_HEATMAP_CELLS.find((c) => c.xValue === 21 && c.yValue === 2.0) || SAMPLE_HEATMAP_CELLS[12]
  );
  const [optimizerType, setOptimizerType] = useState<'GRID' | 'BAYESIAN' | 'GENETIC'>('GRID');
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [monteCarloResults, setMonteCarloResults] = useState(SAMPLE_MONTE_CARLO);

  // Group heatmap cells by unique X (Lookback / Fast EMA) and Y (Stop Loss ATR Multiplier)
  const xValues = [10, 15, 21, 30, 50];
  const yValues = [1.0, 1.5, 2.0, 2.5, 3.0];

  const getCellColor = (sharpe: number) => {
    if (sharpe >= 2.3) return 'bg-emerald-500 text-black font-bold';
    if (sharpe >= 2.0) return 'bg-emerald-600/80 text-white';
    if (sharpe >= 1.7) return 'bg-emerald-700/60 text-slate-100';
    if (sharpe >= 1.4) return 'bg-[#1e2a3c] text-slate-300';
    return 'bg-[#151c27] text-slate-400';
  };

  const handleRunOptimizer = () => {
    setIsOptimizing(true);
    setTimeout(() => {
      const mc = ResearchEngine.runMonteCarlo(SAMPLE_TRADES, 100000, 250);
      setMonteCarloResults(mc.percentiles);
      setIsOptimizing(false);
    }, 600);
  };

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-4 font-sans select-none">
      {/* Top Title & Optimizer Mode Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0c111a] p-3 rounded border border-[#1b2436]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-[#162132] border border-[#24334c] flex items-center justify-center text-emerald-400">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold text-slate-100">Quantitative Research & Strategy Optimizer</h1>
              <span className="text-[10px] font-mono-data px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/25">
                CROSS-VALIDATION ACTIVE
              </span>
              <span className="text-[10px] font-mono-data px-1.5 py-0.5 rounded font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/40">
                DEMO / SYNTHETIC DATA
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Parameter space search, 1,000-path Monte Carlo bootstrap, regime sensitivity, and overfitting bias check
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            aria-label="Optimization Engine Algorithm"
            value={optimizerType}
            onChange={(e) => setOptimizerType(e.target.value as any)}
            className="bg-[#0e1420] border border-[#1e2739] text-slate-200 rounded px-2.5 py-1.5 text-xs font-mono-data"
          >
            <option value="GRID">Exhaustive Grid Search (25 Iterations)</option>
            <option value="BAYESIAN">Bayesian Gaussian Process</option>
            <option value="GENETIC">Genetic Algorithm (Pop: 100)</option>
          </select>

          <button
            onClick={handleRunOptimizer}
            disabled={isOptimizing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors border border-emerald-400/30"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isOptimizing ? 'animate-spin' : ''}`} />
            <span>{isOptimizing ? 'Exploring Space...' : 'Run Parameter Sweep'}</span>
          </button>
        </div>
      </div>

      {/* OVERFITTING & BIAS WARNING BANNER */}
      <div className="p-3 rounded bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-xs">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <div className="font-semibold text-amber-400 flex items-center gap-2">
            <span>Deflated Sharpe Ratio (DSR) Audit: 94.2% Confidence</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono-data">
              LOW SNOOPING BIAS
            </span>
          </div>
          <p className="text-slate-300 text-[11px] mt-0.5 leading-relaxed">
            White's Reality Check and Harvey-Liu haircut penalization indicate strategy edge is statistically robust (p-value &lt; 0.01).
            In-sample to out-of-sample efficiency ratio across 4 rolling windows averages <strong className="text-white">86.2%</strong>.
          </p>
        </div>
      </div>

      {/* 2-Column Main Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 2D PARAMETER OPTIMIZATION HEATMAP */}
        <div className="terminal-panel rounded border border-[#1c2436] bg-[#0b0f16] p-3.5 space-y-3">
          <div className="flex items-center justify-between border-b border-[#1c2436] pb-2">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-400" />
              <h2 className="text-xs font-semibold text-slate-200">
                Sharpe Ratio Landscape Heatmap (Lookback vs SL ATR)
              </h2>
            </div>
            <span className="text-[10px] font-mono-data text-slate-400">Click any cell to inspect</span>
          </div>

          {/* 5x5 Heatmap Matrix Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-center text-xs font-mono-data">
              <thead>
                <tr>
                  <th className="p-2 text-left text-slate-400 text-[10px]">SL ATR \ EMA</th>
                  {xValues.map((x) => (
                    <th key={x} className="p-2 text-slate-300 font-semibold">
                      {x} bars
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {yValues.map((y) => (
                  <tr key={y}>
                    <td className="p-2 text-left font-semibold text-slate-400">{y.toFixed(1)}x ATR</td>
                    {xValues.map((x) => {
                      const cell = SAMPLE_HEATMAP_CELLS.find((c) => c.xValue === x && c.yValue === y);
                      if (!cell) return <td key={x}>-</td>;
                      const isSelected = selectedCell.xValue === x && selectedCell.yValue === y;

                      return (
                        <td key={x} className="p-1">
                          <button
                            onClick={() => setSelectedCell(cell)}
                            className={`w-full py-2.5 px-1 rounded text-xs transition-all cursor-pointer ${getCellColor(
                              cell.sharpe
                            )} ${
                              isSelected
                                ? 'ring-2 ring-emerald-300 ring-offset-1 ring-offset-[#090d14] scale-105 z-10'
                                : 'hover:opacity-90'
                            }`}
                            title={`EMA: ${x}, ATR: ${y} -> Sharpe ${cell.sharpe}`}
                          >
                            {cell.sharpe.toFixed(2)}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Selected Cell Parameters Card */}
          <div className="p-3 rounded bg-[#0e1420] border border-[#1a2333] flex items-center justify-between text-xs font-mono-data">
            <div>
              <div className="text-slate-400 text-[10px]">SELECTED PARAMETER SET</div>
              <div className="font-bold text-slate-100 text-sm">
                EMA Lookback: {selectedCell.xValue} · Stop Loss: {selectedCell.yValue}x ATR
              </div>
            </div>
            <div className="flex items-center gap-4 text-right">
              <div>
                <div className="text-[10px] text-slate-400">SHARPE</div>
                <div className="text-emerald-400 font-bold">{selectedCell.sharpe.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400">NET RETURN</div>
                <div className="text-slate-100 font-bold">+{selectedCell.returnPct}%</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400">MAX DD</div>
                <div className="text-rose-400 font-bold">{selectedCell.maxDd}%</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400">TRADES</div>
                <div className="text-slate-200">{selectedCell.trades}</div>
              </div>
            </div>
          </div>
        </div>

        {/* WALK-FORWARD ANALYSIS & OOS EFFICIENCY */}
        <div className="terminal-panel rounded border border-[#1c2436] bg-[#0b0f16] p-3.5 space-y-3">
          <div className="flex items-center justify-between border-b border-[#1c2436] pb-2">
            <div className="flex items-center gap-2">
              <GitCommit className="w-4 h-4 text-cyan-400" />
              <h2 className="text-xs font-semibold text-slate-200">
                Walk-Forward Analysis (In-Sample vs Out-of-Sample)
              </h2>
            </div>
            <span className="text-[10px] font-mono-data px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              WFE: 86.2%
            </span>
          </div>

          <p className="text-[11px] text-slate-400">
            Rolling 6-month train (In-Sample) and 6-month test (Out-of-Sample) forward validation blocks to detect curve-fitting.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono-data">
              <thead className="bg-[#0e1420] text-slate-400 border-b border-[#1c2436] text-[10px] uppercase">
                <tr>
                  <th className="py-2 px-2.5">Window Period</th>
                  <th className="py-2 px-2.5 text-right">In-Sample Return</th>
                  <th className="py-2 px-2.5 text-right">Out-of-Sample Return</th>
                  <th className="py-2 px-2.5 text-right">WFE Ratio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#172030]">
                {SAMPLE_WALK_FORWARD.map((wf) => (
                  <tr key={wf.window} className="hover:bg-[#121927]">
                    <td className="py-2 px-2.5 font-medium text-slate-200">{wf.window}</td>
                    <td className="py-2 px-2.5 text-right text-slate-300">+{wf.inSampleReturn}%</td>
                    <td className="py-2 px-2.5 text-right text-emerald-400 font-bold">+{wf.outOfSampleReturn}%</td>
                    <td className="py-2 px-2.5 text-right text-cyan-400 font-semibold">{wf.wfe}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* BOTTOM ROW: MONTE CARLO + REGIME ANALYSIS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* MONTE CARLO BOOTSTRAP */}
        <div className="terminal-panel rounded border border-[#1c2436] bg-[#0b0f16] p-3.5 space-y-3">
          <div className="flex items-center justify-between border-b border-[#1c2436] pb-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-emerald-400" />
              <h2 className="text-xs font-semibold text-slate-200">Monte Carlo Simulation (1,000 Resampled Paths)</h2>
            </div>
            <span className="text-[10px] font-mono-data text-slate-400">95% Confidence Band</span>
          </div>

          <div className="space-y-2">
            {monteCarloResults.map((mc) => (
              <div
                key={mc.percentile}
                className="p-2 rounded bg-[#0e1420] border border-[#1c273a] flex items-center justify-between text-xs font-mono-data"
              >
                <div className="text-slate-300">{mc.percentile}</div>
                <div className="flex items-center gap-4">
                  <span className="text-slate-400">Equity: {formatCurrency(mc.finalEquity, 0)}</span>
                  <span className="text-emerald-400 font-bold">+{mc.returnPct}%</span>
                  <span className="text-rose-400">Max DD: {mc.maxDd}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* REGIME BREAKDOWN */}
        <div className="terminal-panel rounded border border-[#1c2436] bg-[#0b0f16] p-3.5 space-y-3">
          <div className="flex items-center justify-between border-b border-[#1c2436] pb-2">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              <h2 className="text-xs font-semibold text-slate-200">Market Regime Performance Breakdown</h2>
            </div>
            <span className="text-[10px] font-mono-data text-slate-400">HMM 4-State Filter</span>
          </div>

          <div className="space-y-2">
            {SAMPLE_REGIME_ANALYSIS.map((reg) => (
              <div
                key={reg.regime}
                className="p-2 rounded bg-[#0e1420] border border-[#1c273a] flex items-center justify-between text-xs font-mono-data"
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-200">{reg.regime}</span>
                  <span className="text-[10px] text-slate-400">({reg.periodPct}% of time)</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-slate-400">Trades: {reg.trades}</span>
                  <span className="text-slate-300">WR: {reg.winRate}%</span>
                  <span className="text-slate-300">PF: {reg.profitFactor}</span>
                  <span className="text-emerald-400 font-bold">+{reg.returnPct}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
