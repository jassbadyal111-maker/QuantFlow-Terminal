import React, { useState } from 'react';
import {
  PerformanceMetrics,
  MonthlyReturn,
  Strategy,
  RiskMetrics,
} from '../../types/backtest';
import {
  FileText,
  Download,
  Share2,
  Printer,
  CheckCircle2,
  Shield,
  Layers,
  Award,
} from 'lucide-react';
import {
  formatCurrency,
  formatPercent,
  formatNumber,
  getPnlTextColor,
} from '../../utils/formatters';

interface ReportsViewProps {
  strategy: Strategy;
  metrics: PerformanceMetrics;
  monthlyReturns: MonthlyReturn[];
  riskMetrics: RiskMetrics;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const ReportsView: React.FC<ReportsViewProps> = ({
  strategy,
  metrics,
  monthlyReturns,
  riskMetrics,
}) => {
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleExportJSON = () => {
    const reportData = {
      title: 'ApexQuant Institutional Performance Tear Sheet',
      strategy: strategy.name,
      symbol: strategy.symbol,
      timeframe: strategy.timeframe,
      generatedAt: new Date().toISOString(),
      performanceMetrics: metrics,
      riskMetrics: riskMetrics,
      monthlyReturns: monthlyReturns,
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(reportData, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute('href', dataStr);
    dlAnchorElem.setAttribute('download', `ApexQuant_Report_${strategy.id}_${Date.now()}.json`);
    dlAnchorElem.click();

    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 2000);
  };

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-4 font-sans select-none print:p-0 print:m-0 print:max-w-none">
      {/* Top Header & Export Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0c111a] p-3 rounded border border-[#1b2436] print:hidden">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-[#162132] border border-[#24334c] flex items-center justify-center text-emerald-400">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-slate-100">Institutional Performance Tear Sheet</h1>
            <p className="text-xs text-slate-400">
              Audit-ready quantitative summary for risk committees, allocators, and internal LP review
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#131b28] hover:bg-[#1a2538] text-slate-200 border border-[#223048] text-xs font-medium transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print / PDF</span>
          </button>
          <button
            onClick={handleExportJSON}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors border border-emerald-400/30"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{downloadSuccess ? 'Exported!' : 'Export JSON'}</span>
          </button>
        </div>
      </div>

      {/* TEAR SHEET DOCUMENT CARD */}
      <div className="bg-[#0b0f16] border border-[#1c2436] rounded p-6 space-y-6 text-slate-200 shadow-xl font-mono-data print:border-none print:shadow-none print:bg-white print:text-black">
        {/* Document Header */}
        <div className="flex flex-wrap items-start justify-between border-b border-[#1c2436] pb-4">
          <div>
            <div className="text-xs text-emerald-400 font-bold uppercase tracking-wider">
              ApexQuant Institutional Management
            </div>
            <h2 className="text-xl font-bold font-sans text-slate-100 mt-1">
              {strategy.name} ({strategy.symbol})
            </h2>
            <div className="text-xs text-slate-400 mt-0.5">
              Program ID: {strategy.id} · Model Version: {strategy.version} · Author: {strategy.author}
            </div>
          </div>

          <div className="text-right text-xs text-slate-400">
            <div>Report Date: {new Date().toLocaleDateString()}</div>
            <div>Benchmark: BTC Buy &amp; Hold</div>
            <div>Base Currency: USD / USDT</div>
          </div>
        </div>

        {/* Section 1: Executive KPI Matrix */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-300 uppercase tracking-tight border-b border-[#1c2436] pb-1">
            1. Executive Performance Summary
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-2.5 rounded bg-[#0e1420] border border-[#1a2333]">
              <div className="text-slate-400 text-[10px]">CUMULATIVE RETURN</div>
              <div className="text-emerald-400 text-base font-bold mt-0.5">
                {formatPercent(metrics.totalReturn)}
              </div>
            </div>
            <div className="p-2.5 rounded bg-[#0e1420] border border-[#1a2333]">
              <div className="text-slate-400 text-[10px]">ANNUALIZED SHARPE</div>
              <div className="text-slate-100 text-base font-bold mt-0.5">
                {metrics.sharpeRatio.toFixed(2)}
              </div>
            </div>
            <div className="p-2.5 rounded bg-[#0e1420] border border-[#1a2333]">
              <div className="text-slate-400 text-[10px]">MAX DRAWDOWN</div>
              <div className="text-rose-400 text-base font-bold mt-0.5">
                {metrics.maxDrawdown.toFixed(2)}%
              </div>
            </div>
            <div className="p-2.5 rounded bg-[#0e1420] border border-[#1a2333]">
              <div className="text-slate-400 text-[10px]">PROFIT FACTOR</div>
              <div className="text-slate-100 text-base font-bold mt-0.5">
                {metrics.profitFactor.toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Return & Risk Statistics Table */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-300 uppercase tracking-tight border-b border-[#1c2436] pb-1">
            2. Detailed Return &amp; Tail Risk Profile
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1.5 p-3 rounded bg-[#0e1420] border border-[#1a2333]">
              <div className="flex justify-between py-1 border-b border-[#162030]">
                <span className="text-slate-400">Annualized Compound Return (CAGR):</span>
                <span className="text-slate-200 font-bold">{formatPercent(metrics.annualizedReturn)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#162030]">
                <span className="text-slate-400">Benchmark Return (BTC):</span>
                <span className="text-slate-200">{formatPercent(metrics.benchmarkReturn)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#162030]">
                <span className="text-slate-400">Jensen's Alpha vs BTC:</span>
                <span className="text-emerald-400 font-bold">+{metrics.alpha}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#162030]">
                <span className="text-slate-400">Portfolio Beta:</span>
                <span className="text-slate-200">{metrics.beta}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Sortino Ratio (Downside Vol):</span>
                <span className="text-slate-200 font-bold">{metrics.sortinoRatio.toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-1.5 p-3 rounded bg-[#0e1420] border border-[#1a2333]">
              <div className="flex justify-between py-1 border-b border-[#162030]">
                <span className="text-slate-400">Daily Annualized Volatility:</span>
                <span className="text-slate-200 font-bold">{metrics.dailyVolAnnualized.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#162030]">
                <span className="text-slate-400">1-Day Value at Risk (95% VaR):</span>
                <span className="text-rose-400 font-bold">{riskMetrics.var95_1D}%</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#162030]">
                <span className="text-slate-400">1-Day Expected Shortfall (CVaR 99%):</span>
                <span className="text-rose-400 font-bold">{riskMetrics.cvar99_1D}%</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#162030]">
                <span className="text-slate-400">Max Drawdown Duration:</span>
                <span className="text-slate-200">{metrics.maxDrawdownDurationDays} days</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Calmar Ratio (CAGR / Max DD):</span>
                <span className="text-slate-200 font-bold">{metrics.calmarRatio.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Monthly Heatmap Matrix */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-300 uppercase tracking-tight border-b border-[#1c2436] pb-1">
            3. Monthly Historical Returns Table (%)
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-center text-xs">
              <thead>
                <tr className="text-slate-400 border-b border-[#1c2436]">
                  <th className="py-1 px-2 text-left">Year</th>
                  {MONTH_NAMES.map((m) => (
                    <th key={m} className="py-1 px-1.5 font-normal">
                      {m}
                    </th>
                  ))}
                  <th className="py-1 px-2 text-right font-bold text-slate-200">YTD</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#172030]">
                {monthlyReturns.map((row) => (
                  <tr key={row.year}>
                    <td className="py-1.5 px-2 text-left font-semibold text-slate-200">{row.year}</td>
                    {row.months.map((val, idx) => (
                      <td key={idx} className="py-1.5 px-1 text-[11px]">
                        {val !== null ? (
                          <span className={val >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                            {val > 0 ? `+${val}%` : `${val}%`}
                          </span>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>
                    ))}
                    <td
                      className={`py-1.5 px-2 text-right font-bold ${
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

        {/* Section 4: Execution & Cost Audit */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-300 uppercase tracking-tight border-b border-[#1c2436] pb-1">
            4. Execution Friction &amp; Commission Audit
          </div>
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="p-2.5 rounded bg-[#0e1420] border border-[#1a2333]">
              <span className="text-slate-400 text-[10px]">TOTAL COMMISSIONS PAID</span>
              <div className="text-slate-200 font-bold mt-0.5">${metrics.totalFeesPaid.toFixed(2)}</div>
            </div>
            <div className="p-2.5 rounded bg-[#0e1420] border border-[#1a2333]">
              <span className="text-slate-400 text-[10px]">TOTAL FUNDING PAID</span>
              <div className="text-slate-200 font-bold mt-0.5">${metrics.totalFundingPaid.toFixed(2)}</div>
            </div>
            <div className="p-2.5 rounded bg-[#0e1420] border border-[#1a2333]">
              <span className="text-slate-400 text-[10px]">AVG FILL SLIPPAGE</span>
              <div className="text-slate-200 font-bold mt-0.5">2.5 bps (Taker Execution)</div>
            </div>
          </div>
        </div>

        {/* Auditor Disclaimer Footer */}
        <div className="pt-4 border-t border-[#1c2436] text-[10px] text-slate-500 leading-relaxed font-sans">
          CONFIDENTIAL &amp; PROPRIETARY. Simulated backtesting results have inherent limitations and do not represent actual trading.
          Past performance is not indicative of future returns. Models execute under institutional market impact assumptions.
        </div>
      </div>
    </div>
  );
};
