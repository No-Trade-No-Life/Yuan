import { TreeNode } from './tree';
import { Histogram, HistogramData, Labels } from './types';
import { createLabelKeyNode, labelsToString, sortLabels } from './utils';

/**
 * 创建 Histogram
 * @param metric Registry 数据
 * @param name metric 名称
 * @param help 帮助文本
 * @param buckets 桶边界
 * @param baseLabels 基础标签
 */
export const createHistogram = (
  metric: TreeNode,
  name: string,
  buckets: number[],
  baseLabels: Labels = {},
): Histogram => {
  // 预计算 dataKey - 性能优化关键！
  const sortedLabels = sortLabels(baseLabels);
  const dataKey = labelsToString(sortedLabels);
  const node = metric.getChild(dataKey, false);
  const sumNode = createLabelKeyNode(node, `${name}_sum`, sortedLabels);
  const countNode = createLabelKeyNode(node, `${name}_count`, sortedLabels);

  const bucketsNodes: TreeNode[] = buckets.map((bucket) =>
    createLabelKeyNode(node, `${name}_bucket`, [...sortedLabels, ['le', bucket.toString()]]),
  );
  const infNode = createLabelKeyNode(node, `${name}_bucket`, [...sortedLabels, ['le', '+Inf']]);

  const labels = (additionalLabels: Labels): Histogram => {
    const newLabels = { ...baseLabels, ...additionalLabels };
    return createHistogram(metric, name, buckets, newLabels);
  };

  return {
    observe: (value: number) => {
      node.visible = true;
      sumNode.setValue((sumNode.getValue() || 0) + value);
      countNode.setValue((countNode.getValue() || 0) + 1);
      infNode.setValue((infNode.getValue() || 0) + 1);

      // 更新桶数据
      for (let i = buckets.length - 1; i >= 0; i--) {
        if (value <= buckets[i]) {
          bucketsNodes[i].setValue((bucketsNodes[i].getValue() || 0) + 1);
        } else {
          break;
        }
      }
    },

    get: () => {
      const histogramData: HistogramData = {
        count: countNode.getValue() || 0,
        sum: sumNode.getValue() || 0,
        buckets: new Map<number, number>(),
      };

      for (let i = 0; i < buckets.length; i++) {
        histogramData.buckets.set(buckets[i], bucketsNodes[i].getValue() || 0);
      }

      return histogramData;
    },

    delete: () => {
      node.visible = false;
      node.remove();
    },

    labels,
  };
};
