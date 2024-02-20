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
            HOST_URL: {
              type: 'string',
              title: '主机地址',
            },
          },
        },
      },
    }),
    make_docker_compose_file: async (ctx, envCtx) => {
      return {
        [`crysto-api`.replace(/\s/g, '')]: {
          image: `registry.ap-southeast-1.aliyuncs.com/ntnl-y/vendor-deepcoin-api:${
            ctx.version ?? envCtx.version
          }`,
          restart: 'always',
          environment: makeDockerEnvs(ctx.env),
        },
      };
    },
    make_k8s_resource_objects: async (ctx, envCtx) => {
      const entry = ctx.env?.ENTRY!;
      const manifest_key = ctx.key;
      return {
        deployment: {
          apiVersion: 'apps/v1',
          kind: 'Deployment',
          metadata: {
            labels: {
              'y.ntnl.io/version': ctx.version ?? envCtx.version,
              'y.ntnl.io/component': 'crysto-api',
              'y.ntnl.io/manifest-key': manifest_key,
            },
            name: `crysto-api-${manifest_key}`.replace(/\s/g, '').replace(/\./g, '').toLocaleLowerCase(),
            namespace: 'yuan',
          },
          spec: {
            replicas: 1,
            selector: {
              matchLabels: {
                'y.ntnl.io/component': 'crysto-api',
                'y.ntnl.io/manifest-key': manifest_key,
              },
            },
            template: {
              metadata: {
                labels: {
                  'y.ntnl.io/version': ctx.version ?? envCtx.version,
                  'y.ntnl.io/component': 'crysto-api',
                  'y.ntnl.io/manifest-key': manifest_key,
                },
              },
              spec: {
                containers: [
                  {
                    command: ['./node_modules/.bin/ts-node'],
                    args: [`src/${entry}`],
                    env: makeK8sEnvs(ctx.env),
                    image: `registry.ap-southeast-1.aliyuncs.com/ntnl-y/vendor-deepcoin-api:${
                      ctx.version ?? envCtx.version
                    }`,
                    // TODO: remove this after CI is ready
                    imagePullPolicy: 'Always',
                    name: 'crysto-api',
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
                hostname: 'crysto-api',
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
