/**
 * Deterministic quantitative indicator calculations
 * Implemented with zero external dependencies for maximum speed & reproducibility
 */

export class Indicators {
  /**
   * Exponential Moving Average
   */
  static ema(values: number[], period: number): (number | undefined)[] {
    if (period <= 0 || values.length === 0) return [];
    const result: (number | undefined)[] = new Array(values.length).fill(undefined);
    const k = 2 / (period + 1);

    // Initial SMA
    if (values.length < period) return result;
    let sum = 0;
    for (let i = 0; i < period; i++) {
      sum += values[i];
    }
    let prevEma = sum / period;
    result[period - 1] = prevEma;

    for (let i = period; i < values.length; i++) {
      const currentEma = values[i] * k + prevEma * (1 - k);
      result[i] = currentEma;
      prevEma = currentEma;
    }
    return result;
  }

  /**
   * Simple Moving Average
   */
  static sma(values: number[], period: number): (number | undefined)[] {
    const result: (number | undefined)[] = new Array(values.length).fill(undefined);
    if (period <= 0 || values.length < period) return result;

    let sum = 0;
    for (let i = 0; i < period; i++) {
      sum += values[i];
    }
    result[period - 1] = sum / period;

    for (let i = period; i < values.length; i++) {
      sum += values[i] - values[i - period];
      result[i] = sum / period;
    }
    return result;
  }

  /**
   * Average True Range (Wilder's Smoothing)
   */
  static atr(highs: number[], lows: number[], closes: number[], period: number = 14): (number | undefined)[] {
    const len = highs.length;
    const result: (number | undefined)[] = new Array(len).fill(undefined);
    if (len <= period) return result;

    const trs: number[] = new Array(len);
    trs[0] = highs[0] - lows[0];
    for (let i = 1; i < len; i++) {
      const tr = Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      );
      trs[i] = tr;
    }

    // Initial ATR
    let sum = 0;
    for (let i = 0; i < period; i++) {
      sum += trs[i];
    }
    let prevAtr = sum / period;
    result[period - 1] = prevAtr;

    for (let i = period; i < len; i++) {
      const currentAtr = (prevAtr * (period - 1) + trs[i]) / period;
      result[i] = currentAtr;
      prevAtr = currentAtr;
    }
    return result;
  }

  /**
   * Relative Strength Index (Cutler/Wilder formulation)
   */
  static rsi(closes: number[], period: number = 14): (number | undefined)[] {
    const len = closes.length;
    const result: (number | undefined)[] = new Array(len).fill(undefined);
    if (len <= period) return result;

    let gains = 0;
    let losses = 0;
    for (let i = 1; i <= period; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff >= 0) gains += diff;
      else losses += Math.abs(diff);
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;
    let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result[period] = 100 - (100 / (1 + rs));

    for (let i = period + 1; i < len; i++) {
      const diff = closes[i] - closes[i - 1];
      const gain = diff > 0 ? diff : 0;
      const loss = diff < 0 ? Math.abs(diff) : 0;

      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;

      if (avgLoss === 0) {
        result[i] = 100;
      } else {
        rs = avgGain / avgLoss;
        result[i] = 100 - (100 / (1 + rs));
      }
    }
    return result;
  }

  /**
   * Bollinger Bands
   */
  static bollingerBands(
    closes: number[],
    period: number = 20,
    stdDevMult: number = 2.0
  ): { upper: (number | undefined)[]; middle: (number | undefined)[]; lower: (number | undefined)[] } {
    const len = closes.length;
    const upper = new Array(len).fill(undefined);
    const middle = new Array(len).fill(undefined);
    const lower = new Array(len).fill(undefined);

    const smas = this.sma(closes, period);

    for (let i = period - 1; i < len; i++) {
      const m = smas[i];
      if (m === undefined) continue;
      middle[i] = m;

      // Variance calculation
      let sumSq = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sumSq += Math.pow(closes[j] - m, 2);
      }
      const sd = Math.sqrt(sumSq / period);
      upper[i] = m + stdDevMult * sd;
      lower[i] = m - stdDevMult * sd;
    }

    return { upper, middle, lower };
  }
}
