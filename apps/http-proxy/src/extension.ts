import { IExtensionContext, makeDockerEnvs, makeK8sEnvs } from '@yuants/extension';
export default (context: IExtensionContext) => {
  const COMPONENT_NAME = 'app-http-proxy';

  context.registerDeployProvider({
    make_json_schema: () => ({
      type: 'object',
      properties: {
        env: {
          type: 'object',
          properties: {
            HOST_URL: { type: 'string', title: 'Host URL' },
          },
        },
      },
    }),
    make_docker_compose_file: async (ctx, envCtx) => ({
      [COMPONENT_NAME]: {
        image: `ghcr.io/no-trade-no-life/${COMPONENT_NAME}:${ctx.version ?? envCtx.version}`,
        environment: makeDockerEnvs(ctx.env),
      },
    }),
    make_k8s_resource_objects: async (ctx, envCtx) => ({
      daemonSet: {
        apiVersion: 'apps/v1',
        kind: 'DaemonSet',
        metadata: {
          name: COMPONENT_NAME,
          namespace: 'yuan',
          labels: {
            'y.ntnl.io/version': ctx.version ?? envCtx.version,
            'y.ntnl.io/component': COMPONENT_NAME,
          },
        },
        spec: {
          selector: {
            matchLabels: {
              'y.ntnl.io/component': COMPONENT_NAME,
            },
          },
          template: {
            metadata: {
              annotations: {},
              labels: {
                'y.ntnl.io/version': ctx.version ?? envCtx.version,
                'y.ntnl.io/component': COMPONENT_NAME,
              },
            },
            spec: {
              imagePullSecrets: [
                {
                  name: 'pull-secret', // TODO(wsy): such things should be managed at namespace scope
                },
              ],
              containers: [
                {
                  name: COMPONENT_NAME,
                  image: `ghcr.io/no-trade-no-life/${COMPONENT_NAME}:${ctx.version ?? envCtx.version}`,
                  imagePullPolicy: 'IfNotPresent',
                  env: [
                    ...makeK8sEnvs(ctx.env),
                    {
                      name: 'HOSTNAME',
                      valueFrom: {
                        fieldRef: {
                          fieldPath: 'spec.nodeName',
                        },
                      },
                    },
                  ],
                  resources: {
                    limits: {
                      cpu: ctx.cpu?.max ?? '1',
                      memory: ctx.memory?.max ?? '1Gi',
                    },
                    requests: {
                      cpu: ctx.cpu?.min ?? '1',
                      memory: ctx.memory?.min ?? '1Gi',
                    },
                  },
                },
              ],
            },
          },
        },
      },
    }),
  });
};
