/**
 * 标签类型定义
 */
export type Labels = Record<string, string>;

/**
 * Registry 接口
 */
export interface IRegistry {
  counter: (name: string, help: string) => Counter;
  gauge: (name: string, help: string) => Gauge;
  histogram: (name: string, help: string, buckets?: number[]) => Histogram;
  delete: (name: string, labels?: Record<string, string>) => void;
  clear: () => void;
  reset: () => void;
  serialize: () => string;
}

/**
 * Counter 接口
 */
export interface Counter {
  inc(value?: number): void;
  add(value: number): void;
  set(value: number): void;
  get(): number;
  delete(): void;
  labels(labelObj: Labels): Counter;
}

/**
 * Gauge 接口
 */
export interface Gauge {
  inc(value?: number): void;
  dec(value?: number): void;
  add(value: number): void;
  sub(value: number): void;
  set(value: number): void;
  get(): number;
  delete(): void;
  labels(labelObj: Labels): Gauge;
}

/**
 * Histogram 数据接口
 */
export interface HistogramData {
  count: number;
  sum: number;
  buckets: Map<number, number>;
}

/**
 * Histogram 接口
 */
export interface Histogram {
  observe(value: number): void;
  get(): HistogramData;
  delete(): void;
  labels(labelObj: Labels): Histogram;
}

/**
 * Registry 内部数据结构
 */
export interface RegistryData {
  counterData: Map<string, number>;
  gaugeData: Map<string, number>;
  histogramData: Map<string, HistogramData>;
  metricDefinitions: Map<
    string,
    {
      name: string;
      help?: string;
      type: 'counter' | 'gauge' | 'histogram';
      buckets?: number[];
    }
  >;
}

/**
 * 创建空的 Histogram 数据
 */
export const createEmptyHistogramData = (): HistogramData => ({
  count: 0,
  sum: 0,
  buckets: new Map<number, number>(),
});
