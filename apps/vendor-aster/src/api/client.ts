import { tokenBucket } from '@yuants/utils';

// Initialize token buckets at module load time.
// Subsequent calls should use `tokenBucket(bucketId)` without options.

// REQUEST_WEIGHT limits (source: exchangeInfo.rateLimits in Aster docs)
export const futureAPIBucket = tokenBucket('fapi.asterdex.com', {
  capacity: 2400,
  refillInterval: 60_000,
  refillAmount: 2400,
});

export const spotAPIBucket = tokenBucket('sapi.asterdex.com', {
  capacity: 6000,
  refillInterval: 60_000,
  refillAmount: 6000,
});

export const orderFutureSecondAPIBucket = tokenBucket('order/future/second', {
  capacity: 300,
  refillInterval: 10_000,
  refillAmount: 300,
});

export const orderFutureMinuteAPIBucket = tokenBucket('order/future/minute', {
  capacity: 1200,
  refillInterval: 60_000,
  refillAmount: 1200,
});

export const orderSpotSecondAPIBucket = tokenBucket('order/spot/second', {
  capacity: 1000,
  refillInterval: 10_000,
  refillAmount: 1000,
});

export const orderSpotMinuteAPIBucket = tokenBucket('order/spot/minute', {
  capacity: 6000,
  refillInterval: 60_000,
  refillAmount: 6000,
});
