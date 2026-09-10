import React, { useState, useEffect } from 'react';
import {
  Search,
  LayoutDashboard,
  PlaySquare,
  Binary,
  Cpu,
  ShieldAlert,
  ArrowLeftRight,
  SplitSquareVertical,
  FileText,
  CandlestickChart,
  Settings,
  Play,
  Download,
  Coins,
  X,
} from 'lucide-react';
import { NavView } from '../../types/backtest';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectView?: (view: NavView) => void;
  onNavigate?: (view: NavView) => void;
  onRunBacktest: () => void;
  onSelectAsset?: (asset: string) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onSelectView,
  onNavigate,
  onRunBacktest,
  onSelectAsset,
}) => {
  const navigateFn = onNavigate || onSelectView || (() => {});
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        isOpen ? onClose() : undefined;
      } else if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const actions = [
    {
      id: 'run-backtest',
      title: 'Run Backtest Simulation',
      subtitle: 'Execute full tick simulation on current parameters',
      icon: Play,
      category: 'Execution',
      action: () => {
        onRunBacktest();
        onClose();
      },
    },
    {
      id: 'view-dashboard',
      title: 'Go to Dashboard',
      subtitle: 'Portfolio equity curve and aggregate stats',
      icon: LayoutDashboard,
      category: 'Navigation',
      action: () => {
        navigateFn('dashboard');
        onClose();
      },
    },
    {
      id: 'view-backtest',
      title: 'Open Backtest Workspace',
      subtitle: 'Interactive candlestick charts, orders, logs',
      icon: PlaySquare,
      category: 'Navigation',
      action: () => {
        navigateFn('backtest');
        onClose();
      },
    },
    {
      id: 'view-strategies',
      title: 'Open Strategy Lab',
      subtitle: 'Visual builder and quantitative code editor',
      icon: Binary,
      category: 'Navigation',
      action: () => {
        navigateFn('strategies');
        onClose();
      },
    },
    {
      id: 'view-research',
      title: 'Open Research & Optimizer',
      subtitle: 'Heatmap, Monte Carlo, and walk-forward analysis',
      icon: Cpu,
      category: 'Navigation',
      action: () => {
        navigateFn('research');
        onClose();
      },
    },
    {
      id: 'view-risk',
      title: 'Open Risk Terminal',
      subtitle: 'VaR, liquidation distances, stress scenarios',
      icon: ShieldAlert,
      category: 'Navigation',
      action: () => {
        navigateFn('risk');
        onClose();
      },
    },
    {
      id: 'view-trades',
      title: 'Open Trade Explorer',
      subtitle: 'Trade execution logs, slippage, MAE/MFE',
      icon: ArrowLeftRight,
      category: 'Navigation',
      action: () => {
        navigateFn('trades');
        onClose();
      },
    },
    {
      id: 'view-reports',
      title: 'View Institutional Tear Sheet',
      subtitle: 'Export performance report for fund committee',
      icon: FileText,
      category: 'Reports',
      action: () => {
        navigateFn('reports');
        onClose();
      },
    },
    {
      id: 'asset-btc',
      title: 'Switch to BTC/USDT Perpetual',
      subtitle: 'Binance Futures BTC/USDT',
      icon: Coins,
      category: 'Assets',
      action: () => {
        onSelectAsset?.('BTC/USDT');
        onClose();
      },
    },
    {
      id: 'asset-eth',
      title: 'Switch to ETH/USDT Perpetual',
      subtitle: 'Binance Futures ETH/USDT',
      icon: Coins,
      category: 'Assets',
      action: () => {
        onSelectAsset?.('ETH/USDT');
        onClose();
      },
    },
    {
      id: 'asset-sol',
      title: 'Switch to SOL/USDT Perpetual',
      subtitle: 'Binance Futures SOL/USDT',
      icon: Coins,
      category: 'Assets',
      action: () => {
        onSelectAsset?.('SOL/USDT');
        onClose();
      },
    },
  ];

  const filtered = actions.filter(
    (a) =>
      a.title.toLowerCase().includes(query.toLowerCase()) ||
      a.subtitle.toLowerCase().includes(query.toLowerCase()) ||
      a.category.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-start justify-center pt-20 z-50 p-4">
      <div className="w-full max-w-xl bg-[#0e131d] border border-[#222d42] rounded-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
        {/* Search Bar */}
        <div className="flex items-center px-3.5 py-3 border-b border-[#1c2436] bg-[#0a0e16]">
          <Search className="w-4 h-4 text-emerald-400 mr-2.5 shrink-0" />
          <input
            type="text"
            placeholder="Type a command, asset, or strategy workspace (e.g. 'run', 'risk', 'BTC')..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none font-sans"
          />
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-200 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-1.5 space-y-0.5 font-sans">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500 font-mono-data">
              No matching commands found. Try searching for "backtest", "risk", or "ETH".
            </div>
          ) : (
            filtered.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={item.action}
                  className="w-full flex items-center justify-between px-3 py-2 rounded hover:bg-[#161f30] text-left transition-colors group cursor-pointer border border-transparent hover:border-[#223048]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded bg-[#131b29] border border-[#1f293d] flex items-center justify-center text-slate-400 group-hover:text-emerald-400 group-hover:border-emerald-500/40">
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="text-xs font-medium text-slate-200 group-hover:text-white">
                        {item.title}
                      </div>
                      <div className="text-[11px] text-slate-400">{item.subtitle}</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono-data px-1.5 py-0.5 rounded bg-[#121824] text-slate-400 border border-[#1c2436]">
                    {item.category}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-3.5 py-2 border-t border-[#1c2436] bg-[#080b11] flex items-center justify-between text-[11px] font-mono-data text-slate-400">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="px-1 py-0.2 bg-[#141b28] rounded border border-[#202a3f]">↑↓</kbd> Navigate
            </span>
            <span>
              <kbd className="px-1 py-0.2 bg-[#141b28] rounded border border-[#202a3f]">Enter</kbd> Execute
            </span>
            <span>
              <kbd className="px-1 py-0.2 bg-[#141b28] rounded border border-[#202a3f]">ESC</kbd> Close
            </span>
          </div>
          <span className="text-emerald-400">ApexQuant Command Suite</span>
        </div>
      </div>
    </div>
  );
};
