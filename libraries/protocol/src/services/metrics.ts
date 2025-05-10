import { PrometheusSerializer } from '@opentelemetry/exporter-prometheus';
import {
  AggregationTemporality,
  AggregationType,
  MeterProvider,
  MetricReader,
} from '@opentelemetry/sdk-metrics';
import { Registry } from '@yuants/prometheus-client';

/**
 * @public
 */
export class YuanMetricsReader extends MetricReader {
  private serializer: PrometheusSerializer;
  constructor(
    public config: {
      prefix?: string;
    },
  ) {
    super({
      aggregationSelector: (_instrumentType) => {
        return {
          type: AggregationType.DEFAULT,
        };
      },
      aggregationTemporalitySelector: (_instrumentType) => AggregationTemporality.CUMULATIVE,
    });
    this.serializer = new PrometheusSerializer(this.config?.prefix);
  }

  async export(): Promise<string> {
    const { resourceMetrics, errors } = await this.collect();
    if (errors.length > 0) {
      console.error('MetricsExporter: Error collecting metrics:', errors);
    }
    return this.serializer.serialize(resourceMetrics);
  }

  override async onForceFlush(): Promise<void> {
    /** do nothing */
  }

  protected onShutdown(): Promise<void> {
    return Promise.resolve(undefined);
  }
}

/**
 * @public
 */
export const MetricsExporter = new YuanMetricsReader({});

/**
 * @public
 */
export const MetricsMeterProvider = new MeterProvider({
  readers: [MetricsExporter],
});

export const TerminalMeter = MetricsMeterProvider.getMeter('terminal');
/**
 * Prometheus Metrics Registry
 * @public
 * @deprecated - use {@link MetricsMeterProvider} instead
 */
export const PromRegistry = new Registry();

declare module '.' {
  /**
   * - Metrics interface has been loaded
   * - 打点接口 (Metrics) 已载入
   */
  interface IService {
    Metrics: {
      req: {};
      res: IResponse<{ metrics: string }>;
      frame: void;
    };
  }
}
