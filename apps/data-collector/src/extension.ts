import { IExtensionContext, makeDockerEnvs, makeK8sEnvs } from '@yuants/extension';
export default (context: IExtensionContext) => {
  context.registerDeployProvider({
    make_json_schema: () => ({
      type: 'object',
      title: 'Data Collector',
      properties: {
        env: {
          type: 'object',
          required: ['HOST_URL', 'STORAGE_TERMINAL_ID'],
          properties: {
            TERMINAL_ID: { type: 'string' },
            HOST_URL: { type: 'string' },
            STORAGE_TERMINAL_ID: { type: 'string' },
          },
        },
      },
    }),
    make_docker_compose_file: async (ctx, envCtx) => {
      return {
        [`data-collector`]: {
          image: `ghcr.io/no-trade-no-life/app-data-collector:${ctx.version ?? envCtx.version}`,
          environment: makeDockerEnvs(ctx.env),
        },
      };
    },
    make_k8s_resource_objects: async (ctx, envCtx) => {
      return {
        deployment: {
          apiVersion: 'apps/v1',
          kind: 'Deployment',
          metadata: {
            labels: {
              'y.ntnl.io/version': ctx.version ?? envCtx.version,
              'y.ntnl.io/component': 'data-collector',
            },
            name: `data-collector`,
            namespace: 'yuan',
          },
          spec: {
            replicas: 1,
            selector: {
              matchLabels: {
                'y.ntnl.io/component': 'data-collector',
              },
            },
            template: {
              metadata: {
                labels: {
                  'y.ntnl.io/version': ctx.version ?? envCtx.version,
                  'y.ntnl.io/component': 'data-collector',
                },
              },
              spec: {
                containers: [
                  {
                    env: makeK8sEnvs(ctx.env),
                    image: `ghcr.io/no-trade-no-life/app-data-collector:${ctx.version ?? envCtx.version}`,
                    imagePullPolicy: 'IfNotPresent',
                    name: 'data-collector',
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
                hostname: 'data-collector',
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
              'y.ntnl.io/component': 'data-collector',
              'y.ntnl.io/version': ctx.version ?? envCtx.version,
            },
            name: 'data-collector-prometheus-rules',
            namespace: 'yuan',
          },
          spec: {
            groups: [
              {
                name: 'data-collector.rules',
                rules: [
                  {
                    alert: 'DataCollectorCronjobError',
                    annotations: {
                      description: 'Cronjob {{$labels.series_id}} Failed',
                      runbook_url: 'TBD, contact c1@ntnl.io for help',
                      summary: 'data Collector Cronjob Failed',
                    },
                    for: '5m',
                    expr: 'sum(data_collector_cronjob_status{status="error"}) by (series_id) > 0',
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
    },
  });
};
