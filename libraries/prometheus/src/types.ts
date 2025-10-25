/**
 * 标签类型定义
 * @public
 */
export type Labels = Record<string, string>;

/**
 * Registry 接口
 * @public
 */
export interface IRegistry {
  counter: (name: string, help: string) => Counter;
  gauge: (name: string, help: string) => Gauge;
  histogram: (name: string, help: string, buckets: number[]) => Histogram;
  serialize: () => string;
}

/**
 * Counter 接口
 * @public
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
 * @public
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
 * @public
 */
export interface HistogramData {
  count: number;
  sum: number;
  buckets: Map<number, number>;
}

/**
 * Histogram 接口
 * @public
 */
export interface Histogram {
  observe(value: number): void;
  get(): HistogramData;
  delete(): void;
  labels(labelObj: Labels): Histogram;
}
