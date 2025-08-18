import { IExtensionContext, makeDockerEnvs, makeK8sEnvs } from '@yuants/extension';
export default (context: IExtensionContext) => {
  const COMPONENT_NAME = 'node-unit';

  context.registerDeployProvider({
    make_json_schema: () => ({
      type: 'object',
      properties: {
        env: {
          type: 'object',
          properties: {
            HOST_TOKEN: { type: 'string', title: 'for client authentication' },
            POSTGRES_URI: { type: 'string', title: 'Postgres URI' },
          },
        },
        network: {
          type: 'object',
          properties: {
            backward_proxy: {
              type: 'object',
              properties: {
                host: { type: 'string' },
              },
            },
            port_forward: {
              type: 'object',
              properties: {
                host: { type: 'number' },
              },
            },
          },
        },
      },
    }),
    make_docker_compose_file: async (ctx, envCtx) => ({
      [COMPONENT_NAME]: {
        image: `ghcr.io/no-trade-no-life/${COMPONENT_NAME}:${ctx.version ?? envCtx.version}`,
        ports: [['host', 8888]]
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
          name: COMPONENT_NAME,
          namespace: 'yuan',
          labels: {
            'y.ntnl.io/version': ctx.version ?? envCtx.version,
            'y.ntnl.io/component': COMPONENT_NAME,
          },
        },
        spec: {
          replicas: 1,
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
              affinity: {
                nodeAffinity: {
                  preferredDuringSchedulingIgnoredDuringExecution: [
                    {
                      weight: 50,
                      preference: {
                        matchExpressions: [
                          {
                            key: 'node-role.kubernetes.io/spot-worker',
                            operator: 'DoesNotExist',
                          },
                        ],
                      },
                    },
                  ],
                },
              },
              priorityClassName: 'system-cluster-critical',
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
                  env: makeK8sEnvs(ctx.env),
                  ports: [
                    {
                      name: 'host',
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
          name: COMPONENT_NAME,
          namespace: 'yuan',
          labels: {
            'y.ntnl.io/version': ctx.version ?? envCtx.version,
            'y.ntnl.io/component': COMPONENT_NAME,
          },
        },
        spec: {
          type: 'ClusterIP',
          ports: ['host']
            .map((name) => ({
              port: ctx.network?.port_forward?.[name],
              targetPort: name,
              name,
              protocol: 'TCP',
            }))
            .filter(({ port }) => port != undefined),
          selector: {
            'y.ntnl.io/component': COMPONENT_NAME,
          },
        },
      },
      ingress: {
        apiVersion: 'networking.k8s.io/v1',
        kind: 'Ingress',
        metadata: {
          name: COMPONENT_NAME,
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
            'y.ntnl.io/component': COMPONENT_NAME,
          },
        },
        spec: {
          ingressClassName: 'nginx',
          rules: ['host']
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
              secretName: 'host-tls',
            },
          ],
        },
      },
    }),
  });
};
