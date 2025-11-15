import { GlobalPrometheusRegistry } from '@yuants/protocol';
import { useEffect, useMemo } from './basic-set';

/**
 * @public
 */
export const useMetric = (name: string, value: number, labels?: Record<string, string>) => {
  const Metric = useMemo(() => GlobalPrometheusRegistry.gauge(`agent_custom_metric_${name}`, ''), []);

  useEffect(() => {
    Metric.labels(labels || {}).set(value);
  });
};
