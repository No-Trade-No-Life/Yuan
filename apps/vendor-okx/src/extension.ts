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
            ENCRYPTION_KEY_BASE58: { type: 'string' },
          },
        },
      },
    }),
    make_docker_compose_file: async (ctx, envCtx) => {
      return {
        [`okx-${ctx.env!.ACCESS_KEY}`.replace(/\s/g, '')]: {
          image: `ghcr.io/no-trade-no-life/vendor-okx:${ctx.version ?? envCtx.version}`,
          restart: 'always',

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
              'y.ntnl.io/manifest_key': ctx.key,
              'y.ntnl.io/component': 'okx',
            },
            name: `okx-${ctx.key}`.replace(/\s/g, '').toLocaleLowerCase(),
            namespace: 'yuan',
          },
          spec: {
            replicas: 1,
            selector: {
              matchLabels: {
                'y.ntnl.io/component': 'okx',
                'y.ntnl.io/manifest_key': ctx.key,
              },
            },
            template: {
              metadata: {
                labels: {
                  'y.ntnl.io/version': ctx.version ?? envCtx.version,
                  'y.ntnl.io/manifest_key': ctx.key,
                  'y.ntnl.io/component': 'okx',
                },
              },
              spec: {
                containers: [
                  {
                    env: makeK8sEnvs(ctx.env),
                    image: `ghcr.io/no-trade-no-life/vendor-okx:${ctx.version ?? envCtx.version}`,
                    imagePullPolicy: 'IfNotPresent',
                    name: 'okx',
                    resources: {
                      limits: {
                        cpu: ctx.cpu?.max ?? '500m',
                        memory: ctx.memory?.max ?? '256Mi',
                      },
                      requests: {
                        cpu: ctx.cpu?.min ?? '100m',
                        memory: ctx.memory?.min ?? '128Mi',
                      },
                    },
                  },
                ],
                hostname: 'okx',
              },
            },
          },
        },
      };
    },
  });
};
