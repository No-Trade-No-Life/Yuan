import { tokenBucket, type TokenBucketOptions } from '@yuants/utils';

// Initialize token buckets at module load time.
// Subsequent calls for derived bucket ids should reuse the same options.

// REQUEST_WEIGHT limits (source: exchangeInfo.rateLimits in Aster docs)
export const ASTER_TOKEN_BUCKET_OPTIONS_BY_ID: Record<string, TokenBucketOptions> = {
  'fapi.asterdex.com': {
    capacity: 2400,
    refillInterval: 60_000,
    refillAmount: 2400,
  },
  'sapi.asterdex.com': {
    capacity: 6000,
    refillInterval: 60_000,
    refillAmount: 6000,
  },
  'order/future/second': {
    capacity: 300,
    refillInterval: 10_000,
    refillAmount: 300,
  },
  'order/future/minute': {
    capacity: 1200,
    refillInterval: 60_000,
    refillAmount: 1200,
  },
  'order/spot/second': {
    capacity: 1000,
    refillInterval: 10_000,
    refillAmount: 1000,
  },
  'order/spot/minute': {
    capacity: 6000,
    refillInterval: 60_000,
    refillAmount: 6000,
  },
};

export const futureAPIBucket = tokenBucket(
  'fapi.asterdex.com',
  ASTER_TOKEN_BUCKET_OPTIONS_BY_ID['fapi.asterdex.com'],
);

export const spotAPIBucket = tokenBucket(
  'sapi.asterdex.com',
  ASTER_TOKEN_BUCKET_OPTIONS_BY_ID['sapi.asterdex.com'],
);

export const orderFutureSecondAPIBucket = tokenBucket(
  'order/future/second',
  ASTER_TOKEN_BUCKET_OPTIONS_BY_ID['order/future/second'],
);

export const orderFutureMinuteAPIBucket = tokenBucket(
  'order/future/minute',
  ASTER_TOKEN_BUCKET_OPTIONS_BY_ID['order/future/minute'],
);

export const orderSpotSecondAPIBucket = tokenBucket(
  'order/spot/second',
  ASTER_TOKEN_BUCKET_OPTIONS_BY_ID['order/spot/second'],
);

export const orderSpotMinuteAPIBucket = tokenBucket(
  'order/spot/minute',
  ASTER_TOKEN_BUCKET_OPTIONS_BY_ID['order/spot/minute'],
);
