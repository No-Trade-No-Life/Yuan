import { Gauge, Labels, RegistryData } from './types';
import { makeLabelKey } from './utils';

/**
 * 创建 Gauge
 * @param registry Registry 数据
 * @param name metric 名称
 * @param help 帮助文本
 * @param baseLabels 基础标签
 */
export const createGauge = (
  registry: RegistryData,
  name: string,
  help?: string,
  baseLabels: Labels = {},
): Gauge => {
  // 预计算 dataKey - 性能优化关键！
  const dataKey = makeLabelKey(name, baseLabels);

  const labels = (additionalLabels: Labels): Gauge => {
    const newLabels = { ...baseLabels, ...additionalLabels };
    return createGauge(registry, name, help, newLabels);
  };

  return {
    inc: (value = 1) => {
      const current = registry.gaugeData.get(dataKey) || 0;
      registry.gaugeData.set(dataKey, current + value);
    },

    dec: (value = 1) => {
      const current = registry.gaugeData.get(dataKey) || 0;
      registry.gaugeData.set(dataKey, current - value);
    },

    add: (value: number) => {
      const current = registry.gaugeData.get(dataKey) || 0;
      registry.gaugeData.set(dataKey, current + value);
    },

    sub: (value: number) => {
      const current = registry.gaugeData.get(dataKey) || 0;
      registry.gaugeData.set(dataKey, current - value);
    },

    set: (value: number) => {
      registry.gaugeData.set(dataKey, value);
    },

    get: () => {
      return registry.gaugeData.get(dataKey) || 0;
    },

    delete: () => {
      registry.gaugeData.delete(dataKey);
    },

    labels,
  };
};
