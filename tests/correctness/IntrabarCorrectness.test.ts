import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

interface Candle { open:number; high:number; low:number; close:number }
function conservativeLongExit(bar:Candle, stop:number, takeProfit:number): {price:number;reason:'STOP_LOSS'|'TAKE_PROFIT'}|null {
  if (bar.open <= stop) return { price: bar.open, reason: 'STOP_LOSS' };
  if (bar.low <= stop) return { price: stop, reason: 'STOP_LOSS' };
  if (bar.open >= takeProfit) return { price: bar.open, reason: 'TAKE_PROFIT' };
  if (bar.high >= takeProfit) return { price: takeProfit, reason: 'TAKE_PROFIT' };
  return null;
}

describe('intrabar ambiguity', () => {
  it('chooses the stop first when both stop and target are touched', () => {
    const result = conservativeLongExit({ open:100, high:110, low:90, close:105 }, 95, 108);
    assert.deepEqual(result, { price:95, reason:'STOP_LOSS' });
  });

  it('fills a gap-through stop at the bar open', () => {
    const result = conservativeLongExit({ open:92, high:96, low:90, close:94 }, 95, 108);
    assert.deepEqual(result, { price:92, reason:'STOP_LOSS' });
  });
});
