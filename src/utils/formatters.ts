/**
 * Quant Financial Formatters for ApexQuant Terminal
 */

export function formatCurrency(value: number, decimals: number = 2): string {
  if (isNaN(value) || value === null || value === undefined) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatCompactUSD(value: number): string {
  if (isNaN(value)) return '$0';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000_000) {
    return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B`;
  }
  if (abs >= 1_000_000) {
    return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  }
  if (abs >= 1_000) {
    return `${sign}$${(abs / 1_000).toFixed(1)}k`;
  }
  return `${sign}$${abs.toFixed(2)}`;
}

export function formatPercent(value: number, withSign: boolean = true, decimals: number = 2): string {
  if (isNaN(value) || value === null || value === undefined) return '0.00%';
  const sign = withSign && value > 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
}

export function formatNumber(value: number, decimals: number = 2): string {
  if (isNaN(value) || value === null || value === undefined) return '0.00';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatBps(value: number): string {
  if (isNaN(value)) return '0.0 bps';
  return `${value.toFixed(1)} bps`;
}

export function formatCryptoQty(qty: number, symbol: string): string {
  if (isNaN(qty)) return '0';
  const decimals = symbol.includes('BTC') ? 4 : symbol.includes('ETH') ? 3 : 2;
  return `${qty.toFixed(decimals)} ${symbol.split('/')[0]}`;
}

export function getPnlTextColor(val: number): string {
  if (val > 0.0001) return 'text-emerald-400';
  if (val < -0.0001) return 'text-rose-400';
  return 'text-slate-400';
}

export function getPnlBgColor(val: number): string {
  if (val > 0.0001) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
  if (val < -0.0001) return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
  return 'bg-slate-800/40 text-slate-400 border-slate-700/30';
}
