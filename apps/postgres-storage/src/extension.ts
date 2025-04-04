import { IExtensionContext, makeDockerEnvs, makeK8sEnvs } from '@yuants/extension';
export default (context: IExtensionContext) => {
  const COMPONENT_NAME = 'app-postgres-storage';
  context.registerDeployProvider({
    make_json_schema: () => ({
      type: 'object',
      title: COMPONENT_NAME,
      properties: {
        env: {
          type: 'object',
          required: ['HOST_URL', 'POSTGRES_URI'],
          properties: {
            HOST_URL: {
              type: 'string',
            },
            TERMINAL_ID: {
              type: 'string',
            },
            ENABLE_WEBRTC: {
              type: 'string',
            },
            POSTGRES_URI: {
              type: 'string',
              description: `postgres://[username:password@]host1[:port1][,...hostN[:portN]][/[defaultauthdb][?options]]`,
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
                priorityClassName: 'system-node-critical',
                containers: [
                  {
                    env: makeK8sEnvs(ctx.env),
                    image: `ghcr.io/no-trade-no-life/${COMPONENT_NAME}:${ctx.version ?? envCtx.version}`,
                    imagePullPolicy: 'IfNotPresent',
                    name: COMPONENT_NAME,
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
                hostname: COMPONENT_NAME,
                imagePullSecrets: [
                  {
                    name: 'pull-secret',
                  },
                ],
              },
            },
          },
        },
        hpa: {
          apiVersion: 'autoscaling/v2',
          kind: 'HorizontalPodAutoscaler',
          metadata: {
            name: COMPONENT_NAME,
            namespace: 'yuan',
          },
          spec: {
            scaleTargetRef: {
              apiVersion: 'apps/v1',
              kind: 'Deployment',
              name: COMPONENT_NAME,
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
