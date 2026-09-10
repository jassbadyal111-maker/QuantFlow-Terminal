import React, { useState, useRef, useMemo } from 'react';
import { EquityPoint } from '../../types/backtest';
import { formatCurrency, formatPercent } from '../../utils/formatters';

interface EquityCurveChartProps {
  data: EquityPoint[];
  initialCapital?: number;
  height?: number;
  showBenchmark?: boolean;
}

export const EquityCurveChart: React.FC<EquityCurveChartProps> = ({
  data,
  initialCapital = 100000,
  height = 320,
  showBenchmark = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const { minVal, maxVal, valRange, minDd, maxDd } = useMemo(() => {
    if (data.length === 0) {
      return { minVal: 80000, maxVal: 150000, valRange: 70000, minDd: -15, maxDd: 0 };
    }
    let min = Infinity;
    let max = -Infinity;
    let lowestDd = 0;

    for (const d of data) {
      if (d.equity < min) min = d.equity;
      if (d.equity > max) max = d.equity;
      if (showBenchmark && d.benchmarkEquity < min) min = d.benchmarkEquity;
      if (showBenchmark && d.benchmarkEquity > max) max = d.benchmarkEquity;
      if (d.drawdownPct < lowestDd) lowestDd = d.drawdownPct;
    }

    const pad = (max - min) * 0.08 || 5000;
    return {
      minVal: Math.max(0, min - pad),
      maxVal: max + pad,
      valRange: max - min + pad * 2,
      minDd: Math.min(-5, lowestDd * 1.2),
      maxDd: 0,
    };
  }, [data, showBenchmark]);

  const svgWidth = 800;
  const svgHeight = height;
  const mainChartHeight = svgHeight * 0.72;
  const ddChartHeight = svgHeight * 0.22;
  const ddOffset = svgHeight * 0.76;

  const getX = (index: number) => {
    return (index / (data.length - 1 || 1)) * svgWidth;
  };

  const getY = (val: number) => {
    return mainChartHeight - ((val - minVal) / valRange) * mainChartHeight;
  };

  const getDdY = (dd: number) => {
    // dd is negative, e.g. -8.4
    return ddOffset + (Math.abs(dd) / Math.abs(minDd || 1)) * ddChartHeight;
  };

  // Equity SVG path
  const equityPath = useMemo(() => {
    return data
      .map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d.equity)}`)
      .join(' ');
  }, [data, minVal, valRange, mainChartHeight]);

  // Equity Fill Gradient Area
  const equityAreaPath = useMemo(() => {
    if (data.length === 0) return '';
    return `${equityPath} L ${svgWidth} ${mainChartHeight} L 0 ${mainChartHeight} Z`;
  }, [equityPath, data.length, svgWidth, mainChartHeight]);

  // Benchmark SVG path
  const benchmarkPath = useMemo(() => {
    if (!showBenchmark) return '';
    return data
      .map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d.benchmarkEquity)}`)
      .join(' ');
  }, [data, showBenchmark, minVal, valRange, mainChartHeight]);

  // Drawdown Area Path
  const ddAreaPath = useMemo(() => {
    if (data.length === 0) return '';
    const points = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getDdY(d.drawdownPct)}`);
    return `${points.join(' ')} L ${svgWidth} ${ddOffset} L 0 ${ddOffset} Z`;
  }, [data, minDd, ddOffset, ddChartHeight, svgWidth]);

  const activePoint = hoverIndex !== null && data[hoverIndex] ? data[hoverIndex] : data[data.length - 1];

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const idx = Math.round((x / rect.width) * (data.length - 1));
    if (idx >= 0 && idx < data.length) {
      setHoverIndex(idx);
    }
  };

  return (
    <div className="terminal-panel rounded border border-[#1c2436] bg-[#0b0f16] overflow-hidden select-none">
      {/* Top Header info */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#1c2436] bg-[#090d14] text-xs font-mono-data">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
            <span className="font-semibold text-slate-100">Strategy Equity</span>
            <span className="text-emerald-400 font-bold">
              {activePoint ? formatCurrency(activePoint.equity) : '$0'}
            </span>
          </div>

          {showBenchmark && (
            <div className="flex items-center gap-2 text-slate-400">
              <span className="w-2.5 h-0.5 bg-slate-500"></span>
              <span>BTC Benchmark:</span>
              <span className="text-slate-300">
                {activePoint ? formatCurrency(activePoint.benchmarkEquity) : '$0'}
              </span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className="text-slate-400">Drawdown:</span>
            <span className="text-rose-400 font-bold">
              {activePoint ? formatPercent(activePoint.drawdownPct) : '0%'}
            </span>
          </div>
        </div>

        <div className="text-[11px] text-slate-400">
          {activePoint?.time || '---'}
        </div>
      </div>

      {/* SVG Canvas Area */}
      <div ref={containerRef} className="relative w-full bg-[#090d14]" style={{ height }}>
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-full cursor-crosshair"
          preserveAspectRatio="none"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIndex(null)}
        >
          <defs>
            <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.0" />
              <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.35" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line x1="0" y1={mainChartHeight * 0.25} x2={svgWidth} y2={mainChartHeight * 0.25} stroke="#151e2c" strokeDasharray="3 3" />
          <line x1="0" y1={mainChartHeight * 0.5} x2={svgWidth} y2={mainChartHeight * 0.5} stroke="#151e2c" strokeDasharray="3 3" />
          <line x1="0" y1={mainChartHeight * 0.75} x2={svgWidth} y2={mainChartHeight * 0.75} stroke="#151e2c" strokeDasharray="3 3" />

          {/* Equity Fill Area */}
          <path d={equityAreaPath} fill="url(#equityGrad)" />

          {/* Benchmark Line */}
          {showBenchmark && (
            <path
              d={benchmarkPath}
              fill="none"
              stroke="#64748b"
              strokeWidth="1.5"
              strokeDasharray="4 4"
              opacity="0.7"
            />
          )}

          {/* Strategy Equity Curve Line */}
          <path
            d={equityPath}
            fill="none"
            stroke="#10b981"
            strokeWidth="2"
            strokeLinecap="round"
          />

          {/* Drawdown Section Divider */}
          <line x1="0" y1={ddOffset} x2={svgWidth} y2={ddOffset} stroke="#1c2436" strokeWidth="1" />
          <text x="6" y={ddOffset - 5} fill="#4e5c72" fontSize="9" fontFamily="JetBrains Mono">
            UNDERWATER DRAWDOWN (%)
          </text>

          {/* Drawdown Area */}
          <path d={ddAreaPath} fill="url(#ddGrad)" />
          <path
            d={data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getDdY(d.drawdownPct)}`).join(' ')}
            fill="none"
            stroke="#f43f5e"
            strokeWidth="1.2"
          />

          {/* Hover Crosshair */}
          {hoverIndex !== null && data[hoverIndex] && (
            <g>
              <line
                x1={getX(hoverIndex)}
                y1="0"
                x2={getX(hoverIndex)}
                y2={svgHeight}
                stroke="#334155"
                strokeWidth="1"
                strokeDasharray="2 2"
              />
              <circle
                cx={getX(hoverIndex)}
                cy={getY(data[hoverIndex].equity)}
                r="4"
                fill="#10b981"
                stroke="#090d14"
                strokeWidth="2"
              />
            </g>
          )}
        </svg>
      </div>
    </div>
  );
};
