import { tokenBucket } from '@yuants/utils';
import { getRestBaseWeight, getRestEstimatedExtraWeight, getRestRequestContext } from './rate-limit';

describe('rate-limit', () => {
  afterAll(() => {
    const bucket = tokenBucket('HYPERLIQUID_REST_IP_WEIGHT_1200_PER_MIN');
    bucket[Symbol.dispose]();
  });

  it('calculates info base weight', () => {
    const ctx = getRestRequestContext('POST', 'info', { type: 'allMids' });
    expect(getRestBaseWeight(ctx)).toBe(2);
  });

  it('calculates exchange base weight from batch length', () => {
    const ctx = getRestRequestContext('POST', 'exchange', {
      action: { type: 'order', orders: new Array(79).fill({}) },
    });
    expect(getRestBaseWeight(ctx)).toBe(2);
  });

  it('estimates candleSnapshot extra weight with 5000 cap', () => {
    const intervalMs = 60_000;
    const candles = 10_000;
    const ctx = getRestRequestContext('POST', 'info', {
      type: 'candleSnapshot',
      req: { interval: '1m', startTime: 0, endTime: candles * intervalMs },
    });
    expect(getRestEstimatedExtraWeight(ctx)).toBe(Math.ceil(5000 / 60));
  });
});
