import { createCounter } from './counter';
import { createGauge } from './gauge';
import { createHistogram } from './histogram';
import { TreeNode } from './tree';
import { Counter, Gauge, Histogram, IRegistry } from './types';
import { createConstNode } from './utils';

/**
 * 创建 Registry
 *
 * @public
 */
export const createRegistry = (): IRegistry => {
  const root = new TreeNode();
  root.visible = true;

  return {
    /**
     * 创建并注册 Counter
     */
    counter: (name: string, help: string): Counter => {
      const metricNode = root.getChild(name, true);

      if (help) {
        createConstNode(metricNode, 'help', `# HELP ${name} ${help}\n`);
      }

      createConstNode(metricNode, 'type', `# TYPE ${name} counter\n`);

      const dataNode = metricNode.getChild('data', true);

      return createCounter(dataNode, name);
    },

    /**
     * 创建并注册 Gauge
     */
    gauge: (name: string, help: string): Gauge => {
      const metricNode = root.getChild(name, true);

      if (help) {
        createConstNode(metricNode, 'help', `# HELP ${name} ${help}\n`);
      }

      createConstNode(metricNode, 'type', `# TYPE ${name} gauge\n`);

      const dataNode = metricNode.getChild('data', true);
      return createGauge(dataNode, name);
    },

    /**
     * 创建并注册 Histogram
     */
    histogram: (name: string, help: string, buckets: number[]): Histogram => {
      const metricNode = root.getChild(name, true);

      if (help) {
        createConstNode(metricNode, 'help', `# HELP ${name} ${help}\n`);
      }

      createConstNode(metricNode, 'type', `# TYPE ${name} histogram\n`);

      const dataNode = metricNode.getChild('data', true);

      if (buckets) {
        buckets.sort((a, b) => a - b);
      }

      return createHistogram(dataNode, name, buckets);
    },

    /**
     * 序列化所有 metrics
     */
    serialize: (): string => root.serialize(),
  };
};
