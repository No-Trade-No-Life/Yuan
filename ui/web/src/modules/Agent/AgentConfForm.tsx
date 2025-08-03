import {
  IconCloud,
  IconCode,
  IconFile,
  IconPlay,
  IconRefresh,
  IconSave,
  IconUndo,
  IconWrench,
} from '@douyinfe/semi-icons';
import { Divider, Layout, Space, Toast } from '@douyinfe/semi-ui';
import { AgentScene, IAgentConf, agentConfSchema } from '@yuants/agent';
import { BasicFileSystemUnit } from '@yuants/kernel';
import Ajv from 'ajv';
import { t } from 'i18next';
import { JSONSchema7 } from 'json-schema';
import { parse } from 'jsonc-parser';
import { useObservableState } from 'observable-hooks';
import path from 'path-browserify';
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
import { createPersistBehaviorSubject } from '../BIOS';
import { executeCommand, registerCommand } from '../CommandCenter';
import { fs } from '../FileSystem/api';
import Form, { showForm } from '../Form';
import { Button } from '../Interactive';
import { currentKernel$ } from '../Kernel/model';
import { orders$ } from '../Order/model';
import { registerPage } from '../Pages';
import { recordTable$ } from '../Shell/model';
import { LocalAgentScene } from '../StaticFileServerStorage/LocalAgentScene';
import { authState$ } from '../SupaBase';
import { registerAssociationRule } from '../System';
import { terminal$ } from '../Terminals';
import { clearLogAction$ } from '../Workbench/Program';
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

export const agentConfSchema$ = createPersistBehaviorSubject(
  'agent-conf-schema',
  mapScriptParamsSchemaToAgentConfSchema({}),
);

export const agentConf$ = createPersistBehaviorSubject('agent-conf', {} as IAgentConf);
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

    if (terminal === null) {
      const agentCode = await bundleCode(agentConf.entry!);
      const scene = await LocalAgentScene({ ...agentConf, bundled_code: agentCode });
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
    } else {
      const agentCode = await bundleCode(agentConf.entry!);
      const scene = await AgentScene(terminal, { ...agentConf, bundled_code: agentCode });
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
    }

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
  const authState = useObservableState(authState$);

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
            icon={<IconCloud />}
            disabled={!authState}
            onClick={() => executeCommand('Agent.DeployToCloud', { agentConf })}
          >
            {t('cloud_deploy')}
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
