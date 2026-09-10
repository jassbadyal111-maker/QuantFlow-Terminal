import React, { useState } from 'react';
import { Strategy, StrategyType } from '../../types/backtest';
import {
  Code,
  Sliders,
  Play,
  Save,
  Copy,
  Plus,
  Trash2,
  Layers,
  Sparkles,
  GitBranch,
  BookOpen,
  Check,
  Zap,
} from 'lucide-react';

interface StrategyLabViewProps {
  strategies: Strategy[];
  selectedStrategyId: string;
  onSelectStrategy: (id: string) => void;
  onSaveStrategy: (updatedStrategy: Strategy) => void;
  onTestStrategy: (strategy: Strategy) => void;
}

interface RuleBlock {
  id: string;
  type: 'ENTRY_LONG' | 'ENTRY_SHORT' | 'EXIT_LONG' | 'EXIT_SHORT';
  indicator1: string;
  operator: 'CROSSES_ABOVE' | 'CROSSES_BELOW' | 'GREATER_THAN' | 'LESS_THAN' | 'DEVIATES_BY';
  indicator2: string;
  value?: number;
}

const AVAILABLE_INDICATORS = [
  { name: 'EMA (Exponential Moving Avg)', code: 'ema(period)', category: 'Trend' },
  { name: 'SMA (Simple Moving Avg)', code: 'sma(period)', category: 'Trend' },
  { name: 'RSI (Relative Strength Index)', code: 'rsi(14)', category: 'Momentum' },
  { name: 'ATR (Average True Range)', code: 'atr(14)', category: 'Volatility' },
  { name: 'Bollinger Bands (Upper/Lower)', code: 'bb_upper(20, 2.0)', category: 'Volatility' },
  { name: 'VWAP (Volume Weighted Avg Price)', code: 'vwap()', category: 'Volume' },
  { name: 'Orderbook Bid/Ask Imbalance', code: 'ob_imbalance(10)', category: 'Microstructure' },
  { name: 'Funding Rate (8h Basis)', code: 'funding_rate_8h()', category: 'Derivatives' },
  { name: 'Supertrend', code: 'supertrend(10, 3)', category: 'Trend' },
  { name: 'Z-Score Price Deviation', code: 'zscore(30)', category: 'Statistical' },
];

export const StrategyLabView: React.FC<StrategyLabViewProps> = ({
  strategies,
  selectedStrategyId,
  onSelectStrategy,
  onSaveStrategy,
  onTestStrategy,
}) => {
  const currentStrategy =
    strategies.find((s) => s.id === selectedStrategyId) || strategies[0];

  const [activeMode, setActiveMode] = useState<'visual' | 'code'>('visual');
  const [strategyCode, setStrategyCode] = useState(currentStrategy.code);
  const [copied, setCopied] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Visual Rule Blocks state
  const [rules, setRules] = useState<RuleBlock[]>([
    {
      id: 'r-1',
      type: 'ENTRY_LONG',
      indicator1: 'EMA(21)',
      operator: 'CROSSES_ABOVE',
      indicator2: 'EMA(55)',
    },
    {
      id: 'r-2',
      type: 'ENTRY_LONG',
      indicator1: 'RSI(14)',
      operator: 'LESS_THAN',
      indicator2: 'Fixed Value',
      value: 65,
    },
    {
      id: 'r-3',
      type: 'EXIT_LONG',
      indicator1: 'Close Price',
      operator: 'CROSSES_BELOW',
      indicator2: 'Trailing ATR(14) x 1.8',
    },
  ]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(strategyCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    onSaveStrategy({
      ...currentStrategy,
      code: strategyCode,
    });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const addRule = () => {
    const newRule: RuleBlock = {
      id: `r-${Date.now()}`,
      type: 'ENTRY_LONG',
      indicator1: 'EMA(21)',
      operator: 'GREATER_THAN',
      indicator2: 'EMA(55)',
    };
    setRules([...rules, newRule]);
  };

  const deleteRule = (id: string) => {
    setRules(rules.filter((r) => r.id !== id));
  };

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-4 font-sans select-none">
      {/* Top Header & Strategy Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0c111a] p-3 rounded border border-[#1b2436]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-[#162132] border border-[#24334c] flex items-center justify-center text-emerald-400">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold text-slate-100">{currentStrategy.name}</h1>
              <span className="text-[10px] font-mono-data px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                v{currentStrategy.version}
              </span>
              <span className="text-[10px] text-slate-400 font-mono-data">{currentStrategy.symbol} · {currentStrategy.timeframe}</span>
            </div>
            <p className="text-xs text-slate-400">{currentStrategy.description}</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Visual vs Code Toggle */}
          <div className="flex items-center bg-[#090d14] rounded border border-[#1a2333] p-0.5 text-xs">
            <button
              onClick={() => setActiveMode('visual')}
              className={`px-2.5 py-1 rounded font-medium transition-colors flex items-center gap-1.5 ${
                activeMode === 'visual'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sliders className="w-3 h-3" />
              <span>Visual Builder</span>
            </button>
            <button
              onClick={() => setActiveMode('code')}
              className={`px-2.5 py-1 rounded font-medium transition-colors flex items-center gap-1.5 ${
                activeMode === 'code'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Code className="w-3 h-3" />
              <span>Code Editor (TS/Python)</span>
            </button>
          </div>

          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#131b28] hover:bg-[#1a2538] text-slate-200 border border-[#223048] text-xs font-medium transition-colors"
          >
            {saveSuccess ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Save className="w-3.5 h-3.5" />}
            <span>{saveSuccess ? 'Saved' : 'Save Version'}</span>
          </button>

          <button
            onClick={() => onTestStrategy(currentStrategy)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors border border-emerald-400/30"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Send to Backtest</span>
          </button>
        </div>
      </div>

      {/* Main Workspace: 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Column: Visual Rule Builder / Code Editor */}
        <div className="lg:col-span-2 space-y-4">
          {activeMode === 'visual' ? (
            <div className="terminal-panel rounded border border-[#1c2436] bg-[#0b0f16] p-3.5 space-y-3">
              <div className="flex items-center justify-between border-b border-[#1c2436] pb-2">
                <div>
                  <h2 className="text-xs font-semibold text-slate-200">Execution Signal Rules & Condition Blocks</h2>
                  <p className="text-[11px] text-slate-400">
                    Define entry/exit logical conditions evaluated on each incoming bar or tick
                  </p>
                </div>
                <button
                  onClick={addRule}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 text-xs font-medium border border-emerald-500/30 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Condition Block</span>
                </button>
              </div>

              {/* Rules List */}
              <div className="space-y-2.5">
                {rules.map((rule, idx) => (
                  <div
                    key={rule.id}
                    className="flex flex-wrap items-center gap-2 p-2.5 rounded bg-[#0e1420] border border-[#1c273a] text-xs font-mono-data"
                  >
                    <span className="w-5 h-5 rounded bg-[#172132] text-slate-400 flex items-center justify-center text-[10px]">
                      {idx + 1}
                    </span>

                    {/* Action trigger type */}
                    <select
                      aria-label="Action Trigger Type"
                      value={rule.type}
                      onChange={(e) => {
                        const updated = rules.map((r) =>
                          r.id === rule.id ? { ...r, type: e.target.value as any } : r
                        );
                        setRules(updated);
                      }}
                      className="bg-[#121926] border border-[#1f2b40] text-emerald-400 font-bold rounded px-2 py-1 text-xs"
                    >
                      <option value="ENTRY_LONG">BUY LONG</option>
                      <option value="ENTRY_SHORT">SELL SHORT</option>
                      <option value="EXIT_LONG">EXIT LONG</option>
                      <option value="EXIT_SHORT">EXIT SHORT</option>
                    </select>

                    <span className="text-slate-400 text-[11px]">WHEN</span>

                    {/* Indicator 1 */}
                    <input
                      type="text"
                      aria-label="Indicator 1"
                      value={rule.indicator1}
                      onChange={(e) => {
                        const updated = rules.map((r) =>
                          r.id === rule.id ? { ...r, indicator1: e.target.value } : r
                        );
                        setRules(updated);
                      }}
                      className="bg-[#121926] border border-[#1f2b40] text-slate-200 rounded px-2 py-1 text-xs w-28"
                    />

                    {/* Operator */}
                    <select
                      aria-label="Condition Operator"
                      value={rule.operator}
                      onChange={(e) => {
                        const updated = rules.map((r) =>
                          r.id === rule.id ? { ...r, operator: e.target.value as any } : r
                        );
                        setRules(updated);
                      }}
                      className="bg-[#121926] border border-[#1f2b40] text-cyan-400 rounded px-2 py-1 text-xs"
                    >
                      <option value="CROSSES_ABOVE">Crosses Above</option>
                      <option value="CROSSES_BELOW">Crosses Below</option>
                      <option value="GREATER_THAN">&gt; (Greater Than)</option>
                      <option value="LESS_THAN">&lt; (Less Than)</option>
                      <option value="DEVIATES_BY">Deviates By &gt; 2σ</option>
                    </select>

                    {/* Indicator 2 or Value */}
                    <input
                      type="text"
                      aria-label="Indicator 2 or Value"
                      value={rule.indicator2}
                      onChange={(e) => {
                        const updated = rules.map((r) =>
                          r.id === rule.id ? { ...r, indicator2: e.target.value } : r
                        );
                        setRules(updated);
                      }}
                      className="bg-[#121926] border border-[#1f2b40] text-slate-200 rounded px-2 py-1 text-xs w-36"
                    />

                    {rule.value !== undefined && (
                      <input
                        type="number"
                        aria-label="Rule Numeric Value"
                        value={rule.value}
                        onChange={(e) => {
                          const updated = rules.map((r) =>
                            r.id === rule.id ? { ...r, value: Number(e.target.value) } : r
                          );
                          setRules(updated);
                        }}
                        className="bg-[#121926] border border-[#1f2b40] text-slate-200 rounded px-2 py-1 text-xs w-16"
                      />
                    )}

                    <button
                      onClick={() => deleteRule(rule.id)}
                      className="p-1 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 ml-auto"
                      title="Remove condition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Multi-Timeframe Confirmation Block */}
              <div className="p-3 rounded bg-[#0e1420] border border-[#1c273a] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-300">Multi-Timeframe Macro Trend Filter</span>
                  <span className="text-[10px] text-emerald-400 font-mono-data">ENABLED</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono-data">
                  <span className="text-slate-400">Trend Timeframe:</span>
                  <span className="px-1.5 py-0.5 rounded bg-[#162132] text-slate-200">1D Daily Chart</span>
                  <span className="text-slate-400">Condition:</span>
                  <span className="text-slate-200">Price &gt; EMA(200)</span>
                </div>
              </div>
            </div>
          ) : (
            /* CODE EDITOR MODE */
            <div className="terminal-panel rounded border border-[#1c2436] bg-[#0b0f16] overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b border-[#1c2436] bg-[#090d14] text-xs">
                <div className="flex items-center gap-2">
                  <Code className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="font-mono-data text-slate-300">Strategy.ts (ApexQuant SDK v4.2)</span>
                </div>
                <button
                  onClick={handleCopyCode}
                  className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200"
                >
                  <Copy className="w-3 h-3" />
                  <span>{copied ? 'Copied' : 'Copy Code'}</span>
                </button>
              </div>
              <textarea
                aria-label="Strategy Code Editor"
                value={strategyCode}
                onChange={(e) => setStrategyCode(e.target.value)}
                className="w-full h-96 bg-[#070a0f] text-emerald-400 font-mono-data text-xs p-3 leading-relaxed focus:outline-none resize-none"
                spellCheck={false}
              />
            </div>
          )}
        </div>

        {/* Right Column: Indicator Catalog & Version History */}
        <div className="space-y-4">
          {/* Indicator Catalog */}
          <div className="terminal-panel rounded border border-[#1c2436] bg-[#0b0f16] p-3 space-y-2">
            <div className="flex items-center justify-between border-b border-[#1c2436] pb-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
                <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                <span>Quantitative Indicator Catalog</span>
              </div>
            </div>

            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {AVAILABLE_INDICATORS.map((ind) => (
                <div
                  key={ind.name}
                  className="p-2 rounded bg-[#0e1420] border border-[#1a2436] hover:border-[#263750] transition-colors"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-200">{ind.name}</span>
                    <span className="text-[9px] px-1 rounded bg-[#162030] text-slate-400 font-mono-data">
                      {ind.category}
                    </span>
                  </div>
                  <div className="text-[10px] font-mono-data text-emerald-400/80 mt-0.5">
                    {ind.code}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Strategy Version History */}
          <div className="terminal-panel rounded border border-[#1c2436] bg-[#0b0f16] p-3 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200 border-b border-[#1c2436] pb-2">
              <GitBranch className="w-3.5 h-3.5 text-emerald-400" />
              <span>Version History & Audit Log</span>
            </div>

            <div className="space-y-2 text-xs font-mono-data">
              <div className="p-2 rounded bg-[#0e1420] border border-emerald-500/30">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-400">v2.4.1 (Current)</span>
                  <span className="text-[10px] text-slate-400">2025-02-28</span>
                </div>
                <div className="text-[11px] text-slate-300 mt-1">
                  Added volume surge threshold (1.35x) and trailing ATR stop loss.
                </div>
              </div>

              <div className="p-2 rounded bg-[#0e1420] border border-[#1a2436]">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-300">v2.3.0</span>
                  <span className="text-[10px] text-slate-400">2025-02-15</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Fixed slippage estimation under high volatility cascades.
                </div>
              </div>

              <div className="p-2 rounded bg-[#0e1420] border border-[#1a2436]">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-300">v2.0.0</span>
                  <span className="text-[10px] text-slate-400">2025-01-10</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Initial production deployment on Binance BTC/USDT.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
