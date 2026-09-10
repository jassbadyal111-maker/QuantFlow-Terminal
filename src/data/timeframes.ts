export const TIMEFRAME_MS={ '1m':60000,'5m':300000,'15m':900000,'1h':3600000,'4h':14400000,'1d':86400000 } as const;
export function intervalMs(timeframe:string){if(!(timeframe in TIMEFRAME_MS))throw new Error(`Unsupported timeframe: ${timeframe}`);return TIMEFRAME_MS[timeframe as keyof typeof TIMEFRAME_MS];}
