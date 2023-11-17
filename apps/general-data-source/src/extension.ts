import { IExtensionContext, makeDockerEnvs, makeK8sEnvs } from '@yuants/extension';
export default (context: IExtensionContext) => {
  context.registerDeployProvider({
    make_json_schema: () => ({
      type: 'object',
      title: 'General Data Source',
      properties: {
        env: {
          type: 'object',
          required: ['HV_URL', 'STORAGE_TERMINAL_ID'],
          properties: {
            TERMINAL_ID: { type: 'string' },
            HV_URL: { type: 'string' },
            STORAGE_TERMINAL_ID: { type: 'string' },
          },
        },
      },
    }),
    make_docker_compose_file: async (ctx, envCtx) => ({
      [`general-data-source`]: {
        image: `registry.ap-southeast-1.aliyuncs.com/ntnl-y/app-general-data-source:${
          ctx.version ?? envCtx.version
        }`,
        environment: makeDockerEnvs(ctx.env),
      },
    }),
    make_k8s_resource_objects: async (ctx, envCtx) => {
      return {
        deployment: {
          apiVersion: 'apps/v1',
          kind: 'Deployment',
          metadata: {
            labels: {
              'y.ntnl.io/version': ctx.version ?? envCtx.version,
              'y.ntnl.io/component': 'general-data-source',
            },
            name: `general-data-source`,
            namespace: 'yuan',
          },
          spec: {
            replicas: 1,
            selector: {
              matchLabels: {
                'y.ntnl.io/component': 'general-data-source',
              },
            },
            template: {
              metadata: {
                labels: {
                  'y.ntnl.io/version': ctx.version ?? envCtx.version,
                  'y.ntnl.io/component': 'general-data-source',
                },
              },
              spec: {
                containers: [
                  {
                    env: makeK8sEnvs(ctx.env),
                    image: `registry.ap-southeast-1.aliyuncs.com/ntnl-y/app-general-data-source:${
                      ctx.version ?? envCtx.version
                    }`,
                    imagePullPolicy: 'IfNotPresent',
                    name: 'general-data-source',
                    resources: {
                      limits: {
                        cpu: ctx.cpu?.max ?? '400m',
                        memory: ctx.memory?.max ?? '512Mi',
                      },
                      requests: {
                        cpu: ctx.cpu?.min ?? '20m',
                        memory: ctx.memory?.min ?? '64Mi',
                      },
                    },
                  },
                ],
                hostname: 'general-data-source',
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
