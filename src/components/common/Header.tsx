import React from 'react';
import {
  Play,
  Square,
  Search,
  SlidersHorizontal,
  ChevronDown,
  Database,
  Activity,
  Layers,
  Sparkles,
  Zap,
} from 'lucide-react';
import { BacktestConfig } from '../../types/backtest';

interface HeaderProps {
  config: BacktestConfig;
  onConfigChange: (newConfig: Partial<BacktestConfig>) => void;
  isRunning: boolean;
  progress: number;
  statusMessage: string;
  onRunBacktest: () => void;
  onStopBacktest: () => void;
  onOpenCommandPalette: () => void;
}

const EXCHANGES = ['Binance Futures', 'Bybit Perp', 'OKX Swap', 'Deribit', 'Coinbase Prime'];
const ASSETS = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'AVAX/USDT', 'DOGE/USDT'];
const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1d'];
const DATE_PRESETS: ('3M' | '6M' | '1Y' | '3Y' | 'ALL')[] = ['3M', '6M', '1Y', '3Y', 'ALL'];

export const Header: React.FC<HeaderProps> = ({
  config,
  onConfigChange,
  isRunning,
  progress,
  statusMessage,
  onRunBacktest,
  onStopBacktest,
  onOpenCommandPalette,
}) => {
  return (
    <header className="h-14 border-b border-[#1c2436] bg-[#090d14] flex items-center justify-between px-3 text-xs select-none sticky top-0 z-30 font-sans">
      {/* Left: Workspace & Strategy context */}
      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-2 pr-3 border-r border-[#1c2436]">
          <div className="w-7 h-7 rounded bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-mono-data font-bold text-xs">
            AQ
          </div>
          <div>
            <div className="flex items-center gap-1.5 font-semibold text-slate-200 tracking-tight text-[13px]">
              <span>ApexQuant</span>
              <span className="text-[10px] uppercase tracking-wider px-1 py-0.2 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                PRO TERMINAL
              </span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono-data">v4.2.1 · Tick Engine</div>
          </div>
        </div>

        {/* Project Selector */}
        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#0f1522] border border-[#1e2739] hover:border-[#2d3a52] cursor-pointer">
          <Layers className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-300 font-medium">Alpha Fund #4</span>
          <ChevronDown className="w-3 h-3 text-slate-400" />
        </div>

        {/* Exchange Selector */}
        <div className="flex items-center gap-1">
          <select
            aria-label="Exchange Selector"
            value={config.exchange}
            onChange={(e) => onConfigChange({ exchange: e.target.value })}
            className="bg-[#0f1522] border border-[#1e2739] hover:border-[#2d3a52] text-slate-300 rounded px-2 py-1 text-xs cursor-pointer focus:outline-none focus:border-emerald-500/50"
          >
            {EXCHANGES.map((ex) => (
              <option key={ex} value={ex}>
                {ex}
              </option>
            ))}
          </select>
        </div>

        {/* Asset Selector */}
        <div className="flex items-center gap-1">
          <select
            aria-label="Asset Selector"
            value={config.symbol}
            onChange={(e) => onConfigChange({ symbol: e.target.value })}
            className="bg-[#0f1522] border border-[#1e2739] hover:border-[#2d3a52] text-emerald-400 font-mono-data font-semibold rounded px-2 py-1 text-xs cursor-pointer focus:outline-none focus:border-emerald-500/50"
          >
            {ASSETS.map((asset) => (
              <option key={asset} value={asset}>
                {asset}
              </option>
            ))}
          </select>
        </div>

        {/* Timeframe selector */}
        <div className="flex items-center bg-[#0b0f17] rounded border border-[#1c2436] p-0.5">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              onClick={() => onConfigChange({ timeframe: tf as BacktestConfig['timeframe'] })}
              className={`px-1.5 py-0.5 rounded text-[11px] font-mono-data font-medium transition-colors ${
                config.timeframe === tf
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>

        {/* Date Presets */}
        <div className="hidden lg:flex items-center bg-[#0b0f17] rounded border border-[#1c2436] p-0.5">
          {DATE_PRESETS.map((preset) => (
            <button
              key={preset}
              onClick={() =>
                onConfigChange({
                  dateRange: { ...config.dateRange, preset },
                })
              }
              className={`px-1.5 py-0.5 rounded text-[11px] font-mono-data transition-colors ${
                config.dateRange.preset === preset
                  ? 'bg-[#1c2638] text-slate-200 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {preset}
            </button>
          ))}
        </div>
      </div>

      {/* Right: Data Cache Status + Backtest Action Controls + Command Palette */}
      <div className="flex items-center gap-2.5">
        {/* Command Palette Trigger */}
        <button
          onClick={onOpenCommandPalette}
          className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#0f1522] border border-[#1e2739] text-slate-400 hover:text-slate-200 hover:border-[#2d3a52] transition-colors"
          title="Open Command Palette (⌘K)"
        >
          <Search className="w-3.5 h-3.5" />
          <span className="hidden md:inline text-[11px]">Command Palette</span>
          <kbd className="hidden sm:inline-block px-1 py-0.2 text-[9px] font-mono-data bg-[#161f30] text-slate-400 rounded border border-[#232f48]">
            ⌘K
          </kbd>
        </button>

        {/* Data Status Indicator */}
        <div className="hidden xl:flex items-center gap-1.5 px-2 py-1 rounded bg-[#0f1522] border border-[#1e2739] text-[11px]">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <Database className="w-3 h-3 text-slate-400" />
          <span className="text-slate-300 font-mono-data">Tick L2 Cache</span>
          <span className="text-[10px] px-1 py-0.2 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
            DEMO DATA
          </span>
        </div>

        {/* Backtest Execution Controls */}
        <div className="flex items-center gap-1.5">
          {isRunning ? (
            <div className="flex items-center gap-2 bg-[#121926] border border-[#1e2739] rounded px-2.5 py-1">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
                <div className="text-[11px] font-mono-data text-emerald-400">
                  {progress}% <span className="text-slate-400 text-[10px] hidden sm:inline">({statusMessage})</span>
                </div>
              </div>
              <button
                onClick={onStopBacktest}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 border border-rose-500/40 text-[11px]"
                title="Halt Backtest Engine"
              >
                <Square className="w-2.5 h-2.5 fill-current" />
                <span>Stop</span>
              </button>
            </div>
          ) : (
            <button
              onClick={onRunBacktest}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-sm transition-colors text-xs cursor-pointer border border-emerald-400/30"
              title="Execute Quantitative Backtest (⌘R)"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Run Backtest</span>
              <kbd className="hidden sm:inline-block px-1 py-0.2 text-[9px] font-mono-data bg-emerald-800 text-emerald-100 rounded">
                ⌘R
              </kbd>
            </button>
          )}
        </div>

        {/* User / Quant Desk Badge */}
        <div className="flex items-center gap-2 pl-2 border-l border-[#1c2436]">
          <div className="w-7 h-7 rounded-full bg-[#182233] border border-[#283750] flex items-center justify-center text-slate-300 font-mono-data text-[11px] font-semibold">
            QD
          </div>
          <div className="hidden lg:block text-left leading-tight">
            <div className="text-[11px] font-medium text-slate-300">Desk #1 Alpha</div>
            <div className="text-[9px] text-emerald-400 font-mono-data">PRO ACC · VIP 9</div>
          </div>
        </div>
      </div>
    </header>
  );
};
