import { Histogram, Labels, RegistryData, createEmptyHistogramData } from './types';
import { makeLabelKey, updateHistogramBuckets } from './utils';

/**
 * 创建 Histogram
 * @param registry Registry 数据
 * @param name metric 名称
 * @param help 帮助文本
 * @param buckets 桶边界
 * @param baseLabels 基础标签
 */
export const createHistogram = (
  registry: RegistryData,
  name: string,
  help: string,
  buckets: number[] = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  baseLabels: Labels = {},
): Histogram => {
  // 预计算 dataKey - 性能优化关键！
  const dataKey = makeLabelKey(name, baseLabels);

  const labels = (additionalLabels: Labels): Histogram => {
    const newLabels = { ...baseLabels, ...additionalLabels };
    return createHistogram(registry, name, help, buckets, newLabels);
  };

  // 确保 Histogram 数据存在
  if (!registry.histogramData.has(dataKey)) {
    registry.histogramData.set(dataKey, createEmptyHistogramData());
  }

  return {
    observe: (value: number) => {
      const histogram = registry.histogramData.get(dataKey);
      if (histogram) {
        updateHistogramBuckets(histogram, value, buckets);
      }
    },

    get: () => {
      return registry.histogramData.get(dataKey) || createEmptyHistogramData();
    },

    delete: () => {
      registry.histogramData.delete(dataKey);
    },

    labels,
  };
};
