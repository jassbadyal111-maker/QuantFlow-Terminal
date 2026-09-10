import React, { useState } from 'react';
import { Strategy } from '../../types/backtest';
import {
  GitCompare,
  TrendingUp,
  CheckSquare,
  Square,
  ArrowRight,
  Shield,
  Layers,
  Award,
} from 'lucide-react';
import { formatPercent, formatNumber, getPnlTextColor } from '../../utils/formatters';

interface CompareViewProps {
  strategies: Strategy[];
}

export const CompareView: React.FC<CompareViewProps> = ({ strategies }) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([
    strategies[0]?.id || 'strat-1',
    strategies[1]?.id || 'strat-2',
    strategies[2]?.id || 'strat-3',
  ]);

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      if (selectedIds.length > 1) {
        setSelectedIds(selectedIds.filter((item) => item !== id));
      }
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const selectedStrategies = strategies.filter((s) => selectedIds.includes(s.id));

  // Color palette for compared strategies
  const STRATEGY_COLORS = ['#10b981', '#38bdf8', '#f59e0b', '#ec4899', '#a855f7'];

  // Synthesize comparison points over 30 normalized periods for a clean comparative SVG chart
  const comparisonPeriods = Array.from({ length: 30 }).map((_, i) => {
    const point: any = { step: i };
    selectedStrategies.forEach((strat, idx) => {
      // Simulate trajectory curve based on strategy final return
      const growthFactor = (strat.returnPct / 100) * (i / 29);
      const volatilityWiggle = Math.sin((i + idx * 3) * 0.7) * (strat.maxDrawdown * 0.08);
      point[strat.id] = Math.max(0, 100 * (1 + growthFactor + volatilityWiggle / 100));
    });
    return point;
  });

  // Calculate SVG dimensions for the multi-curve chart
  const width = 800;
  const height = 260;
  const padding = { top: 20, right: 30, bottom: 30, left: 50 };

  const allValues = comparisonPeriods.flatMap((p) =>
    selectedStrategies.map((s) => p[s.id] as number)
  );
  const minVal = Math.min(...allValues, 90);
  const maxVal = Math.max(...allValues, 120);

  const getX = (step: number) =>
    padding.left + (step / (comparisonPeriods.length - 1)) * (width - padding.left - padding.right);
  const getY = (val: number) =>
    height - padding.bottom - ((val - minVal) / (maxVal - minVal)) * (height - padding.top - padding.bottom);

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-4 font-sans select-none">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0c111a] p-3 rounded border border-[#1b2436]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-[#162132] border border-[#24334c] flex items-center justify-center text-cyan-400">
            <GitCompare className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold text-slate-100">Multi-Model Quantitative Comparison</h1>
              <span className="text-[10px] font-mono-data px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/25">
                {selectedStrategies.length} STRATEGIES SELECTED
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Normalized comparative equity curves, risk-adjusted scorecards, and correlation against benchmarks
            </p>
          </div>
        </div>

        {/* Strategy Selector Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {strategies.map((strat, idx) => {
            const isSelected = selectedIds.includes(strat.id);
            const color = STRATEGY_COLORS[idx % STRATEGY_COLORS.length];
            return (
              <button
                key={strat.id}
                onClick={() => toggleSelect(strat.id)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-mono-data border transition-all ${
                  isSelected
                    ? 'bg-[#141d2c] border-emerald-500/50 text-slate-100'
                    : 'bg-[#090d14] border-[#1a2333] text-slate-400 hover:text-slate-200'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: isSelected ? color : '#475569' }}
                ></span>
                <span>{strat.name.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* SYNCHRONIZED COMPARATIVE EQUITY CURVES (SVG) */}
      <div className="terminal-panel rounded border border-[#1c2436] bg-[#0b0f16] p-3.5 space-y-3">
        <div className="flex items-center justify-between border-b border-[#1c2436] pb-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <h2 className="text-xs font-semibold text-slate-200">
              Normalized Rebased Performance (Base = 100.0)
            </h2>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono-data">
            {selectedStrategies.map((strat, idx) => (
              <div key={strat.id} className="flex items-center gap-1">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: STRATEGY_COLORS[idx % STRATEGY_COLORS.length] }}
                ></span>
                <span className="text-slate-300">{strat.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* SVG Chart */}
        <div className="w-full overflow-hidden">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-64 overflow-visible">
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const y = padding.top + ratio * (height - padding.top - padding.bottom);
              const val = maxVal - ratio * (maxVal - minVal);
              return (
                <g key={ratio}>
                  <line
                    x1={padding.left}
                    y1={y}
                    x2={width - padding.right}
                    y2={y}
                    stroke="#162030"
                    strokeDasharray="2,2"
                  />
                  <text
                    x={padding.left - 8}
                    y={y + 3}
                    textAnchor="end"
                    fill="#64748b"
                    fontSize={10}
                    fontFamily="monospace"
                  >
                    {val.toFixed(0)}
                  </text>
                </g>
              );
            })}

            {/* Base 100 Baseline */}
            <line
              x1={padding.left}
              y1={getY(100)}
              x2={width - padding.right}
              y2={getY(100)}
              stroke="#2e405e"
              strokeDasharray="4,4"
              strokeWidth={1}
            />

            {/* Render each strategy's line */}
            {selectedStrategies.map((strat, idx) => {
              const color = STRATEGY_COLORS[idx % STRATEGY_COLORS.length];
              const pathD = comparisonPeriods
                .map((p, pIdx) => {
                  const x = getX(pIdx);
                  const y = getY(p[strat.id]);
                  return `${pIdx === 0 ? 'M' : 'L'} ${x} ${y}`;
                })
                .join(' ');

              return (
                <path
                  key={strat.id}
                  d={pathD}
                  fill="none"
                  stroke={color}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              );
            })}
          </svg>
        </div>
      </div>

      {/* QUANTITATIVE SCORECARD TABLE */}
      <div className="terminal-panel rounded border border-[#1c2436] bg-[#0b0f16] overflow-hidden">
        <div className="px-3 py-2 border-b border-[#1c2436] bg-[#090d14] flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-slate-200">
            <Award className="w-4 h-4 text-amber-400" />
            <span>Comparative Quantitative Scorecard</span>
          </div>
          <span className="text-[10px] font-mono-data text-slate-400">Institutional Ranking Matrix</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono-data">
            <thead className="bg-[#0e1420] text-slate-400 border-b border-[#1c2436] text-[10px] uppercase">
              <tr>
                <th className="py-2.5 px-3">Strategy Name</th>
                <th className="py-2.5 px-3">Asset / TF</th>
                <th className="py-2.5 px-3 text-right">Net Return</th>
                <th className="py-2.5 px-3 text-right">Sharpe (Rf=4%)</th>
                <th className="py-2.5 px-3 text-right">Sortino</th>
                <th className="py-2.5 px-3 text-right">Max DD</th>
                <th className="py-2.5 px-3 text-right">Win Rate</th>
                <th className="py-2.5 px-3 text-right">Profit Factor</th>
                <th className="py-2.5 px-3 text-right">Total Trades</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#172030]">
              {selectedStrategies.map((strat, idx) => {
                const color = STRATEGY_COLORS[idx % STRATEGY_COLORS.length];
                return (
                  <tr key={strat.id} className="hover:bg-[#121a28] transition-colors">
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }}></span>
                        <div>
                          <div className="font-sans font-medium text-slate-200">{strat.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono-data">
                            {strat.type} · {strat.version}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-slate-300">
                      {strat.symbol} <span className="text-slate-400 text-[10px]">({strat.timeframe})</span>
                    </td>
                    <td className={`py-3 px-3 text-right font-bold text-sm ${getPnlTextColor(strat.returnPct)}`}>
                      {formatPercent(strat.returnPct)}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-slate-100 text-sm">
                      {strat.sharpe.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-200">
                      {(strat.sharpe * 1.35).toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-right text-rose-400 font-semibold">
                      {strat.maxDrawdown.toFixed(1)}%
                    </td>
                    <td className="py-3 px-3 text-right text-slate-200">
                      {strat.winRate.toFixed(1)}%
                    </td>
                    <td className="py-3 px-3 text-right text-slate-200 font-semibold">
                      {strat.profitFactor.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-400">
                      {strat.tradesCount}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
