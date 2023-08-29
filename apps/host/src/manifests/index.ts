import { IDeploySpec, IEnvContext, makeDockerEnvs, makeK8sEnvs } from '@yuants/protocol';
import { JSONSchema7 } from 'json-schema';

export const make_json_schema = (): JSONSchema7 => {
  return {
    type: 'object',
    title: 'Host',
    properties: {
      env: {
        type: 'object',
        properties: {
          HOST_TOKEN: { type: 'string', title: 'for client authentication' },
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
  };
};

export const make_docker_compose_file = async (ctx: IDeploySpec, envCtx: IEnvContext) => ({
  host: {
    image: `ghcr.io/no-trade-no-life/app-host:${ctx.version ?? envCtx.version}`,
    ports: [['host', 8888]]
      .filter(([name]) => ctx.network?.port_forward?.[name] !== undefined)
      .map(([name, targetPort]) => `${ctx.network!.port_forward![name]}:${targetPort}`),
    environment: makeDockerEnvs(ctx.env),
  },
});

export const make_k8s_resource_objects = async (ctx: IDeploySpec, envCtx: IEnvContext) => {
  return {
    deployment: {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: {
        name: 'host',
        namespace: 'yuan',
        labels: {
          'y.ntnl.io/version': ctx.version ?? envCtx.version,
          'y.ntnl.io/component': 'host',
        },
      },
      spec: {
        replicas: 1,
        selector: {
          matchLabels: {
            'y.ntnl.io/component': 'host',
          },
        },
        template: {
          metadata: {
            annotations: {},
            labels: {
              'y.ntnl.io/version': ctx.version ?? envCtx.version,
              'y.ntnl.io/component': 'host',
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
                name: 'host',
                image: `ghcr.io/no-trade-no-life/app-host:${ctx.version ?? envCtx.version}`,
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
        name: 'host',
        namespace: 'yuan',
        labels: {
          'y.ntnl.io/version': ctx.version ?? envCtx.version,
          'y.ntnl.io/component': 'host',
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
          'y.ntnl.io/component': 'host',
        },
      },
    },
    ingress: {
      apiVersion: 'networking.k8s.io/v1',
      kind: 'Ingress',
      metadata: {
        name: 'host',
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
          'y.ntnl.io/component': 'host',
        },
      },
      spec: {
        ingressClassName: 'nginx',
        rules: ['host']
          .filter(
            (v) =>
              ctx.network?.backward_proxy?.[v] !== undefined && ctx.network?.port_forward?.[v] !== undefined,
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
  };
};
