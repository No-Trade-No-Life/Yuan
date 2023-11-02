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
          required: ['HV_URL', 'STORAGE_TERMINAL_ID'],
          properties: {
            AGENT_CONF_PATH: {
              title: 'Agent Config File Path',
              type: 'string',
            },
            HV_URL: {
              title: 'Host URL',
              type: 'string',
            },
            STORAGE_TERMINAL_ID: {
              title: 'Storage Terminal ID',
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
        // one_json: agentConfSchema,
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
      if (ctx?.env?.AGENT_CONF_PATH === undefined && ctx.one_json === undefined) {
        throw new Error('AGENT_CONF_PATH or volume_data.agent_conf is required for k8s deployment');
      }

      let agentConf: IAgentConf;
      if (ctx?.env?.AGENT_CONF_PATH !== undefined) {
        const agentConfText = await envCtx.readFile(ctx.env!.AGENT_CONF_PATH);
        agentConf = JSON.parse(agentConfText!) as IAgentConf;
      } else {
        agentConf = JSON.parse(ctx.one_json!) as IAgentConf;
      }

      const kernel_id = agentConf.kernel_id;
      if (kernel_id === undefined) {
        throw new Error('kernel_id is required');
      }
      if (!agentConf.bundled_code) {
        throw new Error(`bundled_code is required`);
      }

      const filesystemMapping =
        ctx.one_json === undefined
          ? Object.fromEntries(
              await Promise.all(
                [ctx.env!.AGENT_CONF_PATH].map(
                  async (path) =>
                    [
                      await envCtx.createHashOfSHA256(path),
                      { path, content: await envCtx.readFileAsBase64(path) },
                    ] as const,
                ),
              ),
            )
          : {
              [await envCtx.createHashOfSHA256('/agent_conf.json')]: {
                path: '/agent_conf.json',
                content: await envCtx.toBase64String(JSON.stringify(ctx.one_json)),
              },
            };

      const escapedKernelID = kernel_id.replace(/\/|_/g, '').toLocaleLowerCase();

      return {
        deployment: {
          apiVersion: 'apps/v1',
          kind: 'Deployment',
          metadata: {
            labels: {
              'y.ntnl.io/version': ctx.version ?? envCtx.version,
              'y.ntnl.io/component': 'agent',
              'y.ntnl.io/kernel_id': escapedKernelID,
            },
            name: `agent-${escapedKernelID}`,
            namespace: 'yuan',
          },
          spec: {
            replicas: 1,
            selector: {
              matchLabels: {
                'y.ntnl.io/component': 'agent',
                'y.ntnl.io/kernel_id': escapedKernelID,
              },
            },
            template: {
              metadata: {
                labels: {
                  'y.ntnl.io/version': ctx.version ?? envCtx.version,
                  'y.ntnl.io/component': 'agent',
                  'y.ntnl.io/kernel_id': escapedKernelID,
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
                        cpu: ctx.cpu?.min ?? '200m',
                        memory: ctx.memory?.min ?? '256Mi',
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
                      secretName: `agent-${escapedKernelID}-config`,
                      items: await Promise.all(
                        Object.entries(filesystemMapping).map(async ([k, { path }]) => ({
                          key: k,
                          path: path.substring(1),
                        })),
                      ),
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
            name: `agent-${escapedKernelID}-config`,
            namespace: 'yuan',
            labels: {
              'y.ntnl.io/version': ctx.version ?? envCtx.version,
              'y.ntnl.io/component': 'agent',
              'y.ntnl.io/kernel_id': escapedKernelID,
            },
          },
          data: Object.fromEntries(Object.entries(filesystemMapping).map(([k, { content }]) => [k, content])),
        },
        prometheusRule: {
          apiVersion: 'monitoring.coreos.com/v1',
          kind: 'PrometheusRule',
          metadata: {
            labels: {
              'y.ntnl.io/component': 'agent',
              'y.ntnl.io/version': ctx.version ?? envCtx.version,
            },
            name: 'agent-prometheus-rules',
            namespace: 'yuan',
          },
          spec: {
            groups: [
              {
                name: 'agent.rules',
                rules: [
                  {
                    alert: 'AgentDataSelfCheckError',
                    annotations: {
                      description:
                        'agent data self check error: {{$labels.kernel_id}}-{{$labels.datasource_id}}-{{$labels.product_id}}-{{$labels.period_in_sec}}',
                      runbook_url: 'https://tradelife.feishu.cn/wiki/IsrNwMB9biXfO8kQyUYcBdo1nBb',
                      summary: 'Agent data self check error',
                    },
                    expr: 'sum (period_data_checking_unit_period_self_check_total{status="error"}) by (kernel_id, datasource_id, product_id, period_in_sec) > 0',
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
                    for: '5m',
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
