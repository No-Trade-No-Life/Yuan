import { IDeploySpec, IEnvContext, makeDockerEnvs, makeK8sEnvs } from '@yuants/protocol';
import { JSONSchema7 } from 'json-schema';

export const make_json_schema = (): JSONSchema7 => {
  return {
    type: 'object',
    title: 'Market Data Collector',
    properties: {
      env: {
        type: 'object',
        required: ['HV_URL', 'STORAGE_TERMINAL_ID'],
        properties: {
          TERMINAL_ID: { type: 'string' },
          HV_URL: { type: 'string' },
          STORAGE_TERMINAL_ID: { type: 'string' },
        },
      },
    },
  };
};

export const make_docker_compose_file = async (ctx: IDeploySpec, envCtx: IEnvContext) => ({
  [`market-data-collector`]: {
    image: `ghcr.io/no-trade-no-life/app-market-data-collector:${ctx.version ?? envCtx.version}`,
    environment: makeDockerEnvs(ctx.env),
  },
});

export const make_k8s_resource_objects = async (ctx: IDeploySpec, envCtx: IEnvContext) => {
  return {
    deployment: {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: {
        labels: {
          'y.ntnl.io/version': ctx.version ?? envCtx.version,
          'y.ntnl.io/component': 'market-data-collector',
        },
        name: `market-data-collector`,
        namespace: 'yuan',
      },
      spec: {
        replicas: 1,
        selector: {
          matchLabels: {
            'y.ntnl.io/component': 'market-data-collector',
          },
        },
        template: {
          metadata: {
            labels: {
              'y.ntnl.io/version': ctx.version ?? envCtx.version,
              'y.ntnl.io/component': 'market-data-collector',
            },
          },
          spec: {
            containers: [
              {
                env: makeK8sEnvs(ctx.env),
                image: `ghcr.io/no-trade-no-life/app-market-data-collector:${ctx.version ?? envCtx.version}`,
                imagePullPolicy: 'IfNotPresent',
                name: 'market-data-collector',
                resources: {
                  limits: {
                    cpu: ctx.cpu?.max ?? '400m',
                    memory: ctx.memory?.max ?? '512Mi',
                  },
                  requests: {
                    cpu: ctx.cpu?.min ?? '50m',
                    memory: ctx.memory?.min ?? '64Mi',
                  },
                },
              },
            ],
            hostname: 'market-data-collector',
            imagePullSecrets: [
              {
                name: 'pull-secret',
              },
            ],
          },
        },
      },
    },
    prometheusRule: {
      apiVersion: 'monitoring.coreos.com/v1',
      kind: 'PrometheusRule',
      metadata: {
        labels: {
          'y.ntnl.io/component': 'market-data-collector',
          'y.ntnl.io/version': ctx.version ?? envCtx.version,
        },
        name: 'market-data-collector-prometheus-rules',
        namespace: 'yuan',
      },
      spec: {
        groups: [
          {
            name: 'market-data-collector.rules',
            rules: [
              {
                alert: 'MarketDataCollectorCronjobError',
                annotations: {
                  description:
                    'Cronjob {{$labels.datasource_id}}-{{$labels.product_id}}-{{$labels.period_in_sec}} Failed',
                  runbook_url: 'https://tradelife.feishu.cn/wiki/wikcnHcDrpMQi2Og6ALlpvrxHBS',
                  summary: 'Cronjob Failed',
                },
                for: '1m',
                expr: 'sum(market_data_collector_cronjob_status{status="error"}) by (datasource_id, product_id, period_in_sec) > 0',
                labels: {
                  severity: 'error',
                },
              },
            ],
          },
        ],
      },
    },
  };
};
