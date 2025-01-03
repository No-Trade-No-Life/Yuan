import { IExtensionContext, makeDockerEnvs, makeK8sEnvs } from '@yuants/extension';
export default (context: IExtensionContext) => {
  const COMPONENT_NAME = 'app-shared-host';

  context.registerDeployProvider({
    make_json_schema: () => ({
      type: 'object',
      title: 'Host',
      properties: {
        env: {
          type: 'object',
          properties: {
            SUPABASE_URL: { type: 'string' },
            SUPABASE_KEY: { type: 'string' },
          },
        },
        network: {
          type: 'object',
          properties: {
            backward_proxy: {
              type: 'object',
              properties: {
                'shared-host': { type: 'string' },
              },
            },
            port_forward: {
              type: 'object',
              properties: {
                'shared-host': { type: 'number' },
              },
            },
          },
        },
      },
    }),
    make_docker_compose_file: async (ctx, envCtx) => ({
      host: {
        image: `ghcr.io/no-trade-no-life/${COMPONENT_NAME}:${ctx.version ?? envCtx.version}`,
        ports: [['shared-host', 8888]]
          .filter(([name]) => ctx.network?.port_forward?.[name] !== undefined)
          .map(([name, targetPort]) => `${ctx.network!.port_forward![name]}:${targetPort}`),
        environment: makeDockerEnvs(ctx.env),
      },
    }),
    make_k8s_resource_objects: async (ctx, envCtx) => ({
      deployment: {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        metadata: {
          name: 'shared-host',
          namespace: 'yuan',
          labels: {
            'y.ntnl.io/version': ctx.version ?? envCtx.version,
            'y.ntnl.io/component': 'shared-host',
          },
        },
        spec: {
          replicas: 1,
          selector: {
            matchLabels: {
              'y.ntnl.io/component': 'shared-host',
            },
          },
          template: {
            metadata: {
              annotations: {},
              labels: {
                'y.ntnl.io/version': ctx.version ?? envCtx.version,
                'y.ntnl.io/component': 'shared-host',
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
                  name: 'shared-host',
                  image: `ghcr.io/no-trade-no-life/${COMPONENT_NAME}:${ctx.version ?? envCtx.version}`,
                  imagePullPolicy: 'IfNotPresent',
                  env: makeK8sEnvs(ctx.env),
                  ports: [
                    {
                      name: 'shared-host',
                      containerPort: 8888,
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
                },
              ],
            },
          },
        },
      },
      service: {
        apiVersion: 'v1',
        kind: 'Service',
        metadata: {
          name: 'shared-host',
          namespace: 'yuan',
          labels: {
            'y.ntnl.io/version': ctx.version ?? envCtx.version,
            'y.ntnl.io/component': 'shared-host',
          },
        },
        spec: {
          type: 'ClusterIP',
          ports: ['shared-host']
            .map((name) => ({
              port: ctx.network?.port_forward?.[name],
              targetPort: name,
              name,
              protocol: 'TCP',
            }))
            .filter(({ port }) => port != undefined),
          selector: {
            'y.ntnl.io/component': 'shared-host',
          },
        },
      },
      // wss://api.ntnl.io/hosts?host_id=1&host_token=2&terminal_id=3
      ingress: {
        apiVersion: 'networking.k8s.io/v1',
        kind: 'Ingress',
        metadata: {
          name: 'shared-host',
          namespace: 'yuan',
          annotations: {
            'cert-manager.io/cluster-issuer': 'letsencrypt-prod', // TODO(wsy): make this a dependent value
            // 'nginx.ingress.kubernetes.io/auth-signin': `https://${
            //   ctx.annotations!.sso_url
            // }/oauth2/start?rd=$scheme://$best_http_host$request_uri`,
            // 'nginx.ingress.kubernetes.io/auth-url': `https://${ctx.annotations!.sso_url}/oauth2/auth`
          },
          labels: {
            'y.ntnl.io/version': ctx.version ?? envCtx.version,
            'y.ntnl.io/component': 'shared-host',
          },
        },
        spec: {
          ingressClassName: 'nginx',
          rules: ['shared-host']
            .filter(
              (v) =>
                ctx.network?.backward_proxy?.[v] !== undefined &&
                ctx.network?.port_forward?.[v] !== undefined,
            )
            .map((name) => {
              const parts = new URL(ctx.network!.backward_proxy![name]);
              return {
                host: parts.host!,
                http: {
                  paths: [
                    {
                      path: parts.pathname,
                      pathType: 'Prefix',
                      backend: {
                        service: {
                          name,
                          port: {
                            number: ctx.network!.port_forward![name],
                          },
                        },
                      },
                    },
                  ],
                },
              };
            }),
          tls: [
            {
              hosts: Object.values(ctx.network!.backward_proxy ?? {}).map((v) => new URL(v).host),
              secretName: 'shared-host-tls',
            },
          ],
        },
      },
    }),
  });
};
