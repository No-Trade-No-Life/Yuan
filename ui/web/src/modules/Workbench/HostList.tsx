import {
  IconCode,
  IconCopyAdd,
  IconDelete,
  IconEdit,
  IconExport,
  IconPlus,
  IconSend,
  IconShareStroked,
} from '@douyinfe/semi-icons';
import {
  Button,
  ButtonGroup,
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
import { executeCommand } from '../CommandCenter';
import { fs } from '../FileSystem/api';
import Form from '../Form';
import { shareHosts$ } from '../Host/model';
import { registerPage } from '../Pages';
import { secretURL } from '../Terminals/NetworkStatusWidget';
import { IHostConfigItem, currentHostConfig$, hostConfigList$ } from './model';
import { authState$ } from '../SupaBase';

const configSchema = (): JSONSchema7 => ({
  type: 'object',
  required: ['terminal_id', 'host_url'],
  properties: {
    name: {
      type: 'string',
      title: t('HostList:host_label'),
      description: t('HostList:host_label_note'),
      default: t('HostList:host_label_default'),
    },
    terminal_id: {
      type: 'string',
      title: t('HostList:terminal_id'),
      description: t('HostList:terminal_id_note'),
    },
    host_url: { type: 'string', title: t('HostList:host_url'), description: t('HostList:host_url_note') },
  },
});

registerPage('HostList', () => {
  const configs = useObservableState(hostConfigList$, []) || [];
  const { t } = useTranslation('HostList');
  const auth = useObservableState(authState$);
  const HOST_CONFIG = '/hosts.json';

  const sharedHosts = useObservableState(shareHosts$, []);

  return (
    <Space vertical align="start">
      <Space>
        <Button
          icon={<IconPlus />}
          onClick={async () => {
            const item = await userForm(t('add_host'), configSchema(), {});
            hostConfigList$.next([...(hostConfigList$.value ?? []), item]);
          }}
        >
          {t('add_host')}
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
      {auth && (
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
                    icon={<IconCopyAdd />}
                    onClick={() => {
                      const nextConfig = {
                        name: `SharedHost-${configs.length}`,
                        host_url: `wss://api.ntnl.io/hosts?host_id=${host.id}&host_token=${host.host_token}`,
                        terminal_id: `Owner`,
                      };
                      hostConfigList$.next([...configs, nextConfig]);
                      Toast.success(`${t('common:succeed')}: ${nextConfig.name}`);
                    }}
                  >
                    {t('add_to_list')}
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
      )}
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
                  { key: t('terminal_id'), value: config.terminal_id },
                ]}
              ></Descriptions>
              <ButtonGroup>
                <Button
                  icon={<IconSend />}
                  onClick={() => {
                    currentHostConfig$.next(config);
                    // ISSUE: ensure currentHostConfig saved before refresh
                    setTimeout(() => {
                      window.location.reload();
                    }, 500);
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
