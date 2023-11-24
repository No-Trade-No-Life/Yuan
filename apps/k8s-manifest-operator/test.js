const a = (function () {
  'use strict';

  /**
   * @public
   */
  /**
   * Generates environment variables in the format of a Docker Compose file.
   * @public
   * @param env - The environment variables.
   * @returns The environment variables in the format of a Docker Compose file.
   */
  function makeDockerEnvs(env) {
    return Object.entries(env !== null && env !== void 0 ? env : {}).map(([k, v]) => `${k}=${v}`);
  }
  /**
   * Generates environment variables in the format of a Kubernetes pod.
   * @public
   * @param env - The environment variables.
   * @returns The environment variables in the format of a Kubernetes pod.
   */
  function makeK8sEnvs(env) {
    return Object.entries(env !== null && env !== void 0 ? env : {}).map(([k, v]) => ({
      name: k,
      value: `${v}`,
    }));
  }

  var extension = (context) => {
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
          // one_json: agentConfSchema,
        },
      }),
      make_docker_compose_file: async (ctx, envCtx) => {
        var _a, _b;
        const agentConfText = await envCtx.readFile(ctx.env.AGENT_CONF_PATH);
        const agentConf = JSON.parse(agentConfText);
        if (
          !((_a = ctx === null || ctx === void 0 ? void 0 : ctx.env) === null || _a === void 0
            ? void 0
            : _a.AGENT_CONF_PATH)
        ) {
          throw new Error('AGENT_CONF_PATH is required for docker compose deployment');
        }
        const kernel_id = agentConf.kernel_id;
        if (kernel_id === undefined) {
          throw new Error('kernel_id is required');
        }
        if (!agentConf.bundled_code) {
          throw new Error(`bundled_code is required`);
        }
        const paths = [ctx.env.AGENT_CONF_PATH];
        return {
          [`agent-${kernel_id.toLocaleLowerCase()}`]: {
            image: `ghcr.io/no-trade-no-life/app-agent:${
              (_b = ctx.version) !== null && _b !== void 0 ? _b : envCtx.version
            }`,
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
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
        // if there's no AGENT_CONF_PATH, we will use the default agent_conf.json
        if (
          ((_a = ctx === null || ctx === void 0 ? void 0 : ctx.env) === null || _a === void 0
            ? void 0
            : _a.AGENT_CONF_PATH) === undefined &&
          ctx.one_json === undefined
        ) {
          throw new Error('AGENT_CONF_PATH or volume_data.agent_conf is required for k8s deployment');
        }
        let agentConf;
        if (
          ((_b = ctx === null || ctx === void 0 ? void 0 : ctx.env) === null || _b === void 0
            ? void 0
            : _b.AGENT_CONF_PATH) !== undefined
        ) {
          const agentConfText = await envCtx.readFile(ctx.env.AGENT_CONF_PATH);
          agentConf = JSON.parse(agentConfText);
        } else {
          agentConf = JSON.parse(ctx.one_json);
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
                  [ctx.env.AGENT_CONF_PATH].map(async (path) => [
                    await envCtx.createHashOfSHA256(path),
                    { path, content: await envCtx.readFileAsBase64(path) },
                  ]),
                ),
              )
            : {
                [await envCtx.createHashOfSHA256('/agent_conf.json')]: {
                  path: '/agent_conf.json',
                  content: await envCtx.toBase64String(JSON.stringify(agentConf)),
                },
              };
        const escapedKernelID = kernel_id.replace(/\/|_/g, '').toLocaleLowerCase();
        return {
          deployment: {
            apiVersion: 'apps/v1',
            kind: 'Deployment',
            metadata: {
              labels: {
                'y.ntnl.io/version': (_c = ctx.version) !== null && _c !== void 0 ? _c : envCtx.version,
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
                    'y.ntnl.io/version': (_d = ctx.version) !== null && _d !== void 0 ? _d : envCtx.version,
                    'y.ntnl.io/component': 'agent',
                    'y.ntnl.io/kernel_id': escapedKernelID,
                  },
                },
                spec: {
                  containers: [
                    {
                      env: makeK8sEnvs(ctx.env),
                      image: `ghcr.io/no-trade-no-life/app-agent:${
                        (_e = ctx.version) !== null && _e !== void 0 ? _e : envCtx.version
                      }`,
                      imagePullPolicy: 'IfNotPresent',
                      name: 'agent',
                      resources: {
                        limits: {
                          cpu:
                            (_g = (_f = ctx.cpu) === null || _f === void 0 ? void 0 : _f.max) !== null &&
                            _g !== void 0
                              ? _g
                              : '200m',
                          memory:
                            (_j = (_h = ctx.memory) === null || _h === void 0 ? void 0 : _h.max) !== null &&
                            _j !== void 0
                              ? _j
                              : '256Mi',
                        },
                        requests: {
                          cpu:
                            (_l = (_k = ctx.cpu) === null || _k === void 0 ? void 0 : _k.min) !== null &&
                            _l !== void 0
                              ? _l
                              : '200m',
                          memory:
                            (_o = (_m = ctx.memory) === null || _m === void 0 ? void 0 : _m.min) !== null &&
                            _o !== void 0
                              ? _o
                              : '256Mi',
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
                'y.ntnl.io/version': (_p = ctx.version) !== null && _p !== void 0 ? _p : envCtx.version,
                'y.ntnl.io/component': 'agent',
                'y.ntnl.io/kernel_id': escapedKernelID,
              },
            },
            data: Object.fromEntries(
              Object.entries(filesystemMapping).map(([k, { content }]) => [k, content]),
            ),
          },
          prometheusRule: {
            apiVersion: 'monitoring.coreos.com/v1',
            kind: 'PrometheusRule',
            metadata: {
              labels: {
                'y.ntnl.io/component': 'agent',
                'y.ntnl.io/version': (_q = ctx.version) !== null && _q !== void 0 ? _q : envCtx.version,
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

  return extension;
})();

let provider;

a({
  registerDeployProvider: (p) => {
    provider = p;
  },
});

const crypto = require('crypto');

const envCtx = {
  version: '0.4.0',
  toBase64String: (s) => Buffer.from(s).toString('base64'),
  createHashOfSHA256: (s) => crypto.createHash('sha256').update(s).digest('hex'),
};

const manifest = {
  cpu: {
    max: '200m',
    min: '20m',
  },
  env: {
    HV_URL: 'wss://host-dev.ntnl.io/host?host_token=6y8Jbc89Yv43',
  },
  key: 'model-fe125ad065',
  memory: {
    max: '256Mi',
    min: '128Mi',
  },
  one_json:
    '{"entry":"/@models/double-ma.ts","is_real":true,"kernel_id":"Model","bundled_code":"(function () {\\n    \'use strict\';\\n\\n    /**\\r\\n     * 使用移动平均线指标\\r\\n     * @param source\\r\\n     * @param period\\r\\n     * @returns\\r\\n     */\\r\\n    const useSMA = (source, period) =\u003e {\\r\\n        const SUM = useSUM(source, period);\\r\\n        const SMA = useSeriesMap(`SMA(${source.name},${period})`, source, {\\r\\n            display: \\"line\\",\\r\\n        }, (i) =\u003e SUM[i] / Math.min(i + 1, period));\\r\\n        return SMA;\\r\\n    };\\n\\n    /**\\r\\n     * 使用移动求和计算指标\\r\\n     * @param source\\r\\n     * @param period\\r\\n     * @returns\\r\\n     */\\r\\n    const useSUM = (source, period) =\u003e useSeriesMap(`SUM(${source.name}, ${period})`, source, {}, (i, SUM) =\u003e \\r\\n    // ISSUE: SUM may keep outputting NaN if source has NaN values\\r\\n    // =\u003e use fallback to prevent source[i], source[i - period] is NaN\\r\\n    (source[i] || 0) +\\r\\n        (i \u003e 0 ? SUM[i - 1] : 0) -\\r\\n        (i - period \u003e= 0 ? source[i - period] || 0 : 0));\\n\\n    /**\\r\\n     * 使用带有填充函数的序列，基本等同于 `useSeries`，但是可以使用填充函数来填充序列\\r\\n     * @param fn - 填充函数\\r\\n     */\\r\\n    const useSeriesMap = (name, parent, tags, fn) =\u003e {\\r\\n        const series = useSeries(name, parent, tags);\\r\\n        useEffect(() =\u003e {\\r\\n            const i = parent.length - 1;\\r\\n            if (i \u003c 0)\\r\\n                return;\\r\\n            series[i] = fn(i, series);\\r\\n        });\\r\\n        return series;\\r\\n    };\\n\\n    /**\\r\\n     * Use a single target net volume to control the position (LONG \u0026 SHORT).\\r\\n     *\\r\\n     * The position will be opened/closed by market orders.\\r\\n     *\\r\\n     * Positive for LONG, negative for SHORT, zero for close both LONG and SHORT positions.\\r\\n     */\\r\\n    const useSimplePositionManager = (account_id, product_id) =\u003e {\\r\\n        // useState: when setTargetVolume, re-execute the agent code.\\r\\n        const [targetVolume, setTargetVolume] = useState(0);\\r\\n        // Get reference to the account info.\\r\\n        const accountInfo = useAccountInfo({ account_id });\\r\\n        // Use the exchange to submit \u0026 cancel orders.\\r\\n        const exchange = useExchange();\\r\\n        // Generate a random UUID for each position.\\r\\n        const longPositionId = useMemo(() =\u003e UUID(), []);\\r\\n        const shortPositionId = useMemo(() =\u003e UUID(), []);\\r\\n        // Get actual volume of the positions.\\r\\n        const longPositionVolume = accountInfo.positions.find((position) =\u003e position.position_id === longPositionId)?.volume ?? 0;\\r\\n        const shortPositionVolume = accountInfo.positions.find((position) =\u003e position.position_id === shortPositionId)?.volume ?? 0;\\r\\n        // Calc the volume to open/close.\\r\\n        const openLongVolume = Math.max(targetVolume - longPositionVolume, 0);\\r\\n        const openShortVolume = Math.max(-targetVolume - shortPositionVolume, 0);\\r\\n        const closeLongVolume = Math.min(longPositionVolume - targetVolume, longPositionVolume);\\r\\n        const closeShortVolume = Math.min(shortPositionVolume - -targetVolume, shortPositionVolume);\\r\\n        // OPEN LONG: submit \u0026 cancel order.\\r\\n        useEffect(() =\u003e {\\r\\n            if (openLongVolume \u003c= 0)\\r\\n                return;\\r\\n            const order = {\\r\\n                client_order_id: UUID(),\\r\\n                account_id,\\r\\n                product_id,\\r\\n                position_id: longPositionId,\\r\\n                type: OrderType.MARKET,\\r\\n                direction: OrderDirection.OPEN_LONG,\\r\\n                volume: openLongVolume,\\r\\n            };\\r\\n            exchange.submitOrder(order);\\r\\n            return () =\u003e {\\r\\n                exchange.cancelOrder(order.client_order_id);\\r\\n            };\\r\\n        }, [openLongVolume]);\\r\\n        // OPEN SHORT: submit \u0026 cancel order.\\r\\n        useEffect(() =\u003e {\\r\\n            if (openShortVolume \u003c= 0)\\r\\n                return;\\r\\n            const order = {\\r\\n                client_order_id: UUID(),\\r\\n                account_id,\\r\\n                product_id,\\r\\n                position_id: shortPositionId,\\r\\n                type: OrderType.MARKET,\\r\\n                direction: OrderDirection.OPEN_SHORT,\\r\\n                volume: openShortVolume,\\r\\n            };\\r\\n            exchange.submitOrder(order);\\r\\n            return () =\u003e {\\r\\n                exchange.cancelOrder(order.client_order_id);\\r\\n            };\\r\\n        }, [openShortVolume]);\\r\\n        // CLOSE LONG: submit \u0026 cancel order.\\r\\n        useEffect(() =\u003e {\\r\\n            if (closeLongVolume \u003c= 0)\\r\\n                return;\\r\\n            const order = {\\r\\n                client_order_id: UUID(),\\r\\n                account_id,\\r\\n                product_id,\\r\\n                position_id: longPositionId,\\r\\n                type: OrderType.MARKET,\\r\\n                direction: OrderDirection.CLOSE_LONG,\\r\\n                volume: closeLongVolume,\\r\\n            };\\r\\n            exchange.submitOrder(order);\\r\\n            return () =\u003e {\\r\\n                exchange.cancelOrder(order.client_order_id);\\r\\n            };\\r\\n        }, [closeLongVolume]);\\r\\n        // CLOSE SHORT: submit \u0026 cancel order.\\r\\n        useEffect(() =\u003e {\\r\\n            if (closeShortVolume \u003c= 0)\\r\\n                return;\\r\\n            const order = {\\r\\n                client_order_id: UUID(),\\r\\n                account_id,\\r\\n                product_id,\\r\\n                position_id: shortPositionId,\\r\\n                type: OrderType.MARKET,\\r\\n                direction: OrderDirection.CLOSE_SHORT,\\r\\n                volume: closeShortVolume,\\r\\n            };\\r\\n            exchange.submitOrder(order);\\r\\n            return () =\u003e {\\r\\n                exchange.cancelOrder(order.client_order_id);\\r\\n            };\\r\\n        }, [closeShortVolume]);\\r\\n        // returns the target volume and the setter.\\r\\n        return [targetVolume, setTargetVolume];\\r\\n    };\\n\\n    // 双均线策略 (Double Moving Average)\\r\\n    // 当短期均线由下向上穿越长期均线时做多 (金叉)\\r\\n    // 当短期均线由上向下穿越长期均线时做空 (死叉)\\r\\n    var doubleMa = () =\u003e {\\r\\n        // 使用收盘价序列\\r\\n        const { product_id, close } = useParamOHLC(\\"SomeKey\\");\\r\\n        // NOTE: 使用当前 K 线的上一根 K 线的收盘价，保证策略在 K 线结束时才会执行\\r\\n        const idx = close.length - 2;\\r\\n        // 使用 20，60 均线\\r\\n        const sma20 = useSMA(close, 20);\\r\\n        const sma60 = useSMA(close, 60);\\r\\n        const accountInfo = useAccountInfo();\\r\\n        // 设置仓位管理器\\r\\n        const [targetVolume, setTargetVolume] = useSimplePositionManager(accountInfo.account_id, product_id);\\r\\n        useEffect(() =\u003e {\\r\\n            if (idx \u003c 60)\\r\\n                return; // 略过一开始不成熟的均线数据\\r\\n            // 金叉开多平空\\r\\n            if (sma20[idx] \u003e sma60[idx]) {\\r\\n                setTargetVolume(1);\\r\\n            }\\r\\n            // 死叉开空平多\\r\\n            if (sma20[idx] \u003c sma60[idx]) {\\r\\n                setTargetVolume(-1);\\r\\n            }\\r\\n        }, [idx]);\\r\\n    };\\n\\n    return doubleMa;\\n\\n})();\\n","use_general_product":false}',
  package: '@yuants/app-agent',
  version: '0.4.0',
};

provider.make_k8s_resource_objects(manifest, envCtx).then((res) => {
  console.log(JSON.stringify(res, null, 2));
});
