import React, { useState, useEffect, useCallback, useTransition } from 'react';
import {
  NavView,
  BacktestConfig,
  BacktestResult,
  Strategy,
  Trade,
} from './types/backtest';
import {
  DEFAULT_BACKTEST_CONFIG,
  SAMPLE_STRATEGIES,
  SAMPLE_RISK_METRICS,
} from './data/mockQuantData';
import { runSimulatedBacktest } from './services/backtestEngine';

import { Sidebar } from './components/common/Sidebar';
import { Header } from './components/common/Header';
import { CommandPalette } from './components/common/CommandPalette';

import { DashboardView } from './components/views/DashboardView';
import { BacktestView } from './components/views/BacktestView';
import { StrategyLabView } from './components/views/StrategyLabView';
import { ResearchOptimizerView } from './components/views/ResearchOptimizerView';
import { RiskTerminalView } from './components/views/RiskTerminalView';
import { TradeExplorerView } from './components/views/TradeExplorerView';
import { CompareView } from './components/views/CompareView';
import { MarketDataView } from './components/views/MarketDataView';
import { ReportsView } from './components/views/ReportsView';
import { SettingsView } from './components/views/SettingsView';

export default function App() {
  const [activeView, setActiveView] = useState<NavView>('dashboard');
  const [strategies, setStrategies] = useState<Strategy[]>(SAMPLE_STRATEGIES);
  const [config, setConfig] = useState<BacktestConfig>(DEFAULT_BACKTEST_CONFIG);

  // Simulation execution state
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(100);
  const [statusMessage, setStatusMessage] = useState('Simulation Ready');
  const [backtestResult, setBacktestResult] = useState<BacktestResult>(() =>
    runSimulatedBacktest(DEFAULT_BACKTEST_CONFIG)
  );

  // UI modal / drawer state
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Update backtest when strategy selector changes
  const handleStrategyChange = (stratId: string) => {
    const selected = strategies.find((s) => s.id === stratId);
    if (selected) {
      const updatedConfig: BacktestConfig = {
        ...config,
        strategyId: stratId,
        symbol: selected.symbol,
        timeframe: selected.timeframe,
      };
      setConfig(updatedConfig);
      const res = runSimulatedBacktest(updatedConfig);
      setBacktestResult(res);
    }
  };

  // Run backtest simulation with realistic progress ticks
  const handleRunBacktest = useCallback(() => {
    if (isRunning) return;
    setIsRunning(true);
    setProgress(5);
    setStatusMessage('Loading historical orderbook & tick archives...');

    const step1 = setTimeout(() => {
      setProgress(35);
      setStatusMessage('Executing bar-by-bar matching engine & signal generator...');
    }, 300);

    const step2 = setTimeout(() => {
      setProgress(75);
      setStatusMessage('Simulating execution slippage, funding fees & margin calls...');
    }, 700);

    const step3 = setTimeout(() => {
      const freshResult = runSimulatedBacktest(config);
      setBacktestResult(freshResult);
      setProgress(100);
      setStatusMessage('Backtest Execution Complete');
      setIsRunning(false);
    }, 1100);

    return () => {
      clearTimeout(step1);
      clearTimeout(step2);
      clearTimeout(step3);
    };
  }, [config, isRunning]);

  const handleStopBacktest = () => {
    setIsRunning(false);
    setStatusMessage('Execution halted by user');
  };

  const handleConfigChange = (newConfig: Partial<BacktestConfig>) => {
    const merged = { ...config, ...newConfig };
    setConfig(merged);
  };

  const handleSaveStrategy = (updatedStrategy: Strategy) => {
    setStrategies((prev) =>
      prev.map((s) => (s.id === updatedStrategy.id ? updatedStrategy : s))
    );
  };

  const handleTestStrategy = (strategy: Strategy) => {
    handleStrategyChange(strategy.id);
    setActiveView('backtest');
  };

  // Keyboard shortcut listener for institutional power users
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K: Command Palette
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
      // Cmd/Ctrl + B: Toggle Sidebar
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setSidebarCollapsed((prev) => !prev);
      }
      // Cmd/Ctrl + Enter: Run Backtest
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleRunBacktest();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleRunBacktest]);

  const currentStrategy =
    strategies.find((s) => s.id === config.strategyId) || strategies[0];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#070a0f] text-slate-100 font-sans">
      {/* LEFT FIXED SIDEBAR */}
      <Sidebar
        activeView={activeView}
        onNavigate={setActiveView}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* MAIN CONTAINER: HEADER + ACTIVE VIEW */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          config={config}
          onConfigChange={handleConfigChange}
          strategies={strategies}
          onSelectStrategy={handleStrategyChange}
          isRunning={isRunning}
          onRunBacktest={handleRunBacktest}
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        />

        {/* VIEW ROUTER */}
        <main className="flex-1 overflow-y-auto bg-[#070a0f] scrollbar-thin">
          {activeView === 'dashboard' && (
            <DashboardView
              metrics={backtestResult.metrics}
              equityCurve={backtestResult.equityCurve}
              strategies={strategies}
              monthlyReturns={backtestResult.monthlyReturns}
              riskMetrics={SAMPLE_RISK_METRICS}
              onSelectStrategy={handleStrategyChange}
              onNavigate={setActiveView}
              onRunBacktest={handleRunBacktest}
            />
          )}

          {activeView === 'backtest' && (
            <BacktestView
              config={config}
              onConfigChange={handleConfigChange}
              strategies={strategies}
              candles={backtestResult.candles}
              trades={backtestResult.trades}
              orders={backtestResult.orders}
              equityCurve={backtestResult.equityCurve}
              metrics={backtestResult.metrics}
              monthlyReturns={backtestResult.monthlyReturns}
              logs={backtestResult.logs}
              isRunning={isRunning}
              progress={progress}
              statusMessage={statusMessage}
              onRunBacktest={handleRunBacktest}
              onStopBacktest={handleStopBacktest}
            />
          )}

          {activeView === 'strategies' && (
            <StrategyLabView
              strategies={strategies}
              selectedStrategyId={config.strategyId}
              onSelectStrategy={handleStrategyChange}
              onSaveStrategy={handleSaveStrategy}
              onTestStrategy={handleTestStrategy}
            />
          )}

          {(activeView === 'research') && (
            <ResearchOptimizerView />
          )}

          {activeView === 'trades' && (
            <TradeExplorerView trades={backtestResult.trades} />
          )}

          {(activeView === 'compare') && (
            <CompareView strategies={strategies} />
          )}

          {activeView === 'risk' && <RiskTerminalView />}

          {(activeView === 'market-data') && <MarketDataView />}

          {activeView === 'reports' && (
            <ReportsView
              strategy={currentStrategy}
              metrics={backtestResult.metrics}
              monthlyReturns={backtestResult.monthlyReturns}
              riskMetrics={SAMPLE_RISK_METRICS}
            />
          )}

          {activeView === 'settings' && <SettingsView />}
        </main>
      </div>

      {/* GLOBAL COMMAND PALETTE (CMD+K) */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onNavigate={setActiveView}
        onRunBacktest={handleRunBacktest}
      />
    </div>
  );
}
