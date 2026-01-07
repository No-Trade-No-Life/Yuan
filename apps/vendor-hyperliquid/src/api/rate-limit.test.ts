import { tokenBucket } from '@yuants/utils';
import {
  afterRestResponse,
  beforeRestRequest,
  getRestBaseWeight,
  getRestEstimatedExtraWeight,
  getRestRequestContext,
} from './rate-limit';

describe('rate-limit', () => {
  const bucketId = 'HYPERLIQUID_REST_IP_WEIGHT_1200_PER_MIN';
  const readBucket = () => tokenBucket(bucketId).read();

  afterAll(() => {
    const bucket = tokenBucket(bucketId);
    bucket[Symbol.dispose]();
  });

  it('parses rest request context', () => {
    const infoCtx = getRestRequestContext('POST', 'info', { type: 'allMids' });
    expect(infoCtx.kind).toBe('info');
    expect(infoCtx.infoType).toBe('allMids');

    const exchangeCtx = getRestRequestContext('POST', 'exchange', {
      action: { type: 'order', orders: [{}, {}] },
    });
    expect(exchangeCtx.kind).toBe('exchange');
    expect(exchangeCtx.exchangeActionType).toBe('order');
    expect(exchangeCtx.exchangeBatchLength).toBe(2);

    const explorerCtx = getRestRequestContext('GET', 'explorer/tx/0x', undefined);
    expect(explorerCtx.kind).toBe('explorer');
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

    const ctxBoundary = getRestRequestContext('POST', 'exchange', {
      action: { type: 'order', orders: new Array(80).fill({}) },
    });
    expect(getRestBaseWeight(ctxBoundary)).toBe(3);
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

  it('consumes base and estimated weight before request', () => {
    const ctx = getRestRequestContext('POST', 'info', {
      type: 'candleSnapshot',
      req: { interval: '1m', startTime: 0, endTime: 120 * 60_000 },
    });
    const before = readBucket();
    const { baseWeight, estimatedExtraWeight } = beforeRestRequest({ requestKey: 'test' }, ctx);
    const after = readBucket();
    expect(baseWeight).toBe(20);
    expect(estimatedExtraWeight).toBe(2);
    expect(after).toBe(before - baseWeight - estimatedExtraWeight);
  });

  it('applies extra weight based on response size', async () => {
    const ctx = getRestRequestContext('POST', 'info', { type: 'userFills' });
    const response = { fills: new Array(41).fill({}) };

    const before = readBucket();
    await afterRestResponse({ requestKey: 'test' }, ctx, response, 0);
    const after = readBucket();
    expect(before - after).toBe(Math.ceil(41 / 20));
  });

  it('skips extra acquire when response weight is within estimate', async () => {
    const ctx = getRestRequestContext('POST', 'info', { type: 'userFills' });
    const response = { fills: [{}] };

    const before = readBucket();
    await afterRestResponse({ requestKey: 'test' }, ctx, response, 1);
    const after = readBucket();
    expect(after).toBe(before);
  });
});
