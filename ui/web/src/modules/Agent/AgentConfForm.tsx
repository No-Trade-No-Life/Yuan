import {
  IconCode,
  IconFile,
  IconPlay,
  IconRefresh,
  IconSave,
  IconUndo,
  IconUpload,
  IconWrench,
} from '@douyinfe/semi-icons';
import { Divider, Layout, Modal, Space, Toast, Typography } from '@douyinfe/semi-ui';
import { AgentScene, IAgentConf, agentConfSchema } from '@yuants/agent';
import {
  BasicFileSystemUnit,
  HistoryOrderUnit,
  PeriodDataUnit,
  Series,
  SeriesDataUnit,
} from '@yuants/kernel';
import { saveSecret } from '@yuants/secret';
import { IDeployment } from '@yuants/deploy';
import { ISecret } from '@yuants/secret';
import { buildInsertManyIntoTableSQL, requestSQL } from '@yuants/sql';
import { encodeBase58, encryptByPublicKey, formatTime } from '@yuants/utils';
import Ajv from 'ajv';
import { t } from 'i18next';
import { JSONSchema7 } from 'json-schema';
import { parse } from 'jsonc-parser';
import { useObservableState } from 'observable-hooks';
import path, { join } from 'path-browserify';
import { useTranslation } from 'react-i18next';
import {
  BehaviorSubject,
  Subject,
  catchError,
  debounceTime,
  defer,
  filter,
  first,
  firstValueFrom,
  map,
  mergeMap,
  switchMap,
  tap,
} from 'rxjs';
import { AccountFrameUnit } from '../AccountInfo/AccountFrameUnit';
import { accountFrameSeries$, accountPerformance$ } from '../AccountInfo/model';
import { executeCommand, registerCommand } from '../CommandCenter';
import { createFileSystemBehaviorSubject } from '../FileSystem';
import { fs } from '../FileSystem/api';
import Form, { showForm } from '../Form';
import { Button, ITimeSeriesChartConfig } from '../Interactive';
import { currentKernel$ } from '../Kernel/model';
import { orders$ } from '../Order/model';
import { registerPage } from '../Pages';
import { LocalAgentScene } from '../StaticFileServerStorage/LocalAgentScene';
import { registerAssociationRule } from '../System';
import { terminal$ } from '../Terminals';
import { CSV } from '../Util';
import { clearLogAction$ } from '../Workbench/Program';
import { recordTable$ } from './model';
import { bundleCode } from './utils';

const mapScriptParamsSchemaToAgentConfSchema = (schema: JSONSchema7): JSONSchema7 => ({
  allOf: [
    agentConfSchema,
    {
      type: 'object',
      properties: {
        agent_params: schema,
      },
    },
  ],
});

export const agentConfSchema$ = createFileSystemBehaviorSubject(
  'agent-conf-schema',
  mapScriptParamsSchemaToAgentConfSchema({}),
);

export const agentConf$ = createFileSystemBehaviorSubject('agent-conf', {} as IAgentConf);
agentConf$.subscribe((agentConf) => {
  Object.assign(globalThis, { agentConf });
});

const complete$ = new BehaviorSubject<boolean>(true);
export const reloadSchemaAction$ = new Subject<void>();

const extractAgentMetaInfoFromFilename = (script_path: string) =>
  defer(async () => {
    if (!script_path) return null;
    const agentCode = await bundleCode(script_path);
    const scene = await LocalAgentScene({ bundled_code: agentCode });
    return scene.agentUnit;
  }).pipe(
    //
    map((agentUnit) => ({
      script_params_schema: agentUnit?.paramsSchema ?? {},
    })),
    catchError((e) => {
      Toast.error(`${t('AgentConfForm:prototype_failed')}: ${e}`);
      console.error(e);
      throw e;
    }),
  );

reloadSchemaAction$
  .pipe(
    debounceTime(500),
    mergeMap(() =>
      agentConf$.pipe(
        first(),
        filter((v): v is Exclude<typeof v, undefined> => !!v),
        map((agentConf) => agentConf.entry!),
        switchMap((script_path) => extractAgentMetaInfoFromFilename(script_path)),
        tap((meta) => {
          agentConfSchema$.next(mapScriptParamsSchemaToAgentConfSchema(meta.script_params_schema));
        }),
        tap({
          subscribe: () => {
            Toast.info(t('AgentConfForm:prototype_start'));
          },
          complete: () => {
            Toast.success(t('AgentConfForm:prototype_succeed'));
          },
        }),
      ),
    ),
    catchError((err, caught$) => caught$),
  )
  .subscribe();

export const runAgent = async () => {
  const agentConf = agentConf$.value;
  const agentConfSchema = await firstValueFrom(agentConfSchema$);
  if (!agentConfSchema || !agentConf) {
    return;
  }

  complete$.next(false);
  try {
    const validator = new Ajv({ strictSchema: false });
    const isValid = validator.validate(agentConfSchema, agentConf);
    if (!isValid) {
      const msg = validator.errors?.map((e) => e.message).join();
      Toast.error(`${t('AgentConfForm:config_invalid')}: ${msg}`);
      console.error(validator.errors);
      throw msg;
    }
    const terminal = await firstValueFrom(terminal$);

    const agentCode = await bundleCode(agentConf.entry!);
    const scene = terminal
      ? await AgentScene(terminal, { ...agentConf, bundled_code: agentCode })
      : await LocalAgentScene({ ...agentConf, bundled_code: agentCode });
    const kernel = scene.kernel;
    const fsUnit = new BasicFileSystemUnit(kernel);
    fsUnit.readFile = async (filename: string) => {
      await fs.ensureDir(path.dirname(filename));
      const content = await fs.readFile(filename);
      return content;
    };
    fsUnit.writeFile = async (filename: string, content: string) => {
      await fs.ensureDir(path.dirname(filename));
      await fs.writeFile(filename, content);
    };
    const accountFrameUnit = new AccountFrameUnit(
      scene.kernel,
      scene.accountInfoUnit,
      scene.accountPerformanceUnit,
    );
    await scene.kernel.start();
    currentKernel$.next(scene.kernel);

    recordTable$.next(scene.agentUnit.record_table);

    orders$.next(scene.historyOrderUnit.historyOrders);
    accountPerformance$.next(
      Object.fromEntries(scene.accountPerformanceUnit.mapAccountIdToPerformance.entries()),
    );
    accountFrameSeries$.next(accountFrameUnit.data);

    const kernelDir = `/.Y/kernel/${encodeURIComponent(scene.kernel.id)}`;
    for (const accountId in accountFrameUnit.data) {
      const data = accountFrameUnit.data[accountId];
      const filename = join(kernelDir, `${encodeURIComponent(accountId)}.account.csv`);
      await CSV.writeFile(filename, data);
    }

    const seriesFilename = join(kernelDir, 'series.csv');

    const series = scene.kernel.findUnit(SeriesDataUnit)!.series;
    await fs.ensureDir(path.dirname(seriesFilename));
    const rawTable = series.map((s) => [s.name || s.series_id, ...s]);
    await CSV.writeFileFromRawTable(seriesFilename, rawTable, true);

    Toast.success(`序列保存到 ${seriesFilename}`);

    const ordersFilename = join(kernelDir, 'orders.csv');
    await CSV.writeFile(ordersFilename, scene.kernel.findUnit(HistoryOrderUnit)?.historyOrders!);

    Toast.success(`订单保存到 ${ordersFilename}`);

    const configFilename = join(kernelDir, 'config.json');

    const seriesIds = Object.keys(kernel.findUnit(PeriodDataUnit)!.data);

    const firstOhlcSeriesId = seriesIds[0];

    const config: ITimeSeriesChartConfig = {
      data: [
        {
          type: 'csv',
          filename: seriesFilename,
          time_column_name: series[0]?.resolveRoot().name ?? '',
        },
        {
          type: 'csv',
          filename: ordersFilename,
          time_column_name: 'submit_at',
        },
      ],
      views: [
        {
          name: '走势图',
          time_ref: {
            data_index: 0,
            column_name: series[0]?.resolveRoot().name ?? '',
          },
          panes: [
            {
              series: [
                {
                  type: 'ohlc',
                  refs: [
                    {
                      data_index: 0,
                      column_name: `O(${firstOhlcSeriesId})`,
                    },
                    {
                      data_index: 0,
                      column_name: `H(${firstOhlcSeriesId})`,
                    },
                    {
                      data_index: 0,
                      column_name: `L(${firstOhlcSeriesId})`,
                    },
                    {
                      data_index: 0,
                      column_name: `C(${firstOhlcSeriesId})`,
                    },
                  ],
                },
                {
                  type: 'order',
                  refs: [
                    {
                      data_index: 1,
                      column_name: `order_direction`,
                    },
                    {
                      data_index: 1,
                      column_name: `traded_price`,
                    },
                    {
                      data_index: 1,
                      column_name: `volume`,
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    const resolveChartId = (series: Series): string => {
      const chartConfig = series.tags['chart'];
      if (series.parent === undefined) {
        // Main Chart ID is the TimeSeries's ID
        return series.series_id;
      }
      if (chartConfig === undefined) {
        return resolveChartId(series.parent);
      }
      if (chartConfig === 'new') {
        return series.series_id;
      }
      if (typeof chartConfig === 'string') {
        return chartConfig;
      }
      throw new Error(`chart config illegal: ${series.series_id} (${series.name})`);
    };

    const chartIds: string[] = [series[0]?.resolveRoot().series_id];

    series.forEach((series) => {
      const displayType = series.tags['display'] || '';
      if (!displayType || displayType === 'none') return;
      const chartId = resolveChartId(series);
      if (!chartIds.includes(chartId)) {
        chartIds.push(chartId);
        config.views[0].panes.push({
          series: [],
        });
      }
      const paneIndex = chartIds.indexOf(chartId);
      config.views[0].panes[paneIndex].series.push({
        type: displayType,
        refs: [
          {
            data_index: 0,
            column_name: series.name || '',
          },
        ],
      });
    });

    await fs.writeFile(configFilename, JSON.stringify(config));

    executeCommand('Page.open', { type: 'AccountPerformancePanel' });

    Toast.success(t('AgentConfForm:run_succeed'));
    gtag('event', 'agent_run_complete');
  } catch (e) {
    Toast.error(`${t('AgentConfForm:run_failed')}: ${e}`);
    console.error(e);
    gtag('event', 'agent_run_error', { message: `${e}` });
  }
  complete$.next(true);
};

registerAssociationRule({
  id: 'AgentConfForm',
  match: ({ path, isFile }) => isFile && !!path.match(/\.ts$/),
  action: ({ path }) => {
    agentConf$.next({ ...agentConf$.value, entry: path });
    reloadSchemaAction$.next();
    executeCommand('AgentConfForm', {});
  },
});

registerPage('AgentConfForm', () => {
  const agentConf = useObservableState(agentConf$);
  const schema = useObservableState(agentConfSchema$) || {};
  const complete = useObservableState(complete$);
  const { t } = useTranslation('AgentConfForm');

  return (
    <Layout style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
      <Layout.Header>
        <Space style={{ width: '100%', flexWrap: 'wrap' }}>
          <Button icon={<IconPlay />} disabled={!complete} onClick={() => executeCommand('Agent.Run')}>
            {t('run')}
          </Button>
          <Button icon={<IconRefresh />} onClick={() => executeCommand('Agent.Reload')}>
            {t('refresh_schema')}
          </Button>
          <Button icon={<IconUndo />} onClick={() => executeCommand('Agent.Reset')}>
            {t('common:reset')}
          </Button>
          <Button icon={<IconFile />} onClick={() => executeCommand('Agent.LoadConfig')}>
            {t('load_config')}
          </Button>
          <Button icon={<IconSave />} onClick={() => executeCommand('Agent.SaveConfig')}>
            {t('save_config')}
          </Button>
          <Button icon={<IconWrench />} onClick={() => executeCommand('Agent.Bundle')}>
            {t('bundle')}
          </Button>
          <Button
            icon={<IconCode />}
            onClick={() => executeCommand('FileEditor', { filename: agentConf?.entry })}
          >
            {t('common:view_source')}
          </Button>
          <Button
            icon={<IconUpload />}
            onClick={async () => {
              const entry = agentConf?.entry;
              if (!entry) throw 'Entry is empty';
              const bundled_code = await bundleCode(entry);

              const terminal = await firstValueFrom(terminal$);

              if (!terminal) throw 'Terminal is not connected';

              const nodeUnits = terminal.terminalInfos.filter((t) => t.terminal_id.startsWith('NodeUnit/'));
              const addresses = nodeUnits.map((t) => t.terminal_id.replace('NodeUnit/', ''));
              const address = await showForm<string>({
                type: 'string',
                title: '请选择部署地址',
                description: `您的代码将会被加密并且部署到选中节点，选中节点的私钥可以解密代码，请确保您信任选中节点的所有者`,
                enum: addresses,
              });

              const encrypted_code = encodeBase58(
                encryptByPublicKey(new TextEncoder().encode(bundled_code), address),
              );

              const secrets = await requestSQL<ISecret[]>(
                terminal,
                buildInsertManyIntoTableSQL(
                  [
                    {
                      public_data: {},
                      encrypted_data_base58: encrypted_code,
                      encryption_key_sha256_base58: address,
                    },
                  ],
                  'secret',
                  {
                    returningAll: true,
                  },
                ),
              );

              const theSecret = secrets[0];

              const env = {
                SECRET_CODE_ID: theSecret.id!,
                AGENT_PARAMS: JSON.stringify(agentConf?.agent_params || {}),
                STARTED_AT: agentConf.start_time ? formatTime(agentConf.start_time) : '',
                KERNEL_ID: agentConf.kernel_id || '',
              };

              const deployments = await requestSQL<IDeployment[]>(
                terminal,
                buildInsertManyIntoTableSQL(
                  [
                    {
                      package_name: '@yuants/app-agent',
                      package_version: 'latest',
                      address,
                      env,
                      enabled: false,
                    },
                  ],
                  'deployment',
                  {
                    returningAll: true,
                  },
                ),
              );

              const theDeployment = deployments[0];

              Modal.info({
                title: '部署已就绪',
                content: (
                  <div>
                    <p>
                      部署 ID: <Typography.Text copyable>{theDeployment.id}</Typography.Text>
                    </p>
                    <p>部署地址: {theDeployment.address}</p>
                    <p>请前往部署页面手动启动部署</p>
                    <p>请妥善保存部署地址的私钥，泄漏给他人可能导致源码泄漏</p>
                  </div>
                ),
                hasCancel: false,
                onOk: () => {
                  executeCommand('DeploySettings', {});
                },
                okText: '查看部署',
              });
            }}
          >
            部署
          </Button>
        </Space>
        <Divider />
      </Layout.Header>
      <Layout.Content style={{ overflow: 'auto' }}>
        <Form
          schema={schema}
          formData={agentConf}
          formContext={{ 'i18n:ns': 'AgentConfForm' }}
          onChange={(e) => {
            agentConf$.next(e.formData);
          }}
        >
          <div></div>
        </Form>
      </Layout.Content>
    </Layout>
  );
});

registerCommand('Agent.Run', async () => {
  clearLogAction$.next();
  await runAgent();
});

registerCommand('Agent.Reload', () => {
  reloadSchemaAction$.next();
});

registerCommand('Agent.Bundle', async () => {
  const agentConf = agentConf$.value;
  if (!agentConf) {
    Toast.error(t('AgentConfForm:require_config'));
    return;
  }
  if (!agentConf.entry) {
    Toast.error(t('AgentConfForm:require_entry_field'));
    return;
  }
  const source = agentConf.entry;
  const target = `${source}.bundle.js`;
  try {
    const agentCode = await bundleCode(source);
    await fs.writeFile(target, agentCode);
    Toast.success(
      t('AgentConfForm:bundle_succeed', { source, target, interpolation: { escapeValue: false } }),
    );
  } catch (e) {
    Toast.error(
      `${t('AgentConfForm:bundle_failed', { source, target, interpolation: { escapeValue: false } })}: ${e}`,
    );
  }
});

registerCommand('Agent.SaveConfig', async () => {
  const agentConf = agentConf$.value;

  if (!agentConf) return;
  if (!agentConf.entry) return;
  const filename = await showForm<string>({
    type: 'string',
    title: t('AgentConfForm:save_config_filename_prompt'),
  });
  if (!filename) return;
  try {
    const bundled_code = await bundleCode(agentConf.entry);
    await fs.writeFile(filename, JSON.stringify({ ...agentConf, bundled_code }, null, 2));
    Toast.success(
      t('AgentConfForm:save_config_succeed', { filename, interpolation: { escapeValue: false } }),
    );
  } catch (e) {
    Toast.error(
      `${t('AgentConfForm:save_config_failed', { filename, interpolation: { escapeValue: false } })}: ${e}`,
    );
  }
});

registerCommand('Agent.LoadConfig', async () => {
  const filename = await showForm<string>({
    type: 'string',
    title: t('AgentConfForm:load_config_filename_prompt'),
  });
  if (!filename) return;
  try {
    const content = await fs.readFile(filename);
    const json = parse(content);
    agentConf$.next(json);
    Toast.success(
      t('AgentConfForm:load_config_succeed', { filename, interpolation: { escapeValue: false } }),
    );
  } catch (e) {
    Toast.error(
      `${t('AgentConfForm:load_config_failed', { filename, interpolation: { escapeValue: false } })}: ${e}`,
    );
  }
});

registerCommand('Agent.Reset', async () => {
  agentConf$.next({});
});
