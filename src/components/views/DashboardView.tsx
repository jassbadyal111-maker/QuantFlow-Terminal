import React from 'react';
import { MetricCard } from '../common/MetricCard';
import { EquityCurveChart } from '../charts/EquityCurveChart';
import {
  PerformanceMetrics,
  EquityPoint,
  Strategy,
  MonthlyReturn,
  RiskMetrics,
  NavView,
} from '../../types/backtest';
import {
  formatCurrency,
  formatPercent,
  formatNumber,
  formatCompactUSD,
  getPnlTextColor,
  getPnlBgColor,
} from '../../utils/formatters';
import {
  TrendingUp,
  ShieldAlert,
  Layers,
  ArrowRight,
  Play,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ExternalLink,
} from 'lucide-react';

interface DashboardViewProps {
  metrics: PerformanceMetrics;
  equityCurve: EquityPoint[];
  strategies: Strategy[];
  monthlyReturns: MonthlyReturn[];
  riskMetrics: RiskMetrics;
  onSelectStrategy: (stratId: string) => void;
  onNavigate: (view: NavView) => void;
  onRunBacktest: () => void;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const DashboardView: React.FC<DashboardViewProps> = ({
  metrics,
  equityCurve,
  strategies,
  monthlyReturns,
  riskMetrics,
  onSelectStrategy,
  onNavigate,
  onRunBacktest,
}) => {
  const currentEquity = equityCurve.length > 0 ? equityCurve[equityCurve.length - 1].equity : 100000;
  const initialEquity = 100000;
  const netProfit = currentEquity - initialEquity;

  return (
    <div className="p-4 space-y-4 max-w-7xl mx-auto overflow-x-hidden">
      {/* Top Welcome & Quick Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0c111a] p-3 rounded border border-[#1b2436]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold text-slate-100">Quant Portfolio Terminal</h1>
            <span className="text-[10px] font-mono-data px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
              LIVE SIMULATION
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Multi-strategy algorithmic execution desk · Binance Futures / OKX / Bybit
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('backtest')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#131b28] hover:bg-[#1a2538] text-slate-200 border border-[#223048] text-xs font-medium transition-colors"
          >
            <span>Backtest Workspace</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
          </button>
          <button
            onClick={onRunBacktest}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors border border-emerald-400/30"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Re-run Portfolio</span>
          </button>
        </div>
      </div>

      {/* Top Row: Quantitative Performance KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
        <MetricCard
          label="Total Return"
          value={formatPercent(metrics.totalReturn)}
          change={`+${formatCurrency(netProfit, 0)}`}
          isPositive={metrics.totalReturn >= 0}
          tooltip="Cumulative portfolio return over historical backtest horizon"
          variant="success"
        />
        <MetricCard
          label="Sharpe Ratio"
          value={formatNumber(metrics.sharpeRatio)}
          subtext="Annualized (Rf = 4%)"
          tooltip="Risk-adjusted excess return per unit of total volatility"
          variant="highlight"
        />
        <MetricCard
          label="Sortino Ratio"
          value={formatNumber(metrics.sortinoRatio)}
          subtext="Downside Vol Only"
          tooltip="Return penalizing only downside volatility, ideal for trend-following"
        />
        <MetricCard
          label="Max Drawdown"
          value={formatPercent(metrics.maxDrawdown)}
          subtext={`${metrics.maxDrawdownDurationDays}d Recovery`}
          isPositive={false}
          tooltip="Peak-to-trough maximum equity decline observed"
          variant="danger"
        />
        <MetricCard
          label="Win Rate"
          value={`${formatNumber(metrics.winRate, 1)}%`}
          subtext={`${metrics.winningTrades}W / ${metrics.losingTrades}L`}
          isPositive={metrics.winRate >= 50}
          tooltip="Percentage of closed trades with net positive realized PnL"
        />
        <MetricCard
          label="Profit Factor"
          value={formatNumber(metrics.profitFactor)}
          subtext={`Avg Win/Loss: ${metrics.winLossRatio}`}
          isPositive={metrics.profitFactor > 1.5}
          tooltip="Gross profits divided by gross losses across all closed trades"
        />
        <MetricCard
          label="Alpha (vs BTC)"
          value={formatNumber(metrics.alpha)}
          subtext={`Beta: ${metrics.beta}`}
          isPositive={metrics.alpha > 0}
          tooltip="Excess idiosyncratic return generated over benchmark exposure"
        />
        <MetricCard
          label="Annual Vol"
          value={`${formatNumber(metrics.dailyVolAnnualized, 1)}%`}
          subtext={`VaR 95%: ${metrics.valueAtRisk95}%`}
          tooltip="Annualized standard deviation of daily strategy returns"
        />
      </div>

      {/* Main Chart Section: Equity Curve vs Benchmark */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2">
          <EquityCurveChart data={equityCurve} initialCapital={initialEquity} height={340} />
        </div>

        {/* Risk & Exposure Overview Card */}
        <div className="terminal-panel rounded border border-[#1c2436] bg-[#0b0f16] flex flex-col justify-between p-3.5 select-none">
          <div>
            <div className="flex items-center justify-between border-b border-[#1c2436] pb-2 mb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-semibold text-slate-200">Risk & Margin Utilization</span>
              </div>
              <span className="text-[10px] font-mono-data px-1.5 py-0.5 rounded bg-[#151f30] text-slate-300 border border-[#202d42]">
                HEALTHY
              </span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-[#172030]/60">
                <span className="text-slate-400">Net Portfolio Leverage</span>
                <span className="font-mono-data text-slate-200 font-semibold">{riskMetrics.currentLeverage}x (Cap: 5x)</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-[#172030]/60">
                <span className="text-slate-400">Gross Notional Value</span>
                <span className="font-mono-data text-slate-200">{formatCurrency(riskMetrics.grossExposure, 0)}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-[#172030]/60">
                <span className="text-slate-400">Daily Value at Risk (99% VaR)</span>
                <span className="font-mono-data text-rose-400 font-semibold">{riskMetrics.var99_1D}%</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-[#172030]/60">
                <span className="text-slate-400">Distance to Est. Liquidation</span>
                <span className="font-mono-data text-emerald-400 font-semibold">+{riskMetrics.liquidationDistancePct}%</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-[#172030]/60">
                <span className="text-slate-400">Est. Liquidation Price (BTC)</span>
                <span className="font-mono-data text-slate-300">{formatCurrency(riskMetrics.liquidationPriceBtc, 0)}</span>
              </div>
            </div>

            {/* Asset Allocation Mini Bars */}
            <div className="mt-4 pt-3 border-t border-[#1a2333]">
              <div className="text-[10px] uppercase font-mono-data text-slate-400 mb-2">
                Active Position Exposure
              </div>
              <div className="space-y-1.5">
                {riskMetrics.assetExposures.map((asset) => (
                  <div key={asset.symbol} className="flex items-center justify-between text-[11px] font-mono-data">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          asset.side === 'LONG' ? 'bg-emerald-400' : 'bg-rose-400'
                        }`}
                      ></span>
                      <span className="text-slate-200 font-medium">{asset.symbol}</span>
                      <span className="text-[9px] text-slate-400">({asset.side})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">{formatCompactUSD(asset.notional)}</span>
                      <span className="text-slate-200 w-10 text-right">{asset.pct}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigate('risk')}
            className="mt-3 w-full py-1.5 rounded bg-[#131b28] hover:bg-[#192437] text-slate-300 text-xs font-medium border border-[#202d42] transition-colors flex items-center justify-center gap-1.5"
          >
            <span>Open Risk Terminal</span>
            <ExternalLink className="w-3 h-3 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Active Strategies Table */}
      <div className="terminal-panel rounded border border-[#1c2436] bg-[#0b0f16] overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#1c2436] bg-[#090d14]">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-semibold text-slate-200">Active Quantitative Models & Strategies</span>
          </div>
          <button
            onClick={() => onNavigate('strategies')}
            className="text-[11px] text-emerald-400 hover:text-emerald-300 font-mono-data flex items-center gap-1"
          >
            <span>Strategy Lab</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono-data">
            <thead className="bg-[#0e1420] text-slate-400 border-b border-[#1c2436] text-[10px] uppercase">
              <tr>
                <th className="py-2 px-3">Strategy Name</th>
                <th className="py-2 px-3">Type</th>
                <th className="py-2 px-3">Asset / TF</th>
                <th className="py-2 px-3 text-right">Sharpe</th>
                <th className="py-2 px-3 text-right">Return</th>
                <th className="py-2 px-3 text-right">Max DD</th>
                <th className="py-2 px-3 text-right">Win Rate</th>
                <th className="py-2 px-3 text-right">Profit Factor</th>
                <th className="py-2 px-3 text-center">Status</th>
                <th className="py-2 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#172030]">
              {strategies.map((strat) => (
                <tr key={strat.id} className="hover:bg-[#111825] transition-colors">
                  <td className="py-2.5 px-3">
                    <div className="font-sans font-medium text-slate-200">{strat.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono-data">
                      {strat.version} · {strat.author}
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="px-1.5 py-0.5 rounded bg-[#162030] text-slate-300 text-[10px] border border-[#223046]">
                      {strat.type}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-300">
                    {strat.symbol} <span className="text-slate-400 text-[10px]">({strat.timeframe})</span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-slate-100">{strat.sharpe.toFixed(2)}</td>
                  <td className={`py-2.5 px-3 text-right font-bold ${getPnlTextColor(strat.returnPct)}`}>
                    {formatPercent(strat.returnPct)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-rose-400">{strat.maxDrawdown.toFixed(1)}%</td>
                  <td className="py-2.5 px-3 text-right text-slate-200">{strat.winRate.toFixed(1)}%</td>
                  <td className="py-2.5 px-3 text-right text-slate-200">{strat.profitFactor.toFixed(2)}</td>
                  <td className="py-2.5 px-3 text-center">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        strat.status === 'ACTIVE'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                      }`}
                    >
                      {strat.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <button
                      onClick={() => {
                        onSelectStrategy(strat.id);
                        onNavigate('backtest');
                      }}
                      className="px-2 py-1 rounded bg-[#162132] hover:bg-emerald-500/20 hover:text-emerald-400 hover:border-emerald-500/40 text-slate-300 border border-[#233148] transition-colors text-[11px]"
                    >
                      Inspect
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Monthly Returns Matrix Heatmap */}
      <div className="terminal-panel rounded border border-[#1c2436] bg-[#0b0f16] overflow-hidden">
        <div className="px-3 py-2 border-b border-[#1c2436] bg-[#090d14] flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-200">Historical Monthly Returns Matrix (%)</span>
          <span className="text-[10px] font-mono-data text-slate-400">Net after fees & slippage</span>
        </div>

        <div className="overflow-x-auto p-2">
          <table className="w-full text-center text-[11px] font-mono-data">
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
                  {row.months.map((val, idx) => {
                    if (val === null) {
                      return (
                        <td key={idx} className="py-2 px-2 text-slate-500">
                          -
                        </td>
                      );
                    }
                    const isPos = val >= 0;
                    return (
                      <td key={idx} className="py-2 px-1">
                        <div
                          className={`px-1 py-1 rounded text-[10px] font-medium ${
                            isPos
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {val > 0 ? `+${val}%` : `${val}%`}
                        </div>
                      </td>
                    );
                  })}
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
      </div>
    </div>
  );
};
