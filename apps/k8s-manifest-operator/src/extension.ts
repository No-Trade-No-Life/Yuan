import { IExtensionContext, makeDockerEnvs, makeK8sEnvs } from '@yuants/extension';
export default (context: IExtensionContext) => {
  context.registerDeployProvider({
    make_json_schema: () => ({
      type: 'object',
      title: `Yuan K8s Manifest Operator`,
      properties: {
        env: {
          type: 'object',
          required: [],
          properties: {
            PACKAGE_ALLOW_LIST: {
              type: 'string',
            },
          },
        },
      },
    }),
    make_docker_compose_file: async (ctx, envCtx) => ({
      [`k8s-manifest-operator`]: {
        image: `ghcr.io/no-trade-no-life/app-k8s-manifest-operator:${ctx.version ?? envCtx.version}`,
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
              'y.ntnl.io/component': `k8s-manifest-operator`,
            },
            name: `the-operator`,
            namespace: 'yuan',
          },
          spec: {
            replicas: 1,
            selector: {
              matchLabels: {
                'y.ntnl.io/component': `k8s-manifest-operator`,
              },
            },
            template: {
              metadata: {
                labels: {
                  'y.ntnl.io/version': ctx.version ?? envCtx.version,
                  'y.ntnl.io/component': `k8s-manifest-operator`,
                },
              },
              spec: {
                serviceAccountName: `k8s-manifest-operator`,
                containers: [
                  {
                    env: makeK8sEnvs(ctx.env),
                    image: `ghcr.io/no-trade-no-life/app-k8s-manifest-operator:${
                      ctx.version ?? envCtx.version
                    }`,
                    imagePullPolicy: 'IfNotPresent',
                    name: `k8s-manifest-operator`,
                    resources: {
                      limits: {
                        cpu: ctx.cpu?.max ?? '200m',
                        memory: ctx.memory?.max ?? '256Mi',
                      },
                      requests: {
                        cpu: ctx.cpu?.min ?? '50m',
                        memory: ctx.memory?.min ?? '128Mi',
                      },
                    },
                  },
                ],
                hostname: `k8s-manifest-operator`,
                imagePullSecrets: [
                  {
                    name: 'pull-secret',
                  },
                ],
              },
            },
          },
        },
        serviceaccount: {
          apiVersion: 'v1',
          kind: 'ServiceAccount',
          metadata: {
            name: `k8s-manifest-operator`,
            namespace: 'yuan',
            labels: {
              'y.ntnl.io/version': ctx.version ?? envCtx.version,
              'y.ntnl.io/component': `k8s-manifest-operator`,
            },
          },
        },
        clusterrole: {
          apiVersion: 'rbac.authorization.k8s.io/v1',
          kind: 'ClusterRole',
          metadata: {
            name: `k8s-manifest-operator`,
            labels: {
              'y.ntnl.io/version': ctx.version ?? envCtx.version,
              'y.ntnl.io/component': `k8s-manifest-operator`,
            },
          },
          rules: [
            {
              apiGroups: ['*'],
              resources: ['*'],
              verbs: ['*'],
            },
          ],
        },
        clusterrolebinding: {
          apiVersion: 'rbac.authorization.k8s.io/v1',
          kind: 'ClusterRoleBinding',
          metadata: {
            name: `k8s-manifest-operator`,
            labels: {
              'y.ntnl.io/version': ctx.version ?? envCtx.version,
              'y.ntnl.io/component': `k8s-manifest-operator`,
            },
          },
          roleRef: {
            apiGroup: 'rbac.authorization.k8s.io',
            kind: 'ClusterRole',
            name: `k8s-manifest-operator`,
          },
          subjects: [
            {
              kind: 'ServiceAccount',
              name: `k8s-manifest-operator`,
              namespace: 'yuan',
            },
          ],
        },
      };
    },
  });
};
