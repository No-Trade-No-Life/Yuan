import { IExtensionContext, makeDockerEnvs, makeK8sEnvs } from '@yuants/extension';
export default (context: IExtensionContext) => {
  context.registerDeployProvider({
    make_json_schema: () => ({
      type: 'object',
      title: 'Metrics Collector',
      properties: {
        env: {
          type: 'object',
          required: ['HV_URL'],
          properties: {
            HV_URL: {
              type: 'string',
            },
            TERMINAL_ID: {
              type: 'string',
            },
          },
        },
      },
    }),
    make_docker_compose_file: async (ctx, envCtx) => {
      return {
        metrics_collector: {
          image: `ghcr.io/no-trade-no-life/app-metrics-collector:${ctx.version ?? envCtx.version}`,
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
              'y.ntnl.io/component': 'metrics-collector',
            },
            name: `metrics-collector`,
            namespace: 'yuan',
          },
          spec: {
            replicas: 1,
            selector: {
              matchLabels: {
                'y.ntnl.io/component': 'metrics-collector',
              },
            },
            template: {
              metadata: {
                labels: {
                  'y.ntnl.io/version': ctx.version ?? envCtx.version,
                  'y.ntnl.io/component': 'metrics-collector',
                },
              },
              spec: {
                affinity: {
                  nodeAffinity: {
                    requiredDuringSchedulingIgnoredDuringExecution: {
                      nodeSelectorTerms: [
                        {
                          matchExpressions: [
                            {
                              key: 'node-role.kubernetes.io/spot-worker',
                              operator: 'DoesNotExist',
                            },
                            {
                              key: 'node-role.ntnl.io/spot-worker',
                              operator: 'DoesNotExist',
                            },
                          ],
                        },
                      ],
                    },
                  },
                },
                priorityClassName: 'system-node-critical',
                containers: [
                  {
                    env: makeK8sEnvs(ctx.env),
                    image: `ghcr.io/no-trade-no-life/app-metrics-collector:${ctx.version ?? envCtx.version}`,
                    ports: [
                      {
                        name: 'http',
                        containerPort: 8080,
                        protocol: 'TCP',
                      },
                    ],
                    imagePullPolicy: 'IfNotPresent',
                    name: 'metrics-collector',
                    resources: {
                      limits: {
                        cpu: ctx.cpu?.max ?? '200m',
                        memory: ctx.memory?.max ?? '512Mi',
                      },
                      requests: {
                        cpu: ctx.cpu?.min ?? '100m',
                        memory: ctx.memory?.min ?? '256Mi',
                      },
                    },
                  },
                ],
                hostname: 'metrics-collector',
                imagePullSecrets: [
                  {
                    name: 'pull-secret',
                  },
                ],
              },
            },
          },
        },
        service: {
          apiVersion: 'v1',
          kind: 'Service',
          metadata: {
            name: 'metrics-collector',
            namespace: 'yuan',
            labels: {
              'y.ntnl.io/version': ctx.version ?? envCtx.version,
              'y.ntnl.io/component': 'metrics-collector',
            },
          },
          spec: {
            type: 'ClusterIP',
            ports: ['http']
              .map((name) => ({
                port: ctx.network?.port_forward?.[name],
                targetPort: name,
                name,
                protocol: 'TCP',
              }))
              .filter(({ port }) => port != undefined),
            selector: {
              'y.ntnl.io/component': 'metrics-collector',
            },
          },
        },
        serviceMonitor: {
          apiVersion: 'monitoring.coreos.com/v1',
          kind: 'ServiceMonitor',
          metadata: {
            name: 'metrics-collector',
            namespace: 'yuan',
            labels: {
              'y.ntnl.io/version': ctx.version ?? envCtx.version,
              'y.ntnl.io/component': 'metrics-collector',
            },
          },
          spec: {
            endpoints: [
              {
                interval: '30s',
                port: 'http',
              },
            ],
            namespaceSelector: {
              matchNames: ['yuan'],
            },
            selector: {
              matchLabels: {
                'y.ntnl.io/component': 'metrics-collector',
              },
            },
          },
        },
        prometheusRule: {
          apiVersion: 'monitoring.coreos.com/v1',
          kind: 'PrometheusRule',
          metadata: {
            labels: {
              'y.ntnl.io/component': 'metrics-collector',
              'y.ntnl.io/version': ctx.version ?? envCtx.version,
            },
            name: 'metircs-collector-prometheus-rules',
            namespace: 'yuan',
          },
          spec: {
            groups: [
              {
                name: 'metrics-collector.rules',
                rules: [
                  {
                    alert: 'MetricsCollectorTargetDown',
                    annotations: {
                      description: 'Metrics Collector No Response',
                      runbook_url: 'https://tradelife.feishu.cn/wiki/wikcnBu8z4s8RsQQJhv68oKQNBh',
                      summary: 'Metrics Collector No Response',
                    },
                    expr: 'up{service="metrics-collector"} < 1',
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
    },
  });
};
