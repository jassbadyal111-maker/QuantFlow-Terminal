import React from 'react';
import { Info } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  change?: string;
  isPositive?: boolean;
  tooltip?: string;
  variant?: 'neutral' | 'success' | 'danger' | 'highlight';
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  subtext,
  change,
  isPositive,
  tooltip,
  variant = 'neutral',
}) => {
  return (
    <div className="terminal-panel rounded p-3 border border-[#1a2333] hover:border-[#27354c] transition-colors relative group select-none">
      <div className="flex items-center justify-between text-[11px] font-sans text-slate-400 mb-1">
        <span className="font-medium tracking-tight uppercase text-[10px] text-slate-400">{label}</span>
        {tooltip && (
          <div className="relative cursor-help">
            <Info className="w-3 h-3 text-slate-400 hover:text-slate-300 transition-colors" />
            <div className="absolute right-0 bottom-full mb-1 hidden group-hover:block z-40 w-48 p-2 rounded bg-[#111724] border border-[#232f46] text-[10px] text-slate-300 font-sans shadow-xl leading-relaxed">
              {tooltip}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-baseline justify-between gap-1.5">
        <div
          className={`font-mono-data text-xl font-bold tracking-tight ${
            variant === 'success' || isPositive === true
              ? 'text-emerald-400'
              : variant === 'danger' || isPositive === false
              ? 'text-rose-400'
              : 'text-slate-100'
          }`}
        >
          {value}
        </div>

        {change && (
          <span
            className={`text-[10px] font-mono-data px-1.5 py-0.2 rounded font-medium ${
              isPositive
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
            }`}
          >
            {change}
          </span>
        )}
      </div>

      {subtext && (
        <div className="mt-1 text-[10px] font-mono-data text-slate-400 truncate">
          {subtext}
        </div>
      )}
    </div>
  );
};
