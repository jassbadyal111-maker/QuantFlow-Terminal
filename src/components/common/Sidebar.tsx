import React from 'react';
import {
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
  ChevronLeft,
  ChevronRight,
  Terminal,
  Activity,
  Wifi,
} from 'lucide-react';
import { NavView } from '../../types/backtest';

interface SidebarProps {
  currentView?: NavView;
  activeView?: NavView;
  onSelectView?: (view: NavView) => void;
  onNavigate?: (view: NavView) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

interface NavItem {
  id: NavView;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  shortcut?: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, shortcut: '1' },
  { id: 'backtest', label: 'Backtest Workspace', icon: PlaySquare, badge: 'MAIN', shortcut: '2' },
  { id: 'strategies', label: 'Strategy Lab', icon: Binary, shortcut: '3' },
  { id: 'research', label: 'Research & Optimizer', icon: Cpu, badge: 'AI/MC', shortcut: '4' },
  { id: 'risk', label: 'Risk Terminal', icon: ShieldAlert, shortcut: '5' },
  { id: 'trades', label: 'Trade Explorer', icon: ArrowLeftRight, shortcut: '6' },
  { id: 'compare', label: 'Compare Models', icon: SplitSquareVertical, shortcut: '7' },
  { id: 'reports', label: 'Tear Sheet Reports', icon: FileText, shortcut: '8' },
  { id: 'market-data', label: 'Market Data', icon: CandlestickChart, shortcut: '9' },
  { id: 'settings', label: 'Engine Settings', icon: Settings, shortcut: '0' },
];

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  activeView,
  onSelectView,
  onNavigate,
  collapsed,
  onToggleCollapse,
}) => {
  const selectedView = activeView || currentView || 'dashboard';
  const handleSelect = onNavigate || onSelectView || (() => {});

  return (
    <aside
      className={`h-[calc(100vh-3.5rem)] border-r border-[#1a2232] bg-[#090d14] flex flex-col justify-between transition-all duration-200 select-none z-20 ${
        collapsed ? 'w-14' : 'w-56'
      }`}
    >
      {/* Top Nav List */}
      <div className="p-2 space-y-1 overflow-y-auto">
        <div className="px-2 py-1.5 text-[10px] font-mono-data tracking-wider uppercase text-slate-400 font-semibold flex items-center justify-between">
          {!collapsed && <span>Terminal Workspaces</span>}
          <button
            onClick={onToggleCollapse}
            className="p-1 rounded hover:bg-[#151d2c] text-slate-400 hover:text-slate-200 ml-auto"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
          </button>
        </div>

        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = selectedView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleSelect(item.id)}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded text-xs font-medium transition-all group ${
                isActive
                  ? 'bg-[#151f30] text-emerald-400 border border-emerald-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#0e1420] border border-transparent'
              }`}
              title={`${item.label} (${item.shortcut})`}
            >
              <Icon
                className={`w-4 h-4 shrink-0 transition-colors ${
                  isActive ? 'text-emerald-400' : 'text-slate-400 group-hover:text-slate-200'
                }`}
              />
              {!collapsed && (
                <div className="flex-1 flex items-center justify-between overflow-hidden">
                  <span className="truncate">{item.label}</span>
                  <div className="flex items-center gap-1 shrink-0 ml-1">
                    {item.badge && (
                      <span className="text-[9px] font-mono-data px-1 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {item.badge}
                      </span>
                    )}
                    {item.shortcut && (
                      <span className="hidden xl:inline text-[9px] font-mono-data text-slate-400">
                        ⌥{item.shortcut}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Terminal Footer Info */}
      <div className="p-2 border-t border-[#1a2232] bg-[#070a0f] text-[11px] font-mono-data space-y-1.5">
        {!collapsed ? (
          <>
            <div className="flex items-center justify-between text-slate-400 text-[10px]">
              <span className="flex items-center gap-1">
                <Wifi className="w-3 h-3 text-emerald-400" />
                <span>WS LATENCY</span>
              </span>
              <span className="text-emerald-400 font-bold">14ms</span>
            </div>
            <div className="flex items-center justify-between text-slate-400 text-[10px]">
              <span>PARQUET RAM</span>
              <span className="text-slate-300">1.4 GB / 8.0 GB</span>
            </div>
            <div className="flex items-center justify-between text-slate-400 text-[10px]">
              <span>ENGINE</span>
              <span className="text-emerald-400/80">SIM-ACTIVE</span>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-1.5 py-1" title="Engine: Online (14ms)">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span className="text-[9px] text-slate-400">14m</span>
          </div>
        )}
      </div>
    </aside>
  );
};
