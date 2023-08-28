import { IAgentConf, agentConfSchema } from '@yuants/agent';
import { IDeploySpec, IEnvContext, makeDockerEnvs, makeK8sEnvs } from '@yuants/protocol';
import { JSONSchema7 } from 'json-schema';

export const make_json_schema = (): JSONSchema7 => ({
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
    one_json: agentConfSchema,
  },
});

export const make_docker_compose_file = async (ctx: IDeploySpec, envCtx: IEnvContext) => {
  const agentConfText = await envCtx.readFile(ctx.env!.AGENT_CONF_PATH);
  const agentConf = JSON.parse(agentConfText!) as IAgentConf;

  if (!ctx?.env?.AGENT_CONF_PATH) {
    throw new Error('AGENT_CONF_PATH is required for docker compose deployment');
  }

  const account_id = agentConf.account_id;
  if (account_id === undefined) {
    throw new Error('account_id is required');
  }
  if (!agentConf.bundled_code) {
    throw new Error(`bundled_code is required`);
  }
  const paths = [ctx.env!.AGENT_CONF_PATH];
  return {
    [`agent-${account_id.toLocaleLowerCase()}`]: {
      image: `ghcr.io/no-trade-no-life/yuan/app-agent:${ctx.version ?? envCtx.version}`,
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
};

export const make_k8s_resource_objects = async (ctx: IDeploySpec, envCtx: IEnvContext) => {
  // if there's no AGENT_CONF_PATH, we will use the default agent_conf.json
  if (ctx?.env?.AGENT_CONF_PATH === undefined && ctx.one_json === undefined) {
    throw new Error('AGENT_CONF_PATH or volume_data.agent_conf is required for k8s deployment');
  }

  let agentConf: IAgentConf;
  if (ctx?.env?.AGENT_CONF_PATH !== undefined) {
    const agentConfText = await envCtx.readFile(ctx.env!.AGENT_CONF_PATH);
    agentConf = JSON.parse(agentConfText!) as IAgentConf;
  } else {
    agentConf = ctx.one_json;
  }

  const account_id = agentConf.account_id;
  if (account_id === undefined) {
    throw new Error('account_id is required');
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

  const escapedAccountID = account_id.replace(/\/|_/g, '').toLocaleLowerCase();

  return {
    deployment: {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: {
        labels: {
          'y.ntnl.io/version': ctx.version ?? envCtx.version,
          'y.ntnl.io/component': 'agent',
          'y.ntnl.io/account_id': escapedAccountID,
        },
        name: `agent-${escapedAccountID}`,
        namespace: 'yuan',
      },
      spec: {
        replicas: 1,
        selector: {
          matchLabels: {
            'y.ntnl.io/component': 'agent',
            'y.ntnl.io/account_id': escapedAccountID,
          },
        },
        template: {
          metadata: {
            labels: {
              'y.ntnl.io/version': ctx.version ?? envCtx.version,
              'y.ntnl.io/component': 'agent',
              'y.ntnl.io/account_id': escapedAccountID,
            },
          },
          spec: {
            containers: [
              {
                env: makeK8sEnvs(ctx.env),
                image: `ghcr.io/no-trade-no-life/yuan/app-agent:${ctx.version ?? envCtx.version}`,
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
                  secretName: `agent-${escapedAccountID}-config`,
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
        name: `agent-${escapedAccountID}-config`,
        namespace: 'yuan',
        labels: {
          'y.ntnl.io/version': ctx.version ?? envCtx.version,
          'y.ntnl.io/component': 'agent',
          'y.ntnl.io/account_id': escapedAccountID,
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
                  description: 'Agent data self check error',
                  runbook_url: 'https://tradelife.feishu.cn/wiki/IsrNwMB9biXfO8kQyUYcBdo1nBb',
                  summary:
                    'agent data self check error: {{$labels.account_id}}-{{$labels.datasource_id}}-{{$labels.product_id}}-{{$labels.period_in_sec}}',
                },
                expr: 'sum (period_data_checking_unit_period_self_check_total{status="error"}) by (account_id, datasource_id, product_id, period_in_sec) > 0',
                for: '5m',
                labels: {
                  severity: 'warning',
                },
              },
              {
                alert: 'AgentPositionAbruptChangeError',
                annotations: {
                  description: 'Agent position abrupt change error',
                  runbook_url: 'https://tradelife.feishu.cn/wiki/FfsZwWQ5piwfQKkYBcPcVSMxn9g',
                  summary: 'agent position change abruptly: {{$labels.account_id}}-{{$labels.product_id}}',
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
};
