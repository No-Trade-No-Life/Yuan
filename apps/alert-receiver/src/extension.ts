import { IExtensionContext, makeDockerEnvs, makeK8sEnvs } from '@yuants/extension';

export default (context: IExtensionContext) => {
  context.registerDeployProvider({
    make_json_schema: () => {
      return {
        type: 'object',
        title: 'Webhook Alert Receiver',
        properties: {
          env: {
            type: 'object',
            required: ['HOST_URL', 'ENV'],
            properties: {
              TERMINAL_ID: { type: 'string' },
              HOST_URL: { type: 'string' },
              ENV: { type: 'string' },
            },
          },
        },
      };
    },
    make_docker_compose_file: async (ctx, envCtx) => {
      return {
        [`webhook-receiver-alert`]: {
          image: `ghcr.io/no-trade-no-life/app-alert-receiver:${ctx.version ?? envCtx.version}`,
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
              'y.ntnl.io/component': 'alert-receiver',
            },
            name: `alert-receiver`,
            namespace: 'yuan',
          },
          spec: {
            replicas: 1,
            selector: {
              matchLabels: {
                'y.ntnl.io/component': 'alert-receiver',
              },
            },
            template: {
              metadata: {
                labels: {
                  'y.ntnl.io/version': ctx.version ?? envCtx.version,
                  'y.ntnl.io/component': 'alert-receiver',
                },
              },
              spec: {
                containers: [
                  {
                    env: makeK8sEnvs(ctx.env),
                    image: `ghcr.io/no-trade-no-life/app-alert-receiver:${ctx.version ?? envCtx.version}`,
                    imagePullPolicy: 'IfNotPresent',
                    name: 'alert-receiver',
                    ports: [
                      {
                        name: 'http',
                        containerPort: 3000,
                        protocol: 'TCP',
                      },
                    ],
                    resources: {
                      limits: {
                        cpu: ctx.cpu?.max ?? '400m',
                        memory: ctx.memory?.max ?? '512Mi',
                      },
                      requests: {
                        cpu: ctx.cpu?.min ?? '100m',
                        memory: ctx.memory?.min ?? '128Mi',
                      },
                    },
                    volumeMounts: [
                      {
                        name: 'config',
                        mountPath: '/etc/alert-receiver',
                      },
                    ],
                  },
                ],
                volumes: [
                  {
                    name: 'config',
                    secret: {
                      secretName: `alert-receiver-config`,
                      items: [
                        {
                          key: 'config.json',
                          path: 'config.json',
                        },
                      ],
                    },
                  },
                ],
                hostname: 'alert-receiver',
                imagePullSecrets: [
                  {
                    name: 'pull-secret',
                  },
                ],
              },
            },
          },
        },
      };
    },
  });
};
