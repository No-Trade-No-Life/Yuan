import { PromRegistry } from '@yuants/protocol';

export const MetricRunStrategyResultCounter: any = PromRegistry.create(
  'counter',
  'trade_copier_run_strategy_result',
);

export const MetricRunStrategyContextGauge: any = PromRegistry.create(
  'gauge',
  'trade_copier_run_strategy_context',
);
