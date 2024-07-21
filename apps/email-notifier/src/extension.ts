import { IExtensionContext, makeDockerEnvs, makeK8sEnvs } from '@yuants/extension';
export default (context: IExtensionContext) => {
  context.registerDeployProvider({
    make_json_schema: () => ({
      type: 'object',
      title: 'Email Notifier',
      properties: {
        env: {
          type: 'object',
          required: ['HOST_URL', 'EMAIL_USER'],
          properties: {
            HOST_URL: {
              type: 'string',
            },
            EMAIL_USER: {
              type: 'string',
            },
            EMAIL_PASS: {
              type: 'string',
            },
            SMTP_HOST: {
              type: 'string',
            },
            SMTP_PASS: {
              type: 'string',
            },
            IMAP_HOST: {
              type: 'string',
            },
            IMAP_PASS: {
              type: 'string',
            },
          },
        },
      },
    }),
    make_docker_compose_file: async (ctx, envCtx) => {
      return {
        [`notifier-email-${ctx.env!.EMAIL_USER.replace(/[^A-Za-z0-9]/g, '-')}`]: {
          image: `ghcr.io/no-trade-no-life/app-email-notifier:${ctx.version ?? envCtx.version}`,
          environment: makeDockerEnvs(ctx.env),
        },
      };
    },
    make_k8s_resource_objects: async (ctx, envCtx) => {
      const name = ctx.env!.EMAIL_USER.replace(/[^A-Za-z0-9]/g, '-');
      return {
        deployment: {
          apiVersion: 'apps/v1',
          kind: 'Deployment',
          metadata: {
            labels: {
              'y.ntnl.io/version': ctx.version ?? envCtx.version,
              'y.ntnl.io/email-user': name,
              'y.ntnl.io/component': 'email-notifier',
            },
            name: `email-notifier-${name}`,
            namespace: 'yuan',
          },
          spec: {
            replicas: 1,
            selector: {
              matchLabels: {
                'y.ntnl.io/component': 'email-notifier',
                'y.ntnl.io/email-user': name,
              },
            },
            template: {
              metadata: {
                labels: {
                  'y.ntnl.io/version': ctx.version ?? envCtx.version,
                  'y.ntnl.io/component': 'email-notifier',
                  'y.ntnl.io/email-user': name,
                },
              },
              spec: {
                containers: [
                  {
                    env: makeK8sEnvs(ctx.env),
                    image: `ghcr.io/no-trade-no-life/app-email-notifier:${ctx.version ?? envCtx.version}`,
                    imagePullPolicy: 'IfNotPresent',
                    name: 'email-notifier',
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
                hostname: 'email-notifier',
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
