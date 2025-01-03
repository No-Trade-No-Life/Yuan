import { IExtensionContext, makeDockerEnvs, makeK8sEnvs } from '@yuants/extension';

export default (context: IExtensionContext) => {
  const COMPONENT_NAME = 'app-transfer-controller';

  context.registerDeployProvider({
    make_json_schema: () => ({
      type: 'object',
      title: COMPONENT_NAME,
      properties: {
        env: {
          type: 'object',
          required: ['HOST_URL'],
          properties: {
            TERMINAL_ID: { type: 'string' },
            HOST_URL: { type: 'string' },
          },
        },
      },
    }),
    make_docker_compose_file: async (ctx, envCtx) => {
      return {
        [COMPONENT_NAME]: {
          image: `ghcr.io/no-trade-no-life/${COMPONENT_NAME}:${ctx.version ?? envCtx.version}`,
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
              'y.ntnl.io/component': COMPONENT_NAME,
            },
            name: COMPONENT_NAME,
            namespace: 'yuan',
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
                labels: {
                  'y.ntnl.io/version': ctx.version ?? envCtx.version,
                  'y.ntnl.io/component': COMPONENT_NAME,
                },
              },
              spec: {
                containers: [
                  {
                    env: makeK8sEnvs(ctx.env),
                    image: `ghcr.io/no-trade-no-life/${COMPONENT_NAME}:${ctx.version ?? envCtx.version}`,
                    imagePullPolicy: 'IfNotPresent',
                    name: COMPONENT_NAME,
                    resources: {
                      limits: {
                        cpu: ctx.cpu?.max ?? '200',
                        memory: ctx.memory?.max ?? '256Mi',
                      },
                      requests: {
                        cpu: ctx.cpu?.min ?? '50m',
                        memory: ctx.memory?.min ?? '64Mi',
                      },
                    },
                  },
                ],
                hostname: COMPONENT_NAME,
                imagePullSecrets: [
                  {
                    name: 'pull-secret',
                  },
                ],
              },
            },
          },
        },
        prometheusRule: {
          apiVersion: 'monitoring.coreos.com/v1',
          kind: 'PrometheusRule',
          metadata: {
            labels: {
              'y.ntnl.io/component': COMPONENT_NAME,
              'y.ntnl.io/version': ctx.version ?? envCtx.version,
            },
            name: `${COMPONENT_NAME}.rules`,
            namespace: 'yuan',
          },
          spec: {
            groups: [
              {
                name: `${COMPONENT_NAME}.rules`,
                rules: [
                  {
                    alert: 'TransferErrorOccurred',
                    annotations: {
                      description:
                        'Transfer Error Occurred: {{$labels.credit_account_id}} {{$labels.debit_account_id}}',
                      runbook_url: 'TBD contact c1@ntnl.io for help',
                      summary: 'Transfer Error Occurred',
                    },
                    expr: 'failed_transfer_orders > 0',
                    labels: {
                      severity: 'critical',
                    },
                  },
                ],
              },
            ],
          },
        },
      };
    },
  });
};
