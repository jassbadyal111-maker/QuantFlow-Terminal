import React, { useState } from 'react';
import { Settings as SettingsIcon, Save, Check, RefreshCw, Server, Shield, Cpu } from 'lucide-react';

export const SettingsView: React.FC = () => {
  const [exchangeVipTier, setExchangeVipTier] = useState('VIP_3');
  const [latencyMs, setLatencyMs] = useState(15);
  const [marketImpactAlpha, setMarketImpactAlpha] = useState(0.1);
  const [maxPositionRiskPct, setMaxPositionRiskPct] = useState(10.0);
  const [maxDrawdownKillSwitch, setMaxDrawdownKillSwitch] = useState(15.0);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSave = () => {
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-4 font-sans select-none">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0c111a] p-3 rounded border border-[#1b2436]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-[#162132] border border-[#24334c] flex items-center justify-center text-slate-300">
            <SettingsIcon className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-slate-100">Terminal Engine &amp; Exchange Settings</h1>
            <p className="text-xs text-slate-400">
              Configure institutional commission tiers, network order latency, and circuit breaker risk policies
            </p>
          </div>
        </div>

        <button
          onClick={handleSave}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors border border-emerald-400/30"
        >
          {saveSuccess ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
          <span>{saveSuccess ? 'Saved' : 'Save Engine Settings'}</span>
        </button>
      </div>

      {/* Settings Sections */}
      <div className="space-y-4">
        {/* Exchange Commission Tiers */}
        <div className="terminal-panel rounded border border-[#1c2436] bg-[#0b0f16] p-4 space-y-3">
          <div className="flex items-center gap-2 border-b border-[#1c2436] pb-2 text-xs font-semibold text-slate-200">
            <Server className="w-4 h-4 text-emerald-400" />
            <span>Exchange Fee Schedule &amp; VIP Tier</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono-data">
            <div className="space-y-1.5">
              <label className="text-slate-400">Exchange Tier Presets</label>
              <select
                aria-label="Exchange Tier Presets"
                value={exchangeVipTier}
                onChange={(e) => setExchangeVipTier(e.target.value)}
                className="w-full bg-[#0e1420] border border-[#1e2739] text-slate-200 rounded px-2.5 py-1.5"
              >
                <option value="VIP_0">Binance VIP 0 (Maker: 2.0 bps / Taker: 4.0 bps)</option>
                <option value="VIP_1">Binance VIP 1 (Maker: 1.6 bps / Taker: 3.5 bps)</option>
                <option value="VIP_3">Binance VIP 3 (Maker: 1.2 bps / Taker: 3.0 bps) - Recommended</option>
                <option value="VIP_5">Binance VIP 5 (Maker: 0.8 bps / Taker: 2.4 bps)</option>
                <option value="VIP_9">Binance VIP 9 Institutional (Maker: 0.0 bps / Taker: 1.7 bps)</option>
                <option value="CUSTOM">Custom Desk Tier</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-400">Network Colocation / Latency (ms)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  aria-label="Network Colocation / Latency (ms)"
                  value={latencyMs}
                  onChange={(e) => setLatencyMs(Number(e.target.value))}
                  className="bg-[#0e1420] border border-[#1e2739] text-slate-200 rounded px-2.5 py-1.5 w-32"
                />
                <span className="text-slate-500 text-[11px]">(AWS Tokyo / Tokyo Cross-connect)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Microstructure & Slippage Models */}
        <div className="terminal-panel rounded border border-[#1c2436] bg-[#0b0f16] p-4 space-y-3">
          <div className="flex items-center gap-2 border-b border-[#1c2436] pb-2 text-xs font-semibold text-slate-200">
            <Cpu className="w-4 h-4 text-cyan-400" />
            <span>Slippage &amp; Market Impact Engine</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono-data">
            <div className="space-y-1.5">
              <label className="text-slate-400">Orderbook Impact Exponent (α)</label>
              <input
                type="number"
                step="0.01"
                aria-label="Orderbook Impact Exponent"
                value={marketImpactAlpha}
                onChange={(e) => setMarketImpactAlpha(Number(e.target.value))}
                className="w-full bg-[#0e1420] border border-[#1e2739] text-slate-200 rounded px-2.5 py-1.5"
              />
              <span className="text-[10px] text-slate-500">
                Almgren-Chriss market impact formulation for large notional parent orders
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-400">Funding Rate Basis Simulation</label>
              <select
                aria-label="Funding Rate Basis Simulation"
                defaultValue="HISTORICAL_ACTUAL"
                className="w-full bg-[#0e1420] border border-[#1e2739] text-slate-200 rounded px-2.5 py-1.5"
              >
                <option value="HISTORICAL_ACTUAL">Historical Binance 8h Actual Rates</option>
                <option value="FLAT_10BPS">Constant +10 bps / day benchmark</option>
                <option value="ZERO_FEE">Zero Funding (Spot simulation)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Circuit Breakers & Risk Limits */}
        <div className="terminal-panel rounded border border-[#1c2436] bg-[#0b0f16] p-4 space-y-3">
          <div className="flex items-center gap-2 border-b border-[#1c2436] pb-2 text-xs font-semibold text-slate-200">
            <Shield className="w-4 h-4 text-rose-400" />
            <span>Circuit Breakers &amp; Firm Hard Limits</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono-data">
            <div className="space-y-1.5">
              <label className="text-slate-400">Max Single Position Exposure (% of Equity)</label>
              <input
                type="number"
                step="1"
                aria-label="Max Single Position Exposure"
                value={maxPositionRiskPct}
                onChange={(e) => setMaxPositionRiskPct(Number(e.target.value))}
                className="w-full bg-[#0e1420] border border-[#1e2739] text-slate-200 rounded px-2.5 py-1.5"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-400">Emergency Kill-Switch Drawdown (%)</label>
              <input
                type="number"
                step="1"
                aria-label="Emergency Kill-Switch Drawdown"
                value={maxDrawdownKillSwitch}
                onChange={(e) => setMaxDrawdownKillSwitch(Number(e.target.value))}
                className="w-full bg-[#0e1420] border border-[#1e2739] text-rose-400 font-bold rounded px-2.5 py-1.5"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
