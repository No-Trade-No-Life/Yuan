import { IExtensionContext, makeDockerEnvs, makeK8sEnvs } from '@yuants/extension';
export default (context: IExtensionContext) => {
  const COMPONENT_NAME = 'app-namespaced-mongodb-storage';
  context.registerDeployProvider({
    make_json_schema: () => ({
      type: 'object',
      title: 'Namespaced MongoDB Storage',
      properties: {
        env: {
          type: 'object',
          required: ['MONGO_URI', 'HOST_URL_BASE', 'ADMIN_PRIVATE_KEY'],
          properties: {
            ADMIN_PRIVATE_KEY: {
              type: 'string',
            },
            HOST_URL_BASE: {
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
        [COMPONENT_NAME]: {
          image: `ghcr.io/no-trade-no-life/${COMPONENT_NAME}:${ctx.version ?? envCtx.version}`,
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
              'y.ntnl.io/component': COMPONENT_NAME,
            },
            name: COMPONENT_NAME,
            namespace: 'yuan',
          },
          spec: {
            replicas: 1,
            selector: {
              matchLabels: {
                'y.ntnl.io/component': COMPONENT_NAME,
              },
            },
            template: {
              metadata: {
                labels: {
                  'y.ntnl.io/version': ctx.version ?? envCtx.version,
                  'y.ntnl.io/component': COMPONENT_NAME,
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
                    image: `ghcr.io/no-trade-no-life/${COMPONENT_NAME}:${ctx.version ?? envCtx.version}`,
                    imagePullPolicy: 'IfNotPresent',
                    name: COMPONENT_NAME,
                    resources: {
                      limits: {
                        cpu: ctx.cpu?.max ?? '500m',
                        memory: ctx.memory?.max ?? '512Mi',
                      },
                      requests: {
                        cpu: ctx.cpu?.min ?? '100m',
                        memory: ctx.memory?.min ?? '128Mi',
                      },
                    },
                  },
                ],
                hostname: COMPONENT_NAME,
              },
            },
          },
        },
        prometheusRule: {
          apiVersion: 'monitoring.coreos.com/v1',
          kind: 'PrometheusRule',
          metadata: {
            labels: {
              'y.ntnl.io/component': COMPONENT_NAME,
              'y.ntnl.io/version': ctx.version ?? envCtx.version,
            },
            name: `${COMPONENT_NAME}-prometheus-rules`,
            namespace: 'yuan',
          },
          spec: {
            groups: [
              {
                name: `${COMPONENT_NAME}.rules`,
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
      };
    },
  });
};
