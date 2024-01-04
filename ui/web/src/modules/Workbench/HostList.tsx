import {
  IconCode,
  IconDelete,
  IconEdit,
  IconExport,
  IconLink,
  IconPlus,
  IconShareStroked,
  IconUnlink,
} from '@douyinfe/semi-icons';
import {
  Button,
  ButtonGroup,
  Card,
  Descriptions,
  List,
  Modal,
  Popconfirm,
  Space,
  Table,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { ModalReactProps } from '@douyinfe/semi-ui/lib/es/modal';
import copy from 'copy-to-clipboard';
import { t } from 'i18next';
import { JSONSchema7 } from 'json-schema';
import { useObservableState } from 'observable-hooks';
import { useTranslation } from 'react-i18next';
import { bufferTime, combineLatest, map, of, shareReplay, switchMap } from 'rxjs';
import { executeCommand } from '../CommandCenter';
import { fs } from '../FileSystem/api';
import Form from '../Form';
import { shareHosts$ } from '../Host/model';
import { registerPage } from '../Pages';
import { authState$ } from '../SupaBase';
import { terminal$ } from '../Terminals';
import { IHostConfigItem, currentHostConfig$, hostConfigList$ } from './model';

const configSchema = (): JSONSchema7 => ({
  type: 'object',
  required: ['host_url'],
  properties: {
    name: {
      type: 'string',
      title: t('HostList:host_label'),
      description: t('HostList:host_label_note'),
      default: t('HostList:host_label_default'),
    },
    host_url: { type: 'string', title: t('HostList:host_url'), description: t('HostList:host_url_note') },
  },
});

export const secretURL = (url: string) => {
  try {
    const theUrl = new URL(url);
    theUrl.searchParams.set('host_token', '******');
    return theUrl.toString();
  } catch (e) {
    return url;
  }
};

export const network$ = terminal$.pipe(
  switchMap((terminal) =>
    terminal
      ? combineLatest([
          terminal._conn.output$.pipe(
            bufferTime(2000),
            map((buffer) => ((JSON.stringify(buffer).length / 2e3) * 8).toFixed(1)),
          ),
          terminal._conn.input$.pipe(
            bufferTime(2000),
            map((buffer) => ((JSON.stringify(buffer).length / 2e3) * 8).toFixed(1)),
          ),
        ])
      : of(['0.0', '0.0']),
  ),
  shareReplay(1),
);

registerPage('HostList', () => {
  const configs = useObservableState(hostConfigList$, []) || [];
  const { t } = useTranslation('HostList');
  const auth = useObservableState(authState$);
  const HOST_CONFIG = '/hosts.json';
  const config = useObservableState(currentHostConfig$);
  const terminal = useObservableState(terminal$);

  const network = useObservableState(network$, ['0.0', '0.0'] as [string, string]);

  const sharedHosts = useObservableState(shareHosts$, []);

  return (
    <Space vertical align="start">
      <Space>
        <Button
          icon={<IconUnlink />}
          disabled={!currentHostConfig$.value}
          onClick={() => {
            currentHostConfig$.next(null);
          }}
        >
          {t('disconnect')}
        </Button>
        <Button
          icon={<IconPlus />}
          onClick={async () => {
            const item = await userForm(t('add_host'), configSchema(), {});
            hostConfigList$.next([...(hostConfigList$.value ?? []), item]);
          }}
        >
          {t('add_dedicated_host')}
        </Button>
        <Button
          icon={<IconPlus />}
          disabled={!auth}
          onClick={async () => {
            executeCommand('SharedHost.New');
          }}
        >
          {t('new_shared_host')}
        </Button>
        <Button
          icon={<IconExport />}
          onClick={async () => {
            const configs = JSON.parse(await fs.readFile(HOST_CONFIG));
            hostConfigList$.next(configs);
            Toast.success(`${t('common:import_succeed')}: ${HOST_CONFIG}`);
          }}
        >
          {t('common:import')}
        </Button>
        <Button
          icon={<IconExport />}
          onClick={async () => {
            await fs.writeFile(HOST_CONFIG, JSON.stringify(configs, null, 2));
            Toast.success(`${t('common:export_succeed')}: ${HOST_CONFIG}`);
          }}
        >
          {t('common:export')}
        </Button>
        <Button
          icon={<IconCode />}
          onClick={() => {
            executeCommand('FileEditor', { filename: HOST_CONFIG });
          }}
        >
          {t('common:view_source')}
        </Button>
      </Space>

      {config && (
        <Card style={{ minWidth: 200 }}>
          <Descriptions
            data={[
              //
              {
                key: t('host_label'),
                value: <Typography.Text>{config.name}</Typography.Text>,
              },
              {
                key: t('host_url'),
                value: (
                  <Typography.Text copyable={{ content: config.host_url }}>
                    {secretURL(config.host_url)}
                  </Typography.Text>
                ),
              },
              {
                key: t('terminal_id'),
                value: <Typography.Text copyable>{terminal?.terminalInfo.terminal_id}</Typography.Text>,
              },
              {
                key: t('upload_rate'),
                value: `${network[0]} kbps`,
              },
              {
                key: t('download_rate'),
                value: `${network[1]} kbps`,
              },
              {
                key: t('status'),
                value: <Typography.Text>{+network[1] > 0 ? t('online') : t('offline')}</Typography.Text>,
              },
            ]}
          ></Descriptions>
        </Card>
      )}

      {auth && (
        <>
          <Typography.Title heading={5}>{t('shared_hosts')}</Typography.Title>
          <Table
            dataSource={sharedHosts}
            columns={[
              //
              {
                title: t('host_url'),
                render: (_, host) => (
                  <Typography.Text
                    copyable={{
                      content: `wss://api.ntnl.io/hosts?host_id=${host.id}&host_token=${host.host_token}`,
                    }}
                  >
                    {secretURL(`wss://api.ntnl.io/hosts?host_id=${host.id}&host_token=${host.host_token}`)}
                  </Typography.Text>
                ),
              },
              {
                title: t('common:actions'),
                render: (_, host) => (
                  <Space>
                    <Button
                      icon={<IconLink />}
                      onClick={() => {
                        currentHostConfig$.next({
                          name: `SharedHost-${configs.length}`,
                          host_url: `wss://api.ntnl.io/hosts?host_id=${host.id}&host_token=${host.host_token}`,
                        });
                      }}
                    >
                      {t('connect')}
                    </Button>
                    <Button
                      type="danger"
                      icon={<IconDelete />}
                      onClick={() => {
                        executeCommand('SharedHost.Delete', { host_id: host.id });
                      }}
                    >
                      {t('common:delete')}
                    </Button>
                  </Space>
                ),
              },
            ]}
          ></Table>
        </>
      )}
      <Typography.Title heading={5}>{t('dedicated_hosts')}</Typography.Title>
      <List
        dataSource={configs}
        renderItem={(config, idx) => (
          <List.Item>
            <Space vertical align="start">
              <Descriptions
                data={[
                  //
                  { key: t('host_label'), value: config.name },
                  {
                    key: t('host_url'),
                    value: (
                      <Typography.Text copyable={{ content: config.host_url }}>
                        {secretURL(config.host_url)}
                      </Typography.Text>
                    ),
                  },
                ]}
              ></Descriptions>
              <ButtonGroup>
                <Button
                  icon={<IconLink />}
                  onClick={() => {
                    currentHostConfig$.next(config);
                  }}
                >
                  {t('connect')}
                </Button>
                <Button
                  icon={<IconEdit />}
                  onClick={async () => {
                    const input = await userForm(t('edit_host'), configSchema(), config);
                    const original = hostConfigList$.value ?? [];
                    hostConfigList$.next([...original.slice(0, idx), input, ...original.slice(idx + 1)]);
                  }}
                ></Button>
                <Button
                  icon={<IconShareStroked />}
                  onClick={() => {
                    const url = new URL(window.location.href);
                    url.searchParams.set(
                      'q',
                      window.btoa(
                        JSON.stringify({
                          type: 'ConfigHost',
                          payload: { name: config.name, URL: config.host_url },
                        }),
                      ),
                    );
                    const theUrl = url.toString();
                    copy(theUrl);
                    Toast.success(t('link_copied'));
                  }}
                ></Button>
                <Popconfirm
                  style={{ width: 300 }}
                  title={t('common:confirm_delete')}
                  content={t('common:confirm_delete_note')}
                  onConfirm={() => {
                    hostConfigList$.next(hostConfigList$.value!.filter((item) => item !== config));
                  }}
                  okText={t('common:confirm_delete_ok')}
                  okType="danger"
                  cancelText={t('common:confirm_delete_cancel')}
                >
                  <Button icon={<IconDelete />} type="danger"></Button>
                </Popconfirm>
              </ButtonGroup>
            </Space>
          </List.Item>
        )}
      ></List>
    </Space>
  );
});

function userForm<T>(title: string, schema: JSONSchema7, initialData?: any) {
  return new Promise<IHostConfigItem>((resolve, reject) => {
    let data = initialData;
    let modal: ReturnType<typeof Modal.info> | undefined;
    function getProps(): ModalReactProps {
      return {
        title,
        content: (
          <Form
            schema={schema}
            formData={data}
            onChange={(e) => {
              data = e.formData;
              modal?.update(getProps());
            }}
          >
            <div></div>
          </Form>
        ),
        onCancel: () => {
          reject(new Error('User Cancelled'));
        },
        onOk: () => {
          resolve(data);
        },
        okText: t('common:submit'),
        cancelText: t('common:cancel'),
      };
    }
    modal = Modal.info(getProps());
  });
}
