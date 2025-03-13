import { IExtensionContext, makeDockerEnvs, makeK8sEnvs } from '@yuants/extension';
export default (context: IExtensionContext) => {
  const PACKAGE_NAME = 'vendor-solscan';

  context.registerDeployProvider({
    make_json_schema: () => ({
      type: 'object',
      properties: {
        env: {
          type: 'object',
          required: ['HOST_URL', 'SOLSCAN_API_TOKEN'],
          properties: {
            HOST_URL: { type: 'string' },
            TERMINAL_ID: { type: 'string' },
            SOLSCAN_API_TOKEN: { type: 'string' },
          },
        },
      },
    }),
    make_docker_compose_file: async (ctx, envCtx) => {
      return {
        [`${PACKAGE_NAME}-${ctx.key}`.replace(/\s/g, '')]: {
          image: `ghcr.io/no-trade-no-life/${PACKAGE_NAME}:${ctx.version ?? envCtx.version}`,
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
              'y.ntnl.io/component': PACKAGE_NAME,
            },
            name: `${PACKAGE_NAME}-${ctx.key}`.replace(/\s/g, '').toLocaleLowerCase(),
            namespace: 'yuan',
          },
          spec: {
            replicas: 1,
            selector: {
              matchLabels: {
                'y.ntnl.io/component': PACKAGE_NAME,
                'y.ntnl.io/manifest_key': ctx.key,
              },
            },
            template: {
              metadata: {
                labels: {
                  'y.ntnl.io/version': ctx.version ?? envCtx.version,
                  'y.ntnl.io/manifest_key': ctx.key,
                  'y.ntnl.io/component': PACKAGE_NAME,
                },
              },
              spec: {
                containers: [
                  {
                    env: makeK8sEnvs(ctx.env),
                    image: `ghcr.io/no-trade-no-life/${PACKAGE_NAME}:${ctx.version ?? envCtx.version}`,
                    imagePullPolicy: 'IfNotPresent',
                    name: PACKAGE_NAME,
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
                hostname: PACKAGE_NAME,
              },
            },
          },
        },
      };
    },
  });
};
