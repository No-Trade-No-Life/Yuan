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

  it('defaults base weight for unknown info type', () => {
    const ctx = getRestRequestContext('POST', 'info', { type: 'unknownType' });
    expect(getRestBaseWeight(ctx)).toBe(20);
  });

  it('assigns base weight for explorer and other requests', () => {
    const explorerCtx = getRestRequestContext('GET', 'explorer/tx/0x', undefined);
    expect(getRestBaseWeight(explorerCtx)).toBe(40);

    const otherCtx = getRestRequestContext('GET', 'status', undefined);
    expect(getRestBaseWeight(otherCtx)).toBe(20);
  });

  it('calculates exchange base weight across batch sizes', () => {
    const cases = [
      { batchLength: 0, expected: 1 },
      { batchLength: 1, expected: 1 },
      { batchLength: 40, expected: 2 },
      { batchLength: 41, expected: 2 },
      { batchLength: 80, expected: 3 },
    ];

    for (const { batchLength, expected } of cases) {
      const ctx = getRestRequestContext('POST', 'exchange', {
        action: { type: 'order', orders: new Array(batchLength).fill({}) },
      });
      expect(getRestBaseWeight(ctx)).toBe(expected);
    }
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

  it('returns zero extra weight for invalid candleSnapshot inputs', () => {
    const invalidIntervalCtx = getRestRequestContext('POST', 'info', {
      type: 'candleSnapshot',
      req: { interval: '2m', startTime: 0, endTime: 60_000 },
    });
    expect(getRestEstimatedExtraWeight(invalidIntervalCtx)).toBe(0);

    const sameTimeCtx = getRestRequestContext('POST', 'info', {
      type: 'candleSnapshot',
      req: { interval: '1m', startTime: 0, endTime: 0 },
    });
    expect(getRestEstimatedExtraWeight(sameTimeCtx)).toBe(0);

    const missingReqCtx = getRestRequestContext('POST', 'info', { type: 'candleSnapshot' });
    expect(getRestEstimatedExtraWeight(missingReqCtx)).toBe(0);
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

  it('throws on invalid or excessive weights before request', () => {
    const invalidCtx = {
      method: 'POST',
      path: 'exchange',
      kind: 'exchange',
      exchangeBatchLength: Number.NaN,
    } as ReturnType<typeof getRestRequestContext>;
    expect(() => beforeRestRequest({ requestKey: 'test' }, invalidCtx)).toThrow(
      /HYPERLIQUID_REST_WEIGHT_INVALID/,
    );

    const maxWeight = 1200 * 10;
    const excessiveCtx = {
      method: 'POST',
      path: 'exchange',
      kind: 'exchange',
      exchangeBatchLength: (maxWeight + 1) * 40,
    } as ReturnType<typeof getRestRequestContext>;
    expect(() => beforeRestRequest({ requestKey: 'test' }, excessiveCtx)).toThrow(
      /HYPERLIQUID_REST_WEIGHT_EXCESSIVE/,
    );
  });

  it('applies extra weight based on response size', async () => {
    const ctx = getRestRequestContext('POST', 'info', { type: 'userFills' });
    const response = { fills: new Array(41).fill({}) };

    const before = readBucket();
    await afterRestResponse({ requestKey: 'test' }, ctx, response, 0);
    const after = readBucket();
    expect(before - after).toBe(Math.ceil(41 / 20));
  });

  it('applies delta extra weight for candleSnapshot responses', async () => {
    const ctx = getRestRequestContext('POST', 'info', { type: 'candleSnapshot' });
    const response = new Array(120).fill({});

    const before = readBucket();
    await afterRestResponse({ requestKey: 'test' }, ctx, response, 1);
    const after = readBucket();
    expect(before - after).toBe(1);
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
