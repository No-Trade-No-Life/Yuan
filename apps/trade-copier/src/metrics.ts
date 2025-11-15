import { GlobalPrometheusRegistry } from '@yuants/protocol';

export const MetricRunStrategyResultCounter: any = GlobalPrometheusRegistry.counter(
  'trade_copier_run_strategy_result',
  '',
);

export const MetricRunStrategyContextGauge: any = GlobalPrometheusRegistry.gauge(
  'trade_copier_run_strategy_context',
  '',
);
