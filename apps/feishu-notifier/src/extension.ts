import { IExtensionContext, makeDockerEnvs, makeK8sEnvs } from '@yuants/extension';
export default (context: IExtensionContext) => {
  context.registerDeployProvider({
    make_json_schema: () => ({
      type: 'object',
      title: 'Feishu Notifier',
      properties: {
        env: {
          type: 'object',
          required: ['HOST_URL', 'ENV', 'APP_ID', 'APP_SECRET', 'EMERGENCY_RECEIVER_ID'],
          properties: {
            TERMINAL_ID: { type: 'string' },
            HOST_URL: { type: 'string' },
            ENV: { type: 'string' },
            APP_ID: { type: 'string' },
            APP_SECRET: { type: 'string' },
            EMERGENCY_RECEIVER_ID: {
              type: 'string',
              title: 'Emergency receiver_id',
              description:
                'send alert when host not sending Ping message for a while, use colon to separate when multiple receivers',
            },
          },
        },
      },
    }),
    make_docker_compose_file: async (ctx, envCtx) => {
      return {
        [`notifier-feishu-${ctx.env!.APP_ID.replace(/[^A-Za-z0-9]/g, '-')}`]: {
          image: `ghcr.io/no-trade-no-life/app-feishu-notifier:${ctx.version ?? envCtx.version}`,
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
              'y.ntnl.io/component': 'feishu-notifier',
              // 'y.ntnl.io/feishu-app-id': ctx.env!.APP_ID.replace(/[^A-Za-z0-9]/g, '-')
            },
            name: `feishu-notifier`,
            namespace: 'yuan',
          },
          spec: {
            replicas: 1,
            selector: {
              matchLabels: {
                'y.ntnl.io/component': 'feishu-notifier',
                // 'y.ntnl.io/feishu-app-id': ctx.env!.APP_ID.replace(/[^A-Za-z0-9]/g, '-')
              },
            },
            template: {
              metadata: {
                labels: {
                  'y.ntnl.io/version': ctx.version ?? envCtx.version,
                  'y.ntnl.io/component': 'feishu-notifier',
                  // 'y.ntnl.io/feishu-app-id': ctx.env!.APP_ID.replace(/[^A-Za-z0-9]/g, '-')
                },
              },
              spec: {
                containers: [
                  {
                    env: makeK8sEnvs(ctx.env),
                    image: `ghcr.io/no-trade-no-life/app-feishu-notifier:${ctx.version ?? envCtx.version}`,
                    imagePullPolicy: 'IfNotPresent',
                    name: 'feishu-notifier',
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
                  },
                ],
                hostname: 'feishu-notifier',
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
