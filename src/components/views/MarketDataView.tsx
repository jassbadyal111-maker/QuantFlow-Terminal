import React, { useState, useEffect } from 'react';
import {
  Activity,
  Layers,
  TrendingUp,
  RefreshCw,
  Percent,
  Clock,
  ArrowDown,
  ArrowUp,
} from 'lucide-react';
import { formatCurrency, formatCompactUSD } from '../../utils/formatters';

interface OrderBookLevel {
  price: number;
  size: number;
  total: number;
}

const SAMPLE_FUNDING_RATES = [
  { exchange: 'Binance Futures', btc: 0.0102, eth: 0.0095, sol: 0.0154, nextIn: '03:42:15' },
  { exchange: 'Bybit Derivatives', btc: 0.0098, eth: 0.0092, sol: 0.0148, nextIn: '03:42:15' },
  { exchange: 'OKX Perpetual', btc: 0.0105, eth: 0.0099, sol: 0.0162, nextIn: '03:42:15' },
  { exchange: 'Deribit Perps', btc: 0.0089, eth: 0.0088, sol: 0.0132, nextIn: '03:42:15' },
];

export const MarketDataView: React.FC = () => {
  const [basePrice, setBasePrice] = useState(64250.0);

  // Simulated ticks
  useEffect(() => {
    const interval = setInterval(() => {
      setBasePrice((prev) => prev + (Math.random() - 0.5) * 8);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  // Generate mock order book levels around current base price
  const asks: OrderBookLevel[] = Array.from({ length: 8 }).map((_, i) => {
    const p = basePrice + (8 - i) * 2.5;
    const s = 0.45 + (i * 0.32);
    return { price: p, size: Number(s.toFixed(3)), total: Number((s * p).toFixed(0)) };
  });

  const bids: OrderBookLevel[] = Array.from({ length: 8 }).map((_, i) => {
    const p = basePrice - (i + 1) * 2.5;
    const s = 0.52 + (i * 0.28);
    return { price: p, size: Number(s.toFixed(3)), total: Number((s * p).toFixed(0)) };
  });

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-4 font-sans select-none">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0c111a] p-3 rounded border border-[#1b2436]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-[#162132] border border-[#24334c] flex items-center justify-center text-cyan-400">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold text-slate-100">Live Crypto Microstructure & Funding Matrix</h1>
              <span className="text-[10px] font-mono-data px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                FEED CONNECTED
              </span>
            </div>
            <p className="text-xs text-slate-400">
              L2 Order book depth, cross-exchange perpetual funding rates, and high-frequency trade tape
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono-data text-xs">
          <span className="text-slate-400">BTC/USDT MID:</span>
          <span className="text-emerald-400 font-bold text-sm">{formatCurrency(basePrice)}</span>
        </div>
      </div>

      {/* Main Grid: L2 Orderbook + Funding Rate Heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* L2 ORDER BOOK */}
        <div className="terminal-panel rounded border border-[#1c2436] bg-[#0b0f16] p-3.5 space-y-2">
          <div className="flex items-center justify-between border-b border-[#1c2436] pb-2">
            <h2 className="text-xs font-semibold text-slate-200">Binance Futures L2 Order Book (BTC/USDT)</h2>
            <span className="text-[10px] font-mono-data text-slate-400">Tick: 0.1 USDT</span>
          </div>

          <div className="font-mono-data text-xs space-y-1">
            <div className="grid grid-cols-3 text-slate-500 text-[10px] uppercase pb-1 border-b border-[#162030]">
              <span>Price (USDT)</span>
              <span className="text-right">Size (BTC)</span>
              <span className="text-right">Total (USDT)</span>
            </div>

            {/* Asks (Sell) */}
            <div className="space-y-0.5">
              {asks.map((a, i) => (
                <div key={i} className="grid grid-cols-3 py-0.5 text-[11px] relative overflow-hidden">
                  <div
                    className="absolute right-0 top-0 bottom-0 bg-rose-500/10 -z-0"
                    style={{ width: `${Math.min(100, (a.size / 3) * 100)}%` }}
                  ></div>
                  <span className="text-rose-400 z-10">{a.price.toFixed(1)}</span>
                  <span className="text-right text-slate-300 z-10">{a.size}</span>
                  <span className="text-right text-slate-400 z-10">${a.total.toLocaleString()}</span>
                </div>
              ))}
            </div>

            {/* Mid Price Spread Indicator */}
            <div className="py-1.5 px-2 bg-[#0e1420] border-y border-[#1a2333] flex items-center justify-between font-bold">
              <span className="text-emerald-400 text-sm">{formatCurrency(basePrice)}</span>
              <span className="text-[10px] text-slate-400 font-normal">Spread: $0.10 (0.015 bps)</span>
            </div>

            {/* Bids (Buy) */}
            <div className="space-y-0.5">
              {bids.map((b, i) => (
                <div key={i} className="grid grid-cols-3 py-0.5 text-[11px] relative overflow-hidden">
                  <div
                    className="absolute right-0 top-0 bottom-0 bg-emerald-500/10 -z-0"
                    style={{ width: `${Math.min(100, (b.size / 3) * 100)}%` }}
                  ></div>
                  <span className="text-emerald-400 z-10">{b.price.toFixed(1)}</span>
                  <span className="text-right text-slate-300 z-10">{b.size}</span>
                  <span className="text-right text-slate-400 z-10">${b.total.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CROSS-EXCHANGE FUNDING RATES */}
        <div className="terminal-panel rounded border border-[#1c2436] bg-[#0b0f16] p-3.5 space-y-3">
          <div className="flex items-center justify-between border-b border-[#1c2436] pb-2">
            <h2 className="text-xs font-semibold text-slate-200">Perpetual Funding Rates & Basis Arbitrage</h2>
            <span className="text-[10px] font-mono-data text-slate-400">8h Settlement Interval</span>
          </div>

          <p className="text-[11px] text-slate-400">
            Positive rates indicate long positions pay shorts. Discrepancies between exchanges present delta-neutral basis arbitrage opportunities.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono-data">
              <thead className="bg-[#0e1420] text-slate-400 border-b border-[#1c2436] text-[10px] uppercase">
                <tr>
                  <th className="py-2 px-2.5">Exchange</th>
                  <th className="py-2 px-2.5 text-right">BTC Rate</th>
                  <th className="py-2 px-2.5 text-right">ETH Rate</th>
                  <th className="py-2 px-2.5 text-right">SOL Rate</th>
                  <th className="py-2 px-2.5 text-right">Next Settlement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#172030]">
                {SAMPLE_FUNDING_RATES.map((fr) => (
                  <tr key={fr.exchange} className="hover:bg-[#121927]">
                    <td className="py-2.5 px-2.5 font-medium text-slate-200">{fr.exchange}</td>
                    <td className="py-2.5 px-2.5 text-right font-bold text-amber-400">
                      +{fr.btc.toFixed(4)}%
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-bold text-amber-400">
                      +{fr.eth.toFixed(4)}%
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-bold text-amber-400">
                      +{fr.sol.toFixed(4)}%
                    </td>
                    <td className="py-2.5 px-2.5 text-right text-slate-400 text-[11px] flex items-center justify-end gap-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      <span>{fr.nextIn}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Basis Arbitrage Signal Card */}
          <div className="p-3 rounded bg-[#0e1420] border border-emerald-500/25 space-y-1 text-xs font-mono-data">
            <div className="text-emerald-400 font-semibold flex items-center gap-1.5">
              <span>Arbitrage Opportunity Detected</span>
            </div>
            <p className="text-slate-300 text-[11px]">
              OKX SOL Perp (+0.0162%) vs Deribit SOL Perp (+0.0132%) spread yields an annualized <strong>+3.28% APR</strong> delta-neutral cash-and-carry basis.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
