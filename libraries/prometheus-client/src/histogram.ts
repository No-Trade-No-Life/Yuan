import { Collector } from './collector';
import { HistogramValue, HistogramValueEntries, Labels } from './types';

function getInitialValue(buckets: number[]): HistogramValue {
  // Make the skeleton to which values will be saved.
  const entries = buckets.reduce(
    (result, b) => {
      result[b.toString()] = 0;
      return result;
    },
    { '+Inf': 0 } as HistogramValueEntries,
  );

  return {
    entries,
    sum: 0,
    count: 0,
  };
}

export class Histogram extends Collector<HistogramValue> {
  private readonly buckets: number[];

  constructor(buckets: number[] = []) {
    super();
    // Sort to get smallest -> largest in order.
    this.buckets = buckets.sort((a, b) => (a > b ? 1 : -1));
    this.set(getInitialValue(this.buckets));
    this.observe = this.observe.bind(this);
  }

  observe(value: number, labels?: Labels): this {
    let metric = this.get(labels);
    if (metric == null) {
      // Create a metric for the labels.
      metric = this.set(getInitialValue(this.buckets), labels).get(labels)!;
    }

    metric.value.entries['+Inf'] += 1;

    const minBucketIndex = findBound(this.buckets, value);

    if (minBucketIndex != -1) {
      for (let i = minBucketIndex; i < this.buckets.length; i += 1) {
        const val = metric.value.entries[this.buckets[i].toString()];
        metric.value.entries[this.buckets[i].toString()] = val + 1;
      }
    }

    metric.value.sum += value;
    metric.value.count += 1;

    return this;
  }

  reset(labels?: Labels): void {
    this.set(getInitialValue(this.buckets), labels);
  }
}

function findBound(buckets: number[], value: number): number {
  if (buckets.length < 30) {
    return linearSearch(buckets, value);
  }
  return binarySearch(buckets, value);
}

function binarySearch(buckets: number[], value: number): number {
  let left = 0;
  let right = buckets.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);

    if (buckets[mid] === value) {
      return mid;
    } else if (buckets[mid] < value) {
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }
  if (left >= buckets.length) {
    return -1;
  }
  return left;
}

function linearSearch(buckets: number[], value: number): number {
  for (let i = 0; i < buckets.length; i += 1) {
    if (value <= buckets[i]) {
      return i;
    }
  }

  return -1;
}
