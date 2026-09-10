import React, { useState, useMemo } from 'react';
import { Trade } from '../../types/backtest';
import {
  formatCurrency,
  formatPercent,
  getPnlTextColor,
  getPnlBgColor,
} from '../../utils/formatters';
import {
  Search,
  Download,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Layers,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  FileSpreadsheet,
  X,
  ExternalLink,
} from 'lucide-react';

interface TradeExplorerViewProps {
  trades: Trade[];
}

type SortField = 'timestamp' | 'pnl' | 'pnlPercent' | 'notional' | 'fees' | 'durationBars';

export const TradeExplorerView: React.FC<TradeExplorerViewProps> = ({ trades }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sideFilter, setSideFilter] = useState<'ALL' | 'LONG' | 'SHORT'>('ALL');
  const [outcomeFilter, setOutcomeFilter] = useState<'ALL' | 'WIN' | 'LOSS'>('ALL');
  const [symbolFilter, setSymbolFilter] = useState<string>('ALL');
  const [sortField, setSortField] = useState<SortField>('timestamp');
  const [sortAsc, setSortAsc] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const pageSize = 12;

  // Filtered & Sorted Trades
  const filteredTrades = useMemo(() => {
    return trades
      .filter((t) => {
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          const matches =
            t.id.toLowerCase().includes(q) ||
            t.symbol.toLowerCase().includes(q) ||
            t.exitReason.toLowerCase().includes(q);
          if (!matches) return false;
        }
        if (sideFilter !== 'ALL' && t.side !== sideFilter) return false;
        if (outcomeFilter === 'WIN' && t.netPnl <= 0) return false;
        if (outcomeFilter === 'LOSS' && t.netPnl > 0) return false;
        if (symbolFilter !== 'ALL' && t.symbol !== symbolFilter) return false;
        return true;
      })
      .sort((a, b) => {
        let valA: any = a[sortField];
        let valB: any = b[sortField];
        if (typeof valA === 'string') valA = new Date(valA).getTime();
        if (typeof valB === 'string') valB = new Date(valB).getTime();
        return sortAsc ? valA - valB : valB - valA;
      });
  }, [trades, searchQuery, sideFilter, outcomeFilter, symbolFilter, sortField, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(filteredTrades.length / pageSize));
  const paginatedTrades = filteredTrades.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const handleExportCSV = () => {
    const headers = [
      'Trade ID',
      'Symbol',
      'Side',
      'Entry Time',
      'Exit Time',
      'Entry Price',
      'Exit Price',
      'Size',
      'Notional',
      'Gross PnL',
      'Net PnL',
      'PnL %',
      'Fees',
      'Funding',
      'Slippage bps',
      'Exit Reason',
    ];
    const rows = filteredTrades.map((t) => [
      t.id,
      t.symbol,
      t.side,
      t.timestamp,
      t.exitTimestamp,
      t.entryPrice,
      t.exitPrice,
      t.size,
      t.notional,
      t.pnl,
      t.netPnl,
      t.pnlPercent,
      t.fees,
      t.funding,
      t.slippageBps,
      t.exitReason,
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ApexQuant_Trades_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-4 font-sans select-none">
      {/* Header & Export Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0c111a] p-3 rounded border border-[#1b2436]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold text-slate-100">Trade Execution Explorer</h1>
            <span className="text-[10px] font-mono-data px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
              {filteredTrades.length} MATCHING EXECUTIONS
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Microstructure fill analysis, realized P&amp;L, execution slippage, and adverse excursion drilldown
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#131b28] hover:bg-[#1a2538] text-slate-200 border border-[#223048] text-xs font-medium transition-colors"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
          <span>Export CSV</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="terminal-panel rounded border border-[#1c2436] bg-[#0b0f16] p-3 flex flex-wrap items-center justify-between gap-3 text-xs font-mono-data">
        {/* Search */}
        <div className="flex items-center gap-2 bg-[#0e1420] border border-[#1e2739] rounded px-2.5 py-1.5 w-64">
          <Search className="w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search Trade ID, Symbol, Reason..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-slate-200 placeholder-slate-500 text-xs focus:outline-none"
          />
        </div>

        {/* Side, Outcome, and Asset Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-[#0e1420] rounded border border-[#1e2739] p-0.5">
            {(['ALL', 'LONG', 'SHORT'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSideFilter(s)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  sideFilter === s
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 bg-[#0e1420] rounded border border-[#1e2739] p-0.5">
            {(['ALL', 'WIN', 'LOSS'] as const).map((o) => (
              <button
                key={o}
                onClick={() => setOutcomeFilter(o)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  outcomeFilter === o
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {o === 'ALL' ? 'ALL PNL' : o === 'WIN' ? 'WINNERS' : 'LOSERS'}
              </button>
            ))}
          </div>

          <select
            aria-label="Filter by Symbol"
            value={symbolFilter}
            onChange={(e) => setSymbolFilter(e.target.value)}
            className="bg-[#0e1420] border border-[#1e2739] text-slate-300 rounded px-2 py-1 text-xs"
          >
            <option value="ALL">All Symbols</option>
            <option value="BTC/USDT">BTC/USDT</option>
            <option value="ETH/USDT">ETH/USDT</option>
            <option value="SOL/USDT">SOL/USDT</option>
            <option value="AVAX/USDT">AVAX/USDT</option>
          </select>
        </div>
      </div>

      {/* Professional Dense Data Table */}
      <div className="terminal-panel rounded border border-[#1c2436] bg-[#0b0f16] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono-data">
            <thead className="bg-[#0e1420] text-slate-400 border-b border-[#1c2436] text-[10px] uppercase">
              <tr>
                <th className="py-2.5 px-3">Trade ID</th>
                <th
                  className="py-2.5 px-3 cursor-pointer hover:text-slate-200"
                  onClick={() => handleSort('timestamp')}
                >
                  <div className="flex items-center gap-1">
                    <span>Entry / Exit Time</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-2.5 px-3">Symbol / Side</th>
                <th className="py-2.5 px-3 text-right">Entry Price</th>
                <th className="py-2.5 px-3 text-right">Exit Price</th>
                <th className="py-2.5 px-3 text-right">Size (Qty)</th>
                <th
                  className="py-2.5 px-3 text-right cursor-pointer hover:text-slate-200"
                  onClick={() => handleSort('pnl')}
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Realized Net P&amp;L</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  className="py-2.5 px-3 text-right cursor-pointer hover:text-slate-200"
                  onClick={() => handleSort('pnlPercent')}
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Return %</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-2.5 px-3 text-right">Fees &amp; Funding</th>
                <th className="py-2.5 px-3 text-right">Slippage</th>
                <th className="py-2.5 px-3 text-right">MAE / MFE</th>
                <th className="py-2.5 px-3 text-right">Exit Trigger</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#172030]">
              {paginatedTrades.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => setSelectedTrade(t)}
                  className="hover:bg-[#121a28] cursor-pointer transition-colors"
                >
                  <td className="py-2 px-3 font-semibold text-slate-200 flex items-center gap-1.5">
                    <span>{t.id}</span>
                  </td>
                  <td className="py-2 px-3 text-slate-400 text-[11px]">
                    <div>{t.timestamp}</div>
                    <div className="text-slate-500 text-[10px]">{t.exitTimestamp}</div>
                  </td>
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                          t.side === 'LONG'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {t.side}
                      </span>
                      <span className="text-slate-200 font-medium">{t.symbol}</span>
                    </div>
                  </td>
                  <td className="py-2 px-3 text-right text-slate-300">{formatCurrency(t.entryPrice)}</td>
                  <td className="py-2 px-3 text-right text-slate-300">{formatCurrency(t.exitPrice)}</td>
                  <td className="py-2 px-3 text-right text-slate-400">{t.size}</td>
                  <td className={`py-2 px-3 text-right font-bold ${getPnlTextColor(t.netPnl)}`}>
                    {t.netPnl > 0 ? `+${formatCurrency(t.netPnl)}` : formatCurrency(t.netPnl)}
                  </td>
                  <td className={`py-2 px-3 text-right font-bold ${getPnlTextColor(t.pnlPercent)}`}>
                    {formatPercent(t.pnlPercent)}
                  </td>
                  <td className="py-2 px-3 text-right text-slate-400 text-[11px]">
                    ${(t.fees + t.funding).toFixed(2)}
                  </td>
                  <td className="py-2 px-3 text-right text-slate-300">{t.slippageBps} bps</td>
                  <td className="py-2 px-3 text-right text-[10px]">
                    <span className="text-rose-400">{t.mae}%</span> /{' '}
                    <span className="text-emerald-400">+{t.mfe}%</span>
                  </td>
                  <td className="py-2 px-3 text-right">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#162030] text-slate-300 border border-[#233148]">
                      {t.exitReason}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="px-3 py-2 border-t border-[#1c2436] bg-[#090d14] flex items-center justify-between text-xs font-mono-data">
          <div className="text-slate-400">
            Showing {(currentPage - 1) * pageSize + 1} -{' '}
            {Math.min(currentPage * pageSize, filteredTrades.length)} of {filteredTrades.length} trades
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-2 py-1 rounded bg-[#131b28] hover:bg-[#1a2538] disabled:opacity-40 text-slate-300 border border-[#223048]"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-slate-300 font-semibold">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-2 py-1 rounded bg-[#131b28] hover:bg-[#1a2538] disabled:opacity-40 text-slate-300 border border-[#223048]"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Trade Execution Drilldown Modal */}
      {selectedTrade && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-lg bg-[#0e131d] border border-[#222d42] rounded-lg shadow-2xl p-4 font-sans select-text">
            <div className="flex items-center justify-between border-b border-[#1c2436] pb-2 mb-3">
              <div className="flex items-center gap-2">
                <span className="font-mono-data font-bold text-slate-100 text-sm">{selectedTrade.id}</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    selectedTrade.side === 'LONG'
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : 'bg-rose-500/15 text-rose-400'
                  }`}
                >
                  {selectedTrade.side}
                </span>
                <span className="text-xs text-slate-400">{selectedTrade.symbol}</span>
              </div>
              <button
                onClick={() => setSelectedTrade(null)}
                className="text-slate-400 hover:text-slate-200 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs font-mono-data">
              <div className="flex justify-between py-1 border-b border-[#161f30]">
                <span className="text-slate-400">Entry Timestamp:</span>
                <span className="text-slate-200">{selectedTrade.timestamp}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#161f30]">
                <span className="text-slate-400">Exit Timestamp:</span>
                <span className="text-slate-200">{selectedTrade.exitTimestamp}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#161f30]">
                <span className="text-slate-400">Fill Entry Price:</span>
                <span className="text-slate-200 font-semibold">{formatCurrency(selectedTrade.entryPrice)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#161f30]">
                <span className="text-slate-400">Fill Exit Price:</span>
                <span className="text-slate-200 font-semibold">{formatCurrency(selectedTrade.exitPrice)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#161f30]">
                <span className="text-slate-400">Executed Position Size:</span>
                <span className="text-slate-200">{selectedTrade.size}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#161f30]">
                <span className="text-slate-400">Gross Realized PnL:</span>
                <span className="text-slate-200">{formatCurrency(selectedTrade.pnl)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#161f30]">
                <span className="text-slate-400">Net Realized PnL (After Fees):</span>
                <span className={`font-bold text-sm ${getPnlTextColor(selectedTrade.netPnl)}`}>
                  {formatCurrency(selectedTrade.netPnl)} ({formatPercent(selectedTrade.pnlPercent)})
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#161f30]">
                <span className="text-slate-400">Total Exchange Commission:</span>
                <span className="text-slate-300">${selectedTrade.fees.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#161f30]">
                <span className="text-slate-400">Perpetual Funding Rate Paid:</span>
                <span className="text-slate-300">${selectedTrade.funding.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#161f30]">
                <span className="text-slate-400">Execution Slippage:</span>
                <span className="text-slate-300">{selectedTrade.slippageBps} bps</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#161f30]">
                <span className="text-slate-400">Exit Trigger:</span>
                <span className="text-emerald-400 font-semibold">{selectedTrade.exitReason}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">MAE / MFE:</span>
                <span className="text-slate-300">
                  MAE: <span className="text-rose-400">{selectedTrade.mae}%</span> · MFE:{' '}
                  <span className="text-emerald-400">+{selectedTrade.mfe}%</span>
                </span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[#1c2436] flex justify-end">
              <button
                onClick={() => setSelectedTrade(null)}
                className="px-3 py-1.5 rounded bg-[#162132] text-slate-200 hover:bg-[#1e2c44] text-xs font-medium"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
