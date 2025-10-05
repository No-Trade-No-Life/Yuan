import { createCounter } from './counter';
import { createGauge } from './gauge';
import { createHistogram } from './histogram';
import { Counter, Gauge, Histogram, IRegistry, RegistryData } from './types';
import { makeLabelKey, serializeCounterOrGauge, serializeHistogram } from './utils';

/**
 * 创建 Registry
 */
export const createRegistry = (): IRegistry => {
  const registryData: RegistryData = {
    counterData: new Map(),
    gaugeData: new Map(),
    histogramData: new Map(),
    metricDefinitions: new Map(),
  };

  return {
    /**
     * 创建并注册 Counter
     */
    counter: (name: string, help: string): Counter => {
      registryData.metricDefinitions.set(name, { name, help, type: 'counter' });
      return createCounter(registryData, name, help);
    },

    /**
     * 创建并注册 Gauge
     */
    gauge: (name: string, help: string): Gauge => {
      registryData.metricDefinitions.set(name, { name, help, type: 'gauge' });
      return createGauge(registryData, name, help);
    },

    /**
     * 创建并注册 Histogram
     */
    histogram: (name: string, help: string, buckets?: number[]): Histogram => {
      registryData.metricDefinitions.set(name, { name, help, type: 'histogram', buckets });
      return createHistogram(registryData, name, help, buckets);
    },

    /**
     * 删除特定标签组合的数据
     */
    delete: (name: string, labels: Record<string, string> = {}): void => {
      // 如果没有提供标签，删除该 metric 的所有数据
      if (Object.keys(labels).length === 0) {
        // 删除所有以 name 开头的数据键
        for (const [key] of registryData.counterData) {
          if (key.startsWith(name)) {
            registryData.counterData.delete(key);
          }
        }
        for (const [key] of registryData.gaugeData) {
          if (key.startsWith(name)) {
            registryData.gaugeData.delete(key);
          }
        }
        for (const [key] of registryData.histogramData) {
          if (key.startsWith(name)) {
            registryData.histogramData.delete(key);
          }
        }
      } else {
        // 处理部分标签匹配
        const targetKey = makeLabelKey(name, labels);

        // 删除所有包含目标标签的数据
        for (const [key] of registryData.counterData) {
          if (key.includes(targetKey.substring(name.length))) {
            registryData.counterData.delete(key);
          }
        }
        for (const [key] of registryData.gaugeData) {
          if (key.includes(targetKey.substring(name.length))) {
            registryData.gaugeData.delete(key);
          }
        }
        for (const [key] of registryData.histogramData) {
          if (key.includes(targetKey.substring(name.length))) {
            registryData.histogramData.delete(key);
          }
        }
      }
    },

    /**
     * 清空所有数据
     */
    clear: (): void => {
      registryData.counterData.clear();
      registryData.gaugeData.clear();
      registryData.histogramData.clear();
    },

    /**
     * 重置所有数据为初始值
     */
    reset: (): void => {
      // 对于 counters 和 gauges，重置为 0
      for (const [key] of registryData.counterData) {
        registryData.counterData.set(key, 0);
      }
      for (const [key] of registryData.gaugeData) {
        registryData.gaugeData.set(key, 0);
      }
      // 对于 histograms，清空数据
      for (const [key] of registryData.histogramData) {
        registryData.histogramData.set(key, {
          count: 0,
          sum: 0,
          buckets: new Map<number, number>(),
        });
      }
    },

    /**
     * 序列化所有 metrics
     */
    serialize: (): string => {
      let output = '';

      // 按 metric 名称分组序列化
      const metricsByType = new Map<
        string,
        Array<{
          name: string;
          help?: string;
          type: string;
          buckets?: number[];
        }>
      >();

      // 按类型分组
      for (const metric of registryData.metricDefinitions.values()) {
        if (!metricsByType.has(metric.type)) {
          metricsByType.set(metric.type, []);
        }
        metricsByType.get(metric.type)!.push(metric);
      }

      // 序列化 counters
      const counters = metricsByType.get('counter') || [];
      for (const { name, help } of counters) {
        output += serializeCounterOrGauge(name, help || '', registryData.counterData, 'counter');
      }

      // 序列化 gauges
      const gauges = metricsByType.get('gauge') || [];
      for (const { name, help } of gauges) {
        output += serializeCounterOrGauge(name, help || '', registryData.gaugeData, 'gauge');
      }

      // 序列化 histograms
      const histograms = metricsByType.get('histogram') || [];
      for (const { name, help } of histograms) {
        output += serializeHistogram(name, help || '', registryData.histogramData);
      }

      return output;
    },
  };
};
