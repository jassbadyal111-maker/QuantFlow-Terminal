import React, { useState, useRef, useMemo } from 'react';
import { CandleData, TradeMarker } from '../../types/backtest';
import { formatCurrency, formatCompactUSD } from '../../utils/formatters';
import { Eye, EyeOff, ZoomIn, ZoomOut, RotateCcw, Maximize2 } from 'lucide-react';

interface TradingCandleChartProps {
  candles: CandleData[];
  symbol: string;
  timeframe: string;
  height?: number;
}

export const TradingCandleChart: React.FC<TradingCandleChartProps> = ({
  candles,
  symbol,
  timeframe,
  height = 420,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [showIndicators, setShowIndicators] = useState(true);
  const [showVolume, setShowVolume] = useState(true);
  const [showMarkers, setShowMarkers] = useState(true);
  const [visibleCount, setVisibleCount] = useState(70);

  // Take the most recent visibleCount candles
  const displayedCandles = useMemo(() => {
    return candles.slice(Math.max(0, candles.length - visibleCount));
  }, [candles, visibleCount]);

  // Compute price and volume bounds
  const { minPrice, maxPrice, maxVolume, priceRange } = useMemo(() => {
    if (displayedCandles.length === 0) {
      return { minPrice: 0, maxPrice: 100, maxVolume: 100, priceRange: 100 };
    }
    let min = Infinity;
    let max = -Infinity;
    let maxVol = 0;

    for (const c of displayedCandles) {
      if (c.low < min) min = c.low;
      if (c.high > max) max = c.high;
      if (c.volume > maxVol) maxVol = c.volume;
      if (showIndicators) {
        if (c.emaFast && c.emaFast < min) min = c.emaFast;
        if (c.emaFast && c.emaFast > max) max = c.emaFast;
        if (c.emaSlow && c.emaSlow < min) min = c.emaSlow;
        if (c.emaSlow && c.emaSlow > max) max = c.emaSlow;
      }
    }

    // Add padding
    const pad = (max - min) * 0.05 || 10;
    return {
      minPrice: min - pad,
      maxPrice: max + pad,
      maxVolume: maxVol * 1.2 || 100,
      priceRange: max - min + pad * 2,
    };
  }, [displayedCandles, showIndicators]);

  // SVG dimensions
  const svgWidth = 900;
  const svgHeight = height;
  const priceChartHeight = showVolume ? svgHeight * 0.76 : svgHeight * 0.92;
  const volumeChartHeight = svgHeight * 0.18;
  const volumeYOffset = svgHeight * 0.8;
  const candleSpacing = svgWidth / (displayedCandles.length || 1);
  const candleWidth = Math.max(2, Math.min(10, candleSpacing * 0.65));

  // Coordinate transforms
  const getY = (price: number) => {
    return priceChartHeight - ((price - minPrice) / priceRange) * priceChartHeight;
  };

  const getVolY = (vol: number) => {
    return svgHeight - (vol / maxVolume) * volumeChartHeight;
  };

  // Hovered candle data
  const activeCandle = hoverIndex !== null && displayedCandles[hoverIndex]
    ? displayedCandles[hoverIndex]
    : displayedCandles[displayedCandles.length - 1];

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const index = Math.floor((x / rect.width) * displayedCandles.length);
    if (index >= 0 && index < displayedCandles.length) {
      setHoverIndex(index);
    }
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
  };

  // Price ticks for Y-axis (5 intervals)
  const priceTicks = useMemo(() => {
    const ticks = [];
    const step = priceRange / 5;
    for (let i = 0; i <= 5; i++) {
      const price = minPrice + step * i;
      ticks.push({ price, y: getY(price) });
    }
    return ticks;
  }, [minPrice, priceRange, priceChartHeight]);

  // EMA path generators
  const fastEmaPath = useMemo(() => {
    if (!showIndicators) return '';
    return displayedCandles
      .map((c, i) => {
        if (!c.emaFast) return '';
        const x = i * candleSpacing + candleSpacing / 2;
        const y = getY(c.emaFast);
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');
  }, [displayedCandles, showIndicators, candleSpacing, priceRange, minPrice]);

  const slowEmaPath = useMemo(() => {
    if (!showIndicators) return '';
    return displayedCandles
      .map((c, i) => {
        if (!c.emaSlow) return '';
        const x = i * candleSpacing + candleSpacing / 2;
        const y = getY(c.emaSlow);
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');
  }, [displayedCandles, showIndicators, candleSpacing, priceRange, minPrice]);

  return (
    <div className="terminal-panel rounded border border-[#1c2436] flex flex-col bg-[#0b0f16] overflow-hidden select-none">
      {/* Chart Top Bar: Symbol info & Active Candle OHLCV */}
      <div className="flex flex-wrap items-center justify-between px-3 py-2 border-b border-[#1c2436] bg-[#090d14] text-xs font-mono-data">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-100 text-sm">{symbol}</span>
            <span className="px-1.5 py-0.2 rounded bg-[#162132] text-slate-400 text-[10px] border border-[#202d42]">
              {timeframe}
            </span>
            <span className="text-[10px] text-emerald-400 font-semibold px-1 rounded bg-emerald-500/10">
              PERPETUAL
            </span>
          </div>

          {activeCandle && (
            <div className="hidden sm:flex items-center gap-2.5 text-[11px]">
              <span className="text-slate-400">
                O: <span className="text-slate-200">{formatCurrency(activeCandle.open)}</span>
              </span>
              <span className="text-slate-400">
                H: <span className="text-emerald-400">{formatCurrency(activeCandle.high)}</span>
              </span>
              <span className="text-slate-400">
                L: <span className="text-rose-400">{formatCurrency(activeCandle.low)}</span>
              </span>
              <span className="text-slate-400">
                C:{' '}
                <span
                  className={
                    activeCandle.close >= activeCandle.open ? 'text-emerald-400' : 'text-rose-400'
                  }
                >
                  {formatCurrency(activeCandle.close)}
                </span>
              </span>
              <span className="text-slate-400">
                Vol: <span className="text-slate-200">{formatCompactUSD(activeCandle.volume * activeCandle.close)}</span>
              </span>
            </div>
          )}
        </div>

        {/* Indicator Toggles & Zoom */}
        <div className="flex items-center gap-1 text-[11px]">
          <button
            onClick={() => setShowIndicators(!showIndicators)}
            className={`px-2 py-0.5 rounded border transition-colors flex items-center gap-1 ${
              showIndicators
                ? 'bg-[#182335] text-cyan-400 border-[#2b3a52]'
                : 'text-slate-400 border-transparent hover:text-slate-300'
            }`}
            title="Toggle EMA 21 / EMA 55 Indicators"
          >
            <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
            <span>EMA 21/55</span>
          </button>

          <button
            onClick={() => setShowVolume(!showVolume)}
            className={`px-2 py-0.5 rounded border transition-colors flex items-center gap-1 ${
              showVolume
                ? 'bg-[#182335] text-slate-200 border-[#2b3a52]'
                : 'text-slate-400 border-transparent hover:text-slate-300'
            }`}
            title="Toggle Volume Sub-chart"
          >
            <span>VOL</span>
          </button>

          <button
            onClick={() => setShowMarkers(!showMarkers)}
            className={`px-2 py-0.5 rounded border transition-colors flex items-center gap-1 ${
              showMarkers
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                : 'text-slate-400 border-transparent hover:text-slate-300'
            }`}
            title="Toggle Trade Execution Buy/Sell Markers"
          >
            <span>SIGNALS</span>
          </button>

          <div className="h-3 w-[1px] bg-[#1f293d] mx-1"></div>

          <button
            onClick={() => setVisibleCount((prev) => Math.min(120, prev + 20))}
            className="p-1 rounded hover:bg-[#151f30] text-slate-400 hover:text-slate-200"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setVisibleCount((prev) => Math.max(30, prev - 15))}
            className="p-1 rounded hover:bg-[#151f30] text-slate-400 hover:text-slate-200"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setVisibleCount(70)}
            className="p-1 rounded hover:bg-[#151f30] text-slate-400 hover:text-slate-200"
            title="Reset Zoom"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* SVG Canvas Area */}
      <div ref={containerRef} className="relative w-full overflow-hidden bg-[#090d14]" style={{ height }}>
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-full cursor-crosshair"
          preserveAspectRatio="none"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <defs>
            {/* Volume bar gradient */}
            <linearGradient id="volGreen" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.08" />
            </linearGradient>
            <linearGradient id="volRed" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.08" />
            </linearGradient>
          </defs>

          {/* Horizontal Price Grid Lines */}
          {priceTicks.map((tick, i) => (
            <g key={i}>
              <line
                x1="0"
                y1={tick.y}
                x2={svgWidth}
                y2={tick.y}
                stroke="#171f2d"
                strokeDasharray="3 3"
                strokeWidth="1"
              />
              <text
                x={svgWidth - 6}
                y={tick.y - 3}
                fill="#4e5c72"
                fontSize="10"
                fontFamily="JetBrains Mono"
                textAnchor="end"
              >
                {tick.price.toFixed(1)}
              </text>
            </g>
          ))}

          {/* Volume baseline separator line */}
          {showVolume && (
            <line
              x1="0"
              y1={volumeYOffset}
              x2={svgWidth}
              y2={volumeYOffset}
              stroke="#1b2434"
              strokeWidth="1"
            />
          )}

          {/* Volume Bars */}
          {showVolume &&
            displayedCandles.map((c, i) => {
              const x = i * candleSpacing + (candleSpacing - candleWidth) / 2;
              const y = getVolY(c.volume);
              const barHeight = svgHeight - y;
              const isUp = c.close >= c.open;
              return (
                <rect
                  key={`vol-${i}`}
                  x={x}
                  y={y}
                  width={candleWidth}
                  height={barHeight}
                  fill={isUp ? 'url(#volGreen)' : 'url(#volRed)'}
                />
              );
            })}

          {/* EMA Indicator Overlays */}
          {showIndicators && fastEmaPath && (
            <path
              d={fastEmaPath}
              fill="none"
              stroke="#38bdf8"
              strokeWidth="1.5"
              strokeLinecap="round"
              opacity="0.85"
            />
          )}
          {showIndicators && slowEmaPath && (
            <path
              d={slowEmaPath}
              fill="none"
              stroke="#f59e0b"
              strokeWidth="1.5"
              strokeLinecap="round"
              opacity="0.8"
            />
          )}

          {/* Candlesticks (Wick & Body) */}
          {displayedCandles.map((c, i) => {
            const xCenter = i * candleSpacing + candleSpacing / 2;
            const xLeft = xCenter - candleWidth / 2;
            const yHigh = getY(c.high);
            const yLow = getY(c.low);
            const yOpen = getY(c.open);
            const yClose = getY(c.close);

            const isUp = c.close >= c.open;
            const candleColor = isUp ? '#10b981' : '#f43f5e';
            const bodyTop = Math.min(yOpen, yClose);
            const bodyHeight = Math.max(1.5, Math.abs(yOpen - yClose));

            return (
              <g key={`candle-${i}`}>
                {/* High/Low Wick */}
                <line
                  x1={xCenter}
                  y1={yHigh}
                  x2={xCenter}
                  y2={yLow}
                  stroke={candleColor}
                  strokeWidth="1.2"
                />
                {/* Open/Close Candle Body */}
                <rect
                  x={xLeft}
                  y={bodyTop}
                  width={candleWidth}
                  height={bodyHeight}
                  fill={candleColor}
                  stroke={candleColor}
                  strokeWidth="0.5"
                  rx="0.5"
                />

                {/* Trade Execution Signal Markers */}
                {showMarkers && c.marker && (
                  <g>
                    {c.marker.side === 'BUY' && (
                      <polygon
                        points={`${xCenter},${yLow + 12} ${xCenter - 5},${yLow + 20} ${xCenter + 5},${yLow + 20}`}
                        fill="#10b981"
                        stroke="#059669"
                        strokeWidth="1"
                      />
                    )}
                    {c.marker.side === 'SELL' && (
                      <polygon
                        points={`${xCenter},${yHigh - 12} ${xCenter - 5},${yHigh - 20} ${xCenter + 5},${yHigh - 20}`}
                        fill="#f43f5e"
                        stroke="#e11d48"
                        strokeWidth="1"
                      />
                    )}
                    {c.marker.side === 'EXIT' && (
                      <circle
                        cx={xCenter}
                        cy={c.marker.position === 'aboveBar' ? yHigh - 14 : yLow + 14}
                        r="4"
                        fill={c.marker.pnl && c.marker.pnl > 0 ? '#38bdf8' : '#f43f5e'}
                        stroke="#0f172a"
                        strokeWidth="1.5"
                      />
                    )}
                  </g>
                )}
              </g>
            );
          })}

          {/* Interactive Crosshair & Tooltip */}
          {hoverIndex !== null && displayedCandles[hoverIndex] && (
            <g>
              {/* Vertical crosshair line */}
              <line
                x1={hoverIndex * candleSpacing + candleSpacing / 2}
                y1="0"
                x2={hoverIndex * candleSpacing + candleSpacing / 2}
                y2={svgHeight}
                stroke="#334155"
                strokeWidth="1"
                strokeDasharray="2 2"
              />
              {/* Horizontal crosshair line at hovered close */}
              <line
                x1="0"
                y1={getY(displayedCandles[hoverIndex].close)}
                x2={svgWidth}
                y2={getY(displayedCandles[hoverIndex].close)}
                stroke="#334155"
                strokeWidth="1"
                strokeDasharray="2 2"
              />
              {/* Active Marker Label Box if exists */}
              {displayedCandles[hoverIndex].marker && (
                <g>
                  <rect
                    x={Math.min(svgWidth - 160, Math.max(10, hoverIndex * candleSpacing - 60))}
                    y="10"
                    width="140"
                    height="24"
                    fill="#0f172a"
                    stroke="#38bdf8"
                    strokeWidth="1"
                    rx="3"
                  />
                  <text
                    x={Math.min(svgWidth - 160, Math.max(10, hoverIndex * candleSpacing - 60)) + 70}
                    y="26"
                    fill="#38bdf8"
                    fontSize="10"
                    fontFamily="JetBrains Mono"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    {displayedCandles[hoverIndex].marker?.text}
                  </text>
                </g>
              )}
            </g>
          )}
        </svg>

        {/* Floating Indicator Legend */}
        {showIndicators && (
          <div className="absolute top-2 left-3 flex items-center gap-3 bg-[#0a0e16]/80 backdrop-blur-xs px-2 py-1 rounded border border-[#1c2436] text-[10px] font-mono-data">
            <span className="flex items-center gap-1 text-cyan-400">
              <span className="w-2 h-0.5 bg-cyan-400"></span>
              EMA 21: {activeCandle?.emaFast?.toFixed(1) || '---'}
            </span>
            <span className="flex items-center gap-1 text-amber-400">
              <span className="w-2 h-0.5 bg-amber-400"></span>
              EMA 55: {activeCandle?.emaSlow?.toFixed(1) || '---'}
            </span>
          </div>
        )}

        {/* Hover Date Timestamp Pill */}
        {hoverIndex !== null && displayedCandles[hoverIndex] && (
          <div className="absolute bottom-1 right-3 bg-[#0a0e16]/90 border border-[#1e2739] px-2 py-0.5 rounded text-[10px] font-mono-data text-slate-300">
            {displayedCandles[hoverIndex].time}
          </div>
        )}
      </div>
    </div>
  );
};
