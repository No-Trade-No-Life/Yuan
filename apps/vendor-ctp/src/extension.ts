import { IExtensionContext, makeDockerEnvs, makeK8sEnvs } from '@yuants/extension';
export default (context: IExtensionContext) => {
  context.registerDeployProvider({
    make_json_schema: () => ({
      type: 'object',
      properties: {
        env: {
          type: 'object',
          required: [
            'HV_URL',
            'TRADER_ADDR',
            'MARKET_ADDR',
            'BROKER_ID',
            'USER_ID',
            'PASSWORD',
            'APP_ID',
            'AUTH_CODE',
          ],
          properties: {
            HV_URL: { type: 'string' },
            NO_TRADE: { type: 'boolean' },
            TRADER_ADDR: { type: 'string' },
            MARKET_ADDR: { type: 'string' },
            BROKER_ID: { type: 'string' },
            USER_ID: { type: 'string' },
            PASSWORD: { type: 'string', format: 'password' },
            APP_ID: { type: 'string' },
            AUTH_CODE: { type: 'string' },
          },
        },
      },
    }),
    make_docker_compose_file: async (ctx, envCtx) => {
      const brokerId = ctx.env!.BROKER_ID;
      const userId = ctx.env!.USER_ID;
      return {
        [`ctp-${brokerId}-${userId}`]: {
          image: `ghcr.io/no-trade-no-life/vendor-ctp:${ctx.version ?? envCtx.version}`,
          restart: 'always',
          environment: makeDockerEnvs(ctx.env),
        },
      };
    },
    make_k8s_resource_objects: async (ctx, envCtx) => {
      const brokerId = ctx.env!.BROKER_ID;
      const userId = ctx.env!.USER_ID;
      return {
        deployment: {
          apiVersion: 'apps/v1',
          kind: 'Deployment',
          metadata: {
            labels: {
              'y.ntnl.io/version': ctx.version ?? envCtx.version,
              'y.ntnl.io/component': 'ctp',
              'y.ntnl.io/account-id': `${brokerId}-${userId}`,
            },
            name: `ctp-${brokerId}-${userId}`.toLocaleLowerCase(),
            namespace: 'yuan',
          },
          spec: {
            replicas: 1,
            selector: {
              matchLabels: {
                'y.ntnl.io/component': 'ctp',
                'y.ntnl.io/account-id': `${brokerId}-${userId}`,
              },
            },
            template: {
              metadata: {
                labels: {
                  'y.ntnl.io/version': ctx.version ?? envCtx.version,
                  'y.ntnl.io/component': 'ctp',
                  'y.ntnl.io/account-id': `${brokerId}-${userId}`,
                },
              },
              spec: {
                containers: [
                  {
                    env: makeK8sEnvs(ctx.env),
                    image: `ghcr.io/no-trade-no-life/vendor-ctp:${ctx.version ?? envCtx.version}`,
                    imagePullPolicy: 'IfNotPresent',
                    // NOTE: 当前健康检查不可用
                    // livenessProbe: {
                    //   exec: {
                    //     command: ['node', '/app/vendors/ctp/lib/scripts/liveness.js']
                    //   },
                    //   failureThreshold: 1,
                    //   periodSeconds: 20,
                    //   timeoutSeconds: 15
                    // },
                    // startupProbe: {
                    //   exec: {
                    //     command: ['node', '/app/vendors/ctp/lib/scripts/liveness.js']
                    //   },
                    //   // 一分钟时间启动
                    //   failureThreshold: 6,
                    //   periodSeconds: 15,
                    //   timeoutSeconds: 15
                    // },
                    name: 'ctp',
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
                hostname: 'ctp',
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
              'y.ntnl.io/component': 'ctp',
              'y.ntnl.io/account-id': `${brokerId}-${userId}`,
              'y.ntnl.io/version': ctx.version ?? envCtx.version,
            },
            name: `ctp-${brokerId}-${userId}`.toLocaleLowerCase(),
            namespace: 'yuan',
          },
          spec: {
            groups: [
              {
                name: 'ctp.rules',
                rules: [
                  {
                    alert: 'CTPTargetDown',
                    annotations: {
                      description: `账户 ${brokerId}/${userId} Terminal ID: {{$labels.terminal_id}} 状态异常`,
                      runbook_url: 'https://tradelife.feishu.cn/wiki/Z8oawzL4miipiUkdvGAcXArdn8j',
                      summary: '账户状态异常',
                    },
                    expr: `absent(terminal_transmitted_message_total{source_terminal_id="CTP/${brokerId}/${userId}"}) == 1`,
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
