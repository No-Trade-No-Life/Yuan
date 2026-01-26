import { TreeNode } from './tree';
import { Counter, Labels } from './types';
import { createLabelKeyNode, labelsToString, sortLabels } from './utils';

/**
 * 创建 Counter
 * @param registry Registry 数据
 * @param name metric 名称
 * @param help 帮助文本
 * @param baseLabels 基础标签
 */
export const createCounter = (registry: TreeNode, name: string, baseLabels: Labels = {}): Counter => {
  // 预计算 dataKey - 性能优化关键！
  const sortedLabels = sortLabels(baseLabels);
  const dataKey = labelsToString(sortedLabels);
  const node = registry.getChild(dataKey, false);
  const valueNode = createLabelKeyNode(node, name, sortedLabels);

  const labels = (additionalLabels: Labels): Counter => {
    const newLabels = { ...baseLabels, ...additionalLabels };
    return createCounter(registry, name, newLabels);
  };

  return {
    inc: (value = 1) => {
      node.visible = true;
      valueNode.setValue((valueNode.getValue() || 0) + value);
    },

    add: (value: number) => {
      if (value < 0) {
        throw new Error('Expected increment amount to be greater than -1');
      }

      node.visible = true;
      valueNode.setValue((valueNode.getValue() || 0) + value);
    },

    set: (value: number) => {
      node.visible = true;
      valueNode.setValue(value);
    },

    get: () => {
      return valueNode.getValue() || 0;
    },

    delete: () => {
      node.visible = false;
      node.remove();
    },

    labels,
  };
};
