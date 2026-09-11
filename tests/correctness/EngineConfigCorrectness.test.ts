import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createMarketDataProvider } from '../../src/data/MarketDataProvider';

describe('production data mode contracts', () => {
  it('rejects unknown providers instead of silently falling back to synthetic data', () => {
    assert.throws(() => createMarketDataProvider('unknown-exchange'), /Unsupported market-data provider/);
  });

  it('requires mock data to be explicitly selected', () => {
    assert.equal(createMarketDataProvider('mock').isSynthetic, true);
    assert.equal(createMarketDataProvider('binance').isSynthetic, false);
    assert.equal(createMarketDataProvider('bybit').isSynthetic, false);
  });
});
