import React, { useState, useEffect, useMemo } from 'react';
import {
  Activity,
  Download,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Database,
  Trash2,
  RefreshCw,
  HardDrive,
  Clock,
  Layers,
  Search,
  ExternalLink,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { formatCurrency, formatCompactUSD } from '../../utils/formatters';
import { CandleData } from '../../types/backtest';
import { DatasetMetadata, ExchangeId, MarketType, ValidationReport } from '../../types/dataset';
import { CacheManager, StorageUsageReport } from '../../data/cache/CacheManager';
import { DataValidator } from '../../data/validation/DataValidator';
import { createMarketDataProvider } from '../../data/MarketDataProvider';
import { TradingCandleChart } from '../charts/TradingCandleChart';
import { MarketDataError } from '../../types/marketData';

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
  // Selector states
  const [exchange, setExchange] = useState<ExchangeId>('MOCK');
  const [marketType, setMarketType] = useState<MarketType>('PERPETUAL');
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [customSymbol, setCustomSymbol] = useState('');
  const [timeframe, setTimeframe] = useState('1h');
  const [startDate, setStartDate] = useState('2025-01-01');
  const [endDate, setEndDate] = useState('2025-02-28');

  // Data & loading states
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [candles, setCandles] = useState<CandleData[]>([]);
  const [metadata, setMetadata] = useState<DatasetMetadata | null>(null);
  const [validationReport, setValidationReport] = useState<ValidationReport | null>(null);
  const [storageUsage, setStorageUsage] = useState<StorageUsageReport | null>(null);
  const [isCached, setIsCached] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'chart' | 'table' | 'orderbook' | 'funding'>('chart');
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Simulated ticks for L2 orderbook
  const [basePrice, setBasePrice] = useState(64250.0);

  useEffect(() => {
    const interval = setInterval(() => {
      setBasePrice((prev) => prev + (Math.random() - 0.5) * 8);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  const activeSymbol = customSymbol.trim() ? customSymbol.trim().toUpperCase() : symbol;

  const currentCacheKey = useMemo(() => {
    return CacheManager.buildKey(exchange, activeSymbol, timeframe, startDate, endDate);
  }, [exchange, activeSymbol, timeframe, startDate, endDate]);

  // Load storage usage and check initial cache
  const refreshCacheInfo = async () => {
    const usage = await CacheManager.getStorageUsage();
    setStorageUsage(usage);
    const cachedItem = await CacheManager.get(currentCacheKey);
    setIsCached(!!cachedItem);
  };

  useEffect(() => {
    refreshCacheInfo();
  }, [currentCacheKey]);

  // Initial load with default mock feed if empty
  useEffect(() => {
    handleFetchData(false);
  }, []);

  const triggerToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3000);
  };

  const handleFetchData = async (forceNetwork: boolean = false) => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      // 1. Check local cache first unless forced
      if (!forceNetwork) {
        const cached = await CacheManager.get(currentCacheKey);
        if (cached) {
          setCandles(cached.candles);
          setMetadata(cached.metadata);
          const val = DataValidator.validate(cached.candles, timeframe);
          setValidationReport(val);
          setIsCached(true);
          setIsLoading(false);
          triggerToast(`Loaded ${cached.candles.length} candles from local cache.`);
          return;
        }
      }

      // 2. Fetch from active MarketDataProvider
      const provider = createMarketDataProvider(exchange.toLowerCase());
      const res = await provider.getCandles(
        activeSymbol,
        timeframe,
        startDate,
        endDate,
        { count: 180, marketType }
      );

      const val = DataValidator.validate(res.candles, timeframe);

      setCandles(res.candles);
      setMetadata(res.metadata);
      setValidationReport(val);

      // 3. Save to local IndexedDB/Storage cache
      await CacheManager.set(currentCacheKey, res.metadata, res.candles);
      setIsCached(true);
      await refreshCacheInfo();

      triggerToast(`Fetched ${res.candles.length} bars from ${provider.name}.`);
    } catch (err: any) {
      const msg = err instanceof MarketDataError ? err.message : (err.message || 'Failed to fetch market data');
      const details = err instanceof MarketDataError && err.technicalDetails ? ` (${err.technicalDetails})` : '';
      setErrorMessage(`${msg}${details}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleValidateCurrent = () => {
    if (candles.length === 0) {
      setErrorMessage('No dataset loaded to validate. Click Fetch first.');
      return;
    }
    const report = DataValidator.validate(candles, timeframe);
    setValidationReport(report);
    if (report.valid) {
      triggerToast(`Dataset valid: 0 critical errors, ${report.warnings.length} warning(s).`);
    } else {
      setErrorMessage(`Validation failed: ${report.errors.join(', ')}`);
    }
  };

  const handleDeleteCurrentCache = async () => {
    await CacheManager.delete(currentCacheKey);
    setIsCached(false);
    await refreshCacheInfo();
    triggerToast('Current dataset removed from local cache.');
  };

  const handleClearAllCache = async () => {
    if (confirm('Clear all locally cached market datasets?')) {
      await CacheManager.clear();
      setIsCached(false);
      await refreshCacheInfo();
      triggerToast('Local market cache completely purged.');
    }
  };

  // Generate order book levels
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
    <div className="p-4 max-w-7xl mx-auto space-y-4 font-sans select-none text-slate-200">
      {/* Toast Alert */}
      {successToast && (
        <div className="fixed top-14 right-4 z-50 bg-emerald-950/90 border border-emerald-500/50 text-emerald-300 text-xs px-3 py-2 rounded shadow-lg flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Top Header & Trust Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0c111a] p-3 rounded border border-[#1b2436]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-[#162132] border border-[#24334c] flex items-center justify-center text-cyan-400">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold text-slate-100">Market Data Infrastructure & Validation Hub</h1>
              {exchange === 'MOCK' ? (
                <span className="text-[10px] font-mono-data px-2 py-0.5 rounded font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  DEMO SYNTHETIC FEED
                </span>
              ) : (
                <span className="text-[10px] font-mono-data px-2 py-0.5 rounded font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  LIVE HISTORICAL EXCHANGE DATA
                </span>
              )}
              {isCached && (
                <span className="text-[10px] font-mono-data px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/30">
                  CACHE HIT
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Deterministic exchange kline normalization, OHLC integrity audits, and local cache management
            </p>
          </div>
        </div>

        {/* Storage stats */}
        <div className="flex items-center gap-4 text-xs font-mono-data text-slate-400">
          <div className="flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5 text-slate-500" />
            <span>Cache Usage: <strong className="text-slate-200">{storageUsage?.formattedSize || '0 KB'}</strong> ({storageUsage?.totalDatasets || 0} datasets)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">MID:</span>
            <span className="text-emerald-400 font-bold text-sm">{formatCurrency(basePrice)}</span>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-3 bg-rose-950/40 border border-rose-500/50 rounded text-xs text-rose-200 flex items-start gap-2.5">
          <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-semibold text-rose-300">Market Data Error / Blocked</div>
            <div>{errorMessage}</div>
          </div>
        </div>
      )}

      {/* CONTROLS BAR */}
      <div className="p-3.5 bg-[#0b0f16] rounded border border-[#1b2436] space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs font-mono-data">
          {/* Exchange Selector */}
          <div>
            <label className="text-[10px] uppercase text-slate-400 block mb-1">Exchange</label>
            <select
              aria-label="Exchange"
              value={exchange}
              onChange={(e) => setExchange(e.target.value as ExchangeId)}
              className="w-full bg-[#0e1420] border border-[#1e2739] text-slate-200 rounded px-2 py-1.5 focus:border-emerald-500/50"
            >
              <option value="MOCK">Mock Demo (Synthetic)</option>
              <option value="BINANCE">Binance Public REST</option>
              <option value="BYBIT">Bybit v5 Public</option>
            </select>
          </div>

          {/* Market Selector */}
          <div>
            <label className="text-[10px] uppercase text-slate-400 block mb-1">Market</label>
            <select
              aria-label="Market"
              value={marketType}
              onChange={(e) => setMarketType(e.target.value as MarketType)}
              className="w-full bg-[#0e1420] border border-[#1e2739] text-slate-200 rounded px-2 py-1.5 focus:border-emerald-500/50"
            >
              <option value="PERPETUAL">Perpetual Futures</option>
              <option value="SPOT">Spot Exchange</option>
            </select>
          </div>

          {/* Symbol Selector */}
          <div>
            <label className="text-[10px] uppercase text-slate-400 block mb-1">Symbol</label>
            <div className="flex gap-1">
              <select
                aria-label="Symbol"
                value={symbol}
                onChange={(e) => {
                  setSymbol(e.target.value);
                  setCustomSymbol('');
                }}
                className="w-full bg-[#0e1420] border border-[#1e2739] text-slate-200 rounded px-2 py-1.5 focus:border-emerald-500/50"
              >
                <option value="BTCUSDT">BTCUSDT</option>
                <option value="ETHUSDT">ETHUSDT</option>
                <option value="SOLUSDT">SOLUSDT</option>
                <option value="CUSTOM">Custom...</option>
              </select>
            </div>
          </div>

          {/* Custom Symbol input if selected */}
          {symbol === 'CUSTOM' && (
            <div>
              <label className="text-[10px] uppercase text-slate-400 block mb-1">Custom Symbol</label>
              <input
                type="text"
                placeholder="e.g. AVAXUSDT"
                value={customSymbol}
                onChange={(e) => setCustomSymbol(e.target.value)}
                className="w-full bg-[#0e1420] border border-[#1e2739] text-slate-200 rounded px-2 py-1.5 focus:border-emerald-500/50 uppercase"
              />
            </div>
          )}

          {/* Timeframe Selector */}
          <div>
            <label className="text-[10px] uppercase text-slate-400 block mb-1">Timeframe</label>
            <select
              aria-label="Timeframe"
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              className="w-full bg-[#0e1420] border border-[#1e2739] text-slate-200 rounded px-2 py-1.5 focus:border-emerald-500/50"
            >
              <option value="1m">1m</option>
              <option value="5m">5m</option>
              <option value="15m">15m</option>
              <option value="1h">1h</option>
              <option value="4h">4h</option>
              <option value="1d">1d</option>
            </select>
          </div>

          {/* Date Start */}
          <div>
            <label className="text-[10px] uppercase text-slate-400 block mb-1">Start Date</label>
            <input
              type="date"
              aria-label="Start Date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-[#0e1420] border border-[#1e2739] text-slate-200 rounded px-2 py-1.5 focus:border-emerald-500/50 text-[11px]"
            />
          </div>

          {/* Date End */}
          <div>
            <label className="text-[10px] uppercase text-slate-400 block mb-1">End Date</label>
            <input
              type="date"
              aria-label="End Date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-[#0e1420] border border-[#1e2739] text-slate-200 rounded px-2 py-1.5 focus:border-emerald-500/50 text-[11px]"
            />
          </div>
        </div>

        {/* ACTION BUTTONS */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#1a2333]">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleFetchData(false)}
              disabled={isLoading}
              className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isLoading ? 'Fetching Data...' : 'Download / Fetch'}</span>
            </button>

            <button
              onClick={() => handleFetchData(true)}
              disabled={isLoading}
              className="px-3 py-1.5 rounded bg-[#162132] hover:bg-[#1d2b42] text-slate-200 border border-[#263752] text-xs flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Force Network Refresh</span>
            </button>

            <button
              onClick={handleValidateCurrent}
              className="px-3 py-1.5 rounded bg-[#162132] hover:bg-[#1d2b42] text-cyan-300 border border-cyan-500/30 text-xs flex items-center gap-1.5 transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
              <span>Validate Dataset</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {isCached && (
              <button
                onClick={handleDeleteCurrentCache}
                className="px-2.5 py-1.5 rounded bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-500/30 text-xs flex items-center gap-1.5 transition-colors"
                title="Delete this dataset from local cache"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Cache</span>
              </button>
            )}

            <button
              onClick={handleClearAllCache}
              className="px-2.5 py-1.5 rounded bg-[#162132] hover:bg-[#202b3d] text-slate-400 hover:text-slate-200 border border-[#222d40] text-xs flex items-center gap-1.5 transition-colors"
              title="Clear all stored datasets"
            >
              <span>Clear All Cache</span>
            </button>
          </div>
        </div>
      </div>

      {/* DATASET STATS CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2.5">
        <div className="p-3 bg-[#0b0f16] rounded border border-[#1b2436] space-y-1">
          <div className="text-[10px] text-slate-400 uppercase font-mono-data">Total Rows</div>
          <div className="text-base font-bold font-mono-data text-slate-100">
            {metadata?.totalBars ?? candles.length}
          </div>
          <div className="text-[10px] text-slate-500">OHLCV Candles</div>
        </div>

        <div className="p-3 bg-[#0b0f16] rounded border border-[#1b2436] space-y-1">
          <div className="text-[10px] text-slate-400 uppercase font-mono-data">Timeline Coverage</div>
          <div className="text-xs font-bold font-mono-data text-slate-200 truncate">
            {candles[0] ? `${candles[0].time.slice(5, 10)} → ${candles[candles.length - 1].time.slice(5, 10)}` : 'N/A'}
          </div>
          <div className="text-[10px] text-slate-500">{timeframe} cadence</div>
        </div>

        <div className="p-3 bg-[#0b0f16] rounded border border-[#1b2436] space-y-1">
          <div className="text-[10px] text-slate-400 uppercase font-mono-data">Missing Intervals</div>
          <div className={`text-base font-bold font-mono-data ${validationReport && validationReport.statistics.missingIntervals > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
            {validationReport?.statistics.missingIntervals ?? 0}
          </div>
          <div className="text-[10px] text-slate-500">Detected Gaps</div>
        </div>

        <div className="p-3 bg-[#0b0f16] rounded border border-[#1b2436] space-y-1">
          <div className="text-[10px] text-slate-400 uppercase font-mono-data">Duplicates</div>
          <div className={`text-base font-bold font-mono-data ${validationReport && validationReport.statistics.duplicateRows > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
            {validationReport?.statistics.duplicateRows ?? 0}
          </div>
          <div className="text-[10px] text-slate-500">Duplicate Timestamps</div>
        </div>

        <div className="p-3 bg-[#0b0f16] rounded border border-[#1b2436] space-y-1">
          <div className="text-[10px] text-slate-400 uppercase font-mono-data">Dataset Checksum</div>
          <div className="text-xs font-bold font-mono-data text-cyan-400">
            {metadata?.checksum || 'N/A'}
          </div>
          <div className="text-[10px] text-slate-500">Hash ID</div>
        </div>

        <div className="p-3 bg-[#0b0f16] rounded border border-[#1b2436] space-y-1">
          <div className="text-[10px] text-slate-400 uppercase font-mono-data">Validation Status</div>
          <div className="flex items-center gap-1 text-xs font-bold font-mono-data">
            {validationReport?.valid ? (
              <span className="text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> PASSED
              </span>
            ) : validationReport && !validationReport.valid ? (
              <span className="text-rose-400 flex items-center gap-1">
                <XCircle className="w-3.5 h-3.5" /> FAILED
              </span>
            ) : (
              <span className="text-slate-400">PENDING</span>
            )}
          </div>
          <div className="text-[10px] text-slate-500">
            {validationReport?.warnings.length ? `${validationReport.warnings.length} warning(s)` : 'No errors'}
          </div>
        </div>

        <div className="p-3 bg-[#0b0f16] rounded border border-[#1b2436] space-y-1">
          <div className="text-[10px] text-slate-400 uppercase font-mono-data">Cache Status</div>
          <div className="text-xs font-bold font-mono-data">
            {isCached ? (
              <span className="text-blue-400">STORED LOCALLY</span>
            ) : (
              <span className="text-slate-400">UNCACHED</span>
            )}
          </div>
          <div className="text-[10px] text-slate-500">{metadata?.schemaVersion || 'v2.1'}</div>
        </div>
      </div>

      {/* Validation Warnings List if any */}
      {validationReport && validationReport.warnings.length > 0 && (
        <div className="p-2.5 bg-amber-950/30 border border-amber-500/40 rounded text-xs space-y-1">
          <div className="text-amber-400 font-semibold flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Validation Warnings Detected in Dataset:</span>
          </div>
          <ul className="list-disc list-inside text-amber-200/90 text-[11px] space-y-0.5 pl-1">
            {validationReport.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* VIEW TABS: Chart vs Table vs Orderbook vs Funding */}
      <div className="flex items-center gap-1 border-b border-[#1b2436] pb-1">
        <button
          onClick={() => setActiveTab('chart')}
          className={`px-3 py-1.5 rounded-t text-xs font-medium transition-colors ${
            activeTab === 'chart'
              ? 'bg-[#162132] text-emerald-400 border-t border-x border-[#24334c]'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Interactive Candle Chart ({candles.length} bars)
        </button>
        <button
          onClick={() => setActiveTab('table')}
          className={`px-3 py-1.5 rounded-t text-xs font-medium transition-colors ${
            activeTab === 'table'
              ? 'bg-[#162132] text-emerald-400 border-t border-x border-[#24334c]'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Raw Normalized Data Table
        </button>
        <button
          onClick={() => setActiveTab('orderbook')}
          className={`px-3 py-1.5 rounded-t text-xs font-medium transition-colors ${
            activeTab === 'orderbook'
              ? 'bg-[#162132] text-emerald-400 border-t border-x border-[#24334c]'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          L2 Order Book Depth
        </button>
        <button
          onClick={() => setActiveTab('funding')}
          className={`px-3 py-1.5 rounded-t text-xs font-medium transition-colors ${
            activeTab === 'funding'
              ? 'bg-[#162132] text-emerald-400 border-t border-x border-[#24334c]'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Perpetual Funding Rate Matrix
        </button>
      </div>

      {/* TAB CONTENT */}
      {activeTab === 'chart' && (
        <div className="p-3.5 bg-[#0b0f16] rounded border border-[#1b2436]">
          {candles.length > 0 ? (
            <TradingCandleChart
              candles={candles}
              symbol={activeSymbol}
              timeframe={timeframe}
              height={440}
            />
          ) : (
            <div className="h-72 flex flex-col items-center justify-center text-slate-500 gap-2">
              <Database className="w-8 h-8 opacity-40" />
              <span>No candles loaded. Select parameters and click &apos;Download / Fetch&apos;.</span>
            </div>
          )}
        </div>
      )}

      {activeTab === 'table' && (
        <div className="bg-[#0b0f16] rounded border border-[#1b2436] overflow-hidden">
          <div className="p-2.5 bg-[#0e1420] border-b border-[#1b2436] flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300">Normalized OHLCV Data Preview (Showing latest 100 rows)</span>
            <span className="font-mono-data text-slate-400 text-[11px]">{candles.length} total rows</span>
          </div>
          <div className="max-h-96 overflow-y-auto font-mono-data text-xs">
            <table className="w-full text-left">
              <thead className="bg-[#0e1420] text-slate-400 border-b border-[#1b2436] text-[10px] uppercase sticky top-0">
                <tr>
                  <th className="py-2 px-3">Timestamp (UTC)</th>
                  <th className="py-2 px-3 text-right">Open</th>
                  <th className="py-2 px-3 text-right">High</th>
                  <th className="py-2 px-3 text-right">Low</th>
                  <th className="py-2 px-3 text-right">Close</th>
                  <th className="py-2 px-3 text-right">Volume</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#162030]">
                {candles.slice(-100).reverse().map((c) => (
                  <tr key={c.timestamp} className="hover:bg-[#121927]">
                    <td className="py-1.5 px-3 text-slate-300">{c.time}</td>
                    <td className="py-1.5 px-3 text-right text-slate-200">{c.open.toFixed(2)}</td>
                    <td className="py-1.5 px-3 text-right text-emerald-400">{c.high.toFixed(2)}</td>
                    <td className="py-1.5 px-3 text-right text-rose-400">{c.low.toFixed(2)}</td>
                    <td className={`py-1.5 px-3 text-right font-semibold ${c.close >= c.open ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {c.close.toFixed(2)}
                    </td>
                    <td className="py-1.5 px-3 text-right text-slate-400">{c.volume.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'orderbook' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="terminal-panel rounded border border-[#1c2436] bg-[#0b0f16] p-3.5 space-y-2">
            <div className="flex items-center justify-between border-b border-[#1c2436] pb-2">
              <h2 className="text-xs font-semibold text-slate-200">{exchange} {activeSymbol} L2 Depth</h2>
              <span className="text-[10px] font-mono-data text-slate-400">Tick: 0.1 USDT</span>
            </div>

            <div className="font-mono-data text-xs space-y-1">
              <div className="grid grid-cols-3 text-slate-500 text-[10px] uppercase pb-1 border-b border-[#162030]">
                <span>Price (USDT)</span>
                <span className="text-right">Size ({activeSymbol.slice(0, 3)})</span>
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
        </div>
      )}

      {activeTab === 'funding' && (
        <div className="terminal-panel rounded border border-[#1c2436] bg-[#0b0f16] p-3.5 space-y-3">
          <div className="flex items-center justify-between border-b border-[#1c2436] pb-2">
            <h2 className="text-xs font-semibold text-slate-200">Perpetual Funding Rates & Basis Arbitrage Matrix</h2>
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
        </div>
      )}
    </div>
  );
};
