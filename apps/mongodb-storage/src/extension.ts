import { IExtensionContext, makeDockerEnvs, makeK8sEnvs } from '@yuants/extension';
export default (context: IExtensionContext) => {
  context.registerDeployProvider({
    make_json_schema: () => ({
      type: 'object',
      title: 'MongoDB Storage',
      properties: {
        env: {
          type: 'object',
          required: ['HV_URL', 'MONGO_URI'],
          properties: {
            HV_URL: {
              type: 'string',
            },
            TERMINAL_ID: {
              type: 'string',
            },
            MONGO_URI: {
              type: 'string',
              description: `mongodb://[username:password@]host1[:port1][,...hostN[:portN]][/[defaultauthdb][?options]]，参考 https://www.mongodb.com/docs/manual/reference/connection-string/`,
            },
          },
        },
      },
    }),
    make_docker_compose_file: async (ctx, envCtx) => {
      return {
        mongodb_storage: {
          image: `ghcr.io/no-trade-no-life/app-mongodb-storage:${ctx.version ?? envCtx.version}`,
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
              'y.ntnl.io/component': 'mongodb-storage',
            },
            name: `mongodb-storage`,
            namespace: 'yuan',
          },
          spec: {
            replicas: 1,
            selector: {
              matchLabels: {
                'y.ntnl.io/component': 'mongodb-storage',
              },
            },
            template: {
              metadata: {
                labels: {
                  'y.ntnl.io/version': ctx.version ?? envCtx.version,
                  'y.ntnl.io/component': 'mongodb-storage',
                },
              },
              spec: {
                affinity: {
                  // 最好和 MongoDB 部署在一起
                  podAffinity: {
                    requiredDuringSchedulingIgnoredDuringExecution: [
                      {
                        labelSelector: {
                          matchExpressions: [
                            {
                              key: 'app',
                              operator: 'In',
                              values: ['mongodb-svc'],
                            },
                          ],
                        },
                        topologyKey: 'kubernetes.io/hostname',
                        namespaces: ['mongodb'],
                      },
                    ],
                  },
                },
                priorityClassName: 'system-node-critical',
                containers: [
                  {
                    env: makeK8sEnvs(ctx.env),
                    image: `ghcr.io/no-trade-no-life/app-mongodb-storage:${ctx.version ?? envCtx.version}`,
                    imagePullPolicy: 'IfNotPresent',
                    name: 'mongodb-storage',
                    resources: {
                      limits: {
                        cpu: ctx.cpu?.max ?? '200m',
                        memory: ctx.memory?.max ?? '256Mi',
                      },
                      requests: {
                        cpu: ctx.cpu?.min ?? '100m',
                        memory: ctx.memory?.min ?? '128Mi',
                      },
                    },
                  },
                ],
                hostname: 'mongodb-storage',
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
              'y.ntnl.io/component': 'mongodb-storage',
              'y.ntnl.io/version': ctx.version ?? envCtx.version,
            },
            name: 'mongo-storage-prometheus-rules',
            namespace: 'yuan',
          },
          spec: {
            groups: [
              {
                name: 'mongo-storage.rules',
                rules: [
                  {
                    alert: 'MongodbDown',
                    annotations: {
                      description: 'Mongodb instance down: {{$labels.instance}}',
                      runbook_url: 'https://tradelife.feishu.cn/wiki/wikcnRmuo4NSVUCFyMiGI5jFrBc',
                      summary: 'MongoDB instance down',
                    },
                    expr: 'mongodb_up == 0',
                    labels: {
                      severity: 'critical',
                    },
                  },
                ],
              },
            ],
          },
        },
        hpa: {
          apiVersion: 'autoscaling/v2',
          kind: 'HorizontalPodAutoscaler',
          metadata: {
            name: 'mongodb-storage',
          },
          spec: {
            scaleTargetRef: {
              apiVersion: 'apps/v1',
              kind: 'Deployment',
              name: 'mongodb-storage',
              namespace: 'yuan',
            },
            minReplicas: 1,
            maxReplicas: 3,
            metrics: [
              {
                type: 'Resource',
                resource: {
                  name: 'cpu',
                  target: {
                    type: 'Utilization',
                    averageUtilization: 50,
                  },
                },
              },
            ],
          },
        },
      };
    },
  });
};
