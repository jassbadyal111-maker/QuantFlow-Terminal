import React, { useState } from 'react';
import { SAMPLE_RISK_METRICS } from '../../data/mockQuantData';
import {
  ShieldAlert,
  AlertTriangle,
  Zap,
  Activity,
  Flame,
  PieChart,
  Percent,
  TrendingDown,
  Info,
  CheckCircle,
} from 'lucide-react';
import {
  formatCurrency,
  formatPercent,
  formatCompactUSD,
  getPnlTextColor,
} from '../../utils/formatters';

export const RiskTerminalView: React.FC = () => {
  const risk = SAMPLE_RISK_METRICS;
  const [selectedScenario, setSelectedScenario] = useState(risk.stressScenarios[0]);
  const [customShockPct, setCustomShockPct] = useState(-25);

  const customLoss = (risk.grossExposure * (Math.abs(customShockPct) / 100) * (risk.netExposure / risk.grossExposure));
  const customLossPct = Number(((customLoss / 100000) * 100).toFixed(2));

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-4 font-sans select-none">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0c111a] p-3 rounded border border-[#1b2436]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-[#162132] border border-[#24334c] flex items-center justify-center text-rose-400">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold text-slate-100">Institutional Risk Management Terminal</h1>
              <span className="text-[10px] font-mono-data px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                REAL-TIME MONITOR
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Value at Risk (VaR/CVaR), multi-asset crypto correlation matrix, liquidation buffers, and historical stress tests
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono-data">
          <span className="text-slate-400">PORTFOLIO LEVERAGE:</span>
          <span className="px-2 py-1 rounded bg-[#162132] text-emerald-400 font-bold border border-[#24334c]">
            {risk.currentLeverage}x / 5.0x
          </span>
        </div>
      </div>

      {/* Top Row: Quantitative Risk Metric Blocks */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
        <div className="terminal-panel rounded p-3 border border-[#1c2436] bg-[#0b0f16]">
          <div className="text-[10px] text-slate-400 uppercase font-mono-data">Net Delta Exposure</div>
          <div className="text-base font-bold font-mono-data text-emerald-400 mt-1">
            {formatCurrency(risk.netExposure, 0)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 font-mono-data">Long Bias (76.5%)</div>
        </div>

        <div className="terminal-panel rounded p-3 border border-[#1c2436] bg-[#0b0f16]">
          <div className="text-[10px] text-slate-400 uppercase font-mono-data">Gross Notional</div>
          <div className="text-base font-bold font-mono-data text-slate-100 mt-1">
            {formatCurrency(risk.grossExposure, 0)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 font-mono-data">4 Active Positions</div>
        </div>

        <div className="terminal-panel rounded p-3 border border-[#1c2436] bg-[#0b0f16]">
          <div className="text-[10px] text-slate-400 uppercase font-mono-data">1-Day VaR (95%)</div>
          <div className="text-base font-bold font-mono-data text-rose-400 mt-1">
            {risk.var95_1D}%
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 font-mono-data">-$2,150 / day limit</div>
        </div>

        <div className="terminal-panel rounded p-3 border border-[#1c2436] bg-[#0b0f16]">
          <div className="text-[10px] text-slate-400 uppercase font-mono-data">1-Day VaR (99%)</div>
          <div className="text-base font-bold font-mono-data text-rose-400 mt-1">
            {risk.var99_1D}%
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 font-mono-data">CVaR: {risk.cvar99_1D}%</div>
        </div>

        <div className="terminal-panel rounded p-3 border border-[#1c2436] bg-[#0b0f16]">
          <div className="text-[10px] text-slate-400 uppercase font-mono-data">BTC Liq Distance</div>
          <div className="text-base font-bold font-mono-data text-emerald-400 mt-1">
            +{risk.liquidationDistancePct}%
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 font-mono-data">Liq Price: {formatCurrency(risk.liquidationPriceBtc, 0)}</div>
        </div>

        <div className="terminal-panel rounded p-3 border border-[#1c2436] bg-[#0b0f16]">
          <div className="text-[10px] text-slate-400 uppercase font-mono-data">Margin Cushion</div>
          <div className="text-base font-bold font-mono-data text-emerald-400 mt-1">
            58.4%
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 font-mono-data">Tier 1 Collateral</div>
        </div>
      </div>

      {/* Main Grid: Exposure Breakdown + Correlation Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ASSET EXPOSURE BY NOTIONAL */}
        <div className="terminal-panel rounded border border-[#1c2436] bg-[#0b0f16] p-3.5 space-y-3">
          <div className="flex items-center justify-between border-b border-[#1c2436] pb-2">
            <h2 className="text-xs font-semibold text-slate-200">Asset & Long / Short Notional Exposure</h2>
            <span className="text-[10px] font-mono-data text-slate-400">Mark-to-Market USD</span>
          </div>

          <div className="space-y-3">
            {risk.assetExposures.map((asset) => (
              <div key={asset.symbol} className="space-y-1 text-xs font-mono-data">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                        asset.side === 'LONG'
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : 'bg-rose-500/15 text-rose-400'
                      }`}
                    >
                      {asset.side}
                    </span>
                    <span className="font-semibold text-slate-200">{asset.symbol}</span>
                    <span className="text-slate-400 text-[10px]">Δ {asset.delta}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-300 font-bold">{formatCurrency(asset.notional, 0)}</span>
                    <span className="text-slate-400 w-12 text-right">{asset.pct}%</span>
                  </div>
                </div>

                {/* Visual Proportion Bar */}
                <div className="w-full bg-[#161f30] h-1.5 rounded overflow-hidden">
                  <div
                    className={`h-full ${asset.side === 'LONG' ? 'bg-emerald-500' : 'bg-rose-500'}`}
                    style={{ width: `${asset.pct}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>

          {/* Long/Short Balance Gauge */}
          <div className="p-3 rounded bg-[#0e1420] border border-[#1c273a] flex items-center justify-between text-xs font-mono-data">
            <div>
              <span className="text-slate-400">Total Long Exposure:</span>
              <span className="text-emerald-400 font-bold ml-1.5">$214,377.92 (88.2%)</span>
            </div>
            <div>
              <span className="text-slate-400">Total Short Exposure:</span>
              <span className="text-rose-400 font-bold ml-1.5">$28,600.00 (11.8%)</span>
            </div>
          </div>
        </div>

        {/* CRYPTO CORRELATION MATRIX */}
        <div className="terminal-panel rounded border border-[#1c2436] bg-[#0b0f16] p-3.5 space-y-3">
          <div className="flex items-center justify-between border-b border-[#1c2436] pb-2">
            <h2 className="text-xs font-semibold text-slate-200">90-Day Rolling Cross-Asset Correlation Matrix</h2>
            <span className="text-[10px] font-mono-data text-slate-400">Pearson Coefficient</span>
          </div>

          <p className="text-[11px] text-slate-400">
            High positive correlation (&gt; 0.80) signals tail co-dependence during systemic market liquidations.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-center text-xs font-mono-data">
              <thead>
                <tr>
                  <th className="p-2 text-left text-slate-400">Symbol</th>
                  {risk.correlationMatrix.symbols.map((sym) => (
                    <th key={sym} className="p-2 font-semibold text-slate-300">
                      {sym}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {risk.correlationMatrix.symbols.map((rowSym, rowIdx) => (
                  <tr key={rowSym} className="border-t border-[#182130]">
                    <td className="p-2 text-left font-semibold text-slate-300">{rowSym}</td>
                    {risk.correlationMatrix.matrix[rowIdx].map((corr, colIdx) => {
                      const isHigh = corr > 0.8 && rowIdx !== colIdx;
                      const isOne = rowIdx === colIdx;
                      return (
                        <td key={colIdx} className="p-1">
                          <div
                            className={`py-1.5 rounded text-xs ${
                              isOne
                                ? 'text-slate-500 bg-[#121927]'
                                : isHigh
                                ? 'bg-rose-500/20 text-rose-400 font-bold border border-rose-500/30'
                                : 'bg-[#151f30] text-slate-300'
                            }`}
                          >
                            {corr.toFixed(2)}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* HISTORICAL STRESS-TEST SCENARIOS & CRASH SIMULATOR */}
      <div className="terminal-panel rounded border border-[#1c2436] bg-[#0b0f16] p-3.5 space-y-3">
        <div className="flex items-center justify-between border-b border-[#1c2436] pb-2">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-rose-400" />
            <h2 className="text-xs font-semibold text-slate-200">
              Macro Stress-Test Scenarios & Flash Crash Impact
            </h2>
          </div>
          <span className="text-[10px] font-mono-data text-slate-400">Extreme Tail Risk Analysis</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {risk.stressScenarios.map((scen) => (
            <div
              key={scen.id}
              onClick={() => setSelectedScenario(scen)}
              className={`p-3 rounded border cursor-pointer transition-all ${
                selectedScenario.id === scen.id
                  ? 'bg-[#141d2c] border-emerald-500/50 shadow-md'
                  : 'bg-[#0d131f] border-[#1c2638] hover:border-[#2a3850]'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] font-mono-data">
                <span className="text-slate-400">{scen.date}</span>
                <span className="text-rose-400 font-bold">{scen.shockPct}%</span>
              </div>
              <div className="font-semibold text-slate-200 text-xs mt-1">{scen.name}</div>
              <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">{scen.description}</p>
              <div className="mt-2 pt-2 border-t border-[#1c273a] flex items-center justify-between text-xs font-mono-data">
                <span className="text-slate-400">Est. Portfolio Loss:</span>
                <span className="text-rose-400 font-bold">{formatCurrency(scen.portfolioLoss, 0)}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Custom Flash Crash Stress Simulator */}
        <div className="p-3 rounded bg-[#0e1420] border border-[#1c273a] space-y-2">
          <div className="flex items-center justify-between text-xs font-mono-data">
            <span className="font-semibold text-slate-200">Interactive Instant Shock Simulator</span>
            <span className="text-rose-400 font-bold">{customShockPct}% Immediate Crypto Drawdown</span>
          </div>

          <div className="flex items-center gap-4">
            <input
              type="range"
              min="-60"
              max="-5"
              step="1"
              value={customShockPct}
              onChange={(e) => setCustomShockPct(Number(e.target.value))}
              className="w-full accent-rose-500 h-1.5 bg-[#162030] rounded cursor-pointer"
            />
          </div>

          <div className="grid grid-cols-3 gap-3 pt-2 text-xs font-mono-data">
            <div className="p-2 rounded bg-[#090d14] border border-[#1a2333]">
              <div className="text-[10px] text-slate-400">ESTIMATED CAPITAL LOSS</div>
              <div className="text-rose-400 font-bold text-sm mt-0.5">-{formatCurrency(customLoss, 0)}</div>
            </div>
            <div className="p-2 rounded bg-[#090d14] border border-[#1a2333]">
              <div className="text-[10px] text-slate-400">EQUITY IMPACT</div>
              <div className="text-rose-400 font-bold text-sm mt-0.5">-{customLossPct}%</div>
            </div>
            <div className="p-2 rounded bg-[#090d14] border border-[#1a2333]">
              <div className="text-[10px] text-slate-400">LIQUIDATION CALL RISK</div>
              <div className="text-emerald-400 font-bold text-sm mt-0.5">SURVIVES (NO MARGIN CALL)</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
