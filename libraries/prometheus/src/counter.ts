import { Counter, Labels, RegistryData } from './types';
import { makeLabelKey } from './utils';

/**
 * 创建 Counter
 * @param registry Registry 数据
 * @param name metric 名称
 * @param help 帮助文本
 * @param baseLabels 基础标签
 */
export const createCounter = (
  registry: RegistryData,
  name: string,
  help?: string,
  baseLabels: Labels = {},
): Counter => {
  // 预计算 dataKey - 性能优化关键！
  const dataKey = makeLabelKey(name, baseLabels);

  const labels = (additionalLabels: Labels): Counter => {
    const newLabels = { ...baseLabels, ...additionalLabels };
    return createCounter(registry, name, help, newLabels);
  };

  return {
    inc: (value = 1) => {
      const current = registry.counterData.get(dataKey) || 0;
      registry.counterData.set(dataKey, current + value);
    },

    add: (value: number) => {
      if (value < 0) {
        throw new Error('Expected increment amount to be greater than -1');
      }
      const current = registry.counterData.get(dataKey) || 0;
      registry.counterData.set(dataKey, current + value);
    },

    set: (value: number) => {
      registry.counterData.set(dataKey, value);
    },

    get: () => {
      return registry.counterData.get(dataKey) || 0;
    },

    delete: () => {
      registry.counterData.delete(dataKey);
    },

    labels,
  };
};
