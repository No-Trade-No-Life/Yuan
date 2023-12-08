import { Counter } from './counter';
import { Gauge } from './gauge';
import { Registry } from './registry';
import { Histogram } from './histogram';

/**
 * @public
 */
export type CollectorType = 'counter' | 'gauge' | 'histogram';

/**
 * @public
 */
export type RegistryType = Registry;

/**
 * @public
 */
export type GaugeType = Gauge;

/**
 * @public
 */
export type CounterType = Counter;

/**
 * @public
 */
export type HistogramType = Histogram;

/**
 * @public
 */
export type CounterValue = number;

/**
 * @public
 */
export interface HistogramValueEntries {
  [key: string]: number;
}

/**
 * @public
 */
export interface HistogramValue {
  entries: HistogramValueEntries;
  sum: number;
  count: number;
}

/**
 * @public
 */
export type MetricValue = CounterValue | HistogramValue;

/**
 * @public
 */
export interface Metric<T extends MetricValue> {
  value: T;
  labels?: Labels;
}

/**
 * @public
 */
export interface Labels {
  [key: string]: string | number;
}
