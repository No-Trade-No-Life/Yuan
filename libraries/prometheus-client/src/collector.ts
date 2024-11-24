import { Labels, Metric, MetricValue } from './types';

export abstract class Collector<T extends MetricValue> {
  // private readonly data: Metric<T>[];
  private readonly data: Record<string, Metric<T>>;

  constructor() {
    this.data = {};
  }

  private makeLabelKey(labels?: Labels): string {
    if (!labels) {
      return '';
    }
    return Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
  }

  get(labels?: Labels): Metric<T> | undefined {
    const labelKey = this.makeLabelKey(labels);
    return this.data[labelKey];
  }

  set(value: T, labels?: Labels): this {
    const labelKey = this.makeLabelKey(labels);
    this.data[labelKey] = { labels, value };
    return this;
  }

  collect(): Metric<T>[] {
    return Object.values(this.data);
  }

  resetAll(): this {
    for (const i in this.data) {
      this.reset(this.data[i].labels);
    }

    return this;
  }

  abstract reset(labels?: Labels): void;

  /**
   * Clear the metric with the given labels
   * it will remove the metric from the collector (not reset to initial value)
   */
  clear(labels?: Labels): this {
    const labelKey = this.makeLabelKey(labels);
    delete this.data[labelKey];
    return this;
  }

  /**
   * Clear all metrics (not reset to initial value)
   */
  clearAll(): this {
    for (const i in this.data) {
      delete this.data[i];
    }

    return this;
  }
}
