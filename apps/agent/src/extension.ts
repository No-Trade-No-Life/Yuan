import { IAgentConf } from '@yuants/agent';
import { IExtensionContext, makeDockerEnvs, makeK8sEnvs } from '@yuants/extension';
export default (context: IExtensionContext) => {
  context.registerDeployProvider({
    make_json_schema: () => ({
      title: 'Agent',
      type: 'object',
      properties: {
        env: {
          type: 'object',
          required: ['HV_URL'],
          properties: {
            AGENT_CONF_PATH: {
              title: 'Agent Config File Path',
              type: 'string',
            },
            HV_URL: {
              title: 'Host URL',
              type: 'string',
            },
          },
        },
        filesystem: {
          type: 'object',
          additionalProperties: {
            type: 'string',
          },
        },
      },
    }),
    make_docker_compose_file: async (ctx, envCtx) => {
      const agentConfText = await envCtx.readFile(ctx.env!.AGENT_CONF_PATH);
      const agentConf = JSON.parse(agentConfText!) as IAgentConf;

      if (!ctx?.env?.AGENT_CONF_PATH) {
        throw new Error('AGENT_CONF_PATH is required for docker compose deployment');
      }

      const kernel_id = agentConf.kernel_id;
      if (kernel_id === undefined) {
        throw new Error('kernel_id is required');
      }
      if (!agentConf.bundled_code) {
        throw new Error(`bundled_code is required`);
      }
      const paths = [ctx.env!.AGENT_CONF_PATH];
      return {
        [`agent-${kernel_id.toLocaleLowerCase()}`]: {
          image: `ghcr.io/no-trade-no-life/app-agent:${ctx.version ?? envCtx.version}`,
          restart: 'always',
          volumes: [
            ...(await Promise.all(
              paths.map(async (v) => ({
                type: 'bind',
                source: await envCtx.resolveLocal(v),
                target: `/app/yuan-workspace/${v.substring(1)}`,
              })),
            )),
          ],
          environment: makeDockerEnvs(ctx.env),
        },
      };
    },
    make_k8s_resource_objects: async (ctx, envCtx) => {
      // if there's no AGENT_CONF_PATH, we will use the default agent_conf.json
      if (ctx.one_json === undefined) {
        throw new Error('volume_data.agent_conf is required for k8s deployment');
      }
      const agentConf: IAgentConf = JSON.parse(ctx.one_json);
      const kernel_id = agentConf.kernel_id;
      if (kernel_id === undefined) {
        throw new Error('kernel_id is required');
      }
      if (!agentConf.bundled_code) {
        throw new Error(`bundled_code is required`);
      }
      const manifest_key = ctx.key;

      return {
        deployment: {
          apiVersion: 'apps/v1',
          kind: 'Deployment',
          metadata: {
            labels: {
              'y.ntnl.io/version': ctx.version ?? envCtx.version,
              'y.ntnl.io/component': 'agent',
              'y.ntnl.io/manifest-key': manifest_key,
            },
            name: `agent-${manifest_key}`,
            namespace: 'yuan',
          },
          spec: {
            replicas: 1,
            selector: {
              matchLabels: {
                'y.ntnl.io/component': 'agent',
                'y.ntnl.io/manifest-key': manifest_key,
              },
            },
            template: {
              metadata: {
                labels: {
                  'y.ntnl.io/version': ctx.version ?? envCtx.version,
                  'y.ntnl.io/component': 'agent',
                  'y.ntnl.io/manifest-key': manifest_key,
                },
              },
              spec: {
                containers: [
                  {
                    env: makeK8sEnvs(ctx.env),
                    image: `ghcr.io/no-trade-no-life/app-agent:${ctx.version ?? envCtx.version}`,
                    imagePullPolicy: 'IfNotPresent',
                    name: 'agent',
                    resources: {
                      limits: {
                        cpu: ctx.cpu?.max ?? '200m',
                        memory: ctx.memory?.max ?? '256Mi',
                      },
                      requests: {
                        cpu: ctx.cpu?.min ?? '20m',
                        memory: ctx.memory?.min ?? '128Mi',
                      },
                    },
                    volumeMounts: [
                      {
                        name: 'agent-config',
                        mountPath: '/app/yuan-workspace',
                      },
                    ],
                  },
                ],
                volumes: [
                  {
                    name: 'agent-config',
                    secret: {
                      secretName: `agent-${manifest_key}`,
                      items: [
                        {
                          key: 'agent_conf.json',
                          path: 'agent_conf.json',
                        },
                      ],
                    },
                  },
                ],
                hostname: 'executor',
                imagePullSecrets: [
                  {
                    name: 'pull-secret',
                  },
                ],
              },
            },
          },
        },
        secret: {
          apiVersion: 'v1',
          kind: 'Secret',
          metadata: {
            name: `agent-${manifest_key}`,
            namespace: 'yuan',
            labels: {
              'y.ntnl.io/version': ctx.version ?? envCtx.version,
              'y.ntnl.io/component': 'agent',
              'y.ntnl.io/manifest-key': manifest_key,
            },
          },
          // data: Object.fromEntries(Object.entries(filesystemMapping).map(([k, { content }]) => [k, content])),
          data: {
            'agent_conf.json': await envCtx.toBase64String(ctx.one_json!),
          },
        },
        prometheusRule: {
          apiVersion: 'monitoring.coreos.com/v1',
          kind: 'PrometheusRule',
          metadata: {
            labels: {
              'y.ntnl.io/component': 'agent',
              'y.ntnl.io/version': ctx.version ?? envCtx.version,
              'y.ntnl.io/manifest-key': manifest_key,
            },
            name: `agent-${manifest_key}`,
            namespace: 'yuan',
          },
          spec: {
            groups: [
              {
                name: `agent.rules-${manifest_key}`,
                rules: [
                  {
                    alert: 'AgentDataSelfCheckError',
                    annotations: {
                      description:
                        'agent data self check error: {{$labels.kernel_id}}-{{$labels.datasource_id}}-{{$labels.product_id}}-{{$labels.duration}}',
                      runbook_url: 'https://tradelife.feishu.cn/wiki/IsrNwMB9biXfO8kQyUYcBdo1nBb',
                      summary: 'Agent data self check error',
                    },
                    expr: 'sum (period_data_checking_unit_period_self_check_total{status="error"}) by (kernel_id, datasource_id, product_id, duration) > 0',
                    for: '5m',
                    labels: {
                      severity: 'warning',
                    },
                  },
                  {
                    alert: 'AgentPositionAbruptChangeError',
                    annotations: {
                      description:
                        'agent position change abruptly: {{$labels.account_id}}-{{$labels.product_id}}',
                      runbook_url: 'https://tradelife.feishu.cn/wiki/FfsZwWQ5piwfQKkYBcPcVSMxn9g',
                      summary: 'Agent position abrupt change error',
                    },
                    expr: 'sum (agent_position_error_volume) by (account_id, product_id) > 0',
                    for: '30s',
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
