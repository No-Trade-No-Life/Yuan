import { IconDelete, IconEdit, IconPlus, IconSend, IconShareStroked } from '@douyinfe/semi-icons';
import {
  Button,
  ButtonGroup,
  Descriptions,
  List,
  Modal,
  Popconfirm,
  Space,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { ModalReactProps } from '@douyinfe/semi-ui/lib/es/modal';
import copy from 'copy-to-clipboard';
import { t } from 'i18next';
import { JSONSchema7 } from 'json-schema';
import { useObservableState } from 'observable-hooks';
import { useTranslation } from 'react-i18next';
import Form from '../Form';
import { registerPage } from '../Pages';
import { secretURL } from '../Terminals/NetworkStatusWidget';
import { IHostConfigItem, currentHostConfig$, hostConfigList$ } from './model';

const configSchema = (): JSONSchema7 => ({
  type: 'object',
  required: ['TERMINAL_ID', 'HV_URL'],
  properties: {
    name: {
      type: 'string',
      title: t('HostList:host_label'),
      description: t('HostList:host_label_note'),
      default: t('HostList:host_label_default'),
    },
    TERMINAL_ID: {
      type: 'string',
      title: t('HostList:terminal_id'),
      description: t('HostList:terminal_id_note'),
    },
    HV_URL: { type: 'string', title: t('HostList:host_url'), description: t('HostList:host_url_note') },
  },
});

registerPage('HostList', () => {
  const configs = useObservableState(hostConfigList$, []);
  const { t } = useTranslation('HostList');

  return (
    <Space vertical align="start">
      <ButtonGroup>
        <Button
          icon={<IconPlus />}
          onClick={async () => {
            const item = await userForm(t('add_host'), configSchema(), {});
            hostConfigList$.next([...(hostConfigList$.value ?? []), item]);
          }}
        >
          {t('add_host')}
        </Button>
      </ButtonGroup>
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
                      <Typography.Text copyable={{ content: config.HV_URL }}>
                        {secretURL(config.HV_URL)}
                      </Typography.Text>
                    ),
                  },
                  { key: t('terminal_id'), value: config.TERMINAL_ID },
                ]}
              ></Descriptions>
              <ButtonGroup>
                <Button
                  icon={<IconSend />}
                  onClick={() => {
                    currentHostConfig$.next(config);
                    setTimeout(() => {
                      // ISSUE: 在保证切换 terminal 能正常 GC 掉旧的 terminal 之前，刷新页面以确保状态干净。
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
                          payload: { name: config.name, URL: config.HV_URL },
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
