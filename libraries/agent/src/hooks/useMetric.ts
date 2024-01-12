import { PromRegistry } from '@yuants/protocol';
import { useEffect, useMemo } from './basic-set';

export const useMetric = (name: string, value: number, labels?: Record<string, string>) => {
  const Metric = useMemo(() => PromRegistry.create('gauge', `agent_custom_metric_${name}`), []);

  useEffect(() => {
    Metric.set(value, labels);
  });
};
