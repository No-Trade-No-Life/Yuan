import { IDeploySpec, IEnvContext, makeDockerEnvs, makeK8sEnvs } from '@yuants/protocol';
import { JSONSchema7 } from 'json-schema';

export const make_json_schema = (): JSONSchema7 => ({
  type: 'object',
  title: 'Trade Copier',
  properties: {
    env: {
      type: 'object',
      required: ['HV_URL', 'STORAGE_TERMINAL_ID'],
      properties: {
        HV_URL: {
          type: 'string',
        },
        TERMINAL_ID: {
          type: 'string',
        },
        STORAGE_TERMINAL_ID: {
          type: 'string',
        },
      },
    },
  },
});

export const make_docker_compose_file = async (ctx: IDeploySpec, envCtx: IEnvContext) => ({
  trade_copier: {
    image: `ghcr.io/no-trade-no-life/app-trade-copier:${ctx.version ?? envCtx.version}`,
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
          'y.ntnl.io/component': 'trade-copier',
        },
        name: `trade-copier`,
        namespace: 'yuan',
      },
      spec: {
        replicas: 1,
        selector: {
          matchLabels: {
            'y.ntnl.io/component': 'trade-copier',
          },
        },
        template: {
          metadata: {
            labels: {
              'y.ntnl.io/version': ctx.version ?? envCtx.version,
              'y.ntnl.io/component': 'trade-copier',
            },
          },
          spec: {
            containers: [
              {
                env: makeK8sEnvs(ctx.env),
                image: `ghcr.io/no-trade-no-life/app-trade-copier:${ctx.version ?? envCtx.version}`,
                imagePullPolicy: 'IfNotPresent',
                name: 'trade-copier',
                resources: {
                  limits: {
                    cpu: ctx.cpu?.max ?? '100m',
                    memory: ctx.memory?.max ?? '128Mi',
                  },
                  requests: {
                    cpu: ctx.cpu?.min ?? '20m',
                    memory: ctx.memory?.min ?? '64Mi',
                  },
                },
              },
            ],
            hostname: 'trade-copier',
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
          'y.ntnl.io/component': 'trade-copier',
          'y.ntnl.io/version': ctx.version ?? envCtx.version,
        },
        name: 'trade-copier-prometheus-rules',
        namespace: 'yuan',
      },
      spec: {
        groups: [
          {
            name: 'trade-copier',
            rules: [
              {
                alert: 'ResidualOverThreshold',
                annotations: {
                  description:
                    '账户-头寸 {{$labels.account_id}}-{{$labels.product_id}}-{{$labels.variant}} 残差率过高',
                  runbook_url: 'https://tradelife.feishu.cn/wiki/wikcn8wBzjrhfPTHkPQ4zAJQcmh',
                  summary: '账户残差率过大',
                  current_value: '{{$value}}',
                },
                for: '1m',
                expr: 'sum by (account_id, product_id, variant) (trade_copier_error_volume_ratio) > 1 or sum by (account_id, product_id, variant) (trade_copier_error_volume_ratio) < -1',
                labels: {
                  severity: 'critical',
                },
              },
              {
                alert: 'AccountInfoAvgTimeLagTooHigh',
                annotations: {
                  description: '账户流 {{$labels.account_id}} 延迟过高',
                  runbook_url: 'https://tradelife.feishu.cn/wiki/wikcndHfxkACGXcktEvQxg09a5b',
                  summary: '账户流延迟高于 4s',
                  current_value: '{{$value}}',
                },
                expr: 'sum by (account_id) (trade_copier_account_info_time_lag_ms_sum) / sum by (account_id) (trade_copier_account_info_time_lag_ms_count) > 4000',
                for: '5m',
                labels: {
                  severity: 'warning',
                },
              },
              {
                alert: 'TradeCopierMetricsPullFailed',
                annotations: {
                  description: 'Trade Copier {{$labels.terminal_id}} Metrics 请求失败',
                  runbook_url: 'https://tradelife.feishu.cn/wiki/wikcnwLKfcKGaIaAZhasEXM7ipc',
                  summary: 'Trade Copier Metrics 请求失败',
                },
                expr: 'rate(hv_terminal_metric_fetch_errors_total{terminal_id=~"^trade-copier/.+"}[5m]) != 0',
                for: '5m',
                labels: {
                  severity: 'error',
                },
              },
              {
                alert: 'AccountInfoTerminated',
                annotations: {
                  description: '账户流 {{$labels.account_id}} 终止',
                  runbook_url: 'https://tradelife.feishu.cn/wiki/wikcnXBLuFIJFKM6DYp8I94zDwf',
                  summary: '账户流终止',
                },
                expr: 'sum by (account_id) (rate(trade_copier_account_info_time_lag_ms_count{account_id=~".+"}[1m])) == 0',
                for: '5m',
                labels: {
                  severity: 'critical',
                },
              },
            ],
          },
        ],
      },
    },
  };
};
