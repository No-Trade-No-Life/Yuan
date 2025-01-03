import { IExtensionContext, makeDockerEnvs, makeK8sEnvs } from '@yuants/extension';
export default (context: IExtensionContext) => {
  context.registerDeployProvider({
    make_json_schema: () => ({
      type: 'object',
      properties: {
        env: {
          type: 'object',
          required: ['HOST_URL'],
          properties: {
            //
            PUBLIC_ONLY: { type: 'boolean' },
            HOST_URL: { type: 'string' },
            TERMINAL_ID: { type: 'string' },
            EXCHANGE_ID: { type: 'string' },
            ACCOUNT_ID: { type: 'string' },
            CURRENCY: { type: 'string' },
            PASSWORD: { type: 'string' },
            API_KEY: { type: 'string' },
            SECRET: { type: 'string' },
          },
        },
      },
    }),
    make_docker_compose_file: async (ctx, envCtx) => {
      return {
        [`ccxt-${ctx.env!.EXCHANGE_ID}-${ctx.env!.ACCOUNT_ID}`.replace(/\s/g, '')]: {
          image: `ghcr.io/no-trade-no-life/vendor-ccxt:${ctx.version ?? envCtx.version}`,
          restart: 'always',

          environment: makeDockerEnvs(ctx.env),
        },
      };
    },
    make_k8s_resource_objects: async (ctx, envCtx) => {
      const EXCHANGE_ID = ctx.env!.EXCHANGE_ID;
      return {
        deployment: {
          apiVersion: 'apps/v1',
          kind: 'Deployment',
          metadata: {
            labels: {
              'y.ntnl.io/version': ctx.version ?? envCtx.version,
              'y.ntnl.io/manifest_key': ctx.key,
              'y.ntnl.io/component': 'ccxt',
            },
            name: `ccxt-${EXCHANGE_ID}-${ctx.key}`.replace(/\s/g, '').toLocaleLowerCase(),
            namespace: 'yuan',
          },
          spec: {
            replicas: 1,
            selector: {
              matchLabels: {
                'y.ntnl.io/component': 'ccxt',
                'y.ntnl.io/manifest_key': ctx.key,
              },
            },
            template: {
              metadata: {
                labels: {
                  'y.ntnl.io/version': ctx.version ?? envCtx.version,
                  'y.ntnl.io/manifest_key': ctx.key,
                  'y.ntnl.io/component': 'ccxt',
                },
              },
              spec: {
                containers: [
                  {
                    env: makeK8sEnvs(ctx.env),
                    image: `ghcr.io/no-trade-no-life/vendor-ccxt:${ctx.version ?? envCtx.version}`,
                    imagePullPolicy: 'IfNotPresent',
                    name: 'ccxt',
                    resources: {
                      limits: {
                        cpu: ctx.cpu?.max ?? '1',
                        memory: ctx.memory?.max ?? '512Mi',
                      },
                      requests: {
                        cpu: ctx.cpu?.min ?? '200m',
                        memory: ctx.memory?.min ?? '256Mi',
                      },
                    },
                  },
                ],
                hostname: 'ccxt',
              },
            },
          },
        },
      };
    },
  });
};
