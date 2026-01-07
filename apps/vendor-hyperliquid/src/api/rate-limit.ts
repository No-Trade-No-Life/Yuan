import { newError, scopeError, tokenBucket } from '@yuants/utils';

type HttpMethod = 'GET' | 'POST';

type RestRequestContext = Readonly<{
  method: HttpMethod;
  path: string;
  body?: unknown;
  kind: 'info' | 'exchange' | 'explorer' | 'other';
  infoType?: string;
  exchangeActionType?: string;
  exchangeBatchLength?: number;
}>;

type ExtraWeigher = Readonly<{
  match: (ctx: RestRequestContext) => boolean;
  divisor: 20 | 60;
  estimateItems?: (ctx: RestRequestContext) => number;
  countItemsFromResponse?: (response: unknown) => number;
}>;

const REST_IP_BUCKET_ID = 'HYPERLIQUID_REST_IP_WEIGHT_1200_PER_MIN';
const REST_IP_BUCKET_CAPACITY = 1200;
const REST_IP_WEIGHT_MAX = REST_IP_BUCKET_CAPACITY * 10;

tokenBucket(REST_IP_BUCKET_ID, {
  capacity: REST_IP_BUCKET_CAPACITY,
  refillInterval: 60_000,
  refillAmount: 1200,
});

const INFO_TYPE_TO_BASE_WEIGHT: Readonly<Record<string, number>> = {
  l2Book: 2,
  allMids: 2,
  clearinghouseState: 2,
  orderStatus: 2,
  spotClearinghouseState: 2,
  exchangeStatus: 2,
  userRole: 60,
};

const INTERVAL_TO_MS: Readonly<Record<string, number>> = {
  '1m': 60_000,
  '3m': 180_000,
  '5m': 300_000,
  '15m': 900_000,
  '30m': 1_800_000,
  '1h': 3_600_000,
  '2h': 7_200_000,
  '4h': 14_400_000,
  '8h': 28_800_000,
  '12h': 43_200_000,
  '1d': 86_400_000,
  '3d': 259_200_000,
  '1w': 604_800_000,
  '1M': 2_592_000_000,
};

const getObject = (value: unknown): Record<string, unknown> | undefined => {
  if (typeof value !== 'object' || value === null) return;
  return value as Record<string, unknown>;
};

const getString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return;
  return value;
};

const getNumber = (value: unknown): number | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return;
  return value;
};

const getArray = (value: unknown): unknown[] | undefined => {
  if (!Array.isArray(value)) return;
  return value;
};

export const getRestRequestContext = (
  method: HttpMethod,
  path: string,
  body?: unknown,
): RestRequestContext => {
  if (method === 'POST' && path === 'info') {
    const obj = getObject(body);
    const infoType = getString(obj?.type);
    return { method, path, body, kind: 'info', infoType };
  }
  if (method === 'POST' && path === 'exchange') {
    const obj = getObject(body);
    const action = getObject(obj?.action);
    const exchangeActionType = getString(action?.type);
    const orders = getArray(action?.orders);
    const cancels = getArray(action?.cancels);
    const exchangeBatchLength = Math.max(1, orders?.length ?? cancels?.length ?? 1);
    return { method, path, body, kind: 'exchange', exchangeActionType, exchangeBatchLength };
  }
  if (path.startsWith('explorer')) {
    return { method, path, body, kind: 'explorer' };
  }
  return { method, path, body, kind: 'other' };
};

export const getRestBaseWeight = (ctx: RestRequestContext): number => {
  if (ctx.kind === 'exchange') {
    const batchLength = Math.max(1, ctx.exchangeBatchLength ?? 1);
    return 1 + Math.floor(batchLength / 40);
  }
  if (ctx.kind === 'info') {
    return INFO_TYPE_TO_BASE_WEIGHT[ctx.infoType ?? ''] ?? 20;
  }
  if (ctx.kind === 'explorer') {
    return 40;
  }
  return 20;
};

const estimateCandleSnapshotItems = (ctx: RestRequestContext): number => {
  if (ctx.kind !== 'info' || ctx.infoType !== 'candleSnapshot') return 0;
  const bodyObj = getObject(ctx.body);
  const reqObj = getObject(bodyObj?.req);
  const interval = getString(reqObj?.interval);
  const startTime = getNumber(reqObj?.startTime);
  const endTime = getNumber(reqObj?.endTime);
  if (!interval || startTime === undefined || endTime === undefined || endTime <= startTime) return 0;

  const intervalMs = INTERVAL_TO_MS[interval] ?? 0;
  if (!intervalMs) return 0;

  // Hyperliquid docs: Only the most recent 5000 candles are available
  const estimated = Math.ceil((endTime - startTime) / intervalMs);
  return Math.min(5000, Math.max(0, estimated));
};

const countArrayResponseItems = (response: unknown): number => {
  const arr = getArray(response);
  return arr?.length ?? 0;
};

const countUserFillsItems = (response: unknown): number => {
  const obj = getObject(response);
  const fills = getArray(obj?.fills);
  return fills?.length ?? 0;
};

const extraWeighers: ReadonlyArray<ExtraWeigher> = [
  {
    match: (ctx) => ctx.kind === 'info' && ctx.infoType === 'candleSnapshot',
    divisor: 60,
    estimateItems: estimateCandleSnapshotItems,
    countItemsFromResponse: countArrayResponseItems,
  },
  {
    match: (ctx) =>
      ctx.kind === 'info' &&
      (ctx.infoType === 'recentTrades' ||
        ctx.infoType === 'historicalOrders' ||
        ctx.infoType === 'userFills' ||
        ctx.infoType === 'userFillsByTime' ||
        ctx.infoType === 'fundingHistory' ||
        ctx.infoType === 'userFunding' ||
        ctx.infoType === 'nonUserFundingUpdates' ||
        ctx.infoType === 'twapHistory' ||
        ctx.infoType === 'userTwapSliceFills' ||
        ctx.infoType === 'userTwapSliceFillsByTime' ||
        ctx.infoType === 'delegatorHistory' ||
        ctx.infoType === 'delegatorRewards' ||
        ctx.infoType === 'validatorStats'),
    divisor: 20,
    countItemsFromResponse: (response) => countUserFillsItems(response) || countArrayResponseItems(response),
  },
];

export const getRestEstimatedExtraWeight = (ctx: RestRequestContext): number => {
  for (const weigher of extraWeighers) {
    if (!weigher.match(ctx)) continue;
    const items = weigher.estimateItems?.(ctx) ?? 0;
    if (items <= 0) return 0;
    return Math.ceil(items / weigher.divisor);
  }
  return 0;
};

const normalizeRestWeight = (meta: Record<string, unknown>, weight: number): number => {
  if (!Number.isFinite(weight)) {
    throw newError('HYPERLIQUID_REST_WEIGHT_INVALID', { ...meta, weight });
  }
  const normalized = Math.floor(weight);
  if (normalized <= 0) {
    throw newError('HYPERLIQUID_REST_WEIGHT_INVALID', { ...meta, weight: normalized });
  }
  if (normalized > REST_IP_WEIGHT_MAX) {
    throw newError('HYPERLIQUID_REST_WEIGHT_EXCESSIVE', {
      ...meta,
      weight: normalized,
      maxWeight: REST_IP_WEIGHT_MAX,
    });
  }
  return normalized;
};

export const acquireRestIpWeightSync = (meta: Record<string, unknown>, weight: number) => {
  const normalized = normalizeRestWeight(meta, weight);
  scopeError('HYPERLIQUID_API_RATE_LIMIT', { ...meta, bucketId: REST_IP_BUCKET_ID, weight: normalized }, () =>
    tokenBucket(REST_IP_BUCKET_ID).acquireSync(normalized),
  );
};

const acquireRestIpWeight = async (meta: Record<string, unknown>, weight: number) => {
  let remaining = normalizeRestWeight(meta, weight);
  while (remaining > 0) {
    const chunk = Math.min(REST_IP_BUCKET_CAPACITY, remaining);
    await scopeError(
      'HYPERLIQUID_API_RATE_LIMIT',
      { ...meta, bucketId: REST_IP_BUCKET_ID, weight: chunk, remaining },
      () => tokenBucket(REST_IP_BUCKET_ID).acquire(chunk),
    );
    remaining -= chunk;
  }
};

export const beforeRestRequest = (
  meta: Record<string, unknown>,
  ctx: RestRequestContext,
): Readonly<{ baseWeight: number; estimatedExtraWeight: number }> => {
  const baseWeight = getRestBaseWeight(ctx);
  const estimatedExtraWeight = getRestEstimatedExtraWeight(ctx);
  acquireRestIpWeightSync(meta, baseWeight + estimatedExtraWeight);
  return { baseWeight, estimatedExtraWeight };
};

export const afterRestResponse = async (
  meta: Record<string, unknown>,
  ctx: RestRequestContext,
  response: unknown,
  estimatedExtraWeight: number,
) => {
  for (const weigher of extraWeighers) {
    if (!weigher.match(ctx)) continue;
    const items = weigher.countItemsFromResponse?.(response) ?? 0;
    if (items <= 0) return;
    const actualExtraWeight = Math.ceil(items / weigher.divisor);
    const delta = actualExtraWeight - estimatedExtraWeight;
    if (delta > 0) {
      // 不使用 acquireSync：响应后只阻塞等待，不报错
      await acquireRestIpWeight(meta, delta);
    }
    return;
  }
};
